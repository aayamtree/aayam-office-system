// ─────────────────────────────────────────────────────────────
// Money that left the building with the goods.
//
// Dispatch does not wait for payment on recurring work or on old
// clients with a good name — and that is a deliberate business
// decision, not a mistake. What was missing was the follow-up: once
// a job is dispatched the system stopped watching it, so an unpaid
// consignment could sit for months with nobody counting the days.
//
// This module counts the days from DISPATCH (not from invoice date,
// not from deadline) until the money is in, and is the single source
// for both the daily Telegram brief and the in-app list.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgeingBucket {
  id: '0-15' | '16-30' | '31-60' | '60+';
  label: string;
  min: number;
  max: number;
  /** Emoji used in the Telegram brief. */
  icon: string;
}

// Buckets exist so a long list does not read as one undifferentiated
// wall of red. A 5-day-old invoice is normal; a 70-day-old one is not.
export const AGEING_BUCKETS: AgeingBucket[] = [
  { id: '0-15',  label: '0–15 days',  min: 0,  max: 15,       icon: '🟢' },
  { id: '16-30', label: '16–30 days', min: 16, max: 30,       icon: '🟡' },
  { id: '31-60', label: '31–60 days', min: 31, max: 60,       icon: '🟠' },
  { id: '60+',   label: '60+ days',   min: 61, max: Infinity, icon: '🔴' },
];

export function bucketFor(days: number): AgeingBucket {
  return AGEING_BUCKETS.find(b => days >= b.min && days <= b.max) || AGEING_BUCKETS[0];
}

export interface PendingPayment {
  id: string;
  job_number: string | null;
  project_name: string | null;
  client_name: string;
  invoice_reference: string | null;
  client_ref_no: string | null;
  total_amount: number;
  amount_received: number;
  /** What the client still owes us. */
  balance: number;
  dispatched_at: string | null;
  /** Days since the goods left. This is the number that matters. */
  days_since_dispatch: number;
  bucket: AgeingBucket['id'];
}

export interface PendingPaymentsSnapshot {
  items: PendingPayment[];
  /** Total rupees outstanding on dispatched work. */
  totalOutstanding: number;
  /** Count and value per ageing bucket, oldest bucket last. */
  byBucket: { bucket: AgeingBucket; count: number; value: number }[];
  /** The single worst offender, if any. */
  oldest: PendingPayment | null;
}

/** Rupees, no paise — these are glanceable figures, not ledger entries. */
export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function daysBetween(fromIso: string, to = new Date()): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Everything dispatched but not fully paid, worst first.
 *
 * A job counts as dispatched if the DB trigger stamped `dispatched_at`
 * (the reliable path) or if it has simply reached a post-dispatch stage
 * — older rows predate the trigger and would otherwise be invisible.
 */
export async function getPendingPayments(
  supabase: SupabaseClient,
): Promise<PendingPaymentsSnapshot> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, job_number, project_name, total_amount, amount_received, invoice_reference, client_ref_no, dispatched_at, completed_date, updated_at, current_stage, client:clients(id, name, company)')
    .or('dispatched_at.not.is.null,current_stage.in.(dispatched,delivered,completed)')
    .order('dispatched_at', { ascending: true, nullsFirst: false });

  if (error) throw new Error(`pending payments query failed: ${error.message}`);

  const items: PendingPayment[] = [];

  for (const row of (data || []) as any[]) {
    const total = Number(row.total_amount) || 0;
    const received = Number(row.amount_received) || 0;
    const balance = total - received;

    // Nothing owed, or a job with no value recorded — not a collection problem.
    if (balance <= 0 || total <= 0) continue;

    // Prefer the trigger-stamped date. Fall back for rows dispatched before
    // that trigger existed, so history is not silently dropped.
    const since: string | null = row.dispatched_at || row.completed_date || row.updated_at || null;
    if (!since) continue;

    const days = daysBetween(since);
    const client = Array.isArray(row.client) ? row.client[0] : row.client;

    items.push({
      id: row.id,
      job_number: row.job_number ?? null,
      project_name: row.project_name ?? null,
      // Company first — that is how Satish refers to clients everywhere else.
      client_name: client?.company || client?.name || 'Unknown client',
      invoice_reference: row.invoice_reference ?? null,
      client_ref_no: row.client_ref_no ?? null,
      total_amount: total,
      amount_received: received,
      balance,
      dispatched_at: since,
      days_since_dispatch: days,
      bucket: bucketFor(days).id,
    });
  }

  // Oldest first: the top of the list is where the money is at risk.
  items.sort((a, b) => b.days_since_dispatch - a.days_since_dispatch);

  const byBucket = AGEING_BUCKETS.map(bucket => {
    const inBucket = items.filter(i => i.bucket === bucket.id);
    return {
      bucket,
      count: inBucket.length,
      value: inBucket.reduce((s, i) => s + i.balance, 0),
    };
  });

  return {
    items,
    totalOutstanding: items.reduce((s, i) => s + i.balance, 0),
    byBucket,
    oldest: items[0] || null,
  };
}

/**
 * The Pending Payments block for the daily Telegram brief.
 * Returns null when nothing is outstanding — a clean day should not
 * produce a message, or the brief becomes noise people stop reading.
 */
export function buildPendingPaymentsBlock(
  snap: PendingPaymentsSnapshot,
  opts: { limit?: number; escape?: (s: string) => string } = {},
): string | null {
  if (!snap.items.length) return null;

  const limit = opts.limit ?? 8;
  const esc = opts.escape ?? ((s: string) => s);

  const summary = snap.byBucket
    .filter(b => b.count > 0)
    .map(b => `${b.bucket.icon} ${b.bucket.label}: <b>${b.count}</b> · ${inr(b.value)}`)
    .join('\n');

  const lines = snap.items.slice(0, limit).map(i => {
    const ref = i.invoice_reference ? ` [${esc(i.invoice_reference)}]` : '';
    return `${bucketFor(i.days_since_dispatch).icon} <b>${i.days_since_dispatch}d</b> — ${esc(i.client_name)} · ${esc(i.job_number || '?')}${ref} · <b>${inr(i.balance)}</b>`;
  });

  const more = snap.items.length > limit
    ? `\n  …and ${snap.items.length - limit} more`
    : '';

  return (
    `💸 <b>Pending Payments</b> — ${snap.items.length} dispatched, unpaid · <b>${inr(snap.totalOutstanding)}</b>\n` +
    `${summary}\n\n` +
    `${lines.join('\n')}${more}`
  );
}
