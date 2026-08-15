import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendToChat, escapeHtml, APP_URL } from '@/lib/telegram-groups';
import { getEodSnapshot, inr, STUCK_DAYS, type JobBrief } from '@/lib/eod-metrics';
import { getReceivables, buildReceivablesBlock, type Receivables } from '@/lib/receivables';
import { authorizeCron } from '@/lib/api-auth';
import { withCronLog } from '@/lib/cron-log';

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


/**
 * Telegram truncates nothing for us — "…and 31 more" was dead plain text with
 * no way to see the rest. Every truncated list now ends in a TAPPABLE link that
 * opens the matching section of /admin/pulse, where the full list is rendered.
 *
 * `anchor` must match an element id in app/admin/pulse/PulseClient.tsx.
 */
function moreLink(total: number, shown: number, anchor: string): string {
  if (total <= shown) return '';
  const url = `${APP_URL}/admin/pulse#${anchor}`;
  return `\n  <a href="${url}">…and ${total - shown} more — tap to see all ${total} →</a>`;
}

function jobLine(j: JobBrief, tail: string): string {
  return `  • <b>${escapeHtml(j.job_number || '?')}</b> ${escapeHtml((j.project_name || '').slice(0, 40))} — <i>${escapeHtml(j.stage_name)}</i>${tail}`;
}

/**
 * Money owed, from Zoho.
 *
 * This section used to read the `invoices` table and report
 * "Outstanding: ₹33,040". That table holds 2 rows. Invoicing moved to Zoho
 * long ago and this block never followed, so it reported ₹33,040 against a
 * real position near ₹48 lakh — a wrong money figure presented with total
 * confidence, which is worse than showing nothing.
 *
 * It now names CUSTOMERS rather than invoice numbers: 21 Medhini invoices
 * are one phone call, not 21 lines.
 */
function buildFinancialSection(r: Receivables | null): string[] {
  const lines: string[] = [];

  if (!r) {
    // Never let a failed money query render as "all clear".
    lines.push('');
    lines.push('⚠️ <b>Money owed unavailable</b> — the Zoho figures could not be read.');
    return lines;
  }

  if (!r.byCustomer.length) {
    lines.push('');
    lines.push('💚 <b>Nothing outstanding — every invoice is paid.</b>');
    return lines;
  }

  const block = buildReceivablesBlock(r, {
    limit: 8,
    escape: escapeHtml,
    moreUrl: `${APP_URL}/admin/finance/zoho`,
  });
  if (block) {
    lines.push('');
    lines.push(block);
  }
  return lines;
}

function buildMessage(s: Awaited<ReturnType<typeof getEodSnapshot>>, r: Receivables | null): string {
  const lines: string[] = [];
  // Weekly now, not daily. The daily version repeated the morning brief and
  // added a "Collected today: ₹0" line that could only ever say zero, because
  // payments_received has taken one row since 29 July — the money is in Zoho.
  lines.push(`📋 <b>Week in review</b> — ${s.dateLabel}`);
  lines.push('');
  lines.push(`✅ Done: <b>${s.doneToday.length}</b>   🚚 Moved: <b>${s.movedToday}</b>   🆕 New: <b>${s.newToday}</b>`);
  lines.push(`📊 In progress: <b>${s.activeJobs}</b> job${s.activeJobs !== 1 ? 's' : ''}`);

  // Done list (short)
  if (s.doneToday.length) {
    const list = s.doneToday.slice(0, 6).map((j) => jobLine(j, '')).join('\n');
    const more = moreLink(s.doneToday.length, 6, 'done-today');
    lines.push('');
    lines.push(`✅ <b>Completed today</b>`);
    lines.push(`${list}${more}`);
  }

  // Stuck — the important one
  if (s.stuck.length) {
    const list = s.stuck.slice(0, 6).map((j) => jobLine(j, ` — <b>${j.days_idle}d idle</b>`)).join('\n');
    const more = moreLink(s.stuck.length, 6, 'stuck');
    lines.push('');
    lines.push(`⚠️ <b>Stuck (${STUCK_DAYS}+ days no movement) — ${s.stuck.length}</b>`);
    lines.push(`${list}${more}`);
  }

  // Job overdue
  if (s.overdue.length) {
    const list = s.overdue.slice(0, 6).map((j) => jobLine(j, ` — <b>${j.days_overdue}d over</b>`)).join('\n');
    const more = moreLink(s.overdue.length, 6, 'overdue');
    lines.push('');
    lines.push(`🔴 <b>Jobs Past deadline — ${s.overdue.length}</b>`);
    lines.push(`${list}${more}`);
  }

  if (!s.stuck.length && !s.overdue.length) {
    lines.push('');
    lines.push('🟢 <b>No stuck or overdue jobs. Clean board!</b>');
  }

  // Money owed — from Zoho, grouped by customer.
  lines.push(...buildFinancialSection(r));

  return lines.join('\n');
}

async function runJob(request: NextRequest) {
  // Vercel cron secret, or an admin session for ?debug=1 previews.
  const gate = await authorizeCron(request);
  if (!gate.ok) return gate.response;
  const isDebug = gate.isDebug;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // A failed money query must not take the whole review down, but it must be
  // visible in the message rather than rendering as "nothing outstanding".
  const [snapshot, receivables] = await Promise.all([
    getEodSnapshot(supabase),
    getReceivables(supabase).catch((e) => {
      console.error('[eod-report] receivables unavailable:', e);
      return null;
    }),
  ]);
  const text = buildMessage(snapshot, receivables);

  if (isDebug) {
    return NextResponse.json({ preview: text, snapshot, receivables });
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

  return NextResponse.json({
    sent, targets: targets.size,
    done: snapshot.doneToday.length, stuck: snapshot.stuck.length,
    owed: receivables ? receivables.totalOwed : 'unavailable',
    customers: receivables ? receivables.customerCount : 'unavailable',
  });
}

// Every run of this cron is recorded in public.cron_runs (see lib/cron-log.ts).
// Vercel knows whether the schedule fired, but that lives in a dashboard nobody
// opens; the daily audit needs the fact inside the database so it can alert when
// this job silently stops running.
export async function GET(request: NextRequest) {
    return withCronLog('eod-report', () => runJob(request));
}
