/**
 * EOD + Weekly Scorecard metrics (SERVER-SIDE ONLY).
 *
 * Single source of truth for three consumers:
 *   - app/api/cron/eod-report        (7:30 PM IST Mon–Sat Telegram EOD)
 *   - app/api/cron/weekly-scorecard  (8:00 PM IST Sat Telegram scorecard)
 *   - app/admin/pulse                (always-current dashboard page)
 *
 * Design principle: EOD is EXCEPTION-focused. It answers "what moved, what's
 * stuck, what needs the boss" — not a full dump. Short message = read message.
 *
 * Data sources:
 *   - job_stage_history : every stage change (job_id, to_stage, changed_by_name, created_at)
 *   - jobs              : deadlines, amounts, designer, current_stage
 *   - payments_received : money collected (amount, payment_date)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getStageName, MASTER_STAGE_ORDER } from '@/lib/job-workflow';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Stages that mean a job is "done" for the day (design handoff or delivered). */
const DONE_STAGES = ['file_sent_client', 'delivered', 'dispatched'];
/** A job idle in the same stage for this many days is flagged "stuck". */
export const STUCK_DAYS = 3;

/** IST midnight (start of today in IST), expressed as a UTC Date. */
function istDayStartUtc(base: Date = new Date()): Date {
  const ist = new Date(base.getTime() + IST_OFFSET_MS);
  const utcMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(utcMidnight - IST_OFFSET_MS);
}

/** IST midnight of the current week's Monday, as a UTC Date. */
function istWeekStartUtc(base: Date = new Date()): Date {
  const dayStart = istDayStartUtc(base);
  const ist = new Date(base.getTime() + IST_OFFSET_MS);
  const dow = ist.getUTCDay(); // 0 Sun … 6 Sat
  const daysSinceMon = (dow + 6) % 7; // Mon=0 … Sun=6
  return new Date(dayStart.getTime() - daysSinceMon * 24 * 60 * 60 * 1000);
}

export function todayLabelIST(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
  });
}

export function inr(n: number): string {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN');
}

export interface JobBrief {
  id: string;
  job_number: string | null;
  project_name: string | null;
  current_stage: string;
  stage_name: string;
  days_idle?: number;
  days_overdue?: number;
  designer_id?: string | null;
  pending?: number;
}

export interface EodSnapshot {
  dateLabel: string;
  doneToday: JobBrief[];
  movedToday: number;
  newToday: number;
  stuck: JobBrief[];
  overdue: JobBrief[];
  collectedToday: number;
  paymentsToday: number;
  pendingActive: number;
  activeJobs: number;
}

interface JobRow {
  id: string;
  job_number: string | null;
  project_name: string | null;
  current_stage: string;
  client_deadline: string | null;
  total_amount: number | null;
  amount_received: number | null;
  designer_id: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Daily EOD snapshot                                                  */
/* ------------------------------------------------------------------ */

export async function getEodSnapshot(supabase: SupabaseClient): Promise<EodSnapshot> {
  const now = new Date();
  const dayStart = istDayStartUtc(now).toISOString();

  const [historyRes, activeRes, newRes, payRes, lastMoveRes] = await Promise.all([
    // Every stage change today
    supabase
      .from('job_stage_history')
      .select('job_id, to_stage, created_at')
      .gte('created_at', dayStart),
    // Active, non-terminal jobs (for stuck / overdue / pending)
    supabase
      .from('jobs')
      .select('id, job_number, project_name, current_stage, client_deadline, total_amount, amount_received, designer_id, created_at')
      .eq('is_active', true)
      .not('current_stage', 'in', '(delivered,cancelled,file_sent_client)'),
    // New jobs created today
    supabase
      .from('jobs')
      .select('id, job_number, project_name, current_stage')
      .gte('created_at', dayStart),
    // Money collected today
    supabase
      .from('payments_received')
      .select('amount')
      .gte('payment_date', dayStart),
    // Last stage-change timestamp per job (to compute idle time)
    supabase
      .from('job_stage_history')
      .select('job_id, created_at')
      .order('created_at', { ascending: false }),
  ]);

  const history = (historyRes.data || []) as { job_id: string; to_stage: string; created_at: string }[];
  const activeJobs = (activeRes.data || []) as JobRow[];
  const newJobs = (newRes.data || []) as JobRow[];
  const payments = (payRes.data || []) as { amount: number | null }[];

  // Last move per job
  const lastMove = new Map<string, string>();
  for (const r of (lastMoveRes.data || []) as { job_id: string; created_at: string }[]) {
    if (!lastMove.has(r.job_id)) lastMove.set(r.job_id, r.created_at); // first seen = newest (desc order)
  }

  // Classify today's movements
  const doneIds = new Set<string>();
  const movedIds = new Set<string>();
  for (const h of history) {
    if (DONE_STAGES.includes(h.to_stage)) doneIds.add(h.job_id);
    movedIds.add(h.job_id);
  }
  const movedOnlyIds = new Set(Array.from(movedIds).filter((id) => !doneIds.has(id)));

  // Fetch display info for jobs finished today (they're terminal, so not in activeJobs)
  const jobMap = new Map<string, JobRow>();
  for (const j of activeJobs) jobMap.set(j.id, j);
  const missingDone = Array.from(doneIds).filter((id) => !jobMap.has(id));
  if (missingDone.length) {
    const { data: doneJobs } = await supabase
      .from('jobs')
      .select('id, job_number, project_name, current_stage, client_deadline, total_amount, amount_received, designer_id, created_at')
      .in('id', missingDone);
    for (const j of (doneJobs || []) as JobRow[]) jobMap.set(j.id, j);
  }

  const toBrief = (j: JobRow, extra: Partial<JobBrief> = {}): JobBrief => ({
    id: j.id,
    job_number: j.job_number,
    project_name: j.project_name,
    current_stage: j.current_stage,
    stage_name: getStageName(j.current_stage),
    ...extra,
  });

  const doneToday: JobBrief[] = Array.from(doneIds)
    .map((id) => jobMap.get(id))
    .filter((j): j is JobRow => !!j)
    .map((j) => toBrief(j));

  const DAY_MS = 24 * 60 * 60 * 1000;
  const stuck: JobBrief[] = [];
  const overdue: JobBrief[] = [];
  let pendingActive = 0;

  for (const j of activeJobs) {
    pendingActive += Math.max(0, (j.total_amount || 0) - (j.amount_received || 0));

    const lastTs = lastMove.get(j.id) || j.created_at;
    const daysIdle = Math.floor((now.getTime() - new Date(lastTs).getTime()) / DAY_MS);
    if (daysIdle >= STUCK_DAYS) stuck.push(toBrief(j, { days_idle: daysIdle }));

    if (j.client_deadline) {
      const dl = new Date(j.client_deadline).getTime();
      if (dl < now.getTime()) {
        const daysOver = Math.floor((now.getTime() - dl) / DAY_MS);
        overdue.push(toBrief(j, { days_overdue: daysOver }));
      }
    }
  }

  stuck.sort((a, b) => (b.days_idle || 0) - (a.days_idle || 0));
  overdue.sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0));

  const collectedToday = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return {
    dateLabel: todayLabelIST(),
    doneToday,
    movedToday: movedOnlyIds.size,
    newToday: newJobs.length,
    stuck,
    overdue,
    collectedToday,
    paymentsToday: payments.length,
    pendingActive,
    activeJobs: activeJobs.length,
  };
}

/* ------------------------------------------------------------------ */
/* Weekly scorecard                                                    */
/* ------------------------------------------------------------------ */

export interface WeeklyScorecard {
  rangeLabel: string;
  completed: number;
  newJobs: number;
  revenue: number;
  onTimePct: number | null;
  onTimeSample: number;
  avgPipelineDays: number | null;
  byPerson: { name: string; count: number }[];
}

export async function getWeeklyScorecard(supabase: SupabaseClient): Promise<WeeklyScorecard> {
  const now = new Date();
  const weekStart = istWeekStartUtc(now);
  const weekStartIso = weekStart.toISOString();

  const [doneRes, newRes, payRes] = await Promise.all([
    supabase
      .from('job_stage_history')
      .select('job_id, to_stage, changed_by_name, created_at')
      .gte('created_at', weekStartIso)
      .in('to_stage', ['file_sent_client', 'delivered']),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStartIso),
    supabase
      .from('payments_received')
      .select('amount')
      .gte('payment_date', weekStartIso),
  ]);

  const doneEvents = (doneRes.data || []) as {
    job_id: string; to_stage: string; changed_by_name: string | null; created_at: string;
  }[];
  const payments = (payRes.data || []) as { amount: number | null }[];

  // Dedupe: one completion per job (first done event of the week)
  const firstDone = new Map<string, { changed_by_name: string | null; created_at: string }>();
  for (const e of doneEvents) {
    if (!firstDone.has(e.job_id)) firstDone.set(e.job_id, e);
  }

  // On-time % + avg pipeline days need job deadline + created date.
  // We also resolve the job's designer so the leaderboard shows a real name
  // even when the stage-history row has no changed_by_name (e.g. system moves).
  const doneJobIds = Array.from(firstDone.keys());
  let onTimeSample = 0;
  let onTimeHits = 0;
  let pipelineDaysSum = 0;
  let pipelineSample = 0;
  const jobDesigner = new Map<string, string | null>();

  if (doneJobIds.length) {
    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, client_deadline, created_at, order_date, designer_id')
      .in('id', doneJobIds);

    const rows = (jobRows || []) as {
      id: string; client_deadline: string | null; created_at: string;
      order_date: string | null; designer_id: string | null;
    }[];

    // Resolve designer names in one shot
    const designerIds = Array.from(new Set(rows.map((r) => r.designer_id).filter(Boolean))) as string[];
    const nameById = new Map<string, string>();
    if (designerIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', designerIds);
      for (const p of (profs || []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) nameById.set(p.id, p.full_name);
      }
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    for (const j of rows) {
      jobDesigner.set(j.id, j.designer_id ? nameById.get(j.designer_id) || null : null);
      const done = firstDone.get(j.id);
      if (!done) continue;
      const doneAt = new Date(done.created_at).getTime();

      if (j.client_deadline) {
        onTimeSample++;
        if (doneAt <= new Date(j.client_deadline).getTime()) onTimeHits++;
      }
      const startRaw = j.order_date || j.created_at;
      if (startRaw) {
        const days = (doneAt - new Date(startRaw).getTime()) / DAY_MS;
        if (days >= 0) { pipelineDaysSum += days; pipelineSample++; }
      }
    }
  }

  // Completions by person: prefer who made the move, else the job's designer.
  const personCount = new Map<string, number>();
  for (const [jobId, e] of Array.from(firstDone.entries())) {
    const name = e.changed_by_name || jobDesigner.get(jobId) || 'Unassigned';
    personCount.set(name, (personCount.get(name) || 0) + 1);
  }
  const byPerson = Array.from(personCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const revenue = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const rangeLabel = `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} – ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;

  return {
    rangeLabel,
    completed: firstDone.size,
    newJobs: newRes.count || 0,
    revenue,
    onTimePct: onTimeSample ? Math.round((onTimeHits / onTimeSample) * 100) : null,
    onTimeSample,
    avgPipelineDays: pipelineSample ? Math.round((pipelineDaysSum / pipelineSample) * 10) / 10 : null,
    byPerson,
  };
}

// Re-export for consumers that want stage ordering context.
export { MASTER_STAGE_ORDER };

/* ------------------------------------------------------------------ */
/* Financial Summary (Invoice Status by Category)                      */
/* ------------------------------------------------------------------ */

export interface InvoiceBrief {
  invoice_number: string;
  client_name: string;
  client_company: string;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  due_date: string | null;
  days_overdue?: number;
  days_until_due?: number;
}

export interface FinancialSnapshot {
  overdue: InvoiceBrief[];
  pending: InvoiceBrief[];
  partial: InvoiceBrief[];
  paid: InvoiceBrief[];
  totalOutstanding: number;
  totalPending: number;
}

export async function getFinancialSnapshot(supabase: SupabaseClient): Promise<FinancialSnapshot> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount, amount_paid, payment_status, due_date, created_at, client:clients(name, company)')
    .order('created_at', { ascending: false });

  if (error || !invoices) {
    console.error('Financial snapshot fetch error:', error);
    return { overdue: [], pending: [], partial: [], paid: [], totalOutstanding: 0, totalPending: 0 };
  }

  const overdue: InvoiceBrief[] = [];
  const pending: InvoiceBrief[] = [];
  const partial: InvoiceBrief[] = [];
  const paid: InvoiceBrief[] = [];
  let totalOutstanding = 0;
  let totalPending = 0;

  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const inv of invoices) {
    // Supabase types an embed as an ARRAY unless it can prove the relationship is
    // to-one, so inv.client?.name does not compile and fails the production build.
    // At runtime this FK gives a single row; normalise so both shapes are safe.
    const client = Array.isArray(inv.client) ? inv.client[0] : inv.client;
    const brief: InvoiceBrief = {
      invoice_number: inv.invoice_number || '',
      client_name: client?.name || '',
      client_company: client?.company || '',
      total_amount: inv.total_amount || 0,
      amount_paid: inv.amount_paid || 0,
      payment_status: inv.payment_status || '',
      due_date: inv.due_date,
    };

    const outstanding = (inv.total_amount || 0) - (inv.amount_paid || 0);

    if (inv.payment_status === 'paid') {
      paid.push(brief);
    } else if (inv.payment_status === 'partial') {
      partial.push(brief);
      totalOutstanding += outstanding;
      totalPending += outstanding;
    } else if (inv.payment_status === 'pending' || inv.payment_status === 'overdue') {
      totalOutstanding += outstanding;
      totalPending += outstanding;

      // Check if overdue
      if (inv.due_date) {
        const dueDate = new Date(inv.due_date).getTime();
        const nowTime = now.getTime();
        if (dueDate < nowTime) {
          const daysOver = Math.floor((nowTime - dueDate) / DAY_MS);
          brief.days_overdue = daysOver;
          overdue.push(brief);
        } else {
          const daysUntil = Math.floor((dueDate - nowTime) / DAY_MS);
          brief.days_until_due = daysUntil;
          pending.push(brief);
        }
      } else {
        pending.push(brief);
      }
    }
  }

  overdue.sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0));
  pending.sort((a, b) => (a.days_until_due || 999) - (b.days_until_due || 999));

  return {
    overdue,
    pending,
    partial,
    paid,
    totalOutstanding,
    totalPending,
  };
}
