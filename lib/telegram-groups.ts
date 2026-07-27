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

/** Send an HTML message to one Telegram chat (group or DM), optionally with an "Open in app" button. */
export async function sendToChat(
  chatId: string,
  html: string,
  appPath?: string
): Promise<boolean> {
  if (!BOT_TOKEN) return false;
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
    return !!json?.ok;
  } catch {
    return false;
  }
}
