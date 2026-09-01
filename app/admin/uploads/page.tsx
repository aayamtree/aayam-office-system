'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
    Paperclip, FileText, Search, RefreshCw, ExternalLink,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────
type UploadKind =
    | 'job_sheet' | 'invoice' | 'eway' | 'goods_photo'
    | 'payment_proof' | 'dispatch_receipt' | 'proof_of_delivery'
    | 'purchase_bill' | 'staff_id';

interface UploadItem {
    key: string;
    url: string;
    kind: UploadKind;
    title: string;
    subtitle: string;
    date: string | null;
}

const KIND_META: Record<UploadKind, { label: string; color: string }> = {
    job_sheet: { label: 'Job Sheet', color: 'bg-blue-100 text-blue-700' },
    invoice: { label: 'Invoice', color: 'bg-green-100 text-green-700' },
    eway: { label: 'E-way Bill', color: 'bg-teal-100 text-teal-700' },
    goods_photo: { label: 'Goods Photo', color: 'bg-amber-100 text-amber-700' },
    payment_proof: { label: 'Payment Proof', color: 'bg-purple-100 text-purple-700' },
    dispatch_receipt: { label: 'Dispatch Receipt', color: 'bg-orange-100 text-orange-700' },
    proof_of_delivery: { label: 'Proof of Delivery', color: 'bg-pink-100 text-pink-700' },
    purchase_bill: { label: 'Purchase Bill', color: 'bg-red-100 text-red-700' },
    staff_id: { label: 'Staff ID Doc', color: 'bg-gray-200 text-gray-700' },
};

const KIND_ORDER: UploadKind[] = [
    'job_sheet', 'invoice', 'eway', 'goods_photo', 'payment_proof',
    'dispatch_receipt', 'proof_of_delivery', 'purchase_bill', 'staff_id',
];

// Every upload in this app is saved as a plain URL — sniff the extension to
// decide whether a real thumbnail can be shown or it needs a document icon
// (mostly PDFs: purchase bills, some invoices/e-way bills).
const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|heic|bmp|avif)(\?|$)/i.test(url);

export default function AllUploadsPage() {
    const [items, setItems] = useState<UploadItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [kindFilter, setKindFilter] = useState<UploadKind | 'all'>('all');
    const [search, setSearch] = useState('');

    useEffect(() => { fetchAll(); }, []);

    // ─── Fetch every known upload source in parallel ────────
    // One page pulling from six different tables — each source is optional:
    // if one query fails the others still render, rather than the whole
    // gallery going blank over one bad table.
    const fetchAll = async () => {
        setLoading(true);
        try {
            const [runsRes, qcRes, paymentsRes, dispatchesRes, billsRes, staffRes] = await Promise.all([
                supabase.from('print_runs')
                    .select('id, print_run_number, notes, job_sheet_url, invoice_doc_url, eway_doc_url, created_at')
                    .or('job_sheet_url.not.is.null,invoice_doc_url.not.is.null,eway_doc_url.not.is.null')
                    .order('created_at', { ascending: false }),
                supabase.from('qc_records')
                    .select('id, photos, created_at, print_runs(print_run_number, notes)')
                    .order('created_at', { ascending: false })
                    .limit(1000),
                supabase.from('payments_received')
                    .select('id, attachment_url, amount, payment_date, created_at, jobs(job_number, project_name, clients(name))')
                    .not('attachment_url', 'is', null)
                    .order('created_at', { ascending: false }),
                supabase.from('dispatches')
                    .select('id, receipt_url, proof_of_delivery_url, dispatch_date, consignment_no, created_at, jobs(job_number, project_name, clients(name))')
                    .or('receipt_url.not.is.null,proof_of_delivery_url.not.is.null')
                    .order('created_at', { ascending: false }),
                supabase.from('purchase_bills')
                    .select('id, bill_number, vendor_bill_number, attachment_url, bill_date, created_at, vendors(name)')
                    .not('attachment_url', 'is', null)
                    .order('created_at', { ascending: false }),
                supabase.from('profiles')
                    .select('id, full_name, document_url, role, created_at')
                    .not('document_url', 'is', null)
                    .order('created_at', { ascending: false }),
            ]);

            const mapped: UploadItem[] = [];
            let failures = 0;

            if (runsRes.error) failures++;
            (runsRes.data || []).forEach((r: any) => {
                const title = r.print_run_number || 'Print run';
                const subtitle = r.notes || '';
                if (r.job_sheet_url) mapped.push({ key: `job_sheet-${r.id}`, url: r.job_sheet_url, kind: 'job_sheet', title, subtitle, date: r.created_at });
                if (r.invoice_doc_url) mapped.push({ key: `invoice-${r.id}`, url: r.invoice_doc_url, kind: 'invoice', title, subtitle, date: r.created_at });
                if (r.eway_doc_url) mapped.push({ key: `eway-${r.id}`, url: r.eway_doc_url, kind: 'eway', title, subtitle, date: r.created_at });
            });

            if (qcRes.error) failures++;
            (qcRes.data || []).forEach((rec: any) => {
                const photos: string[] = Array.isArray(rec.photos) ? rec.photos : [];
                photos.forEach((url, i) => {
                    if (!url) return;
                    mapped.push({
                        key: `goods_photo-${rec.id}-${i}`,
                        url,
                        kind: 'goods_photo',
                        title: rec.print_runs?.print_run_number || 'Print run',
                        subtitle: rec.print_runs?.notes || '',
                        date: rec.created_at,
                    });
                });
            });

            if (paymentsRes.error) failures++;
            (paymentsRes.data || []).forEach((p: any) => {
                mapped.push({
                    key: `payment_proof-${p.id}`,
                    url: p.attachment_url,
                    kind: 'payment_proof',
                    title: p.jobs?.job_number || 'Payment',
                    subtitle: p.jobs?.clients?.name || (p.amount ? `₹${Number(p.amount).toLocaleString()}` : ''),
                    date: p.payment_date || p.created_at,
                });
            });

            if (dispatchesRes.error) failures++;
            (dispatchesRes.data || []).forEach((d: any) => {
                const title = d.jobs?.job_number || d.consignment_no || 'Dispatch';
                const subtitle = d.jobs?.clients?.name || '';
                if (d.receipt_url) mapped.push({ key: `dispatch_receipt-${d.id}`, url: d.receipt_url, kind: 'dispatch_receipt', title, subtitle, date: d.dispatch_date || d.created_at });
                if (d.proof_of_delivery_url) mapped.push({ key: `proof_of_delivery-${d.id}`, url: d.proof_of_delivery_url, kind: 'proof_of_delivery', title, subtitle, date: d.dispatch_date || d.created_at });
            });

            if (billsRes.error) failures++;
            (billsRes.data || []).forEach((b: any) => {
                mapped.push({
                    key: `purchase_bill-${b.id}`,
                    url: b.attachment_url,
                    kind: 'purchase_bill',
                    title: b.bill_number || b.vendor_bill_number || 'Bill',
                    subtitle: b.vendors?.name || '',
                    date: b.bill_date || b.created_at,
                });
            });

            if (staffRes.error) failures++;
            (staffRes.data || []).forEach((s: any) => {
                mapped.push({
                    key: `staff_id-${s.id}`,
                    url: s.document_url,
                    kind: 'staff_id',
                    title: s.full_name || 'Staff member',
                    subtitle: s.role || '',
                    date: s.created_at,
                });
            });

            mapped.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            setItems(mapped);

            if (failures > 0) {
                toast.warning(`${failures} of 6 upload source${failures > 1 ? 's' : ''} could not be loaded — the rest are showing.`);
            }
        } catch (err: any) {
            toast.error('Could not load uploads: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    // ─── Counts + filtering ──────────────────────────────────
    const counts = useMemo(() => {
        const c: Record<string, number> = { all: items.length };
        for (const k of KIND_ORDER) c[k] = 0;
        for (const it of items) c[it.kind] = (c[it.kind] || 0) + 1;
        return c;
    }, [items]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter(it => {
            if (kindFilter !== 'all' && it.kind !== kindFilter) return false;
            if (!q) return true;
            return it.title.toLowerCase().includes(q) || it.subtitle.toLowerCase().includes(q);
        });
    }, [items, kindFilter, search]);

    // ─── Loading ────────────────────────────────────────────
    if (loading) {
        return <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-gray-400" /></div>;
    }

    // ─── Render ─────────────────────────────────────────────
    return (
        <div className="space-y-3 md:space-y-4 px-2 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-page-title text-gray-900 flex items-center gap-2">
                        <Paperclip size={22} /> All Uploads
                    </h1>
                    <p className="text-xs md:text-sm text-gray-500">
                        {filtered.length} of {items.length} files &middot; every job sheet, invoice, e-way bill, goods photo, receipt, bill and ID doc in one place
                    </p>
                </div>
                <button
                    onClick={fetchAll}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-all"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Search + kind filter */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by run, job, bill, client or vendor..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-400 outline-none bg-white"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                <button
                    onClick={() => setKindFilter('all')}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${kindFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                >
                    All ({counts.all})
                </button>
                {KIND_ORDER.filter(k => counts[k] > 0).map(k => (
                    <button
                        key={k}
                        onClick={() => setKindFilter(kindFilter === k ? 'all' : k)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${kindFilter === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                    >
                        {KIND_META[k].label} ({counts[k]})
                    </button>
                ))}
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                    {items.length === 0 ? 'No uploads found anywhere in the system yet.' : 'Nothing matches this search/filter.'}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {filtered.map(item => (
                        <a
                            key={item.key}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block bg-white border border-gray-200 rounded-md overflow-hidden hover:border-gray-400 hover:shadow-sm transition-all"
                        >
                            <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                                {isImageUrl(item.url) ? (
                                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <FileText size={26} className="text-gray-300" />
                                )}
                                <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded p-0.5">
                                    <ExternalLink size={10} />
                                </span>
                            </div>
                            <div className="p-1.5">
                                <span className={`inline-block text-[8px] font-semibold px-1.5 py-0.5 rounded mb-1 ${KIND_META[item.kind].color}`}>
                                    {KIND_META[item.kind].label}
                                </span>
                                <p className="text-xs font-semibold text-gray-800 truncate" title={item.title}>{item.title}</p>
                                {item.subtitle && <p className="text-[10px] text-gray-500 truncate" title={item.subtitle}>{item.subtitle}</p>}
                                <p className="text-[9px] text-gray-400 mt-0.5">{item.date ? formatDate(item.date) : '—'}</p>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
