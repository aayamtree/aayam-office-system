import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// FIX 2026-07-06: accept both env names (was NEXT_PUBLIC_* only, while the
// notification service used TELEGRAM_BOT_TOKEN — whichever wasn't set silently broke)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId: number | string, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function POST(req: NextRequest) {
  try {
    // Verify the update really comes from Telegram (secret set via /api/telegram/setup).
    // Only enforced when TELEGRAM_WEBHOOK_SECRET is configured.
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && req.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create client inside handler so env vars are available at runtime, not build time
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();

    // ── GROUP REGISTRATION ──
    // Bot added to / removed from a group → keep telegram_groups in sync.
    const memberUpdate = body?.my_chat_member;
    if (memberUpdate?.chat && ['group', 'supergroup'].includes(memberUpdate.chat.type)) {
      const status = memberUpdate.new_chat_member?.status;
      const groupChatId = String(memberUpdate.chat.id);
      const title = memberUpdate.chat.title || 'Unnamed group';
      if (status === 'member' || status === 'administrator') {
        await supabaseAdmin
          .from('telegram_groups')
          .upsert(
            { chat_id: groupChatId, title, is_active: true, updated_at: new Date().toISOString() },
            { onConflict: 'chat_id' }
          );
        await sendMessage(
          groupChatId,
          `✅ <b>Aayam bot added to "${title}"</b>\n\nAdmin: assign this group to a department in the app → Settings → Telegram Groups. After that, job updates for that department will arrive here automatically. 🚀`
        );
      } else if (status === 'left' || status === 'kicked') {
        await supabaseAdmin
          .from('telegram_groups')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('chat_id', groupChatId);
      }
      return NextResponse.json({ ok: true });
    }

    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    // Group upgraded to supergroup → Telegram changes the chat id; follow it.
    if (message.migrate_to_chat_id && message.chat?.id) {
      await supabaseAdmin
        .from('telegram_groups')
        .update({ chat_id: String(message.migrate_to_chat_id), updated_at: new Date().toISOString() })
        .eq('chat_id', String(message.chat.id));
      return NextResponse.json({ ok: true });
    }

    // Messages inside groups: register/refresh the group (UPSERT — this is
    // also the fallback registration path, since older webhook registrations
    // didn't include my_chat_member updates). NEVER run the 1:1 staff relay /
    // welcome logic in groups (no spam in group rooms).
    if (message.chat && ['group', 'supergroup'].includes(message.chat.type)) {
      const groupChatId = String(message.chat.id);
      const title = message.chat.title || 'Unnamed group';
      const { data: existing } = await supabaseAdmin
        .from('telegram_groups')
        .select('id, department')
        .eq('chat_id', groupChatId)
        .maybeSingle();
      await supabaseAdmin
        .from('telegram_groups')
        .upsert(
          { chat_id: groupChatId, title, is_active: true, updated_at: new Date().toISOString() },
          { onConflict: 'chat_id' }
        );
      // First time we see this group → confirm so the admin knows it worked
      if (!existing) {
        await sendMessage(
          groupChatId,
          `✅ <b>Aayam bot connected to "${title}"</b>\n\nAdmin: assign this group to a department in the app → Settings → Telegram Groups. Job updates for that department will then arrive here automatically. 🚀`
        );
      }

      // ── TWO-WAY BRIDGE: mirror group text into the app's department room ──
      // (Requires bot privacy mode OFF, otherwise only /commands arrive here.)
      const groupText: string = message.text || '';
      if (existing?.department && groupText && !groupText.startsWith('/')) {
        const { data: channel } = await supabaseAdmin
          .from('chat_channels')
          .select('id')
          .eq('type', 'department')
          .eq('name', existing.department)
          .maybeSingle();
        if (channel) {
          // Match the Telegram sender to a staff profile (private chat id == user id)
          const fromId = message.from?.id ? String(message.from.id) : null;
          let senderProfileId: string | null = null;
          if (fromId) {
            const { data: senderProfile } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('telegram_chat_id', fromId)
              .maybeSingle();
            senderProfileId = senderProfile?.id || null;
          }
          // The sender is in the group but not in profiles — so their Telegram
          // id is the one thing missing before the app can @mention and DM them.
          // Park it for one-tap admin confirmation instead of discarding it.
          // Not auto-matched on name on purpose: a near-miss would silently send
          // one designer's job alerts to another.
          if (fromId && !senderProfileId && !message.from?.is_bot) {
            const { error: candErr } = await supabaseAdmin.rpc('fn_touch_link_candidate', {
              p_chat_id: fromId,
              p_username: message.from?.username || null,
              p_first_name:
                [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || null,
              p_group_chat_id: String(message.chat.id),
              p_department: existing.department,
            });
            // Never let this break the mirror — it is a convenience, not the job.
            if (candErr) console.error('[telegram] link candidate not recorded:', candErr.message);
          }

          const senderLabel = message.from?.first_name || 'Telegram user';
          await supabaseAdmin.from('chat_messages').insert({
            channel_id: channel.id,
            sender_id: senderProfileId,
            content: senderProfileId ? `📱 ${groupText}` : `📱 ${senderLabel}: ${groupText}`,
          });
        }
      }
      return NextResponse.json({ ok: true });
    }
    if (message.chat && message.chat.type !== 'private') {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat?.id;
    const text: string = message.text || '';
    const username = message.from?.username || null;
    const firstName = message.from?.first_name || 'there';

    // /start with deep link: /start client_UUID or /start staff_UUID
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const param = parts[1];

      if (param && param.startsWith('client_')) {
        const clientId = param.replace('client_', '');

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
          `✅ <b>Linked! Welcome ${data.full_name} 👋</b>\n\nRole: <b>${data.role}</b>\n\n📱 You can now chat with the team from your phone!\n\nJust type any message here and it will be delivered to everyone on the Aayam team.\n\nYou'll also receive job updates and notifications here. 🚀`
        );
        return NextResponse.json({ ok: true });
      }

      // Plain /start — welcome message
      await sendMessage(
        chatId,
        `👋 <b>Welcome to Aayam Creative!</b>\n\nThis bot is for Aayam team members.\n\nTo link your account, go to your Profile Settings in the Aayam Office app and tap "Link Telegram". 🔗`
      );
      return NextResponse.json({ ok: true });
    }

    // ── TEAM CHAT RELAY ──
    // Check if this person is a linked staff member
    const { data: sender } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .eq('telegram_chat_id', String(chatId))
      .single();

    if (sender) {
      // Get all OTHER staff with Telegram linked
      const { data: allStaff } = await supabaseAdmin
        .from('profiles')
        .select('telegram_chat_id, full_name')
        .not('telegram_chat_id', 'is', null)
        .neq('telegram_chat_id', String(chatId))
        .eq('is_active', true);

      // Relay message to every team member on Telegram
      const roleLabel = sender.role.charAt(0).toUpperCase() + sender.role.slice(1);
      const relayText = `📱 <b>${sender.full_name}</b> <i>(${roleLabel})</i>:\n${text}`;

      const relayPromises = (allStaff || []).map(staff =>
        sendMessage(staff.telegram_chat_id!, relayText)
      );
      await Promise.all(relayPromises);

      // Also save to the in-app General chat channel so PC users see it
      try {
        const { data: generalChannel } = await supabaseAdmin
          .from('chat_channels')
          .select('id')
          .eq('name', 'general')
          .eq('type', 'group')
          .single();

        if (generalChannel) {
          await supabaseAdmin.from('chat_messages').insert({
            channel_id: generalChannel.id,
            sender_id: sender.id,
            content: `📱 ${text}`,
          });
        }
      } catch {
        // Don't fail if chat table doesn't exist
      }

      // Confirm back to sender
      const count = (allStaff || []).length;
      await sendMessage(
        chatId,
        `✅ Sent to ${count} team member${count !== 1 ? 's' : ''}`
      );

      return NextResponse.json({ ok: true });
    }

    // Unknown user messaging the bot
    await sendMessage(
      chatId,
      `👋 This bot is for Aayam Creative team members.\n\nTo connect, open the Aayam Office app → Profile Settings → Link Telegram.`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook active' });
}
