'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import {
  Search, Plus, ArrowLeft, Edit, Trash2, X,
  Package, AlertTriangle, TrendingDown, TrendingUp, Loader2, ChevronDown
} from 'lucide-react';
import { usePaperStock } from '@/lib/hooks';
import { PaperStock } from '@/types/database';
import { useConfirm } from '@/components/ConfirmModal';

// Default suggested categories — users can add their own freely
const DEFAULT_CATEGORIES = [
  'Sticker', 'Opaque', 'Texture', 'Standard', 'Photo Paper',
  'Matt', 'Glossy', 'Lamination Film', 'Card Stock', 'Craft Paper', 'Other'
];

// Common paper sizes used in printing
const SIZE_PRESETS = [
  { label: '13×19"', value: '13×19' },
  { label: '12×18"', value: '12×18' },
  { label: '12×36"', value: '12×36' },
  { label: '19×25"', value: '19×25' },
  { label: 'A4', value: 'A4 (8.27×11.69)' },
  { label: 'A3', value: 'A3 (11.69×16.54)' },
  { label: 'A2', value: 'A2 (16.54×23.39)' },
  { label: 'Custom', value: 'custom' },
];

const emptyForm = {
  name: '',
  category: '',
  size: '',
  customSize: '',
  gsm: '' as string | number,
  quantity: 0,
  reorder_level: 100,
  unit: 'sheets',
  cost_per_unit: '' as string | number,
  supplier: '',
};

export default function PaperStockPage() {
  const { stock, loading, createStockItem, updateStockItem, deleteStockItem } = usePaperStock();
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaperStock | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [restockQty, setRestockQty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });

  // Flexible categories: defaults + any user has already used + ones added this session
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const allCategories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...customCategories,
    ...stock.map(s => s.category).filter((c): c is string => !!c && c.trim() !== ''),
  ]));

  const handleAddCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (!allCategories.some(c => c.toLowerCase() === name.toLowerCase())) {
      setCustomCategories(prev => [...prev, name]);
    }
    setFormData(prev => ({ ...prev, category: name }));
    setNewCategory('');
    setShowNewCategory(false);
  };

  const getStatus = (item: PaperStock) => {
    if (item.quantity === 0) return 'out_of_stock';
    if (item.quantity <= item.reorder_level) return 'low_stock';
    return 'in_stock';
  };

  const filteredStock = stock.filter(item => {
    const status = getStatus(item);
    const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadgeClass = (status: string) => ({
    'in_stock': 'bg-green-50 text-green-700 border-green-200',
    'low_stock': 'bg-amber-50 text-amber-700 border-amber-200',
    'out_of_stock': 'bg-red-50 text-red-700 border-red-200',
  }[status] || 'bg-gray-100 text-gray-700');

  const getStatusLabel = (status: string) => ({
    'in_stock': 'In Stock', 'low_stock': 'Low Stock', 'out_of_stock': 'Out of Stock'
  }[status] || status);

  const handleAddNew = () => {
    setFormData({ ...emptyForm });
    setIsEditing(false);
    setSelectedItem(null);
    setShowNewCategory(false);
    setNewCategory('');
    setShowModal(true);
  };

  const handleEdit = (item: PaperStock) => {
    setFormData({
      name: item.name,
      category: item.category || '',
      size: item.size || '',
      customSize: '',
      gsm: item.gsm || '',
      quantity: item.quantity,
      reorder_level: item.reorder_level,
      unit: item.unit || 'sheets',
      cost_per_unit: item.cost_per_unit || '',
      supplier: item.supplier || '',
    });
    setSelectedItem(item);
    setIsEditing(true);
    setShowNewCategory(false);
    setNewCategory('');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    // The stock item carries the cost per sheet every CMYK bill prices against.
    const { confirmed } = await confirm({
      title: 'Delete this paper?',
      message: 'The stock item is removed for good.',
      consequences: [
        'The sheet count and the cost per sheet go with it \u2014 stock value stops counting this paper.',
        'Bills already made keep their price, but the paper they were priced from is no longer there to check against.',
        'The only copy left is the weekly backup, which can be up to seven days old.',
      ],
      variant: 'danger',
      confirmLabel: 'Delete paper',
      requireExactInput: 'DELETE',
    });
    if (!confirmed) return;
    const result = await deleteStockItem(id);
    if (result?.error) toast.error('Could not delete the paper: ' + result.error);
    else toast.success('Item deleted');
  };

  const getFinalSize = () => {
    if (formData.size === 'custom') return formData.customSize;
    return formData.size;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Item name is required'); return; }
    if (!formData.cost_per_unit || parseFloat(String(formData.cost_per_unit)) <= 0) {
      toast.error('Enter a valid cost per sheet'); return;
    }

    setSubmitting(true);
    try {
      const payload: Omit<PaperStock, 'id' | 'created_at' | 'updated_at'> = {
        name: formData.name.trim(),
        category: formData.category || undefined,
        size: getFinalSize() || undefined,
        gsm: formData.gsm ? parseInt(String(formData.gsm)) : undefined,
        quantity: formData.quantity || 0,
        reorder_level: formData.reorder_level || 100,
        unit: 'sheets', // always sheets for paper
        cost_per_unit: parseFloat(String(formData.cost_per_unit)),
        supplier: formData.supplier || undefined,
      };

      if (isEditing && selectedItem) {
        await updateStockItem(selectedItem.id, payload);
        toast.success('Paper updated');
      } else {
        await createStockItem(payload);
        toast.success('Paper added to stock');
      }
      setShowModal(false);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestockSubmit = async () => {
    if (!selectedItem || !restockQty || parseInt(restockQty) <= 0) {
      toast.error('Enter a valid quantity'); return;
    }
    setSubmitting(true);
    try {
      const newQty = selectedItem.quantity + parseInt(restockQty);
      await updateStockItem(selectedItem.id, { quantity: newQty, last_restocked: new Date().toISOString() });
      toast.success(`Restocked — new total: ${newQty} sheets`);
      setShowRestockModal(false);
    } catch {
      toast.error('Failed to restock');
    } finally {
      setSubmitting(false);
    }
  };

  const lowStockCount = stock.filter(i => i.quantity <= i.reorder_level && i.quantity > 0).length;
  const outOfStockCount = stock.filter(i => i.quantity === 0).length;
  const totalValue = stock.reduce((sum, item) => sum + (item.quantity * item.cost_per_unit), 0);

  // Group filtered stock by category for at-a-glance cards
  const groupedStock = filteredStock.reduce((acc, item) => {
    const key = item.category && item.category.trim() ? item.category : 'Uncategorized';
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<string, PaperStock[]>);
  const groupKeys = Object.keys(groupedStock).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-gray-100 rounded-md lg:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Paper Stock</h1>
            <p className="text-sm text-gray-500">{stock.length} paper type{stock.length !== 1 ? 's' : ''} in inventory</p>
          </div>
        </div>
        <button onClick={handleAddNew}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-md hover:bg-gray-800 font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Paper Type
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-green-200 rounded-md p-3">
          <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-gray-600" /><span className="text-xs font-medium text-gray-600">In Stock</span></div>
          <p className="text-2xl font-bold text-gray-900">{loading ? '…' : stock.length - lowStockCount - outOfStockCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3">
          <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-destructive" /><span className="text-xs font-medium text-destructive">Low Stock</span></div>
          <p className="text-2xl font-bold text-amber-700">{loading ? '…' : lowStockCount}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-xs font-medium text-red-600">Out of Stock</span></div>
          <p className="text-2xl font-bold text-red-700">{loading ? '…' : outOfStockCount}</p>
        </div>
        <div className="bg-gray-900 rounded-md p-3">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-white/60" /><span className="text-xs font-medium text-white/60">Stock Value</span></div>
          <p className="text-2xl font-bold text-white">{loading ? '…' : `₹${totalValue.toLocaleString('en-IN')}`}</p>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['All', ...allCategories].map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0
              ${categoryFilter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search paper name or category..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400">
          <option value="all">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Stock — grouped by category for at-a-glance visibility */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredStock.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No paper types found.</p>
          <button onClick={handleAddNew} className="mt-2 text-sm text-gray-700 underline">Add your first paper type</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {groupKeys.map(cat => {
            const items = groupedStock[cat];
            const catSheets = items.reduce((s, i) => s + i.quantity, 0);
            const catLow = items.some(i => getStatus(i) !== 'in_stock');
            return (
              <div key={cat} className="bg-white rounded-md border border-gray-200 overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{cat}</span>
                    {catLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <span className="text-xs text-gray-500">{items.length} type{items.length !== 1 ? 's' : ''} · {catSheets.toLocaleString('en-IN')} sheets</span>
                </div>
                {/* Items */}
                <div className="divide-y divide-gray-100">
                  {items.map(item => {
                    const status = getStatus(item);
                    const qtyColor = status === 'out_of_stock' ? 'text-red-600' : status === 'low_stock' ? 'text-amber-600' : 'text-gray-900';
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {[item.size, item.gsm ? `${item.gsm} GSM` : null, `₹${item.cost_per_unit}/sheet`, item.supplier]
                              .filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="text-right shrink-0 w-16">
                          <p className={`text-lg font-bold leading-none ${qtyColor}`}>{item.quantity.toLocaleString('en-IN')}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">min {item.reorder_level}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { setSelectedItem(item); setRestockQty(''); setShowRestockModal(true); }}
                            title="Restock"
                            className="p-1.5 bg-gray-100 text-gray-900 rounded-md hover:bg-green-100 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEdit(item)} title="Edit"
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} title="Delete"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">{isEditing ? 'Edit Paper' : 'Add New Paper Type'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Name *</label>
                <input type="text" required placeholder="e.g. Glossy Sticker Paper" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>

              {/* Category — flexible, add your own */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Type / Category</label>
                <div className="flex flex-wrap gap-2">
                  {allCategories.map(cat => (
                    <button key={cat} type="button"
                      onClick={() => setFormData({ ...formData, category: formData.category === cat ? '' : cat })}
                      className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-all
                        ${formData.category === cat ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {cat}
                    </button>
                  ))}
                  {!showNewCategory && (
                    <button type="button" onClick={() => setShowNewCategory(true)}
                      className="px-3 py-1.5 rounded-md border border-dashed border-gray-300 text-xs font-medium text-primary hover:bg-gray-50 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add category
                    </button>
                  )}
                </div>
                {showNewCategory && (
                  <div className="flex gap-2 mt-2">
                    <input type="text" autoFocus placeholder="New category name (e.g. Vinyl)" value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    <button type="button" onClick={handleAddCategory}
                      className="px-3 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800">Add</button>
                    <button type="button" onClick={() => { setShowNewCategory(false); setNewCategory(''); }}
                      className="px-3 py-2 border border-gray-200 text-gray-600 rounded-md text-sm hover:bg-gray-50">Cancel</button>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Type any name — it&apos;s saved and appears as a chip next time.</p>
              </div>

              {/* Size presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Size</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {SIZE_PRESETS.map(s => (
                    <button key={s.value} type="button"
                      onClick={() => setFormData({ ...formData, size: s.value, customSize: '' })}
                      className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-all text-center
                        ${formData.size === s.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                {formData.size === 'custom' && (
                  <input type="text" placeholder='e.g. 14×20" or 35×50cm' value={formData.customSize}
                    onChange={e => setFormData({ ...formData, customSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm" />
                )}
              </div>

              {/* GSM + Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GSM (paper weight)</label>
                  <input type="number" placeholder="e.g. 320" value={formData.gsm}
                    onChange={e => setFormData({ ...formData, gsm: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  <p className="text-xs text-gray-400 mt-1">Common: 80, 130, 200, 250, 320</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Sheet (₹) *</label>
                  <input type="number" required min="0" step="0.01" placeholder="e.g. 15.00" value={formData.cost_per_unit}
                    onChange={e => setFormData({ ...formData, cost_per_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
              </div>

              {/* Unit — always sheets, just for display */}
              <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Unit is always <strong>sheets</strong> for paper stock</span>
              </div>

              {/* Quantity + Reorder */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock (sheets)</label>
                  <input type="number" min="0" value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  <p className="text-xs text-gray-400 mt-1">Set 0 if adding for first time</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level (sheets)</label>
                  <input type="number" min="0" value={formData.reorder_level}
                    onChange={e => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  <p className="text-xs text-gray-400 mt-1">Alert when below this</p>
                </div>
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                <input type="text" placeholder="e.g. Rajkot Paper Mart" value={formData.supplier}
                  onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? 'Update' : 'Add Paper'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Restock Paper</h2>
              <button onClick={() => setShowRestockModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-md p-3">
                <p className="font-medium text-gray-900">{selectedItem.name}</p>
                {selectedItem.size && <p className="text-xs text-gray-500">{selectedItem.size}{selectedItem.gsm ? ` · ${selectedItem.gsm} GSM` : ''}</p>}
                <p className="text-sm text-gray-500 mt-1">Current stock: <span className="font-semibold text-gray-900">{selectedItem.quantity} sheets</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add How Many Sheets?</label>
                <input type="number" min="1" value={restockQty} onChange={e => setRestockQty(e.target.value)}
                  autoFocus placeholder="0"
                  className="w-full px-4 py-3 text-2xl font-bold text-center border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              {restockQty && parseInt(restockQty) > 0 && (
                <p className="text-center text-gray-900 font-medium">
                  New total: <span className="text-green-700 font-bold">{selectedItem.quantity + parseInt(restockQty)} sheets</span>
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowRestockModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleRestockSubmit} disabled={submitting || !restockQty || parseInt(restockQty) <= 0}
                  className="flex-1 px-4 py-2.5 bg-green-700 text-white rounded-md hover:bg-green-800 font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Sheets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
