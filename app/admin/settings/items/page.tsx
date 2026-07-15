'use client';

// Saved Items (price list) — Zoho Books style item catalog.
// Items added here appear as dropdown suggestions when creating
// quotations and invoices (name, description, rate, HSN, GST auto-fill).

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useConfirm } from '@/components/ConfirmModal';
import { invalidateCatalogCache, CatalogItem } from '@/components/items/ItemAutocomplete';
import { Plus, Pencil, Trash2, Loader2, Search, X } from 'lucide-react';

const emptyForm = { name: '', description: '', rate: '', hsn_code: '', gst_rate: '18' };

export default function SavedItemsPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const confirm = useConfirm();

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .order('name');
    if (error) toast.error(error.message);
    setItems((data as CatalogItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || '',
      rate: String(item.rate ?? ''),
      hsn_code: item.hsn_code || '',
      gst_rate: String(item.gst_rate ?? '18'),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description,
        rate: parseFloat(form.rate) || 0,
        hsn_code: form.hsn_code,
        gst_rate: parseFloat(form.gst_rate) || 0,
      };
      let res: Response;
      if (editingId) {
        res = await fetch('/api/catalog-items', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await fetch('/api/catalog-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Save failed'); return; }
      toast.success(editingId ? 'Item updated' : 'Item added');
      invalidateCatalogCache();
      setShowForm(false);
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: CatalogItem) => {
    const res = await fetch('/api/catalog-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
    });
    if (!res.ok) { const j = await res.json(); toast.error(j.error || 'Update failed'); return; }
    invalidateCatalogCache();
    fetchItems();
  };

  const handleDelete = async (item: CatalogItem) => {
    const { confirmed } = await confirm({
      title: 'Delete Item',
      message: `Delete "${item.name}" from saved items? Quotations and invoices already created are not affected.`,
      variant: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    const res = await fetch(`/api/catalog-items?id=${item.id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json(); toast.error(j.error || 'Delete failed'); return; }
    toast.success(`"${item.name}" deleted`);
    invalidateCatalogCache();
    fetchItems();
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter(i => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q) || (i.hsn_code || '').includes(q))
    : items;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-md border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Saved Items</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Item price list — these appear as dropdown suggestions in Quotations and Invoices.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
          >
            <Plus size={16} /> New Item
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm"
          />
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">{editingId ? 'Edit Item' : 'New Item'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Item Name *</label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                  placeholder="e.g. Metallic Box - 50ml"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Item Details</label>
                <input
                  type="text" value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                  placeholder="Size, process... — prints under the item name (e.g. 56×23×10, Metallic UV)"
                />
              </div>
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rate (Rs.)</label>
                  <input
                    type="number" min="0" step="any" value={form.rate}
                    onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">HSN/SAC</label>
                  <input
                    type="text" value={form.hsn_code}
                    onChange={(e) => setForm(f => ({ ...f, hsn_code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">GST %</label>
                  <input
                    type="number" min="0" step="any" value={form.gst_rate}
                    onChange={(e) => setForm(f => ({ ...f, gst_rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        )}

        {/* Items table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            {items.length === 0 ? 'No saved items yet. Click "New Item" to add your first one.' : 'No items match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Description</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase text-right">Rate</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">HSN/SAC</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase text-right hidden sm:table-cell">GST %</th>
                  <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase text-center">Active</th>
                  <th className="py-2 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className={`border-b border-gray-100 ${!item.is_active ? 'opacity-50' : ''}`}>
                    <td className="py-2.5 pr-3 font-medium text-gray-900">{item.name}</td>
                    <td className="py-2.5 pr-3 text-gray-500 hidden md:table-cell max-w-[280px] truncate">{item.description}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-800">Rs.{Number(item.rate).toFixed(2)}</td>
                    <td className="py-2.5 pr-3 text-gray-500 hidden sm:table-cell">{item.hsn_code}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-500 hidden sm:table-cell">{Number(item.gst_rate)}%</td>
                    <td className="py-2.5 pr-3 text-center">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${item.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                        title={item.is_active ? 'Active — shown in dropdown' : 'Inactive — hidden from dropdown'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${item.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                      </button>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-gray-700" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(item)} className="p-1.5 text-red-400 hover:text-red-600" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
