// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT CAPTURE — read a bank payment screenshot, park it, match it later
// ═══════════════════════════════════════════════════════════════════════════
//
// This is the ONLY place in the payment-capture pipeline where an AI is used,
// and it does exactly one thing: turn a picture into fields. Every decision
// after this point — is it a duplicate, does it match the bank, does it become
// a vendor payment — is plain deterministic code, because that is where a
// wrong guess would cost money.
//
// The extractor is told never to normalise the receipt's own status wording.
// "Request Accepted" is NOT "Successful"; HDFC accepts requests that later
// fail. Preserving that word is the difference between an inbox and a lie.

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

export const PAYMENT_PROOF_BUCKET = 'payment-proofs';

export interface ExtractedPayment {
    amount: number | null;
    currency: string | null;
    paid_to: string | null;
    paid_from: string | null;
    txn_date: string | null;          // ISO yyyy-mm-dd
    bank_name: string | null;
    transaction_id: string | null;
    reference_number: string | null;
    payment_method: string | null;
    gateway_status: string | null;    // verbatim from the receipt
    transfer_note: string | null;     // e.g. "aayam2onyxprint" — the handle the bank echoes
    is_payment_receipt: boolean;
    /** 'out' = we paid someone. 'in' = someone paid us. */
    direction: 'out' | 'in';
    /** True when the money never touched a bank account, so no feed line will ever exist. */
    is_cash: boolean;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Who WE are, so the reader can tell which side of the receipt is us.
 * Without this, "Aayam Communication → Onyx Print" and "Aryadev Chemicals →
 * Aayam Communication" look like the same shape, and an incoming client payment
 * would be filed as money we spent.
 */
export interface OwnIdentity {
    /** Company names as they appear on receipts. */
    names: string[];
    /** Last four digits of our own bank accounts, e.g. ['3911']. */
    accountTails: string[];
}

export const DEFAULT_IDENTITY: OwnIdentity = {
    names: ['Aayam Communication', 'Aayam Creative', 'Aayam'],
    accountTails: ['3911'],
};

/** Read the company name from app_settings, falling back to the constant above. */
export async function loadOwnIdentity(db: SupabaseClient): Promise<OwnIdentity> {
    try {
        const { data } = await db.from('app_settings').select('value').eq('key', 'company_info').maybeSingle();
        const parsed = data?.value ? JSON.parse(data.value) : null;
        const name = parsed?.companyName;
        if (name && typeof name === 'string' && name.trim()) {
            const names = Array.from(new Set([name.trim(), ...DEFAULT_IDENTITY.names]));
            return { ...DEFAULT_IDENTITY, names };
        }
    } catch {
        // A malformed settings row must not stop a payment being captured.
    }
    return DEFAULT_IDENTITY;
}

const SYSTEM_PROMPT =
    'You read Indian bank payment receipts and UPI/NEFT/IMPS confirmation screenshots. ' +
    'Return ONLY valid JSON, no markdown fences, no commentary.';

const USER_PROMPT = `Read this screenshot and return JSON with exactly these keys:

{
  "is_payment_receipt": true/false,
  "amount": number or null,
  "currency": "INR" or null,
  "paid_to": string or null,
  "paid_from": string or null,
  "txn_date": "YYYY-MM-DD" or null,
  "bank_name": string or null,
  "transaction_id": string or null,
  "reference_number": string or null,
  "payment_method": string or null,
  "gateway_status": string or null,
  "transfer_note": string or null,
  "direction": "out" | "in",
  "is_cash": true/false,
  "confidence": "high" | "medium" | "low"
}

Rules:
- is_payment_receipt: false for anything that is not a payment/transfer confirmation
  (a chat screenshot, a photo, an invoice, a balance screen). Set every other field
  null in that case.
- amount: digits only. "Rs 22,700" and "INR 22,700.00" both become 22700.
- paid_to: the BENEFICIARY (who received the money), never our own account.
- paid_from: the REMITTER (whose account was debited), if shown.
- txn_date: the transaction date shown on the receipt. "Sep 01, 2026" is 2026-09-01.
  Indian receipts use DD/MM/YYYY, so 01/09/2026 is also 2026-09-01. Null if absent.
- transaction_id and reference_number are DIFFERENT fields when both appear.
  Copy each EXACTLY as printed, including letters and leading zeros.
  Never merge them, never invent one from the other.
- gateway_status: copy the status wording VERBATIM. "Request Accepted",
  "Successful", "Processing", "Pending", "Failed". Do NOT translate, shorten,
  or upgrade it. "Request Accepted" must never be returned as "Successful".
- transfer_note: any short transfer nickname / handle / UPI-style label printed on
  the receipt, usually just under the amount — e.g. "aayam2onyxprint", "AAYAM2PUNIT".
  This is NOT the payee name and NOT the reference number. Copy it exactly, lowercase
  or uppercase as printed. Null if there is no such label.
- direction: work out which side of the receipt WE are on, using OUR IDENTITY below.
    "out" — our name/account is the SENDER (labelled Paid By, From, Debited From,
            Remitter). We paid someone else.
    "in"  — our name/account is the RECEIVER (labelled Paid To, To, Credited To,
            Beneficiary). Someone paid us.
  Decide from the labels, never from the amount or who looks more important. If our
  name appears on neither side, choose "out" and set confidence "low".
- is_cash: true only when the receipt or note says the money was handed over as cash.
  A UPI, IMPS, NEFT, RTGS or card payment is NOT cash.
- confidence: "low" if the image is blurry, cropped, or you had to guess any digit
  of the amount or a reference. Guessing is worse than admitting low confidence.
- Any field you cannot read: null. Never fabricate.`;

/** Digits only, uppercased — so "5514 7033" and "55147033" compare equal. */
export function normalizeRef(ref: string | null | undefined): string | null {
    if (!ref) return null;
    const cleaned = String(ref).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned.length >= 6 ? cleaned : null;
}

function num(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}

function str(v: unknown): string | null {
    if (typeof v === 'number') return String(v);
    return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function isoDate(v: unknown): string | null {
    const s = str(v);
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    // A receipt dated years away is a misread, not a payment.
    const yearsOff = Math.abs(d.getTime() - Date.now()) / (365 * 864e5);
    return yearsOff > 2 ? null : s;
}

/**
 * Send the screenshot to Claude and get structured fields back.
 * Throws only on a hard API failure — a receipt it cannot read comes back as
 * a low-confidence result with nulls, which is a capture a human can finish.
 */
function identityBlock(identity: OwnIdentity): string {
    return `\n\nOUR IDENTITY (use this only to decide "direction"):\n` +
        `Company names: ${identity.names.join(', ')}\n` +
        `Our own bank accounts end in: ${identity.accountTails.join(', ')}\n` +
        `Anyone else named on the receipt is the other party.`;
}

export async function extractPaymentFromImage(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
    identity: OwnIdentity = DEFAULT_IDENTITY
): Promise<ExtractedPayment> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
            role: 'user',
            content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBuffer.toString('base64') } },
                { type: 'text', text: USER_PROMPT + identityBlock(identity) },
            ],
        }],
    });

    const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();

    // The model is told not to fence its JSON, but a stray fence must not cost
    // us the whole capture.
    const jsonText = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);

    const raw = JSON.parse(jsonText.slice(start, end + 1));
    const confidence = ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'low';

    return {
        // Default to NOT a receipt. Every other coercion here defaults to the
        // safe side; this one used to default to "yes", so a response missing
        // the key turned a meme into a payment awaiting a vendor.
        is_payment_receipt: raw.is_payment_receipt === true,
        amount: num(raw.amount),
        currency: str(raw.currency) || 'INR',
        paid_to: str(raw.paid_to),
        paid_from: str(raw.paid_from),
        txn_date: isoDate(raw.txn_date),
        bank_name: str(raw.bank_name),
        transaction_id: str(raw.transaction_id),
        reference_number: str(raw.reference_number),
        payment_method: str(raw.payment_method),
        gateway_status: str(raw.gateway_status),
        transfer_note: str(raw.transfer_note),
        direction: raw.direction === 'in' ? 'in' : 'out',
        is_cash: raw.is_cash === true,
        confidence,
    };
}

/**
 * Read a payment that was TYPED into the group rather than screenshotted —
 * "paid 5000 cash to Ramesh for auto", "received 25000 from Medhini by UPI".
 *
 * Cash has no receipt to photograph, so without this the most easily forgotten
 * payments would be the only ones the system never saw.
 *
 * Returns null for ordinary conversation. That judgement is deliberately
 * conservative: this runs on every message in the group, and a chat line
 * misread as a payment is worse than a payment someone has to type again.
 */
export async function extractPaymentFromText(
    text: string,
    identity: OwnIdentity = DEFAULT_IDENTITY
): Promise<ExtractedPayment | null> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
    const trimmed = (text || '').trim();
    // No digits at all means no amount, so it cannot be a payment. Free, and it
    // keeps ordinary chatter from costing a model call.
    if (trimmed.length < 6 || trimmed.length > 1000 || !/\d/.test(trimmed)) return null;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
            role: 'user',
            content:
                `A message posted in our company's payments group:\n\n"""${trimmed}"""\n\n` +
                `Is this someone RECORDING a payment that has been made or received?\n` +
                `Questions, plans and chat are NOT records — "shall we pay Ramesh 5000?",\n` +
                `"Ramesh wants 5000", "invoice 5000 pending" are all is_payment_receipt: false.\n` +
                `Only a statement that money HAS moved counts.\n\n` +
                USER_PROMPT.replace(
                    'Read this screenshot and return JSON',
                    'Return JSON'
                ) +
                `\n- There is no image here, so bank name, transaction id, reference number and\n` +
                `  transfer_note will usually be null. Never invent them.\n` +
                `- txn_date: only if the message states one; otherwise null.\n` +
                `- confidence: "low" unless the amount AND the other party are both stated plainly.` +
                identityBlock(identity),
        }],
    });

    const raw = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text).join('').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    let parsed: any;
    try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
    if (parsed.is_payment_receipt === false) return null;

    const amount = num(parsed.amount);
    // An amount is the one thing a payment record cannot do without.
    if (!amount) return null;

    const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low';
    return {
        is_payment_receipt: true,
        amount,
        currency: str(parsed.currency) || 'INR',
        paid_to: str(parsed.paid_to),
        paid_from: str(parsed.paid_from),
        txn_date: isoDate(parsed.txn_date),
        bank_name: str(parsed.bank_name),
        transaction_id: str(parsed.transaction_id),
        reference_number: str(parsed.reference_number),
        payment_method: str(parsed.payment_method),
        gateway_status: str(parsed.gateway_status),
        transfer_note: str(parsed.transfer_note),
        direction: parsed.direction === 'in' ? 'in' : 'out',
        is_cash: parsed.is_cash === true,
        confidence,
    };
}

// ── Vendor guessing ────────────────────────────────────────────────────────
// Suggestion only. The webhook offers these as buttons; nothing is ever
// auto-assigned, because a near-miss silently pays the wrong vendor's ledger.

export interface VendorGuess { id: string; name: string; score: number }

function simplify(s: string): string {
    return s.toLowerCase()
        .replace(/\b(pvt|private|ltd|limited|llp|inc|co|company|and|the|enterprise|enterprises)\b/g, ' ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Cheap token-overlap match — "Onyx print" → "Onyx Print Pvt Ltd". */
export function guessVendors(
    paidTo: string | null,
    vendors: { id: string; name: string; company?: string | null }[],
    limit = 3
): VendorGuess[] {
    if (!paidTo) return [];
    const target = simplify(paidTo);
    if (!target) return [];
    const targetTokens = new Set(target.split(' ').filter((t) => t.length > 2));
    if (targetTokens.size === 0) return [];

    return vendors
        .map((v) => {
            const candidate = simplify([v.name, v.company].filter(Boolean).join(' '));
            if (!candidate) return { id: v.id, name: v.name, score: 0 };
            if (candidate === target) return { id: v.id, name: v.name, score: 1 };
            const candTokens = candidate.split(' ').filter((t) => t.length > 2);
            if (candTokens.length === 0) return { id: v.id, name: v.name, score: 0 };
            let hits = 0;
            for (const t of candTokens) if (targetTokens.has(t)) hits++;
            // Overlap relative to the shorter side, so a long legal name is not
            // punished for the words the receipt left out.
            const score = hits / Math.min(targetTokens.size, candTokens.length);
            return { id: v.id, name: v.name, score };
        })
        .filter((g) => g.score >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

/**
 * Suggest which client sent an incoming payment.
 *
 * Clients are matched on company OR contact name, because a receipt shows
 * whichever the bank account is registered under — "ARYADEV CHEMICALS" on the
 * transfer, "Aryadev" in our client list.
 */
export function guessClients(
    payerName: string | null,
    clients: { id: string; name: string; company?: string | null }[],
    limit = 3
): VendorGuess[] {
    return guessVendors(payerName, clients as any, limit);
}

export interface InvoiceGuess {
    id: string;
    doc_number: string;
    balance: number;
    doc_date: string | null;
    reason: string;
}

/**
 * Which open Zoho invoice does this money settle?
 *
 * Only proposes where there is an actual reason — the amount clears the balance
 * exactly, or it is the client's ONLY open invoice. A part payment against one
 * of five open invoices is genuinely ambiguous, and a queue of coin-flips is
 * worse than an empty one: it teaches people to tap Confirm without reading.
 */
export async function guessInvoices(
    db: SupabaseClient,
    clientName: string | null,
    amount: number | null,
    limit = 2
): Promise<InvoiceGuess[]> {
    if (!clientName || !amount) return [];

    const { data } = await db
        .from('zoho_documents')
        .select('id, doc_number, doc_date, balance, total, customer_name, status')
        .eq('doc_type', 'invoice')
        .in('status', ['sent', 'overdue'])
        .gt('balance', 0)
        .limit(500);

    const wanted = new Set(
        clientName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
    );
    if (wanted.size === 0) return [];

    const theirs = (data || []).filter((d) => {
        const name = String(d.customer_name || '').toLowerCase();
        return Array.from(wanted).some((w) => name.includes(w));
    });
    if (theirs.length === 0) return [];

    const exact = theirs.filter((d) => Math.abs(Number(d.balance) - amount) < 1);
    if (exact.length > 0) {
        return exact.slice(0, limit).map((d) => ({
            id: d.id, doc_number: d.doc_number, balance: Number(d.balance),
            doc_date: d.doc_date, reason: 'clears this invoice exactly',
        }));
    }

    if (theirs.length === 1) {
        const only = theirs[0];
        return [{
            id: only.id, doc_number: only.doc_number, balance: Number(only.balance),
            doc_date: only.doc_date,
            reason: amount < Number(only.balance) ? 'their only open invoice — part payment' : 'their only open invoice',
        }];
    }

    // Several open invoices and no exact fit: we cannot tell, so we say nothing.
    return [];
}

// ── Duplicate detection ────────────────────────────────────────────────────

/**
 * The same screenshot forwarded three times is ONE payment. Two different
 * payments never share a bank reference number, so that is the only signal
 * trusted here. Amount+date alone is NOT enough — two identical bills to the
 * same vendor on one day are a real thing in this business.
 */
export async function findExistingCapture(
    db: SupabaseClient,
    extracted: { reference_number: string | null; transaction_id: string | null },
    excludeId?: string
): Promise<{ id: string; status: string } | null> {
    const keys = [normalizeRef(extracted.reference_number), normalizeRef(extracted.transaction_id)]
        .filter((v): v is string => Boolean(v));
    if (keys.length === 0) return null;

    // Matched on the NORMALISED generated columns, in the database.
    //
    // Two earlier shapes of this function were both wrong. Paging the oldest
    // 500 rows and comparing in JS stops finding anything once the table grows.
    // Querying the raw reference cannot match a second reading of the same
    // receipt that spaces the digits differently — which is the commonest way a
    // duplicate actually arises. reference_key/transaction_key are generated by
    // Postgres from the same rule normalizeRef applies here, so both sides of
    // the comparison are always in the same form, and the values contain only
    // A-Z0-9 — nothing that could break out of a PostgREST filter.
    const filters = keys.flatMap((k) => [`reference_key.eq.${k}`, `transaction_key.eq.${k}`]);

    const { data, error } = await db
        .from('payment_captures')
        .select('id, status')
        .neq('status', 'rejected')
        .or(filters.join(','))
        .order('created_at', { ascending: true })
        .limit(50);

    // A failed lookup must NOT read as "no duplicate". This is the only guard
    // between one payment and two live records of it, so when it cannot answer
    // it says so and the caller keeps the capture pending for a human.
    if (error) throw new Error(`duplicate check failed: ${error.message}`);

    for (const row of data || []) {
        if (excludeId && row.id === excludeId) continue;
        return { id: row.id, status: row.status };
    }
    return null;
}

// ── Reconciliation against the Zoho HDFC bank feed ─────────────────────────
//
// THE TABLE
// zoho_bank_transactions, not bank_transactions. The former is the live HDFC
// feed that app/api/cron/zoho-bank-sync pulls out of Zoho Books twice a day;
// the latter is the older manually-imported table, stale since July 2026.
// Matching against the stale one would have confirmed nothing, forever.
//
// THE DIRECTION — and it is backwards from what you would guess
// In Zoho's bank feed, `debit_or_credit` is written from the LEDGER's point of
// view, not the account holder's:
//     debit  = money IN   (customer_payment, "NEFT CR-…")
//     credit = money OUT  (vendor_payment, expense, card_payment, "NEFT DR-…")
// So an outgoing vendor payment is a CREDIT row. Reading this the intuitive way
// would have matched our payment screenshots against incoming customer money.

export interface MatchResult {
    zoho_bank_transaction_id: string;
    match_method: 'reference' | 'transfer_note' | 'payee_amount' | 'amount_date';
}

/**
 * Which side of the Zoho feed proves a capture.
 *   we paid out  → a CREDIT row (vendor_payment, expense, card_payment)
 *   we received  → a DEBIT row  (customer_payment)
 * Yes, backwards. See the note above.
 */
function matchesDirection(
    t: { debit_or_credit: string | null },
    direction: 'out' | 'in'
): boolean {
    const side = (t.debit_or_credit || '').toLowerCase();
    return direction === 'out' ? side === 'credit' : side === 'debit';
}

/**
 * Find the bank line that proves this capture.
 *
 * Four tiers, weakest last, every one of them refusing to guess:
 *   1. reference    — the receipt's reference or transaction id appears in the
 *                     bank line. Conclusive when it happens, but often it does
 *                     NOT: HDFC's receipt reference and the feed's reference
 *                     are different identifiers for the same transfer.
 *   2. transfer_note— the handle printed on the receipt ("aayam2onyxprint")
 *                     appears in the bank line's description ("TPT-AAYAM2ONYX
 *                     PRINT-…"), and the amount agrees. This is what actually
 *                     ties within-HDFC transfers to their receipts.
 *   3. payee_amount — same amount, and the bank line's payee shares real words
 *                     with the receipt's payee.
 *   4. amount_date  — same amount within ±3 days and EXACTLY ONE candidate.
 *
 * Tiers 2-4 all require a unique winner. Two candidates we cannot separate
 * means we match neither: a wrong match is worse than an unmatched capture,
 * because it silently marks an unconfirmed payment as confirmed.
 */
export async function matchCaptureToBank(
    db: SupabaseClient,
    capture: {
        id: string;
        amount: number | null;
        txn_date: string | null;
        reference_number: string | null;
        transaction_id: string | null;
        transfer_note?: string | null;
        paid_to?: string | null;
        paid_from?: string | null;
        direction?: 'out' | 'in' | null;
        needs_bank_match?: boolean | null;
    }
): Promise<MatchResult | null> {
    if (!capture.amount || !capture.txn_date) return null;
    // Cash never reaches the feed. Searching for it would only ever produce a
    // false match against an unrelated payment of the same amount.
    if (capture.needs_bank_match === false) return null;

    const direction: 'out' | 'in' = capture.direction === 'in' ? 'in' : 'out';
    // On an incoming payment the counterparty is the SENDER, not the payee —
    // the payee is us, and matching our own name against every bank line would
    // make the payee tier match everything.
    const counterparty = direction === 'in' ? capture.paid_from : capture.paid_to;

    const from = new Date(`${capture.txn_date}T00:00:00Z`);
    const to = new Date(from);
    from.setUTCDate(from.getUTCDate() - 3);
    to.setUTCDate(to.getUTCDate() + 3);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const { data: candidates } = await db
        .from('zoho_bank_transactions')
        .select('id, amount, txn_date, reference_number, description, payee, debit_or_credit, transaction_type')
        .gte('txn_date', iso(from))
        .lte('txn_date', iso(to));

    const outgoing = (candidates || []).filter((t) => matchesDirection(t, direction));
    if (outgoing.length === 0) return null;

    // ── Tier 1: reference ─────────────────────────────────────────────────
    // Deliberately NOT restricted by amount. A reference number identifies the
    // transfer; the amount is read off a photograph. Gating this tier on the
    // amount meant a receipt showing ₹22,700.50 that the model read as ₹22,700
    // failed to match its own bank line and was then reported as a payment the
    // bank never confirmed — a false alarm about money that demonstrably moved.
    // Uniqueness is still required, so a reversal sharing the UTR blocks the
    // match rather than winning it.
    const ref = normalizeRef(capture.reference_number);
    const txn = normalizeRef(capture.transaction_id);
    const byReference = outgoing.filter((t) => {
        // Normalised field by field, so a match can never straddle the boundary
        // between a reference and the description that follows it.
        const fields = [normalizeRef(t.reference_number), normalizeRef(t.description)]
            .filter((f): f is string => Boolean(f));
        // Masked feed references ("xxxxxxxxxxxx9803") must not match on their
        // x's, so only compare when we have something substantial.
        return fields.some((f) =>
            (ref !== null && ref.length >= 8 && f.includes(ref)) ||
            (txn !== null && txn.length >= 8 && f.includes(txn))
        );
    });
    if (byReference.length === 1) {
        return { zoho_bank_transaction_id: byReference[0].id, match_method: 'reference' };
    }

    const sameAmount = outgoing.filter(
        (t) => Math.abs(Math.abs(Number(t.amount)) - capture.amount!) < 0.01
    );
    if (sameAmount.length === 0) return null;

    // ── Tier 2: the transfer handle echoed in the description ─────────────
    const note = (capture.transfer_note || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (note.length >= 6) {
        const hits = sameAmount.filter((t) =>
            (String(t.description || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).includes(note)
        );
        if (hits.length === 1) {
            return { zoho_bank_transaction_id: hits[0].id, match_method: 'transfer_note' };
        }
    }

    // ── Tier 3: payee agrees ──────────────────────────────────────────────
    if (counterparty) {
        const wanted = new Set(
            counterparty.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
        );
        if (wanted.size > 0) {
            const hits = sameAmount.filter((t) => {
                const hay = `${t.payee || ''} ${t.description || ''}`.toLowerCase();
                return Array.from(wanted).some((w) => hay.includes(w));
            });
            if (hits.length === 1) {
                return { zoho_bank_transaction_id: hits[0].id, match_method: 'payee_amount' };
            }
        }
    }

    // ── Tier 4: amount and date, but only when it stands alone ────────────
    if (sameAmount.length === 1) {
        return { zoho_bank_transaction_id: sameAmount[0].id, match_method: 'amount_date' };
    }
    return null;
}
