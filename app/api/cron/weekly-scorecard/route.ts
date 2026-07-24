import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendToChat, escapeHtml } from '@/lib/telegram-groups';
import { getWeeklyScorecard, inr } from '@/lib/eod-metrics';

/**
 * Weekly Scorecard Cron — 8:00 PM IST every Saturday ("30 14 * * 6").
 *
 * End-of-week trend view for the Admin group: completions, revenue collected,
 * on-time %, average pipeline days, and a per-person completion leaderboard.
 * Where EOD says "what happened today", this says "how did the week go".
 *
 * Manual test: /api/cron/weekly-scorecard?debug=1
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

function medal(i: number): string {
  return ['🥇', '🥈', '🥉'][i] || '  •';
}

function buildMessage(s: Awaited<ReturnType<typeof getWeeklyScorecard>>): string {
  const lines: string[] = [];
  lines.push(`📊 <b>Weekly Scorecard</b> — ${escapeHtml(s.rangeLabel)}`);
  lines.push('');
  lines.push(`✅ Completed: <b>${s.completed}</b>   🆕 New: <b>${s.newJobs}</b>`);
  lines.push(`💰 Collected: <b>${inr(s.revenue)}</b>`);
  lines.push(
    `⏱️ On-time: <b>${s.onTimePct === null ? '—' : s.onTimePct + '%'}</b>` +
    `${s.onTimeSample ? ` (of ${s.onTimeSample} with deadline)` : ''}`
  );
  lines.push(`🚀 Avg pipeline: <b>${s.avgPipelineDays === null ? '—' : s.avgPipelineDays + ' days'}</b>`);

  if (s.byPerson.length) {
    lines.push('');
    lines.push('🏆 <b>Completions by person</b>');
    lines.push(
      s.byPerson
        .slice(0, 8)
        .map((p, i) => `${medal(i)} ${escapeHtml(p.name)} — <b>${p.count}</b>`)
        .join('\n')
    );
  }

  lines.push('');
  lines.push('<i>Have a good Sunday — see you Monday. 👋</i>');
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

  const scorecard = await getWeeklyScorecard(supabase);
  const text = buildMessage(scorecard);

  if (isDebug) {
    return NextResponse.json({ preview: text, scorecard });
  }

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

  return NextResponse.json({ sent, targets: targets.size, completed: scorecard.completed });
}
