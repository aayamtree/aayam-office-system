'use client';

// REPORTS CENTER — closed 2026-09-08, and the reason is worth keeping.
//
// This page used to generate a Client Statement, a Vendor Statement and a Cash
// Flow report. All three are gone. What is left is the explanation, because the
// next person to want a client statement will come looking here.
//
// ── 1. The leak ──────────────────────────────────────────────────────────────
// The client statement filtered payments with:
//     p.client_id === selectedClientId || p.client?.name
// `client_id` was never in the select, so the left side was `undefined === uuid`
// — false for every row — and the right side is true for any payment that has a
// client at all. The filter passed EVERYTHING. Choosing one client rendered all
// 50 payments belonging to 26 DIFFERENT clients (₹25,06,519) onto that client's
// statement, under a working Print button and a working CSV button.
//
// ── 2. Why fixing the filter was not enough ──────────────────────────────────
// With the filter corrected the statement got worse, not better, in the way that
// matters. Its two sides come from different eras:
//     debits  ← `jobs`               LIVE, 248 jobs created since 5 August
//     credits ← `payments_received`  FROZEN, last row 29 July 2026
// So it billed a client for five weeks of new work and credited them with
// nothing they had paid in those five weeks. One real client came out at
// ₹1,03,191 Dr — a printable, e-mailable demand for money that Zoho may well
// show as already settled. The first bug showed a client somebody else's money;
// the second would have sent them an invoice for money they had already paid.
// A live numerator over a dead denominator is not a stale report, it is a wrong
// one, and it does not announce itself.
//
// The vendor tab had the same shape and worse arithmetic: `purchase_bills` holds
// 5 rows and stopped in APRIL while `vendor_payments` holds 145, so every vendor
// balance read as a large Dr — "we have paid this vendor ₹12L in advance".
//
// The cash flow tab defaulted to the current month, where both its sources are
// empty, and rendered ₹0 through its positive-number styling: "+₹0" in the
// good-news card. Identical to what three failed queries produce.
//
// ── 3. What replaces it ──────────────────────────────────────────────────────
// Nothing here, yet. A statement a client can be sent has to come from Zoho —
// their invoices and what actually reached the bank — and that needs each client
// matched to a Zoho contact first (about 35 of 92 match by name today). Until
// that exists, no statement is better than a confident wrong one.
//
// The per-client and per-vendor history pages under /admin/reports/client/[id]
// and /admin/reports/vendor/[id] still list transactions, with their running
// balances suppressed for exactly the reason above.

import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';

const LIVE = [
    { href: '/admin/finance/money-in', label: 'Money In', hint: 'What customers owe us, from Zoho' },
    { href: '/admin/finance/money-out', label: 'Money Out', hint: 'What we owe vendors, from Zoho' },
    { href: '/admin/finance/bank-cash', label: 'Bank', hint: 'What actually moved through the bank' },
    { href: '/admin/finance/reports', label: 'Finance → Reports', hint: 'Cashflow, categories, billed against collected' },
    { href: '/admin/reports/sales', label: 'Sales Report', hint: 'Orders and billing by client, from jobs' },
];

// The Dispatch Report deliberately does NOT appear above. It reads `dispatches`,
// which holds 2 rows, newest 5 August — while 105 jobs have reached dispatched or
// delivered. Listing it under "where the current figures are" would repeat the
// mistake this page exists to explain. It stays on the menu because it is a
// dispatch screen, not a money screen, and the gap there is data, not code.

export default function ReportsPage() {
    return (
        <div className="space-y-4 animate-fade-in pb-16 md:pb-20">
            <div>
                <h1 className="text-page-title text-gray-900">Reports</h1>
                <p className="text-gray-500">Where each figure comes from, and what was withdrawn</p>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-900">
                    The client statement, vendor statement and cash flow report have been taken off this page.
                </p>
                <p className="mt-2 text-sm text-amber-800">
                    They were built on the app&rsquo;s own ledger, which stopped being written on 5 August 2026
                    when Zoho became the book of record. Two faults were found on 8 September. The client
                    statement was showing <strong>every client&rsquo;s payments on every client&rsquo;s
                        statement</strong> &mdash; 50 payments from 26 different clients, ₹25,06,519, on a page
                    with a working Print button.
                </p>
                <p className="mt-2 text-sm text-amber-800">
                    Correcting that made it worse in the way that matters. Billing came from the live jobs
                    table and payments came from the frozen ledger, so a client was billed for five weeks of
                    new work and credited with nothing they had paid in those five weeks. One real client came
                    out at <strong>₹1,03,191 owing</strong> when Zoho may well show them settled. That is not
                    a stale report &mdash; it is a demand for money that could be sent to a customer.
                </p>
                <p className="mt-2 text-sm text-amber-800">
                    A statement you can send has to come from Zoho: their invoices, and what actually reached
                    the bank. That work needs each client matched to a Zoho contact first. Until it exists,
                    no statement is safer than a confident wrong one.
                </p>
            </div>

            <div>
                <h2 className="text-section text-gray-900 mb-2">Where the current figures are</h2>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {LIVE.map(({ href, label, hint }) => (
                        <Link
                            key={href}
                            href={href}
                            className="group flex items-start justify-between gap-2 rounded-md border border-gray-200 bg-white p-3.5 hover:border-gray-400 transition-colors"
                        >
                            <span className="min-w-0">
                                <span className="block font-semibold text-gray-900">{label}</span>
                                <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>
                            </span>
                            <ArrowRight size={15} className="mt-0.5 shrink-0 text-gray-300 group-hover:text-gray-600" />
                        </Link>
                    ))}
                </div>
            </div>

            {/* Nothing was deleted. The history this ledger recorded while it was
                alive is still worth reading, and July still matters. */}
            <div className="rounded-md border border-gray-200 bg-white p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                    <FileText size={15} className="text-gray-400" />
                    <h2 className="font-semibold text-gray-900 text-sm">History, up to 5 August 2026</h2>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                    A true record of what the app&rsquo;s own ledger held while it was being written. Not a
                    current position, and no profit figure is drawn from it.
                </p>
                <ul className="space-y-1 text-sm">
                    <li>
                        <Link href="/admin/reports/finance" className="text-primary underline underline-offset-2">
                            Finance report
                        </Link>
                        <span className="text-gray-500"> — every payment and vendor payment it recorded</span>
                    </li>
                    <li>
                        <Link href="/admin/finance/journal" className="text-primary underline underline-offset-2">
                            Manual journal
                        </Link>
                        <span className="text-gray-500"> — past entries only; adjustments are made in Zoho</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
