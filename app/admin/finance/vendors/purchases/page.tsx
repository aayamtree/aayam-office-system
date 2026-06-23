'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import {
  Plus, Search, FileText, Building2, Calendar, X, Eye, Edit, Trash2,
  Package, ArrowLeft, Loader2, Upload, ExternalLink, PlusCircle
} from 'lucide-react';
import { usePurchaseBills, useVendors, useJobs, usePurchaseServiceCategories, useBankAccounts, useCashAccounts } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────
const UNITS = ['Kg', 'Piece', 'Sheet', 'Ltr', 'Meter', 'Sqft', 'Box', 'Pack', 'Job'];
const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
const GST_RATES = [0, 5, 12, 18, 28];
const DEFAULT_ITEM = { description: '', quantity: '', unit: 'Piece', rate: '', gst_rate: 18 };

type LineItem = { description: string; quantity: string; unit: string; rate: string; gst_rate: number; };

// ─── Calculation helpers ──────────────────────────────────────────────────────
function calcItem(item: LineItem) {
  const qty = parseFloat(item.quantity) || 0;
  const rate = parseFloat(item.rate) || 0;
  const subtotal = qty * rate;
  const gst_amount = Math.round(subtotal * (item.gst_rate / 100) * 100) / 100;
  return { qty, rate, subtotal, gst_amount, total: subtotal + gst_amount };
}

function calcBill(items: LineItem[], discountPct: number, adjustment: number) {
  const subtotal = items.reduce((s, i) => s + calcItem(i).subtotal, 0);
  const gst_amount = items.reduce((s, i) => s + calcItem(i).gst_amount, 0);
  const discount_amount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
  const total = subtotal + gst_amount - discount_amount + adjustment;
  return { subtotal, gst_amount, discount_amount, total };
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VendorPurchasesPage() {
  const { purchaseBills: allPurchases, loading, createPurchaseBill, updatePurchaseBill, deletePurchaseBill, refetch: refetchBills } = usePurchaseBills();
  const { vendors } = useVendors();
  const { jobs } = useJobs();
  const { serviceCategories, createServiceCategory } = usePurchaseServiceCategories();
  const { bankAccounts } = useBankAccounts();
  const { cashAccounts } = useCashAccounts();

  // ── Record Payment (posts to ledger via fn_record_bill_payment) ──
  const [showPayModal, setShowPayModal] = useState(false);
  const [payBill, setPayBill] = useState<any>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: 0, mode: 'bank_transfer', date: new Date().toISOString().split('T')[0],
    accountKind: 'bank' as 'bank' | 'cash', accountId: '', reference: '',
  });

  const openBillPayment = (bill: any) => {
    const balance = Math.max(0, (bill.total_amount || 0) - (bill.amount_paid || 0));
    const firstBank = (bankAccounts || []).find((b: any) => b.is_default) || (bankAccounts || [])[0];
    const firstCash = (cashAccounts || [])[0];
    setPayBill(bill);
    setPayForm({
      amount: balance, mode: 'bank_transfer', date: new Date().toISOString().split('T')[0],
      accountKind: firstBank ? 'bank' : 'cash',
      accountId: firstBank ? firstBank.id : (firstCash ? firstCash.id : ''), reference: '',
    });
    setShowPayModal(true);
  };

  const submitBillPayment = async () => {
    if (!payBill) return;
    if (!payForm.amount || payForm.amount <= 0) { toast.error('Enter a payment amount greater than zero'); return; }
    if (!payForm.accountId) { toast.error('Select an account to pay from'); return; }
    setPaySubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('fn_record_bill_payment', {
        p_bill_id: payBill.id,
        p_amount: payForm.amount,
        p_mode: payForm.mode,
        p_date: payForm.date,
        p_bank_account_id: payForm.accountKind === 'bank' ? payForm.accountId : null,
        p_cash_account_id: payForm.accountKind === 'cash' ? payForm.accountId : null,
        p_reference: payForm.reference || null,
        p_notes: null,
        p_user_id: user?.id || null,
      });
      if (error) throw error;
      toast.success('Payment recorded and posted to the ledger.');
      setShowPayModal(false); setPayBill(null);
      refetchBills?.();
    } catch (err: any) {
      toast.error('Could not record payment: ' + (err.message || 'unknown error'));
    } finally {
      setPaySubmitting(false);
    }
  };

  const purchases = (allPurchases || []).sort(
    (a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime()
  );

  // ── UI state ──
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const confirm = useConfirm();

  // ── Form state ──
  const [form, setForm] = useState({
    vendorId: '',
    vendorBillNumber: '',
    serviceType: '',
    jobId: '',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentTerms: 'Due on Receipt',
    discountPercent: 0,
    adjustment: 0,
    attachmentUrl: '',
    reverseCharge: false,
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...DEFAULT_ITEM }]);

  const totals = calcBill(lineItems, form.discountPercent, form.adjustment);

  // ── Receipt upload ──
  const uploadReceipt = async (file: File, ref: string) => {
    try {
      setUploadingReceipt(true);
      const ext = file.name.split('.').pop();
      const path = `purchase-receipts/${ref}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, file);
      if (error) { toast.error('Upload failed: ' + error.message); return null; }
      return supabase.storage.from('attachments').getPublicUrl(path).data?.publicUrl || null;
    } catch (e: any) { toast.error(e.message); return null; }
    finally { setUploadingReceipt(false); }
  };

  // ── Line item helpers ──
  const setItem = (i: number, field: keyof LineItem, val: string | number) =>
    setLineItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const addItem = () => setLineItems(p => [...p, { ...DEFAULT_ITEM }]);
  const removeItem = (i: number) => lineItems.length > 1 && setLineItems(p => p.filter((_, idx) => idx !== i));

  // ── Add category inline ──
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    const { data, error } = await createServiceCategory(newCategoryName.trim());
    setSavingCategory(false);
    if (error) { toast.error('Failed: ' + error); return; }
    setForm(p => ({ ...p, serviceType: data?.name || newCategoryName.trim() }));
    setNewCategoryName('');
    setShowAddCategory(false);
    toast.success('Service type added!');
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.some(it => !it.description.trim())) { toast.error('Fill in description for all items'); return; }

    setSubmitting(true);
    let attachmentUrl = form.attachmentUrl;
    if (selectedFile) {
      const ref = editingPurchase?.bill_number || `BILL-${Date.now()}`;
      const url = await uploadReceipt(selectedFile, ref);
      if (url) attachmentUrl = url;
    }

    const itemsPayload = lineItems.map(it => {
      const c = calcItem(it);
      return { description: it.description, quantity: c.qty, unit: it.unit, rate: c.rate, gst_rate: it.gst_rate, subtotal: c.subtotal, gst_amount: c.gst_amount, total: c.total };
    });
    const first = itemsPayload[0];

    const payload = {
      vendor_id: form.vendorId,
      vendor_bill_number: form.vendorBillNumber || undefined,
      job_id: form.jobId || undefined,
      product_type: form.serviceType,
      description: lineItems.map(i => i.description).join(' | '),
      quantity: first.quantity,
      unit: first.unit,
      rate: first.rate,
      items: itemsPayload,
      bill_date: form.billDate,
      due_date: form.dueDate,
      payment_terms: form.paymentTerms,
      subtotal: totals.subtotal,
      gst_rate: first.gst_rate,
      gst_amount: totals.gst_amount,
      discount_percent: form.discountPercent,
      discount_amount: totals.discount_amount,
      adjustment: form.adjustment,
      total_amount: totals.total,
      attachment_url: attachmentUrl || undefined,
      reverse_charge: form.reverseCharge,
      payment_status: editingPurchase ? editingPurchase.payment_status : 'pending',
      amount_paid: editingPurchase ? editingPurchase.amount_paid : 0,
    };

    try {
      if (editingPurchase) await updatePurchaseBill(editingPurchase.id, payload);
      else await createPurchaseBill(payload);
      setSelectedFile(null);
      resetForm();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setForm({ vendorId: '', vendorBillNumber: '', serviceType: '', jobId: '', billDate: new Date().toISOString().split('T')[0], dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], paymentTerms: 'Due on Receipt', discountPercent: 0, adjustment: 0, attachmentUrl: '', reverseCharge: false });
    setLineItems([{ ...DEFAULT_ITEM }]);
    setEditingPurchase(null);
    setShowModal(false);
    setShowAddCategory(false);
    setNewCategoryName('');
  };

  const handleEdit = (purchase: any) => {
    const restored: LineItem[] = (purchase.items?.length > 0)
      ? purchase.items.map((it: any) => ({ description: it.description || '', quantity: String(it.quantity || ''), unit: it.unit || 'Piece', rate: String(it.rate || ''), gst_rate: it.gst_rate ?? 18 }))
      : [{ description: purchase.description || '', quantity: String(purchase.quantity || ''), unit: purchase.unit || 'Piece', rate: String(purchase.rate || ''), gst_rate: purchase.gst_rate ?? 18 }];
    setForm({ vendorId: purchase.vendor_id || '', vendorBillNumber: purchase.vendor_bill_number || '', serviceType: purchase.product_type || '', jobId: purchase.job_id || '', billDate: purchase.bill_date || '', dueDate: purchase.due_date || '', paymentTerms: purchase.payment_terms || 'Due on Receipt', discountPercent: purchase.discount_percent || 0, adjustment: purchase.adjustment || 0, attachmentUrl: purchase.attachment_url || '', reverseCharge: purchase.reverse_charge || false });
    setLineItems(restored);
    setEditingPurchase(purchase);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete Purchase Bill', message: 'Delete this bill?', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) await deletePurchaseBill(id);
  };

  // ── Filters ──
  const filteredPurchases = purchases.filter(p => {
    const s = searchTerm.toLowerCase();
    const match = (p.bill_number || '').toLowerCase().includes(s) || (p.vendor?.name || '').toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s);
    return match && (vendorFilter === 'all' || p.vendor_id === vendorFilter) && (statusFilter === 'all' || p.payment_status === statusFilter);
  });

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const statusBadge = (s: string) => ({ paid: 'bg-gray-100 text-gray-900', partial: 'bg-orange-100 text-orange-700', pending: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-700');

  const totalPurchases = purchases.reduce((s, p) => s + (p.total_amount || 0), 0);
  const totalPaid = purchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
  const totalCOGS = purchases.filter(p => p.job_id).reduce((s, p) => s + (p.subtotal || 0), 0);

  if (loading) return <div className="p-12 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" />Loading...</div>;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance/vendors" className="p-2 hover:bg-gray-100 rounded-md"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-page-title text-gray-900">Purchase Bills</h1>
            <p className="text-gray-500">Track vendor purchases &amp; COGS</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold">
          <Plus className="w-4 h-4" /><span>New Bill</span>
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Purchases', value: formatCurrency(totalPurchases), color: 'text-gray-900' },
          { label: 'Paid to Vendors', value: formatCurrency(totalPaid), color: 'text-gray-900' },
          { label: 'Pending Payments', value: formatCurrency(totalPurchases - totalPaid), color: 'text-red-600' },
          { label: 'Job-linked COGS', value: formatCurrency(totalCOGS), color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-md border p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500">{s.label}</p>
            <p className={`text-page-title ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-md border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search bills..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm"><SelectValue placeholder="All Vendors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Bill List ── */}
      <div className="space-y-2.5">
        {filteredPurchases.map(p => {
          const borderMap: Record<string, string> = { paid: 'border-l-green-400', partial: 'border-l-amber-400', pending: 'border-l-red-400' };
          const bgMap: Record<string, string> = { paid: 'bg-green-50/60', partial: 'bg-amber-50/60', pending: 'bg-red-50/60' };
          const bc = borderMap[p.payment_status] || 'border-l-stone-300';
          const bg = bgMap[p.payment_status] || 'bg-stone-50';
          const overdue = p.payment_status === 'pending' && new Date(p.due_date || '') < new Date();
          return (
            <div key={p.id} className={`bg-card rounded-md border border-border border-l-4 ${bc} hover:shadow-sm transition-shadow ${overdue ? 'ring-1 ring-red-200' : ''}`}>
              <div className={`${bg} px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md`}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground">{p.bill_number}</span>
                  {p.vendor_bill_number && <span className="text-[10px] text-gray-400">#{p.vendor_bill_number}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {overdue && <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-bold">Overdue</span>}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${statusBadge(p.payment_status)}`}>{p.product_type}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold capitalize ${statusBadge(p.payment_status)}`}>{p.payment_status}</span>
                </div>
              </div>
              <div className="px-4 py-3">
                <h3 className="font-semibold text-foreground mb-2 text-sm">{p.description}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{p.vendor?.name || 'Unknown'}</span>
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" />{p.job?.project_name ? `${p.job.job_number} – ${p.job.project_name}` : 'General Stock'}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due: {p.due_date ? formatDate(p.due_date) : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(p.total_amount)}</p>
                    <p className="text-[10px] text-muted-foreground">Paid: <span className="text-foreground font-medium">{formatCurrency(p.amount_paid)}</span></p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => { setSelectedPurchase(p); setShowDetailModal(true); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleEdit(p)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPurchases.length === 0 && (
        <div className="text-center py-12 bg-white rounded-md border">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No purchase bills found</h3>
          <p className="mt-1 text-gray-500">Add purchase bills to track expenses</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          NEW BILL MODAL — Zoho-style layout
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl my-6 shadow-2xl">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-lg z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPurchase ? 'Edit Bill' : 'New Bill'}
              </h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-md text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 space-y-5 bg-gray-50/50">

                {/* ── Row 1: Vendor Name ── */}
                <div className="grid grid-cols-12 items-start gap-x-4 gap-y-1">
                  <label className="col-span-3 text-sm font-medium text-red-600 pt-2.5">Vendor Name *</label>
                  <div className="col-span-9 sm:col-span-5">
                    <select required value={form.vendorId} onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20">
                      <option value="">Select a Vendor</option>
                      {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Row 2: Service Type ── */}
                <div className="grid grid-cols-12 items-start gap-x-4 gap-y-1">
                  <label className="col-span-3 text-sm font-medium text-red-600 pt-2.5">Service Type *</label>
                  <div className="col-span-9 sm:col-span-5 space-y-2">
                    <div className="flex gap-2">
                      <select required value={form.serviceType} onChange={e => setForm(p => ({ ...p, serviceType: e.target.value }))}
                        className="flex-1 px-3 py-2 border rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20">
                        <option value="">Select Service Type</option>
                        {(serviceCategories || []).map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowAddCategory(!showAddCategory)}
                        className="flex items-center gap-1 px-3 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                        <PlusCircle className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                    {showAddCategory && (
                      <div className="flex gap-2">
                        <input type="text" placeholder="e.g. Screen Printing" value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                          className="flex-1 px-3 py-2 border rounded-md text-sm" />
                        <button type="button" onClick={handleAddCategory} disabled={savingCategory}
                          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium disabled:opacity-50">
                          {savingCategory ? '…' : 'Save'}
                        </button>
                        <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }}
                          className="px-3 py-2 border rounded-md text-sm text-gray-500">Cancel</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Row 3: Bill# + Order Number (Job) ── */}
                <div className="grid grid-cols-12 items-center gap-x-4 gap-y-3">
                  <label className="col-span-3 text-sm font-medium text-gray-700">Bill #</label>
                  <div className="col-span-9 sm:col-span-4">
                    <input type="text" value={form.vendorBillNumber}
                      onChange={e => setForm(p => ({ ...p, vendorBillNumber: e.target.value }))}
                      placeholder="Vendor's invoice number (optional)"
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                  </div>
                  <label className="col-span-3 sm:col-span-2 text-sm font-medium text-gray-700 text-right">Job / Order</label>
                  <div className="col-span-9 sm:col-span-3">
                    <select value={form.jobId} onChange={e => setForm(p => ({ ...p, jobId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20">
                      <option value="">General Stock</option>
                      {(jobs || []).filter(j => /^(DO|PO|DP|AAY)-/.test(j.job_number || ''))
                        .map(j => <option key={j.id} value={j.id}>{j.job_number} – {j.project_name}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Row 4: Bill Date + Due Date ── */}
                <div className="grid grid-cols-12 items-center gap-x-4 gap-y-3">
                  <label className="col-span-3 text-sm font-medium text-red-600">Bill Date *</label>
                  <div className="col-span-9 sm:col-span-3">
                    <input type="date" required value={form.billDate}
                      onChange={e => setForm(p => ({ ...p, billDate: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                  </div>
                  <label className="col-span-3 sm:col-span-2 text-sm font-medium text-gray-700 text-right">Due Date</label>
                  <div className="col-span-9 sm:col-span-4">
                    <input type="date" value={form.dueDate}
                      onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                  </div>
                </div>

                {/* ── Row 4b: Payment Terms ── */}
                <div className="grid grid-cols-12 items-center gap-x-4 gap-y-3">
                  <label className="col-span-3 text-sm font-medium text-gray-700">Payment Terms</label>
                  <div className="col-span-9 sm:col-span-3">
                    <select value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20">
                      {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Reverse Charge ── */}
                <div className="grid grid-cols-12 gap-x-4">
                  <div className="col-span-3" />
                  <label className="col-span-9 flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" checked={form.reverseCharge}
                      onChange={e => setForm(p => ({ ...p, reverseCharge: e.target.checked }))}
                      className="rounded border-gray-300" />
                    This transaction is applicable for reverse charge
                  </label>
                </div>
              </div>

              {/* ════════════════════════════
                  ITEM TABLE  (Zoho-style)
              ════════════════════════════ */}
              <div className="px-6 py-4">
                <div className="border rounded-lg overflow-hidden">
                  {/* Table Header */}
                  <div className="grid bg-gray-100 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    style={{ gridTemplateColumns: '1fr 70px 90px 90px 90px 90px 36px' }}>
                    <div className="px-3 py-2.5">Item Details</div>
                    <div className="px-2 py-2.5 text-right">Qty</div>
                    <div className="px-2 py-2.5">Unit</div>
                    <div className="px-2 py-2.5 text-right">Rate (₹)</div>
                    <div className="px-2 py-2.5">Tax</div>
                    <div className="px-2 py-2.5 text-right">Amount (₹)</div>
                    <div className="px-2 py-2.5" />
                  </div>

                  {/* Table Rows */}
                  {lineItems.map((item, idx) => {
                    const c = calcItem(item);
                    return (
                      <div key={idx}
                        className="grid items-center border-b last:border-b-0 hover:bg-gray-50/50 transition-colors"
                        style={{ gridTemplateColumns: '1fr 70px 90px 90px 90px 90px 36px' }}>
                        {/* Item Details */}
                        <div className="px-3 py-2">
                          <input type="text" required placeholder="Type or click to select an item"
                            value={item.description}
                            onChange={e => setItem(idx, 'description', e.target.value)}
                            className="w-full text-sm bg-transparent border-0 outline-none focus:bg-white focus:border focus:rounded focus:px-2 focus:py-1 placeholder:text-gray-400" />
                        </div>
                        {/* Qty */}
                        <div className="px-2 py-2">
                          <input type="number" required min="0.001" step="0.001" placeholder="1.00"
                            value={item.quantity || ''}
                            onChange={e => setItem(idx, 'quantity', e.target.value)}
                            className="w-full text-sm text-right bg-transparent border-0 outline-none focus:bg-white focus:border focus:rounded focus:px-1 placeholder:text-gray-400" />
                        </div>
                        {/* Unit */}
                        <div className="px-2 py-2">
                          <select value={item.unit} onChange={e => setItem(idx, 'unit', e.target.value)}
                            className="w-full text-sm bg-transparent border-0 outline-none focus:bg-white focus:border focus:rounded cursor-pointer">
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        {/* Rate */}
                        <div className="px-2 py-2">
                          <input type="number" required min="0" step="0.01" placeholder="0.00"
                            value={item.rate || ''}
                            onChange={e => setItem(idx, 'rate', e.target.value)}
                            className="w-full text-sm text-right bg-transparent border-0 outline-none focus:bg-white focus:border focus:rounded focus:px-1 placeholder:text-gray-400" />
                        </div>
                        {/* Tax */}
                        <div className="px-2 py-2">
                          <select value={item.gst_rate} onChange={e => setItem(idx, 'gst_rate', parseInt(e.target.value))}
                            className="w-full text-sm bg-transparent border-0 outline-none focus:bg-white focus:border focus:rounded cursor-pointer text-blue-600">
                            {GST_RATES.map(g => <option key={g} value={g}>GST {g}%</option>)}
                          </select>
                        </div>
                        {/* Amount */}
                        <div className="px-2 py-2 text-right text-sm font-medium text-gray-800">
                          {fmt(c.total)}
                        </div>
                        {/* Delete */}
                        <div className="px-1 py-2 flex justify-center">
                          <button type="button" onClick={() => removeItem(idx)}
                            disabled={lineItems.length === 1}
                            className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-20 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Row */}
                <button type="button" onClick={addItem}
                  className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="w-4 h-4 rounded-full bg-blue-100 p-0.5" /> Add New Row
                </button>
              </div>

              {/* ════════════════════════════
                  TOTALS SECTION  (right-aligned, Zoho-style)
              ════════════════════════════ */}
              <div className="px-6 pb-5">
                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-0 border rounded-lg overflow-hidden">

                    {/* Sub Total */}
                    <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 border-b">
                      <span className="text-sm text-gray-600">Sub Total</span>
                      <span className="text-sm font-semibold text-gray-900">{fmt(totals.subtotal)}</span>
                    </div>

                    {/* GST */}
                    <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 border-b">
                      <span className="text-sm text-gray-600">Total GST</span>
                      <span className="text-sm font-medium text-gray-700">{fmt(totals.gst_amount)}</span>
                    </div>

                    {/* Discount */}
                    <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b gap-3">
                      <span className="text-sm text-gray-600 whitespace-nowrap">Discount</span>
                      <div className="flex items-center gap-1.5">
                        <input type="number" min="0" max="100" step="0.1"
                          value={form.discountPercent || ''}
                          onChange={e => setForm(p => ({ ...p, discountPercent: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          className="w-16 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-400" />
                        <span className="text-sm text-gray-500">%</span>
                        <span className="text-sm font-medium text-red-600 w-24 text-right">- {fmt(totals.discount_amount)}</span>
                      </div>
                    </div>

                    {/* Adjustment */}
                    <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b gap-3">
                      <span className="text-sm text-gray-600">Adjustment</span>
                      <div className="flex items-center gap-1.5">
                        <input type="number" step="0.01"
                          value={form.adjustment || ''}
                          onChange={e => setForm(p => ({ ...p, adjustment: parseFloat(e.target.value) || 0 }))}
                          placeholder="0.00"
                          className="w-24 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-400" />
                      </div>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center px-4 py-3 bg-gray-900 text-white">
                      <span className="font-semibold">Total</span>
                      <span className="text-lg font-bold text-yellow-400">₹ {fmt(totals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Attachment ── */}
              <div className="px-6 pb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Attachment (Invoice / Slip)</label>
                <input type="file" accept="image/*,application/pdf"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }}
                  className="w-full px-3 py-2 border rounded-md text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-gray-700 bg-white" />
                {selectedFile && <p className="text-xs text-gray-600 mt-1 flex items-center gap-1"><Upload className="w-3 h-3" /> {selectedFile.name}</p>}
                {!selectedFile && form.attachmentUrl && (
                  <a href={form.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View existing attachment
                  </a>
                )}
              </div>

              {/* ── Action Buttons ── */}
              <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 justify-end rounded-b-lg">
                <button type="button" onClick={resetForm}
                  className="px-6 py-2.5 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || uploadingReceipt}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 shadow-sm disabled:opacity-50">
                  {uploadingReceipt ? 'Uploading…' : submitting ? 'Saving…' : editingPurchase ? 'Save Changes' : 'Save Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          DETAIL VIEW MODAL
      ══════════════════════════════════ */}
      {showDetailModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b sticky top-0 bg-white flex items-center justify-between">
              <div>
                <span className="font-mono text-primary text-sm">{selectedPurchase.bill_number}</span>
                {selectedPurchase.vendor_bill_number && <span className="ml-2 text-xs text-gray-400">#{selectedPurchase.vendor_bill_number}</span>}
                <h2 className="text-page-title">{selectedPurchase.product_type || 'Purchase Bill'}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">Vendor</p><p className="font-medium">{selectedPurchase.vendor?.name}</p></div>
                <div><p className="text-xs text-gray-500">Service Type</p><p className="font-medium">{selectedPurchase.product_type}</p></div>
                <div><p className="text-xs text-gray-500">Job</p><p className="font-medium">{selectedPurchase.job ? `${selectedPurchase.job.job_number} – ${selectedPurchase.job.project_name}` : 'General Stock'}</p></div>
                <div><p className="text-xs text-gray-500">Payment Status</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${statusBadge(selectedPurchase.payment_status)}`}>{selectedPurchase.payment_status}</span>
                </div>
                <div><p className="text-xs text-gray-500">Bill Date</p><p className="font-medium">{selectedPurchase.bill_date ? formatDate(selectedPurchase.bill_date) : '–'}</p></div>
                <div><p className="text-xs text-gray-500">Due Date</p><p className="font-medium">{selectedPurchase.due_date ? formatDate(selectedPurchase.due_date) : '–'}</p></div>
                {selectedPurchase.payment_terms && <div className="col-span-2"><p className="text-xs text-gray-500">Payment Terms</p><p className="font-medium">{selectedPurchase.payment_terms}</p></div>}
              </div>

              {/* Items table */}
              {selectedPurchase.items?.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Description</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Qty</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Unit</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Rate</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPurchase.items.map((it: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{it.description}</td>
                          <td className="px-3 py-2 text-right">{it.quantity}</td>
                          <td className="px-3 py-2">{it.unit}</td>
                          <td className="px-3 py-2 text-right">₹{it.rate}</td>
                          <td className="px-3 py-2 text-right font-medium">₹{it.total?.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-600">{selectedPurchase.quantity} {selectedPurchase.unit || ''} × ₹{selectedPurchase.rate}</p>
              )}

              {/* Totals */}
              <div className="border rounded-lg overflow-hidden text-sm">
                <div className="flex justify-between px-4 py-2 bg-gray-50 border-b"><span className="text-gray-500">Sub Total</span><span>{formatCurrency(selectedPurchase.subtotal)}</span></div>
                <div className="flex justify-between px-4 py-2 bg-gray-50 border-b"><span className="text-gray-500">GST</span><span>{formatCurrency(selectedPurchase.gst_amount)}</span></div>
                {(selectedPurchase.discount_amount > 0) && <div className="flex justify-between px-4 py-2 bg-gray-50 border-b"><span className="text-gray-500">Discount ({selectedPurchase.discount_percent}%)</span><span className="text-red-500">- {formatCurrency(selectedPurchase.discount_amount)}</span></div>}
                {(selectedPurchase.adjustment != null && selectedPurchase.adjustment !== 0) && <div className="flex justify-between px-4 py-2 bg-gray-50 border-b"><span className="text-gray-500">Adjustment</span><span>{formatCurrency(selectedPurchase.adjustment)}</span></div>}
                <div className="flex justify-between px-4 py-2.5 bg-gray-900 text-white font-bold"><span>Total</span><span>{formatCurrency(selectedPurchase.total_amount)}</span></div>
                <div className="flex justify-between px-4 py-2 bg-gray-50 border-t"><span className="text-gray-500">Paid</span><span className="font-medium">{formatCurrency(selectedPurchase.amount_paid)}</span></div>
                <div className="flex justify-between px-4 py-2 bg-gray-50 font-semibold"><span>Balance Due</span><span className="text-red-600">{formatCurrency((selectedPurchase.total_amount || 0) - (selectedPurchase.amount_paid || 0))}</span></div>
              </div>

              {((selectedPurchase.total_amount || 0) - (selectedPurchase.amount_paid || 0)) > 0.5 ? (
                <button onClick={() => openBillPayment(selectedPurchase)} className="block w-full text-center px-4 py-2.5 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 text-sm">
                  Record Payment
                </button>
              ) : (
                <p className="text-center text-sm text-green-700 font-medium py-2">Fully paid</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal (posts to ledger) */}
      {showPayModal && payBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-md w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
                <p className="text-sm text-gray-500">{payBill.bill_number} • Balance {formatCurrency(Math.max(0, (payBill.total_amount || 0) - (payBill.amount_paid || 0)))}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Amount Paid</label>
                <input type="number" value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Payment Date</label>
                  <input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Mode</label>
                  <select value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Pay From</label>
                <div className="flex gap-2 mt-1 mb-2">
                  <button type="button" onClick={() => { const f = (bankAccounts || [])[0]; setPayForm({ ...payForm, accountKind: 'bank', accountId: f ? f.id : '' }); }}
                    className={`flex-1 py-1.5 text-sm rounded-md border ${payForm.accountKind === 'bank' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>Bank</button>
                  <button type="button" onClick={() => { const f = (cashAccounts || [])[0]; setPayForm({ ...payForm, accountKind: 'cash', accountId: f ? f.id : '' }); }}
                    className={`flex-1 py-1.5 text-sm rounded-md border ${payForm.accountKind === 'cash' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>Cash</button>
                </div>
                <select value={payForm.accountId} onChange={(e) => setPayForm({ ...payForm, accountId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400">
                  <option value="">Select account…</option>
                  {((payForm.accountKind === 'bank' ? bankAccounts : cashAccounts) || []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Reference (optional)</label>
                <input type="text" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="UTR / cheque no."
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={submitBillPayment} disabled={paySubmitting}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 disabled:opacity-50">
                  {paySubmitting ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
