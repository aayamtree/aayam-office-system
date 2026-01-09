'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
  ArrowDownRight, ArrowUpRight, Calendar, CreditCard, Banknote, Loader2, User, Building2, Upload, FileText
} from 'lucide-react';
import { usePaymentsReceived, useVendorPayments, useClients, useVendors, useInvoices, usePurchaseBills } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';

export default function PaymentsPage() {
  const { paymentsReceived, loading: loadingReceived, createPaymentReceived, deletePaymentReceived } = usePaymentsReceived();
  const { vendorPayments, loading: loadingPaid, createVendorPayment, deleteVendorPayment } = useVendorPayments();
  const { clients, error: clientsError } = useClients();
  const { vendors, error: vendorsError } = useVendors();
  const { invoices } = useInvoices();
  const { purchaseBills } = usePurchaseBills();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'paid'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Combine and sort payments
  const payments = useMemo(() => {
    const received = (paymentsReceived || []).map(p => ({
      ...p,
      type: 'received',
      raw_date: p.payment_date,
      display_name: p.client?.name || 'Unknown Client',
      display_company: p.client?.company || '-',
      reference: p.reference_number
    }));
    const paid = (vendorPayments || []).map(p => ({
      ...p,
      type: 'paid',
      raw_date: p.payment_date,
      display_name: p.vendor?.name || 'Unknown Vendor',
      display_company: p.vendor?.company || '-',
      reference: p.reference_number
    }));

    return [...received, ...paid].sort((a, b) =>
      new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime()
    );
  }, [paymentsReceived, vendorPayments]);

  const [formData, setFormData] = useState({
    type: 'received' as 'received' | 'paid',
    clientId: '',
    vendorId: '',
    amount: '' as string | number, // Changed to string to allow better typing
    method: 'bank_transfer',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
    attachmentUrl: '',
    invoiceId: '',
    purchaseBillId: ''
  });

  const filteredPayments = payments.filter(p => {
    const searchString = searchQuery.toLowerCase();
    const matchesSearch =
      p.display_name.toLowerCase().includes(searchString) ||
      p.display_company.toLowerCase().includes(searchString) ||
      (p.payment_number || '').toLowerCase().includes(searchString);
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const handleAddNew = () => {
    setFormData({
      type: 'received', clientId: '', vendorId: '', amount: '',
      method: 'bank_transfer', date: new Date().toISOString().split('T')[0],
      reference: '', notes: '', attachmentUrl: '',
      invoiceId: '', purchaseBillId: ''
    });
    setShowModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist, try creating bucket (client side not ideal, but fallback)
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, attachmentUrl: publicUrl }));
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Parse Amount
    const finalAmount = parseFloat(formData.amount.toString()) || 0;
    if (finalAmount <= 0) {
      alert('Please enter a valid amount');
      setSubmitting(false);
      return;
    }

    try {
      if (formData.type === 'received') {
        if (!formData.clientId) throw new Error('Please select a client');
        await createPaymentReceived({
          client_id: formData.clientId,
          amount: finalAmount,
          payment_mode: formData.method as any,
          payment_date: formData.date,
          reference_number: formData.reference,
          notes: formData.notes,
          attachment_url: formData.attachmentUrl,
          invoice_id: formData.invoiceId || undefined
        } as any);
      } else {
        if (!formData.vendorId) throw new Error('Please select a vendor');
        await createVendorPayment({
          vendor_id: formData.vendorId,
          amount: finalAmount,
          payment_mode: formData.method as any,
          payment_date: formData.date,
          reference_number: formData.reference,
          notes: formData.notes,
          attachment_url: formData.attachmentUrl,
          purchase_bill_id: formData.purchaseBillId || undefined
        } as any);
      }
      setShowModal(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: any) => {
    if (!confirm('Are you sure?')) return;
    if (p.type === 'received') await deletePaymentReceived(p.id);
    else await deleteVendorPayment(p.id);
  };

  const totalReceived = payments.filter(p => p.type === 'received').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = payments.filter(p => p.type === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);

  if (loadingReceived || loadingPaid) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto" /> Loading payments...</div>;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Payments</h1>
            <p className="text-sm text-gray-500">{filteredPayments.length} transactions</p>
          </div>
        </div>
        <button onClick={handleAddNew} className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl hover:bg-gray-800">
          <Plus size={18} /> Record Payment
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-green-700 font-medium">
            <ArrowDownRight size={20} /> Total Received
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-red-700 font-medium">
            <ArrowUpRight size={20} /> Total Paid
          </div>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl">
          <option value="all">All Transactions</option>
          <option value="received">Received</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hidden lg:block">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Party</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Mode</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPayments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-2 font-medium ${p.type === 'received' ? 'text-green-600' : 'text-red-600'}`}>
                    {p.type === 'received' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    {p.type === 'received' ? 'Received' : 'Paid'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{p.display_name}</p>
                  {p.attachment_url && (
                    <a href={p.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 flex items-center gap-1 hover:underline mt-1">
                      <FileText size={12} /> View Proof
                    </a>
                  )}
                </td>
                <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(p.amount)}</td>
                <td className="px-6 py-4 capitalize text-gray-600">{p.payment_mode?.replace('_', ' ')}</td>
                <td className="px-6 py-4 text-gray-600">{new Date(p.raw_date).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(p)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {filteredPayments.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">No payments found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setFormData({ ...formData, type: 'received' })}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 ${formData.type === 'received' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}>
                  <ArrowDownRight size={20} /> <span className="font-medium">Received</span>
                </button>
                <button type="button" onClick={() => setFormData({ ...formData, type: 'paid' })}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 ${formData.type === 'paid' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}>
                  <ArrowUpRight size={20} /> <span className="font-medium">Paid</span>
                </button>
              </div>

              {formData.type === 'received' ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Client *</label>
                  {clients.length === 0 ? (
                    <div className="p-3 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl text-sm">
                      No clients found. Please add a client in CRM first or check permissions.
                    </div>
                  ) : (
                    <select required value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-white">
                      <option value="">Select Client ({clients.length})</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
                    </select>
                  )}
                  {clientsError && <p className="text-xs text-red-500 mt-1">Error: {clientsError} (Check RLS)</p>}

                  {/* PENDING INVOICES LIST (New) */}
                  {formData.clientId && invoices && (
                    <div className="mt-3 bg-blue-50 p-3 rounded-xl border border-blue-100 animate-fade-in">
                      <label className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                        <FileText size={12} /> Allocate to Pending Invoice (Optional)
                      </label>
                      <select
                        value={formData.invoiceId || ''}
                        onChange={e => {
                          const inv = invoices.find(i => i.id === e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            invoiceId: e.target.value,
                            amount: inv ? inv.balance_due : prev.amount
                          }));
                        }}
                        className="w-full text-sm p-2 rounded-lg border border-blue-200 bg-white"
                      >
                        <option value="">-- General Payment (On Account) --</option>
                        {invoices
                          .filter(i => i.client_id === formData.clientId && i.payment_status !== 'paid')
                          .map(i => (
                            <option key={i.id} value={i.id}>
                              #{i.invoice_number} (Total: ₹{i.total_amount}, Due: ₹{i.balance_due})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Vendor *</label>
                  {vendors.length === 0 ? (
                    <div className="p-3 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl text-sm">
                      No vendors found. Please add a vendor in CRM first or check permissions.
                    </div>
                  ) : (
                    <select required value={formData.vendorId} onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-white">
                      <option value="">Select Vendor ({vendors.length})</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name} - {v.company}</option>)}
                    </select>
                  )}
                  {vendorsError && <p className="text-xs text-red-500 mt-1">Error: {vendorsError} (Check RLS)</p>}

                  {/* PENDING BILLS LIST (New) */}
                  {formData.vendorId && purchaseBills && (
                    <div className="mt-3 bg-blue-50 p-3 rounded-xl border border-blue-100 animate-fade-in">
                      <label className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                        <FileText size={12} /> Allocate to Pending Bill (Optional)
                      </label>
                      <select
                        value={formData.purchaseBillId || ''}
                        onChange={e => {
                          const bill = purchaseBills.find(b => b.id === e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            purchaseBillId: e.target.value,
                            amount: bill ? (bill.total_amount - (bill.amount_paid || 0)) : prev.amount
                          }));
                        }}
                        className="w-full text-sm p-2 rounded-lg border border-blue-200 bg-white"
                      >
                        <option value="">-- General Payment (On Account) --</option>
                        {purchaseBills
                          .filter(b => b.vendor_id === formData.vendorId && b.payment_status !== 'paid')
                          .map(b => (
                            <option key={b.id} value={b.id}>
                              #{b.bill_number} (Total: ₹{b.total_amount}, Paid: ₹{b.amount_paid})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                  <input type="number" required min="1" step="any"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input type="date" required value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select value={formData.method} onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-white">
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reference / Note</label>
                <input type="text" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Cheque No / TXN ID" className="w-full px-3 py-2 border rounded-xl" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Proof of Payment (Screenshot/PDF)</label>
                <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    {uploading ? <Loader2 className="animate-spin text-indigo-600" /> : <Upload size={24} />}
                    <span className="text-sm">
                      {uploading ? 'Uploading...' : formData.attachmentUrl ? 'File Attached (Click to Change)' : 'Tap to Upload'}
                    </span>
                  </div>
                </div>
                {formData.attachmentUrl && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl border flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-700 truncate max-w-[200px]">
                      <FileText size={16} className="text-indigo-600 shrink-0" />
                      <span className="truncate">Proof Attached</span>
                    </div>
                    <a href={formData.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs bg-white border px-2 py-1 rounded shadow-sm hover:bg-gray-50 text-indigo-600">
                      View
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-xl">Cancel</button>
                <button type="submit" disabled={submitting || uploading} className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-xl">
                  {submitting ? 'Saving...' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
