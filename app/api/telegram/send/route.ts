import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/telegram/send — the ONE way the app sends Telegram messages.
 *
 * Why: previously ChatPanel/TelegramFloatButton called api.telegram.org
 * directly from the browser with a HARDCODED bot token (leaked in the JS
 * bundle + git history). All sends now go through this server route:
 *  - caller is verified via their Supabase JWT
 *  - bot token stays server-side only
 *  - target chat IDs are looked up server-side
 *
 * Body: {
 *   mode: 'direct' | 'broadcast' | 'mention' | 'share' | 'group',
 *   targetProfileIds?: string[],  // required for direct/mention/share
 *   department?: string,          // required for group mode (design/print/dispatch/admin/cmyk)
 *   text?: string,
 *   url?: string,       // deep link → "Open in app" button (share mode)
 *   photoUrl?: string,  // sends as photo with caption
 *   fileName?: string, fileUrl?: string, // sends as document link
 * }
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function tgSend(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    if (!BOT_TOKEN) {
      return NextResponse.json({ error: 'Telegram not configured' }, { status: 503 });
    }

    // 1. Verify caller
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: sender } = await service
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userData.user.id)
      .single();
    if (!sender) return NextResponse.json({ error: 'Profile not found' }, { status: 403 });

    // 2. Parse request
    const body = await request.json();
    const mode: string = body.mode || 'direct';
    const text: string = (body.text || '').toString().slice(0, 3500);
    const url: string | undefined = body.url;
    const photoUrl: string | undefined = body.photoUrl;
    const fileName: string | undefined = body.fileName;
    const fileUrl: string | undefined = body.fileUrl;

    // Only allow deep links into our own app
    const APP_URL = 'https://aayam-office-system.vercel.app';
    if (url && !url.startsWith(APP_URL) && !url.startsWith('/')) {
      return NextResponse.json({ error: 'Only app links can be shared' }, { status: 400 });
    }
    const fullUrl = url?.startsWith('/') ? `${APP_URL}${url}` : url;

    // 2b. GROUP MODE — send to a department's Telegram group (not personal DMs)
    if (mode === 'group') {
      const department: string = body.department || '';
      if (!['design', 'print', 'dispatch', 'admin', 'cmyk'].includes(department)) {
        return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
      }
      const { data: groups } = await service
        .from('telegram_groups')
        .select('chat_id')
        .eq('department', department)
        .eq('is_active', true);
      if (!groups?.length) {
        return NextResponse.json({ sent: 0, error: 'No Telegram group mapped to this department' });
      }

      const gRole = sender.role ? sender.role.charAt(0).toUpperCase() + sender.role.slice(1) : '';
      const gName = esc(sender.full_name || 'Team member');
      const gMsg = `💬 <b>${gName}</b> <i>(${gRole})</i>:\n${esc(text)}`;
      const gMarkup = fullUrl
        ? { inline_keyboard: [[{ text: '🚀 Open in app', url: fullUrl }]] }
        : undefined;

      const gResults = await Promise.all(
        groups.map((g) => {
          if (photoUrl) {
            return tgSend('sendPhoto', {
              chat_id: g.chat_id,
              photo: photoUrl,
              caption: gMsg,
              parse_mode: 'HTML',
              ...(gMarkup ? { reply_markup: gMarkup } : {}),
            });
          }
          if (fileUrl) {
            return tgSend('sendMessage', {
              chat_id: g.chat_id,
              text: `📎 <b>${gName}</b>: <a href="${fileUrl}">${esc(fileName || 'file')}</a>`,
              parse_mode: 'HTML',
              ...(gMarkup ? { reply_markup: gMarkup } : {}),
            });
          }
          return tgSend('sendMessage', {
            chat_id: g.chat_id,
            text: gMsg,
            parse_mode: 'HTML',
            ...(gMarkup ? { reply_markup: gMarkup } : {}),
          });
        })
      );
      const gSent = gResults.filter((r) => r?.ok).length;
      return NextResponse.json({ sent: gSent, total: groups.length });
    }

    // 3. Resolve targets
    let targetQuery = service
      .from('profiles')
      .select('id, full_name, telegram_chat_id')
      .eq('is_active', true)
      .not('telegram_chat_id', 'is', null)
      .neq('id', sender.id);
    if (mode !== 'broadcast') {
      const ids: string[] = body.targetProfileIds || [];
      if (!ids.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 });
      targetQuery = targetQuery.in('id', ids);
    }
    const { data: targets } = await targetQuery;
    if (!targets?.length) {
      return NextResponse.json(
        { sent: 0, error: 'Recipient has not linked Telegram yet' },
        { status: 200 }
      );
    }

    // 4. Compose message
    const roleLabel = sender.role ? sender.role.charAt(0).toUpperCase() + sender.role.slice(1) : '';
    const name = esc(sender.full_name || 'Team member');
    const safeText = esc(text);
    let msg: string;
    if (mode === 'mention') {
      msg = `📣 <b>${name}</b> mentioned you:\n${safeText}`;
    } else if (mode === 'share') {
      msg = `🔗 <b>${name}</b> shared this with you${safeText ? `:\n${safeText}` : ''}`;
    } else {
      msg = `💬 <b>${name}</b> <i>(${roleLabel})</i>:\n${safeText}`;
    }

    const replyMarkup = fullUrl
      ? { inline_keyboard: [[{ text: '🚀 Open in app', url: fullUrl }]] }
      : undefined;

    // 5. Send
    const results = await Promise.all(
      targets.map((t) => {
        if (photoUrl) {
          return tgSend('sendPhoto', {
            chat_id: t.telegram_chat_id,
            photo: photoUrl,
            caption: msg,
            parse_mode: 'HTML',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          });
        }
        if (fileUrl) {
          return tgSend('sendMessage', {
            chat_id: t.telegram_chat_id,
            text: `📎 <b>${name}</b>: <a href="${fileUrl}">${esc(fileName || 'file')}</a>`,
            parse_mode: 'HTML',
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          });
        }
        return tgSend('sendMessage', {
          chat_id: t.telegram_chat_id,
          text: msg,
          parse_mode: 'HTML',
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });
      })
    );

    const sent = results.filter((r) => r?.ok).length;
    return NextResponse.json({ sent, total: targets.length });
  } catch (err: any) {
    console.error('Telegram send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
