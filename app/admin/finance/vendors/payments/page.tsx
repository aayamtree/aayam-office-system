'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Building2, Calendar, IndianRupee, X, Eye, Trash2,
  ArrowLeft, CheckCircle, CreditCard, Wallet, Building, ArrowUpRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';

const paymentModes = ['Cash', 'Bank Transfer', 'NEFT', 'RTGS', 'UPI', 'Cheque'];

const vendors = [
  { id: 1, name: 'Raj Packaging', outstanding: 21990 },
  { id: 2, name: 'Gujarat Papers', outstanding: 15680 },
  { id: 3, name: 'Shree Inks', outstanding: 0 },
  { id: 4, name: 'Modern Plastics', outstanding: 8500 },
];

const bankAccounts = [
  { id: 1, name: 'HDFC Current Account', number: 'XXXX4521' },
  { id: 2, name: 'ICICI Savings', number: 'XXXX7890' },
  { id: 3, name: 'SBI Business', number: 'XXXX1234' },
];

const initialPayments = [
  {
    id: 1, paymentNo: 'VP-001', vendorId: 1, vendorName: 'Raj Packaging', amount: 15000,
    paymentMode: 'NEFT', bankAccountId: 1, bankName: 'HDFC Current Account',
    reference: 'TXN123456', billNos: ['PB-001'], paymentDate: '2025-12-22', notes: 'Partial payment for boxes'
  },
  {
    id: 2, paymentNo: 'VP-002', vendorId: 3, vendorName: 'Shree Inks', amount: 20060,
    paymentMode: 'Bank Transfer', bankAccountId: 2, bankName: 'ICICI Savings',
    reference: 'TXN789012', billNos: ['PB-003'], paymentDate: '2025-12-20', notes: 'Full payment for inks'
  },
  {
    id: 3, paymentNo: 'VP-003', vendorId: 4, vendorName: 'Modern Plastics', amount: 5000,
    paymentMode: 'Cash', bankAccountId: null, bankName: 'Cash',
    reference: 'CASH-001', billNos: [], paymentDate: '2025-12-18', notes: 'Advance payment'
  },
];

export default function VendorPaymentsPage() {
  const [payments, setPayments] = useState(initialPayments);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentCounter, setPaymentCounter] = useState(4);

  const [formData, setFormData] = useState({
    vendorId: '', amount: 0, paymentMode: 'NEFT', bankAccountId: '', reference: '', paymentDate: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();

  const filteredPayments = payments.filter(p => {
    const matchesSearch = (p.paymentNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVendor = vendorFilter === 'all' || p.vendorId.toString() === vendorFilter;
    return matchesSearch && matchesVendor;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vendor = vendors.find(v => v.id.toString() === formData.vendorId);
    const bank = bankAccounts.find(b => b.id.toString() === formData.bankAccountId);

    const newPayment = {
      id: Date.now(), paymentNo: `VP-${String(paymentCounter).padStart(3, '0')}`,
      ...formData, vendorId: parseInt(formData.vendorId), vendorName: vendor?.name || '',
      bankAccountId: formData.paymentMode === 'Cash' ? null : parseInt(formData.bankAccountId),
      bankName: formData.paymentMode === 'Cash' ? 'Cash' : bank?.name || '', billNos: []
    };
    setPayments([newPayment, ...payments]);
    setPaymentCounter(paymentCounter + 1);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ vendorId: '', amount: 0, paymentMode: 'NEFT', bankAccountId: '', reference: '', paymentDate: '', notes: '' });
    setShowModal(false);
  };

  const handleDelete = async (id: number) => {
    const { confirmed } = await confirm({ title: 'Delete Payment', message: 'Are you sure you want to delete this payment record?', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) setPayments(payments.filter(p => p.id !== id));
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'Cash': return <Wallet className="w-4 h-4 text-gray-900" />;
      case 'UPI': return <CreditCard className="w-4 h-4 text-primary" />;
      default: return <Building className="w-4 h-4 text-foreground" />;
    }
  };

  // Stats
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const cashPayments = payments.filter(p => p.paymentMode === 'Cash').reduce((sum, p) => sum + p.amount, 0);
  const bankPayments = payments.filter(p => p.paymentMode !== 'Cash').reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = vendors.reduce((sum, v) => sum + v.outstanding, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance/vendors" className="p-2 hover:bg-gray-100 rounded-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900">Vendor Payments</h1>
            <p className="text-gray-500">Payment out to vendors</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold">
          <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Paid</p>
          <p className="text-page-title text-gray-900">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Cash Payments</p>
          <p className="text-page-title text-emerald-600">{formatCurrency(cashPayments)}</p>
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Bank Payments</p>
          <p className="text-page-title text-foreground">{formatCurrency(bankPayments)}</p>
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Outstanding</p>
          <p className="text-page-title text-red-600">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>

      {/* Vendor Outstanding Summary */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Vendor Outstanding</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {vendors.filter(v => v.outstanding > 0).map(vendor => (
            <div key={vendor.id} className="bg-red-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900">{vendor.name}</p>
              <p className="text-section text-red-600">{formatCurrency(vendor.outstanding)}</p>
            </div>
          ))}
          {vendors.every(v => v.outstanding === 0) && (
            <p className="col-span-4 text-center text-gray-500 py-4">All vendors paid! No outstanding.</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search payments..."
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
              {vendors.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {filteredPayments.map(payment => (
          <div key={payment.id} className="bg-white rounded-lg border p-4  transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ArrowUpRight className="w-5 h-5 text-gray-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-gray-900 font-medium">{payment.paymentNo}</span>
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-gray-100">
                      {getModeIcon(payment.paymentMode)}
                      {payment.paymentMode}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{payment.vendorName}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                    <span className="flex items-center gap-1"><Building className="w-4 h-4" />{payment.bankName}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </div>
                  {payment.notes && <p className="text-sm text-gray-500 mt-1">{payment.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-4">
                <div className="text-right">
                  <p className="font-bold text-xl text-gray-900">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-gray-500">Ref: {payment.reference}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setSelectedPayment(payment); setShowDetailModal(true); }}
                    className="p-2 text-foreground hover:bg-muted rounded-md"><Eye className="w-4 h-4 md:w-4.5 md:h-4.5" /></button>
                  <button onClick={() => handleDelete(payment.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"><Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPayments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <IndianRupee className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No payments found</h3>
          <p className="mt-1 text-gray-500">Record vendor payments to track expenses</p>
        </div>
      )}

      {/* Add Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-page-title">Record Payment</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Vendor *</label>
                <select required value={formData.vendorId} onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-md">
                  <option value="">Select Vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.outstanding > 0 ? `(Outstanding: ₹${v.outstanding.toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Amount (₹) *</label>
                <input type="number" required min="1" value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border rounded-md" placeholder="Enter amount" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Payment Mode *</label>
                <select required value={formData.paymentMode} onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-md">
                  {paymentModes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {formData.paymentMode !== 'Cash' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Bank Account *</label>
                  <select required value={formData.bankAccountId} onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-md">
                    <option value="">Select Bank Account</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name} ({b.number})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">Reference/Transaction ID</label>
                <input type="text" value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-md" placeholder="TXN123456" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Payment Date *</label>
                <input type="date" required value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Notes</label>
                <textarea value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-md" rows={2} placeholder="Payment notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-md font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold shadow-sm disabled:opacity-50">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <span className="font-mono text-gray-900">{selectedPayment.paymentNo}</span>
                <h2 className="text-page-title">Payment Details</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600">Amount Paid</p>
                <p className="text-page-title text-gray-900">{formatCurrency(selectedPayment.amount)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <p className="text-xs text-gray-500">Vendor</p>
                  <p className="font-medium">{selectedPayment.vendorName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Mode</p>
                  <p className="font-medium">{selectedPayment.paymentMode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bank Account</p>
                  <p className="font-medium">{selectedPayment.bankName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Date</p>
                  <p className="font-medium">{new Date(selectedPayment.paymentDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Reference</p>
                  <p className="font-mono font-medium">{selectedPayment.reference || '-'}</p>
                </div>
                {selectedPayment.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Notes</p>
                    <p className="font-medium">{selectedPayment.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
