import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendMessage(chatId: number | string, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat?.id;
    const text: string = message.text || '';
    const username = message.from?.username || null;
    const firstName = message.from?.first_name || 'there';

    // /start with deep link: /start client_UUID or /start staff_UUID
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const param = parts[1]; // e.g. "client_abc123-..." or "staff_abc123-..."

      if (param && param.startsWith('client_')) {
        const clientId = param.replace('client_', '');

        // Link this Telegram chat to the client
        const { data, error } = await supabaseAdmin
          .from('clients')
          .update({
            telegram_chat_id: String(chatId),
            telegram_username: username,
            telegram_linked_at: new Date().toISOString(),
          })
          .eq('id', clientId)
          .select('name')
          .single();

        if (error || !data) {
          await sendMessage(chatId, `❌ Could not link your Telegram. Please contact Aayam Creative.`);
          return NextResponse.json({ ok: true });
        }

        await sendMessage(
          chatId,
          `✅ <b>Telegram Linked Successfully!</b>\n\nHi ${firstName}! Your Telegram is now linked to your account at <b>Aayam Creative</b>.\n\nYou'll receive order updates, payment confirmations, and delivery notifications here. 📦`
        );
        return NextResponse.json({ ok: true });
      }

      if (param && param.startsWith('staff_')) {
        const profileId = param.replace('staff_', '');

        // Check if chat_id is already linked to another profile
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('telegram_chat_id', String(chatId))
          .neq('id', profileId)
          .single();

        if (existing) {
          await sendMessage(
            chatId,
            `⚠️ Your Telegram is already linked to <b>${existing.full_name}</b>'s account.\n\nIf this is wrong, ask admin to unlink it first.`
          );
          return NextResponse.json({ ok: true });
        }

        // Link this Telegram chat to the staff profile
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .update({
            telegram_chat_id: String(chatId),
            telegram_username: username,
            telegram_linked_at: new Date().toISOString(),
          })
          .eq('id', profileId)
          .select('full_name, role')
          .single();

        if (error || !data) {
          await sendMessage(chatId, `❌ Could not link your account. Please contact admin.`);
          return NextResponse.json({ ok: true });
        }

        await sendMessage(
          chatId,
          `✅ <b>Linked! You are now connected as ${data.full_name}</b>\n\nRole: <b>${data.role}</b>\n\nYou'll receive job notifications, assignments, and updates here. 🚀`
        );
        return NextResponse.json({ ok: true });
      }

      // Plain /start — welcome message
      await sendMessage(
        chatId,
        `👋 <b>Welcome to Aayam Creative!</b>\n\nThis bot sends you order updates and notifications.\n\nTo link your account, please ask the Aayam team for your personal link. 🔗`
      );
      return NextResponse.json({ ok: true });
    }

    // Any other message — generic reply
    await sendMessage(
      chatId,
      `Hi! This is the Aayam Creative notification bot. 📬\n\nFor updates on your orders, please contact us directly.`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}

// Telegram verification GET request
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook active' });
}
