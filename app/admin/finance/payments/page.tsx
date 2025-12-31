'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft, 
  ArrowDownRight, ArrowUpRight, Calendar, CreditCard, Banknote
} from 'lucide-react';

interface Payment {
  id: string;
  type: 'received' | 'paid';
  clientVendor: string;
  company: string;
  invoiceNumber: string;
  amount: number;
  method: 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'card';
  reference: string;
  notes: string;
  date: string;
}

const demoPayments: Payment[] = [
  { id: '1', type: 'received', clientVendor: 'Rajesh Kumar', company: 'ABC Industries', invoiceNumber: 'INV-2024-156', amount: 10000, method: 'bank_transfer', reference: 'NEFT123456', notes: 'Partial payment', date: '2024-12-24' },
  { id: '2', type: 'received', clientVendor: 'Priya Patel', company: 'XYZ Corporation', invoiceNumber: 'INV-2024-155', amount: 50445, method: 'cheque', reference: 'CHQ-789012', notes: 'Full payment', date: '2024-12-23' },
  { id: '3', type: 'paid', clientVendor: 'Mahesh Patel', company: 'Paper World Supplies', invoiceNumber: 'PO-2024-089', amount: 18500, method: 'bank_transfer', reference: 'NEFT456789', notes: 'Paper purchase', date: '2024-12-23' },
  { id: '4', type: 'received', clientVendor: 'Amit Shah', company: 'Global Traders', invoiceNumber: 'INV-2024-154', amount: 100000, method: 'cash', reference: '', notes: 'Advance payment', date: '2024-12-22' },
  { id: '5', type: 'paid', clientVendor: 'Suresh Kumar', company: 'Ink Solutions', invoiceNumber: 'PO-2024-088', amount: 8750, method: 'upi', reference: 'UPI123456', notes: 'Ink purchase', date: '2024-12-22' },
  { id: '6', type: 'received', clientVendor: 'Vikram Singh', company: 'Print Masters', invoiceNumber: 'INV-2024-152', amount: 89250, method: 'bank_transfer', reference: 'RTGS789012', notes: 'Full payment', date: '2024-12-20' },
];

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>(demoPayments);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'paid'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    type: 'received' as 'received' | 'paid',
    clientVendor: '',
    company: '',
    invoiceNumber: '',
    amount: 0,
    method: 'cash' as Payment['method'],
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getMethodLabel = (method: string) => {
    const m = paymentMethods.find(pm => pm.value === method);
    return m ? m.label : method;
  };

  const handleAddNew = () => {
    setFormData({
      type: 'received',
      clientVendor: '',
      company: '',
      invoiceNumber: '',
      amount: 0,
      method: 'cash',
      reference: '',
      notes: '',
      date: new Date().toISOString().split('T')[0],
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (p: Payment) => {
    setFormData({
      type: p.type,
      clientVendor: p.clientVendor,
      company: p.company,
      invoiceNumber: p.invoiceNumber,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      date: p.date,
    });
    setSelectedPayment(p);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleView = (p: Payment) => {
    setSelectedPayment(p);
    setShowViewModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this payment record?')) {
      setPayments(payments.filter(p => p.id !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing && selectedPayment) {
      setPayments(payments.map(p => 
        p.id === selectedPayment.id 
          ? { ...p, ...formData }
          : p
      ));
    } else {
      const newPayment: Payment = {
        id: Date.now().toString(),
        ...formData,
      };
      setPayments([newPayment, ...payments]);
    }
    
    setShowModal(false);
  };

  const totalReceived = payments.filter(p => p.type === 'received').reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payments.filter(p => p.type === 'paid').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Payments</h1>
            <p className="text-sm text-gray-500">{filteredPayments.length} transactions</p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <ArrowDownRight size={20} className="text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-700">Received</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalReceived)}</p>
          <p className="text-xs text-green-600">{payments.filter(p => p.type === 'received').length} transactions</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <ArrowUpRight size={20} className="text-red-600" />
            </div>
            <span className="text-sm font-medium text-red-700">Paid</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-red-600">{payments.filter(p => p.type === 'paid').length} transactions</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by company or invoice..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Transactions</option>
          <option value="received">Received</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredPayments.map((p) => (
          <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  p.type === 'received' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {p.type === 'received' ? (
                    <ArrowDownRight size={18} className="text-green-600" />
                  ) : (
                    <ArrowUpRight size={18} className="text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{p.company}</p>
                  <p className="text-sm text-gray-500">{p.clientVendor}</p>
                </div>
              </div>
              <span className={`font-bold ${p.type === 'received' ? 'text-green-600' : 'text-red-600'}`}>
                {p.type === 'received' ? '+' : '-'}{formatCurrency(p.amount)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
              <span>{getMethodLabel(p.method)}</span>
              <span>•</span>
              <span>{p.date}</span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">{p.invoiceNumber}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleView(p)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <Eye size={18} className="text-gray-500" />
                </button>
                <button onClick={() => handleEdit(p)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <Edit size={18} className="text-gray-500" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-50 rounded-lg">
                  <Trash2 size={18} className="text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Client/Vendor</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Invoice/PO</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Method</th>
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPayments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    p.type === 'received' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {p.type === 'received' ? (
                      <ArrowDownRight size={18} className="text-green-600" />
                    ) : (
                      <ArrowUpRight size={18} className="text-red-600" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{p.company}</p>
                  <p className="text-sm text-gray-500">{p.clientVendor}</p>
                </td>
                <td className="px-6 py-4 text-gray-600">{p.invoiceNumber}</td>
                <td className="px-6 py-4">
                  <span className={`font-bold ${p.type === 'received' ? 'text-green-600' : 'text-red-600'}`}>
                    {p.type === 'received' ? '+' : '-'}{formatCurrency(p.amount)}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{getMethodLabel(p.method)}</td>
                <td className="px-6 py-4 text-gray-600">{p.date}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleView(p)} className="p-2 hover:bg-gray-100 rounded-lg" title="View">
                      <Eye size={18} className="text-gray-500" />
                    </button>
                    <button onClick={() => handleEdit(p)} className="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                      <Edit size={18} className="text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                      <Trash2 size={18} className="text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Payment' : 'Record Payment'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'received' })}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-colors ${
                      formData.type === 'received' 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <ArrowDownRight size={24} className={formData.type === 'received' ? 'text-green-600' : 'text-gray-400'} />
                    <span className={formData.type === 'received' ? 'text-green-700 font-medium' : 'text-gray-600'}>Received</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'paid' })}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-colors ${
                      formData.type === 'paid' 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <ArrowUpRight size={24} className={formData.type === 'paid' ? 'text-red-600' : 'text-gray-400'} />
                    <span className={formData.type === 'paid' ? 'text-red-700 font-medium' : 'text-gray-600'}>Paid</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'received' ? 'Client Name' : 'Vendor Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clientVendor}
                    onChange={(e) => setFormData({ ...formData, clientVendor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice/PO Number</label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="INV-2024-XXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                  <select
                    required
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {paymentMethods.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference/Transaction ID</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="NEFT/UPI/Cheque number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800"
                >
                  {isEditing ? 'Update' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Amount */}
              <div className={`p-6 rounded-xl text-center ${
                selectedPayment.type === 'received' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <p className={`text-sm font-medium mb-1 ${
                  selectedPayment.type === 'received' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {selectedPayment.type === 'received' ? 'Amount Received' : 'Amount Paid'}
                </p>
                <p className={`text-3xl font-bold ${
                  selectedPayment.type === 'received' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {formatCurrency(selectedPayment.amount)}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Company</span>
                  <span className="font-medium text-gray-900">{selectedPayment.company}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">{selectedPayment.type === 'received' ? 'Client' : 'Vendor'}</span>
                  <span className="font-medium text-gray-900">{selectedPayment.clientVendor}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Invoice/PO</span>
                  <span className="font-medium text-gray-900">{selectedPayment.invoiceNumber}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Method</span>
                  <span className="font-medium text-gray-900">{getMethodLabel(selectedPayment.method)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium text-gray-900">{selectedPayment.date}</span>
                </div>
                {selectedPayment.reference && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-medium text-gray-900">{selectedPayment.reference}</span>
                  </div>
                )}
                {selectedPayment.notes && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 text-sm">Notes</span>
                    <p className="font-medium text-gray-900 mt-1">{selectedPayment.notes}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowViewModal(false)}
                className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
