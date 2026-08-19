// ────────────────────────────────────────────────────────────────────────────
// What we actually owe vendors.
//
// The mirror image of lib/receivables.ts, and it existed as the same bug: the
// Finance page reported "₹32,209 pending" from the app's own `purchase_bills`
// table, which holds 5 rows, while Zoho Books carried the real payables —
// lakhs of it, much of it 50 to 110 days past due. The app could see ₹51.2L of
// vendor payments leaving the bank and had no idea what they were paying off.
//
// A wrong money number is worse than no money number. This module is the one
// source for payables, and it carries its own freshness stamp so a sync that
// stopped three days ago cannot be presented as this morning's position.
//
// Grouped by VENDOR, not by bill: JK Enterprise is eight separate documents,
// and as eight rows it is noise. As one line it is the call you make today.
//
// STATUSES ARE HANDLED BY EXCLUSION, ON PURPOSE.
// The bank sync once counted `categorized` as the only settled state and
// missed `matched` and `manually_added`, turning 43 reconciled receipts into a
// false alarm. An allowlist of Zoho statuses is a bet that Zoho has no status
// you have not seen yet — a bet already lost once. So: everything with money
// still on it counts, except the two states that provably are not debts.
// ────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';
import { inr } from './receivables';

export { inr };

/**
 * Not a debt, whatever the balance says:
 *  - `draft` has not been accepted — nobody has agreed to pay it.
 *  - `void` is cancelled.
 * Everything else with balance > 0 is money we owe: `open`, `overdue`,
 * `partially_paid`, and any status Zoho adds later.
 */
const NOT_OWED_STATUSES = ['draft', 'void'];

/**
 * THE definition of "this bill is money we owe". One definition, imported
 * everywhere — the Finance overview, the Zoho page and this module must never
 * be able to disagree about the payables figure. Same reason isSettled() lives
 * alone in lib/zoho-api.ts.
 */
export function isOwedBill(status: unknown): boolean {
  return !NOT_OWED_STATUSES.includes(String(status ?? '').toLowerCase());
}

export interface VendorDebt {
  vendor: string;
  bills: number;
  owed: number;
  /** Days past the OLDEST due date for this vendor. Negative = not due yet. */
  daysOverdue: number;
  /** True when at least one bill is genuinely past its due date. */
  isOverdue: boolean;
}

export interface Payables {
  byVendor: VendorDebt[];
  totalOwed: number;
  billCount: number;
  vendorCount: number;
  /** Owed on bills already past their due date. */
  overdueOwed: number;
  /** Owed on bills received but not yet due. */
  notYetDueOwed: number;
  /** When Zoho last pushed us anything. Null means the sync has never run. */
  lastSyncedAt: Date | null;
  /** Whole days since the last sync — the honesty check on every figure above. */
  syncAgeDays: number | null;
}

interface BillRow {
  customer_name: string | null;
  balance: number | null;
  due_date: string | null;
  status: string | null;
  last_synced_at: string | null;
}

const DAY_MS = 86_400_000;

/**
 * Every rupee we owe vendors, grouped by vendor, biggest first.
 *
 * Throws rather than returning an empty snapshot: an empty payables list
 * renders as "we owe nobody", which is the most expensive thing this system
 * could tell anyone the week before a payment run.
 */
export async function getPayables(supabase: SupabaseClient): Promise<Payables> {
  const { data, error } = await supabase
    .from('zoho_documents')
    // customer_name holds the vendor for a bill — the column means "the other
    // side of the document", not "a customer". See the sync routes.
    .select('customer_name, balance, due_date, status, last_synced_at')
    .eq('doc_type', 'bill')
    .gt('balance', 0);

  if (error) throw new Error(`payables query failed: ${error.message}`);

  const rows = ((data || []) as BillRow[]).filter((r) => isOwedBill(r.status));

  const groups = new Map<
    string,
    { owed: number; bills: number; oldestDue: number | null; anyOverdue: boolean }
  >();
  let overdueOwed = 0;
  let notYetDueOwed = 0;
  let lastSync: number | null = null;

  for (const r of rows) {
    const owed = Number(r.balance) || 0;
    if (owed <= 0) continue;

    const name = (r.customer_name || '').trim() || 'Unknown vendor';
    const g = groups.get(name) || {
      owed: 0,
      bills: 0,
      oldestDue: null as number | null,
      anyOverdue: false,
    };
    g.owed += owed;
    g.bills += 1;

    if (r.due_date) {
      const due = new Date(r.due_date).getTime();
      if (!Number.isNaN(due)) {
        if (g.oldestDue === null || due < g.oldestDue) g.oldestDue = due;
        if (due < Date.now()) {
          g.anyOverdue = true;
          overdueOwed += owed;
        } else {
          notYetDueOwed += owed;
        }
      }
    } else {
      // No due date recorded — owed, but not provably overdue.
      notYetDueOwed += owed;
    }
    groups.set(name, g);

    const synced = r.last_synced_at ? new Date(r.last_synced_at).getTime() : null;
    if (synced && !Number.isNaN(synced) && (lastSync === null || synced > lastSync)) lastSync = synced;
  }

  const byVendor: VendorDebt[] = Array.from(groups.entries())
    .map(([vendor, g]) => ({
      vendor,
      bills: g.bills,
      owed: g.owed,
      daysOverdue: g.oldestDue === null ? 0 : Math.floor((Date.now() - g.oldestDue) / DAY_MS),
      isOverdue: g.anyOverdue,
    }))
    // Biggest first, with age alongside, so an old small bill stays visible
    // rather than being sorted out of sight.
    .sort((a, b) => b.owed - a.owed);

  return {
    byVendor,
    totalOwed: byVendor.reduce((s, v) => s + v.owed, 0),
    billCount: rows.length,
    vendorCount: byVendor.length,
    overdueOwed,
    notYetDueOwed,
    lastSyncedAt: lastSync ? new Date(lastSync) : null,
    syncAgeDays: lastSync ? Math.floor((Date.now() - lastSync) / DAY_MS) : null,
  };
}

/** 🔴 over 60 days · 🟠 over 30 · 🟡 overdue at all · 🟢 not yet due. */
export function billIcon(v: VendorDebt): string {
  if (!v.isOverdue) return '🟢';
  if (v.daysOverdue > 60) return '🔴';
  if (v.daysOverdue > 30) return '🟠';
  return '🟡';
}

/**
 * Ageing buckets, the way an accountant reads payables. Anything not yet due
 * sits in `current`; the rest is counted from the oldest unpaid due date.
 */
export function ageingBuckets(p: Payables): { label: string; owed: number; vendors: number }[] {
  const buckets = [
    { label: 'Not yet due', owed: 0, vendors: 0, test: (v: VendorDebt) => !v.isOverdue },
    { label: '1–30 days', owed: 0, vendors: 0, test: (v: VendorDebt) => v.isOverdue && v.daysOverdue <= 30 },
    { label: '31–60 days', owed: 0, vendors: 0, test: (v: VendorDebt) => v.daysOverdue > 30 && v.daysOverdue <= 60 },
    { label: '61–90 days', owed: 0, vendors: 0, test: (v: VendorDebt) => v.daysOverdue > 60 && v.daysOverdue <= 90 },
    { label: '90+ days', owed: 0, vendors: 0, test: (v: VendorDebt) => v.daysOverdue > 90 },
  ];
  for (const v of p.byVendor) {
    const b = buckets.find((x) => x.test(v));
    if (!b) continue;
    b.owed += v.owed;
    b.vendors += 1;
  }
  return buckets.map(({ label, owed, vendors }) => ({ label, owed, vendors }));
}

/**
 * The money-out block for a brief. Names vendors, not bills, and says out loud
 * when the Zoho sync has gone stale rather than presenting old figures as
 * today's position.
 */
export function buildPayablesBlock(
  p: Payables,
  opts: { limit?: number; escape?: (s: string) => string; moreUrl?: string } = {},
): string | null {
  if (!p.byVendor.length) return null;

  const limit = opts.limit ?? 5;
  const esc = opts.escape ?? ((s: string) => s);
  const shown = p.byVendor.slice(0, limit);
  const rest = p.byVendor.slice(limit);

  const lines = shown.map((v) => {
    const age = v.isOverdue ? `${v.daysOverdue}d` : 'not due';
    return `${billIcon(v)} <b>${esc(v.vendor)}</b> — <b>${inr(v.owed)}</b> · ${v.bills} bill${v.bills !== 1 ? 's' : ''} · ${age}`;
  });

  if (rest.length) {
    const restOwed = rest.reduce((s, v) => s + v.owed, 0);
    const tail = `   ${rest.length} more vendor${rest.length !== 1 ? 's' : ''} · ${inr(restOwed)}`;
    lines.push(opts.moreUrl ? `<a href="${opts.moreUrl}">${tail} →</a>` : tail);
  }

  const stale =
    p.syncAgeDays !== null && p.syncAgeDays >= 2
      ? `\n⚠️ Zoho last synced ${p.syncAgeDays} days ago — these figures may be out of date.`
      : '';

  return (
    `🧾 <b>Money we owe</b> — <b>${inr(p.totalOwed)}</b> · ${p.vendorCount} vendors\n` +
    `   ${inr(p.overdueOwed)} overdue · ${inr(p.notYetDueOwed)} not yet due\n\n` +
    lines.join('\n') + stale
  );
}
