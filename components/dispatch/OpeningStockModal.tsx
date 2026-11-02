'use client';

/**
 * "Add existing stock": bring stock that is already on the shelf into the system, in bulk.
 * Type each batch, add pictures if you have them, or paste rows from a spreadsheet.
 * Nothing is saved until "Add to stock" is pressed; the database adds every row or none.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';

interface Pic { url: string; name: string; size: number; type: string; }
interface Row { client_id: string; product: string; qty: string; date: string; vendor_id: string; pics: Pic[]; uploading: boolean; }
const emptyRow = (): Row => ({ client_id: '', product: '', qty: '', date: '', vendor_id: '', pics: [], uploading: false });
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
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, v] = await Promise.all([
        supabase.from('clients').select('id, name, company').order('company').limit(2000),
        supabase.from('vendors').select('id, name').order('name').limit(1000),
      ]);
      if (c.error || v.error) toast.error((c.error || v.error)!.message);
      setClients(c.data || []);
      setVendors(v.data || []);
      setLoading(false);
    })();
  }, []);

  const clientLabel = (c: any) => c.company || c.name || 'Client';

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addPics = async (i: number, list: FileList | null) => {
    if (!list || !list.length) return;
    update(i, { uploading: true });
    const added: Pic[] = [];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name} is not a picture`); continue; }
      const path = `stock/${Date.now()}-${Math.random().toString(36).slice(2, 8)}/${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const up = await supabase.storage.from('attachments').upload(path, f, { contentType: f.type });
      if (up.error) { toast.error(`${f.name}: ${up.error.message}`); continue; }
      const url = supabase.storage.from('attachments').getPublicUrl(path).data?.publicUrl;
      if (url) added.push({ url, name: f.name, size: f.size, type: f.type });
    }
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, uploading: false, pics: [...r.pics, ...added] } : r)));
  };

  const applyPaste = () => {
    const out: Row[] = [];
    for (const line of pasteText.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = line.split('\t').map(s => s.trim());
      const [cName = '', product = '', qty = '', date = '', printer = ''] = cells;
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
        date: parseDate(date),
        vendor_id: vendor?.id || '',
        pics: [],
        uploading: false,
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

  const filled = rows.filter(r => r.client_id || r.product.trim() || r.qty || r.pics.length);
  const problems = filled.filter(r => rowProblem(r)).length;
  const totalPcs = filled.reduce((s, r) => s + (parseInt(r.qty, 10) || 0), 0);

  const submit = async () => {
    setShowErrors(true);
    if (rows.some(r => r.uploading)) { toast.error('Wait for the pictures to finish uploading.'); return; }
    if (!filled.length) { toast.error('Add at least one row.'); return; }
    if (problems) { toast.error(`${problems} row(s) need fixing (marked in red).`); return; }
    setBusy(true);
    const payload = filled.map(r => ({
      client_id: r.client_id,
      project_name: r.product.trim(),
      qty: parseInt(r.qty, 10),
      stored_at: r.date || null,
      vendor_id: r.vendor_id || null,
      files: r.pics.map(p => ({ ...p, storage: 'supabase', uploaded_at: new Date().toISOString() })),
    }));
    const { data, error } = await supabase.rpc('fn_add_opening_stock', { p_rows: payload });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${data} batches added to stock ✓`);
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-2 md:p-6">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-3 md:p-5 space-y-4 my-2">
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
                <b>Paste from a spreadsheet</b>: columns in this order — Client, Product, Pieces, Printed on (DD/MM/YYYY), Printer. Date and printer may be empty. Add pictures after.
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={3} spellCheck={false}
                placeholder="Mecolor&#9;Keshari Motichur Laddu Label 500g&#9;2000&#9;15/09/2026&#9;Sai Print"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono"
              />
              <button onClick={applyPaste} disabled={!pasteText.trim()} className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md disabled:opacity-40">
                Read these rows
              </button>
            </div>

            <div className="space-y-3">
              {rows.map((r, i) => {
                const problem = showErrors && (r.client_id || r.product || r.qty) ? rowProblem(r) : null;
                const inp = 'w-full px-3 py-2 border rounded-md text-sm bg-white';
                const lbl = 'block text-xs font-medium text-gray-600 mb-1';
                return (
                  <div key={i} className={`rounded-lg border p-3 ${problem ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">Batch {i + 1}</span>
                      <button onClick={() => setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : [emptyRow()])}
                        aria-label="Remove batch" className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-x-3 gap-y-3">
                      <label className="col-span-2 md:col-span-2 block">
                        <span className={lbl}>Client</span>
                        <select value={r.client_id} onChange={e => update(i, { client_id: e.target.value })}
                          className={`${inp} ${problem === 'Pick the client' ? 'border-red-400' : 'border-gray-300'}`}>
                          <option value="">Select client…</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
                        </select>
                      </label>
                      <label className="col-span-2 md:col-span-4 block">
                        <span className={lbl}>Product / job name</span>
                        <input value={r.product} onChange={e => update(i, { product: e.target.value })}
                          className={`${inp} ${problem === 'Enter the product' ? 'border-red-400' : 'border-gray-300'}`} />
                      </label>
                      <label className="block md:col-span-2">
                        <span className={lbl}>Pieces</span>
                        <input type="number" inputMode="numeric" min={1} value={r.qty} onChange={e => update(i, { qty: e.target.value })}
                          className={`${inp} ${problem === 'Enter pieces' ? 'border-red-400' : 'border-gray-300'}`} />
                      </label>
                      <label className="block md:col-span-2">
                        <span className={lbl}>Printed on</span>
                        <input type="date" value={r.date} max={new Date().toISOString().slice(0, 10)} onChange={e => update(i, { date: e.target.value })}
                          className={`${inp} min-w-0 appearance-none ${problem === 'Date is in the future' ? 'border-red-400' : 'border-gray-300'}`} />
                      </label>
                      <label className="col-span-2 md:col-span-2 block">
                        <span className={lbl}>Printer (optional)</span>
                        <select value={r.vendor_id} onChange={e => update(i, { vendor_id: e.target.value })} className={`${inp} border-gray-300`}>
                          <option value="">—</option>
                          {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </label>
                      <div className="col-span-2 md:col-span-6">
                        <span className={lbl}>Pictures (optional)</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {r.pics.map((p, k) => (
                            <span key={k} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.url} alt={p.name} className="w-14 h-14 object-cover rounded border border-gray-200" />
                              <button onClick={() => setRows(rs => rs.map((x, idx) => idx === i ? { ...x, pics: x.pics.filter((_, kk) => kk !== k) } : x))}
                                aria-label="Remove picture" className="absolute -top-1.5 -right-1.5 bg-white border border-gray-300 rounded-full w-5 h-5 text-xs leading-none text-gray-600">×</button>
                            </span>
                          ))}
                          <label className="cursor-pointer text-sm px-3 py-2 border border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-500 bg-white">
                            {r.uploading ? 'Uploading…' : '+ Add pictures'}
                            <input type="file" accept="image/*" multiple className="hidden" disabled={r.uploading}
                              onChange={e => { addPics(i, e.target.files); e.target.value = ''; }} />
                          </label>
                        </div>
                      </div>
                    </div>
                    {problem && <p className="text-xs text-red-600 mt-2">{problem}</p>}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <button onClick={() => setRows(rs => [...rs, emptyRow()])} className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900">
                <Plus className="w-3 h-3" /> Add a row
              </button>
              <div className="flex flex-wrap items-center justify-between md:justify-end gap-3">
                <span className="text-xs text-gray-500 w-full md:w-auto">
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
