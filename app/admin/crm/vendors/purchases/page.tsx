'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Plus, Search, FileText, Building2, Calendar, IndianRupee, X, Eye, Edit, Trash2,
  Package, Filter, ArrowLeft, CheckCircle, Clock, AlertCircle
} from 'lucide-react';

const productTypes = [
  'Pouches', 'Labels', 'Boxes', 'Brochures', 'Visiting Cards', 'Envelopes', 
  'Paper Tubes', 'Letterheads', 'Catalogs', 'Packaging', 'Flex/Banner', 'Other'
];

const vendors = [
  { id: 1, name: 'Raj Packaging' },
  { id: 2, name: 'Gujarat Papers' },
  { id: 3, name: 'Shree Inks' },
  { id: 4, name: 'Modern Plastics' },
];

const jobs = [
  { id: 1, jobId: 'AAY-001', name: 'Wedding Cards - Sharma' },
  { id: 2, jobId: 'AAY-002', name: 'Brochures - Royal Prints' },
  { id: 3, jobId: 'AAY-003', name: 'Packaging - Gujarat Textiles' },
];

const initialPurchases = [
  { id: 1, billNo: 'PB-001', vendorId: 1, vendorName: 'Raj Packaging', productType: 'Boxes',
    description: 'Corrugated boxes 12x10x8', quantity: 500, rate: 45, amount: 22500,
    gstRate: 18, gstAmount: 4050, totalAmount: 26550, jobId: 3, jobName: 'AAY-003 - Packaging',
    billDate: '2025-12-20', dueDate: '2025-12-30', paymentStatus: 'partial', paidAmount: 15000,
    createdAt: '2025-12-20' },
  { id: 2, billNo: 'PB-002', vendorId: 2, vendorName: 'Gujarat Papers', productType: 'Paper Tubes',
    description: 'A4 Paper 75 GSM - 50 reams', quantity: 50, rate: 280, amount: 14000,
    gstRate: 12, gstAmount: 1680, totalAmount: 15680, jobId: null, jobName: 'General Stock',
    billDate: '2025-12-22', dueDate: '2026-01-05', paymentStatus: 'pending', paidAmount: 0,
    createdAt: '2025-12-22' },
  { id: 3, billNo: 'PB-003', vendorId: 3, vendorName: 'Shree Inks', productType: 'Other',
    description: 'CMYK Ink Set - 4 colors', quantity: 2, rate: 8500, amount: 17000,
    gstRate: 18, gstAmount: 3060, totalAmount: 20060, jobId: null, jobName: 'General Stock',
    billDate: '2025-12-18', dueDate: '2025-12-25', paymentStatus: 'paid', paidAmount: 20060,
    createdAt: '2025-12-18' },
  { id: 4, billNo: 'PB-004', vendorId: 1, vendorName: 'Raj Packaging', productType: 'Pouches',
    description: 'Laminated pouches 100g', quantity: 1000, rate: 8, amount: 8000,
    gstRate: 18, gstAmount: 1440, totalAmount: 9440, jobId: 1, jobName: 'AAY-001 - Wedding Cards',
    billDate: '2025-12-24', dueDate: '2026-01-10', paymentStatus: 'pending', paidAmount: 0,
    createdAt: '2025-12-24' },
];

export default function VendorPurchasesPage() {
  const [purchases, setPurchases] = useState(initialPurchases);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [billCounter, setBillCounter] = useState(5);

  const [formData, setFormData] = useState({
    vendorId: '', productType: 'Boxes', description: '', quantity: 0, rate: 0,
    gstRate: 18, jobId: '', billDate: '', dueDate: ''
  });

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVendor = vendorFilter === 'all' || p.vendorId.toString() === vendorFilter;
    const matchesStatus = statusFilter === 'all' || p.paymentStatus === statusFilter;
    return matchesSearch && matchesVendor && matchesStatus;
  });

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const calculateAmounts = () => {
    const amount = formData.quantity * formData.rate;
    const gstAmount = amount * (formData.gstRate / 100);
    const totalAmount = amount + gstAmount;
    return { amount, gstAmount, totalAmount };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vendor = vendors.find(v => v.id.toString() === formData.vendorId);
    const job = jobs.find(j => j.id.toString() === formData.jobId);
    const { amount, gstAmount, totalAmount } = calculateAmounts();
    
    if (editingPurchase) {
      setPurchases(purchases.map(p => p.id === editingPurchase.id ? 
        { ...p, ...formData, vendorId: parseInt(formData.vendorId), vendorName: vendor?.name || '',
          jobId: formData.jobId ? parseInt(formData.jobId) : null, 
          jobName: job ? `${job.jobId} - ${job.name}` : 'General Stock',
          amount, gstAmount, totalAmount } : p));
    } else {
      const newPurchase = {
        id: Date.now(), billNo: `PB-${String(billCounter).padStart(3, '0')}`,
        ...formData, vendorId: parseInt(formData.vendorId), vendorName: vendor?.name || '',
        jobId: formData.jobId ? parseInt(formData.jobId) : null,
        jobName: job ? `${job.jobId} - ${job.name}` : 'General Stock',
        amount, gstAmount, totalAmount, paymentStatus: 'pending', paidAmount: 0,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setPurchases([newPurchase, ...purchases]);
      setBillCounter(billCounter + 1);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ vendorId: '', productType: 'Boxes', description: '', quantity: 0, rate: 0,
      gstRate: 18, jobId: '', billDate: '', dueDate: '' });
    setEditingPurchase(null);
    setShowModal(false);
  };

  const handleEdit = (purchase: any) => {
    setFormData({ vendorId: purchase.vendorId.toString(), productType: purchase.productType,
      description: purchase.description, quantity: purchase.quantity, rate: purchase.rate,
      gstRate: purchase.gstRate, jobId: purchase.jobId?.toString() || '', 
      billDate: purchase.billDate, dueDate: purchase.dueDate });
    setEditingPurchase(purchase);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this purchase bill?')) setPurchases(purchases.filter(p => p.id !== id));
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-orange-100 text-orange-700';
      case 'pending': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Stats
  const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalPending = totalPurchases - totalPaid;
  const totalCOGS = purchases.filter(p => p.jobId).reduce((sum, p) => sum + p.amount, 0);

  const totals = calculateAmounts();

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm/vendors" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Bills</h1>
            <p className="text-gray-500">Track vendor purchases & COGS</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium">
          <Plus size={18} />
          <span>Add Purchase</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Purchases</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(totalPurchases)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Paid to Vendors</p>
          <p className="text-lg sm:text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Pending Payments</p>
          <p className="text-lg sm:text-xl font-bold text-red-600">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Job-linked COGS</p>
          <p className="text-lg sm:text-xl font-bold text-purple-600">{formatCurrency(totalCOGS)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search bills..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Purchase List */}
      <div className="space-y-3">
        {filteredPurchases.map(purchase => (
          <div key={purchase.id} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
            purchase.paymentStatus === 'pending' && new Date(purchase.dueDate) < new Date() ? 'border-l-4 border-l-red-500' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-indigo-600 font-medium">{purchase.billNo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(purchase.paymentStatus)}`}>
                    {purchase.paymentStatus}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{purchase.productType}</span>
                </div>
                <h3 className="font-semibold text-gray-900">{purchase.description}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1"><Building2 size={14} />{purchase.vendorName}</span>
                  <span className="flex items-center gap-1"><Package size={14} />{purchase.jobName}</span>
                  <span className="flex items-center gap-1"><Calendar size={14} />Due: {new Date(purchase.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-lg text-gray-900">{formatCurrency(purchase.totalAmount)}</p>
                  <p className="text-xs text-gray-500">
                    Paid: <span className="text-green-600 font-medium">{formatCurrency(purchase.paidAmount)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setSelectedPurchase(purchase); setShowDetailModal(true); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={18} /></button>
                  <button onClick={() => handleEdit(purchase)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(purchase.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
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
              <h2 className="text-xl font-bold">{editingPurchase ? 'Edit Purchase' : 'Add Purchase Bill'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Vendor *</label>
                  <select required value={formData.vendorId} onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                  <label className="block text-sm font-medium mb-1.5">Link to Job</label>
                  <select value={formData.jobId} onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    <option value="">General Stock</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.jobId} - {j.name}</option>)}
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
                    className="w-full px-3 py-2.5 border rounded-lg">
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
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Due Date *</label>
                  <input type="date" required value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
              </div>

              {/* Calculation Preview */}
              <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({formData.quantity} × ₹{formData.rate})</span>
                  <span className="font-medium">{formatCurrency(totals.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST ({formData.gstRate}%)</span>
                  <span className="font-medium">{formatCurrency(totals.gstAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t border-indigo-200">
                  <span>Total Amount</span>
                  <span className="text-indigo-700">{formatCurrency(totals.totalAmount)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  {editingPurchase ? 'Update' : 'Add'} Purchase
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
                <span className="font-mono text-indigo-600">{selectedPurchase.billNo}</span>
                <h2 className="text-xl font-bold">{selectedPurchase.description}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Vendor</p>
                  <p className="font-medium">{selectedPurchase.vendorName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Product Type</p>
                  <p className="font-medium">{selectedPurchase.productType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Linked Job</p>
                  <p className="font-medium">{selectedPurchase.jobName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedPurchase.paymentStatus)}`}>
                    {selectedPurchase.paymentStatus}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bill Date</p>
                  <p className="font-medium">{new Date(selectedPurchase.billDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Due Date</p>
                  <p className="font-medium">{new Date(selectedPurchase.dueDate).toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Quantity × Rate</span>
                  <span>{selectedPurchase.quantity} × ₹{selectedPurchase.rate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedPurchase.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST ({selectedPurchase.gstRate}%)</span>
                  <span>{formatCurrency(selectedPurchase.gstAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(selectedPurchase.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Paid</span>
                  <span className="text-green-600 font-medium">{formatCurrency(selectedPurchase.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Balance Due</span>
                  <span className="text-red-600">{formatCurrency(selectedPurchase.totalAmount - selectedPurchase.paidAmount)}</span>
                </div>
              </div>

              <Link href="/admin/crm/vendors/payments" 
                className="block w-full text-center px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700">
                Record Payment
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
