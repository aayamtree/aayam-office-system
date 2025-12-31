'use client';

import { useState } from 'react';
import {
  Plus, Search, FileText, Eye, Edit, Trash2, X, Send, Download,
  Building2, Calendar, IndianRupee, CheckCircle, Clock, AlertCircle
} from 'lucide-react';

const currentUser = { id: 1, name: 'Marketing User' };

const clients = [
  { id: 1, name: 'Sharma Industries' },
  { id: 2, name: 'Patel Enterprises' },
  { id: 3, name: 'Gujarat Textiles' },
  { id: 4, name: 'Royal Prints' },
];

const quotationStatuses = [
  { id: 'draft', name: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { id: 'sent', name: 'Sent', color: 'bg-blue-100 text-blue-700' },
  { id: 'viewed', name: 'Viewed', color: 'bg-purple-100 text-purple-700' },
  { id: 'accepted', name: 'Accepted', color: 'bg-green-100 text-green-700' },
  { id: 'rejected', name: 'Rejected', color: 'bg-red-100 text-red-700' },
  { id: 'expired', name: 'Expired', color: 'bg-orange-100 text-orange-700' },
];

const initialQuotations = [
  {
    id: 1, quotationId: 'QT-001', clientId: 1, clientName: 'Sharma Industries', subject: 'Wedding Invitation Cards',
    items: [{ name: 'Wedding Cards', qty: 1000, rate: 25, amount: 25000 }, { name: 'Envelope', qty: 1000, rate: 5, amount: 5000 }],
    subtotal: 30000, gstRate: 18, gstAmount: 5400, total: 35400, validUntil: '2026-01-10',
    status: 'sent', createdAt: '2025-12-24', ownerId: 1
  },
  {
    id: 2, quotationId: 'QT-002', clientId: 3, clientName: 'Gujarat Textiles', subject: 'Product Packaging',
    items: [{ name: 'Corrugated Box', qty: 2000, rate: 45, amount: 90000 }],
    subtotal: 90000, gstRate: 18, gstAmount: 16200, total: 106200, validUntil: '2026-01-15',
    status: 'viewed', createdAt: '2025-12-23', ownerId: 1
  },
  {
    id: 3, quotationId: 'QT-003', clientId: 2, clientName: 'Patel Enterprises', subject: 'Business Stationery',
    items: [{ name: 'Business Cards', qty: 500, rate: 8, amount: 4000 }, { name: 'Letterhead', qty: 200, rate: 15, amount: 3000 }],
    subtotal: 7000, gstRate: 18, gstAmount: 1260, total: 8260, validUntil: '2026-01-05',
    status: 'draft', createdAt: '2025-12-25', ownerId: 1
  },
  {
    id: 4, quotationId: 'QT-004', clientId: 4, clientName: 'Royal Prints', subject: 'Brochures and Catalogs',
    items: [{ name: 'A4 Brochure', qty: 500, rate: 35, amount: 17500 }],
    subtotal: 17500, gstRate: 18, gstAmount: 3150, total: 20650, validUntil: '2025-12-20',
    status: 'accepted', createdAt: '2025-12-15', ownerId: 1
  },
];

export default function MarketingQuotationsPage() {
  const [quotations, setQuotations] = useState(initialQuotations.filter(q => q.ownerId === currentUser.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<any>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [quotationCounter, setQuotationCounter] = useState(5);

  const [formData, setFormData] = useState({
    clientId: '', subject: '', validUntil: '', gstRate: 18,
    items: [{ name: '', qty: 0, rate: 0, amount: 0 }]
  });

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = q.quotationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const getStatusBadge = (status: string) => quotationStatuses.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-700';

  const calculateTotals = (items: any[], gstRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.rate), 0);
    const gstAmount = subtotal * (gstRate / 100);
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'qty' || field === 'rate') {
      newItems[index].amount = newItems[index].qty * newItems[index].rate;
    }
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { name: '', qty: 0, rate: 0, amount: 0 }] });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id.toString() === formData.clientId);
    const { subtotal, gstAmount, total } = calculateTotals(formData.items, formData.gstRate);

    if (editingQuotation) {
      setQuotations(quotations.map(q => q.id === editingQuotation.id ?
        { ...q, ...formData, clientId: parseInt(formData.clientId), clientName: client?.name || '', subtotal, gstAmount, total } : q));
    } else {
      const newQuotation = {
        id: Date.now(), quotationId: `QT-${String(quotationCounter).padStart(3, '0')}`,
        ...formData, clientId: parseInt(formData.clientId), clientName: client?.name || '',
        subtotal, gstAmount, total, status: 'draft', createdAt: new Date().toISOString().split('T')[0], ownerId: currentUser.id
      };
      setQuotations([newQuotation, ...quotations]);
      setQuotationCounter(quotationCounter + 1);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      clientId: '', subject: '', validUntil: '', gstRate: 18,
      items: [{ name: '', qty: 0, rate: 0, amount: 0 }]
    });
    setEditingQuotation(null);
    setShowModal(false);
  };

  const handleEdit = (quotation: any) => {
    setFormData({
      clientId: quotation.clientId.toString(), subject: quotation.subject,
      validUntil: quotation.validUntil, gstRate: quotation.gstRate, items: [...quotation.items]
    });
    setEditingQuotation(quotation);
    setShowModal(true);
  };

  const handleSend = (id: number) => {
    if (confirm('Send this quotation to client?')) {
      setQuotations(quotations.map(q => q.id === id ? { ...q, status: 'sent' } : q));
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this quotation?')) setQuotations(quotations.filter(q => q.id !== id));
  };

  // Stats
  const totalQuotations = quotations.length;
  const sentQuotations = quotations.filter(q => q.status === 'sent').length;
  const acceptedQuotations = quotations.filter(q => q.status === 'accepted').length;
  const totalValue = quotations.reduce((sum, q) => sum + q.total, 0);

  const totals = calculateTotals(formData.items, formData.gstRate);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-500">Create and manage quotations for clients</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium">
          <Plus size={18} />
          <span>Create Quotation</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Total Quotations</p>
          <p className="text-2xl font-bold text-gray-900">{totalQuotations}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Sent</p>
          <p className="text-2xl font-bold text-blue-600">{sentQuotations}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Accepted</p>
          <p className="text-2xl font-bold text-green-600">{acceptedQuotations}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search quotations..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            {quotationStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Quotations List */}
      <div className="space-y-3">
        {filteredQuotations.map(quotation => (
          <div key={quotation.id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-indigo-600 font-medium">{quotation.quotationId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(quotation.status)}`}>
                    {quotation.status}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{quotation.subject}</h3>
                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1"><Building2 size={14} />{quotation.clientName}</span>
                  <span className="flex items-center gap-1"><Calendar size={14} />Valid: {new Date(quotation.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-lg text-gray-900">{formatCurrency(quotation.total)}</p>
                  <p className="text-xs text-gray-500">incl. GST {quotation.gstRate}%</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setSelectedQuotation(quotation); setShowDetailModal(true); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye size={18} /></button>
                  {quotation.status === 'draft' && (
                    <>
                      <button onClick={() => handleSend(quotation.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Send"><Send size={18} /></button>
                      <button onClick={() => handleEdit(quotation)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Edit"><Edit size={18} /></button>
                    </>
                  )}
                  <button onClick={() => handleDelete(quotation.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredQuotations.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No quotations found</h3>
          <p className="mt-1 text-gray-500">Create your first quotation</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingQuotation ? 'Edit Quotation' : 'Create Quotation'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Client *</label>
                  <select required value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Valid Until *</label>
                  <input type="date" required value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Subject *</label>
                <input type="text" required value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" placeholder="Wedding Invitation Cards" />
              </div>

              {/* Items */}
              <div>
                <label className="block text-sm font-medium mb-2">Items</label>
                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input type="text" placeholder="Item name" value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                      <input type="number" placeholder="Qty" value={item.qty || ''}
                        onChange={(e) => handleItemChange(index, 'qty', parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border rounded-lg text-sm" />
                      <input type="number" placeholder="Rate" value={item.rate || ''}
                        onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-2 border rounded-lg text-sm" />
                      <span className="w-24 text-sm font-medium text-right">{formatCurrency(item.qty * item.rate)}</span>
                      {formData.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addItem}
                  className="mt-2 text-sm text-indigo-600 hover:underline flex items-center gap-1">
                  <Plus size={14} />Add Item
                </button>
              </div>

              {/* GST & Totals */}
              <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">GST Rate</span>
                  <select value={formData.gstRate} onChange={(e) => setFormData({ ...formData, gstRate: parseInt(e.target.value) })}
                    className="px-2 py-1 border rounded-lg text-sm">
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST ({formData.gstRate}%)</span>
                  <span className="font-medium">{formatCurrency(totals.gstAmount)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-indigo-200">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-indigo-700 text-lg">{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  {editingQuotation ? 'Update' : 'Create'} Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="font-mono text-indigo-600">{selectedQuotation.quotationId}</span>
                <h2 className="text-xl font-bold">{selectedQuotation.subject}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Client</span>
                <span className="font-medium">{selectedQuotation.clientName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedQuotation.status)}`}>
                  {selectedQuotation.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Valid Until</span>
                <span className="font-medium">{new Date(selectedQuotation.validUntil).toLocaleDateString('en-IN')}</span>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                <div className="space-y-2">
                  {selectedQuotation.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.name} × {item.qty}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedQuotation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST ({selectedQuotation.gstRate}%)</span>
                  <span>{formatCurrency(selectedQuotation.gstAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-indigo-600">{formatCurrency(selectedQuotation.total)}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl font-medium">
                  <Download size={18} />Download PDF
                </button>
                {selectedQuotation.status === 'draft' && (
                  <button onClick={() => { handleSend(selectedQuotation.id); setShowDetailModal(false); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium">
                    <Send size={18} />Send
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
