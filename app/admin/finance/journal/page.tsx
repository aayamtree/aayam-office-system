'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
    BookText, ChevronDown, ChevronRight, Search,
    Plus, X
} from 'lucide-react';
import { refuseLegacyWrite } from '@/lib/legacy-ledger';
import ReadOnlyLedgerBanner from '@/components/finance/ReadOnlyLedgerBanner';

interface JournalEntry {
    id: string;
    entry_number: string;
    entry_date: string;
    description: string;
    source_type: string;
    source_id: string | null;
    is_posted: boolean;
    created_by: string | null;
    created_at: string;
    lines: JournalEntryLine[];
}

interface JournalEntryLine {
    id: string;
    journal_entry_id: string;
    account_id: string;
    debit_amount: number;
    credit_amount: number;
    description: string;
    account?: { id: string; code: string; name: string; account_type: string };
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    bank_transaction: { label: 'Bank Txn', color: 'bg-blue-100 text-blue-700' },
    cash_transaction: { label: 'Cash Txn', color: 'bg-amber-100 text-amber-700' },
    manual: { label: 'Manual', color: 'bg-gray-100 text-gray-700' },
    opening_balance: { label: 'Opening Bal.', color: 'bg-purple-100 text-purple-700' },
    transfer: { label: 'Transfer', color: 'bg-green-100 text-green-700' },
};

export default function JournalPage() {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
    const [showManualEntry, setShowManualEntry] = useState(false);

    // Manual entry form
    const [manualForm, setManualForm] = useState({
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        lines: [
            { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
            { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
        ] as { account_id: string; debit_amount: number; credit_amount: number; description: string }[]
    });
    const [coaAccounts, setCoaAccounts] = useState<{ id: string; code: string; name: string; account_type: string }[]>([]);
    const [savingManual, setSavingManual] = useState(false);

    const fetchEntries = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('journal_entries')
            .select('*, lines:journal_entry_lines(*, account:chart_of_accounts(id, code, name, account_type))')
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) {
            toast.error('Failed to load journal entries');
            console.error(error);
        } else {
            setEntries(data || []);
        }
        setLoading(false);
    };

    const fetchCOA = async () => {
        const { data } = await supabase
            .from('chart_of_accounts')
            .select('id, code, name, account_type')
            .eq('is_active', true)
            .order('code');
        setCoaAccounts(data || []);
    };

    useEffect(() => { fetchEntries(); fetchCOA(); }, []);

    // Filter entries
    const filteredEntries = useMemo(() => {
        let filtered = entries;

        if (sourceFilter !== 'all') {
            filtered = filtered.filter(e => e.source_type === sourceFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                e.entry_number.toLowerCase().includes(q) ||
                (e.description || '').toLowerCase().includes(q) ||
                e.lines?.some(l => l.account?.name?.toLowerCase().includes(q))
            );
        }

        return filtered;
    }, [entries, sourceFilter, searchQuery]);

    const toggleExpand = (id: string) => {
        const next = new Set(expandedEntries);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedEntries(next);
    };

    // Summary stats
    const stats = useMemo(() => {
        const total = entries.length;
        const totalAmount = entries.reduce((sum, e) => {
            const debits = (e.lines || []).reduce((s, l) => s + (l.debit_amount || 0), 0);
            return sum + debits;
        }, 0);
        const autoEntries = entries.filter(e => e.source_type === 'bank_transaction').length;
        const manualEntries = entries.filter(e => e.source_type === 'manual').length;

        return { total, totalAmount, autoEntries, manualEntries };
    }, [entries]);

    // Handle manual journal entry
    const handleAddLine = () => {
        setManualForm(prev => ({
            ...prev,
            lines: [...prev.lines, { account_id: '', debit_amount: 0, credit_amount: 0, description: '' }]
        }));
    };

    const handleRemoveLine = (idx: number) => {
        if (manualForm.lines.length <= 2) return;
        setManualForm(prev => ({
            ...prev,
            lines: prev.lines.filter((_, i) => i !== idx)
        }));
    };

    const handleSubmitManual = async (e: React.FormEvent) => {
        // preventDefault before the guard, and the guard before setSaving —
        // otherwise the page reloads, or the button spins forever.
        e.preventDefault();
        if (refuseLegacyWrite('Posting a manual journal entry')) return;
        setSavingManual(true);

        try {
            const totalDebits = manualForm.lines.reduce((s, l) => s + (l.debit_amount || 0), 0);
            const totalCredits = manualForm.lines.reduce((s, l) => s + (l.credit_amount || 0), 0);

            if (Math.abs(totalDebits - totalCredits) > 0.01) {
                toast.error('Entry is not balanced. Debits must equal Credits.');
                setSavingManual(false);
                return;
            }

            if (totalDebits === 0) {
                toast.error('Entry must have amounts');
                setSavingManual(false);
                return;
            }

            const invalidLines = manualForm.lines.filter(l => !l.account_id || (l.debit_amount === 0 && l.credit_amount === 0));
            if (invalidLines.length > 0) {
                toast.error('Each line must have an account and either a debit or credit amount');
                setSavingManual(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();

            const { data: entryNumData } = await supabase.rpc('generate_journal_entry_number');
            const entryNumber = entryNumData || `JE-${Date.now()}`;

            const { data: je, error: jeError } = await supabase
                .from('journal_entries')
                .insert([{
                    entry_number: entryNumber,
                    entry_date: manualForm.entry_date,
                    description: manualForm.description,
                    source_type: 'manual',
                    is_posted: true,
                    created_by: user?.id,
                }])
                .select()
                .single();

            if (jeError) throw jeError;

            const lines = manualForm.lines.map(l => ({
                journal_entry_id: je.id,
                account_id: l.account_id,
                debit_amount: l.debit_amount || 0,
                credit_amount: l.credit_amount || 0,
                description: l.description,
            }));

            const { error: linesError } = await supabase
                .from('journal_entry_lines')
                .insert(lines);

            if (linesError) throw linesError;

            toast.success(`Journal entry ${entryNumber} created!`);
            setShowManualEntry(false);
            setManualForm({
                entry_date: new Date().toISOString().split('T')[0],
                description: '',
                lines: [
                    { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
                    { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
                ]
            });
            fetchEntries();
        } catch (err: any) {
            toast.error(err.message || 'Failed to create entry');
        }
        setSavingManual(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in pb-16 md:pb-20">
            <ReadOnlyLedgerBanner what="Posting journal entries" />

            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl md:text-page-title text-gray-900 flex items-center gap-2">
                        <BookText className="w-6 h-6 text-gray-600" />
                        Journal Entries
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {stats.total} entries &middot; Double-entry accounting ledger
                    </p>
                </div>
                <button
                    onClick={() => setShowManualEntry(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm font-semibold shadow-sm"
                >
                    <Plus className="w-4 h-4" /> Manual Entry
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-500">Total Entries</p>
                    <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-white p-4 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-500">Total Volume</p>
                    <p className="text-xl font-bold text-gray-900">&#8377;{stats.totalAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white p-4 rounded-md border border-blue-100">
                    <p className="text-xs text-gray-500">Auto (Bank)</p>
                    <p className="text-xl font-bold text-blue-700">{stats.autoEntries}</p>
                </div>
                <div className="bg-white p-4 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-500">Manual</p>
                    <p className="text-xl font-bold text-gray-700">{stats.manualEntries}</p>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by entry #, description, or account..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-[#B8860B] bg-white"
                    />
                </div>
                <select
                    value={sourceFilter}
                    onChange={e => setSourceFilter(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-md text-sm bg-white outline-none focus:border-[#B8860B]"
                >
                    <option value="all">All Sources</option>
                    <option value="bank_transaction">Bank Transaction</option>
                    <option value="cash_transaction">Cash Transaction</option>
                    <option value="manual">Manual</option>
                    <option value="opening_balance">Opening Balance</option>
                </select>
            </div>

            {/* Journal Entries List */}
            <div className="space-y-2">
                {filteredEntries.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-md border border-gray-200">
                        <BookText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500">No journal entries found.</p>
                        <p className="text-xs text-gray-400 mt-1">Entries are created automatically when you verify bank transactions.</p>
                    </div>
                )}

                {filteredEntries.map(entry => {
                    const isExpanded = expandedEntries.has(entry.id);
                    const totalDebits = (entry.lines || []).reduce((s, l) => s + (l.debit_amount || 0), 0);
                    const sourceInfo = SOURCE_LABELS[entry.source_type] || { label: entry.source_type, color: 'bg-gray-100 text-gray-600' };

                    return (
                        <div key={entry.id} className="bg-white rounded-md border border-gray-200 overflow-hidden">
                            <button
                                onClick={() => toggleExpand(entry.id)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-mono font-bold text-gray-900">{entry.entry_number}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sourceInfo.color}`}>{sourceInfo.label}</span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(entry.entry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 truncate mt-0.5">{entry.description || 'No description'}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-gray-900 tabular-nums shrink-0 ml-3">
                                    &#8377;{totalDebits.toLocaleString('en-IN')}
                                </span>
                            </button>

                            {isExpanded && entry.lines && entry.lines.length > 0 && (
                                <div className="border-t">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-500">Account</th>
                                                <th className="px-4 py-2 text-left font-semibold text-gray-500">Narration</th>
                                                <th className="px-4 py-2 text-right font-semibold text-gray-500">Debit</th>
                                                <th className="px-4 py-2 text-right font-semibold text-gray-500">Credit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {entry.lines.map(line => (
                                                <tr key={line.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-gray-400">{line.account?.code || '–'}</span>
                                                            <span className="font-medium text-gray-800">{line.account?.name || '–'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-500">{line.description || '–'}</td>
                                                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                                                        {line.debit_amount > 0 ? <span className="text-gray-900">&#8377;{line.debit_amount.toLocaleString()}</span> : <span className="text-gray-300">&ndash;</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                                                        {line.credit_amount > 0 ? <span className="text-gray-900">&#8377;{line.credit_amount.toLocaleString()}</span> : <span className="text-gray-300">&ndash;</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Manual Entry Modal */}
            {showManualEntry && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in">
                        <div className="p-4 border-b flex justify-between items-center shrink-0">
                            <h2 className="font-semibold text-gray-900">New Manual Journal Entry</h2>
                            <button onClick={() => setShowManualEntry(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmitManual} className="flex-1 overflow-auto p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Entry Date *</label>
                                    <input
                                        type="date" required
                                        value={manualForm.entry_date}
                                        onChange={e => setManualForm(p => ({ ...p, entry_date: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                                    <input
                                        required
                                        value={manualForm.description}
                                        onChange={e => setManualForm(p => ({ ...p, description: e.target.value }))}
                                        placeholder="e.g. Office rent for April"
                                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-[#B8860B]"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-700">Entry Lines</label>
                                    <button type="button" onClick={handleAddLine} className="text-xs text-[#B8860B] font-medium hover:underline flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Add Line
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {manualForm.lines.map((line, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-2.5 rounded-md border border-gray-100">
                                            <div className="col-span-5">
                                                {idx === 0 && <label className="block text-[10px] font-medium text-gray-500 mb-1">Account</label>}
                                                <select
                                                    required
                                                    value={line.account_id}
                                                    onChange={e => {
                                                        const next = [...manualForm.lines];
                                                        next[idx].account_id = e.target.value;
                                                        setManualForm(p => ({ ...p, lines: next }));
                                                    }}
                                                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-[#B8860B]"
                                                >
                                                    <option value="">Select account</option>
                                                    {coaAccounts.map(a => (
                                                        <option key={a.id} value={a.id}>{a.code} &mdash; {a.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-3">
                                                {idx === 0 && <label className="block text-[10px] font-medium text-gray-500 mb-1">Debit</label>}
                                                <input
                                                    type="number" min="0" step="0.01"
                                                    value={line.debit_amount || ''}
                                                    onChange={e => {
                                                        const next = [...manualForm.lines];
                                                        next[idx].debit_amount = parseFloat(e.target.value) || 0;
                                                        if (next[idx].debit_amount > 0) next[idx].credit_amount = 0;
                                                        setManualForm(p => ({ ...p, lines: next }));
                                                    }}
                                                    placeholder="0"
                                                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-[#B8860B]"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                {idx === 0 && <label className="block text-[10px] font-medium text-gray-500 mb-1">Credit</label>}
                                                <input
                                                    type="number" min="0" step="0.01"
                                                    value={line.credit_amount || ''}
                                                    onChange={e => {
                                                        const next = [...manualForm.lines];
                                                        next[idx].credit_amount = parseFloat(e.target.value) || 0;
                                                        if (next[idx].credit_amount > 0) next[idx].debit_amount = 0;
                                                        setManualForm(p => ({ ...p, lines: next }));
                                                    }}
                                                    placeholder="0"
                                                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-[#B8860B]"
                                                />
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                {manualForm.lines.length > 2 && (
                                                    <button type="button" onClick={() => handleRemoveLine(idx)} className="text-gray-400 hover:text-red-500 p-1">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-3 flex items-center justify-between px-3 py-2 bg-gray-100 rounded-md">
                                    <span className="text-xs font-medium text-gray-600">
                                        Debits: &#8377;{manualForm.lines.reduce((s, l) => s + (l.debit_amount || 0), 0).toLocaleString()}
                                    </span>
                                    <span className="text-xs font-medium text-gray-600">
                                        Credits: &#8377;{manualForm.lines.reduce((s, l) => s + (l.credit_amount || 0), 0).toLocaleString()}
                                    </span>
                                    {(() => {
                                        const d = manualForm.lines.reduce((s, l) => s + (l.debit_amount || 0), 0);
                                        const c = manualForm.lines.reduce((s, l) => s + (l.credit_amount || 0), 0);
                                        const balanced = Math.abs(d - c) < 0.01 && d > 0;
                                        return (
                                            <span className={`text-xs font-bold ${balanced ? 'text-green-600' : 'text-red-600'}`}>
                                                {balanced ? '\u2713 Balanced' : `Diff: \u20b9${Math.abs(d - c).toLocaleString()}`}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowManualEntry(false)} className="flex-1 py-2.5 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                                <button type="submit" disabled={savingManual} className="flex-1 py-2.5 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-60">
                                    {savingManual ? 'Posting\u2026' : 'Post Journal Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
