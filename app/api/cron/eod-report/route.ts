import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendToChat, escapeHtml } from '@/lib/telegram-groups';
import { getEodSnapshot, getFinancialSnapshot, inr, STUCK_DAYS, type JobBrief, type InvoiceBrief } from '@/lib/eod-metrics';
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


function jobLine(j: JobBrief, tail: string): string {
  return `  • <b>${escapeHtml(j.job_number || '?')}</b> ${escapeHtml((j.project_name || '').slice(0, 40))} — <i>${escapeHtml(j.stage_name)}</i>${tail}`;
}

function invoiceLine(inv: InvoiceBrief, showDays: boolean = false): string {
  const client = inv.client_company || inv.client_name || 'Unknown';
  const clientShort = escapeHtml(client.slice(0, 35));
  const amount = inr(inv.total_amount);
  const dayInfo = showDays && inv.days_overdue ? ` | <b>${inv.days_overdue}d overdue</b>` :
                  showDays && inv.days_until_due ? ` | Due in ${inv.days_until_due}d` : '';
  return `  • <b>${escapeHtml(inv.invoice_number)}</b> | ${clientShort} | ${amount}${dayInfo}`;
}

function buildFinancialSection(fin: Awaited<ReturnType<typeof getFinancialSnapshot>>): string[] {
  const lines: string[] = [];

  if (fin.overdue.length === 0 && fin.pending.length === 0 && fin.partial.length === 0) {
    lines.push('💚 <b>All invoices up to date!</b>');
    return lines;
  }

  lines.push('');
  lines.push('<b>💰 INVOICE STATUS</b>');

  // Overdue — high priority
  if (fin.overdue.length) {
    const list = fin.overdue.slice(0, 5).map(inv => invoiceLine(inv, true)).join('\n');
    const more = fin.overdue.length > 5 ? `\n  …and ${fin.overdue.length - 5} more` : '';
    lines.push('');
    lines.push(`🔴 <b>OVERDUE — ${fin.overdue.length}</b>`);
    lines.push(`${list}${more}`);
  }

  // Pending — show 5 soonest due
  if (fin.pending.length) {
    const list = fin.pending.slice(0, 5).map(inv => invoiceLine(inv, true)).join('\n');
    const more = fin.pending.length > 5 ? `\n  …and ${fin.pending.length - 5} more` : '';
    lines.push('');
    lines.push(`⏳ <b>PENDING — ${fin.pending.length}</b>`);
    lines.push(`${list}${more}`);
  }

  // Partial payments
  if (fin.partial.length) {
    const list = fin.partial.slice(0, 3).map(inv => invoiceLine(inv, false)).join('\n');
    const more = fin.partial.length > 3 ? `\n  …and ${fin.partial.length - 3} more` : '';
    lines.push('');
    lines.push(`🟡 <b>PARTIAL — ${fin.partial.length}</b>`);
    lines.push(`${list}${more}`);
  }

  // Summary
  lines.push('');
  lines.push(`Outstanding: <b>${inr(fin.totalOutstanding)}</b> | Pending: <b>${inr(fin.totalPending)}</b>`);

  return lines;
}

function buildMessage(s: Awaited<ReturnType<typeof getEodSnapshot>>, fin: Awaited<ReturnType<typeof getFinancialSnapshot>>): string {
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

  // Job overdue
  if (s.overdue.length) {
    const list = s.overdue.slice(0, 6).map((j) => jobLine(j, ` — <b>${j.days_overdue}d over</b>`)).join('\n');
    const more = s.overdue.length > 6 ? `\n  …and ${s.overdue.length - 6} more` : '';
    lines.push('');
    lines.push(`🔴 <b>Jobs Past deadline — ${s.overdue.length}</b>`);
    lines.push(`${list}${more}`);
  }

  if (!s.stuck.length && !s.overdue.length) {
    lines.push('');
    lines.push('🟢 <b>No stuck or overdue jobs. Clean board!</b>');
  }

  // Financial summary
  lines.push(...buildFinancialSection(fin));

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

  const [snapshot, financial] = await Promise.all([
    getEodSnapshot(supabase),
    getFinancialSnapshot(supabase),
  ]);
  const text = buildMessage(snapshot, financial);

  if (isDebug) {
    return NextResponse.json({ preview: text, snapshot, financial });
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

  return NextResponse.json({ sent, targets: targets.size, done: snapshot.doneToday.length, stuck: snapshot.stuck.length, overdue_invoices: financial.overdue.length, pending_invoices: financial.pending.length });
}

// Every run of this cron is recorded in public.cron_runs (see lib/cron-log.ts).
// Vercel knows whether the schedule fired, but that lives in a dashboard nobody
// opens; the daily audit needs the fact inside the database so it can alert when
// this job silently stops running.
export async function GET(request: NextRequest) {
    return withCronLog('eod-report', () => runJob(request));
}
