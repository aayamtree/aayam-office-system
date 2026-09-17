'use client';

// =============================================================================
// PAYMENT CAPTURES — the screenshots posted in the Telegram payments group
// -----------------------------------------------------------------------------
// A screenshot is a NOTIFICATION, not proof that money moved. HDFC's receipt
// says "Request Accepted", and an accepted request can still fail. So nothing
// on this page writes to the ledger: a capture is an inbox item until a line
// in the Zoho HDFC bank feed proves it, and only then does it read "verified".
//
// The exception lists at the top are the reason this page earns its place.
// Saved typing is the small half; the valuable half is seeing a screenshot the
// bank never confirmed, and money that left the account with no screenshot at
// all. Nobody was watching either of those before.
// =============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/realtime-context';
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
    entered_in_books_at: string | null;
    match_method: string | null;
    created_at: string;
}
interface Vendor { id: string; name: string }
interface Client { id: string; name: string; company: string | null }

const money = (n: number | null) =>
    n === null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const day = (d: string | null) =>
    !d ? '—' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
// How the bank line was found. Shown so nobody treats a weak match as strong:
// a reference match is proof, an amount-and-date match is an inference.
const MATCH_NOTE: Record<string, string> = {
    reference: ' by reference number',
    transfer_note: ' by the transfer name on the receipt',
    payee_amount: ' by payee and amount',
    amount_date: ' by amount and date alone — worth an eye',
};

/**
 * Cash and off-bank payments belong to the "enter it in Zoho" queue.
 * Kept as a plain predicate rather than an array-membership test so the page
 * and the reconcile cron can be checked against each other by reading them.
 */
function isCashQueue(c: { needs_bank_match: boolean; status: string; zoho_bank_transaction_id?: string | null }): boolean {
    // A payment the statement already proves is in Zoho via the feed. Asking
    // for it to be entered by hand would put it in the book of record twice.
    return !c.needs_bank_match
        && !c.zoho_bank_transaction_id
        && !['rejected', 'duplicate'].includes(c.status);
}

/**
 * The primary tab and the number printed on it must be the same set. They were
 * not: the badge counted every pending/confirmed row while the list also hid
 * ticked-off cash, so ticking a cash payment emptied a row and moved no number.
 */
function needsAttention(c: Capture): boolean {
    return ['pending', 'confirmed'].includes(c.status)
        && !(isCashQueue(c) && c.entered_in_books_at);
}

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
    // How far the bank statement has actually reached. Judging "the bank never
    // confirmed this" against TODAY accused every payment made since the last
    // statement upload; the cron was fixed to measure against the feed, and
    // this screen has to agree with it or the two contradict each other.
    const [feedThrough, setFeedThrough] = useState<string | null>(null);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [live, setLive] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [tab, setTab] = useState<'attention' | 'verified' | 'all'>('attention');
    const [search, setSearch] = useState('');

    // silent = a refresh triggered by the live feed rather than by the person.
    // It must NOT raise the full-screen spinner: blanking a list someone is
    // reading, every time a colleague verifies a capture, is worse than the
    // stale row it replaces.
    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true);
        setLoadError(null);
        const [
            { data: caps, error: capErr },
            { data: openWork, error: openErr },
            { data: openCash, error: cashErr },
            { data: vs }, { data: cl },
            { data: tip, error: tipErr },
        ] = await Promise.all([
            supabase.from('payment_captures').select('*').order('created_at', { ascending: false }).limit(300),
            // The two queries below are the reason this page can be trusted.
            // Loading only the newest 300 meant that once the inbox passed 300
            // rows — a matter of months on a Telegram-fed group — an old
            // unfinished payment fell off the page entirely: the nightly
            // Telegram would name it, the screen would not list it, the badge
            // would not count it, and the tick that clears the alert would be
            // unreachable. Everything still OPEN is loaded regardless of age.
            supabase.from('payment_captures').select('*')
                .in('status', ['pending', 'confirmed'])
                .order('created_at', { ascending: false }).limit(1000),
            supabase.from('payment_captures').select('*')
                .eq('needs_bank_match', false)
                .is('entered_in_books_at', null)
                .not('status', 'in', '(rejected,duplicate)')
                .order('created_at', { ascending: false }).limit(1000),
            supabase.from('vendors').select('id, name').eq('is_active', true).order('name'),
            supabase.from('clients').select('id, name, company').order('name'),
            // nullsFirst:false matters — a single feed row with a null date
            // would otherwise come back as the "latest" and blank this out.
            supabase.from('zoho_bank_transactions').select('txn_date')
                .not('txn_date', 'is', null)
                .order('txn_date', { ascending: false, nullsFirst: false })
                .limit(1).maybeSingle(),
        ]);
        const firstErr = capErr || openErr || cashErr;
        if (firstErr) setLoadError(firstErr.message);
        const byId = new Map<string, Capture>();
        for (const row of [
            ...((caps as Capture[]) || []),
            ...((openWork as Capture[]) || []),
            ...((openCash as Capture[]) || []),
        ]) byId.set(row.id, row);
        setCaptures(Array.from(byId.values()).sort(
            (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))
        ));
        setVendors((vs as Vendor[]) || []);
        setClients((cl as Client[]) || []);
        // A failed feed read is not a feed that has reached nowhere. Left
        // merged, the page would quietly fall back to the 3-day rule and print
        // "after 3+ days" as though that were a considered judgement.
        setFeedError(tipErr ? tipErr.message : null);
        setFeedThrough((tip as { txn_date: string } | null)?.txn_date ?? null);
        setLastUpdated(new Date());
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Live updates ─────────────────────────────────────────────────────────
    // A capture arrives from Telegram seconds after someone posts a screenshot,
    // and this page used to show it only if you pressed reload. It now refetches
    // when the shared realtime channel reports a change to payment_captures.
    //
    // The channel is the app-wide one in lib/realtime-context — deliberately not
    // a second channel opened here. The comment at the top of that file records
    // why: per-component channels once produced 100k+ create/destroy cycles and
    // dominated database CPU.
    const { capturePing } = useRealtime();
    const seenPing = useRef(0);
    useEffect(() => {
        // Skip the very first render: load() above has already fetched.
        if (capturePing === seenPing.current) return;
        seenPing.current = capturePing;
        setLive(true);
        load({ silent: true });
    }, [capturePing, load]);

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
            if (json.warning) { toast.error(json.warning); await load({ silent: true }); return; }
            if (!json.capture) throw new Error('Saved, but the updated row could not be read back — refresh to confirm.');
            setCaptures((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.capture } : c)));
            // Re-checking can reclassify a row on its own — "This went through
            // the bank" on a row whose bank line is already claimed comes back
            // as a duplicate, which drops it out of every list. Reporting that
            // as a plain green "Saved" was the exact confusion this feature
            // exists to prevent.
            if (json.note) toast.error(json.note);
            else toast.success(json.matched ? 'Saved — and matched to the bank statement' : 'Saved');
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
            await load({ silent: true });
        } catch (err: any) {
            toast.error(err.message || 'Could not re-check');
        } finally {
            setBusy(null);
        }
    };

    // A screenshot the bank has not confirmed after 3 days is the one row on
    // this page worth interrupting someone about: the payment may have failed.
    // setUTCDate, not setDate: the cron computes its cutoff in UTC, and in IST
    // the local version lands a day earlier — the same payment judged stale by
    // the screen and fine by the nightly alert.
    const graceCutoff = useMemo(() => {
        const g = new Date();
        g.setUTCDate(g.getUTCDate() - 3);
        return g.toISOString().slice(0, 10);
    }, []);
    // The cron stops accusing anyone once the statement is more than the
    // lookback window behind, because its two bounds cross and it can only
    // return nothing. The screen has to reach the same conclusion or the two
    // print different numbers on the same day.
    const feedBlind = useMemo(() => {
        if (feedError) return true;
        if (!feedThrough) return true;
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - 30);
        return feedThrough < since.toISOString().slice(0, 10);
    }, [feedThrough, feedError]);

    // How far behind the bank statement actually is, and how to say it.
    //
    // feedBlind above only fires at 30 days, which is right for "this page can
    // tell you nothing" — but on 2026-09-08 the feed had stopped on 28 August,
    // eleven days earlier, and because eleven is under thirty every card
    // cheerfully said "usually next day". Four payments worth ₹3.8 lakh were
    // sitting under that reassurance. Nothing was wrong with the app; the
    // statement simply had not been uploaded, and the screen was the last place
    // that would have told anyone.
    //
    // So the card no longer states a habit ("usually next day"). It states the
    // fact: the date the statement stops, and how old that is.
    const feedAge = useMemo(() => {
        if (!feedThrough) return null;
        const through = new Date(`${feedThrough}T00:00:00Z`);
        if (Number.isNaN(through.getTime())) return null;
        const days = Math.floor((Date.now() - through.getTime()) / 86_400_000);
        return {
            days,
            label: through.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            // One day behind is normal: the statement is uploaded the next
            // morning. Beyond two, silence is no longer reassurance.
            stale: days > 2,
        };
    }, [feedThrough]);

    const stale = useMemo(() => {
        if (feedBlind) return [] as Capture[];
        // Whichever is EARLIER: the ordinary 3-day grace, or how far the bank
        // statement has reached. A payment is only suspicious once the
        // statement has covered its date and still not shown it. Silence from
        // a statement that has not arrived is not evidence of anything.
        const cutoff = [graceCutoff, feedThrough]
            .filter((d): d is string => Boolean(d))
            .sort()[0];
        return captures.filter(
            (c) => !c.zoho_bank_transaction_id
                && ['pending', 'confirmed'].includes(c.status)
                // Cash can never be confirmed by a bank feed, so flagging it
                // would fill this list with warnings nobody can ever clear.
                && c.needs_bank_match
                && Boolean(c.txn_date)
                && (c.txn_date as string) <= cutoff
        );
    }, [captures, feedThrough, feedBlind, graceCutoff]);

    // A receipt whose date could not be read belonged to NO list: not stale
    // (the filters above all key off txn_date), not cash (a bank line is still
    // expected). A payment that may have failed, and nothing anywhere saying
    // so. Its posting time is the only clock available, and it cannot be
    // measured against the statement's reach at all — so it is called out
    // separately, in those words.
    const dateless = useMemo(() => captures.filter(
        (c) => !c.zoho_bank_transaction_id
            && ['pending', 'confirmed'].includes(c.status)
            && c.needs_bank_match
            && !c.txn_date
            && String(c.created_at || '').slice(0, 10) <= graceCutoff
    ), [captures, graceCutoff]);
    const flaggedIds = useMemo(
        () => new Set([...stale, ...dateless].map((c) => c.id)),
        [stale, dateless]
    );

    // Cash and off-bank payments. No bank line will EVER appear for these, so
    // they are not waiting to be confirmed — they are waiting to be entered in
    // Zoho, which is a different job with a different fix and needs its own list.
    const toEnter = useMemo(() => captures.filter(isCashQueue).filter((c) => !c.entered_in_books_at), [captures]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return captures
            .filter((c) => {
                // A ticked-off cash payment is finished: nothing will ever
                // change its status, so without this it sits in the primary
                // tab for ever and the tick reduces nothing.
                if (tab === 'attention') return needsAttention(c);
                // Ticked rows STAY in this tab (dimmed) so the tick reads as a
                // confirmation rather than the row vanishing, and so Undo is
                // where the person just clicked.
                if (tab === 'verified') return c.status === 'verified';
                return true;
            })
            .filter((c) => !q || [c.paid_to, c.reference_number, c.transaction_id, String(c.amount)]
                .some((f) => (f || '').toLowerCase().includes(q)));
    }, [captures, tab, search]);

    if (loadError) return <LoadError what="payment captures" error={loadError} onRetry={() => load()} />;

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
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5" title={
                            live
                                ? 'This page updates on its own when a payment is posted or changed.'
                                : 'Waiting for the first live update since this page opened.'
                        }>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                            Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={rematchAll}
                        disabled={busy === 'all'}
                        className="text-xs px-3 py-2 rounded-md border border-border bg-card hover:bg-muted flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={busy === 'all' ? 'animate-spin' : ''} />
                        Re-check against bank
                    </button>
                </div>
            </div>

            {feedBlind && (
                <div className="bg-muted border border-border rounded-md p-3 text-xs text-muted-foreground flex gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>
                        {feedError
                            ? <><b>The bank feed could not be read.</b> Nothing on this page has been checked against
                                the statement — that is not the same as everything being fine.</>
                            : feedThrough
                                ? <><b>The bank statement is a long way behind.</b> Its newest line is {feedThrough},
                                    so no payment since then can be confirmed and this page is not reporting a
                                    reassuring zero — it is reporting that it cannot tell. Upload a statement to Zoho.</>
                                : <><b>There is no bank statement data at all.</b> Nothing can be confirmed until a
                                    statement reaches Zoho.</>}
                    </span>
                </div>
            )}

            {stale.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>
                        <b>{stale.length} payment{stale.length > 1 ? 's' : ''} the bank has not confirmed</b>
                        {/* "reached X" claimed coverage up to that date. All the
                            feed proves is that a line dated X exists in it. */}
                        {feedThrough ? ` — the newest line in the statement is ${feedThrough}, with no sign of ${stale.length > 1 ? 'them' : 'it'}` : ' after 3+ days'}
                        ({stale.map((c) => c.direction === 'in'
                            ? `${money(c.amount)} from ${c.paid_from || '?'}`
                            : `${money(c.amount)} to ${c.paid_to || '?'}`).slice(0, 4).join(', ')}
                        {stale.length > 4 ? ', …' : ''}). Check the HDFC statement — an accepted request can still fail.
                    </span>
                </div>
            )}

            {dateless.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>
                        <b>{dateless.length} payment{dateless.length > 1 ? 's' : ''} with no readable date</b> — nothing
                        can check {dateless.length > 1 ? 'them' : 'it'} against the statement, not even to say
                        {dateless.length > 1 ? ' they are' : ' it is'} fine
                        ({dateless.map((c) => c.direction === 'in'
                            ? `${money(c.amount)} from ${c.paid_from || '?'}`
                            : `${money(c.amount)} to ${c.paid_to || '?'}`).slice(0, 4).join(', ')}
                        {dateless.length > 4 ? ', …' : ''}). Open the screenshot and set the date.
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
                        {t === 'attention' ? `Needs attention (${captures.filter(needsAttention).length})`
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
                        {tab === 'attention' ? 'Nothing waiting. Every capture is matched or closed.'
                            : 'Nothing here yet.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {shown.map((c) => {
                        const working = busy === c.id;
                        const waiting = !c.zoho_bank_transaction_id && ['pending', 'confirmed'].includes(c.status);
                        return (
                            <div
                                key={c.id}
                                className={`bg-card rounded-md border border-border p-3 flex gap-3 ${
                                    ''
                                }`}
                            >
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
                                    {/* Keyed off the SAME sets the banners use. Computed
                                        independently, a dateless row showed this reassurance
                                        for ever while the banner above called it out. */}
                                    {waiting && c.needs_bank_match && !c.extraction_error && !flaggedIds.has(c.id) && (
                                        <p className={`text-[11px] mt-1 flex items-start gap-1 ${feedAge?.stale ? 'text-amber-700' : 'text-muted-foreground'}`}>
                                            <Clock size={10} className="shrink-0 mt-0.5" />
                                            {feedError
                                                ? <span>The bank feed could not be read, so this has not been checked either way.</span>
                                                : feedAge?.stale
                                                    ? <span>
                                                        The bank statement stops at <b>{feedAge.label}</b> — {feedAge.days} days ago.
                                                        Nothing paid since then can be checked yet. Upload a statement to Zoho.
                                                    </span>
                                                    : feedAge
                                                        ? <span>Waiting for the bank feed — the statement runs to {feedAge.label}.</span>
                                                        : <span>There is no bank statement data at all, so nothing can be confirmed.</span>}
                                        </p>
                                    )}

                                    {/* A capture can be set to 'duplicate' by the matcher
                                        itself, without anyone asking. With no control on
                                        those rows it left every list and could never be
                                        brought back — a payment that exists nowhere. */}
                                    {['duplicate', 'rejected'].includes(c.status) && !c.zoho_bank_transaction_id && (
                                        <div className="mt-2">
                                            <button
                                                onClick={() => patch(c.id, { status: 'pending' })}
                                                disabled={working}
                                                className="text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                                            >
                                                {c.status === 'duplicate' ? 'Not a duplicate — put it back' : 'Put it back'}
                                            </button>
                                        </div>
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
                                            {/* Cash left this system in September 2026, so nothing may be
                                                marked AS cash any more. The reverse still shows, because an
                                                older row wrongly marked cash needs a way back. */}
                                            {!c.needs_bank_match && !c.zoho_bank_transaction_id && !['rejected', 'duplicate'].includes(c.status) && (
                                                <button
                                                    onClick={() => patch(c.id, { needs_bank_match: !c.needs_bank_match })}
                                                    disabled={working}
                                                    className="text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                                                    title="Mark as a bank payment — expect it on the statement"
                                                >
                                                    This went through the bank
                                                </button>
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
