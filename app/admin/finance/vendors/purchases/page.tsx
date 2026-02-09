'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, FileText, Building2, Calendar, IndianRupee, X, Eye, Edit, Trash2,
  Package, Filter, ArrowLeft, CheckCircle, Clock, AlertCircle, Loader2
} from 'lucide-react';
import { usePurchaseBills, useVendors, useJobs } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const productTypes = [
  'Pouches', 'Labels', 'Boxes', 'Brochures', 'Visiting Cards', 'Envelopes',
  'Paper Tubes', 'Letterheads', 'Catalogs', 'Packaging', 'Flex/Banner', 'Other'
];

export default function VendorPurchasesPage() {
  const { purchaseBills: allPurchases, loading, createPurchaseBill, updatePurchaseBill, deletePurchaseBill } = usePurchaseBills();
  const { vendors } = useVendors();
  const { jobs } = useJobs();

  // Sort by date (descending) explicitly if not handled by hook
  const purchases = (allPurchases || []).sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());

  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    vendorId: '',
    productType: 'Boxes',
    description: '',
    quantity: 0,
    rate: 0,
    gstRate: 18,
    jobId: '',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    attachmentUrl: ''
  });

  const filteredPurchases = purchases.filter(p => {
    // Check fields safely
    const billNo = p.bill_number || '';
    const vendorName = p.vendor?.name || '';
    const desc = p.description || '';

    const matchesSearch = billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVendor = vendorFilter === 'all' || p.vendor_id === vendorFilter;
    const matchesStatus = statusFilter === 'all' || p.payment_status === statusFilter;
    return matchesSearch && matchesVendor && matchesStatus;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const calculateAmounts = () => {
    const amount = (formData.quantity || 0) * (formData.rate || 0);
    const gstAmount = Math.round(amount * ((formData.gstRate || 0) / 100));
    const totalAmount = amount + gstAmount;
    return { amount, gstAmount, totalAmount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { amount, gstAmount, totalAmount } = calculateAmounts();

    const payload = {
      vendor_id: formData.vendorId,
      job_id: formData.jobId || undefined,
      product_type: formData.productType,
      description: formData.description,
      quantity: formData.quantity,
      rate: formData.rate,
      bill_date: formData.billDate,
      due_date: formData.dueDate,

      subtotal: amount,
      gst_rate: formData.gstRate,
      gst_amount: gstAmount,
      total_amount: totalAmount,

      // Default to pending if new
      payment_status: editingPurchase ? editingPurchase.payment_status : 'pending',
      amount_paid: editingPurchase ? editingPurchase.amount_paid : 0
    };

    try {
      if (editingPurchase) {
        await updatePurchaseBill(editingPurchase.id, payload);
      } else {
        await createPurchaseBill(payload);
      }
      resetForm();
    } catch (err: any) {
      alert('Failed to save purchase bill: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vendorId: '', productType: 'Boxes', description: '', quantity: 0, rate: 0,
      gstRate: 18, jobId: '', billDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      attachmentUrl: ''
    });
    setEditingPurchase(null);
    setShowModal(false);
  };

  const handleEdit = (purchase: any) => {
    setFormData({
      vendorId: purchase.vendor_id || '',
      productType: purchase.product_type || 'Boxes',
      description: purchase.description || '',
      quantity: purchase.quantity || 0,
      rate: purchase.rate || 0,
      gstRate: purchase.gst_rate || 18,
      jobId: purchase.job_id || '',
      billDate: purchase.bill_date || '',
      dueDate: purchase.due_date || '',
      attachmentUrl: purchase.attachment_url || ''
    });
    setEditingPurchase(purchase);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this purchase bill?')) {
      await deletePurchaseBill(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-gray-100 text-gray-900';
      case 'partial': return 'bg-orange-100 text-orange-700';
      case 'pending': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Stats
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const totalPaid = purchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const totalPending = totalPurchases - totalPaid;
  const totalCOGS = purchases.filter(p => p.job_id).reduce((sum, p) => sum + (p.subtotal || 0), 0);

  const totals = calculateAmounts();

  if (loading) return <div className="p-12 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" />Loading Purchase Bills...</div>;

  return (
    <div className="p-4 sm:p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance/vendors" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Purchase Bills</h1>
            <p className="text-gray-500">Track vendor purchases & COGS</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 shadow-sm font-semibold">
          <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
          <span>Add Purchase</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Purchases</p>
          <p className="text-page-title text-gray-900">{formatCurrency(totalPurchases)}</p>
        </div>
        <div className="bg-white rounded-xl border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Paid to Vendors</p>
          <p className="text-page-title text-gray-900">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Pending Payments</p>
          <p className="text-page-title text-red-600">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Job-linked COGS</p>
          <p className="text-page-title text-primary">{formatCurrency(totalCOGS)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search bills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
              <SelectValue placeholder="All Vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Purchase List */}
      <div className="space-y-3">
        {filteredPurchases.map(purchase => {
          // Determine header color based on payment status
          const headerColors: Record<string, string> = {
            'paid': 'bg-gradient-to-r from-green-500 to-green-600',
            'partial': 'bg-gradient-to-r from-orange-500 to-orange-600',
            'pending': 'bg-gradient-to-r from-red-500 to-red-600',
          };
          const headerBg = headerColors[purchase.payment_status] || 'bg-gradient-to-r from-gray-400 to-gray-500';
          const isOverdue = purchase.payment_status === 'pending' && new Date(purchase.due_date || '') < new Date();

          return (
            <div key={purchase.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border ${isOverdue ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'}`}>
              {/* Colored Header */}
              <div className={`${headerBg} px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm font-bold">
                    {purchase.bill_number}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/90 text-xs px-3 py-1 bg-white/20 rounded-full font-medium hidden sm:inline-block">
                    {purchase.product_type}
                  </span>
                  <span className="text-white/90 text-xs px-3 py-1 bg-white/20 rounded-full font-medium capitalize">
                    {purchase.payment_status}
                  </span>
                </div>
              </div>

              {/* White Card Body */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{purchase.description}</h3>

                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    {purchase.vendor?.name || 'Unknown Vendor'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    {purchase.job?.project_name ? `${purchase.job.job_number} - ${purchase.job.project_name}` : 'General Stock'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Due: {purchase.due_date ? formatDate(purchase.due_date) : 'N/A'}
                  </span>
                </div>

                {/* Amount and Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-left">
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(purchase.total_amount)}</p>
                    <p className="text-xs text-gray-500">
                      Paid: <span className="text-foreground font-medium">{formatCurrency(purchase.amount_paid)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => { setSelectedPurchase(purchase); setShowDetailModal(true); }}
                      className="p-2 text-gray-400 hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                      <Eye className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    </button>
                    <button onClick={() => handleEdit(purchase)}
                      className="p-2 text-gray-400 hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                      <Edit className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    </button>
                    <button onClick={() => handleDelete(purchase.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPurchases.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No purchase bills found</h3>
          <p className="mt-1 text-gray-500">Add purchase bills to track expenses</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <h2 className="text-page-title">{editingPurchase ? 'Edit Purchase' : 'Add Purchase Bill'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Vendor *</label>
                  <select required value={formData.vendorId} onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg bg-white">
                    <option value="">Select Vendor</option>
                    {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Product Type *</label>
                  <select required value={formData.productType} onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Job ID</label>
                  <select value={formData.jobId} onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg bg-white">
                    <option value="">General Stock</option>
                    {(jobs || [])
                      .filter(j => j.job_number.startsWith('AAY-'))
                      .map(j => <option key={j.id} value={j.id}>{j.job_number} - {j.project_name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Description *</label>
                  <input type="text" required value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="Corrugated boxes 12x10x8" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Quantity *</label>
                  <input type="number" required min="1" value={formData.quantity || ''}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Rate (₹) *</label>
                  <input type="number" required min="0" step="0.01" value={formData.rate || ''}
                    onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">GST Rate</label>
                  <select value={formData.gstRate} onChange={(e) => setFormData({ ...formData, gstRate: parseInt(e.target.value) })}
                    style={{ boxSizing: 'border-box', minWidth: 0 }}
                    className="w-full max-w-[180px] sm:max-w-full px-1.5 py-1.5 md:px-3 md:py-2.5 border rounded-lg text-xs sm:text-sm bg-white">
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Bill Date *</label>
                  <input type="date" required value={formData.billDate}
                    onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                    style={{ boxSizing: 'border-box', minWidth: 0, fontSize: '11px' }}
                    className="w-full max-w-[150px] sm:max-w-full px-1.5 py-1.5 md:px-3 md:py-2.5 border rounded-lg md:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Due Date *</label>
                  <input type="date" required value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    style={{ boxSizing: 'border-box', minWidth: 0, fontSize: '11px' }}
                    className="w-full max-w-[150px] sm:max-w-full px-1.5 py-1.5 md:px-3 md:py-2.5 border rounded-lg md:text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Attachment (Invoice/Slip)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // TODO: Upload to storage and get URL
                        // For now, store filename
                        setFormData({ ...formData, attachmentUrl: file.name });
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-primary"
                  />
                  {formData.attachmentUrl && (
                    <p className="text-xs text-gray-900 mt-1">✓ {formData.attachmentUrl}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Choose from gallery or take photo</p>
                </div>
              </div>

              {/* Calculation Preview */}
              <div className="bg-gray-900 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({formData.quantity} × ₹{formData.rate})</span>
                  <span className="font-medium">{formatCurrency(totals.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST ({formData.gstRate}%)</span>
                  <span className="font-medium">{formatCurrency(totals.gstAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t border-border-200">
                  <span>Total Amount</span>
                  <span className="text-primary">{formatCurrency(totals.totalAmount)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-md font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold shadow-sm disabled:opacity-50">
                  {submitting ? 'Saving...' : (editingPurchase ? 'Update' : 'Add')} Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="font-mono text-primary">{selectedPurchase.bill_number}</span>
                <h2 className="text-page-title">{selectedPurchase.description}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <p className="text-xs text-gray-500">Vendor</p>
                  <p className="font-medium">{selectedPurchase.vendor?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Product Type</p>
                  <p className="font-medium">{selectedPurchase.product_type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Job ID</p>
                  <p className="font-medium">{selectedPurchase.job ? `${selectedPurchase.job.job_number} - ${selectedPurchase.job.project_name}` : 'General Stock'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-label ${getStatusBadge(selectedPurchase.payment_status)}`}>
                    {selectedPurchase.payment_status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bill Date</p>
                  <p className="font-medium">{selectedPurchase.bill_date ? formatDate(selectedPurchase.bill_date) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Due Date</p>
                  <p className="font-medium">{selectedPurchase.due_date ? formatDate(selectedPurchase.due_date) : '-'}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Quantity × Rate</span>
                  <span>{selectedPurchase.quantity} × ₹{selectedPurchase.rate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedPurchase.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST ({selectedPurchase.gst_rate}%)</span>
                  <span>{formatCurrency(selectedPurchase.gst_amount)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(selectedPurchase.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Paid</span>
                  <span className="text-gray-900 font-medium">{formatCurrency(selectedPurchase.amount_paid)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Balance Due</span>
                  <span className="text-red-600">{formatCurrency((selectedPurchase.total_amount || 0) - (selectedPurchase.amount_paid || 0))}</span>
                </div>
              </div>

              <Link href="/admin/finance/vendors/payments"
                className="block w-full text-center px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-green-700">
                Record Payment
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
