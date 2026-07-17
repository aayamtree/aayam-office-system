'use client';

// Generic product master detail — regulatory/reference content + every
// brand & design that uses this product.

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, FlaskConical, Package } from 'lucide-react';

function Block({ label, value }: { label: string; value: any }) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return (
    <div className="py-2 border-b last:border-0">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{text}</div>
    </div>
  );
}

export default function ProductMasterDetail() {
  const { id } = useParams() as { id: string };
  const [master, setMaster] = useState<any>(null);
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, pRes] = await Promise.all([
      supabase.from('product_masters').select('id, name, category, master_data, updated_at').eq('id', id).single(),
      supabase.from('products').select('id, name, category, brand_name, thumbnail_url').eq('product_master_id', id).eq('is_active', true).order('updated_at', { ascending: false }),
    ]);
    setMaster(mRes.data);
    setDesigns((pRes.data as any[]) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { if (id) load(); }, [id, load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!master) return <div className="bg-white border rounded-md p-12 text-center text-gray-500">Product master not found. <Link href="/admin/library/masters" className="text-indigo-600">← Back</Link></div>;

  const m = master.master_data || {};
  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/admin/library/masters" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /> Products</Link>

      <div className="bg-white border rounded-lg p-5">
        <h1 className="text-xl font-bold flex items-center gap-2"><FlaskConical className="w-5 h-5 text-indigo-600" /> {master.name}</h1>
        {master.category && <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">{master.category}</span>}
        <div className="mt-3">
          <Block label="Composition / Ingredients" value={m.ingredients_or_composition} />
          <Block label="Usage instructions" value={m.usage_instructions} />
          <Block label="Warnings" value={m.warnings} />
          <Block label="Key claims" value={m.key_claims} />
          <Block label="FSSAI" value={m.fssai_no} />
          <Block label="Registration nos" value={m.other_regn_nos} />
          <Block label="Barcode" value={m.barcode} />
        </div>
      </div>

      <div className="bg-white border rounded-lg">
        <div className="px-4 py-3 border-b font-semibold text-sm flex items-center gap-2"><Package className="w-4 h-4 text-gray-400" /> Brands / designs using this product ({designs.length})</div>
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
                <div className="p-2">
                  <div className="text-xs truncate">{d.name}</div>
                  {d.brand_name && <div className="text-[10px] text-gray-400 truncate">{d.brand_name}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
