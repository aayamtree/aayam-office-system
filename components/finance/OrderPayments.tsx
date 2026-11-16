'use client';

// Order-level payment tracking for the Orders page:
//   <ReceivablesStrip>   totals + the Money In button
//   <OrderPaymentCell>   per-order Blue / Red paid-vs-due, with a history toggle
//   <OrderPaymentHistory> which payments cleared which order (FIFO)
//   <MoneyInModal>       record a party payment; it is applied oldest order first

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { previewAllocation, type Colour, type OrderRec } from '@/lib/order-receivables';
import type { OrderReceivables } from './useOrderReceivables';
import { IndianRupee, Plus, X, CheckCircle, Loader2, ChevronDown, ChevronRight, ArrowDownToLine, FileText, ListChecks, Ban } from 'lucide-react';

const inr = (v: number) => '₹' + Math.round(v || 0).toLocaleString('en-IN');
const partyName = (c?: Record<string, any>) => c?.company || c?.name || 'Unknown';
const COLOUR = {
    blue: { label: 'Blue', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', solid: 'bg-blue-500', tint: 'bg-blue-100' },
    red: { label: 'Red', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', solid: 'bg-red-500', tint: 'bg-red-100' },
};

export function ReceivablesStrip({ rec, onMoneyIn, onLog, canRecord }: { rec: OrderReceivables; onMoneyIn: () => void; onLog?: () => void; canRecord: boolean }) {
    return (
        <div className="flex flex-wrap items-stretch gap-3">
            <div className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2.5 min-w-[150px]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800">Blue due</p>
                <p className="text-xl font-bold text-blue-900 tabular-nums">{inr(rec.totals.blue)}</p>
            </div>
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2.5 min-w-[150px]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800">Red due</p>
                <p className="text-xl font-bold text-red-900 tabular-nums">{inr(rec.totals.red)}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white px-4 py-2.5 min-w-[130px]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Orders with dues</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums">{rec.totals.orders}</p>
            </div>
            {canRecord && onLog && (
                <button onClick={onLog} className="ml-auto self-center inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2.5 rounded-md font-semibold text-sm">
                    <ListChecks className="w-4 h-4" /> Payment log
                </button>
            )}
            {canRecord && (
                <button onClick={onMoneyIn} className={`${onLog ? '' : 'ml-auto '}self-center inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-md font-semibold text-sm shadow-sm`}>
                    <ArrowDownToLine className="w-4 h-4" /> Money In
                </button>
            )}
        </div>
    );
}

function Bar({ colour, paid, total }: { colour: Colour; paid: number; total: number }) {
    const c = COLOUR[colour];
    const w = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className={`w-9 shrink-0 font-semibold ${c.text}`}>{c.label}</span>
            <div className={`flex-1 h-1.5 rounded-full ${c.tint} overflow-hidden`}><div className={`h-full ${c.solid}`} style={{ width: `${w}%` }} /></div>
            <span className="tabular-nums text-gray-600 whitespace-nowrap min-w-[96px] text-right">{inr(paid)} / {inr(total)}</span>
        </div>
    );
}

export function OrderPaymentCell({ o, open, onToggle, onMoneyIn, onInvoice, canRecord }: {
    o?: OrderRec; open: boolean; onToggle: () => void; onMoneyIn: () => void; onInvoice?: () => void; canRecord: boolean;
}) {
    if (!o || o.status === 'none') return <span className="text-sm text-muted-foreground/60">—</span>;
    const chip = o.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : o.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600';
    return (
        <div className="space-y-1.5">
            {o.blueTotal > 0 && <Bar colour="blue" paid={o.bluePaid} total={o.blueTotal} />}
            {o.redTotal > 0 && <Bar colour="red" paid={o.redPaid} total={o.redTotal} />}
            <div className="flex flex-wrap items-center justify-between gap-y-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${chip}`}>
                    {o.status === 'paid' ? 'Paid' : o.status === 'partial' ? `Partial · due ${inr(o.blueDue + o.redDue)}` : `Unpaid · due ${inr(o.blueDue + o.redDue)}`}
                </span>
                <span className="flex items-center gap-2">
                    {onInvoice && o.blueTotal > 0 && (
                        <button onClick={onInvoice} title="View / download the Blue invoice" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold">
                            <FileText className="w-3 h-3" />Invoice
                        </button>
                    )}
                    {canRecord && o.status !== 'paid' && <button onClick={onMoneyIn} className="text-[11px] font-semibold text-indigo-600 hover:underline">Money In</button>}
                    <button onClick={onToggle} className="inline-flex items-center text-[11px] font-medium text-gray-500 hover:text-gray-800" aria-expanded={open}>
                        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}History
                    </button>
                </span>
            </div>
        </div>
    );
}

export function OrderPaymentHistory({ o, methodName }: { o?: OrderRec; methodName: Map<string, string> }) {
    const events = o?.events || [];
    return (
        <div className="px-6 py-3 bg-gray-50/70 border-t border-gray-100">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Payments applied to this order (oldest order is cleared first)</p>
            {events.length === 0 ? <p className="text-sm text-gray-400">No payment has reached this order yet.</p> : (
                <ul className="space-y-1.5">
                    {events.map((e, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                            <span className="w-24 text-gray-500 tabular-nums">{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className={`inline-flex items-center gap-1.5 font-semibold ${COLOUR[e.colour].text}`}><i className={`w-2.5 h-2.5 rounded-sm ${COLOUR[e.colour].solid}`} />{COLOUR[e.colour].label}</span>
                            <span className="font-semibold tabular-nums">{inr(e.amount)}</span>
                            <span className="text-gray-500">via {(e.methodId && methodName.get(e.methodId)) || '—'}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
export function MoneyInModal({ rec, initialClientId, onClose }: { rec: OrderReceivables; initialClientId?: string; onClose: () => void }) {
    const [clientId, setClientId] = useState(initialClientId || '');
    const [amt, setAmt] = useState<Record<Colour, number>>({ blue: 0, red: 0 });
    const [method, setMethod] = useState<Record<Colour, string>>({ blue: '', red: '' });
    const [adding, setAdding] = useState<Colour | null>(null);
    const [newMethod, setNewMethod] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const partyOptions = useMemo(() => rec.clients
        .map(c => ({ c, due: (rec.fifo.byClient.get(c.id)?.blueDue || 0) + (rec.fifo.byClient.get(c.id)?.redDue || 0) }))
        .filter(x => x.due > 0 || x.c.id === initialClientId)
        .sort((a, b) => b.due - a.due), [rec.clients, rec.fifo, initialClientId]);

    const cr = clientId ? rec.fifo.byClient.get(clientId) : undefined;
    const open = (cr?.orders || []).filter(o => o.blueDue + o.redDue > 0);
    const due: Record<Colour, number> = { blue: cr?.blueDue || 0, red: cr?.redDue || 0 };

    const addMethod = async (col: Colour) => {
        const name = newMethod.trim();
        if (!name) return;
        const { data } = await (supabase as any).from('payment_methods').insert([{ name, is_active: true }]).select().single();
        if (data) {
            rec.setMethods([...rec.methods, data].sort((a, b) => String(a.name).localeCompare(String(b.name))));
            setMethod(m => ({ ...m, [col]: data.id }));
        }
        setNewMethod(''); setAdding(null);
    };

    const save = async () => {
        if (!clientId) return toast.error('Choose a party first');
        if (amt.blue <= 0 && amt.red <= 0) return toast.error('Enter at least one amount');
        for (const col of ['blue', 'red'] as Colour[]) {
            if (amt[col] > due[col]) return toast.error(`${COLOUR[col].label} amount is more than the ${inr(due[col])} due`);
            if (amt[col] > 0 && !method[col]) return toast.error(`Pick a payment method for ${COLOUR[col].label}`);
        }
        setSaving(true);
        const { error } = await (supabase as any).from('receivables_payments').insert([{
            client_id: clientId, amount_blue: amt.blue, amount_red: amt.red,
            method_blue: amt.blue > 0 ? method.blue : null, method_red: amt.red > 0 ? method.red : null,
            notes: notes || null, received_at: date,
        }]);
        setSaving(false);
        if (error) return toast.error(error.message || 'Could not save');
        toast.success('Payment recorded and applied oldest order first');
        await rec.reload();
        onClose();
    };

    const colourBlock = (col: Colour) => {
        const c = COLOUR[col];
        const prev = previewAllocation(open, col, Math.min(amt[col], due[col]));
        return (
            <div className={`rounded-md border ${c.border} ${c.bg} p-3 space-y-2`}>
                <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${c.text}`}>{c.label} — {col === 'blue' ? 'Invoiced (incl. 18% GST)' : 'Pending'}</span>
                    <span className={`text-xs ${c.text}`}>Due {inr(due[col])}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] uppercase text-gray-600 mb-1">Amount received (₹)</label>
                        <input type="number" min="0" step="0.01" value={amt[col] || ''} placeholder="0"
                            onChange={e => setAmt(a => ({ ...a, [col]: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white" />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase text-gray-600 mb-1">Payment method</label>
                        {adding === col ? (
                            <div className="flex gap-1">
                                <input autoFocus value={newMethod} onChange={e => setNewMethod(e.target.value)} placeholder="e.g. Paytm, RTGS…"
                                    onKeyDown={e => { if (e.key === 'Enter') addMethod(col); if (e.key === 'Escape') setAdding(null); }}
                                    className="flex-1 min-w-0 px-2 py-2 border border-indigo-400 rounded text-sm" />
                                <button onClick={() => addMethod(col)} className="px-2 bg-indigo-600 text-white rounded text-xs font-semibold">Add</button>
                                <button onClick={() => setAdding(null)} className="px-2 border border-gray-300 rounded bg-white"><X className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <div className="flex gap-1">
                                <select value={method[col]} onChange={e => setMethod(m => ({ ...m, [col]: e.target.value }))} className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded text-sm bg-white">
                                    <option value="">— select —</option>
                                    {rec.methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                                <button type="button" title="Add new payment method" onClick={() => { setAdding(col); setNewMethod(''); }} className="px-2 border border-gray-300 rounded bg-white hover:bg-gray-50"><Plus className="w-4 h-4" /></button>
                            </div>
                        )}
                    </div>
                </div>
                {prev.lines.length > 0 && (
                    <div className="rounded bg-white/70 border border-white px-2.5 py-2 text-xs space-y-1">
                        <p className="font-semibold text-gray-600">Will be applied oldest order first:</p>
                        {prev.lines.map(l => {
                            const j = rec.jobById.get(l.jobId);
                            return (
                                <p key={l.jobId} className="flex justify-between gap-2">
                                    <span className="truncate text-gray-700">{j?.job_number} · {j?.project_name}</span>
                                    <span className={`whitespace-nowrap font-semibold tabular-nums ${l.cleared ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {inr(l.apply)} {l.cleared ? '· cleared' : `· ${inr(l.dueBefore - l.apply)} still due`}
                                    </span>
                                </p>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 md:p-6">
            <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Money In</h2>
                        <p className="text-xs text-gray-500">Choose the party, enter what they paid. It clears their oldest orders first.</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Party</label>
                        <select value={clientId} onChange={e => { setClientId(e.target.value); setAmt({ blue: 0, red: 0 }); }} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white">
                            <option value="">Select party…</option>
                            {partyOptions.map(({ c, due: d }) => <option key={c.id} value={c.id}>{partyName(c)} — due {inr(d)}</option>)}
                        </select>
                    </div>

                    {cr && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded border border-blue-300 bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-800">Blue outstanding</p><p className="text-xl font-bold text-blue-900">{inr(due.blue)}</p></div>
                                <div className="rounded border border-red-300 bg-red-50 p-3"><p className="text-xs font-semibold text-red-800">Red outstanding</p><p className="text-xl font-bold text-red-900">{inr(due.red)}</p></div>
                            </div>
                            <div className="rounded-md border border-gray-200">
                                <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b">Their open orders, oldest first</p>
                                <div className="max-h-40 overflow-y-auto divide-y">
                                    {open.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">Nothing is due.</p>}
                                    {open.map(o => {
                                        const j = rec.jobById.get(o.jobId);
                                        return (
                                            <div key={o.jobId} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                                                <span className="min-w-0 truncate"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2">{j?.job_number}</span>{j?.project_name}<span className="text-xs text-gray-400"> · {o.ageDays}d old</span></span>
                                                <span className="whitespace-nowrap tabular-nums text-xs">
                                                    {o.blueDue > 0 && <span className="text-blue-700 font-semibold">B {inr(o.blueDue)}</span>}{o.blueDue > 0 && o.redDue > 0 && ' · '}{o.redDue > 0 && <span className="text-red-700 font-semibold">R {inr(o.redDue)}</span>}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {colourBlock('blue')}
                            {colourBlock('red')}
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Date received</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" /></div>
                                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Notes (optional)</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="UTR, cheque no., remarks…" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" /></div>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm flex justify-between"><span className="text-gray-600">Total received this entry</span><span className="font-bold text-gray-900">{inr(amt.blue + amt.red)}</span></div>
                        </>
                    )}
                </div>
                <div className="px-5 py-3 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm font-semibold hover:bg-gray-100">Cancel</button>
                    <button onClick={save} disabled={saving || !clientId} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Save Payment
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Payment log: every payment ever recorded. Admin can VOID one (with a reason).
// A voided payment is kept for the record but no longer counts; the FIFO is
// recomputed, so the orders it had cleared become due again.
export function PaymentLogModal({ rec, onClose }: { rec: OrderReceivables; onClose: () => void }) {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';
    const [voidId, setVoidId] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [q, setQ] = useState('');

    const rows = useMemo(() => [...rec.payments]
        .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)) || String(b.created_at).localeCompare(String(a.created_at)))
        .filter(p => !q || partyName(rec.clientById.get(p.client_id)).toLowerCase().includes(q.toLowerCase())), [rec.payments, rec.clientById, q]);

    const doVoid = async (id: string) => {
        if (!reason.trim()) return toast.error('Write the reason for voiding');
        setBusy(true);
        const { error } = await (supabase as any).from('receivables_payments')
            .update({ voided_at: new Date().toISOString(), void_reason: reason.trim() }).eq('id', id);
        setBusy(false);
        if (error) return toast.error(error.message || 'Could not void');
        toast.success('Payment voided. The orders it cleared are due again.');
        setVoidId(null); setReason('');
        await rec.reload();
    };

    const d = (v: string) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 md:p-6">
            <div className="bg-white rounded-lg w-full max-w-3xl shadow-xl">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Payment log</h2>
                        <p className="text-xs text-gray-500">{isAdmin ? 'A wrong entry cannot be edited. Void it with a reason, then record the correct one.' : 'Only an admin can void a payment.'}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-3">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search party…" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                    {rows.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">No payments recorded yet.</p>}
                    <ul className="divide-y border rounded-md">
                        {rows.map(p => {
                            const voided = !!p.voided_at;
                            return (
                                <li key={p.id} className={`px-3 py-2.5 text-sm ${voided ? 'bg-gray-50 text-gray-400' : ''}`}>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                        <span className="w-24 tabular-nums text-gray-500">{d(p.received_at)}</span>
                                        <span className={`font-semibold min-w-[8rem] ${voided ? 'line-through' : ''}`}>{partyName(rec.clientById.get(p.client_id))}</span>
                                        {p.amount_blue > 0 && <span className={`tabular-nums ${voided ? 'line-through' : 'text-blue-700 font-semibold'}`}>Blue {inr(p.amount_blue)} · {rec.methodName.get(p.method_blue) || '—'}</span>}
                                        {p.amount_red > 0 && <span className={`tabular-nums ${voided ? 'line-through' : 'text-red-700 font-semibold'}`}>Red {inr(p.amount_red)} · {rec.methodName.get(p.method_red) || '—'}</span>}
                                        {isAdmin && !voided && voidId !== p.id && (
                                            <button onClick={() => { setVoidId(p.id); setReason(''); }} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"><Ban className="w-3.5 h-3.5" />Void</button>
                                        )}
                                        {voided && <span className="ml-auto text-xs font-semibold uppercase">Voided</span>}
                                    </div>
                                    {p.notes && !voided && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                                    {voided && <p className="text-xs mt-0.5">Reason: {p.void_reason} · {d(p.voided_at)}</p>}
                                    {voidId === p.id && (
                                        <div className="mt-2 flex gap-2">
                                            <input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this being voided? (required)" className="flex-1 min-w-0 px-2 py-1.5 border border-red-300 rounded text-sm" />
                                            <button disabled={busy} onClick={() => doVoid(p.id)} className="px-3 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold disabled:opacity-50">Confirm void</button>
                                            <button onClick={() => setVoidId(null)} className="px-3 border border-gray-300 rounded text-xs font-semibold">Cancel</button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
}
