// Sits at the top of every screen that used to write into the app's own ledger.
//
// It says three things, in this order, because that is the order the reader
// needs them: this no longer saves, here is why, here is where to do it now.
// A screen that silently refuses to save is worse than one that never offered.

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { LEGACY_LEDGER_STOPPED } from '@/lib/legacy-ledger';

export default function ReadOnlyLedgerBanner({
    what = 'This screen',
    doItIn = 'Zoho Books',
}: {
    what?: string;
    doItIn?: string;
}) {
    return (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-xs flex gap-2.5">
            <Lock size={15} className="shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-muted-foreground">
                <p className="font-semibold text-foreground mb-0.5">
                    {what} is now read-only.
                </p>
                <p>
                    It writes to the app&apos;s own ledger, which the team stopped using in{' '}
                    {LEGACY_LEDGER_STOPPED} when {doItIn} became the book of record. Keeping both
                    open is how one payment ends up recorded twice. Record it in {doItIn} and it
                    appears here automatically — everything already entered stays visible below.
                </p>
                <p className="mt-1.5">
                    <Link href="/admin/finance/zoho" className="underline font-medium text-foreground">
                        Open Zoho Books in the app
                    </Link>
                </p>
            </div>
        </div>
    );
}
