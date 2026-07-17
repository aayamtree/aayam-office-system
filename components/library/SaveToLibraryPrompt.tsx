'use client';

// SaveToLibraryPrompt — global listener mounted in the admin layout.
// When any page moves a job into "Print File Ready" (design finalized),
// lib/hooks.ts fires the 'aayam:design-finalized' event and this modal
// asks: link to an existing library product, create a new one (prefilled
// from the job), or skip (logged — nothing is forced).

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
  X, Loader2, Search, Package, Plus, SkipForward, Link2, CheckCircle2,
} from 'lucide-react';
import { PACKAGING_TYPES, formatSize } from '@/lib/product-library';

export interface DesignFinalizedDetail {
  job_id: string;
  job_number: string | null;
  project_name: string | null;
  client_id: string | null;
  client_name: string | null;
  brand_name: string | null;
  product_category: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  category: string;
  brand_name: string | null;
  client_id: string | null;
  size_w: number | null;
  size_h: number | null;
  size_d: number | null;
  size_unit: string | null;
  size_text: string | null;
  clients?: { name: string; company: string | null } | null;
}

/** Map a job's product_category text to one of our packaging types. */
function guessCategory(raw: string | null): string {
  if (!raw) return 'Box';
  const s = raw.toLowerCase();
  for (const t of PACKAGING_TYPES) {
    if (s.includes(t.toLowerCase())) return t;
  }
  return 'Other';
}

export default function SaveToLibraryPrompt() {
  const [detail, setDetail] = useState<DesignFinalizedDetail | null>(null);
  const [mode, setMode] = useState<'choose' | 'create' | 'skip'>('choose');
  const [busy, setBusy] = useState(false);

  // link-existing state
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // create-new state
  const [form, setForm] = useState({ name: '', category: 'Box', brand_name: '', size_w: '', size_h: '', size_d: '', size_unit: 'mm' });

  // skip state
  const [skipReason, setSkipReason] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as DesignFinalizedDetail;
      if (!d?.job_id) return;
      setDetail(d);
      setMode('choose');
      setSearch('');
      setSelectedId(null);
      setSkipReason('');
      setForm({
        name: d.project_name || '',
        category: guessCategory(d.product_category),
        brand_name: d.brand_name || '',
        size_w: '', size_h: '', size_d: '', size_unit: 'mm',
      });
    };
    window.addEventListener('aayam:design-finalized', handler);
    return () => window.removeEventListener('aayam:design-finalized', handler);
  }, []);

  // Load candidate products when the modal opens (this client's first, then all)
  useEffect(() => {
    if (!detail) return;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, category, brand_name, client_id, size_w, size_h, size_d, size_unit, size_text, clients(name, company)')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(300);
      setProducts((data as any as ProductRow[]) || []);
    })();
  }, [detail]);

  const filtered = useMemo(() => {
    if (!detail) return [];
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (!q) return true;
      const hay = [p.name, p.brand_name, p.category, p.clients?.company, p.clients?.name].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    // Same-client products first — most likely match
    return list.sort((a, b) => {
      const aSame = a.client_id === detail.client_id ? 0 : 1;
      const bSame = b.client_id === detail.client_id ? 0 : 1;
      return aSame - bSame;
    }).slice(0, 30);
  }, [products, search, detail]);

  const close = () => { if (!busy) setDetail(null); };

  const submit = async (payload: any) => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/products/link-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: detail.job_id, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      if (payload.action === 'skip') {
        toast.success('Skipped — you can link it later from the job');
      } else {
        toast.success(
          json.file_attached
            ? `Saved to library${json.version_no ? ` as v${json.version_no}` : ''} ✓`
            : 'Linked to library ✓'
        );
      }
      setDetail(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={close}>
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3 border-b flex items-center justify-between bg-indigo-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-sm">Save design to Product Library?</h2>
              <p className="text-xs text-gray-500">
                {detail.job_number}{detail.project_name ? ` · ${detail.project_name}` : ''}{detail.client_name ? ` · ${detail.client_name}` : ''}
              </p>
            </div>
          </div>
          <button onClick={close} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {mode === 'choose' && (
          <div className="p-5 space-y-3">
            {/* Search existing */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Link to an existing product</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
                  autoFocus
                />
              </div>
              <div className="mt-2 border rounded-md divide-y max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">No matching products</div>
                ) : filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 ${selectedId === p.id ? 'bg-indigo-50' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium truncate block">{p.name}</span>
                      <span className="text-xs text-gray-500 truncate block">
                        {(p.clients?.company || p.clients?.name || '—')}{p.brand_name ? ` · ${p.brand_name}` : ''} · {p.category} · {formatSize(p)}
                      </span>
                    </span>
                    {selectedId === p.id && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => selectedId && submit({ action: 'link', product_id: selectedId })}
                disabled={!selectedId || busy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Link to selected product
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('create')}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Plus className="w-4 h-4" /> New product
                </button>
                <button
                  onClick={() => setMode('skip')}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md border text-gray-600 hover:bg-gray-50"
                >
                  <SkipForward className="w-4 h-4" /> Skip
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400">The job&apos;s final file will be saved as a design version automatically.</p>
          </div>
        )}

        {mode === 'create' && (
          <div className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Product name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Packaging type</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                  {PACKAGING_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                <input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
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
                  <option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button onClick={() => setMode('choose')} disabled={busy} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Back</button>
              <button
                onClick={() => form.name.trim() && submit({
                  action: 'create',
                  product: {
                    name: form.name,
                    category: form.category,
                    brand_name: form.brand_name || null,
                    size_w: form.size_w ? parseFloat(form.size_w) : null,
                    size_h: form.size_h ? parseFloat(form.size_h) : null,
                    size_d: form.size_d ? parseFloat(form.size_d) : null,
                    size_unit: form.size_unit,
                  },
                })}
                disabled={!form.name.trim() || busy}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md inline-flex items-center gap-2 disabled:opacity-40"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create &amp; Link
              </button>
            </div>
          </div>
        )}

        {mode === 'skip' && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600">Skip saving this design to the library? It will be logged so you can link it later.</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
              <input
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="e.g. one-time job, sample, not a product"
                className="w-full border rounded-md px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button onClick={() => setMode('choose')} disabled={busy} className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Back</button>
              <button
                onClick={() => submit({ action: 'skip', skip_reason: skipReason || null })}
                disabled={busy}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 inline-flex items-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
