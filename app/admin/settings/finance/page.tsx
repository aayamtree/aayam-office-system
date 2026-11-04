'use client';

/** Finance settings: closing date, payment terms, invoice defaults, fiscal year, backup. */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Lock, Plus, Trash2, Download } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import {
    DEFAULT_FINANCE_SETTINGS, FinanceSettings, loadFinanceSettings, saveFinanceSettings,
} from '@/lib/finance-settings';
import { logFinance } from '@/lib/finance-log';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BACKUP_TABLES = [
    'chart_of_accounts', 'journal_entries', 'journal_entry_lines', 'bank_accounts', 'bank_transactions',
    'invoices', 'payments_received', 'purchase_bills', 'vendor_payments', 'vendors', 'clients', 'app_settings',
];

const Card = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className="rounded-md border border-border bg-card p-4 space-y-3">
        <div>
            <h2 className="font-semibold text-sm">{title}</h2>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {children}
    </section>
);

function FinanceSettingsInner() {
    const [saved, setSaved] = useState<FinanceSettings>(DEFAULT_FINANCE_SETTINGS);
    const [s, setS] = useState<FinanceSettings>(DEFAULT_FINANCE_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [backingUp, setBackingUp] = useState(false);

    useEffect(() => {
        (async () => {
            const [cfg, { data: { user } }] = await Promise.all([loadFinanceSettings(), supabase.auth.getUser()]);
            setSaved(cfg); setS(cfg);
            if (user) {
                const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                setIsAdmin(p?.role === 'admin');
            }
            setLoading(false);
        })();
    }, []);

    const dirty = JSON.stringify(s) !== JSON.stringify(saved);

    const save = async (next: FinanceSettings, note?: string) => {
        setSaving(true);
        const err = await saveFinanceSettings(next, saved, note);
        setSaving(false);
        if (err) { toast.error(`Not saved: ${err}`); return; }
        setSaved(next); setS(next);
        toast.success('Finance settings saved');
    };

    const reopen = async () => {
        if (!saved.closingDate) return;
        await save({ ...s, closingDate: null }, `Books reopened (were closed up to ${saved.closingDate})`);
        await logFinance({
            action: 'warning', category: 'setting', entityType: 'finance_settings', entityLabel: 'Books reopened',
            note: `Closing date ${saved.closingDate} was removed. Past periods can be changed again.`,
        });
    };

    const backup = async () => {
        setBackingUp(true);
        try {
            const out: Record<string, unknown[]> = {};
            for (const t of BACKUP_TABLES) {
                const rows: unknown[] = [];
                for (let from = 0; ; from += 1000) {
                    const { data, error } = await supabase.from(t).select('*').range(from, from + 999);
                    if (error) { out[t] = [{ error: error.message }]; break; }
                    rows.push(...(data || []));
                    if (!data || data.length < 1000) break;
                }
                if (!out[t]) out[t] = rows;
            }
            const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), tables: out }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `aayam-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click(); URL.revokeObjectURL(a.href);
            toast.success('Backup downloaded');
        } finally { setBackingUp(false); }
    };

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>;
    const lock = !isAdmin;
    const inputCls = 'rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-60';

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-bold">Finance settings</h1>
                <p className="text-xs text-muted-foreground">
                    Every change here is written to the <Link href="/admin/finance/log" className="underline">Finance log</Link>.
                </p>
                {lock && <p className="mt-2 text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-800 p-2 flex gap-1.5"><Lock size={13} className="mt-0.5" /> Only an admin can change these settings.</p>}
            </div>

            <Card title="Closing date" hint="Nothing on or before this date can be added, changed or deleted. Leave empty to keep the books open.">
                <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" disabled={lock} value={s.closingDate || ''} className={inputCls}
                        onChange={e => setS({ ...s, closingDate: e.target.value || null })} />
                    {saved.closingDate && !lock && (
                        <button onClick={reopen} disabled={saving} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">
                            Reopen the books
                        </button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    {saved.closingDate ? `Books are closed up to ${saved.closingDate}.` : 'Books are open. Nothing is blocked.'} Screens start obeying this date as each build step reaches them.
                </p>
            </Card>

            <Card title="Payment terms" hint="Used by invoices, customers and bills. Days are counted from the document date.">
                <div className="space-y-2">
                    {s.paymentTerms.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-2">
                            <input disabled={lock} value={t.name} className={`${inputCls} flex-1`}
                                onChange={e => setS({ ...s, paymentTerms: s.paymentTerms.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                            <input disabled={lock} type="number" min={0} value={t.days} className={`${inputCls} w-20`}
                                onChange={e => setS({ ...s, paymentTerms: s.paymentTerms.map((x, j) => j === i ? { ...x, days: Math.max(0, parseInt(e.target.value || '0', 10)) } : x) })} />
                            <span className="text-xs text-muted-foreground">days</span>
                            {!lock && <button onClick={() => setS({ ...s, paymentTerms: s.paymentTerms.filter((_, j) => j !== i) })} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>}
                        </div>
                    ))}
                    {!lock && <button onClick={() => setS({ ...s, paymentTerms: [...s.paymentTerms, { id: `term-${Date.now()}`, name: 'New term', days: 30 }] })}
                        className="text-sm flex items-center gap-1 text-primary"><Plus size={14} /> Add a term</button>}
                </div>
            </Card>

            <Card title="Invoice defaults">
                <label className="block text-xs text-muted-foreground">Default message printed on every invoice</label>
                <textarea disabled={lock} rows={3} value={s.invoiceMessage} className={`${inputCls} w-full`}
                    onChange={e => setS({ ...s, invoiceMessage: e.target.value })} />
                <label className="block text-xs text-muted-foreground">First invoice number (leave empty to continue as now)</label>
                <input disabled={lock} type="number" min={1} value={s.firstInvoiceNumber ?? ''} className={`${inputCls} w-40`}
                    onChange={e => setS({ ...s, firstInvoiceNumber: e.target.value ? parseInt(e.target.value, 10) : null })} />
            </Card>

            <Card title="Fiscal year and method" hint="Reports and date presets will read these. India: financial year starts in April.">
                <div className="flex gap-3 flex-wrap items-center">
                    <label className="text-sm">Year starts in
                        <select disabled={lock} value={s.fiscalStartMonth} className={`${inputCls} ml-2`}
                            onChange={e => setS({ ...s, fiscalStartMonth: parseInt(e.target.value, 10) })}>
                            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                    </label>
                    <label className="text-sm">Default method
                        <select disabled={lock} value={s.accountingMethod} className={`${inputCls} ml-2`}
                            onChange={e => setS({ ...s, accountingMethod: e.target.value as 'accrual' | 'cash' })}>
                            <option value="accrual">Accrual</option>
                            <option value="cash">Cash</option>
                        </select>
                    </label>
                </div>
            </Card>

            {!lock && (
                <div className="flex gap-2 sticky bottom-3">
                    <button onClick={() => save(s)} disabled={!dirty || saving}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save settings'}
                    </button>
                    {dirty && <button onClick={() => setS(saved)} className="px-4 py-2 rounded-md border border-border text-sm">Undo changes</button>}
                </div>
            )}

            <Card title="Finance backup" hint="Downloads your finance tables as one file you can keep. Nothing is changed.">
                <button onClick={backup} disabled={backingUp} className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-muted">
                    {backingUp ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download backup
                </button>
            </Card>

            <p className="text-[11px] text-muted-foreground">
                Accounting logic in the finance upgrades is adapted from Puter Accounting (MIT). See <code>THIRD_PARTY_CREDITS.md</code>.
            </p>
        </div>
    );
}

export default function FinanceSettingsPage() {
    return (
        <AdminOnlyGate>
            <FinanceSettingsInner />
        </AdminOnlyGate>
    );
}
