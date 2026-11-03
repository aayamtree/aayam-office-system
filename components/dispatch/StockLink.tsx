'use client';

/** One slim line on the Dispatch board that points to the Stock page. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, PackagePlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { STOCK_PRINTED_STAGES } from '@/components/dispatch/StockSection';
import OpeningStockModal from '@/components/dispatch/OpeningStockModal';

export default function StockLink({ refreshKey = 0 }: { refreshKey?: number }) {
  const [pcs, setPcs] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [adding, setAdding] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const [shelf, printed] = await Promise.all([
        supabase.from('jobs').select('stock_qty_on_hand').eq('is_stock', true).eq('current_stage', 'in_stock').gt('stock_qty_on_hand', 0).limit(1000),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('is_stock', true).in('current_stage', STOCK_PRINTED_STAGES),
      ]);
      if (!live || shelf.error) return; // the Stock page shows real errors; this line just stays quiet
      setPcs((shelf.data || []).reduce((s: number, r: any) => s + (r.stock_qty_on_hand || 0), 0));
      setWaiting(printed.count || 0);
    })();
    return () => { live = false; };
  }, [refreshKey, bump]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <Link href="/admin/dispatch/stock" className="flex-1 min-w-[14rem] flex items-center justify-between gap-3 hover:opacity-80 transition-opacity">
          <span className="flex items-center gap-2 text-gray-800">
            <Boxes className="w-4 h-4 text-slate-500 shrink-0" />
            <b>Stock</b>
            <span className="text-gray-600">
              {pcs === null ? 'warehouse stock' : `${pcs.toLocaleString('en-IN')} pcs on the shelf`}
              {waiting > 0 ? ` · ${waiting} printed job${waiting > 1 ? 's' : ''} waiting to be shelved` : ''}
            </span>
          </span>
          <span className="text-gray-900 font-medium whitespace-nowrap">Open Stock →</span>
        </Link>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-2 md:py-1.5 text-xs font-semibold rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 whitespace-nowrap"
        >
          <PackagePlus className="w-3.5 h-3.5" /> Add existing stock
        </button>
      </div>
      {adding && <OpeningStockModal onClose={() => setAdding(false)} onAdded={() => setBump(b => b + 1)} />}
    </>
  );
}
