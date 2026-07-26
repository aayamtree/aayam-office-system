import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aayam-office-system.vercel.app';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telegram/setup
 * Registers the Telegram webhook. Visit this URL while signed in as an admin
 * after rotating the bot token (revoking a token drops the webhook).
 *
 * Previously this was gated on `?secret=` holding the first 12 characters of
 * NEXTAUTH_SECRET. That put a long-lived secret into URLs, browser history and
 * server logs, and it meant rotating NEXTAUTH_SECRET locked you out of the very
 * page needed to repair Telegram. Now it uses the normal admin session check.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
  }

  const webhookUrl = `${APP_URL}/api/telegram/webhook`;

  try {
    // Register webhook
    const setRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query', 'my_chat_member'],
          // If TELEGRAM_WEBHOOK_SECRET is set, Telegram will echo it on every
          // update and the webhook rejects anything without it.
          ...(process.env.TELEGRAM_WEBHOOK_SECRET
            ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }
            : {}),
        }),
      }
    );
    const setResult = await setRes.json();

    // Get current webhook info
    const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const infoResult = await infoRes.json();

    return NextResponse.json({
      set: setResult,
      info: infoResult,
      webhookUrl,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
