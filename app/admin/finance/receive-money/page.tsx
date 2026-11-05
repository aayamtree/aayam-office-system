'use client';

/**
 * Trial: Receive money (no invoice).
 * Records cash / UPI / bank money from a customer as an ADVANCE (a liability,
 * not sales). Posts Dr deposit account / Cr 2300 Customer Advances.
 */

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Paperclip, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';

type Opt = { id: string; label: string };
type Row = {
  id: string; payment_number: string; payment_date: string; payment_mode: string;
  amount: number; notes: string | null; attachment_url: string | null; client_id: string | null;
};

const inr = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const modeLabel = (m: string) => (m === 'upi' ? 'UPI' : m === 'cash' ? 'Cash' : m === 'bank_transfer' ? 'Bank' : m);
const today = () => new Date().toISOString().slice(0, 10);

function Inner() {
  const [clients, setClients] = useState<Opt[]>([]);
  const [jobs, setJobs] = useState<(Opt & { client_id: string })[]>([]);
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [cash, setCash] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState('');
  const [jobId, setJobId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [account, setAccount] = useState(''); // bank:<id> | cash:<id>
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, j, b, ca, r] = await Promise.all([
      supabase.from('clients').select('id, name, company').order('company'),
      supabase.from('jobs').select('id, job_number, client_id').order('job_number', { ascending: false }).limit(500),
      supabase.from('bank_accounts').select('id, name').eq('is_active', true),
      supabase.from('chart_of_accounts').select('name, linked_cash_account_id').not('linked_cash_account_id', 'is', null).eq('is_active', true),
      supabase.from('payments_received')
        .select('id, payment_number, payment_date, payment_mode, amount, notes, attachment_url, client_id')
        .eq('source', 'advance').order('payment_date', { ascending: false }).limit(50),
    ]);
    setClients((c.data || []).map((x: any) => ({ id: x.id, label: x.company || x.name })));
    setJobs((j.data || []).map((x: any) => ({ id: x.id, label: x.job_number, client_id: x.client_id })));
    setBanks((b.data || []) as any);
    setCash((ca.data || []).map((x: any) => ({ id: x.linked_cash_account_id, name: x.name })));
    setRows((r.data || []) as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.label || '';
  const clientJobs = jobs.filter(j => j.client_id === clientId);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!clientId) return toast.error('Choose the customer');
    if (!(amt > 0)) return toast.error('Enter the amount');
    if (!account) return toast.error('Choose where the money went');
    const [kind, id] = account.split(':');
    const accName = (kind === 'bank' ? banks : cash).find(a => a.id === id)?.name || '';
    const mode = kind === 'bank' ? 'bank_transfer' : accName.toLowerCase().includes('upi') ? 'upi' : 'cash';

    setSaving(true);
    try {
      let url: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `advances/${clientId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from('attachments').upload(path, file);
        if (upErr) { toast.error('Could not upload the screenshot'); setSaving(false); return; }
        url = supabase.storage.from('attachments').getPublicUrl(path).data?.publicUrl || null;
      }
      const { error } = await supabase.rpc('fn_record_customer_advance', {
        p_client_id: clientId,
        p_job_id: jobId || null,
        p_amount: amt,
        p_mode: mode,
        p_date: date,
        p_bank_account_id: kind === 'bank' ? id : null,
        p_cash_account_id: kind === 'cash' ? id : null,
        p_reference: reference || null,
        p_notes: note || null,
        p_attachment_url: url,
      });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Money received recorded');
      setAmount(''); setReference(''); setNote(''); setFile(null); setJobId('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const inputCls = 'w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400';
  const labelCls = 'text-xs text-gray-500 font-semibold uppercase tracking-wider';

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Receive money (no invoice)</h1>
        <p className="text-sm text-gray-500 mt-1">
          For cash, UPI or bank money from a customer that has no invoice. It is booked as money received in advance
          (a liability), not as sales, and it goes into the account you choose.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelCls}>Customer</label>
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); setJobId(''); }} className={inputCls}>
            <option value="">Select customer…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Order / job (optional)</label>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputCls} disabled={!clientId}>
            <option value="">None</option>
            {clientJobs.map(j => <option key={j.id} value={j.id}>{j.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Amount received (₹)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Deposit To</label>
          <select value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls}>
            <option value="">Select account…</option>
            {banks.length > 0 && (
              <optgroup label="Bank">
                {banks.map(a => <option key={a.id} value={`bank:${a.id}`}>{a.name}</option>)}
              </optgroup>
            )}
            {cash.length > 0 && (
              <optgroup label="Cash / UPI">
                {cash.map(a => <option key={a.id} value={`cash:${a.id}`}>{a.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div>
          <label className={labelCls}>Reference (optional)</label>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref / UTR" className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Note (optional)</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rest of INV-26-003 paid by UPI" className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Screenshot / proof (optional)</label>
          <label className="mt-1 flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-md cursor-pointer text-sm text-gray-600">
            <Paperclip size={16} />
            {file ? file.name : 'Attach a UPI screenshot'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button onClick={save} disabled={saving}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Record money received
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between text-sm">
          <span className="font-semibold">Recent advances</span>
          <span className="text-gray-500">Total {inr(total)}</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nothing recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Note</th><th className="px-4 py-2">Proof</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(r.payment_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-2">{clientName(r.client_id)}</td>
                  <td className="px-4 py-2">{modeLabel(r.payment_mode)}</td>
                  <td className="px-4 py-2 text-right font-medium">{inr(r.amount)}</td>
                  <td className="px-4 py-2 text-gray-500">{r.notes || ''}</td>
                  <td className="px-4 py-2">
                    {r.attachment_url && (
                      <a href={r.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600">
                        View <ExternalLink size={12} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ReceiveMoneyTrialPage() {
  return (
    <AdminOnlyGate>
      <Inner />
    </AdminOnlyGate>
  );
}
