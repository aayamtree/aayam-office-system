import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendToChat, escapeHtml } from '@/lib/telegram-groups';
import { getEodSnapshot, inr, STUCK_DAYS, type JobBrief } from '@/lib/eod-metrics';

/**
 * EOD Report Cron — 7:30 PM IST, Mon–Sat ("0 14 * * 1-6").
 *
 * An EXCEPTION-focused end-of-day summary sent to the Admin Telegram group
 * (and to any linked admin staff via DM). Distinct from the 5:30 PM digest,
 * which tells staff what's still pending. This one tells the boss what
 * actually MOVED today, what's STUCK, and what needs attention.
 *
 * Manual test: /api/cron/eod-report?debug=1  (returns the message text as JSON)
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

function jobLine(j: JobBrief, tail: string): string {
  return `  • <b>${escapeHtml(j.job_number || '?')}</b> ${escapeHtml((j.project_name || '').slice(0, 40))} — <i>${escapeHtml(j.stage_name)}</i>${tail}`;
}

function buildMessage(s: Awaited<ReturnType<typeof getEodSnapshot>>): string {
  const lines: string[] = [];
  lines.push(`🌙 <b>EOD Report</b> — ${s.dateLabel}`);
  lines.push('');
  lines.push(`✅ Done: <b>${s.doneToday.length}</b>   🚚 Moved: <b>${s.movedToday}</b>   🆕 New: <b>${s.newToday}</b>`);
  lines.push(`💰 Collected today: <b>${inr(s.collectedToday)}</b> (${s.paymentsToday} payment${s.paymentsToday !== 1 ? 's' : ''})`);
  lines.push(`📊 Active jobs: <b>${s.activeJobs}</b>  •  Pending on them: <b>${inr(s.pendingActive)}</b>`);

  // Done list (short)
  if (s.doneToday.length) {
    const list = s.doneToday.slice(0, 6).map((j) => jobLine(j, '')).join('\n');
    const more = s.doneToday.length > 6 ? `\n  …and ${s.doneToday.length - 6} more` : '';
    lines.push('');
    lines.push(`✅ <b>Completed today</b>`);
    lines.push(`${list}${more}`);
  }

  // Stuck — the important one
  if (s.stuck.length) {
    const list = s.stuck.slice(0, 6).map((j) => jobLine(j, ` — <b>${j.days_idle}d idle</b>`)).join('\n');
    const more = s.stuck.length > 6 ? `\n  …and ${s.stuck.length - 6} more` : '';
    lines.push('');
    lines.push(`⚠️ <b>Stuck (${STUCK_DAYS}+ days no movement) — ${s.stuck.length}</b>`);
    lines.push(`${list}${more}`);
  }

  // Overdue
  if (s.overdue.length) {
    const list = s.overdue.slice(0, 6).map((j) => jobLine(j, ` — <b>${j.days_overdue}d over</b>`)).join('\n');
    const more = s.overdue.length > 6 ? `\n  …and ${s.overdue.length - 6} more` : '';
    lines.push('');
    lines.push(`🔴 <b>Past deadline — ${s.overdue.length}</b>`);
    lines.push(`${list}${more}`);
  }

  if (!s.stuck.length && !s.overdue.length) {
    lines.push('');
    lines.push('🟢 <b>Nothing stuck or overdue. Clean board!</b>');
  }

  return lines.join('\n');
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const isDebug = request.nextUrl.searchParams.get('debug') === '1';
  if (CRON_SECRET && !isDebug && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const snapshot = await getEodSnapshot(supabase);
  const text = buildMessage(snapshot);

  if (isDebug) {
    return NextResponse.json({ preview: text, snapshot });
  }

  // Recipients: admin department groups + linked admin staff DMs
  const [{ data: groups }, { data: admins }] = await Promise.all([
    supabase
      .from('telegram_groups')
      .select('chat_id')
      .eq('is_active', true)
      .eq('department', 'admin'),
    supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('role', 'admin')
      .eq('is_active', true)
      .not('telegram_chat_id', 'is', null),
  ]);

  const targets = new Set<string>();
  for (const g of groups || []) if (g.chat_id) targets.add(g.chat_id);
  for (const a of admins || []) if (a.telegram_chat_id) targets.add(a.telegram_chat_id);

  let sent = 0;
  for (const chatId of Array.from(targets)) {
    if (await sendToChat(chatId, text, '/admin/pulse')) sent++;
  }

  return NextResponse.json({ sent, targets: targets.size, done: snapshot.doneToday.length, stuck: snapshot.stuck.length });
}
