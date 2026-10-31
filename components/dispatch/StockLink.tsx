'use client';

/** One slim line on the Dispatch board that points to the Stock page. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { STOCK_PRINTED_STAGES } from '@/components/dispatch/StockSection';

export default function StockLink({ refreshKey = 0 }: { refreshKey?: number }) {
  const [pcs, setPcs] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(0);

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
  }, [refreshKey]);

  return (
    <Link
      href="/admin/dispatch/stock"
      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
    >
      <span className="flex items-center gap-2 text-gray-800">
        <Boxes className="w-4 h-4 text-slate-500" />
        <b>Stock</b>
        <span className="text-gray-600">
          {pcs === null ? 'warehouse stock' : `${pcs.toLocaleString('en-IN')} pcs on the shelf`}
          {waiting > 0 ? ` · ${waiting} printed job${waiting > 1 ? 's' : ''} waiting to be shelved` : ''}
        </span>
      </span>
      <span className="text-gray-900 font-medium whitespace-nowrap">Open Stock →</span>
    </Link>
  );
}
