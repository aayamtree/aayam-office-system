'use client';

/**
 * Stock jobs on the Dispatch board.
 *
 * A stock job is printed on spare sheet space and kept in the warehouse until the
 * client orders. It is NOT an order: no price, no invoice, no dispatch.
 *
 *   1. "Stock Printed"        : stock jobs back from the press, waiting to be shelved
 *   2. "Stock in Warehouse"   : what is on the shelf, one card per client + product,
 *                               with every printed batch listed inside (printer, rack, age)
 *   3. "Release from Stock"   : the client says how many they want in total.
 *        - the shelf covers it  -> one real order (goes to Awaiting Packing)
 *        - the shelf is short   -> the shelf part becomes an order and the balance becomes a
 *                                  linked new print job (starts at Ready to Print)
 *   4. "Adjust"               : damaged / miscounted / old artwork, always with a reason
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Loader2, X, PackageCheck, Undo2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import JobThumb from '@/components/shared/JobThumb';
import ProductBadge from '@/components/shared/ProductBadge';
import RollbackJobButton from '@/components/jobs/RollbackJobButton';
import { jobMatches } from '@/lib/page-search';

const AMBER_DAYS = 60;
const RED_DAYS = 90;

function ageDays(from?: string | null): number {
  if (!from) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86400000));
}

function ageClasses(days: number): string {
  if (days >= RED_DAYS) return 'bg-red-100 text-red-700 border-red-200';
  if (days >= AMBER_DAYS) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

const n = (v: number) => v.toLocaleString('en-IN');

/** "Return to stock" for an order that was released from stock (instead of Roll back). */
export function ReturnToStockButton({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('fn_return_to_stock', { p_order_job_id: jobId });
    setBusy(false);
    if (error) { toast.error(error.message); setAsking(false); return; }
    toast.success(`${data} pcs are back on the shelf ✓`);
    setAsking(false);
    onDone();
  };

  if (!asking) {
    return (
      <button
        onClick={() => setAsking(true)}
        title="Cancel this order and put its pieces back in warehouse stock"
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
      >
        <Undo2 className="w-3 h-3" /> Return to stock
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-gray-600">Put back on shelf?</span>
      <button onClick={run} disabled={busy} className="px-2 py-1 rounded bg-gray-900 text-white font-medium disabled:opacity-50">
        {busy ? '…' : 'Yes'}
      </button>
      <button onClick={() => setAsking(false)} className="px-2 py-1 text-gray-500">No</button>
    </span>
  );
}

interface Props {
  /** Stock jobs that are back from print and waiting to be shelved (from the Dispatch board's own query). */
  printed: any[];
  /** Search box text from the Dispatch page. */
  query: string;
  /** Refresh the Dispatch board (a release creates new jobs there). */
  onChanged: () => void;
}

export default function StockSection({ printed, query, onChanged }: Props) {
  const [warehouse, setWarehouse] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shelving, setShelving] = useState<any | null>(null);
  const [shelfQty, setShelfQty] = useState('');
  const [shelfLoc, setShelfLoc] = useState('');

  const [releasing, setReleasing] = useState<any | null>(null); // a group
  const [relTotal, setRelTotal] = useState('');
  const [relRate, setRelRate] = useState('');
  const [relNewRate, setRelNewRate] = useState('');
  const [relDeadline, setRelDeadline] = useState('');
  const [relRef, setRelRef] = useState('');

  const [adjusting, setAdjusting] = useState<any | null>(null); // a batch
  const [adjDelta, setAdjDelta] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_number, project_name, client_id, product_id, product_category, quantity, thumbnail_url, files, file_version, stock_qty_on_hand, stock_location, stock_stored_at, stock_artwork_version, vendor:vendors(id, name), client:clients(id, name, company)')
      .eq('is_stock', true)
      .eq('current_stage', 'in_stock')
      .gt('stock_qty_on_hand', 0)
      .order('stock_stored_at', { ascending: true })
      .limit(500);
    if (error) setLoadError(error.message);
    else { setLoadError(null); setWarehouse(data || []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Someone else may have released or shelved something while this tab was in the background.
  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // One card per client + product. Batches (maybe from different printers) sit inside it, oldest first.
  const groups = useMemo(() => {
    const map = new Map<string, any>();
    for (const b of warehouse) {
      const key = `${b.client_id || ''}|${b.product_id || b.project_name}`;
      if (!map.has(key)) map.set(key, { key, batches: [], total: 0, first: b });
      const g = map.get(key);
      g.batches.push(b);
      g.total += b.stock_qty_on_hand || 0;
    }
    return Array.from(map.values());
  }, [warehouse]);

  const q = query.trim();
  const shownPrinted = q ? printed.filter(j => jobMatches(j, q)) : printed;
  const shownGroups = q ? groups.filter(g => g.batches.some((b: any) => jobMatches(b, q))) : groups;
  const totalPcs = warehouse.reduce((s, j) => s + (j.stock_qty_on_hand || 0), 0);

  if (!loading && !loadError && shownPrinted.length === 0 && shownGroups.length === 0) return null;

  const openShelve = (job: any) => { setShelving(job); setShelfQty(String(job.quantity || '')); setShelfLoc(''); };
  const openRelease = (g: any) => {
    setReleasing(g);
    setRelTotal(String(g.total));
    setRelRate(''); setRelNewRate(''); setRelDeadline(''); setRelRef('');
  };
  const openAdjust = (b: any) => { setAdjusting(b); setAdjDelta(''); setAdjReason(''); };

  const submitShelve = async () => {
    const qty = parseInt(shelfQty, 10);
    if (!shelving || !qty || qty <= 0) { toast.error('Enter how many pieces came in.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('fn_put_in_stock', { p_job_id: shelving.id, p_qty: qty, p_location: shelfLoc });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${shelving.job_number} is now in warehouse stock ✓`);
    setShelving(null);
    await load();
    onChanged();
  };

  const relTotalNum = parseInt(relTotal, 10) || 0;
  const relFromStock = releasing ? Math.min(relTotalNum, releasing.total) : 0;
  const relShort = releasing ? Math.max(relTotalNum - releasing.total, 0) : 0;
  const revisedBatches = releasing
    ? releasing.batches.filter((b: any) => b.stock_artwork_version && b.file_version && b.stock_artwork_version !== b.file_version)
    : [];
  const mixedArtwork = releasing
    ? new Set(releasing.batches.map((b: any) => b.stock_artwork_version || '')).size > 1
    : false;

  const submitRelease = async () => {
    if (!releasing || relTotalNum <= 0) { toast.error('Enter the total quantity the client wants.'); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('fn_release_stock', {
      p_batch_ids: releasing.batches.map((b: any) => b.id),
      p_total_qty: relTotalNum,
      p_rate: parseFloat(relRate) || 0,
      p_new_rate: relNewRate !== '' ? parseFloat(relNewRate) || 0 : null,
      p_deadline: relDeadline ? new Date(relDeadline).toISOString() : null,
      p_client_ref: relRef.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r: any = data || {};
    toast.success(
      r.to_print > 0
        ? `${n(r.from_stock)} pcs released (${r.order_job_number}) and ${n(r.to_print)} pcs sent to print as ${r.print_job_number} ✓`
        : `${n(r.from_stock)} pcs released — new order ${r.order_job_number} is in Awaiting Packing ✓`
    );
    setReleasing(null);
    await load();
    onChanged();
  };

  const submitAdjust = async (delta: number) => {
    if (!adjusting) return;
    setBusy(true);
    const { error } = await supabase.rpc('fn_adjust_stock', { p_job_id: adjusting.id, p_delta: delta, p_reason: adjReason });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Stock updated ✓');
    setAdjusting(null);
    await load();
  };

  return (
    <div className="space-y-5">
      {loadError && (
        <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
          Could not load warehouse stock: {loadError}
        </p>
      )}

      {/* 1 ── Printed stock jobs waiting to be shelved */}
      {shownPrinted.length > 0 && (
        <div>
          <h2 className="text-section text-gray-900 font-semibold mb-3">Stock Printed — put in warehouse ({shownPrinted.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {shownPrinted.map(job => (
              <div key={job.id} className="bg-card rounded-md border border-border border-l-4 border-l-amber-400">
                <div className="bg-amber-50/70 px-3 py-2 flex items-center justify-between border-b border-border/50">
                  <span className="text-[10px] font-mono text-muted-foreground truncate">#{job.job_number}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold uppercase">Stock · not an order</span>
                </div>
                <div className="px-3 pt-2 pb-3 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <JobThumb job={job} size={64} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground truncate">{job.client?.company || job.client?.name}</p>
                      <h3 className="text-sm font-semibold text-foreground line-clamp-3 mt-0.5">{job.project_name}</h3>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1"><ProductBadge category={job.product_category} /></div>
                  <p className="text-[10px] text-muted-foreground">Printed qty: {job.quantity}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => openShelve(job)} className="flex items-center gap-1 px-2.5 py-1.5 bg-foreground text-white text-xs font-medium rounded hover:opacity-90">
                      <Archive className="w-3 h-3" /> Put in Stock
                    </button>
                    <RollbackJobButton jobId={job.id} onDone={onChanged} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2 ── On the shelf */}
      {(loading || shownGroups.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-section text-gray-900 font-semibold">Stock in Warehouse ({shownGroups.length})</h2>
            <span className="text-xs text-gray-500">{n(totalPcs)} pcs on the shelf · no invoice, no dispatch until released</span>
          </div>
          {loading ? (
            <p className="text-xs text-gray-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading stock…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {shownGroups.map(g => {
                const oldest = ageDays(g.batches[0].stock_stored_at);
                const f = g.first;
                return (
                  <div key={g.key} className="bg-card rounded-md border border-border border-l-4 border-l-slate-400">
                    <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b border-border/50">
                      <span className="text-[10px] text-muted-foreground">{g.batches.length} batch{g.batches.length === 1 ? '' : 'es'}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${ageClasses(oldest)}`}>
                        oldest {oldest === 0 ? 'today' : `${oldest} day${oldest === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    <div className="px-3 pt-2 pb-3 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <JobThumb job={f} size={64} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-muted-foreground truncate">{f.client?.company || f.client?.name}</p>
                          <h3 className="text-sm font-semibold text-foreground line-clamp-3 mt-0.5">{f.project_name}</h3>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1"><ProductBadge category={f.product_category} /></div>
                      <p className="text-sm text-foreground font-semibold">{n(g.total)} pcs on hand</p>

                      <ul className="space-y-1.5 border-t border-border/60 pt-2">
                        {g.batches.map((b: any) => {
                          const d = ageDays(b.stock_stored_at);
                          const revised = b.stock_artwork_version && b.file_version && b.stock_artwork_version !== b.file_version;
                          return (
                            <li key={b.id} className="text-[10px] text-muted-foreground flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="font-mono">#{b.job_number}</span> · <span className="font-medium text-foreground">{n(b.stock_qty_on_hand)}</span> pcs
                                {b.vendor?.name ? ` · ${b.vendor.name}` : ''}
                                {b.stock_location ? ` · 📍${b.stock_location}` : ''}
                                {' · '}{d}d · {b.stock_artwork_version || '—'}
                                {revised && <span className="ml-1 px-1 rounded bg-amber-50 text-amber-700 border border-amber-200">revised</span>}
                              </span>
                              <button onClick={() => openAdjust(b)} className="shrink-0 underline hover:text-foreground">Adjust</button>
                            </li>
                          );
                        })}
                      </ul>

                      <button onClick={() => openRelease(g)} className="flex items-center gap-1 px-2.5 py-1.5 bg-foreground text-white text-xs font-medium rounded hover:opacity-90">
                        <PackageCheck className="w-3 h-3" /> Release from Stock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Put in stock */}
      {shelving && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Put in warehouse stock</h3>
                <p className="text-xs text-gray-500 mt-0.5">{shelving.job_number} · {shelving.project_name}</p>
              </div>
              <button onClick={() => setShelving(null)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Pieces received</span>
              <input type="number" min={1} value={shelfQty} onChange={e => setShelfQty(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Rack / shelf (optional)</span>
              <input type="text" value={shelfLoc} onChange={e => setShelfLoc(e.target.value)} placeholder="e.g. Rack B-3" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>
            <p className="text-xs text-gray-500">No invoice and no dispatch. It waits on the shelf until the client orders.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShelving(null)} className="px-3 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={submitShelve} disabled={busy} className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md disabled:opacity-50 flex items-center gap-2">
                {busy && <Loader2 className="w-3 h-3 animate-spin" />} Put in Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release from stock */}
      {releasing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Release from stock</h3>
                <p className="text-xs text-gray-500 mt-0.5">{releasing.first.project_name}</p>
                <p className="text-xs text-gray-500">{n(releasing.total)} pcs on the shelf in {releasing.batches.length} batch{releasing.batches.length === 1 ? '' : 'es'} · oldest is used first</p>
              </div>
              <button onClick={() => setReleasing(null)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>

            {(revisedBatches.length > 0 || mixedArtwork) && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                ⚠️ {revisedBatches.length > 0
                  ? 'The artwork was revised after some of this stock was printed. '
                  : ''}
                {mixedArtwork ? 'The batches on the shelf have different artwork versions. ' : ''}
                Check the pieces match the latest design before you release.
              </p>
            )}

            <label className="block text-sm">
              <span className="font-medium text-gray-700">Total quantity the client wants</span>
              <input type="number" min={1} value={relTotal} onChange={e => setRelTotal(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>

            {relTotalNum > 0 && (
              <div className={`text-xs rounded px-3 py-2 border ${relShort > 0 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
                <p><b>{n(relFromStock)} pcs</b> come from the shelf → a real order, goes to Awaiting Packing.</p>
                {relShort > 0 ? (
                  <p className="mt-1"><b>{n(relShort)} pcs</b> are not in stock → a linked new print job starts at Ready to Print.</p>
                ) : (
                  <p className="mt-1">{n(releasing.total - relFromStock)} pcs stay on the shelf.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Rate / piece (₹)</span>
                <input type="number" min={0} step="0.01" value={relRate} onChange={e => setRelRate(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </label>
              {relShort > 0 && (
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">Rate for new print (₹)</span>
                  <input type="number" min={0} step="0.01" value={relNewRate} onChange={e => setRelNewRate(e.target.value)} placeholder="same as left" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </label>
              )}
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Deadline</span>
                <input type="date" value={relDeadline} onChange={e => setRelDeadline(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Client PO no.</span>
                <input type="text" value={relRef} onChange={e => setRelRef(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setReleasing(null)} className="px-3 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={submitRelease} disabled={busy} className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md disabled:opacity-50 flex items-center gap-2">
                {busy && <Loader2 className="w-3 h-3 animate-spin" />} {relShort > 0 ? 'Release & send balance to print' : 'Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust / write off */}
      {adjusting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Adjust stock</h3>
                <p className="text-xs text-gray-500 mt-0.5">{adjusting.job_number} · {n(adjusting.stock_qty_on_hand)} pcs on hand</p>
              </div>
              <button onClick={() => setAdjusting(null)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Change in pieces (use − to remove)</span>
              <input type="number" value={adjDelta} onChange={e => setAdjDelta(e.target.value)} placeholder="e.g. -50" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Reason (required)</span>
              <input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="e.g. 50 damaged in rack" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>
            <div className="flex justify-between gap-2">
              <button
                onClick={() => submitAdjust(-(adjusting.stock_qty_on_hand || 0))}
                disabled={busy || adjReason.trim().length < 3}
                title="Remove everything left in this batch (e.g. old artwork). Write the reason first."
                className="px-3 py-2 text-sm text-red-700 border border-red-200 rounded-md disabled:opacity-40"
              >
                Write off all
              </button>
              <div className="flex gap-2">
                <button onClick={() => setAdjusting(null)} className="px-3 py-2 text-sm text-gray-600">Cancel</button>
                <button
                  onClick={() => submitAdjust(parseInt(adjDelta, 10) || 0)}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md disabled:opacity-50 flex items-center gap-2"
                >
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />} Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
