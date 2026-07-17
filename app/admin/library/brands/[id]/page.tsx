'use client';

// Brand master detail — the brand's own reference record (details only).

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, Building2, Package } from 'lucide-react';

function Row({ label, value }: { label: string; value: any }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return (
    <div className="py-2 border-b last:border-0 grid grid-cols-3 gap-3">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="col-span-2 text-sm text-gray-800 whitespace-pre-wrap break-words">{text}</div>
    </div>
  );
}

export default function BrandMasterDetail() {
  const { id } = useParams() as { id: string };
  const [brand, setBrand] = useState<any>(null);
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, pRes] = await Promise.all([
      supabase.from('brands').select('id, name, master_data, master_updated_at').eq('id', id).single(),
      supabase.from('products').select('id, name, category, thumbnail_url').eq('brand_id', id).eq('is_active', true).order('updated_at', { ascending: false }),
    ]);
    setBrand(bRes.data);
    setDesigns((pRes.data as any[]) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { if (id) load(); }, [id, load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!brand) return <div className="bg-white border rounded-md p-12 text-center text-gray-500">Brand not found. <Link href="/admin/library/brands" className="text-indigo-600">← Back</Link></div>;

  const m = brand.master_data || {};
  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/admin/library/brands" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /> Brands</Link>

      <div className="bg-white border rounded-lg p-5">
        <h1 className="text-xl font-bold flex items-center gap-2"><Building2 className="w-5 h-5 text-indigo-600" /> {brand.name}</h1>
        <p className="text-xs text-gray-400 mt-0.5">Brand master{brand.master_updated_at ? ` · updated ${new Date(brand.master_updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
        <div className="mt-3">
          <Row label="Manufactured by" value={m.manufactured_by} />
          <Row label="Marketed by" value={m.marketed_by} />
          <Row label="Address" value={m.address} />
          <Row label="Phone" value={m.phone} />
          <Row label="Email" value={m.email} />
          <Row label="Website" value={m.website} />
          <Row label="FSSAI" value={m.fssai_no} />
          <Row label="Registration nos" value={m.other_regn_nos} />
        </div>
        {!m.manufactured_by && !m.address && !m.phone && !m.email && (
          <p className="text-sm text-gray-400 mt-2">No details captured yet — scan a design for this brand to fill the master.</p>
        )}
      </div>

      <div className="bg-white border rounded-lg">
        <div className="px-4 py-3 border-b font-semibold text-sm flex items-center gap-2"><Package className="w-4 h-4 text-gray-400" /> Designs under this brand ({designs.length})</div>
        {designs.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No designs linked yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3">
            {designs.map((d) => (
              <Link key={d.id} href={`/admin/library/${d.id}`} className="border rounded-md overflow-hidden hover:border-indigo-300">
                <div className="aspect-square bg-gray-50 flex items-center justify-center">
                  {d.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.thumbnail_url} alt={d.name} className="w-full h-full object-cover" />
                  ) : <Package className="w-8 h-8 text-gray-300" />}
                </div>
                <div className="p-2 text-xs truncate">{d.name}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
