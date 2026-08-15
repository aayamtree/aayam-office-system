// ─────────────────────────────────────────────────────────────
// What customers actually owe us.
//
// The EOD brief has been reporting "Outstanding: ₹33,040" from the
// `invoices` table, which holds 2 rows. Invoicing moved to Zoho and the
// brief never followed. The real figure, sitting in zoho_documents the
// whole time, is around ₹48 lakh across 77 invoices.
//
// A wrong money number is worse than no money number: it reads as
// reassurance. So this module is the single source for receivables in
// every brief, and it carries its own freshness stamp — a sync that
// stopped three days ago must be visible in the message, not silently
// reported as today's position.
//
// Grouped by CUSTOMER, not by invoice, because you do not ring an
// invoice number. Medhini's ₹16.1L is 21 separate documents; as a list
// of documents it is noise, as one line it is the first call of the day.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

/** Rupees, no paise — glanceable figures, not ledger entries. */
export function inr(n: number): string {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN');
}

/**
 * Statuses that represent money genuinely owed to us.
 *  - `overdue` and `sent` are real receivables.
 *  - `draft` is not owed: it has not been issued to anyone yet.
 *  - `void` is cancelled — ₹4.89L of it, which would badly overstate the total.
 *  - `paid` carries a zero balance anyway.
 */
const OWED_STATUSES = ['overdue', 'sent'];

export interface CustomerDebt {
  customer: string;
  invoices: number;
  owed: number;
  /** Days past the OLDEST due date for this customer. Negative = not due yet. */
  daysOverdue: number;
  /** True when at least one invoice is genuinely past its due date. */
  isOverdue: boolean;
}

export interface Receivables {
  byCustomer: CustomerDebt[];
  totalOwed: number;
  invoiceCount: number;
  customerCount: number;
  /** Owed on invoices already past their due date. */
  overdueOwed: number;
  /** Owed on invoices issued but not yet due. */
  notYetDueOwed: number;
  /** When Zoho last pushed us anything. Null means the sync has never run. */
  lastSyncedAt: Date | null;
  /** Whole days since the last sync — the honesty check on every figure above. */
  syncAgeDays: number | null;
}

interface DocRow {
  customer_name: string | null;
  balance: number | null;
  due_date: string | null;
  status: string | null;
  last_synced_at: string | null;
}

const DAY_MS = 86_400_000;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

/**
 * Every rupee customers owe us, grouped by customer, biggest first.
 *
 * Throws rather than returning an empty snapshot: an empty receivables list
 * renders as "everyone has paid", which is the single most misleading thing
 * this system could tell Satish.
 */
export async function getReceivables(supabase: SupabaseClient): Promise<Receivables> {
  const { data, error } = await supabase
    .from('zoho_documents')
    .select('customer_name, balance, due_date, status, last_synced_at')
    .eq('doc_type', 'invoice')
    .in('status', OWED_STATUSES)
    .gt('balance', 0);

  if (error) throw new Error(`receivables query failed: ${error.message}`);

  const rows = (data || []) as DocRow[];

  const groups = new Map<string, { owed: number; invoices: number; oldestDue: number | null; anyOverdue: boolean }>();
  let overdueOwed = 0;
  let notYetDueOwed = 0;
  let lastSync: number | null = null;

  for (const r of rows) {
    const owed = Number(r.balance) || 0;
    if (owed <= 0) continue;

    const name = (r.customer_name || '').trim() || 'Unknown customer';
    const g = groups.get(name) || { owed: 0, invoices: 0, oldestDue: null as number | null, anyOverdue: false };
    g.owed += owed;
    g.invoices += 1;

    if (r.due_date) {
      const due = new Date(r.due_date).getTime();
      if (!Number.isNaN(due)) {
        if (g.oldestDue === null || due < g.oldestDue) g.oldestDue = due;
        if (due < Date.now()) { g.anyOverdue = true; overdueOwed += owed; } else { notYetDueOwed += owed; }
      }
    } else {
      // No due date recorded — treat as owed but not provably overdue.
      notYetDueOwed += owed;
    }
    groups.set(name, g);

    const synced = r.last_synced_at ? new Date(r.last_synced_at).getTime() : null;
    if (synced && !Number.isNaN(synced) && (lastSync === null || synced > lastSync)) lastSync = synced;
  }

  const byCustomer: CustomerDebt[] = Array.from(groups.entries())
    .map(([customer, g]) => ({
      customer,
      invoices: g.invoices,
      owed: g.owed,
      daysOverdue: g.oldestDue === null ? 0 : Math.floor((Date.now() - g.oldestDue) / DAY_MS),
      isOverdue: g.anyOverdue,
    }))
    // Biggest first: Satish's call — chase the most money, with age shown alongside
    // so an old small debt is still visible rather than sorted out of sight.
    .sort((a, b) => b.owed - a.owed);

  return {
    byCustomer,
    totalOwed: byCustomer.reduce((s, c) => s + c.owed, 0),
    invoiceCount: rows.length,
    customerCount: byCustomer.length,
    overdueOwed,
    notYetDueOwed,
    lastSyncedAt: lastSync ? new Date(lastSync) : null,
    syncAgeDays: lastSync ? daysSince(new Date(lastSync).toISOString()) : null,
  };
}

/** 🔴 over 60 days · 🟠 over 30 · 🟡 overdue at all · 🟢 not yet due. */
export function debtIcon(c: CustomerDebt): string {
  if (!c.isOverdue) return '🟢';
  if (c.daysOverdue > 60) return '🔴';
  if (c.daysOverdue > 30) return '🟠';
  return '🟡';
}

/**
 * The money block for the daily brief. Names customers, not invoices, and
 * says out loud when the Zoho sync has gone stale rather than presenting
 * three-day-old figures as this morning's position.
 */
export function buildReceivablesBlock(
  r: Receivables,
  opts: { limit?: number; escape?: (s: string) => string; moreUrl?: string } = {},
): string | null {
  if (!r.byCustomer.length) return null;

  const limit = opts.limit ?? 5;
  const esc = opts.escape ?? ((s: string) => s);
  const shown = r.byCustomer.slice(0, limit);
  const rest = r.byCustomer.slice(limit);

  const lines = shown.map(c => {
    const age = c.isOverdue ? `${c.daysOverdue}d` : 'not due';
    return `${debtIcon(c)} <b>${esc(c.customer)}</b> — <b>${inr(c.owed)}</b> · ${c.invoices} inv · ${age}`;
  });

  if (rest.length) {
    const restOwed = rest.reduce((s, c) => s + c.owed, 0);
    const tail = `   ${rest.length} more customer${rest.length !== 1 ? 's' : ''} · ${inr(restOwed)}`;
    lines.push(opts.moreUrl ? `<a href="${opts.moreUrl}">${tail} →</a>` : tail);
  }

  // A figure with no freshness stamp is a figure you cannot act on.
  const stale = r.syncAgeDays !== null && r.syncAgeDays >= 2
    ? `\n⚠️ Zoho last synced ${r.syncAgeDays} days ago — these figures may be out of date.`
    : '';

  return (
    `💸 <b>Money owed</b> — <b>${inr(r.totalOwed)}</b> · ${r.customerCount} customers\n` +
    `   ${inr(r.overdueOwed)} overdue · ${inr(r.notYetDueOwed)} not yet due\n\n` +
    lines.join('\n') + stale
  );
}
