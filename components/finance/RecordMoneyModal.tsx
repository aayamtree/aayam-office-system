'use client';

// ═══════════════════════════════════════════════════════════════════════════
// RECORD A RECEIPT — the smallest form that closes the cash gap
// ═══════════════════════════════════════════════════════════════════════════
//
// The dashboard said "Cash & UPI not written up — 61 days" and it was right:
// the Banks page could move money BETWEEN our own accounts and nothing else,
// so "Ramesh paid 5,000 by UPI" had nowhere to go and the balances drifted
// back to July.
//
// Six fields, and only two of them are compulsory. Every extra field on a form
// like this is a reason not to open it, and a receipt nobody records is worth
// less than one recorded without a note.
//
// The two writes and the reasoning behind them live in the route
// (app/api/money/record/route.ts). This file only asks the questions.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { todayIST, earliestEntryDate } from '@/lib/ist-date';

interface AccountOption {
    id: string;
    label: string;
    kind: 'cash' | 'bank';
    balance: number;
}

/** Whole rupees when it is whole, paise when there are paise. */
const inr = (n: number) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR',
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(n);

export default function RecordMoneyModal({
    open, onClose, onSaved,
}: {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
}) {
    const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [direction, setDirection] = useState<'in' | 'out'>('in');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(todayIST());
    const [accountKey, setAccountKey] = useState('');
    const [counterparty, setCounterparty] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    // One id per attempt. Re-sent unchanged on a retry, so a dropped response
    // cannot turn one payment into two — the database refuses the second
    // insert and the route reports it as already done.
    const [requestId, setRequestId] = useState('');
    // `disabled` and `saving` are rendered state; two clicks dispatched before
    // React commits would both read the old value. A ref is checked and set in
    // the same tick, so only the first gets through.
    const inFlight = useRef(false);

    // ── which accounts may be recorded against ─────────────────────────────
    // Zoho's bank feed already carries the HDFC account, so it is excluded:
    // recording it here as well would count the same payment twice. The route
    // refuses it too — this only keeps it out of sight.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        (async () => {
            setLoadError(null);
            const [cashRes, bankRes] = await Promise.all([
                supabase.from('cash_accounts')
                    .select('id, name, current_balance, fed_by_zoho').eq('is_active', true),
                supabase.from('bank_accounts')
                    .select('id, name, current_balance, fed_by_zoho').eq('is_active', true),
            ]);
            if (cancelled) return;

            if (cashRes.error || bankRes.error) {
                setLoadError('Could not load your accounts. Reload and try again.');
                setAccounts([]);
                return;
            }

            const cash: AccountOption[] = (cashRes.data || [])
                .filter(a => !a.fed_by_zoho)
                .map(a => ({
                    id: a.id as string,
                    label: ((a.name as string) || 'Cash').trim(),
                    kind: 'cash' as const,
                    balance: Number(a.current_balance) || 0,
                }));
            const bank: AccountOption[] = (bankRes.data || [])
                .filter(a => !a.fed_by_zoho)
                .map(a => ({
                    id: a.id as string,
                    label: ((a.name as string) || 'Account').trim(),
                    kind: 'bank',
                    balance: Number(a.current_balance) || 0,
                }));

            // Busiest account first, so the common case is one tap. There are
            // two cash accounts and one of them has never been used.
            const all = [...cash, ...bank].sort((a, b) => b.balance - a.balance);
            setAccounts(all);
            // Keep the last choice, but only if it is still offered. A
            // remembered account that has since been closed or flagged as
            // Zoho-fed would otherwise leave Record greyed out with nothing on
            // screen saying why.
            setAccountKey(k => {
                const stillThere = all.some(a => `${a.kind}:${a.id}` === k);
                return stillThere ? k : (all[0] ? `${all[0].kind}:${all[0].id}` : '');
            });
        })();

        return () => { cancelled = true; };
    }, [open]);

    // Reset between uses, so yesterday's note never rides along with today's
    // receipt. The account choice is kept — it is usually the same one.
    useEffect(() => {
        if (open) return;
        setAmount(''); setCounterparty(''); setNote('');
        setDate(todayIST()); setDirection('in'); setRequestId('');
    }, [open]);

    // Escape closes, and the browser keeps its scroll where it was.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, saving, onClose]);

    if (!open) return null;

    const selected = accounts?.find(a => `${a.kind}:${a.id}` === accountKey);
    const amountValue = Number(amount);
    const amountOk = Number.isFinite(amountValue) && amountValue > 0;
    const canSave = amountOk && Boolean(selected) && !saving;

    const save = async () => {
        if (!canSave || !selected || inFlight.current) return;
        inFlight.current = true;
        // Made once and kept: pressing Record again after a failure re-sends the
        // SAME id, which is the whole point.
        const id = requestId || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
        if (!requestId) setRequestId(id);
        setSaving(true);
        try {
            const res = await fetch('/api/money/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    direction,
                    amount: amountValue,
                    date,
                    cashAccountId: selected.kind === 'cash' ? selected.id : null,
                    bankAccountId: selected.kind === 'bank' ? selected.id : null,
                    counterparty,
                    method: selected.kind === 'cash' ? 'cash' : 'upi',
                    note,
                    requestId: id,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                // 409 means this attempt was already saved with DIFFERENT
                // figures. A new id would write a second payment, so the id is
                // deliberately kept and the message explains what is stored.
                throw new Error(json.error || 'Could not record it.');
            }

            // The money IS recorded in both of these cases. A red toast here is
            // what makes someone enter it a second time.
            if (json.warning) toast.warning(json.warning);
            else if (json.duplicate) toast.success('Already recorded — nothing was entered twice.');
            else toast.success(
                `${direction === 'in' ? 'Received' : 'Paid'} ${inr(amountValue)} — ${selected.label} updated`
            );

            onSaved?.();
            onClose();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not record it.');
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    };

    const isIn = direction === 'in';

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Record cash or UPI"
                className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-xl bg-card shadow-xl sm:rounded-xl"
            >
                {/* header */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 className="text-sm font-semibold">Record cash or UPI</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form
                    id="record-money-form"
                    onSubmit={(e) => { e.preventDefault(); void save(); }}
                    className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                >
                    {/* in / out */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setDirection('in')}
                            className={`flex items-center justify-center gap-1.5 rounded-md border py-2 text-sm font-medium transition-colors ${isIn
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            <ArrowDownLeft className="h-4 w-4" /> Money in
                        </button>
                        <button
                            type="button"
                            onClick={() => setDirection('out')}
                            className={`flex items-center justify-center gap-1.5 rounded-md border py-2 text-sm font-medium transition-colors ${!isIn
                                ? 'border-destructive bg-destructive/10 text-destructive'
                                : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            <ArrowUpRight className="h-4 w-4" /> Money out
                        </button>
                    </div>

                    {/* amount */}
                    <div>
                        <label htmlFor="rm-amount" className="text-xs font-medium text-muted-foreground">Amount</label>
                        <div className="relative mt-1">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₹</span>
                            <input
                                id="rm-amount"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0"
                                autoFocus
                                className="w-full rounded-md border bg-background py-2.5 pl-8 pr-3 text-xl font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    {/* account + date */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label htmlFor="rm-account" className="text-xs font-medium text-muted-foreground">
                                {isIn ? 'Into' : 'From'}
                            </label>
                            <select
                                id="rm-account"
                                value={accountKey}
                                onChange={e => setAccountKey(e.target.value)}
                                disabled={!accounts?.length}
                                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {accounts === null && <option>Loading…</option>}
                                {accounts?.map(a => (
                                    <option key={`${a.kind}:${a.id}`} value={`${a.kind}:${a.id}`}>
                                        {a.label} — {inr(a.balance)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="rm-date" className="text-xs font-medium text-muted-foreground">Date</label>
                            <input
                                id="rm-date"
                                type="date"
                                value={date}
                                min={earliestEntryDate()}
                                max={todayIST()}
                                onChange={e => setDate(e.target.value)}
                                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    {/* who */}
                    <div>
                        <label htmlFor="rm-who" className="text-xs font-medium text-muted-foreground">
                            {isIn ? 'From whom' : 'To whom'} <span className="font-normal">(optional)</span>
                        </label>
                        <input
                            id="rm-who"
                            type="text"
                            value={counterparty}
                            onChange={e => setCounterparty(e.target.value)}
                            placeholder={isIn ? 'Client or person' : 'Vendor or person'}
                            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {/* note */}
                    <div>
                        <label htmlFor="rm-note" className="text-xs font-medium text-muted-foreground">
                            What for <span className="font-normal">(optional)</span>
                        </label>
                        <input
                            id="rm-note"
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="e.g. part payment, petrol, courier"
                            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {loadError && <p className="text-xs text-destructive">{loadError}</p>}

                    {/* Say what saving does, once, where the decision is made. */}
                    <p className="rounded-md bg-muted/60 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                        Updates the balance straight away, and adds a reminder to the finance
                        To&nbsp;Do list until it is entered in Zoho. It does not write to Zoho itself.
                    </p>
                </form>

                {/* actions */}
                <div className="flex justify-end gap-2 border-t bg-muted/30 px-4 py-3">
                    <button
                        onClick={onClose}
                        className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="record-money-form"
                        disabled={!canSave}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
                    >
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {saving ? 'Recording…' : 'Record'}
                    </button>
                </div>
            </div>
        </div>
    );
}
