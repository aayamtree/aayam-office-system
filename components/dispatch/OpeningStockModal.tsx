'use client';

/**
 * "Add existing stock": bring stock that is already on the shelf into the system, in bulk.
 * Paste rows from a spreadsheet (Client, Product, Qty, Rack, Printed on, Printer) or type them.
 * Nothing is saved until "Add to stock" is pressed; the database adds every row or none.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';

interface Row { client_id: string; product: string; qty: string; rack: string; date: string; vendor_id: string; art: string; }
const emptyRow = (): Row => ({ client_id: '', product: '', qty: '', rack: '', date: '', vendor_id: '', art: '' });
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** 25/12/2026, 25-12-26 or 2026-12-25  ->  2026-12-25 ('' when not understood) */
function parseDate(s: string): string {
  const t = s.trim();
  if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

export default function OpeningStockModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [clients, setClients] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, v, j] = await Promise.all([
        supabase.from('clients').select('id, name, company').order('company').limit(2000),
        supabase.from('vendors').select('id, name').order('name').limit(1000),
        supabase.from('jobs').select('id, project_name, client_id').not('client_id', 'is', null)
          .order('created_at', { ascending: false }).limit(5000),
      ]);
      if (c.error || v.error || j.error) toast.error((c.error || v.error || j.error)!.message);
      setClients(c.data || []);
      setVendors(v.data || []);
      setJobs(j.data || []);
      setLoading(false);
    })();
  }, []);

  const clientLabel = (c: any) => c.company || c.name || 'Client';

  // client -> (product name lower-case -> latest job id): used to copy product details from an earlier job
  const productsByClient = useMemo(() => {
    const m = new Map<string, Map<string, { id: string; name: string }>>();
    for (const j of jobs) {
      if (!j.client_id || !j.project_name) continue;
      if (!m.has(j.client_id)) m.set(j.client_id, new Map());
      const inner = m.get(j.client_id)!;
      const k = norm(j.project_name);
      if (!inner.has(k)) inner.set(k, { id: j.id, name: j.project_name });
    }
    return m;
  }, [jobs]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const applyPaste = () => {
    const out: Row[] = [];
    for (const line of pasteText.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = line.split('\t').map(s => s.trim());
      const [cName = '', product = '', qty = '', rack = '', date = '', printer = ''] = cells;
      if (/^client$/i.test(cName)) continue; // header row
      const want = norm(cName);
      const client = clients.find(c => norm(c.company || '') === want || norm(c.name || '') === want)
        || clients.find(c => want && (norm(c.company || '').includes(want) || norm(c.name || '').includes(want)));
      const vwant = norm(printer);
      const vendor = vwant ? vendors.find(v => norm(v.name || '') === vwant) || vendors.find(v => norm(v.name || '').includes(vwant)) : null;
      out.push({
        client_id: client?.id || '',
        product,
        qty: qty.replace(/[,\s]/g, ''),
        rack,
        date: parseDate(date),
        vendor_id: vendor?.id || '',
        art: '',
      });
    }
    if (!out.length) { toast.error('Nothing to read. Paste rows copied from your spreadsheet.'); return; }
    setRows(rs => [...rs.filter(r => r.client_id || r.product || r.qty), ...out]);
    setPasteText('');
    setShowErrors(true);
  };

  const rowProblem = (r: Row): string | null => {
    if (!r.client_id) return 'Pick the client';
    if (!r.product.trim()) return 'Enter the product';
    const q = parseInt(r.qty, 10);
    if (!q || q <= 0) return 'Enter pieces';
    if (r.date && r.date > new Date().toISOString().slice(0, 10)) return 'Date is in the future';
    return null;
  };

  const filled = rows.filter(r => r.client_id || r.product.trim() || r.qty);
  const problems = filled.filter(r => rowProblem(r)).length;
  const totalPcs = filled.reduce((s, r) => s + (parseInt(r.qty, 10) || 0), 0);

  const submit = async () => {
    setShowErrors(true);
    if (!filled.length) { toast.error('Add at least one row.'); return; }
    if (problems) { toast.error(`${problems} row(s) need fixing (marked in red).`); return; }
    setBusy(true);
    const payload = filled.map(r => ({
      client_id: r.client_id,
      project_name: r.product.trim(),
      qty: parseInt(r.qty, 10),
      location: r.rack.trim() || null,
      stored_at: r.date || null,
      vendor_id: r.vendor_id || null,
      artwork_version: r.art.trim() || null,
      template_job_id: productsByClient.get(r.client_id)?.get(norm(r.product))?.id || null,
    }));
    const { data, error } = await supabase.rpc('fn_add_opening_stock', { p_rows: payload });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data} batches added to stock ✓`);
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-3 md:p-6">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl p-4 md:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add existing stock</h2>
            <p className="text-xs text-gray-500">
              Stock that is already on your shelf. Each row becomes one batch: no price, no invoice, no dispatch.
              Use the real printed date so the 60 / 90 day warnings are correct.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <>
            <div className="rounded-md border border-dashed border-gray-300 p-3 space-y-2">
              <p className="text-xs text-gray-600">
                <b>Paste from a spreadsheet</b>: columns in this order — Client, Product, Pieces, Rack, Printed on (DD/MM/YYYY), Printer. Rack, date and printer may be empty.
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={3}
                placeholder="Mecolor&#9;Keshari Motichur Laddu Label 500g&#9;2000&#9;R3&#9;15/09/2026&#9;Sai Print"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono"
              />
              <button onClick={applyPaste} disabled={!pasteText.trim()} className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md disabled:opacity-40">
                Read these rows
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[56rem]">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pb-1 pr-2 font-medium">Client</th>
                    <th className="pb-1 pr-2 font-medium">Product</th>
                    <th className="pb-1 pr-2 font-medium w-24">Pieces</th>
                    <th className="pb-1 pr-2 font-medium w-24">Rack</th>
                    <th className="pb-1 pr-2 font-medium w-36">Printed on</th>
                    <th className="pb-1 pr-2 font-medium w-36">Printer</th>
                    <th className="pb-1 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const problem = showErrors && (r.client_id || r.product || r.qty) ? rowProblem(r) : null;
                    const names = r.client_id ? Array.from(productsByClient.get(r.client_id)?.values() || []) : [];
                    const known = !!productsByClient.get(r.client_id)?.get(norm(r.product));
                    const inp = 'w-full px-2 py-1.5 border rounded-md text-sm';
                    return (
                      <tr key={i} className="align-top">
                        <td className="pr-2 pb-2">
                          <select value={r.client_id} onChange={e => update(i, { client_id: e.target.value })}
                            className={`${inp} bg-white ${problem === 'Pick the client' ? 'border-red-400' : 'border-gray-300'}`}>
                            <option value="">Select client…</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
                          </select>
                        </td>
                        <td className="pr-2 pb-2">
                          <input list={`prod-${i}`} value={r.product} onChange={e => update(i, { product: e.target.value })}
                            placeholder="Product / job name"
                            className={`${inp} ${problem === 'Enter the product' ? 'border-red-400' : 'border-gray-300'}`} />
                          <datalist id={`prod-${i}`}>{names.map(p => <option key={p.id} value={p.name} />)}</datalist>
                          {r.product.trim() && r.client_id && (
                            <p className={`text-[10px] mt-0.5 ${known ? 'text-green-700' : 'text-gray-400'}`}>
                              {known ? 'Matches an earlier job: details copied' : 'New name: saved as typed'}
                            </p>
                          )}
                        </td>
                        <td className="pr-2 pb-2">
                          <input type="number" min={1} value={r.qty} onChange={e => update(i, { qty: e.target.value })}
                            className={`${inp} ${problem === 'Enter pieces' ? 'border-red-400' : 'border-gray-300'}`} />
                        </td>
                        <td className="pr-2 pb-2">
                          <input value={r.rack} onChange={e => update(i, { rack: e.target.value })} className={`${inp} border-gray-300`} />
                        </td>
                        <td className="pr-2 pb-2">
                          <input type="date" value={r.date} max={new Date().toISOString().slice(0, 10)} onChange={e => update(i, { date: e.target.value })}
                            className={`${inp} ${problem === 'Date is in the future' ? 'border-red-400' : 'border-gray-300'}`} />
                        </td>
                        <td className="pr-2 pb-2">
                          <select value={r.vendor_id} onChange={e => update(i, { vendor_id: e.target.value })} className={`${inp} bg-white border-gray-300`}>
                            <option value="">—</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        </td>
                        <td className="pb-2">
                          <button onClick={() => setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : [emptyRow()])}
                            aria-label="Remove row" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          {problem && <p className="text-[10px] text-red-600 whitespace-nowrap">{problem}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setRows(rs => [...rs, emptyRow()])} className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900">
                <Plus className="w-3 h-3" /> Add a row
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {filled.length} batches · {totalPcs.toLocaleString('en-IN')} pcs
                  {problems > 0 && showErrors && <span className="text-red-600"> · {problems} to fix</span>}
                </span>
                <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600">Cancel</button>
                <button onClick={submit} disabled={busy || !filled.length}
                  className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md disabled:opacity-50 flex items-center gap-2">
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />} Add to stock
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
