// A screen that reads the ledger nobody has written to since July renders a
// perfectly plausible ₹0 — which looks like a quiet month, not a dead table.
// That is the most dangerous thing a finance screen can do, so every such
// screen says so out loud, above the numbers, rather than being silently wrong.
//
// This is a LABEL, not a fix. The screens themselves are retired in a later
// phase, once the five-door structure is in place.

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function StaleLedgerNotice({
    stoppedOn = 'July 2026',
    insteadHref = '/admin/finance/zoho',
    insteadLabel = 'Zoho Books',
    what = 'These figures',
}: {
    stoppedOn?: string;
    insteadHref?: string;
    insteadLabel?: string;
    what?: string;
}) {
    return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2.5">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
                <p className="font-semibold mb-0.5">{what} stopped updating in {stoppedOn}.</p>
                <p>
                    This screen reads the app&apos;s own ledger, which the team stopped using when
                    Zoho became the book of record. A ₹0 here means <b>no data</b>, not no money.
                    The live figures are in{' '}
                    <Link href={insteadHref} className="underline font-medium">{insteadLabel}</Link>.
                </p>
            </div>
        </div>
    );
}
