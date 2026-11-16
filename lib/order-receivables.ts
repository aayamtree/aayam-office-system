// FIFO receivables engine.
//
// Every order carries two receivables: Blue (invoiced) and Red (pending). A
// payment is recorded against a CLIENT and a COLOUR, never against one order.
// It is applied to that client's oldest order that still owes money in that
// colour, then the next, and so on. Nothing is stored per order: allocations are
// recomputed from orders + payments, so an edit or a late back-dated entry can
// never leave the two out of step.

export type Colour = 'blue' | 'red';
type Row = Record<string, any>;

export interface PayEvent {
    paymentId: string;
    date: string;
    colour: Colour;
    amount: number;
    methodId?: string | null;
}

export interface OrderRec {
    jobId: string;
    clientId: string;
    blueTotal: number;
    redTotal: number;
    bluePaid: number;
    redPaid: number;
    blueDue: number;
    redDue: number;
    status: 'none' | 'unpaid' | 'partial' | 'paid';
    events: PayEvent[];
    ageDays: number;
}

export interface ClientRec {
    clientId: string;
    blueDue: number;
    redDue: number;
    advanceBlue: number;
    advanceRed: number;
    orders: OrderRec[];
}

const n = (v: any) => Number(v) || 0;
// Blue is what the party owes on the invoice, so it INCLUDES the GST charged on the blue amount.
// Orders saved before the Blue/Red split have invoice_total = 0 and pending_amount = 0
// (the migration defaults), so they fall back to total_amount. Any order saved through the
// new form has at least one of the two above zero whenever it has a price.
const isSplit = (j: Row) => n(j.invoice_total) > 0 || n(j.invoice_amount) > 0 || n(j.pending_amount) > 0;
export const blueOf = (j: Row) =>
    !isSplit(j) ? n(j.total_amount)
    : n(j.invoice_total) > 0 ? n(j.invoice_total)
    : n(j.invoice_amount) * (1 + (j.invoice_gst_rate != null ? n(j.invoice_gst_rate) : 18) / 100);
export const redOf = (j: Row) => n(j.pending_amount);
const orderTime = (j: Row) => new Date(j.created_at || j.order_date || 0).getTime();
const payTime = (p: Row) => new Date(p.received_at || p.created_at || 0).getTime();

export function computeFifo(jobs: Row[], payments: Row[]) {
    const now = Date.now();
    const byJob = new Map<string, OrderRec>();
    const byClient = new Map<string, ClientRec>();

    const sortedJobs = [...jobs].filter(j => j.client_id).sort((a, b) => orderTime(a) - orderTime(b));
    sortedJobs.forEach(j => {
        const rec: OrderRec = {
            jobId: j.id, clientId: j.client_id,
            blueTotal: blueOf(j), redTotal: redOf(j), bluePaid: 0, redPaid: 0, blueDue: blueOf(j), redDue: redOf(j),
            status: 'none', events: [], ageDays: Math.floor((now - orderTime(j)) / 86400000),
        };
        byJob.set(j.id, rec);
        const c: ClientRec = byClient.get(j.client_id) || { clientId: j.client_id, blueDue: 0, redDue: 0, advanceBlue: 0, advanceRed: 0, orders: [] };
        c.orders.push(rec);
        byClient.set(j.client_id, c);
    });

    [...payments].filter(p => !p.voided_at).sort((a, b) => payTime(a) - payTime(b) || String(a.created_at).localeCompare(String(b.created_at))).forEach(p => {
        const c: ClientRec = byClient.get(p.client_id) || { clientId: p.client_id, blueDue: 0, redDue: 0, advanceBlue: 0, advanceRed: 0, orders: [] };
        byClient.set(p.client_id, c);
        (['blue', 'red'] as Colour[]).forEach(col => {
            let left = n(col === 'blue' ? p.amount_blue : p.amount_red);
            const methodId = col === 'blue' ? p.method_blue : p.method_red;
            for (const o of c.orders) {
                if (left <= 0) break;
                const due = col === 'blue' ? o.blueDue : o.redDue;
                if (due <= 0) continue;
                const take = Math.min(due, left);
                left -= take;
                if (col === 'blue') { o.bluePaid += take; o.blueDue -= take; } else { o.redPaid += take; o.redDue -= take; }
                o.events.push({ paymentId: p.id, date: p.received_at || p.created_at, colour: col, amount: take, methodId });
            }
            if (left > 0) { if (col === 'blue') c.advanceBlue += left; else c.advanceRed += left; }
        });
    });

    byJob.forEach(o => {
        const total = o.blueTotal + o.redTotal, due = o.blueDue + o.redDue;
        o.status = total <= 0 ? 'none' : due <= 0 ? 'paid' : due < total ? 'partial' : 'unpaid';
    });
    byClient.forEach(c => {
        c.blueDue = c.orders.reduce((s, o) => s + o.blueDue, 0);
        c.redDue = c.orders.reduce((s, o) => s + o.redDue, 0);
    });
    return { byJob, byClient };
}

// How a lump sum would be applied right now, oldest order first.
export function previewAllocation(orders: OrderRec[], colour: Colour, amount: number) {
    let left = amount;
    const lines: { jobId: string; apply: number; dueBefore: number; cleared: boolean }[] = [];
    for (const o of orders) {
        if (left <= 0) break;
        const due = colour === 'blue' ? o.blueDue : o.redDue;
        if (due <= 0) continue;
        const apply = Math.min(due, left);
        left -= apply;
        lines.push({ jobId: o.jobId, apply, dueBefore: due, cleared: apply >= due });
    }
    return { lines, unapplied: left };
}
