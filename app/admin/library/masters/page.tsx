'use client';

// Product-master directory — generic products (e.g. PACLOBUTRAZOL 23% SC)
// shared across brands. Search by product; details + brands that use it.

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Search, X, Loader2, FlaskConical } from 'lucide-react';
import LibraryTabs from '@/components/library/LibraryTabs';

interface MasterRow { id: string; name: string; category: string | null; master_data: any | null; master_text: string | null }

export default function ProductMasterDirectory() {
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [mRes, pRes] = await Promise.all([
        supabase.from('product_masters').select('id, name, category, master_data, master_text').order('name'),
        supabase.from('products').select('product_master_id').eq('is_active', true),
      ]);
      setMasters((mRes.data as MasterRow[]) || []);
      const c: Record<string, number> = {};
      (pRes.data || []).forEach((p: any) => { if (p.product_master_id) c[p.product_master_id] = (c[p.product_master_id] || 0) + 1; });
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return masters;
    return masters.filter((m) => `${m.name} ${m.category || ''} ${m.master_text || ''}`.toLowerCase().includes(q));
  }, [masters, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FlaskConical className="w-6 h-6 text-indigo-600" /> Product Library</h1>
        <p className="text-sm text-gray-500">Generic product masters — composition &amp; details shared across brands</p>
      </div>
      <LibraryTabs />

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product name, composition…" className="w-full pl-9 pr-8 py-2 border rounded-md text-sm" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-md p-12 text-center text-gray-500">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          No product masters yet. They are created automatically when designs are scanned.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => {
            const d = m.master_data || {};
            return (
              <Link key={m.id} href={`/admin/library/masters/${m.id}`} className="bg-white border rounded-lg p-4 hover:shadow-md hover:border-indigo-300 transition-all">
                <div className="font-semibold text-sm flex items-center justify-between">
                  <span className="truncate">{m.name}</span>
                  <span className="text-[10px] font-normal text-gray-400 shrink-0">{counts[m.id] || 0} brand(s)</span>
                </div>
                {m.category && <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-medium">{m.category}</span>}
                {d.ingredients_or_composition && <div className="text-xs text-gray-500 mt-2 line-clamp-3">{d.ingredients_or_composition}</div>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
