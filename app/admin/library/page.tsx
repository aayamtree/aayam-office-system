'use client';

// Product Library — the master record of every final design, indexed by
// client, product, packaging type and size. Grows automatically from the
// job pipeline; manual add available for older designs.

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
  Plus, Search, X, Loader2, Package, Tag, ShoppingBag,
  Box as BoxIcon, FileImage, Printer, ExternalLink,
} from 'lucide-react';
import { PACKAGING_TYPES, Product, formatSize, clientLabel } from '@/lib/product-library';

interface ClientOption { id: string; name: string; company: string | null }

const CATEGORY_ICON: Record<string, any> = {
  Box: BoxIcon, Label: Tag, Pouch: ShoppingBag, Carton: Package,
  Sticker: Tag, Bag: ShoppingBag, Other: FileImage,
};

const CATEGORY_COLOR: Record<string, string> = {
  Box: 'bg-amber-100 text-amber-800',
  Label: 'bg-blue-100 text-blue-800',
  Pouch: 'bg-emerald-100 text-emerald-800',
  Carton: 'bg-orange-100 text-orange-800',
  Sticker: 'bg-purple-100 text-purple-800',
  Bag: 'bg-teal-100 text-teal-800',
  Other: 'bg-gray-100 text-gray-700',
};

const emptyForm = {
  client_id: '', brand_name: '', name: '', category: 'Box',
  size_w: '', size_h: '', size_d: '', size_unit: 'mm', size_text: '', notes: '',
};

export default function ProductLibraryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    setLoading(true);
    const [prodRes, clientRes] = await Promise.all([
      supabase
        .from('products')
        .select('*, clients(name, company)')
        .eq('is_active', true)
        .order('updated_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, name, company')
        .eq('is_active', true)
        .order('company'),
    ]);
    if (prodRes.error) toast.error(prodRes.error.message);
    setProducts((prodRes.data as Product[]) || []);
    setClients((clientRes.data as ClientOption[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (clientFilter && p.client_id !== clientFilter) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (!q) return true;
      const hay = [
        p.name, p.brand_name, p.category, p.size_text, formatSize(p),
        clientLabel(p.clients),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [products, search, clientFilter, categoryFilter]);

  const categoriesInUse = useMemo(() => {
    const set = new Set<string>(products.map((p) => p.category));
    PACKAGING_TYPES.forEach((c) => set.add(c));
    return Array.from(set);
  }, [products]);

  const handleSave = async () => {
    if (!form.name.trim() || saving) { if (!form.name.trim()) toast.error('Product name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          client_id: form.client_id || null,
          size_w: form.size_w ? parseFloat(form.size_w) : null,
          size_h: form.size_h ? parseFloat(form.size_h) : null,
          size_d: form.size_d ? parseFloat(form.size_d) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      toast.success('Product added to library');
      setShowForm(false);
      setForm(emptyForm);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" /> Product Library
          </h1>
          <p className="text-sm text-gray-500">
            Every final design — by client, product, packaging type &amp; size
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-md p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, brand, client or size…"
              className="w-full pl-9 pr-8 py-2 border rounded-md text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm md:w-64"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company || c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${!categoryFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            All types
          </button>
          {categoriesInUse.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${categoryFilter === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-md p-12 text-center text-gray-500">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          {products.length === 0
            ? 'The library is empty. Designs will be added automatically as jobs finish — or add old designs manually.'
            : 'No products match your filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((p) => {
            const Icon = CATEGORY_ICON[p.category] || FileImage;
            return (
              <Link
                key={p.id}
                href={`/admin/library/${p.id}`}
                className="bg-white border rounded-lg overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all group"
              >
                <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
                  {p.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="w-12 h-12 text-gray-300 group-hover:text-indigo-300 transition-colors" />
                  )}
                  <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLOR[p.category] || CATEGORY_COLOR.Other}`}>
                    {p.category}
                  </span>
                  {p.current_version_no > 0 && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
                      v{p.current_version_no}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="font-medium text-sm truncate" title={p.name}>{p.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {clientLabel(p.clients)}{p.brand_name ? ` · ${p.brand_name}` : ''}
                  </div>
                  <div className="text-xs text-gray-700 font-mono mt-1">{formatSize(p)}</div>
                  {p.last_printed_at && (
                    <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                      <Printer className="w-3 h-3" />
                      {new Date(p.last_printed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add Product modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold">Add Product</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
                <select
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">— No client / internal —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.company || c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                  <input
                    value={form.brand_name}
                    onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                    placeholder="Brand name"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Packaging type *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {PACKAGING_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Product name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Turmeric Powder 100g"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Packaging size</label>
                <div className="flex gap-2 items-center">
                  <input value={form.size_w} onChange={(e) => setForm({ ...form, size_w: e.target.value })} placeholder="W" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <span className="text-gray-400">×</span>
                  <input value={form.size_h} onChange={(e) => setForm({ ...form, size_h: e.target.value })} placeholder="H" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <span className="text-gray-400">×</span>
                  <input value={form.size_d} onChange={(e) => setForm({ ...form, size_d: e.target.value })} placeholder="D" type="number" className="w-20 border rounded-md px-2 py-2 text-sm" />
                  <select value={form.size_unit} onChange={(e) => setForm({ ...form, size_unit: e.target.value })} className="border rounded-md px-2 py-2 text-sm">
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                </div>
                <input
                  value={form.size_text}
                  onChange={(e) => setForm({ ...form, size_text: e.target.value })}
                  placeholder="Or freeform size, e.g. 'A4 folded to A5'"
                  className="w-full border rounded-md px-3 py-2 text-sm mt-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="Material, finish, special instructions…"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t">
              <button onClick={() => setShowForm(false)} disabled={saving} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        Designs are added automatically when design jobs are finalized. Use Add Product for older designs.
      </div>
    </div>
  );
}
