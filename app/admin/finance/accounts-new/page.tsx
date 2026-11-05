'use client';

/**
 * Trial: Accounts (new) — checklist 5.1 to 5.8.
 * Chart of accounts (detail types, system lock, GST accounts), account register with running balance,
 * and bank reconciliation (start, tick, finish, history, undo latest).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import { formatInr, paise } from '@/lib/invoice-list-tools';

type Acct = { id: string; code: string; name: string; account_type: string; sub_type: string | null; description: string | null; is_active: boolean; is_system: boolean; linked_bank_account_id: string | null };
type Bal = { account_id: string; debit: number; credit: number };
const inr = (n: number) => formatInr(paise(n));
const sel = 'px-2 py-2 border border-gray-200 rounded-md text-sm bg-white';
const th = 'px-3 py-2 text-right';

// 15 detail types, each under one of the five base types that reports use
const SUBTYPES: Record<string, string[]> = {
  asset: ['Bank', 'Cash', 'Accounts Receivable', 'Other Current Asset', 'Fixed Asset'],
  liability: ['Accounts Payable', 'Credit Card', 'Other Current Liability', 'Long-term Liability'],
  equity: ['Equity'],
  income: ['Income', 'Other Income'],
  expense: ['Cost of Goods Sold', 'Expense', 'Other Expense'],
};
const debitNormal = (t: string) => t === 'asset' || t === 'expense';
const downloadCsv = (name: string, rows: (string | number)[][]) => {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click();
};
async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function Inner() {
  const [tab, setTab] = useState<'accounts' | 'register' | 'reconcile'>('accounts');
  const [accts, setAccts] = useState<Acct[]>([]);
  const [bals, setBals] = useState<Record<string, Bal>>({});
  const [loading, setLoading] = useState(true);
  const [regFor, setRegFor] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from('chart_of_accounts').select('id, code, name, account_type, sub_type, description, is_active, is_system, linked_bank_account_id').order('code'),
      supabase.from('v_account_balances').select('account_id, debit, credit'),
    ]);
    setAccts((a.data || []) as Acct[]);
    const m: Record<string, Bal> = {}; (b.data || []).forEach((x: any) => { m[x.account_id] = { account_id: x.account_id, debit: Number(x.debit), credit: Number(x.credit) }; }); setBals(m);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">Accounts (new)</h1>
        <p className="text-sm text-gray-500">Your chart of accounts, each account’s register, and bank reconciliation.</p>
      </div>
      <div className="flex gap-2">
        {([['accounts', 'Chart of accounts'], ['register', 'Register'], ['reconcile', 'Reconcile']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{l}</button>))}
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : <>
        {tab === 'accounts' && <Chart accts={accts} bals={bals} reload={load} openRegister={id => { setRegFor(id); setTab('register'); }} />}
        {tab === 'register' && <Register accts={accts} initial={regFor} />}
        {tab === 'reconcile' && <Reconcile />}
      </>}
    </div>
  );
}

// ───────── 5.1 / 5.2 chart of accounts ─────────
function Chart({ accts, bals, reload, openRegister }: { accts: Acct[]; bals: Record<string, Bal>; reload: () => void; openRegister: (id: string) => void }) {
  const [q, setQ] = useState(''); const [ft, setFt] = useState(''); const [fs, setFs] = useState('active');
  const [edit, setEdit] = useState<Partial<Acct> | null>(null);
  const bal = (a: Acct) => { const b = bals[a.id]; if (!b) return 0; return debitNormal(a.account_type) ? b.debit - b.credit : b.credit - b.debit; };
  const rows = useMemo(() => accts.filter(a => (!ft || a.account_type === ft) && (fs === 'all' || (fs === 'active') === a.is_active) &&
    (!q || (a.code + ' ' + a.name).toLowerCase().includes(q.toLowerCase()))), [accts, q, ft, fs]);

  const save = async () => {
    if (!edit) return;
    if (!edit.code?.trim() || !edit.name?.trim() || !edit.account_type) return toast.error('Code, name and type are needed');
    const body: any = { code: edit.code.trim(), name: edit.name.trim(), account_type: edit.account_type, sub_type: edit.sub_type || SUBTYPES[edit.account_type][0], description: edit.description || null, is_active: edit.is_active !== false };
    const r = edit.id ? await supabase.from('chart_of_accounts').update(body).eq('id', edit.id) : await supabase.from('chart_of_accounts').insert(body);
    if (r.error) return toast.error(r.error.message.includes('duplicate') ? 'That code is already used' : r.error.message);
    toast.success('Saved'); setEdit(null); reload();
  };
  const toggle = async (a: Acct) => { const { error } = await supabase.from('chart_of_accounts').update({ is_active: !a.is_active }).eq('id', a.id); if (error) toast.error(error.message); else reload(); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input placeholder="Search code or name" value={q} onChange={e => setQ(e.target.value)} className={sel} />
        <select value={ft} onChange={e => setFt(e.target.value)} className={sel}><option value="">All types</option>{Object.keys(SUBTYPES).map(t => <option key={t} value={t}>{t}</option>)}</select>
        <select value={fs} onChange={e => setFs(e.target.value)} className={sel}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select>
        <button onClick={() => setEdit({ account_type: 'expense', is_active: true })} className={sel}>New account</button>
        <button onClick={() => downloadCsv('chart-of-accounts.csv', [['Code', 'Name', 'Type', 'Detail type', 'Balance', 'Active'], ...rows.map(a => [a.code, a.name, a.account_type, a.sub_type || '', bal(a).toFixed(2), a.is_active ? 'Yes' : 'No'])])} className={sel}>CSV</button>
        <button onClick={() => window.print()} className={sel}>Print</button>
      </div>
      {edit && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 grid gap-2 sm:grid-cols-4">
          <input placeholder="Code" value={edit.code || ''} disabled={!!edit.is_system} onChange={e => setEdit({ ...edit, code: e.target.value })} className={sel} />
          <input placeholder="Name" value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} className={sel + ' sm:col-span-2'} />
          <select value={edit.account_type} disabled={!!edit.is_system} onChange={e => setEdit({ ...edit, account_type: e.target.value, sub_type: SUBTYPES[e.target.value][0] })} className={sel}>{Object.keys(SUBTYPES).map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select value={edit.sub_type || ''} onChange={e => setEdit({ ...edit, sub_type: e.target.value })} className={sel}>{(SUBTYPES[edit.account_type || 'expense'] || []).map(t => <option key={t} value={t}>{t}</option>)}</select>
          <input placeholder="Description (optional)" value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} className={sel + ' sm:col-span-2'} />
          <div className="flex gap-2"><button onClick={save} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold">Save</button><button onClick={() => setEdit(null)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">Cancel</button></div>
          <p className="text-xs text-gray-500 sm:col-span-4">The type cannot be changed once an account has entries. System accounts have a locked code and type.</p>
        </div>)}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Detail type</th><th className={th}>Balance</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className={`border-t border-gray-100 ${a.is_active ? '' : 'opacity-50'}`}>
                <td className="px-3 py-2">{a.code}</td>
                <td className="px-3 py-2">{a.name}{a.is_system && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">system</span>}</td>
                <td className="px-3 py-2 capitalize">{a.account_type}</td><td className="px-3 py-2">{a.sub_type}</td>
                <td className={th}>{inr(bal(a))}</td>
                <td className="px-3 py-2 text-xs space-x-2 whitespace-nowrap">
                  <button onClick={() => openRegister(a.id)} className="text-blue-600 font-semibold">Register</button>
                  <button onClick={() => setEdit(a)} className="text-gray-700 font-semibold">Edit</button>
                  {!a.is_system && <button onClick={() => toggle(a)} className="text-gray-700 font-semibold">{a.is_active ? 'Make inactive' : 'Make active'}</button>}
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────── 5.3 register ─────────
function Register({ accts, initial }: { accts: Acct[]; initial: string }) {
  const [accId, setAccId] = useState(initial || '');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [lines, setLines] = useState<any[]>([]); const [busy, setBusy] = useState(false);
  const acct = accts.find(a => a.id === accId);

  useEffect(() => {
    if (!accId) { setLines([]); return; }
    setBusy(true);
    fetchAll((x, y) => supabase.from('journal_entry_lines').select('debit_amount, credit_amount, description, journal_entries!inner(entry_date, entry_number, description, source_type, is_posted)').eq('account_id', accId).range(x, y))
      .then(d => setLines(d.filter((l: any) => l.journal_entries?.is_posted !== false))).catch(e => toast.error(e.message)).finally(() => setBusy(false));
  }, [accId]);

  const preset = (k: string) => {
    const d = new Date(); const iso = (x: Date) => x.toLocaleDateString('en-CA');
    if (k === 'month') { setFrom(iso(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(iso(d)); }
    else if (k === 'last') { setFrom(iso(new Date(d.getFullYear(), d.getMonth() - 1, 1))); setTo(iso(new Date(d.getFullYear(), d.getMonth(), 0))); }
    else if (k === 'fy') { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; setFrom(`${y}-04-01`); setTo(iso(d)); }
    else { setFrom(''); setTo(''); }
  };
  const sign = acct && debitNormal(acct.account_type) ? 1 : -1;
  const sorted = useMemo(() => [...lines].sort((a, b) => (a.journal_entries.entry_date + a.journal_entries.entry_number).localeCompare(b.journal_entries.entry_date + b.journal_entries.entry_number)), [lines]);
  const { opening, rows } = useMemo(() => {
    let run = 0, open = 0; const out: any[] = [];
    sorted.forEach(l => {
      const net = sign * (Number(l.debit_amount || 0) - Number(l.credit_amount || 0)); const d = l.journal_entries.entry_date;
      if (from && d < from) { open += net; run += net; return; }
      if (to && d > to) return;
      run += net; out.push({ ...l, run });
    });
    return { opening: open, rows: out };
  }, [sorted, from, to, sign]);
  const totals = rows.reduce((t, r) => ({ d: t.d + Number(r.debit_amount || 0), c: t.c + Number(r.credit_amount || 0) }), { d: 0, c: 0 });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={accId} onChange={e => setAccId(e.target.value)} className={sel + ' min-w-[220px]'}><option value="">Choose an account…</option>{accts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select>
        {[['month', 'This month'], ['last', 'Last month'], ['fy', 'This financial year'], ['all', 'All time']].map(([k, l]) => <button key={k} onClick={() => preset(k)} className={sel}>{l}</button>)}
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={sel} /><input type="date" value={to} onChange={e => setTo(e.target.value)} className={sel} />
        {acct && <button onClick={() => downloadCsv(`register-${acct.code}.csv`, [['Date', 'Entry', 'Description', 'Debit', 'Credit', 'Balance'], ...rows.map(r => [r.journal_entries.entry_date, r.journal_entries.entry_number, r.description || r.journal_entries.description || '', r.debit_amount || 0, r.credit_amount || 0, r.run.toFixed(2)])])} className={sel}>CSV</button>}
      </div>
      {busy ? <Loader2 className="animate-spin" /> : acct && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Entry</th><th className="px-3 py-2">Description</th><th className={th}>Debit</th><th className={th}>Credit</th><th className={th}>Balance</th></tr></thead>
            <tbody>
              {from && <tr className="bg-gray-50"><td className="px-3 py-2" colSpan={5}>Opening balance on {from}</td><td className={th}>{inr(opening)}</td></tr>}
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-100"><td className="px-3 py-2 whitespace-nowrap">{r.journal_entries.entry_date}</td><td className="px-3 py-2">{r.journal_entries.entry_number}</td>
                  <td className="px-3 py-2">{r.description || r.journal_entries.description}<span className="block text-[11px] text-gray-400">{r.journal_entries.source_type}</span></td>
                  <td className={th}>{Number(r.debit_amount) ? inr(Number(r.debit_amount)) : ''}</td><td className={th}>{Number(r.credit_amount) ? inr(Number(r.credit_amount)) : ''}</td><td className={th}>{inr(r.run)}</td></tr>))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">No entries in this period.</td></tr>}
              <tr className="border-t-2 border-gray-200 font-semibold"><td className="px-3 py-2" colSpan={3}>Totals</td><td className={th}>{inr(totals.d)}</td><td className={th}>{inr(totals.c)}</td><td className={th}>{inr(rows.length ? rows[rows.length - 1].run : opening)}</td></tr>
            </tbody>
          </table>
        </div>)}
    </div>
  );
}

// ───────── 5.4–5.7 reconcile ─────────
function Reconcile() {
  const [accs, setAccs] = useState<{ id: string; name: string }[]>([]);
  const [accId, setAccId] = useState('');
  const [recs, setRecs] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [bal, setBal] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.from('bank_accounts').select('id, name').eq('is_active', true).then(({ data }) => { setAccs(data || []); if (data?.[0]) setAccId(p => p || data[0].id); }); }, []);
  const load = useCallback(async () => {
    if (!accId) return;
    const r = await supabase.from('bank_reconciliations').select('*').eq('bank_account_id', accId).order('created_at', { ascending: false });
    setRecs(r.data || []);
    const draft = (r.data || []).find((x: any) => x.status === 'draft');
    if (draft) {
      const [l, it] = await Promise.all([
        fetchAll((x, y) => supabase.from('bank_transactions').select('id, transaction_date, transaction_type, amount, description, reference_number').eq('bank_account_id', accId).is('reconciliation_id', null).lte('transaction_date', draft.statement_date).order('transaction_date').range(x, y)),
        supabase.from('bank_reconciliation_items').select('bank_transaction_id').eq('reconciliation_id', draft.id)]);
      setLines(l); setTicked(new Set((it.data || []).map((x: any) => x.bank_transaction_id)));
    } else { setLines([]); setTicked(new Set()); }
  }, [accId]);
  useEffect(() => { load(); }, [load]);

  const draft = recs.find(r => r.status === 'draft');
  const lastDone = recs.find(r => r.status === 'completed');
  const net = lines.filter(l => ticked.has(l.id)).reduce((s, l) => s + (l.transaction_type === 'inflow' ? 1 : -1) * Number(l.amount), 0);
  const diff = draft ? Math.round((Number(draft.statement_balance) - (Number(draft.opening_cleared) + net)) * 100) / 100 : 0;

  const run = async (fn: () => PromiseLike<{ error: any }>, ok: string) => { setBusy(true); const { error } = await fn(); setBusy(false); if (error) { toast.error(error.message); return false; } toast.success(ok); await load(); return true; };
  const tick = (ids: string[], on: boolean) => {
    setTicked(prev => { const n = new Set(prev); ids.forEach(i => on ? n.add(i) : n.delete(i)); return n; });
    supabase.rpc('fn_recon_tick', { p_recon: draft.id, p_ids: ids, p_on: on }).then(({ error }) => { if (error) { toast.error(error.message); load(); } });
  };

  return (
    <div className="space-y-4">
      <select value={accId} onChange={e => setAccId(e.target.value)} className={sel}>{accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      {!draft ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 max-w-xl">
          <h2 className="font-semibold">Start a reconciliation</h2>
          <p className="text-xs text-gray-500">Enter the closing date and closing balance printed on your bank statement. {lastDone ? `Last reconciled to ${lastDone.statement_date}.` : 'This account has not been reconciled before.'}</p>
          <div className="flex gap-2 flex-wrap"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={sel} /><input type="number" step="0.01" placeholder="Statement closing balance" value={bal} onChange={e => setBal(e.target.value)} className={sel} />
            <button disabled={busy || bal === ''} onClick={() => run(() => supabase.rpc('fn_recon_start', { p_account: accId, p_date: date, p_balance: Number(bal) }), 'Started')} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-50">Start</button></div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4 text-sm">
            {[['Statement balance', Number(draft.statement_balance)], ['Cleared so far', Number(draft.opening_cleared)], ['Ticked now', net], ['Difference', diff]].map(([l, v]) => (
              <div key={l as string} className={`rounded-lg border p-3 ${l === 'Difference' ? (diff === 0 ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50') : 'border-gray-200 bg-white'}`}><p className="text-xs text-gray-500">{l}</p><p className="font-semibold">{inr(v as number)}</p></div>))}
          </div>
          <p className="text-xs text-gray-500">Tick every line that appears on the statement up to {draft.statement_date}. When the difference is zero, finish.</p>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto max-h-[420px]">
            <table className="w-full text-sm"><thead className="text-left text-xs text-gray-500 uppercase sticky top-0 bg-white"><tr>
              <th className="px-3 py-2"><input type="checkbox" checked={lines.length > 0 && lines.every(l => ticked.has(l.id))} onChange={e => tick(lines.map(l => l.id), e.target.checked)} /></th>
              <th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className={th}>In</th><th className={th}>Out</th></tr></thead>
              <tbody>{lines.map(l => (
                <tr key={l.id} className="border-t border-gray-100"><td className="px-3 py-1.5"><input type="checkbox" checked={ticked.has(l.id)} onChange={e => tick([l.id], e.target.checked)} /></td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{l.transaction_date}</td><td className="px-3 py-1.5">{l.description}</td>
                  <td className={th}>{l.transaction_type === 'inflow' ? inr(Number(l.amount)) : ''}</td><td className={th}>{l.transaction_type === 'outflow' ? inr(Number(l.amount)) : ''}</td></tr>))}
                {lines.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400">No unreconciled lines up to this date.</td></tr>}</tbody></table>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button disabled={busy || diff !== 0} onClick={() => run(() => supabase.rpc('fn_recon_finish', { p_recon: draft.id, p_post_adjustment: false }), 'Reconciled')} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-40">Finish</button>
            <button disabled={busy || diff === 0} onClick={() => { if (confirm(`Post ${inr(Math.abs(diff))} to “Reconciliation Adjustments” and finish? This writes a journal entry to your ledger.`)) run(() => supabase.rpc('fn_recon_finish', { p_recon: draft.id, p_post_adjustment: true }), 'Reconciled with adjustment'); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-40">Finish and post the difference</button>
            <button disabled={busy} onClick={() => run(() => supabase.rpc('fn_recon_cancel', { p_recon: draft.id }), 'Cancelled')} className="px-4 py-2 border border-gray-200 rounded-md text-sm">Cancel this reconciliation</button>
          </div>
        </div>)}

      <div>
        <h2 className="font-semibold mb-2">History</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Statement date</th><th className={th}>Statement balance</th><th className={th}>Adjustment</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>{recs.filter(r => r.status !== 'draft').map(r => (
            <tr key={r.id} className="border-t border-gray-100"><td className="px-3 py-2">{r.statement_date}</td><td className={th}>{inr(Number(r.statement_balance))}</td><td className={th}>{Number(r.adjustment_amount) ? inr(Number(r.adjustment_amount)) : '—'}</td><td className="px-3 py-2 capitalize">{r.status}</td>
              <td className="px-3 py-2">{r.id === lastDone?.id && <button disabled={busy} onClick={() => { if (confirm('Undo this reconciliation? Any adjustment is reversed and the lines become unreconciled again.')) run(() => supabase.rpc('fn_recon_undo', { p_recon: r.id }), 'Undone'); }} className="text-red-600 text-xs font-semibold">Undo</button>}</td></tr>))}
            {recs.filter(r => r.status !== 'draft').length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400">No past reconciliations.</td></tr>}</tbody></table></div>
        <p className="text-xs text-gray-500 mt-2">A reconciled bank line cannot be edited or deleted until its reconciliation is undone. Only the latest reconciliation can be undone.</p>
      </div>
    </div>
  );
}

export default function AccountsNewPage() { return (<AdminOnlyGate><Inner /></AdminOnlyGate>); }
