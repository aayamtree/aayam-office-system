/**
 * Telegram department-group helpers (SERVER-SIDE ONLY — uses the bot token).
 *
 * Groups live in `telegram_groups` (registered automatically when the bot is
 * added to a Telegram group; mapped to a department in
 * /admin/settings/telegram-groups).
 *
 * Used by:
 *  - app/api/telegram/notify-stage  (auto job-stage alerts, fired by DB trigger)
 *  - app/api/cron/telegram-digest   (daily 9AM department digest)
 */

/**
 * Departments that receive JOB traffic — stage alerts and the daily digest.
 * STAGE_DEPARTMENT and DEPARTMENT_LABELS are keyed by this, so anything added
 * here must have a label and is expected to want job updates.
 */
export type TelegramDepartment = 'design' | 'print' | 'dispatch' | 'admin' | 'cmyk';

/**
 * Every value telegram_groups.department can legally hold.
 *
 * 'payments' is deliberately NOT a TelegramDepartment: it marks the group that
 * acts as the payment-screenshot inbox, and it must never receive job alerts or
 * the digest. Kept in step with the telegram_groups_department_check constraint
 * and the dropdown in app/admin/settings/telegram-groups/page.tsx — all three
 * once disagreed, so the dropdown offered a value the database refused.
 */
export type TelegramGroupPurpose = TelegramDepartment | 'payments';

export const DEPARTMENT_LABELS: Record<TelegramDepartment, string> = {
  design: '🎨 Design',
  print: '🖨️ Print',
  dispatch: '📦 Dispatch',
  admin: '👑 Admin',
  cmyk: '🖨️ CMYK',
};

/** Which department group cares about a job arriving at this stage. */
export const STAGE_DEPARTMENT: Record<string, TelegramDepartment> = {
  awaiting_admin: 'admin',
  new: 'design',
  designing: 'design',
  approval: 'design',
  pre_print_qc: 'design',
  print_file_ready: 'design',
  file_sent_client: 'design',
  file_received: 'print',
  file_check: 'print',
  ready_to_print: 'print',
  printing: 'print',
  material_received: 'print',
  quality_check: 'print',
  ready: 'dispatch',
  dispatched: 'dispatch',
  delivered: 'dispatch',
};

export const STAGE_EMOJI: Record<string, string> = {
  new: '🆕',
  designing: '🎨',
  approval: '👀',
  pre_print_qc: '🔍',
  print_file_ready: '✅',
  file_sent_client: '📤',
  file_received: '📥',
  file_check: '🔍',
  ready_to_print: '🟢',
  printing: '🖨️',
  material_received: '📦',
  quality_check: '🔍',
  ready: '🚚',
  dispatched: '📤',
  delivered: '🎉',
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const APP_URL = 'https://aayam-office-system.vercel.app';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The bits of a profile needed to address someone in a group message. */
export interface MentionableStaff {
  full_name: string | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
}

/**
 * Name a staff member inside a group message, as loudly as the data allows.
 *
 * A group with 18 people and no name on the message is a message nobody reads,
 * so we always say who it's for — but only a LINKED account produces an actual
 * notification on their phone:
 *   linked (telegram_chat_id) → tg://user mention, real ping
 *   username known           → @username, pings if they're in the group
 *   neither                  → bold name, visible but silent
 * Nothing to change in the message code as staff link themselves; each one
 * upgrades from bold text to a real ping the moment they scan the profile QR.
 */
export function mentionStaff(p: MentionableStaff | null | undefined): string {
  const name = p?.full_name?.trim() || 'Staff';
  if (p?.telegram_chat_id) {
    return `<a href="tg://user?id=${p.telegram_chat_id}">${escapeHtml(name)}</a>`;
  }
  if (p?.telegram_username) return `@${escapeHtml(p.telegram_username)}`;
  return `<b>${escapeHtml(name)}</b>`;
}

export interface SendResult {
  ok: boolean;
  /** Telegram's own description, e.g. "chat not found", "bot was kicked". */
  error?: string;
}

/**
 * Send an HTML message to one Telegram chat (group or DM) and report WHY it
 * failed if it did.
 *
 * Every failure mode here used to be invisible: a wrong chat_id, a bot removed
 * from a group, a group upgraded to a supergroup (which changes its ID) — all
 * returned a bare `false` that callers counted as "not sent" and then forgot.
 * Telegram always explains itself in `description`; that explanation is now
 * logged and handed back to the caller so it can be stored and shown.
 */
export async function sendToChatResult(
  chatId: string,
  html: string,
  appPath?: string
): Promise<SendResult> {
  if (!BOT_TOKEN) {
    // Loud, not silent. This used to return false quietly, which meant a missing
    // or misnamed env var made the EOD report, weekly scorecard and every stage
    // alert vanish with no trace anywhere. /api/health now reports this too.
    const error = 'TELEGRAM_BOT_TOKEN is not set';
    console.error(
      '[telegram] ' + error + ' — message NOT sent to chat ' + chatId +
      '. Set it in Vercel → Settings → Environment Variables.'
    );
    return { ok: false, error };
  }
  // Telegram answers "Too Many Requests: retry after N" (HTTP 429) when many
  // messages go out at once — e.g. a batch of jobs moving stage together. That is
  // not a failure, it is an instruction to wait N seconds. We wait (capped, so a
  // serverless function is never held hostage) and try again, up to 3 sends.
  const MAX_ATTEMPTS = 3;
  const MAX_WAIT_S = 25;
  let waitedS = 0;
  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: html,
          parse_mode: 'HTML',
          ...(appPath
            ? {
                reply_markup: {
                  inline_keyboard: [[{ text: '🚀 Open in app', url: `${APP_URL}${appPath}` }]],
                },
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (json?.ok) return { ok: true };

      lastError = json?.description || `HTTP ${res.status}`;
      const retryAfter = Number(json?.parameters?.retry_after);
      const rateLimited = res.status === 429 || /too many requests/i.test(lastError);
      if (rateLimited && attempt < MAX_ATTEMPTS) {
        const waitS = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5) + 1;
        if (waitedS + waitS <= MAX_WAIT_S) {
          waitedS += waitS;
          console.warn(`[telegram] rate-limited on chat ${chatId} — waiting ${waitS}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
          await new Promise(r => setTimeout(r, waitS * 1000));
          continue;
        }
      }
      break; // a real failure (bad chat, bot kicked) or out of patience — do not hammer
    } catch (e: any) {
      lastError = e?.message || String(e);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1500)); // brief network blip — one more go
        continue;
      }
    }
  }
  console.error(`[telegram] send to chat ${chatId} failed: ${lastError}`);
  return { ok: false, error: lastError };
}

/** Boolean convenience wrapper — failures are still logged by sendToChatResult. */
export async function sendToChat(
  chatId: string,
  html: string,
  appPath?: string
): Promise<boolean> {
  return (await sendToChatResult(chatId, html, appPath)).ok;
}
