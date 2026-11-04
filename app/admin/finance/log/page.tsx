'use client';

/**
 * Finance log — who added, edited or DELETED what, with old -> new values.
 * Separate from the whole-app Activity log. Read-only: lines cannot be edited or erased.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, ArrowRight, ScrollText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Row = {
    id: string; created_at: string; user_name: string | null;
    action: 'added' | 'edited' | 'deleted' | 'warning';
    category: 'transaction' | 'contact' | 'account' | 'rule' | 'setting';
    entity_type: string | null; entity_label: string | null;
    changes: { field: string; old: unknown; new: unknown }[] | null;
    snapshot: Record<string, unknown> | null; note: string | null;
};

const TABS: { key: 'all' | Row['category']; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'transaction', label: 'Transactions' },
    { key: 'contact', label: 'Contacts' },
    { key: 'account', label: 'Accounts' },
    { key: 'rule', label: 'Rules' },
];

const BADGE: Record<Row['action'], string> = {
    added: 'bg-green-100 text-green-700',
    edited: 'bg-blue-100 text-blue-700',
    deleted: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-800',
};

const show = (v: unknown) =>
    v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

export default function FinanceLogPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'all' | Row['category']>('all');
    const [q, setQ] = useState('');

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase
                .from('finance_log').select('*').order('created_at', { ascending: false }).limit(1000);
            if (error) setError(error.message);
            else setRows((data || []) as Row[]);
            setLoading(false);
        })();
    }, []);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return rows.filter(r =>
            (tab === 'all' || r.category === tab) &&
            (!needle || [r.user_name, r.entity_label, r.entity_type, r.note, r.action]
                .some(x => (x || '').toLowerCase().includes(needle))));
    }, [rows, tab, q]);

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2"><ScrollText size={20} /> Finance log</h1>
                    <p className="text-xs text-muted-foreground">
                        Every money change: who, what, and old → new. Deleted records stay listed. Lines cannot be edited or erased.
                    </p>
                </div>
                <Link href="/admin/activity" className="text-xs underline text-muted-foreground">Whole-app Activity log</Link>
            </div>

            <div className="flex gap-1 flex-wrap">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-3 py-1.5 rounded-md text-sm border ${tab === t.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by person, record or note"
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-border bg-card" />
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
            ) : error ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Could not read the Finance log: {error}
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    Nothing logged here yet. New finance changes will appear as soon as they are saved.
                </div>
            ) : (
                <div className="rounded-md border border-border bg-card divide-y divide-border">
                    {filtered.map(r => (
                        <div key={r.id} className={`p-3 text-sm ${r.action === 'deleted' ? 'bg-red-50/50' : ''}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${BADGE[r.action]}`}>{r.action}</span>
                                <span className="font-medium">{r.entity_label || r.entity_type || 'Record'}</span>
                                <span className="text-xs text-muted-foreground">
                                    by {r.user_name || 'Unknown'} ·{' '}
                                    {new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {r.note && <p className="text-xs text-muted-foreground mt-1">{r.note}</p>}
                            {r.changes && r.changes.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5 text-xs">
                                    {r.changes.map((c, i) => (
                                        <li key={i} className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-muted-foreground">{c.field}:</span>
                                            <span className="line-through text-red-600/80 break-all">{show(c.old)}</span>
                                            <ArrowRight size={11} className="text-muted-foreground" />
                                            <span className="text-green-700 break-all">{show(c.new)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {r.action === 'deleted' && r.snapshot && (
                                <details className="mt-1.5 text-xs">
                                    <summary className="cursor-pointer text-muted-foreground">What was deleted</summary>
                                    <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto">{JSON.stringify(r.snapshot, null, 2)}</pre>
                                </details>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
