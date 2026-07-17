'use client';

// Brand directory — search BY BRAND, shows brand master details only
// (company, address, contacts, registration). No product designs here.

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Search, X, Loader2, Building2, Phone, Mail, Globe, MapPin } from 'lucide-react';
import LibraryTabs from '@/components/library/LibraryTabs';

interface BrandRow {
  id: string;
  name: string;
  master_data: any | null;
  master_text: string | null;
}

export default function BrandDirectoryPage() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bRes, pRes] = await Promise.all([
        supabase.from('brands').select('id, name, master_data, master_text').not('master_data', 'is', null).order('name'),
        supabase.from('products').select('brand_id').eq('is_active', true),
      ]);
      setBrands((bRes.data as BrandRow[]) || []);
      const c: Record<string, number> = {};
      (pRes.data || []).forEach((p: any) => { if (p.brand_id) c[p.brand_id] = (c[p.brand_id] || 0) + 1; });
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => `${b.name} ${b.master_text || ''}`.toLowerCase().includes(q));
  }, [brands, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-indigo-600" /> Product Library</h1>
        <p className="text-sm text-gray-500">Brand directory — company &amp; regulatory details per brand</p>
      </div>
      <LibraryTabs />

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brand name, address, phone, license…" className="w-full pl-9 pr-8 py-2 border rounded-md text-sm" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-md p-12 text-center text-gray-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          No brand masters yet. They are created automatically when designs are scanned.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((b) => {
            const m = b.master_data || {};
            return (
              <Link key={b.id} href={`/admin/library/brands/${b.id}`} className="bg-white border rounded-lg p-4 hover:shadow-md hover:border-indigo-300 transition-all">
                <div className="font-semibold text-sm flex items-center justify-between">
                  <span className="truncate">{b.name}</span>
                  <span className="text-[10px] font-normal text-gray-400 shrink-0">{counts[b.id] || 0} design(s)</span>
                </div>
                {(m.manufactured_by || m.marketed_by) && <div className="text-xs text-gray-600 mt-1 truncate">{m.manufactured_by || m.marketed_by}</div>}
                <div className="mt-2 space-y-1 text-xs text-gray-500">
                  {m.address && <div className="flex items-start gap-1.5"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /><span className="line-clamp-2">{m.address}</span></div>}
                  {m.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" />{Array.isArray(m.phone) ? m.phone.join(', ') : m.phone}</div>}
                  {m.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 shrink-0" />{m.email}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
