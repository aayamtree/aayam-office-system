'use client';

/** One-line ledger check for the Finance page: do total debits equal total credits? */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const inr = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

export default function BalanceCheckStrip() {
    const [state, setState] = useState<{ diff: number; bad: number; debit: number } | 'error' | null>(null);

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.rpc('fn_ledger_balance_check');
            const r = Array.isArray(data) ? data[0] : data;
            if (error || !r) { setState('error'); return; }
            setState({ diff: Number(r.difference), bad: Number(r.unbalanced_entries), debit: Number(r.total_debit) });
        })();
    }, []);

    if (state === null) return null;
    if (state === 'error') {
        return <div className="mx-4 mt-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Ledger check could not be read just now.
        </div>;
    }
    const ok = state.diff === 0 && state.bad === 0;
    return (
        <div className={`mx-4 mt-3 rounded-md border px-3 py-2 text-xs flex items-center gap-2 ${ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {ok
                ? <span><b>Debits equal credits.</b> Ledger total {inr(state.debit)} on each side.</span>
                : <span><b>Out of balance by {inr(Math.abs(state.diff))}</b>{state.bad > 0 ? ` · ${state.bad} journal entr${state.bad === 1 ? 'y' : 'ies'} do not balance` : ''}.</span>}
        </div>
    );
}
