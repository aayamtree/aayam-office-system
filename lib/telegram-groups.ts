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

export type TelegramDepartment = 'design' | 'print' | 'dispatch' | 'admin' | 'cmyk';

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

    const error = json?.description || `HTTP ${res.status}`;
    console.error(`[telegram] send to chat ${chatId} failed: ${error}`);
    return { ok: false, error };
  } catch (e: any) {
    const error = e?.message || String(e);
    console.error(`[telegram] send to chat ${chatId} threw: ${error}`);
    return { ok: false, error };
  }
}

/** Boolean convenience wrapper — failures are still logged by sendToChatResult. */
export async function sendToChat(
  chatId: string,
  html: string,
  appPath?: string
): Promise<boolean> {
  return (await sendToChatResult(chatId, html, appPath)).ok;
}
