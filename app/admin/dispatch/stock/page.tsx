'use client';

/**
 * Stock — jobs printed on spare sheet space and kept in the warehouse until the client orders.
 * Not orders: no price, no invoice, no dispatch. See components/dispatch/StockSection.tsx.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Boxes, ArrowLeft, PackagePlus } from 'lucide-react';
import PageSearch from '@/components/shared/PageSearch';
import StockSection, { stockAgeDays, STOCK_AMBER_DAYS, STOCK_RED_DAYS } from '@/components/dispatch/StockSection';
import StockHistory from '@/components/dispatch/StockHistory';
import ConvertJobModal from '@/components/dispatch/ConvertJobModal';
import OpeningStockModal from '@/components/dispatch/OpeningStockModal';

export default function StockPage() {
  const [tab, setTab] = useState<'shelf' | 'history'>('shelf');
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState('');
  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [showConvert, setShowConvert] = useState(false);
  const [showOpening, setShowOpening] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of warehouse) {
      if (b.client_id) m.set(b.client_id, b.client?.company || b.client?.name || 'Client');
      else m.set('__common', 'Common stock (no client)');
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [warehouse]);

  const tiles = useMemo(() => {
    const pcs = warehouse.reduce((s, b) => s + (b.stock_qty_on_hand || 0), 0);
    const amber = warehouse.filter(b => stockAgeDays(b.stock_stored_at) >= STOCK_AMBER_DAYS).length;
    const red = warehouse.filter(b => stockAgeDays(b.stock_stored_at) >= STOCK_RED_DAYS).length;
    return { pcs, batches: warehouse.length, amber, red };
  }, [warehouse]);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/dispatch" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-1">
            <ArrowLeft className="w-3 h-3" /> Dispatch
          </Link>
          <h1 className="text-page-title text-gray-900">Stock</h1>
          <p className="text-sm text-gray-500">
            Printed on spare sheet space and kept for the client. Not orders: no invoice and no dispatch until released.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            <button
              onClick={() => setShowOpening(true)}
              className="flex items-center gap-2 bg-white text-gray-900 border border-gray-300 px-3 md:px-4 py-2 md:py-2.5 rounded-md hover:bg-gray-50 transition-colors font-semibold text-sm"
            >
              <PackagePlus className="w-4 h-4" /> Add existing stock
            </button>
          )}
        <button
          onClick={() => setShowConvert(true)}
          className="flex items-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-md hover:bg-gray-800 transition-colors font-semibold text-sm"
        >
          <Boxes className="w-4 h-4" /> Mark a running job as stock
        </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-md p-2 md:p-3">
          <span className="text-xs text-slate-600 font-medium">Pieces on the shelf</span>
          <p className="text-page-title text-gray-900">{tiles.pcs.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-card border border-border rounded-md p-2 md:p-3">
          <span className="text-xs text-muted-foreground font-medium">Batches</span>
          <p className="text-page-title text-gray-900">{tiles.batches}</p>
        </div>
        <div className={`rounded-md p-2 md:p-3 border ${tiles.amber > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}>
          <span className="text-xs text-amber-700 font-medium">Older than {STOCK_AMBER_DAYS} days</span>
          <p className="text-page-title text-amber-800">{tiles.amber}</p>
        </div>
        <div className={`rounded-md p-2 md:p-3 border ${tiles.red > 0 ? 'bg-red-50 border-red-200' : 'bg-card border-border'}`}>
          <span className="text-xs text-red-600 font-medium">Older than {STOCK_RED_DAYS} days</span>
          <p className="text-page-title text-red-700">{tiles.red}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PageSearch value={query} onChange={setQuery} placeholder="Search job no., client or job name…  ( / )" className="flex-1 min-w-[16rem]" />
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          aria-label="Filter by client"
        >
          <option value="">All clients</option>
          {clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
          <button onClick={() => setTab('shelf')} className={`px-3 py-2 ${tab === 'shelf' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>Shelf</button>
          <button onClick={() => setTab('history')} className={`px-3 py-2 ${tab === 'history' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>History</button>
        </div>
      </div>

      {/* Both stay mounted so switching tabs never loses the shelf data */}
      <div className={tab === 'shelf' ? '' : 'hidden'}>
        <StockSection
          query={query}
          clientId={clientId}
          reloadKey={reloadKey}
          onData={(w) => setWarehouse(w)}
          onChanged={() => setReloadKey(k => k + 1)}
        />
      </div>
      {tab === 'history' && <StockHistory query={query} clientId={clientId} reloadKey={reloadKey} />}

      {showOpening && (
        <OpeningStockModal onClose={() => setShowOpening(false)} onAdded={() => setReloadKey(k => k + 1)} />
      )}

      {showConvert && (
        <ConvertJobModal
          onClose={() => setShowConvert(false)}
          onConverted={() => setReloadKey(k => k + 1)}
        />
      )}
    </div>
  );
}
