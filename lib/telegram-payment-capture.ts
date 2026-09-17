// ═══════════════════════════════════════════════════════════════════════════
// TELEGRAM → PAYMENT CAPTURE
// ═══════════════════════════════════════════════════════════════════════════
//
// Everything posted in the payments group lands here: a screenshot of what we
// paid a vendor, a screenshot of what a client paid us, or a line of text for
// a cash payment that has no receipt to photograph.
//
// This lives outside app/api/telegram/webhook/route.ts on purpose. That webhook
// is the busiest surface in the app, and every branch added inline there is a
// branch that can take job alerts down with it. Everything here is wrapped so a
// capture that fails NEVER breaks the rest of the webhook.

import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml } from './telegram-groups';
import {
    extractPaymentFromImage,
    extractPaymentFromText,
    findExistingCapture,
    guessVendors,
    guessClients,
    guessInvoices,
    loadOwnIdentity,
    matchCaptureToBank,
    PAYMENT_PROOF_BUCKET,
    type ExtractedPayment,
} from './payment-capture';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/** The telegram_groups.department value that turns a group into the payments inbox. */
export const PAYMENTS_DEPARTMENT = 'payments';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
/** Twice the webhook's maxDuration: past this, a half-finished capture is dead, not busy. */
const STALLED_AFTER_MS = 120_000;

interface Choice { kind: 'vendor' | 'client' | 'invoice'; id: string; label: string }

function rupees(n: number | null): string {
    if (n === null) return '—';
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Every Telegram call goes through here, and every failure is LOGGED.
 * Telegram refuses a whole message if one button is too long or the HTML does
 * not parse — silently, as far as the group is concerned. Discarding that
 * response made a rejected message indistinguishable from a bot that had
 * simply ignored the screenshot.
 */
async function tg(method: string, payload: Record<string, unknown>): Promise<any> {
    try {
        const res = await fetch(`${TELEGRAM_API}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) {
            console.error(`[telegram] ${method} failed:`, json?.description || res.status);
        }
        return json;
    } catch (err) {
        console.error(`[telegram] ${method} threw:`, err);
        return {};
    }
}

async function reply(chatId: string, text: string, replyTo?: number, keyboard?: unknown) {
    return tg('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_to_message_id: replyTo,
        ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
}

/** Telegram sends several sizes of the same photo; the last is the largest. */
function largestPhoto(photos: { file_id: string; file_size?: number }[]) {
    return photos[photos.length - 1];
}

type SupportedMedia = 'image/jpeg' | 'image/png' | 'image/webp';

/** Only these reach the model; anything else is reported rather than guessed at. */
function toSupportedMedia(mime: string | undefined, path: string): SupportedMedia | null {
    const m = (mime || '').toLowerCase();
    if (m === 'image/png') return 'image/png';
    if (m === 'image/webp') return 'image/webp';
    if (m === 'image/jpeg' || m === 'image/jpg') return 'image/jpeg';
    if (m) return null; // a real mime we do not support — say so, don't mislabel it
    const ext = path.split('.').pop()?.toLowerCase();
    return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

async function downloadTelegramFile(
    fileId: string,
    declaredMime?: string
): Promise<{ buffer: Buffer; mediaType: SupportedMedia } | null> {
    const info: any = await tg('getFile', { file_id: fileId });
    const path: string | undefined = info?.result?.file_path;
    if (!path) return null;
    const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;
    // A .heic sent as a document passes an "image/*" check but is not something
    // the model reads. Labelling it image/jpeg bought an error and a paid call.
    const mediaType = toSupportedMedia(declaredMime, path);
    if (!mediaType) return null;
    return { buffer, mediaType };
}

// ── Callback data ──────────────────────────────────────────────────────────
// Telegram caps callback_data at 64 BYTES, and rejects the entire message if
// any button exceeds it — silently, as far as the group is concerned. A capture
// id plus a vendor id is 77 bytes, so buttons carry an INDEX into the choices
// stored on the capture row instead.
const packId = (id: string) => id.replace(/-/g, '');
const unpackId = (hex: string) =>
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

const esc = (v: string | null | undefined) => escapeHtml(String(v ?? ''));

/**
 * Could this line plausibly be about money?
 *
 * Used ONLY to decide whether an auto-rejection is worth mentioning in the
 * group. Deliberately generous and deliberately stupid: it is not a second
 * reader, it is the difference between "chat" and "something with a figure in
 * it that I failed to understand". False positives cost one polite message;
 * false negatives cost a payment nobody ever hears about again.
 */
/**
 * The date to use for a cash payment that carries none of its own.
 *
 * A typed cash line ("65000 cash to satish") has no receipt, so the reader has
 * nothing to read a date FROM, and every such capture landed with txn_date null.
 * The bot then said "date not read" and the row joined the "date could not be
 * read" queue — a queue asking a person to supply something they never wrote,
 * which nobody could ever clear. Four such rows had built up by 2026-09-08.
 *
 * The message's own timestamp is the honest answer: cash is handed over at
 * roughly the moment it is posted about, and unlike a bank payment there is no
 * statement that could ever contradict it.
 *
 * Deliberately NOT applied to bank payments. A screenshot can be posted days
 * after the transfer, and dating one from the message would fabricate a date
 * that the bank feed then fails to match — inventing a discrepancy rather than
 * admitting an unknown.
 */
function cashFallbackDate(
    extracted: { is_cash?: boolean },
    messageDate?: number,
): string | null {
    if (!extracted.is_cash || !messageDate) return null;
    return new Date(messageDate * 1000).toISOString().slice(0, 10);
}

/**
 * When the reader says "not a payment" but the line carries a figure, work out
 * what it WOULD be, so the bot can ask a real question instead of a vague one.
 *
 * This is a proposal, never a record. Nothing is written to the books from it;
 * a person taps a button and chooses cash or bank, and only then does a capture
 * become live. That is the whole reason it is allowed to be this crude.
 *
 * The case it exists for (2026-09-08): "278 cable lable sticker from amazon".
 * No "paid", no "cash", no "Rs" — and 278 sits directly in front of a countable
 * noun, so "278 stickers" is a perfectly good reading of it, and in a printing
 * business arguably the better one. The reader was not being stupid; the
 * sentence genuinely says both. Asking is the only honest way through that.
 *
 * Dates are removed first: "12-09-26 to 12-09-27" must never be read as ₹12.
 */
function proposeFromText(text: string): { amount: number; description: string } | null {
    if (!text) return null;
    const withoutDates = text.replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, ' ');
    // Three things this regex has to get right, each learned by testing it
    // against real messages from the group:
    //   - the comma branch must REQUIRE a comma (+ not *), or "65000" matches
    //     only its first three digits and ₹65,000 is proposed as ₹650;
    //   - the number must not be glued to what precedes it, or the 0809001 in
    //     job number DP-0809001 becomes a payment;
    //   - nor to what follows it, for the same reason.
    const m = withoutDates.match(
        /(?:^|[\s(])(?:₹|rs\.?\s*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\w-])/i
    );
    if (!m) return null;
    const amount = Number(m[1].replace(/,/g, ''));
    // Below 10 is far more likely a count than a payment; above a crore, a
    // reference number that lost its label.
    if (!Number.isFinite(amount) || amount < 10 || amount > 10_000_000) return null;
    const description = withoutDates
        .replace(m[0], ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!description) return null;
    return { amount, description };
}

function looksLikeMoney(text: string): boolean {
    if (!text) return false;
    // Any run of 2+ digits, or 1+ digits next to a money word/symbol.
    if (/\d{2,}/.test(text)) return true;
    return /(₹|rs\.?|inr|cash|paid|payment|paise|rupee)/i.test(text);
}

function summary(c: {
    amount: number | null; paid_to: string | null; paid_from: string | null;
    txn_date: string | null; bank_name: string | null; reference_number: string | null;
    gateway_status: string | null; extraction_confidence?: string | null;
    confidence?: string | null; direction: 'out' | 'in'; is_cash?: boolean;
    payment_method?: string | null;
}): string {
    const incoming = c.direction === 'in';
    const other = esc((incoming ? c.paid_from : c.paid_to) || 'unknown party');
    const lines = [
        incoming
            ? `📥 <b>Received ${rupees(c.amount)}</b> from <b>${other}</b>`
            : `💸 <b>Paid ${rupees(c.amount)}</b> to <b>${other}</b>`,
        `📅 ${esc(c.txn_date) || 'date not read'}${c.bank_name ? ` · ${esc(c.bank_name)}` : ''}` +
            `${c.is_cash ? ' · CASH' : c.payment_method ? ` · ${esc(c.payment_method)}` : ''}`,
    ];
    if (c.reference_number) lines.push(`🔖 Ref ${esc(c.reference_number)}`);
    // Shown, never hidden: an "Accepted" is not a "Successful", and the whole
    // system exists to respect that difference.
    if (c.gateway_status) lines.push(`🏦 Bank says: <i>${esc(c.gateway_status)}</i>`);
    if (c.is_cash) lines.push(`💵 Cash — no bank statement will show this, so it goes on the "To enter in Zoho" list instead.`);
    const conf = c.extraction_confidence ?? c.confidence;
    if (conf === 'low') lines.push(`⚠️ <b>Low confidence</b> — please check the figures.`);
    return lines.join('\n');
}

/**
 * Replace the offered options and bump the revision.
 *
 * The buttons reference these BY INDEX, so when the list is replaced (a client
 * was chosen, and the bot now offers invoices) an old keyboard still on screen
 * would resolve its index against the new list — someone tapping "client #2"
 * would file invoice #2 instead, with a cheerful confirmation. The revision
 * travels in the callback data so a stale tap is refused, not misapplied.
 */
async function storeChoices(db: SupabaseClient, captureId: string, choices: Choice[]): Promise<number> {
    const { data } = await db.from('payment_captures').select('choices_rev').eq('id', captureId).maybeSingle();
    const rev = Number(data?.choices_rev ?? 0) + 1;
    await db.from('payment_captures').update({ offered_choices: choices, choices_rev: rev }).eq('id', captureId);
    return rev;
}

/** Build the question and the buttons, and remember what was offered. */
async function askWhose(
    db: SupabaseClient,
    captureId: string,
    extracted: ExtractedPayment
): Promise<{ text: string; keyboard: unknown[]; }> {
    const incoming = extracted.direction === 'in';
    const other = incoming ? extracted.paid_from : extracted.paid_to;
    const choices: Choice[] = [];

    if (incoming) {
        const { data: clients } = await db
            .from('clients').select('id, name, company').limit(500);
        for (const g of guessClients(other, clients || [])) {
            choices.push({ kind: 'client', id: g.id, label: g.name });
        }
    } else {
        const { data: vendors } = await db
            .from('vendors').select('id, name, company').eq('is_active', true).limit(500);
        for (const g of guessVendors(other, vendors || [])) {
            choices.push({ kind: 'vendor', id: g.id, label: g.name });
        }
    }

    const rev = await storeChoices(db, captureId, choices);

    const hex = packId(captureId);
    const keyboard: unknown[] = choices.map((c, i) => [
        { text: `✅ ${c.label}`, callback_data: `pc:${hex}:${rev}:c${i}` },
    ]);
    keyboard.push([{ text: `🔎 Someone else — pick in app`, callback_data: `pc:${hex}:${rev}:o` }]);
    keyboard.push([{ text: '🚫 Not a payment', callback_data: `pc:${hex}:${rev}:x` }]);

    const question = incoming ? 'Which client is this from?' : 'Which vendor is this against?';
    return { text: `${summary(extracted)}\n\n<b>${question}</b>`, keyboard };
}

/** After a client is chosen, offer the invoice it settles — only where clear. */
async function askInvoice(
    db: SupabaseClient,
    captureId: string,
    clientName: string,
    amount: number | null
): Promise<{ text: string; keyboard: unknown[] } | null> {
    const guesses = await guessInvoices(db, clientName, amount);
    if (guesses.length === 0) return null;

    const choices: Choice[] = guesses.map((g) => ({
        kind: 'invoice', id: g.id, label: `${g.doc_number} · ${rupees(g.balance)} — ${g.reason}`,
    }));
    const rev = await storeChoices(db, captureId, choices);

    const hex = packId(captureId);
    const keyboard: unknown[] = choices.map((c, i) => [
        { text: `🧾 ${c.label}`, callback_data: `pc:${hex}:${rev}:c${i}` },
    ]);
    keyboard.push([{ text: '⏭ Skip — not against one invoice', callback_data: `pc:${hex}:${rev}:o` }]);
    return { text: `<b>Which invoice does this settle?</b>`, keyboard };
}

// ── Incoming screenshot ────────────────────────────────────────────────────

/** Handle a photo posted in the payments group. True if it took the message. */
export async function handlePaymentPhoto(db: SupabaseClient, message: any): Promise<boolean> {
    const photos = message?.photo;
    if (!Array.isArray(photos) || photos.length === 0) return false;

    const chatId = String(message.chat.id);
    const messageId = Number(message.message_id);

    let captureId: string | null;
    try {
        captureId = await claimMessage(db, message, {
            telegram_file_id: largestPhoto(photos).file_id,
            entry_kind: 'screenshot',
        });
    } catch (err: any) {
        // The row could not be written at all. Throwing alone was still silent
        // — the webhook catches it and answers 200 — so the group is told here,
        // where somebody is actually looking.
        await reply(chatId, `⚠️ Couldn't record that payment. Please tell admin — it has not been saved.`, messageId);
        console.error('[telegram] claim failed:', err?.message || err);
        return true;
    }
    if (!captureId) return true; // a retry of a message we already have

    try {
        const file = await downloadTelegramFile(
            largestPhoto(photos).file_id,
            message.__declared_mime
        );
        if (!file) throw new Error('Could not read that image (unsupported format, or too large)');

        // Store the proof BEFORE reading it. If the extraction is wrong the
        // picture is still the evidence; losing it is worse than a bad parse.
        const path = `telegram/${chatId}/${messageId}-${Date.now()}.jpg`;
        const { error: upErr } = await db.storage
            .from(PAYMENT_PROOF_BUCKET)
            .upload(path, file.buffer, { contentType: file.mediaType, upsert: true });
        if (upErr) {
            // The capture still goes ahead — the figures are worth more than the
            // thumbnail — but a missing proof must not be a mystery later.
            console.error('[telegram] payment proof upload failed:', upErr.message);
        }
        const imageUrl = upErr
            ? null
            : db.storage.from(PAYMENT_PROOF_BUCKET).getPublicUrl(path).data.publicUrl;

        const identity = await loadOwnIdentity(db);
        const extracted = await extractPaymentFromImage(file.buffer, file.mediaType, identity);

        await finishCapture(db, captureId, extracted, chatId, messageId, {
            image_url: imageUrl,
            image_path: upErr ? null : path,
        }, Number(message.date) || undefined);
        return true;
    } catch (err: any) {
        await failCapture(db, captureId, chatId, messageId, err);
        return true;
    }
}

// ── Typed message (cash, UPI, anything without a receipt) ──────────────────

/**
 * Handle a plain text message in the payments group.
 *
 * Most messages here are conversation, so this must stay quiet: it answers
 * only when it is confident a payment is being recorded, and says nothing at
 * all otherwise. A bot that replies "that's not a payment" to every chat line
 * gets muted, and a muted group records nothing.
 */
export async function handlePaymentText(db: SupabaseClient, message: any): Promise<boolean> {
    const text: string = (message?.text || '').trim();
    if (!text || text.startsWith('/')) return false;

    // Cheap gate first, so ordinary conversation never reaches the claim or the
    // model. No digits means no amount, so it cannot be a payment record.
    if (text.length < 6 || text.length > 1000 || !/\d/.test(text)) return false;

    const chatId = String(message.chat.id);
    const messageId = Number(message.message_id);

    // Claim BEFORE the paid call — the same rule the photo path follows.
    // Doing the extraction first meant every webhook redelivery of a typed
    // payment paid for the model again.
    let captureId: string | null;
    try {
        captureId = await claimMessage(db, message, { entry_kind: 'text', raw_text: text });
    } catch (err: any) {
        // Silent by design: nobody has said this line is a payment, so the bot
        // must not start announcing failures over ordinary conversation.
        console.error('[telegram] claim failed:', err?.message || err);
        return false;
    }
    if (!captureId) return true;

    try {
        const identity = await loadOwnIdentity(db);
        const extracted = await extractPaymentFromText(text, identity);
        if (!extracted) {
            // Ordinary chatter. The row is CLOSED, not deleted: deleting it
            // would drop the unique-index protection, so a redelivery of the
            // same chat line would pay for the model a second time. It is
            // invisible in the review screen, which lists only live captures.
            await db.from('payment_captures')
                .update({ status: 'rejected', notes: 'Not a payment record (auto)' })
                .eq('id', captureId);

            // ...but say so when the line LOOKED like money.
            //
            // Staying silent over ordinary conversation is deliberate and still
            // holds. What did not hold is staying silent over a line the reader
            // merely FAILED to understand. On 2026-09-08 "278 cable lable
            // sticker from amazon" — ₹278 of stickers — was auto-rejected and
            // the group heard nothing. Money left the business and the only
            // trace was a status nobody would ever look at.
            //
            // The test is deliberately dumber than the reader: a number that
            // could be an amount, or a money word. "ok", "send the file",
            // "good morning" stay silent. Anything with a figure in it gets a
            // question, because a wrongly-dropped payment costs far more than a
            // wrongly-asked question.
            //
            // The question is SPECIFIC where it can be. This group is called
            // Payment, so a bare figure in it probably is rupees — but probably
            // is not good enough to write into the books, and "500 stickers
            // ready for dispatch" must never become ₹500. So the bot proposes a
            // reading and a person confirms it, choosing cash or bank, because
            // that decides which queue it belongs in and only they know.
            if (looksLikeMoney(text)) {
                const guess = proposeFromText(text);
                const hex = packId(captureId);
                if (guess) {
                    // Kept on the row so the button does not have to carry it:
                    // callback_data is capped at 64 bytes and Telegram drops the
                    // whole message, silently, if any button exceeds it.
                    await db.from('payment_captures')
                        .update({ extraction_raw: { auto_rejected: true, proposed: guess } as any })
                        .eq('id', captureId);
                    await reply(
                        chatId,
                        `🤔 I could not tell whether that was a payment.\n\n` +
                        `Did you pay <b>₹${guess.amount.toLocaleString('en-IN')}</b> ` +
                        `for <i>${escapeHtml(guess.description.slice(0, 120))}</i>?\n\n` +
                        `<i>If ${guess.amount.toLocaleString('en-IN')} was a quantity and not money, ` +
                        `just tap "Not a payment".</i>`,
                        messageId,
                        [
                            [{ text: `🏦 Yes — from bank`, callback_data: `pc:${hex}:0:b` }],
                            [{ text: '🚫 Not a payment', callback_data: `pc:${hex}:0:x` }],
                        ],
                    );
                } else {
                    await reply(
                        chatId,
                        `🤔 I could not read a payment in that, so I have set it aside.\n\n` +
                        `<i>${escapeHtml(text.slice(0, 200))}</i>\n\n` +
                        `If it was a payment, tap below and finish it in ` +
                        `Finance → Payment Captures.`,
                        messageId,
                        [[{ text: '💰 It was a payment', callback_data: `pc:${hex}:0:b` }]],
                    );
                }
            }
            return false;
        }
        await finishCapture(db, captureId, extracted, chatId, messageId, {}, Number(message.date) || undefined);
    } catch (err: any) {
        // A model outage must NOT make the bot announce itself over ordinary
        // conversation — at this point nobody has said this is even a payment.
        // The row keeps the error for the review screen; the group hears nothing.
        console.error('[telegram] text capture failed:', err?.message || err);
        await db.from('payment_captures')
            .update({ extraction_error: String(err?.message || err).slice(0, 500) })
            .eq('id', captureId);
        return false;
    }
    return true;
}

// ── Shared capture plumbing ────────────────────────────────────────────────

/**
 * Claim the message FIRST, before any paid work.
 * Telegram retries updates it believes failed; without this one screenshot
 * becomes three captures, three model calls and three replies in the group.
 * Returns null when the message was already claimed.
 */
async function claimMessage(
    db: SupabaseClient,
    message: any,
    extra: Record<string, unknown>
): Promise<string | null> {
    const chatId = String(message.chat.id);
    const messageId = Number(message.message_id);
    const fromId = message.from?.id ? String(message.from.id) : null;
    let postedBy: string | null = null;
    if (fromId) {
        const { data: p } = await db.from('profiles').select('id').eq('telegram_chat_id', fromId).maybeSingle();
        postedBy = p?.id || null;
    }
    const label = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || null;

    const { data, error } = await db
        .from('payment_captures')
        .insert({
            source: 'telegram',
            telegram_chat_id: chatId,
            telegram_message_id: messageId,
            posted_by_profile_id: postedBy,
            posted_by_label: label,
            status: 'pending',
            ...extra,
        })
        .select('id')
        .single();

    if (data) {
        // Activity trail: a payment arriving in the group is a system event with
        // no signed-in user behind it, so posted_by_profile_id is the actor and
        // may legitimately be null when the poster is not a known staff member.
        // Fire-and-forget — a failed log must never lose the capture.
        void db.from('activity_logs').insert([{
            user_id: postedBy,
            user_name: label,
            action: 'Payment Capture Received',
            entity_type: 'payment_capture',
            entity_id: data.id,
            description: `Posted in the Telegram payments group by ${label || 'an unknown sender'}`,
            metadata: { module: 'Finance', source: 'telegram', telegram_chat_id: chatId },
        }]).then(({ error: logErr }: { error: { message: string } | null }) => {
            if (logErr) console.warn('[telegram] activity log failed:', logErr.message);
        });
        return data.id as string;
    }

    // 23505 is the unique index — this exact Telegram message is already ours.
    // Anything else is a REAL failure (an RLS change, a new NOT NULL column),
    // and returning null for it silently swallowed every screenshot in the
    // group while the webhook went on answering 200.
    if (error && error.code !== '23505') {
        console.error('[telegram] could not record the capture:', error.message);
        throw new Error(`Could not record the capture: ${error.message}`);
    }

    // A genuine redelivery. Usually there is nothing to do.
    //
    // But if the first attempt died mid-flight (the model call outran the
    // function timeout) the row sits there with no amount, no error and no
    // reply in the group — indistinguishable from a message the bot ignored.
    //
    // The AGE CHECK is what makes resuming safe. "Still running" and "died"
    // look identical in the row, and Telegram's first retry arrives while the
    // original attempt is very much alive — so resuming on state alone meant a
    // second paid vision call and a second set of buttons in the group. Nothing
    // can still be running after twice the function's own time limit.
    const deadline = new Date(Date.now() - STALLED_AFTER_MS).toISOString();
    const { data: existing } = await db
        .from('payment_captures')
        .select('id, amount, extraction_error, extraction_raw')
        .eq('telegram_chat_id', chatId)
        .eq('telegram_message_id', messageId)
        .lt('created_at', deadline)
        .maybeSingle();
    if (existing && existing.amount === null && !existing.extraction_error && !existing.extraction_raw) {
        return existing.id as string;
    }
    return null;
}

/** Write the extracted fields, detect duplicates, try to match, then ask. */
async function finishCapture(
    db: SupabaseClient,
    captureId: string,
    extracted: ExtractedPayment,
    chatId: string,
    messageId: number,
    extra: Record<string, unknown>,
    /** Unix seconds from the Telegram message — the fallback date for cash. */
    messageDate?: number,
): Promise<void> {
    if (!extracted.is_payment_receipt) {
        // A photo of a job, a meme, a bill. Drop it quietly rather than nagging
        // the group about every image someone shares.
        await db.from('payment_captures').update({
            ...extra,
            status: 'rejected',
            notes: 'Not a payment receipt (auto)',
            extraction_raw: extracted as any,
        }).eq('id', captureId);
        return;
    }

    // Cash and UPI-outside-the-bank are not recorded in this system any more.
    // The cash book left the app in September 2026: HDFC is the only money the
    // app tracks, and cash lives in Vyapar. Capturing it here would rebuild the
    // second set of books we deliberately closed, so the bot says so and stops.
    if (extracted.is_cash) {
        await db.from('payment_captures').update({
            ...extra,
            status: 'rejected',
            notes: 'Cash is not recorded in this system — it belongs in Vyapar.',
            extraction_raw: extracted as any,
        }).eq('id', captureId);
        await reply(
            chatId,
            `💵 That looks like cash, and cash is not recorded here any more.\n\n` +
            `Please enter it in <b>Vyapar</b>. This system tracks the HDFC account only.`,
            messageId,
        );
        return;
    }

    // A failed duplicate check must not read as "not a duplicate". When it
    // cannot answer, the capture stays pending and a person decides.
    let duplicate: { id: string; status: string } | null = null;
    let duplicateCheckFailed = false;
    try {
        duplicate = await findExistingCapture(db, extracted, captureId);
    } catch (err: any) {
        duplicateCheckFailed = true;
        console.error('[payment-capture] duplicate check failed:', err?.message || err);
    }

    await db.from('payment_captures').update({
        ...extra,
        amount: extracted.amount,
        currency: extracted.currency,
        paid_to: extracted.paid_to,
        paid_from: extracted.paid_from,
        txn_date: extracted.txn_date ?? cashFallbackDate(extracted, messageDate),
        bank_name: extracted.bank_name,
        transaction_id: extracted.transaction_id,
        reference_number: extracted.reference_number,
        payment_method: extracted.payment_method,
        gateway_status: extracted.gateway_status,
        transfer_note: extracted.transfer_note,
        direction: extracted.direction,
        // Cash never reaches a bank feed, so it must never be counted as an
        // unconfirmed payment — that list has to stay worth reading.
        needs_bank_match: !extracted.is_cash,
        extraction_confidence: extracted.confidence,
        extraction_raw: extracted as any,
        status: duplicate ? 'duplicate' : 'pending',
        duplicate_of_id: duplicate?.id || null,
        notes: duplicateCheckFailed
            ? 'Could not check for duplicates — confirm this is not already recorded.'
            : null,
    }).eq('id', captureId);

    if (duplicate) {
        await reply(chatId, `♻️ Already captured — same reference number. Nothing double-counted.`, messageId);
        return;
    }

    // The bank line may already be here (a screenshot posted days late).
    await tryMatch(db, captureId);

    const { text, keyboard } = await askWhose(db, captureId, extracted);
    await reply(chatId, text, messageId, keyboard);
}

async function failCapture(
    db: SupabaseClient, captureId: string, chatId: string, messageId: number, err: any
): Promise<void> {
    // The row survives with the error on it, so the screenshot is never
    // silently lost — accounts sees it in the review screen.
    await db.from('payment_captures')
        .update({ extraction_error: String(err?.message || err).slice(0, 500) })
        .eq('id', captureId);
    await reply(
        chatId,
        `⚠️ Saved it but couldn't read it automatically. It's waiting in Finance → Payment Captures.`,
        messageId
    );
}

// ── Button presses ─────────────────────────────────────────────────────────

/** Handles the pc: callbacks. Returns true if it owned the query. */
export async function handlePaymentCallback(db: SupabaseClient, query: any): Promise<boolean> {
    const data: string = query?.data || '';
    if (!data.startsWith('pc:')) return false;

    const [, hex, revStr, action] = data.split(':');
    const captureId = unpackId(hex || '');
    const chatId = query.message?.chat?.id ? String(query.message.chat.id) : null;
    const answer = (text: string) => tg('answerCallbackQuery', { callback_query_id: query.id, text });

    const fromId = query.from?.id ? String(query.from.id) : null;
    let actorId: string | null = null;
    if (fromId) {
        const { data: p } = await db.from('profiles').select('id').eq('telegram_chat_id', fromId).maybeSingle();
        actorId = p?.id || null;
    }

    const { data: capture } = await db
        .from('payment_captures')
        .select('id, amount, paid_to, paid_from, txn_date, bank_name, reference_number, gateway_status, payment_method, extraction_confidence, status, direction, needs_bank_match, offered_choices, choices_rev, zoho_bank_transaction_id, extraction_raw, raw_text, created_at')
        .eq('id', captureId)
        .maybeSingle();
    if (!capture) { await answer('That capture no longer exists.'); return true; }

    // Anyone can be added to a group chat. Deciding which vendor a payment
    // belongs to — or striking one off entirely — is a finance decision, so it
    // needs a linked staff account, the same as the equivalent action in the app.
    if (!actorId) {
        await answer('Link your Telegram to your Aayam account first (Settings → Users → Get Link).');
        return true;
    }

    // A capture the bank has already proved must not be quietly undone from a
    // message that has been sitting in the group for days.
    if (capture.zoho_bank_transaction_id && action === 'x') {
        await answer('The bank statement already confirms this payment — reject it in the app if it is really wrong.');
        return true;
    }

    // A stale keyboard: the offered list has been replaced since this message
    // was drawn, so this index no longer means what the tapper saw.
    if (Number(revStr) !== Number(capture.choices_rev ?? 0) && action?.startsWith('c')) {
        await answer('These options are out of date — please use the newest message, or the app.');
        return true;
    }

    const editSummary = async (extraLine: string, keyboard?: unknown[]) => {
        if (!chatId) return;
        await tg('editMessageText', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            text: `${summary({ ...(capture as any), is_cash: capture.needs_bank_match === false })}\n\n${extraLine}`,
            ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
        });
    };

    if (action === 'x') {
        await db.from('payment_captures').update({
            status: 'rejected', notes: 'Marked not-a-payment from Telegram',
            confirmed_by: actorId, confirmed_at: new Date().toISOString(),
        }).eq('id', captureId);
        await answer('Marked as not a payment.');
        if (chatId) await tg('editMessageText', {
            chat_id: chatId, message_id: query.message.message_id,
            text: '🚫 Marked as not a payment.', parse_mode: 'HTML',
        });
        return true;
    }

    // Overruling an automatic rejection. 'p' = it was cash, 'b' = it came out of
    // the bank. The split is not decoration: cash never reaches a bank feed and
    // must stay out of the unconfirmed list, while a bank payment must stay IN
    // it until a statement line proves it. Only the person who paid knows which,
    // so the button asks rather than the code guessing.
    // 'p' was the old "it was cash" button. Cash is no longer recorded here, but
    // those buttons still sit in the group's history, so the code must answer
    // them — by refusing, not by writing a cash row.
    if (action === 'p') {
        await db.from('payment_captures').update({
            status: 'rejected',
            notes: 'Cash is not recorded in this system — it belongs in Vyapar.',
            confirmed_by: actorId, confirmed_at: new Date().toISOString(),
        }).eq('id', captureId);
        await answer('Cash is not recorded here — please enter it in Vyapar.');
        if (chatId) await tg('editMessageText', {
            chat_id: chatId, message_id: query.message.message_id,
            text: '💵 Cash is not recorded here any more — please enter it in Vyapar.',
            parse_mode: 'HTML',
        });
        return true;
    }

    if (action === 'b') {
        const wasCash = false;
        const proposed = (capture as any).extraction_raw?.proposed as
            { amount?: number; description?: string } | undefined;

        const patch: Record<string, unknown> = {
            status: 'pending',
            needs_bank_match: !wasCash,
            confirmed_by: actorId,
            confirmed_at: new Date().toISOString(),
            notes: 'Reopened from Telegram — the reader had set it aside',
        };

        // Only fill in what a person just vouched for by tapping. If there was
        // no proposal on the row, the capture reopens empty and is completed in
        // the app — an empty row in the inbox is honest; a guessed amount is not.
        if (proposed?.amount) {
            patch.amount = proposed.amount;
            patch.currency = 'INR';
            patch.direction = 'out';
            patch.paid_to = proposed.description?.slice(0, 120) || null;
            patch.extraction_confidence = 'low';
        }
        if (wasCash) {
            patch.payment_method = 'cash';
            // Same rule as a typed cash entry: the message's own date, because
            // cash has no receipt and no statement can contradict it. Bank
            // payments deliberately get nothing — see cashFallbackDate.
            const posted = (capture as any).created_at;
            if (posted) patch.txn_date = new Date(posted).toISOString().slice(0, 10);
        }

        await db.from('payment_captures').update(patch).eq('id', captureId);
        await answer(wasCash ? 'Recorded as cash.' : 'Recorded — waiting for the bank line.');
        if (chatId) await tg('editMessageText', {
            chat_id: chatId, message_id: query.message.message_id,
            text: proposed?.amount
                ? `${wasCash ? '💵' : '🏦'} Recorded ₹${Number(proposed.amount).toLocaleString('en-IN')}` +
                  ` — ${esc(proposed.description || '')}.` +
                  (wasCash
                      ? ' Cash, so it goes on the "To enter in Zoho" list.'
                      : ' Waiting for a matching line in the bank statement.')
                : '💰 Reopened — waiting for you in Finance → Payment Captures.',
            parse_mode: 'HTML',
        });
        return true;
    }

    if (action === 'o') {
        await answer('Open Finance → Payment Captures to finish this one.');
        await editSummary('↪️ Left for accounts to finish in the app.');
        return true;
    }

    if (!action?.startsWith('c')) {
        // Includes buttons drawn by an older version of this code, whose
        // callback data has fewer parts.
        await answer('This message is from an older version — please finish it in the app.');
        return true;
    }

    const index = Number(action.slice(1));
    const choices = (capture.offered_choices || []) as Choice[];
    const choice = choices[index];
    if (!choice) { await answer('That option has expired — please use the app.'); return true; }

    if (choice.kind === 'invoice') {
        await db.from('payment_captures').update({
            zoho_document_id: choice.id,
            confirmed_by: actorId,
            confirmed_at: new Date().toISOString(),
        }).eq('id', captureId);
        await answer(`Linked to ${choice.label.split(' ·')[0]}`);
        await editSummary(`✅ Against invoice <b>${esc(choice.label.split(' ·')[0])}</b>`);
        return true;
    }

    const patch: Record<string, unknown> = {
        // 'confirmed' means a human vouched for WHO — never that money moved.
        // Only the bank feed promotes a capture to 'verified'.
        //
        // 'duplicate' and 'rejected' are preserved deliberately. tryMatch can
        // demote a capture to 'duplicate' between the summary being written and
        // the buttons being posted, and those buttons never expire — so a tap
        // used to resurrect a duplicate as a second live copy of one payment.
        status: ['verified', 'duplicate', 'rejected'].includes(capture.status)
            ? capture.status
            : 'confirmed',
        confirmed_by: actorId,
        confirmed_at: new Date().toISOString(),
    };
    if (choice.kind === 'client') patch.client_id = choice.id;
    else patch.vendor_id = choice.id;
    await db.from('payment_captures').update(patch).eq('id', captureId);

    const matched = await tryMatch(db, captureId);
    await answer(
        capture.status === 'duplicate' ? `Noted, but this is a duplicate of an earlier capture.`
        : capture.status === 'rejected' ? `Noted, but this one was already struck off.`
        : `Linked to ${choice.label}`
    );

    // For money received, the useful follow-up question is which invoice.
    if (choice.kind === 'client') {
        const invoice = await askInvoice(db, captureId, choice.label, capture.amount);
        if (invoice) {
            await editSummary(`✅ From <b>${esc(choice.label)}</b>\n\n${invoice.text}`, invoice.keyboard as unknown[]);
            return true;
        }
    }

    await editSummary(
        `✅ ${choice.kind === 'client' ? 'From' : 'Vendor'}: <b>${esc(choice.label)}</b>\n` +
        (capture.needs_bank_match === false
            ? `💵 Cash — no bank statement will confirm this. It is now on the "To enter in Zoho" list in Finance → Payment Captures.`
            : matched
                ? `🏦 Matched to the bank statement — verified.`
                : `⏳ Waiting for the bank feed to confirm it (usually next day).`)
    );
    return true;
}

// ── Matching ───────────────────────────────────────────────────────────────

/** Try to promote a capture to 'verified' using the Zoho bank feed. */
export async function tryMatch(db: SupabaseClient, captureId: string): Promise<boolean> {
    const { data: capture } = await db
        .from('payment_captures')
        .select('id, amount, txn_date, reference_number, transaction_id, transfer_note, paid_to, paid_from, direction, needs_bank_match, status, zoho_bank_transaction_id')
        .eq('id', captureId)
        .maybeSingle();
    if (!capture || capture.zoho_bank_transaction_id) return false;
    if (['rejected', 'duplicate'].includes(capture.status)) return false;
    if (capture.needs_bank_match === false) return false;

    const match = await matchCaptureToBank(db, capture as any);
    if (!match) return false;

    // One bank line proves ONE payment. If another capture already claimed it,
    // this one is a duplicate of that, not a second payment.
    const { data: taken } = await db
        .from('payment_captures')
        .select('id')
        .eq('zoho_bank_transaction_id', match.zoho_bank_transaction_id)
        .neq('id', captureId)
        .maybeSingle();
    if (taken) {
        await db.from('payment_captures')
            .update({ status: 'duplicate', duplicate_of_id: taken.id })
            .eq('id', captureId);
        return false;
    }

    const { error } = await db.from('payment_captures').update({
        zoho_bank_transaction_id: match.zoho_bank_transaction_id,
        match_method: match.match_method,
        matched_at: new Date().toISOString(),
        status: 'verified',
    }).eq('id', captureId);

    // A partial unique index on zoho_bank_transaction_id is what actually
    // enforces "one bank line proves one payment". The check above is a
    // courtesy; this is the guarantee, and it is the branch that fires when the
    // reconcile cron and a button tap race for the same line.
    if (error) {
        if (error.code === '23505') {
            const { data: winner } = await db
                .from('payment_captures').select('id')
                .eq('zoho_bank_transaction_id', match.zoho_bank_transaction_id)
                .neq('id', captureId).limit(1).maybeSingle();
            await db.from('payment_captures')
                .update({ status: 'duplicate', duplicate_of_id: winner?.id || null })
                .eq('id', captureId);
        } else {
            console.error('[payment-capture] could not record the bank match:', error.message);
        }
        return false;
    }
    return true;
}
