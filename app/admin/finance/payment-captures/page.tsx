'use client';

// =============================================================================
// PAYMENT CAPTURES — the screenshots posted in the Telegram payments group
// -----------------------------------------------------------------------------
// A screenshot is a NOTIFICATION, not proof that money moved. HDFC's receipt
// says "Request Accepted", and an accepted request can still fail. So nothing
// on this page writes to the ledger: a capture is an inbox item until a line
// in the Zoho HDFC bank feed proves it, and only then does it read "verified".
//
// The two exception lists at the top are the reason this page earns its place.
// Saved typing is the small half; the valuable half is seeing a screenshot the
// bank never confirmed, and money that left the account with no screenshot at
// all. Nobody was watching either of those before.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import LoadError from '@/components/LoadError';
import {
    Receipt, AlertTriangle, CheckCircle2, Clock, Copy, RefreshCw,
    Search, Ban, ExternalLink,
} from 'lucide-react';

interface Capture {
    id: string;
    image_url: string | null;
    amount: number | null;
    paid_to: string | null;
    paid_from: string | null;
    txn_date: string | null;
    bank_name: string | null;
    transaction_id: string | null;
    reference_number: string | null;
    payment_method: string | null;
    gateway_status: string | null;
    extraction_confidence: string | null;
    extraction_error: string | null;
    status: string;
    vendor_id: string | null;
    notes: string | null;
    posted_by_label: string | null;
    zoho_bank_transaction_id: string | null;
    transfer_note: string | null;
    direction: 'out' | 'in';
    client_id: string | null;
    needs_bank_match: boolean;
    entry_kind: 'screenshot' | 'text';
    raw_text: string | null;
    match_method: string | null;
    created_at: string;
}
interface Vendor { id: string; name: string }
interface Client { id: string; name: string; company: string | null }

const money = (n: number | null) =>
    n === null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const day = (d: string | null) =>
    !d ? '—' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
const daysAgo = (d: string | null) =>
    !d ? 0 : Math.floor((Date.now() - new Date(d).getTime()) / 864e5);

// How the bank line was found. Shown so nobody treats a weak match as strong:
// a reference match is proof, an amount-and-date match is an inference.
const MATCH_NOTE: Record<string, string> = {
    reference: ' by reference number',
    transfer_note: ' by the transfer name on the receipt',
    payee_amount: ' by payee and amount',
    amount_date: ' by amount and date alone — worth an eye',
};

const STATUS_STYLE: Record<string, string> = {
    verified: 'bg-green-50 text-green-700 border-green-200',
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    duplicate: 'bg-muted text-muted-foreground border-border',
    rejected: 'bg-muted text-muted-foreground border-border',
};
const STATUS_LABEL: Record<string, string> = {
    verified: 'Verified by bank',
    confirmed: 'Vendor named',
    pending: 'Needs vendor',
    duplicate: 'Duplicate',
    rejected: 'Not a payment',
};

export default function PaymentCapturesPage() {
    const [captures, setCaptures] = useState<Capture[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [tab, setTab] = useState<'attention' | 'verified' | 'all'>('attention');
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        const [{ data: caps, error: capErr }, { data: vs }, { data: cl }] = await Promise.all([
            supabase.from('payment_captures').select('*').order('created_at', { ascending: false }).limit(300),
            supabase.from('vendors').select('id, name').eq('is_active', true).order('name'),
            supabase.from('clients').select('id, name, company').order('name'),
        ]);
        if (capErr) setLoadError(capErr.message);
        setCaptures((caps as Capture[]) || []);
        setVendors((vs as Vendor[]) || []);
        setClients((cl as Client[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const patch = async (id: string, body: Record<string, unknown>) => {
        setBusy(id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/finance/payment-captures', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({ id, ...body }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not save');
            setCaptures((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.capture } : c)));
            toast.success(json.matched ? 'Saved — and matched to the bank statement' : 'Saved');
        } catch (err: any) {
            toast.error(err.message || 'Could not save');
        } finally {
            setBusy(null);
        }
    };

    const rematchAll = async () => {
        setBusy('all');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/finance/payment-captures', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({ action: 'rematch' }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not re-check');
            toast.success(`Checked ${json.checked} — ${json.matched} newly matched`);
            await load();
        } catch (err: any) {
            toast.error(err.message || 'Could not re-check');
        } finally {
            setBusy(null);
        }
    };

    // A screenshot the bank has not confirmed after 3 days is the one row on
    // this page worth interrupting someone about: the payment may have failed.
    const stale = useMemo(
        () => captures.filter(
            (c) => !c.zoho_bank_transaction_id
                && ['pending', 'confirmed'].includes(c.status)
                // Cash can never be confirmed by a bank feed, so flagging it
                // would fill this list with warnings nobody can ever clear.
                && c.needs_bank_match
                && daysAgo(c.txn_date || c.created_at) >= 3
        ),
        [captures]
    );

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return captures
            .filter((c) => {
                if (tab === 'attention') return ['pending', 'confirmed'].includes(c.status);
                if (tab === 'verified') return c.status === 'verified';
                return true;
            })
            .filter((c) => !q || [c.paid_to, c.reference_number, c.transaction_id, String(c.amount)]
                .some((f) => (f || '').toLowerCase().includes(q)));
    }, [captures, tab, search]);

    if (loadError) return <LoadError what="payment captures" error={loadError} onRetry={load} />;

    return (
        <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Receipt size={20} /> Payment Captures
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                        Screenshots and typed entries posted in the Telegram payments group —
                        money paid out and money received. A capture is only
                        <b> verified</b> once a matching line appears in the HDFC bank feed —
                        a bank receipt saying &ldquo;Request Accepted&rdquo; is not proof the money moved.
                    </p>
                </div>
                <button
                    onClick={rematchAll}
                    disabled={busy === 'all'}
                    className="text-xs px-3 py-2 rounded-md border border-border bg-card hover:bg-muted flex items-center gap-1.5 disabled:opacity-50"
                >
                    <RefreshCw size={13} className={busy === 'all' ? 'animate-spin' : ''} />
                    Re-check against bank
                </button>
            </div>

            {stale.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>
                        <b>{stale.length} payment{stale.length > 1 ? 's' : ''} the bank has not confirmed</b> after 3+ days
                        ({stale.map((c) => c.direction === 'in'
                            ? `${money(c.amount)} from ${c.paid_from || '?'}`
                            : `${money(c.amount)} to ${c.paid_to || '?'}`).slice(0, 4).join(', ')}
                        {stale.length > 4 ? ', …' : ''}). Check the HDFC statement — an accepted request can still fail.
                    </span>
                </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
                {(['attention', 'verified', 'all'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`text-xs px-3 py-1.5 rounded-md border ${
                            tab === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        {t === 'attention' ? `Needs attention (${captures.filter((c) => ['pending', 'confirmed'].includes(c.status)).length})`
                            : t === 'verified' ? `Verified (${captures.filter((c) => c.status === 'verified').length})`
                            : `All (${captures.length})`}
                    </button>
                ))}
                <div className="relative ml-auto">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Amount, payee, reference…"
                        className="text-xs pl-8 pr-3 py-2 rounded-md border border-border bg-card w-56"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-sm text-muted-foreground p-8 text-center">Loading…</div>
            ) : shown.length === 0 ? (
                <div className="bg-card rounded-md border border-border p-12 text-center">
                    <CheckCircle2 size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium text-sm">
                        {tab === 'attention' ? 'Nothing waiting. Every capture is matched or closed.' : 'Nothing here yet.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {shown.map((c) => {
                        const working = busy === c.id;
                        const waiting = !c.zoho_bank_transaction_id && ['pending', 'confirmed'].includes(c.status);
                        return (
                            <div key={c.id} className="bg-card rounded-md border border-border p-3 flex gap-3">
                                {c.image_url ? (
                                    <a href={c.image_url} target="_blank" rel="noreferrer" className="shrink-0">
                                        <img
                                            src={c.image_url}
                                            alt="Payment proof"
                                            className="w-16 h-16 object-cover rounded border border-border hover:opacity-80"
                                        />
                                    </a>
                                ) : (
                                    <div className="w-16 h-16 rounded border border-dashed border-border grid place-items-center shrink-0">
                                        <Receipt size={16} className="text-muted-foreground/40" />
                                    </div>
                                )}

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground">
                                                <span className={c.direction === 'in' ? 'text-green-700' : ''}>
                                                    {c.direction === 'in' ? 'Received ' : 'Paid '}{money(c.amount)}
                                                </span>
                                                <span className="text-muted-foreground font-normal">
                                                    {' '}{c.direction === 'in' ? 'from' : 'to'}{' '}
                                                    {(c.direction === 'in' ? c.paid_from : c.paid_to) || 'unknown party'}
                                                </span>
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                                                <span>{day(c.txn_date)}</span>
                                                {c.bank_name && <span>· {c.bank_name}</span>}
                                                {c.reference_number && <span className="font-mono">· ref {c.reference_number}</span>}
                                                {!c.needs_bank_match && <span className="font-semibold">· CASH</span>}
                                                {c.entry_kind === 'text' && <span>· typed, no receipt</span>}
                                                {c.posted_by_label && <span>· posted by {c.posted_by_label}</span>}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${STATUS_STYLE[c.status] || STATUS_STYLE.pending}`}>
                                            {STATUS_LABEL[c.status] || c.status}
                                        </span>
                                    </div>

                                    {/* The receipt's own words, never softened. */}
                                    {c.gateway_status && (
                                        <p className="text-[11px] mt-1.5 text-muted-foreground">
                                            Bank receipt says: <b className="text-foreground">{c.gateway_status}</b>
                                            {waiting && c.needs_bank_match && ' — not yet seen in the statement'}
                                        </p>
                                    )}
                                    {c.extraction_confidence === 'low' && (
                                        <p className="text-[11px] mt-1 text-amber-700 flex items-center gap-1">
                                            <AlertTriangle size={10} /> Read with low confidence — check the figures against the image.
                                        </p>
                                    )}
                                    {c.extraction_error && (
                                        <p className="text-[11px] mt-1 text-red-700 flex items-center gap-1">
                                            <AlertTriangle size={10} /> Could not be read automatically: {c.extraction_error}
                                        </p>
                                    )}
                                    {c.status === 'duplicate' && (
                                        <p className="text-[11px] mt-1 text-muted-foreground flex items-center gap-1">
                                            <Copy size={10} /> Same reference as an earlier capture — not counted twice.
                                        </p>
                                    )}
                                    {c.status === 'verified' && (
                                        <p className="text-[11px] mt-1 text-green-700 flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Matched to the bank statement
                                            {MATCH_NOTE[c.match_method || ''] || ''}.
                                        </p>
                                    )}
                                    {waiting && !c.needs_bank_match && (
                                        <p className="text-[11px] mt-1 text-muted-foreground flex items-center gap-1">
                                            <Clock size={10} /> Cash — the bank statement will never show this. Nothing to wait for.
                                        </p>
                                    )}
                                    {waiting && c.needs_bank_match && !c.extraction_error && daysAgo(c.txn_date || c.created_at) < 3 && (
                                        <p className="text-[11px] mt-1 text-muted-foreground flex items-center gap-1">
                                            <Clock size={10} /> Waiting for the bank feed (usually next day).
                                        </p>
                                    )}

                                    {['pending', 'confirmed', 'verified'].includes(c.status) && (
                                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                                            {c.direction === 'in' ? (
                                                <select
                                                    value={c.client_id || ''}
                                                    disabled={working}
                                                    onChange={(e) => patch(c.id, { client_id: e.target.value || null })}
                                                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-card max-w-[240px]"
                                                >
                                                    <option value="">— choose client —</option>
                                                    {clients.map((cl) => (
                                                        <option key={cl.id} value={cl.id}>{cl.company || cl.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <select
                                                    value={c.vendor_id || ''}
                                                    disabled={working}
                                                    onChange={(e) => patch(c.id, { vendor_id: e.target.value || null })}
                                                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-card max-w-[240px]"
                                                >
                                                    <option value="">— choose vendor —</option>
                                                    {vendors.map((v) => (
                                                        <option key={v.id} value={v.id}>{v.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {c.direction === 'out' && c.vendor_id && (
                                                <a
                                                    href={`/admin/finance/vendors/${c.vendor_id}`}
                                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                                >
                                                    Open ledger <ExternalLink size={11} />
                                                </a>
                                            )}
                                            {c.direction === 'in' && c.client_id && (
                                                <a
                                                    href={`/admin/crm/clients/${c.client_id}`}
                                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                                >
                                                    Open ledger <ExternalLink size={11} />
                                                </a>
                                            )}
                                            {/* A bank-proved payment cannot be struck off — the money
                                                demonstrably moved, whatever the screenshot showed. */}
                                            {!c.zoho_bank_transaction_id && (
                                                <button
                                                    onClick={() => patch(c.id, { status: 'rejected' })}
                                                    disabled={working}
                                                    className="text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    <Ban size={11} /> Not a payment
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
