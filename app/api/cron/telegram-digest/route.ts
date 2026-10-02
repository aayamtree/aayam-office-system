import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStageName } from '@/lib/job-workflow';
import { sendToChat, escapeHtml, mentionStaff, APP_URL, TelegramGroupPurpose } from '@/lib/telegram-groups';
import { withCronLog } from '@/lib/cron-log';
import {
  getReceivables,
  buildReceivablesBlock,
  inr,
  type Receivables,
} from '@/lib/receivables';
import { getPayables, buildPositionBlock, type Payables } from '@/lib/payables';
import { CLOSED_STATUS_FILTER } from '@/lib/lead-status';

/**
 * Telegram Digest Cron — runs twice daily, Mon–Sat:
 *   Morning  09:00 IST ("30 3 * * 1-6")  → full brief
 *   Evening  17:30 IST ("0 12 * * 1-6")  → "still pending today" recap
 *
 * Hybrid personal briefs (2026-07-18):
 *  - Department GROUPS get per-person sections (@mention per staff).
 *  - Staff who linked Telegram (profiles.telegram_chat_id) ALSO get a
 *    private DM with only THEIR pendings.
 *  - Slot (morning/evening) auto-detected from IST time; override with
 *    ?slot=morning|evening for testing.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

const DEPT_STAGES: Record<string, string[]> = {
  design: ['new', 'designing', 'approval', 'pre_print_qc', 'print_file_ready'],
  print: ['file_received', 'file_check', 'ready_to_print', 'printing', 'material_received', 'quality_check'],
  dispatch: ['ready', 'dispatched'],
};

type Slot = 'morning' | 'evening';

interface DigestJob {
  id: string;
  job_number: string | null;
  project_name: string | null;
  current_stage: string;
  total_amount: number | null;
  amount_received: number | null;
  designer_id: string | null;
  client_deadline?: string | null;
  created_at?: string | null;
}

interface Staff {
  id: string;
  full_name: string | null;
  role: string | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
}

interface DigestLead {
  id: string;
  name: string | null;
  company: string | null;
  next_follow_up: string | null;
  assigned_to: string | null;
}

function istNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
  });
}

/** @mention for a staff member — shared with the stage alerts. */
const mention = (p: Staff): string => mentionStaff(p);

function jobLine(j: DigestJob): string {
  return `  • <b>${escapeHtml(j.job_number || '?')}</b> ${escapeHtml(j.project_name || '')} — <i>${escapeHtml(getStageName(j.current_stage))}</i>`;
}

function leadLine(l: DigestLead): string {
  const who = l.company || l.name || '?';
  const due = l.next_follow_up
    ? new Date(l.next_follow_up).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    : '';
  return `  • <b>${escapeHtml(who)}</b>${due ? ` — follow-up ${escapeHtml(due)}` : ''}`;
}

function header(slot: Slot, forWhom: string): string {
  return slot === 'morning'
    ? `☀️ <b>Good morning ${forWhom}!</b> — ${todayLabel()}`
    : `🌆 <b>Evening recap ${forWhom}</b> — still pending today:`;
}

/* ------------------------------------------------------------------ */
/* Group digests                                                       */
/* ------------------------------------------------------------------ */

function buildDesignGroupDigest(slot: Slot, jobs: DigestJob[], staff: Staff[]): string | null {
  const mine = jobs.filter((j) => DEPT_STAGES.design.includes(j.current_stage));
  if (!mine.length) {
    return slot === 'morning'
      ? `${header(slot, 'Design')}\n\nQueue is empty. Enjoy the calm! 🎉`
      : null; // no evening message when nothing is pending
  }

  const byDesigner = new Map<string, DigestJob[]>();
  for (const j of mine) {
    const key = j.designer_id || 'unassigned';
    if (!byDesigner.has(key)) byDesigner.set(key, []);
    byDesigner.get(key)!.push(j);
  }

  const sections: string[] = [];
  for (const [designerId, list] of Array.from(byDesigner.entries())) {
    const person = staff.find((s) => s.id === designerId);
    const title = designerId === 'unassigned'
      ? '⚠️ <b>Unassigned</b>'
      : `👤 ${person ? mention(person) : '<b>Unknown</b>'}`;
    const listed = list.slice(0, 8).map(jobLine).join('\n');
    const more = list.length > 8 ? `\n  …and ${list.length - 8} more` : '';
    sections.push(`${title} — ${list.length} job${list.length !== 1 ? 's' : ''}\n${listed}${more}`);
  }

  return `${header(slot, 'Design')}\n\n${sections.join('\n\n')}`;
}

function buildQueueGroupDigest(slot: Slot, department: 'print' | 'dispatch', jobs: DigestJob[]): string | null {
  const label = department === 'print' ? 'Print' : 'Dispatch';
  const mine = jobs.filter((j) => DEPT_STAGES[department].includes(j.current_stage));
  if (!mine.length) {
    return slot === 'morning'
      ? `${header(slot, label)}\n\nQueue is empty. Enjoy the calm! 🎉`
      : null;
  }
  const listed = mine.slice(0, 10).map(jobLine).join('\n');
  const more = mine.length > 10 ? `\n  …and ${mine.length - 10} more` : '';
  return `${header(slot, label)}\n<b>${mine.length}</b> job${mine.length !== 1 ? 's' : ''} in the queue:\n\n${listed}${more}`;
}

/**
 * The owner's daily brief.
 *
 * The old version was a data dump: five headline numbers, three of them
 * different kinds of "pending" that could not be told apart, then eight
 * job-level payment lines — seven of which were the same customer's PO split
 * into parts — and fifty more hidden behind "…and 50 more".
 *
 * Rewritten around what the message is FOR: what is in the building, who owes
 * money, and what to do about it before lunch. Ten lines, one kind of number
 * in each block, ending in something actionable.
 *
 * Money now comes from Zoho via lib/receivables.ts. The figure it replaces was
 * reading a 2-row legacy table and reporting ₹33,040 against a real position
 * near ₹48 lakh.
 */
function buildAdminGroupDigest(
  slot: Slot,
  jobs: DigestJob[],
  leadsDue: DigestLead[],
  receivables?: Receivables | null,
  stuck: DigestJob[] = [],
  overdueJobs: DigestJob[] = [],
  payables?: Payables | null,
): string | null {
  // Morning only. Satish asked for one brief a day plus a fuller weekly review;
  // an evening repeat of the same figures is what made these easy to ignore.
  if (slot !== 'morning') return null;

  const counts: Record<string, number> = {};
  for (const dept of ['design', 'print', 'dispatch'] as const) {
    counts[dept] = jobs.filter((j) => DEPT_STAGES[dept].includes(j.current_stage)).length;
  }

  const lines: string[] = [];
  lines.push(`☀️ <b>${todayLabel()}</b>`);

  // ── Work in the building ────────────────────────────────────────────────
  lines.push('');
  lines.push('<b>WORK</b>');
  lines.push(`Design <b>${counts.design}</b> · Print <b>${counts.print}</b> · Dispatch <b>${counts.dispatch}</b>`);
  const flags: string[] = [];
  if (overdueJobs.length) flags.push(`<b>${overdueJobs.length}</b> past deadline`);
  if (stuck.length) flags.push(`<b>${stuck.length}</b> stuck 3+ days`);
  if (leadsDue.length) flags.push(`<b>${leadsDue.length}</b> lead follow-up${leadsDue.length !== 1 ? 's' : ''}`);
  if (flags.length) lines.push(`⚠️ ${flags.join(' · ')}`);

  // ── Money ───────────────────────────────────────────────────────────────
  const money = receivables
    ? buildReceivablesBlock(receivables, {
      limit: 5,
      escape: escapeHtml,
      moreUrl: `${APP_URL}/admin/finance/zoho`,
    })
    : null;
  if (money) {
    lines.push('');
    lines.push(money);
  } else if (!receivables) {
    // Silence here would read as "nobody owes us anything". Say what broke.
    lines.push('');
    lines.push('⚠️ <b>Money owed unavailable</b> — the Zoho figures could not be read this morning.');
  }

  // The other side of the same coin. Money owed to us without money we owe is
  // half a position, and it is the flattering half.
  if (payables) {
    const owing = buildPositionBlock(payables, receivables ? receivables.totalOwed : null, {
      escape: escapeHtml,
      moreUrl: `${APP_URL}/admin/finance/zoho`,
    });
    if (owing) {
      lines.push('');
      lines.push(owing);
    }
  }

  // ── What to do ──────────────────────────────────────────────────────────
  // A brief that ends in numbers ends in nothing. Name the two calls.
  const todo: string[] = [];
  const worst = receivables?.byCustomer.find(c => c.isOverdue);
  if (worst) {
    todo.push(`Call <b>${escapeHtml(worst.customer)}</b> — ${inr(worst.owed)}, ${worst.daysOverdue}d overdue`);
  }
  const worstJob = overdueJobs[0] || stuck[0];
  if (worstJob) {
    todo.push(`<b>${escapeHtml(worstJob.job_number || '?')}</b> ${escapeHtml((worstJob.project_name || '').slice(0, 40))} — ${escapeHtml(getStageName(worstJob.current_stage))}`);
  }
  if (todo.length) {
    lines.push('');
    lines.push('<b>TODAY</b>');
    for (const t of todo) lines.push(`• ${t}`);
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Personal DM briefs (linked staff only)                              */
/* ------------------------------------------------------------------ */

function buildPersonalBrief(
  slot: Slot,
  p: Staff,
  jobs: DigestJob[],
  leadsDue: DigestLead[],
  receivables?: Receivables | null,
  stuck: DigestJob[] = [],
  overdueJobs: DigestJob[] = [],
  payables?: Payables | null,
): { text: string; appPath: string } | null {
  const name = (p.full_name || '').split(' ')[0] || 'there';
  const head = slot === 'morning'
    ? `☀️ <b>Good morning ${escapeHtml(name)}!</b> Your brief — ${todayLabel()}`
    : `🌆 <b>Evening recap, ${escapeHtml(name)}</b> — still pending:`;

  if (p.role === 'designer') {
    const mine = jobs.filter((j) => j.designer_id === p.id && DEPT_STAGES.design.includes(j.current_stage));
    if (!mine.length) {
      return slot === 'morning'
        ? { text: `${head}\n\nNo jobs assigned to you. Enjoy the calm! 🎉`, appPath: '/admin/jobs/queue' }
        : null;
    }
    const listed = mine.slice(0, 10).map(jobLine).join('\n');
    const more = mine.length > 10 ? `\n  …and ${mine.length - 10} more` : '';
    return {
      text: `${head}\n<b>${mine.length}</b> job${mine.length !== 1 ? 's' : ''} assigned to you:\n\n${listed}${more}`,
      appPath: '/admin/jobs/queue',
    };
  }

  if (p.role === 'marketing') {
    const mine = leadsDue.filter((l) => l.assigned_to === p.id);
    if (!mine.length) {
      return slot === 'morning'
        ? { text: `${head}\n\nNo follow-ups due today. 🎉`, appPath: '/admin/leads' }
        : null;
    }
    const listed = mine.slice(0, 10).map(leadLine).join('\n');
    const more = mine.length > 10 ? `\n  …and ${mine.length - 10} more` : '';
    return {
      text: `${head}\n<b>${mine.length}</b> follow-up${mine.length !== 1 ? 's' : ''} due:\n\n${listed}${more}`,
      appPath: '/admin/leads',
    };
  }

  if (p.role === 'dispatch') {
    const mine = jobs.filter((j) => DEPT_STAGES.dispatch.includes(j.current_stage));
    if (!mine.length) {
      return slot === 'morning'
        ? { text: `${head}\n\nDispatch queue is empty. 🎉`, appPath: '/admin/jobs/queue' }
        : null;
    }
    const listed = mine.slice(0, 10).map(jobLine).join('\n');
    const more = mine.length > 10 ? `\n  …and ${mine.length - 10} more` : '';
    return {
      text: `${head}\n<b>${mine.length}</b> job${mine.length !== 1 ? 's' : ''} to dispatch:\n\n${listed}${more}`,
      appPath: '/admin/jobs/queue',
    };
  }

  if (p.role === 'admin' || p.role === 'accounts') {
    const text = buildAdminGroupDigest(slot, jobs, leadsDue, receivables, stuck, overdueJobs, payables);
    // Null on the evening slot — the owner's brief is morning-only now.
    return text ? { text, appPath: '/admin/finance/zoho' } : null;
  }

  return null; // cmyk & others — no personal brief yet
}

/* ------------------------------------------------------------------ */

async function runJob(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  // Fail closed: if CRON_SECRET is unset, reject rather than run unauthenticated.
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Slot: morning before 13:00 IST, evening after — overridable for testing.
  const slotParam = request.nextUrl.searchParams.get('slot');
  const slot: Slot =
    slotParam === 'morning' || slotParam === 'evening'
      ? slotParam
      : istNow().getUTCHours() >= 13 ? 'evening' : 'morning';

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const [{ data: groups }, { data: jobs }, { data: staff }, { data: leads }] = await Promise.all([
    service
      .from('telegram_groups')
      .select('chat_id, department')
      .eq('is_active', true)
      .eq('digest_enabled', true)
      .not('department', 'is', null),
    service
      .from('jobs')
      // client_deadline + created_at drive the stuck / past-deadline flags below.
      .select('id, job_number, project_name, current_stage, total_amount, amount_received, designer_id, client_deadline, created_at')
      .eq('is_active', true)
      .not('current_stage', 'in', '(delivered,cancelled,file_sent_client)'),
    service
      .from('profiles')
      .select('id, full_name, role, telegram_chat_id, telegram_username')
      .eq('is_active', true),
    service
      .from('leads')
      .select('id, name, company, next_follow_up, assigned_to')
      .not('status', 'in', CLOSED_STATUS_FILTER)
      .not('next_follow_up', 'is', null)
      .lte('next_follow_up', new Date().toISOString()),
  ]);

  const allJobs = (jobs || []) as DigestJob[];
  const allStaff = (staff || []) as Staff[];
  const leadsDue = (leads || []) as DigestLead[];

  // What customers owe, from Zoho. A failure here must not take the whole brief
  // down with it — but it must not pass silently either, or an unreadable money
  // query renders as "nobody owes us anything". null is reported in the message.
  let receivables: Receivables | null = null;
  try {
    receivables = await getReceivables(service);
  } catch (err) {
    console.error('[telegram-digest] receivables unavailable:', err);
  }

  // And what we owe. Same rule: a failure here loses one block, not the brief.
  let payables: Payables | null = null;
  try {
    payables = await getPayables(service);
  } catch (err) {
    console.error('[telegram-digest] payables unavailable:', err);
  }

  // Stuck and past-deadline jobs, for the WORK line and the TODAY list.
  // Idle time is measured from the last stage change, falling back to creation
  // for a job that has never moved at all.
  const { data: moves } = await service
    .from('job_stage_history')
    .select('job_id, created_at')
    .order('created_at', { ascending: false });
  const lastMove = new Map<string, string>();
  for (const m of (moves || []) as { job_id: string; created_at: string }[]) {
    if (!lastMove.has(m.job_id)) lastMove.set(m.job_id, m.created_at);
  }
  const DAY_MS = 86_400_000;
  const stuckJobs: DigestJob[] = [];
  const overdueJobs: DigestJob[] = [];
  for (const j of allJobs) {
    const last = lastMove.get(j.id) || (j as any).created_at;
    if (last) {
      const idle = Math.floor((Date.now() - new Date(last).getTime()) / DAY_MS);
      if (idle >= 3) stuckJobs.push(j);
    }
    const dl = (j as any).client_deadline;
    if (dl && new Date(dl).getTime() < Date.now()) overdueJobs.push(j);
  }
  // Worst first, so the TODAY line names the job that has waited longest.
  overdueJobs.sort((a, b) =>
    new Date((a as any).client_deadline).getTime() - new Date((b as any).client_deadline).getTime());

  // 1) Department group digests (per-person sections for design)
  let groupsSent = 0;
  for (const g of groups || []) {
    // A 'payments' group matches none of the branches below and is skipped —
    // it is the payment-screenshot inbox, not a job department, and must stay
    // quiet apart from its own replies.
    const dept = g.department as TelegramGroupPurpose;
    let text: string | null = null;
    if (dept === 'design') text = buildDesignGroupDigest(slot, allJobs, allStaff);
    else if (dept === 'print' || dept === 'dispatch') text = buildQueueGroupDigest(slot, dept, allJobs);
    else if (dept === 'admin') text = buildAdminGroupDigest(slot, allJobs, leadsDue, receivables, stuckJobs, overdueJobs, payables);
    if (!text) continue;
    const appPath = dept === 'admin' ? '/admin/finance/zoho' : '/admin/jobs/queue';
    if (await sendToChat(g.chat_id, text, appPath)) groupsSent++;
  }

  // 2) Personal DM briefs for linked staff
  let dmsSent = 0;
  for (const p of allStaff) {
    if (!p.telegram_chat_id) continue;
    const brief = buildPersonalBrief(slot, p, allJobs, leadsDue, receivables, stuckJobs, overdueJobs, payables);
    if (!brief) continue;
    if (await sendToChat(p.telegram_chat_id, brief.text, brief.appPath)) dmsSent++;
  }

  return NextResponse.json({
    slot,
    groupsSent,
    dmsSent,
    linkedStaff: allStaff.filter((p) => p.telegram_chat_id).length,
    // Surfaced so the health audit can tell "nothing outstanding" apart from
    // "the money query silently failed again".
    receivables: receivables
      ? {
        customers: receivables.customerCount,
        invoices: receivables.invoiceCount,
        owed: receivables.totalOwed,
        syncAgeDays: receivables.syncAgeDays,
      }
      : 'unavailable',
  });
}

// Every run of this cron is recorded in public.cron_runs (see lib/cron-log.ts).
// Vercel knows whether the schedule fired, but that lives in a dashboard nobody
// opens; the daily audit needs the fact inside the database so it can alert when
// this job silently stops running.
export async function GET(request: NextRequest) {
    return withCronLog('telegram-digest', () => runJob(request));
}
