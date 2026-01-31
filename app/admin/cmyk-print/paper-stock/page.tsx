'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, ArrowLeft, Edit, Trash2, X,
  Package, AlertTriangle, TrendingDown, TrendingUp, Loader2
} from 'lucide-react';
import { usePaperStock } from '@/lib/hooks';
import { PaperStock } from '@/types/database';

const categories = ['All', 'Paper', 'Photo Paper', 'Toner', 'Lamination', 'Binding', 'Card Stock', 'Envelope', 'Other'];

export default function PaperStockPage() {
  const { stock, loading, createStockItem, updateStockItem, deleteStockItem } = usePaperStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaperStock | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [restockQty, setRestockQty] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    // Just mapping "category" for UI purposes, but we don't strictly have a category field in DB yet
    // Assuming we store it in local state or repurpose a field? 
    // The type `PaperStock` doesn't strictly have `category`. Let's assume we use it as part of name or add it later.
    // For now, I'll keep it simple and maybe omit strict category if not in DB schema.
    // Looking at schema: name, size, gsm, quantity, unit, reorder_level, cost_per_unit, supplier.
    // We can infer category from name or just skip it.
    size: '',
    gsm: 0,
    quantity: 0,
    reorder_level: 0,
    unit: 'pcs',
    cost_per_unit: 0,
    supplier: '',
  });

  const getStatus = (item: PaperStock) => {
    if (item.quantity === 0) return 'out_of_stock';
    if (item.quantity <= item.reorder_level) return 'low_stock';
    return 'in_stock';
  };

  const filteredStock = stock.filter(item => {
    const status = getStatus(item);
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    // Simplified category filter (contains string)
    const matchesCategory = categoryFilter === 'All' || item.name.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'in_stock': 'bg-gray-100 text-gray-900 border-green-200',
      'low_stock': 'bg-amber-100 text-amber-700 border-gray-200',
      'out_of_stock': 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'in_stock': 'In Stock',
      'low_stock': 'Low Stock',
      'out_of_stock': 'Out of Stock',
    };
    return labels[status] || status;
  };

  const handleAddNew = () => {
    setFormData({
      name: '', size: '', gsm: 0, quantity: 0, reorder_level: 10, unit: 'pcs', cost_per_unit: 0, supplier: ''
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (item: PaperStock) => {
    setFormData({
      name: item.name,
      size: item.size || '',
      gsm: item.gsm || 0,
      quantity: item.quantity,
      reorder_level: item.reorder_level,
      unit: item.unit,
      cost_per_unit: item.cost_per_unit,
      supplier: item.supplier || '',
    });
    setSelectedItem(item);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleRestock = (item: PaperStock) => {
    setSelectedItem(item);
    setRestockQty('');
    setShowRestockModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this item?')) {
      await deleteStockItem(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...formData };

      if (isEditing && selectedItem) {
        await updateStockItem(selectedItem.id, payload);
      } else {
        await createStockItem(payload);
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert('Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestockSubmit = async () => {
    if (selectedItem && restockQty) {
      setSubmitting(true);
      try {
        const addedQty = parseInt(restockQty);
        const newQuantity = selectedItem.quantity + addedQty;

        await updateStockItem(selectedItem.id, {
          quantity: newQuantity,
          last_restocked: new Date().toISOString()
        });

        setShowRestockModal(false);
      } catch (error) {
        console.error(error);
        alert('Failed to restock');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const lowStockCount = stock.filter(i => i.quantity <= i.reorder_level && i.quantity > 0).length;
  const outOfStockCount = stock.filter(i => i.quantity === 0).length;
  const totalValue = stock.reduce((sum, item) => sum + (item.quantity * item.cost_per_unit), 0);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-page-title text-gray-900">Paper Stock</h1>
            <p className="text-sm text-gray-500">{stock.length} items in inventory</p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center gap-2 bg-oms-blue text-white px-4 py-2.5 rounded-xl hover:bg-blue-600 transition-colors"
        >
          <Plus size={18} />
          <span>Add Item</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-green-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-gray-900" />
            <span className="text-xs text-gray-900 font-medium">In Stock</span>
          </div>
          <p className="text-page-title text-gray-900">
            {loading ? '...' : stock.length - lowStockCount - outOfStockCount}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={16} className="text-oms-orange" />
            <span className="text-xs text-oms-orange font-medium">Low Stock</span>
          </div>
          <p className="text-page-title text-amber-700">{loading ? '...' : lowStockCount}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="text-xs text-red-600 font-medium">Out of Stock</span>
          </div>
          <p className="text-page-title text-red-700">{loading ? '...' : outOfStockCount}</p>
        </div>
        <div className="bg-[rgba(0,0,255,0.1)] border border-[rgba(0,0,255,0.2)]-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-oms-blue" />
            <span className="text-xs text-oms-blue font-medium">Stock Value</span>
          </div>
          <p className="text-page-title text-oms-blue">
            {loading ? '...' : `₹${totalValue.toLocaleString()}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
        >
          <option value="all">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Stock List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading stock data...</div>
        ) : filteredStock.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No items found.</div>
        ) : filteredStock.map((item) => {
          const status = getStatus(item);
          return (
            <div key={item.id} className={`bg-white rounded-xl p-4 border ${status === 'out_of_stock' ? 'border-red-200' :
                status === 'low_stock' ? 'border-gray-200' : 'border-gray-100'
              }`}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(status)}`}>
                      {getStatusLabel(status)}
                    </span>
                  </div>
                  {item.size && <p className="text-sm text-gray-500">{item.size} {item.gsm ? `| ${item.gsm} GSM` : ''}</p>}
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className={`font-medium ${item.quantity < item.reorder_level ? 'text-red-600' : 'text-gray-900'}`}>
                      Stock: {item.quantity} {item.unit}
                    </span>
                    <span className="text-gray-400">Min: {item.reorder_level} {item.unit}</span>
                    <span className="text-gray-400">₹{item.cost_per_unit}/{item.unit}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestock(item)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-900 rounded-xl hover:bg-green-200 text-sm font-medium transition-colors"
                  >
                    <Plus size={14} /> Restock
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-section text-gray-900">
                {isEditing ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size / Attributes</label>
                  <input
                    type="text"
                    placeholder="e.g. A4"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GSM</label>
                  <input
                    type="number"
                    value={formData.gsm}
                    onChange={(e) => setFormData({ ...formData, gsm: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                  >
                    <option value="pcs">pcs</option>
                    <option value="reams">reams</option>
                    <option value="sheets">sheets</option>
                    <option value="rolls">rolls</option>
                    <option value="sets">sets</option>
                    <option value="boxes">boxes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost (₹/unit)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_per_unit}
                    onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-oms-blue text-white rounded-xl hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {isEditing ? 'Update' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-section text-gray-900">Restock Item</h2>
              <button onClick={() => setShowRestockModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="font-medium text-gray-900">{selectedItem.name}</p>
                <p className="text-sm text-gray-500">Current: {selectedItem.quantity} {selectedItem.unit}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Quantity</label>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-4 py-3 text-page-title border border-gray-200 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0"
                  autoFocus
                />
              </div>

              {restockQty && (
                <p className="text-center text-gray-900 font-medium">
                  New Stock: {selectedItem.quantity + parseInt(restockQty || '0')} {selectedItem.unit}
                </p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowRestockModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200">
                  Cancel
                </button>
                <button
                  onClick={handleRestockSubmit}
                  disabled={submitting || !restockQty}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  Restock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
