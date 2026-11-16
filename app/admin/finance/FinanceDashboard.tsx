'use client';

// FINANCE DASHBOARD — the money picture in one screen.
// Blue = invoiced (GST 18%), Red = pending / not invoiced. Everything is INR.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { blueOf, redOf, computeFifo } from '@/lib/order-receivables';
import { fetchAll, JOB_COLS, CLIENT_COLS } from '@/lib/fetch-all';
import { useAuth } from '@/lib/auth-context';
import {
    IndianRupee, TrendingUp, Wallet, FileText, Hourglass, Percent, ArrowUpRight,
    CheckCircle2, Clock, AlertTriangle, Sparkles, RefreshCw, Table2, BarChart3,
} from 'lucide-react';

type Row = Record<string, any>;
type Period = 'all' | '30' | '90' | 'month';

const DAY = 86400000;
const PERIODS: { id: Period; label: string }[] = [
    { id: 'month', label: 'This month' },
    { id: '30', label: '30 days' },
    { id: '90', label: '90 days' },
    { id: 'all', label: 'All time' },
];

const css = `
.fin-dash {
  color-scheme: light;
  --surface: #fcfcfb; --plane: #f9f9f7;
  --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --ring: rgba(11,11,11,0.10);
  --blue: #2a78d6; --red: #e34948; --aqua: #1baf7a;
  --blue-tint: rgba(42,120,214,0.14); --red-tint: rgba(227,73,72,0.14);
  --good: #0ca30c; --good-ink: #006300; --warn: #fab219; --warn-ink: #8a5a00; --crit: #d03b3b;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .fin-dash {
    color-scheme: dark;
    --surface: #1a1a19; --plane: #0d0d0d;
    --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10);
    --blue: #3987e5; --red: #e66767; --aqua: #199e70;
    --blue-tint: rgba(57,135,229,0.22); --red-tint: rgba(230,103,103,0.22);
    --good-ink: #0ca30c; --warn-ink: #fab219;
  }
}
:root[data-theme="dark"] .fin-dash {
  color-scheme: dark;
  --surface: #1a1a19; --plane: #0d0d0d;
  --ink: #f0efec; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --ring: rgba(255,255,255,0.10);
  --blue: #3987e5; --red: #e66767; --aqua: #199e70;
  --blue-tint: rgba(57,135,229,0.22); --red-tint: rgba(230,103,103,0.22);
  --good-ink: #0ca30c; --warn-ink: #fab219;
}
.fin-dash .card { background: var(--surface); border: 1px solid var(--ring); border-radius: 16px; }
.fin-dash .eyebrow { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.fin-dash .num { font-variant-numeric: tabular-nums; }
`;

const inr = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
function compact(n: number) {
    const v = Math.abs(n || 0), s = n < 0 ? '-' : '';
    if (v >= 1e7) return `${s}₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
    if (v >= 1e5) return `${s}₹${(v / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
    if (v >= 1e3) return `${s}₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')} K`;
    return `${s}₹${Math.round(v)}`;
}
const num = (v: any) => Number(v) || 0;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const partyName = (c?: Row) => c?.company || c?.name || 'Unknown';
const shortDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

type Tip = { x: number; y: number; title: string; rows: { label: string; value: string; color?: string }[] } | null;

export default function FinanceDashboard() {
    const { profile, loading: authLoading } = useAuth();
    const allowed = profile?.role === 'admin' || profile?.role === 'finance';
    const [clients, setClients] = useState<Row[]>([]);
    const [jobs, setJobs] = useState<Row[]>([]);
    const [pays, setPays] = useState<Row[]>([]);
    const [methods, setMethods] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('90');
    const [tableView, setTableView] = useState(false);
    const [tip, setTip] = useState<Tip>(null);
    const [stamp, setStamp] = useState<Date | null>(null);

    const load = async () => {
        const db = supabase as any;
        try {
            const [c, j, p, m] = await Promise.all([
                fetchAll(db, 'clients', CLIENT_COLS),
                fetchAll(db, 'jobs', JOB_COLS),
                fetchAll(db, 'receivables_payments', '*', 'created_at'),
                db.from('payment_methods').select('*'),
            ]);
            setClients(c); setJobs(j); setPays(p.filter((x: Row) => !x.voided_at)); setMethods(m.data || []);
        } catch (e) { console.error('Finance dashboard load failed', e); }
        setStamp(new Date()); setLoading(false);
    };
    useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);

    const d = useMemo(() => {
        const now = Date.now();
        const clientById = new Map(clients.map(c => [c.id, c]));
        const methodName = new Map(methods.map(m => [m.id, m.name]));
        const start = period === 'all' ? 0
            : period === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
            : now - Number(period) * DAY;
        const jobTime = (j: Row) => new Date(j.created_at).getTime();
        const payTime = (p: Row) => new Date(p.received_at || p.created_at).getTime();

        const pJobs = jobs.filter(j => jobTime(j) >= start);
        const pPays = pays.filter(p => payTime(p) >= start);

        const billed = pJobs.reduce((s, j) => s + num(j.subtotal), 0);
        const blueBilled = pJobs.reduce((s, j) => s + num(j.invoice_amount), 0);
        const redBilled = pJobs.reduce((s, j) => s + num(j.pending_amount), 0);
        const gst = pJobs.reduce((s, j) => s + num(j.invoice_gst_amount), 0);
        const blueCol = pPays.reduce((s, p) => s + num(p.amount_blue), 0);
        const redCol = pPays.reduce((s, p) => s + num(p.amount_red), 0);

        // All-time position (receivables are "as of today")
        const allBlue = jobs.reduce((s, j) => s + blueOf(j), 0);
        const allRed = jobs.reduce((s, j) => s + redOf(j), 0);
        const allBlueCol = pays.reduce((s, p) => s + num(p.amount_blue), 0);
        const allRedCol = pays.reduce((s, p) => s + num(p.amount_red), 0);
        // Same engine as the Orders page, so Blue due / Red due always match it.
        const fifoAll = computeFifo(jobs, pays);
        let outBlue = 0, outRed = 0;
        fifoAll.byJob.forEach(o => { outBlue += o.blueDue; outRed += o.redDue; });

        // Per party + FIFO ageing (payments clear the oldest orders first)
        const aging = [
            { label: '0–15 days', blue: 0, red: 0 },
            { label: '16–30 days', blue: 0, red: 0 },
            { label: '31–60 days', blue: 0, red: 0 },
            { label: '60+ days', blue: 0, red: 0 },
        ];
        const bucket = (days: number) => (days <= 15 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3);
        const parties = clients.map(c => {
            const cj = jobs.filter(j => j.client_id === c.id).sort((a, b) => jobTime(a) - jobTime(b));
            const cp = pays.filter(p => p.client_id === c.id);
            let rb = cp.reduce((s, p) => s + num(p.amount_blue), 0);
            let rr = cp.reduce((s, p) => s + num(p.amount_red), 0);
            let ob = 0, orr = 0, oldest = 0;
            cj.forEach(j => {
                const age = Math.floor((now - jobTime(j)) / DAY);
                const bb = blueOf(j), rd = redOf(j);
                const payB = Math.min(bb, rb); rb -= payB;
                const payR = Math.min(rd, rr); rr -= payR;
                const remB = bb - payB, remR = rd - payR;
                if (remB > 0) { aging[bucket(age)].blue += remB; ob += remB; }
                if (remR > 0) { aging[bucket(age)].red += remR; orr += remR; }
                if (remB + remR > 0) oldest = Math.max(oldest, age);
            });
            return { client: c, outBlue: ob, outRed: orr, out: ob + orr, oldest };
        }).filter(p => p.out > 0 || jobs.some(j => j.client_id === p.client.id && (blueOf(j) + redOf(j)) > 0))
          .sort((a, b) => b.out - a.out);

        // Weekly trend, last 8 weeks
        const weeks = Array.from({ length: 8 }, (_, i) => {
            const end = now - (7 - i) * 7 * DAY, from = end - 7 * DAY;
            const inW = (t: number) => t > from && t <= end;
            return {
                label: shortDate(new Date(from + DAY)),
                blue: pays.filter(p => inW(payTime(p))).reduce((s, p) => s + num(p.amount_blue), 0),
                red: pays.filter(p => inW(payTime(p))).reduce((s, p) => s + num(p.amount_red), 0),
                billed: jobs.filter(j => inW(jobTime(j))).reduce((s, j) => s + num(j.subtotal), 0),
            };
        });

        // Payment methods (within period)
        const mm = new Map<string, { name: string; blue: number; red: number }>();
        pPays.forEach(p => {
            ([['blue', p.method_blue, p.amount_blue], ['red', p.method_red, p.amount_red]] as const).forEach(([col, id, amt]) => {
                if (!id || !num(amt)) return;
                const name = methodName.get(id) || 'Other';
                const row = mm.get(name) || { name, blue: 0, red: 0 };
                row[col] += num(amt); mm.set(name, row);
            });
        });
        const byMethod = Array.from(mm.values()).sort((a, b) => (b.blue + b.red) - (a.blue + a.red));

        const recent = [...pays].sort((a, b) => payTime(b) - payTime(a) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 7)
            .map(p => ({ ...p, party: partyName(clientById.get(p.client_id)), mb: methodName.get(p.method_blue), mr: methodName.get(p.method_red) }));

        return { billed, blueBilled, redBilled, gst, blueCol, redCol, allBlue, allRed, allBlueCol, allRedCol, outBlue, outRed, aging, parties, weeks, byMethod, recent, orders: pJobs.length };
    }, [clients, jobs, pays, methods, period]);

    const totalOut = d.outBlue + d.outRed;
    const totalBilledAll = d.allBlue + d.allRed;
    const totalColAll = d.allBlueCol + d.allRedCol;
    const rate = pct(totalColAll, totalBilledAll);
    const overdue30 = d.aging[2].blue + d.aging[2].red + d.aging[3].blue + d.aging[3].red;
    const topDebtor = d.parties[0];
    const topMethod = d.byMethod[0];

    const insights = [
        topDebtor && topDebtor.out > 0 && { tone: 'info', text: `${partyName(topDebtor.client)} owes the most: ${inr(topDebtor.out)} (${pct(topDebtor.out, totalOut)}% of all dues).` },
        totalOut > 0 && { tone: d.outRed > d.outBlue ? 'warn' : 'info', text: `Red is ${pct(d.outRed, totalOut)}% of what's outstanding (${inr(d.outRed)}) and is not invoiced yet.` },
        overdue30 > 0 && { tone: 'crit', text: `${inr(overdue30)} has been unpaid for more than 30 days.` },
        d.gst > 0 && { tone: 'info', text: `GST on Blue invoices in this period: ${inr(d.gst)} (18% of ${inr(d.blueBilled)}).` },
        topMethod && { tone: 'good', text: `${topMethod.name} is the most-used payment method (${inr(topMethod.blue + topMethod.red)} this period).` },
        { tone: rate >= 60 ? 'good' : 'warn', text: `${rate}% of everything billed has been collected so far.` },
    ].filter(Boolean) as { tone: string; text: string }[];

    const showTip = (e: React.MouseEvent, title: string, rows: NonNullable<Tip>['rows']) =>
        setTip({ x: e.clientX, y: e.clientY, title, rows });
    const hide = () => setTip(null);

    if (!authLoading && !allowed) {
        return <div className="p-8 text-sm text-gray-500">The receivables dashboard is only for admin and finance users.</div>;
    }

    return (
        <div className="fin-dash p-4 md:p-6 space-y-5" style={{ background: 'var(--plane)', color: 'var(--ink)', minHeight: '100%' }}>
            <style>{css}</style>

            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Finance Dashboard</h1>
                    <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                        Blue is invoiced with 18% GST. Red is pending and not invoiced. All figures in ₹.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div role="group" aria-label="Period" className="inline-flex rounded-lg p-0.5" style={{ background: 'var(--surface)', border: '1px solid var(--ring)' }}>
                        {PERIODS.map(p => (
                            <button key={p.id} onClick={() => setPeriod(p.id)} aria-pressed={period === p.id}
                                className="px-3 py-1.5 text-xs font-semibold rounded-md transition"
                                style={period === p.id ? { background: 'var(--ink)', color: 'var(--surface)' } : { color: 'var(--ink-2)' }}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={load} title="Refresh" className="p-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--ring)' }}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <Link href="/admin/sales/orders?moneyIn=1" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--blue)' }}>
                        <IndianRupee className="w-4 h-4" /> Record money in
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="card p-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading finance data…</div>
            ) : (
                <>
                    {/* Hero: receivable position */}
                    <section className="card p-5 md:p-6">
                        <div className="grid lg:grid-cols-[minmax(240px,1fr)_2fr] gap-6 items-center">
                            <div>
                                <p className="eyebrow">Total outstanding</p>
                                <p className="num text-4xl md:text-5xl font-bold tracking-tight mt-1">{inr(totalOut)}</p>
                                <p className="text-sm mt-2" style={{ color: 'var(--ink-2)' }}>
                                    across {d.parties.filter(p => p.out > 0).length} parties · collection rate <b style={{ color: 'var(--ink)' }}>{rate}%</b>
                                </p>
                                <div className="mt-4 flex gap-4 text-sm">
                                    <span className="inline-flex items-center gap-2"><i className="w-3 h-3 rounded-sm" style={{ background: 'var(--blue)' }} />Blue <b className="num">{compact(d.outBlue)}</b></span>
                                    <span className="inline-flex items-center gap-2"><i className="w-3 h-3 rounded-sm" style={{ background: 'var(--red)' }} />Red <b className="num">{compact(d.outRed)}</b></span>
                                </div>
                            </div>
                            <div className="space-y-5">
                                {([
                                    ['Blue — invoiced (incl. GST)', 'var(--blue)', 'var(--blue-tint)', d.allBlue, d.allBlueCol, d.outBlue],
                                    ['Red — pending', 'var(--red)', 'var(--red-tint)', d.allRed, d.allRedCol, d.outRed],
                                ] as const).map(([label, solid, tint, billed, col, out]) => (
                                    <div key={label}>
                                        <div className="flex items-baseline justify-between text-sm mb-1.5">
                                            <span className="font-semibold">{label}</span>
                                            <span className="num" style={{ color: 'var(--ink-2)' }}>
                                                {inr(col)} collected of {inr(billed)} <b style={{ color: 'var(--ink)' }}>({pct(col, billed)}%)</b>
                                            </span>
                                        </div>
                                        <div className="flex h-3.5 rounded-full overflow-hidden gap-[2px]" style={{ background: 'transparent' }}
                                            onMouseMove={e => showTip(e, label, [
                                                { label: 'Billed', value: inr(billed) }, { label: 'Collected', value: inr(col), color: solid }, { label: 'Outstanding', value: inr(out), color: tint },
                                            ])} onMouseLeave={hide}>
                                            <div style={{ width: `${billed ? (col / billed) * 100 : 0}%`, background: solid, borderRadius: '999px 0 0 999px' }} />
                                            <div style={{ flex: 1, background: tint, borderRadius: '0 999px 999px 0' }} />
                                        </div>
                                        <div className="flex justify-between text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                                            <span>Collected</span><span>Outstanding {inr(out)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* KPI tiles */}
                    <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        <Kpi icon={<FileText className="w-4 h-4" />} label="Order value" value={compact(d.billed)} sub={`${d.orders} orders · before GST`} />
                        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Blue invoiced" value={compact(d.blueBilled)} accent="var(--blue)" sub={`+ ${compact(d.gst)} GST (18%) · invoice ${compact(d.blueBilled + d.gst)}`} />
                        <Kpi icon={<Hourglass className="w-4 h-4" />} label="Red pending" value={compact(d.redBilled)} accent="var(--red)" sub={`${pct(d.redBilled, d.billed)}% of order value, not invoiced`} />
                        <Kpi icon={<Wallet className="w-4 h-4" />} label="Collected" value={compact(d.blueCol + d.redCol)} accent="var(--aqua)" sub={`Blue ${compact(d.blueCol)} · Red ${compact(d.redCol)}`} />
                    </section>

                    {/* Trend + key points */}
                    <section className="grid lg:grid-cols-3 gap-4">
                        <div className="card p-5 lg:col-span-2">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <h2 className="font-semibold">Collections, last 8 weeks</h2>
                                    <p className="text-xs" style={{ color: 'var(--ink-2)' }}>Money received each week, with the value of new orders as a dashed line.</p>
                                </div>
                                <button onClick={() => setTableView(v => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md" style={{ border: '1px solid var(--ring)', color: 'var(--ink-2)' }}>
                                    {tableView ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}{tableView ? 'Chart' : 'Table'}
                                </button>
                            </div>
                            {tableView ? (
                                <table className="w-full text-sm num">
                                    <thead><tr style={{ color: 'var(--muted)' }} className="text-xs text-right"><th className="text-left py-1.5 font-semibold">Week of</th><th className="font-semibold">Blue</th><th className="font-semibold">Red</th><th className="font-semibold">New orders</th></tr></thead>
                                    <tbody>{d.weeks.map(w => (
                                        <tr key={w.label} className="text-right" style={{ borderTop: '1px solid var(--grid)' }}>
                                            <td className="text-left py-1.5">{w.label}</td><td>{inr(w.blue)}</td><td>{inr(w.red)}</td><td>{inr(w.billed)}</td>
                                        </tr>))}</tbody>
                                </table>
                            ) : (
                                <TrendChart weeks={d.weeks} showTip={showTip} hide={hide} />
                            )}
                            <div className="flex flex-wrap gap-4 text-xs mt-2" style={{ color: 'var(--ink-2)' }}>
                                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: 'var(--blue)' }} />Blue collected</span>
                                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: 'var(--red)' }} />Red collected</span>
                                <span className="inline-flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--ink-2)' }} />New orders</span>
                            </div>
                        </div>

                        <div className="card p-5">
                            <h2 className="font-semibold inline-flex items-center gap-2"><Sparkles className="w-4 h-4" style={{ color: 'var(--blue)' }} />Key points</h2>
                            <ul className="mt-3 space-y-3">
                                {insights.map((it, i) => {
                                    const Icon = it.tone === 'crit' ? AlertTriangle : it.tone === 'warn' ? Clock : it.tone === 'good' ? CheckCircle2 : ArrowUpRight;
                                    const col = it.tone === 'crit' ? 'var(--crit)' : it.tone === 'warn' ? 'var(--warn-ink)' : it.tone === 'good' ? 'var(--good-ink)' : 'var(--blue)';
                                    return (
                                        <li key={i} className="flex gap-2.5 text-sm leading-snug">
                                            <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: col }} />
                                            <span style={{ color: 'var(--ink-2)' }}>{it.text}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </section>

                    {/* Ageing + debtors */}
                    <section className="grid lg:grid-cols-3 gap-4">
                        <div className="card p-5">
                            <h2 className="font-semibold">Ageing of dues</h2>
                            <p className="text-xs mb-4" style={{ color: 'var(--ink-2)' }}>How long outstanding money has been waiting.</p>
                            <StackRows
                                rows={d.aging.map(a => ({ name: a.label, blue: a.blue, red: a.red }))}
                                showTip={showTip} hide={hide}
                            />
                        </div>

                        <div className="card p-5 lg:col-span-2">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="font-semibold">Who owes us</h2>
                                    <p className="text-xs" style={{ color: 'var(--ink-2)' }}>Largest dues first. Bar shows Blue and Red.</p>
                                </div>
                                <Link href="/admin/sales/orders" className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: 'var(--blue)' }}>Open orders <ArrowUpRight className="w-3.5 h-3.5" /></Link>
                            </div>
                            <div className="space-y-3">
                                {d.parties.slice(0, 7).map(p => {
                                    const max = d.parties[0]?.out || 1;
                                    const st = p.out === 0 ? { t: 'Clear', Icon: CheckCircle2, c: 'var(--good-ink)' }
                                        : p.oldest > 30 ? { t: 'Overdue', Icon: AlertTriangle, c: 'var(--crit)' }
                                        : p.oldest > 15 ? { t: 'Follow up', Icon: Clock, c: 'var(--warn-ink)' } : { t: 'On time', Icon: CheckCircle2, c: 'var(--good-ink)' };
                                    return (
                                        <div key={p.client.id} className="grid grid-cols-[minmax(110px,170px)_1fr_auto] items-center gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{partyName(p.client)}</p>
                                                <p className="text-[11px] inline-flex items-center gap-1" style={{ color: st.c }}><st.Icon className="w-3 h-3" />{st.t}{p.out > 0 && ` · ${p.oldest}d old`}</p>
                                            </div>
                                            <div className="flex h-4 gap-[2px]" style={{ width: `${Math.max(4, (p.out / max) * 100)}%` }}
                                                onMouseMove={e => showTip(e, partyName(p.client), [
                                                    { label: 'Blue due', value: inr(p.outBlue), color: 'var(--blue)' }, { label: 'Red due', value: inr(p.outRed), color: 'var(--red)' }, { label: 'Total', value: inr(p.out) },
                                                ])} onMouseLeave={hide}>
                                                {p.outBlue > 0 && <div style={{ flex: p.outBlue, background: 'var(--blue)', borderRadius: '2px 4px 4px 2px' }} />}
                                                {p.outRed > 0 && <div style={{ flex: p.outRed, background: 'var(--red)', borderRadius: '2px 4px 4px 2px' }} />}
                                            </div>
                                            <span className="num text-sm font-semibold text-right min-w-[84px]">{compact(p.out)}</span>
                                        </div>
                                    );
                                })}
                                {d.parties.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>No parties with orders yet.</p>}
                            </div>
                        </div>
                    </section>

                    {/* Methods + recent */}
                    <section className="grid lg:grid-cols-3 gap-4">
                        <div className="card p-5">
                            <h2 className="font-semibold">How money arrives</h2>
                            <p className="text-xs mb-4" style={{ color: 'var(--ink-2)' }}>Collections by payment method in this period.</p>
                            {d.byMethod.length ? (
                                <StackRows rows={d.byMethod.map(m => ({ name: m.name, blue: m.blue, red: m.red }))} showTip={showTip} hide={hide} />
                            ) : <p className="text-sm" style={{ color: 'var(--muted)' }}>No payments in this period.</p>}
                        </div>

                        <div className="card p-5 lg:col-span-2">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="font-semibold">Recent payments</h2>
                                <span className="text-xs" style={{ color: 'var(--muted)' }}>Latest 7</span>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'var(--grid)' }}>
                                {d.recent.map((p: Row) => (
                                    <div key={p.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: 'var(--grid)' }}>
                                        <div className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ background: 'var(--blue-tint)', color: 'var(--blue)' }}><IndianRupee className="w-4 h-4" /></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{p.party}</p>
                                            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                                                {new Date(p.received_at || p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                {p.mb && ` · Blue via ${p.mb}`}{p.mr && ` · Red via ${p.mr}`}
                                            </p>
                                        </div>
                                        <div className="text-right num">
                                            <p className="text-sm font-semibold">{inr(num(p.amount_blue) + num(p.amount_red))}</p>
                                            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                                                {num(p.amount_blue) > 0 && <span style={{ color: 'var(--blue)' }}>B {compact(num(p.amount_blue))}</span>}
                                                {num(p.amount_blue) > 0 && num(p.amount_red) > 0 && ' · '}
                                                {num(p.amount_red) > 0 && <span style={{ color: 'var(--red)' }}>R {compact(num(p.amount_red))}</span>}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {d.recent.length === 0 && <p className="text-sm py-4" style={{ color: 'var(--muted)' }}>No payments recorded yet.</p>}
                            </div>
                        </div>
                    </section>

                    <p className="text-[11px] text-right" style={{ color: 'var(--muted)' }}>
                        {stamp && `Updated ${stamp.toLocaleTimeString('en-IN')}`} · Outstanding, ageing and who-owes-us are as of today; the other figures follow the period above.
                    </p>
                </>
            )}

            {tip && (
                <div role="tooltip" className="fixed z-50 pointer-events-none rounded-lg px-3 py-2 text-xs shadow-lg"
                    style={{ left: tip.x + 14, top: tip.y + 14, background: 'var(--surface)', border: '1px solid var(--ring)', color: 'var(--ink)', minWidth: 150 }}>
                    <p className="font-semibold mb-1">{tip.title}</p>
                    {tip.rows.map(r => (
                        <p key={r.label} className="flex justify-between gap-4 num">
                            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
                                {r.color && <i className="w-2.5 h-2.5 rounded-sm" style={{ background: r.color }} />}{r.label}
                            </span>
                            <b>{r.value}</b>
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: string }) {
    return (
        <div className="card p-4">
            <div className="flex items-center gap-2 eyebrow">
                <span className="grid place-items-center w-6 h-6 rounded-md" style={{ background: accent ? `color-mix(in srgb, ${accent} 16%, transparent)` : 'var(--grid)', color: accent || 'var(--ink-2)' }}>{icon}</span>
                {label}
            </div>
            <p className="num text-2xl md:text-3xl font-bold tracking-tight mt-2">{value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>{sub}</p>
        </div>
    );
}

function StackRows({ rows, showTip, hide }: {
    rows: { name: string; blue: number; red: number }[];
    showTip: (e: React.MouseEvent, title: string, rows: { label: string; value: string; color?: string }[]) => void;
    hide: () => void;
}) {
    const max = Math.max(1, ...rows.map(r => r.blue + r.red));
    return (
        <div className="space-y-3.5">
            {rows.map(r => {
                const t = r.blue + r.red;
                return (
                    <div key={r.name}>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{r.name}</span>
                            <span className="num font-semibold">{t ? compact(t) : '—'}</span>
                        </div>
                        <div className="h-3.5 flex gap-[2px]" style={{ width: `${Math.max(t ? 3 : 0, (t / max) * 100)}%` }}
                            onMouseMove={e => showTip(e, r.name, [
                                { label: 'Blue', value: inr(r.blue), color: 'var(--blue)' }, { label: 'Red', value: inr(r.red), color: 'var(--red)' }, { label: 'Total', value: inr(t) },
                            ])} onMouseLeave={hide}>
                            {r.blue > 0 && <div style={{ flex: r.blue, background: 'var(--blue)', borderRadius: '2px 4px 4px 2px' }} />}
                            {r.red > 0 && <div style={{ flex: r.red, background: 'var(--red)', borderRadius: '2px 4px 4px 2px' }} />}
                        </div>
                    </div>
                );
            })}
            <div className="flex gap-4 text-xs pt-1" style={{ color: 'var(--ink-2)' }}>
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: 'var(--blue)' }} />Blue</span>
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: 'var(--red)' }} />Red</span>
            </div>
        </div>
    );
}

function TrendChart({ weeks, showTip, hide }: {
    weeks: { label: string; blue: number; red: number; billed: number }[];
    showTip: (e: React.MouseEvent, title: string, rows: { label: string; value: string; color?: string }[]) => void;
    hide: () => void;
}) {
    const W = 640, H = 250, L = 46, R = 10, T = 12, B = 28;
    const rawMax = Math.max(1, ...weeks.map(w => Math.max(w.blue + w.red, w.billed)));
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax / 4)));
    const unit = [1, 2, 2.5, 5, 10].map(m => m * mag).find(c => c * 4 >= rawMax) || mag * 10;
    const niceMax = unit * 4;
    const ticks = [0, 1, 2, 3, 4].map(i => unit * i);
    const y = (v: number) => T + (H - T - B) * (1 - v / niceMax);
    const slot = (W - L - R) / weeks.length;
    const bw = Math.min(34, slot * 0.55);
    const gap = 2;
    const top = (x: number, yy: number, w: number, h: number, r: number) =>
        `M${x},${yy + h} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + w - r} Q${x + w},${yy} ${x + w},${yy + r} V${yy + h} Z`;
    const line = weeks.map((w, i) => `${i ? 'L' : 'M'}${L + slot * i + slot / 2},${y(w.billed)}`).join(' ');

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Weekly collections for the last eight weeks, Blue and Red">
            {ticks.map(t => (
                <g key={t}>
                    <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth="1" />
                    <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)" className="num">{compact(t)}</text>
                </g>
            ))}
            {weeks.map((w, i) => {
                const cx = L + slot * i + slot / 2, x = cx - bw / 2;
                const hb = y(0) - y(w.blue), hr = y(0) - y(w.red);
                return (
                    <g key={w.label}>
                        {w.blue > 0 && (w.red > 0
                            ? <rect x={x} y={y(w.blue)} width={bw} height={hb} fill="var(--blue)" />
                            : <path d={top(x, y(w.blue), bw, hb, 4)} fill="var(--blue)" />)}
                        {w.red > 0 && <path d={top(x, y(w.blue + w.red) , bw, hr - gap, 4)} fill="var(--red)" />}
                        <text x={cx} y={H - 9} textAnchor="middle" fontSize="10" fill="var(--muted)">{w.label}</text>
                        <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent"
                            onMouseMove={e => showTip(e, `Week of ${w.label}`, [
                                { label: 'Blue collected', value: inr(w.blue), color: 'var(--blue)' },
                                { label: 'Red collected', value: inr(w.red), color: 'var(--red)' },
                                { label: 'New orders', value: inr(w.billed) },
                            ])} onMouseLeave={hide} />
                    </g>
                );
            })}
            <path d={line} fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeDasharray="5 4" pointerEvents="none" />
            {weeks.map((w, i) => (
                <circle key={i} cx={L + slot * i + slot / 2} cy={y(w.billed)} r="4" fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="2" pointerEvents="none" />
            ))}
        </svg>
    );
}
