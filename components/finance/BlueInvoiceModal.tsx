'use client';

// Blue invoice for one order: only the Blue (invoiced) amount + GST, never the Red.
// Shown on screen as a page; Download / Print use the app's InvoicePDF so the file
// matches every other invoice. (The app's CSP blocks embedding a PDF in a frame.)

import { useMemo } from 'react';
import { X, Download, Printer, FileText } from 'lucide-react';
import { defaultCompanyData, downloadInvoicePDF, printInvoicePDF, type InvoiceData } from '@/components/invoice/InvoicePDF';
import { amountInWords } from '@/components/finance/ReceiptPDF';
import type { OrderRec } from '@/lib/order-receivables';

type Row = Record<string, any>;
const n = (v: any) => Number(v) || 0;
const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const money = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function blueAmountOf(job: Row) {
    return n(job.invoice_total) > 0 || n(job.invoice_amount) > 0 || n(job.pending_amount) > 0 ? n(job.invoice_amount) : n(job.subtotal);
}

export function buildBlueInvoiceData(job: Row, client: Row | undefined, rec: OrderRec | undefined, methodName: Map<string, string>): InvoiceData {
    const base = blueAmountOf(job);
    const rate = job.invoice_gst_rate != null ? n(job.invoice_gst_rate) : 18;
    const tax = Math.round(base * rate) / 100;
    const total = base + tax;
    // Home state Gujarat => CGST + SGST; any other state => IGST (same rule as the invoices page).
    const state = String(client?.state || '').trim().toLowerCase();
    const inter = state !== '' && state !== 'gujarat';
    const qty = n(job.quantity) > 0 ? n(job.quantity) : 1;

    const payments = (rec?.events || []).filter(e => e.colour === 'blue').map(e => {
        const gst = e.amount - e.amount / (1 + rate / 100);
        return { date: fmt(e.date), mode: (e.methodId && methodName.get(e.methodId)) || '', base: e.amount - gst, gst, total: e.amount };
    });
    const paid = rec ? rec.bluePaid : 0;
    const balance = Math.max(0, total - paid);

    return {
        ...defaultCompanyData,
        invoiceNumber: `INV-${job.job_number}`,
        invoiceDate: fmt(job.created_at) || fmt(new Date().toISOString()),
        dueDate: '',
        clientName: client?.name || '',
        clientCompany: client?.company || client?.name || '',
        clientAddress: client?.address || '',
        clientCity: client?.city || '',
        clientState: client?.state || '',
        clientPincode: client?.pincode || '',
        clientPhone: client?.phone || '',
        clientGstin: client?.gstin || '',
        deliverySameAsBilling: true,
        items: [{
            description: job.project_name || job.job_number,
            specs: [job.product_category, job.job_type].filter(Boolean).join(' · '),
            notes: `Order ${job.job_number}`,
            hsn: '4911',
            quantity: qty,
            rate: base / qty,
            amount: base,
        }],
        subtotal: base,
        cgstRate: rate / 2, cgstAmount: inter ? 0 : tax / 2,
        sgstRate: rate / 2, sgstAmount: inter ? 0 : tax / 2,
        igstRate: rate, igstAmount: inter ? tax : 0,
        totalTax: tax,
        discount: 0,
        grandTotal: total,
        isPaid: balance <= 0.5,
        payments,
        balanceDue: balance,
    };
}

export default function BlueInvoiceModal({ job, client, rec, methodName, onClose }: {
    job: Row; client?: Row; rec?: OrderRec; methodName: Map<string, string>; onClose: () => void;
}) {
    const d = useMemo(() => buildBlueInvoiceData(job, client, rec, methodName), [job, client, rec, methodName]);
    const item = d.items[0];
    const paid = (d.payments || []).reduce((s, p) => s + p.total, 0);

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 md:p-6">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[94vh] flex flex-col">
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" />Blue invoice</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => printInvoicePDF(d)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold hover:bg-gray-50"><Printer className="w-4 h-4" />Print</button>
                        <button onClick={() => downloadInvoicePDF(d)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold"><Download className="w-4 h-4" />Download PDF</button>
                        <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="overflow-y-auto p-4 md:p-6 bg-gray-100 rounded-b-lg">
                    <div className="bg-white shadow-sm border border-gray-200 rounded p-6 md:p-8 text-[13px] text-gray-800 space-y-5">
                        <div className="flex justify-between gap-6">
                            <div>
                                <p className="text-base font-bold text-gray-900">{d.companyName}</p>
                                <p className="text-gray-500 text-xs">{d.companyAddress}</p>
                                <p className="text-gray-500 text-xs">{d.companyCity}, {d.companyState} - {d.companyPincode}</p>
                                <p className="text-gray-500 text-xs">Phone: {d.companyPhone} · GSTIN: {d.companyGstin}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-blue-700 tracking-tight">TAX INVOICE</p>
                                <p className="text-xs text-gray-500 mt-1">No. <b className="text-gray-900">{d.invoiceNumber}</b></p>
                                <p className="text-xs text-gray-500">Date <b className="text-gray-900">{d.invoiceDate}</b></p>
                                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${d.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{d.isPaid ? 'Paid' : 'Payment pending'}</span>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Bill to</p>
                            <p className="font-bold text-gray-900">{d.clientCompany}</p>
                            {d.clientName && d.clientName !== d.clientCompany && <p>{d.clientName}</p>}
                            {(d.clientAddress || d.clientCity) && <p className="text-gray-600">{[d.clientAddress, d.clientCity, d.clientState, d.clientPincode].filter(Boolean).join(', ')}</p>}
                            {d.clientPhone && <p className="text-gray-600">Phone: {d.clientPhone}</p>}
                            {d.clientGstin && <p className="text-gray-600">GSTIN: {d.clientGstin}</p>}
                        </div>

                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                                    <th className="text-left px-3 py-2">Description</th><th className="px-3 py-2">HSN</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Rate</th><th className="text-right px-3 py-2">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-100 align-top">
                                    <td className="px-3 py-3">
                                        <p className="font-semibold text-gray-900">{item.description}</p>
                                        {item.specs && <p className="text-xs text-gray-500">{item.specs}</p>}
                                        {item.notes && <p className="text-xs text-gray-400">{item.notes}</p>}
                                    </td>
                                    <td className="px-3 py-3 text-center">{item.hsn}</td>
                                    <td className="px-3 py-3 text-right tabular-nums">{item.quantity.toLocaleString('en-IN')}</td>
                                    <td className="px-3 py-3 text-right tabular-nums">{money(item.rate)}</td>
                                    <td className="px-3 py-3 text-right tabular-nums font-semibold">{money(item.amount)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="flex justify-end">
                            <div className="w-full max-w-xs space-y-1.5 tabular-nums">
                                <p className="flex justify-between"><span className="text-gray-500">Taxable value</span><span>{money(d.subtotal)}</span></p>
                                {d.cgstAmount > 0 && <p className="flex justify-between"><span className="text-gray-500">CGST {d.cgstRate}%</span><span>{money(d.cgstAmount)}</span></p>}
                                {d.sgstAmount > 0 && <p className="flex justify-between"><span className="text-gray-500">SGST {d.sgstRate}%</span><span>{money(d.sgstAmount)}</span></p>}
                                {(d.igstAmount || 0) > 0 && <p className="flex justify-between"><span className="text-gray-500">IGST {d.igstRate}%</span><span>{money(d.igstAmount || 0)}</span></p>}
                                <p className="flex justify-between border-t border-gray-300 pt-1.5 text-base font-bold text-gray-900"><span>Total</span><span>{money(d.grandTotal)}</span></p>
                                {paid > 0 && <p className="flex justify-between text-emerald-700"><span>Received</span><span>- {money(paid)}</span></p>}
                                <p className="flex justify-between font-bold text-blue-700"><span>Balance due</span><span>{money(d.balanceDue || 0)}</span></p>
                            </div>
                        </div>

                        <p className="text-xs italic text-gray-600">Amount in words: {amountInWords(d.grandTotal)}</p>

                        {(d.payments || []).length > 0 && (
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Payments received</p>
                                {(d.payments || []).map((p, i) => (
                                    <p key={i} className="flex justify-between text-xs text-gray-700"><span>{p.date}{p.mode && ` · ${p.mode}`}</span><span className="tabular-nums">{money(p.total)}</span></p>
                                ))}
                            </div>
                        )}

                        <div className="border-t border-gray-200 pt-3 text-xs text-gray-600">
                            <p className="font-semibold text-gray-800">Bank details</p>
                            <p>{d.bankName} · A/c {d.bankAccount} · IFSC {d.bankIfsc} · {d.bankBranch}</p>
                        </div>
                    </div>
                    {n(job.pending_amount) > 0 && (
                        <p className="text-center text-xs text-red-600 mt-3">This invoice covers the Blue amount only. Red ₹{n(job.pending_amount).toLocaleString('en-IN')} is not invoiced.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
