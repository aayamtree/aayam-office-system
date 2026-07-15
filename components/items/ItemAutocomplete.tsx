'use client';

// Zoho Books–style saved-item autocomplete.
// Type in the field → matching saved items drop down (name + rate + description).
// Selecting one fills the row (name, description, rate, HSN, GST) via onSelect.
// "+ Add New Item" saves the typed name to the catalog inline, then selects it.

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Loader2 } from 'lucide-react';

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  rate: number;
  hsn_code: string;
  gst_rate: number;
  is_active: boolean;
}

// Module-level cache so multiple rows / forms don't refetch on every mount.
let cachedItems: CatalogItem[] | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

async function loadCatalog(force = false): Promise<CatalogItem[]> {
  if (!force && cachedItems && Date.now() - cacheAt < CACHE_MS) return cachedItems;
  const { data } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('is_active', true)
    .order('name');
  cachedItems = (data as CatalogItem[]) || [];
  cacheAt = Date.now();
  return cachedItems;
}

export function invalidateCatalogCache() {
  cachedItems = null;
}

interface Props {
  value: string;
  onChange: (text: string) => void;      // free typing
  onSelect: (item: CatalogItem) => void; // picked a saved item
  placeholder?: string;
  className?: string;
}

export default function ItemAutocomplete({ value, onChange, onSelect, placeholder, className }: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', rate: '', hsn_code: '', gst_rate: '18' });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCatalog().then(setItems); }, []);

  // Close on outside click.
  // Capture phase + isConnected guard: React re-renders the dropdown content
  // synchronously mid-click (e.g. "+ Add New Item" swaps list → form), which
  // detaches the clicked node — a bubble-phase contains() check would then
  // wrongly treat it as an outside click and close everything.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!target.isConnected) return;
      if (wrapRef.current && !wrapRef.current.contains(target)) {
        setOpen(false);
        setShowAddForm(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = query
    ? items.filter(i =>
        i.name.toLowerCase().includes(query) ||
        (i.description || '').toLowerCase().includes(query))
    : items;
  const shown = filtered.slice(0, 8);

  const pick = useCallback((item: CatalogItem) => {
    onSelect(item);
    setOpen(false);
    setShowAddForm(false);
  }, [onSelect]);

  const openAddForm = () => {
    setAddForm({ name: value.trim(), description: '', rate: '', hsn_code: '', gst_rate: '18' });
    setShowAddForm(true);
    setOpen(true);
  };

  const handleSaveNew = async () => {
    if (!addForm.name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/catalog-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name,
          description: addForm.description,
          rate: parseFloat(addForm.rate) || 0,
          hsn_code: addForm.hsn_code,
          gst_rate: parseFloat(addForm.gst_rate) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || 'Could not save item'); return; }
      invalidateCatalogCache();
      const fresh = await loadCatalog(true);
      setItems(fresh);
      pick(json.item as CatalogItem);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || showAddForm) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && shown[highlight]) { e.preventDefault(); pick(shown[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        placeholder={placeholder || 'Type or select an item'}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Close when focus moves elsewhere (e.g. to the description/qty field),
          // so the dropdown never blocks the inputs below it. In-dropdown clicks
          // preventDefault on mousedown, so they don't trigger this blur.
          if (!showAddForm) setOpen(false);
        }}
        onKeyDown={handleKeyDown}
        className={className || 'w-full px-3 py-2 border border-gray-200 rounded-md text-sm'}
        autoComplete="off"
      />

      {(open || showAddForm) && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
          {!showAddForm && (
            <>
              {shown.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pick(item); }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 ${i === highlight ? 'bg-blue-50' : 'bg-white'}`}
                >
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-500 flex gap-2">
                    <span>Rate: Rs.{Number(item.rate).toFixed(2)}</span>
                    {item.hsn_code ? <span>HSN: {item.hsn_code}</span> : null}
                    {item.description ? <span className="truncate max-w-[240px]">{item.description}</span> : null}
                  </div>
                </button>
              ))}
              {shown.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">No saved items match “{value}”</div>
              )}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); openAddForm(); }}
                className="w-full text-left px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 border-t border-gray-100"
              >
                <Plus size={14} /> Add New Item
              </button>
            </>
          )}

          {showAddForm && (
            <div className="p-3 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
              <div className="text-xs font-semibold text-gray-600 uppercase">New Saved Item</div>
              <input
                type="text" placeholder="Item name *" value={addForm.name}
                onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" autoFocus
              />
              <input
                type="text" placeholder="Description (shows below name)" value={addForm.description}
                onChange={(e) => setAddForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number" placeholder="Rate" min="0" step="any" value={addForm.rate}
                  onChange={(e) => setAddForm(f => ({ ...f, rate: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
                <input
                  type="text" placeholder="HSN/SAC" value={addForm.hsn_code}
                  onChange={(e) => setAddForm(f => ({ ...f, hsn_code: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
                <input
                  type="number" placeholder="GST %" min="0" step="any" value={addForm.gst_rate}
                  onChange={(e) => setAddForm(f => ({ ...f, gst_rate: e.target.value }))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button" onClick={handleSaveNew} disabled={saving || !addForm.name.trim()}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />} Save & Use
                </button>
                <button
                  type="button" onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
