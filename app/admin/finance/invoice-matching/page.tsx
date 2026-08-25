'use client';

// =============================================================================
// INVOICE MATCHING — joining the WORK life of an order to its MONEY life
// -----------------------------------------------------------------------------
// Every order is traceable from quote → job (DO/PO/DP) → sheet (PP) → dispatch.
// Past that point the trail died: 0 of 437 jobs carried an invoice number, and
// 0 of 1495 Zoho invoices carried anything pointing back at a job. Zoho's own
// Reference# is not free to use — 123 invoices already hold the CUSTOMER's PO
// there — so the join has to be inferred and then confirmed by a person.
//
// The invoice is raised AFTER dispatch, once the floor reports the final
// counts, so a job can wait days for its bill. The matcher therefore runs on
// every Zoho sync, not at dispatch, and only PROPOSES when it has a real reason
// to prefer one invoice: the sole candidate in the window, or an amount that
// fits. Where it cannot tell (45 of 103 shipped jobs carry no amount at all),
// it shows that client's invoices and lets a person choose. A queue of
// coin-flips is worse than an empty one — it teaches people to tap Confirm
// without reading.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useConfirm } from '@/components/ConfirmModal';
import LoadError from '@/components/LoadError';
import {
    Link2, Check, X, IndianRupee, Calendar, RefreshCw, Search,
    CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Candidate { doc_id: string; doc_number: string; doc_date: string; total: number }
interface Suggestion {
    link_id: string;
    // The id travels WITH the suggestion. Looking it up in `candidates` by
    // doc_number failed whenever the shortlist was truncated or the client's
    // Zoho mapping had changed, and Confirm then fired with an empty uuid —
    // after the user had already agreed to the confirm dialog.
    doc_id: string;
    doc_number: string; doc_date: string; total: number;
    confidence: number; match_reasons: string[];
    /** How many OTHER jobs already hold this same invoice. */
    also_on_jobs: number;
}
interface Confirmed { doc_number: string; doc_date: string; total: number; confirmed_at: string; confirmed_by: string | null }
interface Row {
    job_id: string; job_number: string; client_id: string; client_name: string;
    zoho_customer_id: string | null; dispatched_at: string; job_amount: number | null;
    confirmed: Confirmed | null; suggestion: Suggestion | null;
    candidates: Candidate[]; candidates_total: number;
}

const money = (n: number | null | undefined) =>
    n === null || n === undefined ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const day = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

export default function InvoiceMatchingPage() {
    const confirm = useConfirm();
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'todo' | 'linked' | 'blocked'>('todo');
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('fn_invoice_matching_queue');
            if (error) throw error;
            setRows((data || []) as Row[]);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Could not load the matching queue');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Re-run the matcher by hand. It also runs on every Zoho sync and webhook;
    // this is for when you have just raised an invoice and don't want to wait.
    const rescan = async () => {
        setBusy('rescan');
        try {
            const { data, error } = await supabase.rpc('fn_suggest_job_invoice_links');
            if (error) throw error;
            const n = data?.[0]?.suggested ?? 0;
            toast.success(n ? `${n} new suggestion${n === 1 ? '' : 's'}.` : 'No new matches to suggest.');
            await load();
        } catch (err: any) {
            toast.error('Rescan failed: ' + (err.message || 'Unknown error'));
        } finally { setBusy(null); }
    };

    const link = async (row: Row, docId: string, docNumber: string, alsoOn = 0) => {
        if (!docId) {
            toast.error('That invoice is no longer in the list — reload the page and try again.');
            return;
        }
        const { confirmed: ok } = await confirm({
            title: `Link ${docNumber} to ${row.job_number}?`,
            message: `${row.client_name}. This records the invoice against the job for good, and fills the job's invoice number so the dispatch and finance screens can see it.`
                // One invoice CAN bill several jobs — a split order, or a
                // client's jobs shipped together. That is allowed, but it must
                // be a decision, not something noticed months later.
                + (alsoOn > 0
                    ? ` Note: this invoice is already linked to ${alsoOn} other job${alsoOn === 1 ? '' : 's'}. That is right for a split order billed once, and wrong if this job was billed separately.`
                    : ''),
            confirmLabel: 'Link them',
            variant: alsoOn > 0 ? 'warning' : 'success',
        });
        if (!ok) return;
        setBusy(row.job_id);
        try {
            const { error } = await supabase.rpc('fn_confirm_job_invoice', { p_job_id: row.job_id, p_doc_id: docId });
            if (error) throw error;
            toast.success(`${row.job_number} → ${docNumber}`);
            await load();
        } catch (err: any) {
            toast.error('Could not link them: ' + (err.message || 'Unknown error'));
        } finally { setBusy(null); }
    };

    const dismiss = async (row: Row, linkId: string) => {
        setBusy(row.job_id);
        try {
            const { error } = await supabase.rpc('fn_reject_job_invoice', { p_link_id: linkId });
            if (error) throw error;
            await load();
        } catch (err: any) {
            toast.error('Could not dismiss it: ' + (err.message || 'Unknown error'));
        } finally { setBusy(null); }
    };

    const q = search.trim().toLowerCase();
    const matchesSearch = (r: Row) =>
        !q || r.job_number.toLowerCase().includes(q) || (r.client_name || '').toLowerCase().includes(q);

    // A client with no Zoho mapping can never be matched — that is a setup gap,
    // not a decision waiting to be made, so it gets its own tab instead of
    // sitting in the queue looking like work.
    const blocked = rows.filter(r => !r.zoho_customer_id && matchesSearch(r));
    const linked = rows.filter(r => r.confirmed && matchesSearch(r));
    const todo = rows.filter(r => !r.confirmed && r.zoho_customer_id && matchesSearch(r));
    const shown = tab === 'todo' ? todo : tab === 'linked' ? linked : blocked;

    if (error) return <LoadError what="the invoice matching queue" error={error} onRetry={load} />;
    if (loading) return <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-gray-400" /></div>;

    return (
        <div className="space-y-3 px-2 animate-fade-in">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-page-title text-gray-900 flex items-center gap-2">
                        <Link2 size={20} /> Invoice Matching
                    </h1>
                    <p className="text-xs md:text-sm text-gray-500">
                        Tie each dispatched job to the invoice that billed it.
                    </p>
                </div>
                <button
                    onClick={rescan}
                    disabled={busy === 'rescan'}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                    <RefreshCw size={14} className={busy === 'rescan' ? 'animate-spin' : ''} />
                    Look for new matches
                </button>
            </div>

            <div className="flex gap-1.5 flex-wrap">
                {([
                    ['todo', 'To match', todo.length],
                    ['linked', 'Linked', linked.length],
                    ['blocked', 'Client not in Zoho', blocked.length],
                ] as const).map(([key, label, n]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${tab === key
                            ? 'bg-gray-900 text-white border-gray-800'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                        {label} <span className="opacity-60">{n}</span>
                    </button>
                ))}
                <div className="relative ml-auto">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Job or client…"
                        className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-md text-xs w-48 focus:ring-2 focus:ring-gray-300 outline-none"
                    />
                </div>
            </div>

            {tab === 'blocked' && blocked.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>
                        These clients have no Zoho customer linked, so their invoices can never be found
                        automatically. Open the client and set the Zoho customer once — it is permanent.
                    </span>
                </div>
            )}

            {shown.length === 0 ? (
                <div className="bg-card rounded-md border border-border p-12 text-center">
                    <CheckCircle2 size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium text-sm">
                        {tab === 'todo' ? 'Nothing waiting to be matched.' : tab === 'linked' ? 'Nothing linked yet.' : 'Every client with dispatched work is linked to Zoho.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {shown.map(row => {
                        const isOpen = expanded === row.job_id;
                        const working = busy === row.job_id;
                        return (
                            <div key={row.job_id} className="bg-card rounded-md border border-border p-3">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground">
                                            <span className="font-mono">{row.job_number}</span>
                                            <span className="text-muted-foreground font-normal"> · {row.client_name}</span>
                                        </p>
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="flex items-center gap-1"><Calendar size={10} /> dispatched {day(row.dispatched_at)}</span>
                                            <span className="flex items-center gap-1"><IndianRupee size={10} />{row.job_amount ? money(row.job_amount) : 'no amount on the job'}</span>
                                        </p>
                                    </div>
                                    {row.confirmed && (
                                        <span className="text-[10px] px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-semibold">
                                            {row.confirmed.doc_number} · {money(row.confirmed.total)}
                                        </span>
                                    )}
                                </div>

                                {/* The proposal, when there was a reason to prefer one invoice */}
                                {!row.confirmed && row.suggestion && (
                                    <div className="mt-2.5 rounded-md border border-blue-200 bg-blue-50/60 p-2.5">
                                        <div className="flex items-start justify-between gap-3 flex-wrap">
                                            <div>
                                                <p className="text-xs font-bold text-blue-900">
                                                    {row.suggestion.doc_number} · {day(row.suggestion.doc_date)} · {money(row.suggestion.total)}
                                                </p>
                                                <ul className="mt-1 space-y-0.5">
                                                    {row.suggestion.match_reasons.map((r, i) => {
                                                        const warn = r.startsWith('CAREFUL');
                                                        return (
                                                            <li key={i} className={`text-[10px] flex items-center gap-1 ${warn ? 'text-amber-700 font-semibold' : 'text-blue-700'}`}>
                                                                {warn ? <AlertTriangle size={9} className="shrink-0" /> : <Check size={9} className="shrink-0" />}
                                                                {r}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => link(row, row.suggestion!.doc_id, row.suggestion!.doc_number, row.suggestion!.also_on_jobs)}
                                                    disabled={working}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    <Check size={12} /> Confirm
                                                </button>
                                                <button
                                                    onClick={() => dismiss(row, row.suggestion!.link_id)}
                                                    disabled={working}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-gray-600 border border-gray-200 rounded text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    <X size={12} /> Not this one
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* The shortlist, for when nothing could tell the invoices apart */}
                                {!row.confirmed && (
                                    <div className="mt-2">
                                        <button
                                            onClick={() => setExpanded(isOpen ? null : row.job_id)}
                                            className="text-[11px] font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
                                        >
                                            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            {row.suggestion ? 'Show other invoices' : `Pick from ${row.candidates_total} invoice${row.candidates_total === 1 ? '' : 's'} for this client`}
                                        </button>
                                        {isOpen && (
                                            row.candidates.length === 0 ? (
                                                <p className="text-[11px] text-gray-400 mt-1.5">
                                                    No unanswered invoices for this client between dispatch and 90 days after.
                                                </p>
                                            ) : (
                                                <div className="mt-1.5 space-y-1">
                                                    {row.candidates_total > row.candidates.length && (
                                                        <p className="text-[10px] text-amber-700">
                                                            Showing the oldest {row.candidates.length} of {row.candidates_total}. Narrow it down in Zoho if the right one is not here.
                                                        </p>
                                                    )}
                                                    {row.candidates.map(c => (
                                                        <div key={c.doc_id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-muted rounded">
                                                            <span className="text-[11px] text-foreground">
                                                                <span className="font-mono font-semibold">{c.doc_number}</span>
                                                                <span className="text-muted-foreground"> · {day(c.doc_date)} · {money(c.total)}</span>
                                                            </span>
                                                            <button
                                                                onClick={() => link(row, c.doc_id, c.doc_number)}
                                                                disabled={working}
                                                                className="px-2.5 py-1 bg-foreground text-background rounded text-[10px] font-bold hover:opacity-90 disabled:opacity-50"
                                                            >
                                                                Link
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
