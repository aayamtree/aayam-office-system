'use client';

// ═══════════════════════════════════════════════════════════════════════════
// THE OFFICE CASH BOOK — deposits, withdrawals, and moving money between our
// own accounts.
// ═══════════════════════════════════════════════════════════════════════════
//
// This is NOT the abandoned ledger, and it is deliberately not guarded by
// LEGACY_LEDGER_CLOSED. The September closure was about screens that write
// invoices, bills, payments and journal entries — three of which recorded the
// same real payment with different side effects, which is how one payment gets
// counted twice. record_account_transfer touches none of those tables: it
// writes one row in account_transfers and moves current_balance on the two
// accounts involved.
//
// Satish, 2026-09-09: "apart from zoho this feature is for our office internal
// cash and bank transaction such as cash deposit and withdraw." Only one
// account is in Zoho; the savings accounts and the cash box live here alone,
// and this app is the only place their balance can be kept.
//
// One form serves both the Accounts page and the Banks page. A second copy is
// how the two screens start disagreeing about what a transfer does.

import React, { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { ArrowLeftRight, ChevronDown, ArrowRight } from 'lucide-react';
import { useBankAccounts, useCashAccounts } from '@/lib/hooks';

export const TRANSFER_TYPES = [
    { key: 'bank_to_bank',   label: 'Bank to Bank Transfer',  from: 'bank', to: 'bank'  },
    { key: 'cash_to_cash',   label: 'Cash to Cash Transfer',  from: 'cash', to: 'cash'  },
    { key: 'adjust_balance', label: 'Adjust Balance',         from: 'any',  to: null    },
];

/**
 * The dropdown itself. `types` narrows the list — the Banks page shows the four
 * that involve a bank; the Accounts page shows all five.
 */
export function TransferMenu({
    types,
    label = 'Deposit / Withdraw',
    onDone,
}: {
    types?: string[];
    label?: string;
    onDone?: () => void;
}) {
    const { bankAccounts, refresh: refreshBanks } = useBankAccounts();
    const { cashAccounts, refresh: refreshCash } = useCashAccounts();

    const [open, setOpen] = useState(false);
    const [transferType, setTransferType] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const items = types
        ? TRANSFER_TYPES.filter(t => types.includes(t.key))
        : TRANSFER_TYPES;

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSuccess = () => {
        setTransferType(null);
        refreshBanks();
        refreshCash();
        onDone?.();
    };

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setOpen(v => !v)}
                    className="flex items-center gap-2 px-3 py-2 bg-white border rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                    <ArrowLeftRight className="w-4 h-4" />
                    {label}
                    <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                    <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1">
                        {items.map((t, i) => (
                            <React.Fragment key={t.key}>
                                {t.key === 'adjust_balance' && i > 0 && (
                                    <div className="my-1 border-t border-gray-100" />
                                )}
                                <button
                                    onClick={() => { setTransferType(t.key); setOpen(false); }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    {t.label}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </div>

            {transferType && (
                <TransferModal
                    transferType={transferType}
                    bankAccounts={bankAccounts}
                    cashAccounts={cashAccounts}
                    onClose={() => setTransferType(null)}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
}

export function TransferModal({
    transferType,
    bankAccounts,
    cashAccounts,
    onClose,
    onSuccess,
}: {
    transferType: string;
    bankAccounts: any[];
    cashAccounts: any[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const typeConfig = TRANSFER_TYPES.find(t => t.key === transferType)!;
    const isAdjust  = transferType === 'adjust_balance';

    const fromAccounts = typeConfig.from === 'bank' ? bankAccounts
                       : typeConfig.from === 'cash' ? cashAccounts
                       : [...bankAccounts.map(a => ({ ...a, _type: 'bank' })), ...cashAccounts.map(a => ({ ...a, _type: 'cash' }))];

    const toAccounts   = typeConfig.to === 'bank' ? bankAccounts
                       : typeConfig.to === 'cash' ? cashAccounts
                       : [];

    const [formData, setFormData] = useState({
        from_account_id:   fromAccounts[0]?.id || '',
        from_account_type: typeConfig.from === 'any' ? (fromAccounts[0]?._type || (bankAccounts.length > 0 ? 'bank' : 'cash')) : typeConfig.from,
        to_account_id:     toAccounts[0]?.id || '',
        amount:            '',
        adjust_direction:  '+',
        transfer_date:     new Date().toISOString().split('T')[0],
        notes:             '',
    });
    const [saving, setSaving] = useState(false);

    const handleFromChange = (id: string) => {
        if (isAdjust) {
            const isBankAcc = bankAccounts.some(a => a.id === id);
            setFormData(p => ({ ...p, from_account_id: id, from_account_type: isBankAcc ? 'bank' : 'cash' }));
        } else {
            setFormData(p => ({ ...p, from_account_id: id }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(formData.amount);
        if (!amt || amt <= 0) { toast.error('Please enter a valid amount'); return; }
        if (!formData.from_account_id) { toast.error('Please select an account'); return; }
        if (!isAdjust && !formData.to_account_id) { toast.error('Please select a destination account'); return; }
        if (!isAdjust && formData.from_account_id === formData.to_account_id) { toast.error('Source and destination must be different'); return; }

        setSaving(true);
        try {
            const { supabase } = await import('@/lib/supabase');
            const finalAmount = isAdjust
                ? (formData.adjust_direction === '+' ? amt : -amt)
                : amt;

            const { error } = await supabase.rpc('record_account_transfer', {
                p_transfer_type:      transferType,
                p_from_account_type:  formData.from_account_type,
                p_from_account_id:    formData.from_account_id,
                p_to_account_type:    isAdjust ? null : typeConfig.to,
                p_to_account_id:      isAdjust ? null : formData.to_account_id,
                p_amount:             finalAmount,
                p_transfer_date:      formData.transfer_date,
                p_notes:              formData.notes || null,
            });

            if (error) throw error;

            toast.success(isAdjust ? 'Balance adjusted successfully!' : 'Transfer recorded successfully!');
            onSuccess();
        } catch (err: any) {
            toast.error('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const accLabel = (acc: any) => `${acc.name} — ₹${(acc.current_balance || 0).toLocaleString('en-IN')}`;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-md w-full max-w-md shadow-xl">
                <div className="p-5 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-page-title">{typeConfig.label}</h2>
                        {!isAdjust && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                Deducted from source • Added to destination • No P&amp;L impact
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800 text-xl leading-none">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {isAdjust ? 'Account to Adjust' : 'From Account'}
                        </label>
                        <select
                            value={formData.from_account_id}
                            onChange={e => handleFromChange(e.target.value)}
                            className="w-full px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                            required
                        >
                            <option value="">Select account</option>
                            {isAdjust ? (
                                <>
                                    {bankAccounts.length > 0 && <optgroup label="Bank Accounts">
                                        {bankAccounts.map(a => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
                                    </optgroup>}
                                    {cashAccounts.length > 0 && <optgroup label="Cash Accounts">
                                        {cashAccounts.map(a => <option key={a.id} value={a.id}>{accLabel(a)}</option>)}
                                    </optgroup>}
                                </>
                            ) : (
                                fromAccounts.map((a: any) => <option key={a.id} value={a.id}>{accLabel(a)}</option>)
                            )}
                        </select>
                    </div>

                    {!isAdjust && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Account</label>
                            <select
                                value={formData.to_account_id}
                                onChange={e => setFormData(p => ({ ...p, to_account_id: e.target.value }))}
                                className="w-full px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                                required
                            >
                                <option value="">Select account</option>
                                {toAccounts
                                    .filter((a: any) => a.id !== formData.from_account_id)
                                    .map((a: any) => <option key={a.id} value={a.id}>{accLabel(a)}</option>)
                                }
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                        <div className="flex gap-2">
                            {isAdjust && (
                                <div className="flex rounded-md border overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, adjust_direction: '+' }))}
                                        className={`px-3 py-2 text-sm font-bold transition-colors ${formData.adjust_direction === '+' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                    >+</button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, adjust_direction: '-' }))}
                                        className={`px-3 py-2 text-sm font-bold transition-colors ${formData.adjust_direction === '-' ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                    >−</button>
                                </div>
                            )}
                            <input
                                type="number"
                                value={formData.amount || ''}
                                onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                                placeholder="0.00"
                                min="0.01"
                                step="0.01"
                                className="flex-1 px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                                required
                            />
                        </div>
                        {isAdjust && (
                            <p className="text-xs text-gray-500 mt-1">
                                {formData.adjust_direction === '+' ? '+ adds to balance' : '− deducts from balance'}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                            type="date"
                            value={formData.transfer_date}
                            onChange={e => setFormData(p => ({ ...p, transfer_date: e.target.value }))}
                            className="w-full px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                        <input
                            type="text"
                            value={formData.notes}
                            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                            placeholder={isAdjust ? 'e.g., Monthly reconciliation' : 'e.g., Cash for office expenses'}
                            className="w-full px-3 py-2.5 border rounded-md text-sm focus:ring-2 focus:ring-gray-400"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border rounded-md hover:bg-gray-50 text-sm font-medium">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 text-sm font-medium"
                        >
                            {saving ? 'Processing...' : isAdjust ? 'Adjust Balance' : 'Record Transfer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * What was entered here, so a wrong entry can be seen. A cash book with no
 * visible history is a set of balances nobody can check — and these balances
 * are typed by hand, which is exactly when a record matters.
 *
 * `reloadKey` changes after a save, which re-runs the read.
 */
export function RecentTransfers({ reloadKey = 0, limit = 8 }: { reloadKey?: number; limit?: number }) {
    const { bankAccounts } = useBankAccounts();
    const { cashAccounts } = useCashAccounts();
    const [rows, setRows] = useState<any[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await supabase
                .from('account_transfers')
                .select('*')
                .order('transfer_date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(limit);
            if (cancelled) return;
            if (error) { setError(error.message); setRows(null); }
            else { setError(null); setRows(data || []); }
        })();
        return () => { cancelled = true; };
    }, [reloadKey, limit]);

    const nameOf = (type: string | null, id: string | null) => {
        if (!id) return '—';
        const list = type === 'cash' ? cashAccounts : bankAccounts;
        return list.find((a: any) => a.id === id)?.name || 'account no longer listed';
    };

    const day = (d: string | null) =>
        !d ? 'no date' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

    const rupees = (n: number) => '₹' + Math.abs(Math.round(n || 0)).toLocaleString('en-IN');

    return (
        <div className="bg-white rounded-md border border-gray-200">
            <div className="px-5 py-3 border-b flex items-center justify-between">
                <div>
                    <h2 className="text-section text-gray-900">Recent deposits, withdrawals and adjustments</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Entered by hand in this app — our own cash book, not Zoho.
                    </p>
                </div>
            </div>

            {error ? (
                <p className="px-5 py-4 text-xs text-red-700">
                    Could not read the transfer history ({error}). Nothing is listed below — not because
                    there is nothing there, but because the data did not arrive.
                </p>
            ) : rows === null ? (
                <p className="px-5 py-4 text-xs text-gray-500">Loading…</p>
            ) : rows.length === 0 ? (
                <p className="px-5 py-4 text-xs text-gray-500">Nothing recorded yet.</p>
            ) : (
                <ul className="divide-y">
                    {rows.map(r => {
                        const isAdjust = r.transfer_type === 'adjust_balance';
                        const negative = isAdjust && Number(r.amount) < 0;
                        return (
                            <li key={r.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs text-gray-500 tabular-nums w-20 shrink-0">{day(r.transfer_date)}</span>
                                    <span className="truncate">
                                        {isAdjust ? (
                                            <>Adjusted <b className="font-medium">{nameOf(r.from_account_type, r.from_account_id)}</b></>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5">
                                                {nameOf(r.from_account_type, r.from_account_id)}
                                                <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                                                {nameOf(r.to_account_type, r.to_account_id)}
                                            </span>
                                        )}
                                        {r.notes ? <span className="text-gray-500"> · {r.notes}</span> : null}
                                    </span>
                                </span>
                                <span className={`tabular-nums font-medium shrink-0 ${negative ? 'text-red-600' : 'text-gray-900'}`}>
                                    {negative ? '−' : isAdjust ? '+' : ''}{rupees(Number(r.amount))}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
