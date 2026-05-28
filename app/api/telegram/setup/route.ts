import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aayam-office-system.vercel.app';

/**
 * GET /api/telegram/setup
 * Registers the Telegram webhook. Visit this URL once after deployment.
 * Admin only — protected by checking for a secret param.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  // Basic protection — only admin can trigger this
  if (secret !== process.env.NEXTAUTH_SECRET?.slice(0, 12)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
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
