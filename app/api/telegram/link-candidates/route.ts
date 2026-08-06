import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/api-auth';

/**
 * Telegram users seen posting in a department group who are not yet matched to
 * a staff profile.
 *
 * Why this exists: a Telegram bot cannot message someone by phone number — the
 * person's Telegram id is the only usable handle, and the bot only learns it
 * when they interact. They already do that every time they type in a
 * department group, so the webhook parks the id here and an admin attaches it
 * to the right person. Confirming copies telegram_chat_id onto the profile,
 * which is what turns a bold name in a group alert into a real @mention and
 * switches on that person's personal DM briefs.
 *
 * Matching is a deliberate human decision. Auto-matching on display name would
 * eventually point one designer's job alerts at another, silently.
 */

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { data, error } = await admin()
    .from('telegram_link_candidates')
    .select('*')
    .eq('status', 'pending')
    .order('last_seen_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const chatId: string | undefined = body?.telegram_chat_id;
  const action: string | undefined = body?.action; // 'link' | 'ignore'
  const profileId: string | undefined = body?.profile_id;

  if (!chatId || !action) {
    return NextResponse.json({ error: 'telegram_chat_id and action are required' }, { status: 400 });
  }

  const service = admin();

  if (action === 'ignore') {
    const { error } = await service
      .from('telegram_link_candidates')
      .update({ status: 'ignored' })
      .eq('telegram_chat_id', chatId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action !== 'link' || !profileId) {
    return NextResponse.json({ error: 'profile_id is required to link' }, { status: 400 });
  }

  const { data: candidate } = await service
    .from('telegram_link_candidates')
    .select('telegram_username')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  // One Telegram account cannot be two staff members. Free the id first, so a
  // mistaken link can be corrected by simply linking it to the right person.
  const { error: clearErr } = await service
    .from('profiles')
    .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
    .eq('telegram_chat_id', chatId)
    .neq('id', profileId);
  if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 });

  const { error: linkErr } = await service
    .from('profiles')
    .update({
      telegram_chat_id: chatId,
      telegram_username: candidate?.telegram_username || null,
      telegram_linked_at: new Date().toISOString(),
    })
    .eq('id', profileId);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  const { error: statusErr } = await service
    .from('telegram_link_candidates')
    .update({ status: 'linked', linked_profile_id: profileId })
    .eq('telegram_chat_id', chatId);
  if (statusErr) return NextResponse.json({ error: statusErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
