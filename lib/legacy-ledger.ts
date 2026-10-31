// ═══════════════════════════════════════════════════════════════════════════
// THE OLD LEDGER IS CLOSED FOR WRITING
// ═══════════════════════════════════════════════════════════════════════════
//
// Zoho is the book of record (Satish, 2026-09-01). The app's own double-entry
// ledger — invoices, purchase_bills, vendor_payments, payments_received,
// journal_entries, bank_transactions — was last written on 5 August 2026 and
// is not coming back.
//
// WHY THIS IS A GUARD AND NOT JUST A HIDDEN BUTTON
//
// Three separate screens wrote into that ledger with DIFFERENT side effects:
//   · Quick Expense       → fn_record_expense   (payment + journal + balances)
//   · Banking categorise  → delete-and-reinsert keyed on 'BT:<id>'
//   · Payments            → record_vendor_payment (payment + balances, no journal)
// Any two of them used on the same real payment produce a double count. Hiding
// buttons removes the invitation; it does not remove the path. A deep link, a
// bookmark, a cached page or a missed button all still reach the handler. So
// every write handler asks here first, and gets one refusal with one wording.
//
// Nothing is deleted and nothing is read-only-forever: the July data stays
// readable, and flipping CLOSED to false restores every path exactly as it was.

import { toast } from '@/lib/toast';

/** Flip to false to reopen every legacy write path at once. */
export const LEGACY_LEDGER_CLOSED = false;

// ── 31 Oct 2026: CUT-OVER BACK TO THIS APP ─────────────────────────────────
// Zoho's bank feed is broken, so from 2026-10-31 every entry (bank, expense,
// payment, invoice) is made manually in this app, which is the book of record
// again. LEGACY_LEDGER_CLOSED is therefore false, and ALL Zoho pulls are off so
// nothing can be counted twice. Do not set ZOHO_SYNC_ENABLED back to true
// without first closing the manual paths above.
export const ZOHO_SYNC_ENABLED = false;
export const ZOHO_SYNC_OFF_REASON = 'Zoho sync was switched off on 31 Oct 2026; entries are made manually in this app.';

export const LEGACY_LEDGER_STOPPED = 'August 2026';

/**
 * Call at the top of any handler that would write to the old ledger.
 * Returns true when the write must not proceed — so the caller returns.
 *
 *   if (refuseLegacyWrite('Recording an expense')) return;
 */
export function refuseLegacyWrite(action: string): boolean {
    if (!LEGACY_LEDGER_CLOSED) return false;
    toast.error(
        `${action} is no longer saved here. Zoho Books is where the accounts live now — ` +
        `enter it there and it will appear in this app automatically.`
    );
    return true;
}

/**
 * Same refusal, shaped for hooks whose callers destructure `{ error }`.
 *
 * Deliberately does NOT toast, and returns a STRING not an Error: both callers
 * already toast the error themselves. Toasting here produced two toasts, the
 * second reading "Error: Error: ...", and every other branch of those hooks
 * returns `string | null`.
 */
export function refuseLegacyWriteAsError(action: string): { error: string } | null {
    if (!LEGACY_LEDGER_CLOSED) return null;
    return {
        error: `${action} is no longer saved here. Zoho Books is where the accounts live now — ` +
               `enter it there and it will appear in this app automatically.`,
    };
}
