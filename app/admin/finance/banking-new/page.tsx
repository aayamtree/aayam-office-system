'use client';

/**
 * Trial: Banking (new) — checklist 4.1 to 4.11.
 * To review / Added / Excluded tabs, statement FILE upload with preview and duplicate skipping,
 * rules that only SUGGEST, suggestions from history, bulk actions, Record as transfer,
 * Money-out to bill matching, and account cards (books / ledger / statement balance).
 * Nothing here posts a second journal for a line: final categorising stays on the live Banking page.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import { loadFinanceSettings } from '@/lib/finance-settings';
import { formatInr, paise } from '@/lib/invoice-list-tools';
import { Mapping, ParsedLine, firstTwoWords, lineKey, mapRows, parseText } from '@/lib/bank-import';

type Acc = { id: string; name: string; account_type: string | null; current_balance: number; is_default: boolean };
type Txn = {
  id: string; bank_account_id: string; transaction_date: string; transaction_type: 'inflow' | 'outflow'; amount: number;
  description: string | null; reference_number: string | null; balance_after: number | null; is_verified: boolean | null; reference_type: string | null;
  expense_category_id: string | null; income_category_id: string | null; payee_name: string | null; categorization_notes: string | null;
  excluded_at: string | null; excluded_reason: string | null; is_transfer: boolean; transfer_account_id: string | null; matched_bill_id: string | null;
  suggested_rule_id: string | null; suggested_action: string | null; suggested_expense_category_id: string | null; suggested_income_category_id: string | null;
  suggested_transfer_account_id: string | null; suggested_payee: string | null; suggested_memo: string | null;
};
type Rule = {
  id: string; name: string; direction: 'in' | 'out' | 'both'; bank_account_id: string | null; match_mode: 'all' | 'any';
  conditions: { field: 'description' | 'amount'; op: string; value: string }[]; action: 'categorize' | 'transfer';
  expense_category_id: string | null; income_category_id: string | null; transfer_account_id: string | null; payee_name: string | null; memo: string | null;
  is_active: boolean; sort_order: number;
};
type Cat = { id: string; name: string };

const inr = (n: number) => formatInr(paise(n));
const sel = 'px-2 py-2 border border-gray-200 rounded-md text-sm bg-white';
const th = 'px-3 py-2 text-right';
const TYPES = ['current', 'cash', 'upi', 'other'];

async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function Inner() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [accs, setAccs] = useState<Acc[]>([]);
  const [accId, setAccId] = useState('');
  const [txns, setTxns] = useState<Txn[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [expCats, setExpCats] = useState<Cat[]>([]);
  const [incCats, setIncCats] = useState<Cat[]>([]);
  const [ledger, setLedger] = useState<Record<string, number>>({});
  const [closing, setClosing] = useState<string | null>(null);
  const [tab, setTab] = useState<'review' | 'added' | 'excluded' | 'rules' | 'import'>('review');
  const [ruleDraft, setRuleDraft] = useState<Partial<Rule> | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [fs, a, r, ec, ic, led, tx] = await Promise.all([
        loadFinanceSettings(),
        supabase.from('bank_accounts').select('id, name, account_type, current_balance, is_default').eq('is_active', true),
        supabase.from('bank_rules').select('*').order('sort_order').order('created_at'),
        supabase.from('expense_categories').select('id, name').eq('is_active', true).order('name'),
        supabase.from('income_categories').select('id, name').eq('is_active', true).order('name'),
        supabase.from('v_account_balances').select('linked_bank_account_id, net_debit').not('linked_bank_account_id', 'is', null),
        fetchAll((x, y) => supabase.from('bank_transactions').select('*').order('transaction_date', { ascending: false }).range(x, y)),
      ]);
      setClosing(fs.closingDate);
      const list = (a.data || []) as Acc[]; setAccs(list);
      setAccId(prev => prev || (list.find(x => x.is_default) || list[0])?.id || '');
      setRules((r.data || []) as Rule[]); setExpCats((ec.data || []) as Cat[]); setIncCats((ic.data || []) as Cat[]);
      const lm: Record<string, number> = {}; (led.data || []).forEach((x: any) => { lm[x.linked_bank_account_id] = Number(x.net_debit); }); setLedger(lm);
      setTxns(tx as Txn[]);
    } catch (e: any) { setErr(e.message || 'Could not load'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const mine = useMemo(() => txns.filter(t => t.bank_account_id === accId), [txns, accId]);
  const isExcl = (t: Txn) => !!t.excluded_at || t.reference_type === 'ignored';
  const review = mine.filter(t => !t.is_verified && !isExcl(t) && !t.is_transfer);
  const added = mine.filter(t => t.is_verified || t.is_transfer);
  const excluded = mine.filter(t => isExcl(t) && !t.is_verified);

  const openRuleFrom = (t: Txn) => {
    setRuleDraft({ name: firstTwoWords(t.description) || 'New rule', direction: t.transaction_type === 'inflow' ? 'in' : 'out', match_mode: 'all', action: 'categorize', is_active: true,
      conditions: [{ field: 'description', op: 'contains', value: firstTwoWords(t.description) }] });
    setTab('rules');
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">Banking (new)</h1>
        <p className="text-sm text-gray-500">Bring in statement lines, sort them with rules, match money-out to bills. Rules only suggest — you stay in control. Final categorising is still done on the live Banking page, so nothing is booked twice.</p>
      </div>
      {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{err}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : (
        <>
          <AccountCards accs={accs} accId={accId} setAccId={setAccId} txns={txns} ledger={ledger} reload={load} />
          <div className="flex gap-2 flex-wrap">
            {([['review', `To review (${review.length})`], ['added', `Added (${added.length})`], ['excluded', `Excluded (${excluded.length})`], ['rules', 'Rules'], ['import', 'Import statement']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{l}</button>))}
          </div>
          {tab === 'review' && <Review rows={review} all={mine} accs={accs} accId={accId} expCats={expCats} incCats={incCats} reload={load} openRuleFrom={openRuleFrom} />}
          {tab === 'added' && <Simple rows={added} accs={accs} expCats={expCats} incCats={incCats} kind="added" reload={load} />}
          {tab === 'excluded' && <Simple rows={excluded} accs={accs} expCats={expCats} incCats={incCats} kind="excluded" reload={load} />}
          {tab === 'rules' && <Rules rules={rules} accs={accs} expCats={expCats} incCats={incCats} draft={ruleDraft} setDraft={setRuleDraft} accId={accId} reload={load} />}
          {tab === 'import' && <Import accId={accId} accName={accs.find(a => a.id === accId)?.name || ''} existing={mine} closing={closing} reload={load} />}
        </>
      )}
    </div>
  );
}

// ───────── 4.8 account cards + 4.9 account type ─────────
function AccountCards({ accs, accId, setAccId, txns, ledger, reload }: { accs: Acc[]; accId: string; setAccId: (s: string) => void; txns: Txn[]; ledger: Record<string, number>; reload: () => void }) {
  const setType = async (id: string, type: string) => {
    const { error } = await supabase.from('bank_accounts').update({ account_type: type }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Saved'); reload(); }
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accs.map(a => {
        const mine = txns.filter(t => t.bank_account_id === a.id);
        const latest = mine.filter(t => t.balance_after !== null).sort((x, y) => y.transaction_date.localeCompare(x.transaction_date))[0];
        const stmt = latest ? Number(latest.balance_after) : null;
        const books = Number(a.current_balance) || 0;
        const toReview = mine.filter(t => !t.is_verified && !t.excluded_at && t.reference_type !== 'ignored' && !t.is_transfer).length;
        const diff = stmt === null ? null : Math.round((stmt - books) * 100) / 100;
        const opts = Array.from(new Set([...TYPES, a.account_type || ''].filter(Boolean)));
        return (
          <div key={a.id} onClick={() => setAccId(a.id)} className={`bg-white border rounded-lg p-3 cursor-pointer ${a.id === accId ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'}`}>
            <div className="flex justify-between items-start gap-2">
              <p className="font-semibold">{a.name}</p>
              <select value={a.account_type || ''} onClick={e => e.stopPropagation()} onChange={e => setType(a.id, e.target.value)} className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white">
                {opts.map(o => <option key={o} value={o}>{o === 'upi' ? 'UPI' : o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>
            <dl className="mt-2 text-sm space-y-0.5">
              <div className="flex justify-between"><dt className="text-gray-500">Books balance</dt><dd className="font-medium">{inr(books)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Ledger balance</dt><dd>{a.id in ledger ? inr(ledger[a.id]) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Statement balance</dt><dd>{stmt === null ? '—' : inr(stmt)}</dd></div>
              {diff !== null && Math.abs(diff) > 0.005 && <p className="text-xs text-amber-700">Statement differs from books by {inr(diff)}</p>}
            </dl>
            <p className="mt-1 text-xs text-gray-500">{toReview} to review</p>
          </div>);
      })}
    </div>
  );
}

// ───────── To review ─────────
function Review({ rows, all, accs, accId, expCats, incCats, reload, openRuleFrom }: { rows: Txn[]; all: Txn[]; accs: Acc[]; accId: string; expCats: Cat[]; incCats: Cat[]; reload: () => void; openRuleFrom: (t: Txn) => void }) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [matchFor, setMatchFor] = useState<Txn | null>(null);
  const [cands, setCands] = useState<any[]>([]);
  const [xferFor, setXferFor] = useState<Txn | null>(null);
  const [xferTo, setXferTo] = useState('');
  const ids = rows.filter(r => picked[r.id]).map(r => r.id);
  const catName = (t: Txn, id: string | null) => (t.transaction_type === 'inflow' ? incCats : expCats).find(c => c.id === id)?.name || '';

  // 4.5 suggested from history: the same first two words in lines that were already added
  const history = useMemo(() => {
    const m = new Map<string, { exp: Record<string, number>; inc: Record<string, number>; payee: Record<string, number> }>();
    all.filter(t => t.is_verified).forEach(t => {
      const k = firstTwoWords(t.description); if (!k) return;
      const g = m.get(k) || { exp: {}, inc: {}, payee: {} };
      if (t.expense_category_id) g.exp[t.expense_category_id] = (g.exp[t.expense_category_id] || 0) + 1;
      if (t.income_category_id) g.inc[t.income_category_id] = (g.inc[t.income_category_id] || 0) + 1;
      if (t.payee_name) g.payee[t.payee_name] = (g.payee[t.payee_name] || 0) + 1;
      m.set(k, g);
    });
    const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return (t: Txn) => { const g = m.get(firstTwoWords(t.description)); return g ? { exp: top(g.exp), inc: top(g.inc), payee: top(g.payee) } : null; };
  }, [all]);

  const run = async (fn: () => PromiseLike<{ error: any; data?: any }>, ok: string) => {
    setBusy(true); const { error } = await fn(); setBusy(false);
    if (error) { toast.error(error.message); return false; } toast.success(ok); setPicked({}); reload(); return true;
  };
  const acceptHistory = (t: Txn, h: { exp: string | null; inc: string | null; payee: string | null }) =>
    run(() => supabase.from('bank_transactions').update(t.transaction_type === 'inflow'
      ? { income_category_id: h.inc, payee_name: h.payee || t.payee_name } : { expense_category_id: h.exp, payee_name: h.payee || t.payee_name }).eq('id', t.id), 'Suggestion applied');
  const openMatch = async (t: Txn) => {
    setMatchFor(t); setCands([]);
    const { data, error } = await supabase.rpc('fn_bill_candidates', { p_txn_id: t.id, p_days: 10 });
    if (error) toast.error(error.message); else setCands(data || []);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button disabled={busy} onClick={() => run(() => supabase.rpc('fn_apply_bank_rules', { p_account_id: accId }), 'Rules applied — suggestions added')} className={sel}>Apply rules to this account</button>
        <button disabled={busy || ids.length === 0} onClick={() => run(() => supabase.rpc('fn_accept_bank_suggestions', { p_ids: ids }), 'Suggestions accepted')} className={sel}>Accept suggestions ({ids.length})</button>
        <button disabled={busy || ids.length === 0} onClick={() => run(() => supabase.rpc('fn_bank_exclude', { p_ids: ids, p_exclude: true, p_reason: 'Excluded in bulk' }), 'Excluded')} className={sel}>Exclude selected ({ids.length})</button>
        <label className="text-sm text-gray-600 inline-flex items-center gap-1"><input type="checkbox" checked={rows.length > 0 && ids.length === rows.length} onChange={e => setPicked(e.target.checked ? Object.fromEntries(rows.map(r => [r.id, true])) : {})} /> Select all</label>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2"></th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className={th}>Money in</th><th className={th}>Money out</th><th className="px-3 py-2">Suggestion</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>
            {rows.slice(0, 400).map(t => {
              const h = !t.suggested_rule_id && !t.expense_category_id && !t.income_category_id ? history(t) : null;
              const hasH = h && (t.transaction_type === 'inflow' ? h.inc : h.exp);
              return (
                <tr key={t.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2"><input type="checkbox" checked={!!picked[t.id]} onChange={e => setPicked({ ...picked, [t.id]: e.target.checked })} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{t.transaction_date}</td>
                  <td className="px-3 py-2 max-w-[320px]">{t.description}<span className="block text-[11px] text-gray-400">{t.reference_number}{t.payee_name ? ` • ${t.payee_name}` : ''}</span></td>
                  <td className={th + ' text-green-700'}>{t.transaction_type === 'inflow' ? inr(t.amount) : ''}</td>
                  <td className={th + ' text-red-600'}>{t.transaction_type === 'outflow' ? inr(t.amount) : ''}</td>
                  <td className="px-3 py-2 text-xs">
                    {t.suggested_rule_id && <span className="inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">auto-sorted: {t.suggested_action === 'transfer' ? 'transfer to ' + (accs.find(a => a.id === t.suggested_transfer_account_id)?.name || '') : catName(t, t.transaction_type === 'inflow' ? t.suggested_income_category_id : t.suggested_expense_category_id) || 'rule'}{t.suggested_payee ? ` • ${t.suggested_payee}` : ''}</span>}
                    {hasH && h && <span className="inline-block px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">from history: {catName(t, t.transaction_type === 'inflow' ? h.inc : h.exp)}{h.payee ? ` • ${h.payee}` : ''}</span>}
                    {(t.expense_category_id || t.income_category_id) && <span className="block text-gray-500">category set: {catName(t, t.transaction_type === 'inflow' ? t.income_category_id : t.expense_category_id)}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs space-x-2 whitespace-nowrap">
                    {t.suggested_rule_id && <button onClick={() => run(() => supabase.rpc('fn_accept_bank_suggestions', { p_ids: [t.id] }), 'Accepted')} className="text-purple-700 font-semibold">Accept</button>}
                    {hasH && h && <button onClick={() => acceptHistory(t, h)} className="text-sky-700 font-semibold">Use</button>}
                    {t.transaction_type === 'outflow' && <button onClick={() => openMatch(t)} className="text-blue-600 font-semibold">Match bill</button>}
                    <button onClick={() => { setXferFor(t); setXferTo(''); }} className="text-gray-700 font-semibold">Transfer</button>
                    <button onClick={() => openRuleFrom(t)} className="text-gray-700 font-semibold">Rule</button>
                    <button onClick={() => run(() => supabase.rpc('fn_bank_exclude', { p_ids: [t.id], p_exclude: true, p_reason: null }), 'Excluded')} className="text-red-600 font-semibold">Exclude</button>
                  </td>
                </tr>);
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-gray-400">Nothing to review for this account.</td></tr>}
          </tbody>
        </table>
        {rows.length > 400 && <p className="px-3 py-2 text-xs text-gray-400">First 400 of {rows.length} shown.</p>}
      </div>

      {matchFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMatchFor(null)}>
          <div className="bg-white rounded-md w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">Match {inr(matchFor.amount)} to a bill</h2>
            <p className="text-xs text-gray-500">Bills within 10 days of {matchFor.transaction_date} with at least this much left to pay. Matching records the payment on the bill. An amount smaller than the bill is a part payment.</p>
            {cands.length === 0 ? <p className="text-sm text-gray-400">No matching bill found.</p> : cands.map((c: any) => (
              <div key={c.bill_id} className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded-md text-sm">
                <div><p className="font-semibold">{c.vendor_name} — {c.bill_number}</p><p className="text-xs text-gray-500">bill {c.bill_date} • {inr(Number(c.balance))} open {c.exact ? '• exact match' : '• part payment'}</p></div>
                <button disabled={busy} onClick={async () => { if (await run(() => supabase.rpc('fn_match_bank_to_bill', { p_txn_id: matchFor.id, p_bill_id: c.bill_id }), 'Matched and paid')) setMatchFor(null); }} className="px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-semibold">Match</button>
              </div>))}
            <button onClick={() => setMatchFor(null)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">Close</button>
          </div>
        </div>)}

      {xferFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setXferFor(null)}>
          <div className="bg-white rounded-md w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">Record as transfer</h2>
            <p className="text-xs text-gray-500">{xferFor.transaction_type === 'inflow' ? 'Money came in from' : 'Money went out to'} another of your own accounts. It is not income or expense.</p>
            <select value={xferTo} onChange={e => setXferTo(e.target.value)} className={sel + ' w-full'}><option value="">Other account…</option>{accs.filter(a => a.id !== xferFor.bank_account_id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <div className="flex gap-2"><button onClick={() => setXferFor(null)} className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm">Cancel</button>
              <button disabled={!xferTo || busy} onClick={async () => { if (await run(() => supabase.rpc('fn_bank_mark_transfer', { p_id: xferFor.id, p_other_account: xferTo }), 'Marked as transfer')) setXferFor(null); }} className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50">Save</button></div>
          </div>
        </div>)}
    </div>
  );
}

// ───────── Added / Excluded lists ─────────
function Simple({ rows, accs, expCats, incCats, kind, reload }: { rows: Txn[]; accs: Acc[]; expCats: Cat[]; incCats: Cat[]; kind: 'added' | 'excluded'; reload: () => void }) {
  const restore = async (id: string) => {
    const { error } = await supabase.rpc('fn_bank_exclude', { p_ids: [id], p_exclude: false });
    if (error) toast.error(error.message); else { toast.success('Restored'); reload(); }
  };
  const label = (t: Txn) => t.is_transfer ? 'Transfer' + (t.transfer_account_id ? ' ↔ ' + (accs.find(a => a.id === t.transfer_account_id)?.name || '') : '')
    : t.matched_bill_id ? 'Bill payment' : (t.transaction_type === 'inflow' ? incCats : expCats).find(c => c.id === (t.transaction_type === 'inflow' ? t.income_category_id : t.expense_category_id))?.name || 'Added';
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className={th}>In</th><th className={th}>Out</th><th className="px-3 py-2">{kind === 'added' ? 'Booked as' : 'Reason'}</th><th className="px-3 py-2"></th></tr></thead>
        <tbody>
          {rows.slice(0, 400).map(t => (
            <tr key={t.id} className="border-t border-gray-100">
              <td className="px-3 py-2 whitespace-nowrap">{t.transaction_date}</td><td className="px-3 py-2">{t.description}</td>
              <td className={th}>{t.transaction_type === 'inflow' ? inr(t.amount) : ''}</td><td className={th}>{t.transaction_type === 'outflow' ? inr(t.amount) : ''}</td>
              <td className="px-3 py-2 text-xs text-gray-600">{kind === 'added' ? label(t) : t.excluded_reason || ''}</td>
              <td className="px-3 py-2">{kind === 'excluded' && <button onClick={() => restore(t.id)} className="text-blue-600 text-xs font-semibold">Restore</button>}</td>
            </tr>))}
          {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">Nothing here.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ───────── 4.3 rules ─────────
function Rules({ rules, accs, expCats, incCats, draft, setDraft, accId, reload }: { rules: Rule[]; accs: Acc[]; expCats: Cat[]; incCats: Cat[]; draft: Partial<Rule> | null; setDraft: (r: Partial<Rule> | null) => void; accId: string; reload: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => { (async () => { const m: Record<string, number> = {}; for (const r of rules) { const { data } = await supabase.rpc('fn_rule_match_count', { p_rule_id: r.id }); m[r.id] = Number(data) || 0; } setCounts(m); })(); }, [rules]);

  const save = async () => {
    if (!draft) return;
    if (!draft.name?.trim()) return toast.error('Give the rule a name');
    const conds = (draft.conditions || []).filter(c => String(c.value).trim() !== '');
    if (conds.length === 0) return toast.error('Add at least one condition');
    const { data: { user } } = await supabase.auth.getUser();
    const body: any = { name: draft.name.trim(), direction: draft.direction || 'both', bank_account_id: draft.bank_account_id || null, match_mode: draft.match_mode || 'all', conditions: conds,
      action: draft.action || 'categorize', expense_category_id: draft.action === 'transfer' ? null : draft.expense_category_id || null, income_category_id: draft.action === 'transfer' ? null : draft.income_category_id || null,
      transfer_account_id: draft.action === 'transfer' ? draft.transfer_account_id || null : null, payee_name: draft.payee_name || null, memo: draft.memo || null, is_active: draft.is_active !== false };
    const res = draft.id ? await supabase.from('bank_rules').update(body).eq('id', draft.id) : await supabase.from('bank_rules').insert({ ...body, sort_order: (rules[rules.length - 1]?.sort_order ?? 0) + 1, created_by: user?.id });
    if (res.error) { toast.error(res.error.message); return; } toast.success('Rule saved'); setDraft(null); reload();
  };
  const move = async (i: number, d: -1 | 1) => {
    const a = rules[i], b = rules[i + d]; if (!a || !b) return;
    await Promise.all([supabase.from('bank_rules').update({ sort_order: b.sort_order }).eq('id', a.id), supabase.from('bank_rules').update({ sort_order: a.sort_order }).eq('id', b.id)]);
    // equal sort_orders would not swap, so renumber when needed
    if (a.sort_order === b.sort_order) await Promise.all(rules.map((r, k) => supabase.from('bank_rules').update({ sort_order: k + (k === i ? d : k === i + d ? -d : 0) }).eq('id', r.id)));
    reload();
  };
  const toggle = async (r: Rule) => { await supabase.from('bank_rules').update({ is_active: !r.is_active }).eq('id', r.id); reload(); };
  const del = async (r: Rule) => { const { error } = await supabase.from('bank_rules').delete().eq('id', r.id); if (error) toast.error(error.message); else reload(); };
  const setCond = (i: number, patch: any) => setDraft({ ...draft, conditions: (draft?.conditions || []).map((c, k) => k === i ? { ...c, ...patch } : c) });
  const catLabel = (r: Rule) => r.action === 'transfer' ? 'Transfer → ' + (accs.find(a => a.id === r.transfer_account_id)?.name || '?') : (expCats.find(c => c.id === r.expense_category_id) || incCats.find(c => c.id === r.income_category_id))?.name || 'Categorise';

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center"><p className="text-sm text-gray-500">Rules run top to bottom; the first match wins. A rule only <b>suggests</b> a category — it never adds or verifies a line.</p>
        <button onClick={() => setDraft({ name: '', direction: 'both', match_mode: 'all', action: 'categorize', is_active: true, conditions: [{ field: 'description', op: 'contains', value: '' }] })} className={sel}>New rule</button></div>

      {draft && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <input placeholder="Rule name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} className={sel + ' sm:col-span-2'} />
            <select value={draft.direction || 'both'} onChange={e => setDraft({ ...draft, direction: e.target.value as any })} className={sel}><option value="both">Money in and out</option><option value="in">Money in</option><option value="out">Money out</option></select>
            <select value={draft.bank_account_id || ''} onChange={e => setDraft({ ...draft, bank_account_id: e.target.value || null })} className={sel}><option value="">All accounts</option>{accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </div>
          <div className="space-y-2">
            <div className="text-sm">Match <select value={draft.match_mode || 'all'} onChange={e => setDraft({ ...draft, match_mode: e.target.value as any })} className={sel}><option value="all">all</option><option value="any">any</option></select> of these:</div>
            {(draft.conditions || []).map((c, i) => (
              <div key={i} className="flex gap-2 flex-wrap">
                <select value={c.field} onChange={e => setCond(i, { field: e.target.value, op: e.target.value === 'amount' ? 'equals' : 'contains' })} className={sel}><option value="description">Description</option><option value="amount">Amount</option></select>
                <select value={c.op} onChange={e => setCond(i, { op: e.target.value })} className={sel}>
                  {c.field === 'amount' ? (<><option value="equals">equals</option><option value="more">is more than</option><option value="less">is less than</option></>) : (<><option value="contains">contains</option><option value="not_contains">does not contain</option><option value="is">is</option><option value="starts_with">starts with</option></>)}
                </select>
                <input value={c.value} onChange={e => setCond(i, { value: e.target.value })} className={sel + ' flex-1 min-w-[120px]'} />
                <button onClick={() => setDraft({ ...draft, conditions: (draft.conditions || []).filter((_, k) => k !== i) })} className="text-red-600 text-sm">Remove</button>
              </div>))}
            <button onClick={() => setDraft({ ...draft, conditions: [...(draft.conditions || []), { field: 'description', op: 'contains', value: '' }] })} className="text-sm text-blue-600 font-semibold">+ Add condition</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <select value={draft.action || 'categorize'} onChange={e => setDraft({ ...draft, action: e.target.value as any })} className={sel}><option value="categorize">Suggest a category</option><option value="transfer">Suggest a transfer</option></select>
            {draft.action === 'transfer' ? (
              <select value={draft.transfer_account_id || ''} onChange={e => setDraft({ ...draft, transfer_account_id: e.target.value || null })} className={sel + ' sm:col-span-3'}><option value="">Other account…</option>{accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            ) : (<>
              {draft.direction !== 'in' && <select value={draft.expense_category_id || ''} onChange={e => setDraft({ ...draft, expense_category_id: e.target.value || null })} className={sel}><option value="">Expense category…</option>{expCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
              {draft.direction !== 'out' && <select value={draft.income_category_id || ''} onChange={e => setDraft({ ...draft, income_category_id: e.target.value || null })} className={sel}><option value="">Income category…</option>{incCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
              <input placeholder="Payee (optional)" value={draft.payee_name || ''} onChange={e => setDraft({ ...draft, payee_name: e.target.value })} className={sel} />
              <input placeholder="Memo (optional)" value={draft.memo || ''} onChange={e => setDraft({ ...draft, memo: e.target.value })} className={sel} />
            </>)}
          </div>
          <div className="flex gap-2"><button onClick={save} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold">Save rule</button><button onClick={() => setDraft(null)} className="px-4 py-2 border border-gray-200 rounded-md text-sm">Cancel</button></div>
        </div>)}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Rule</th><th className="px-3 py-2">Does</th><th className={th}>Matching now</th><th className="px-3 py-2">Active</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id} className={`border-t border-gray-100 ${r.is_active ? '' : 'opacity-50'}`}>
                <td className="px-3 py-2 whitespace-nowrap"><button onClick={() => move(i, -1)} disabled={i === 0}>▲</button> <button onClick={() => move(i, 1)} disabled={i === rules.length - 1}>▼</button></td>
                <td className="px-3 py-2">{r.name}<span className="block text-[11px] text-gray-400">{r.direction === 'in' ? 'money in' : r.direction === 'out' ? 'money out' : 'in & out'} • {r.conditions.map(c => `${c.field} ${c.op.replace('_', ' ')} ${c.value}`).join(r.match_mode === 'all' ? ' AND ' : ' OR ')}</span></td>
                <td className="px-3 py-2">{catLabel(r)}{r.payee_name ? ` • ${r.payee_name}` : ''}</td>
                <td className={th}>{counts[r.id] ?? '…'}</td>
                <td className="px-3 py-2"><input type="checkbox" checked={r.is_active} onChange={() => toggle(r)} /></td>
                <td className="px-3 py-2 text-xs space-x-2 whitespace-nowrap"><button onClick={() => setDraft(r)} className="text-blue-600 font-semibold">Edit</button><button onClick={() => del(r)} className="text-red-600 font-semibold">Delete</button></td>
              </tr>))}
            {rules.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">No rules yet. Use “Rule” on a line, or “New rule”.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────── 4.1 import (file + paste) ─────────
function Import({ accId, accName, existing, closing, reload }: { accId: string; accName: string; existing: Txn[]; closing: string | null; reload: () => void }) {
  const [rows, setRows] = useState<(string | number | Date | null)[][]>([]);
  const [paste, setPaste] = useState('');
  const [fileName, setFileName] = useState('');
  const [m, setM] = useState<Mapping>({ date: 0, desc: 1, ref: 2, debit: 4, credit: 5, amount: -1, invert: false, style: 'dmy', hasHeader: true });
  const [applyRules, setApplyRules] = useState(true);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | null) => {
    if (!f) return; setFileName(f.name);
    try {
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        setRows((XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]).filter(r => r.some(c => String(c).trim() !== '')));
      } else {
        setRows(parseText(await f.text()));
      }
    } catch (e: any) { toast.error('Could not read the file: ' + (e.message || e)); }
  };
  const rawRows = rows.length ? rows : paste.trim() ? parseText(paste) : [];
  const cols = Math.max(0, ...rawRows.slice(0, 20).map(r => r.length));
  const head = rawRows[0] || [];
  const colLabel = (i: number) => `${i + 1}${m.hasHeader && head[i] ? ' – ' + String(head[i]).slice(0, 18) : ''}`;

  const lines = useMemo(() => mapRows(rawRows, m), [rawRows, m]);
  const keys = useMemo(() => new Set(existing.map(t => lineKey(t.bank_account_id, t.transaction_date, t.transaction_type, Number(t.amount), t.description || '', t.reference_number || ''))), [existing]);
  const seen = new Set<string>();
  const tagged = lines.map(l => {
    if (l.error) return { l, status: 'Skipped: ' + l.error };
    const k = lineKey(accId, l.date!, l.type!, l.amount, l.description, l.reference);
    if (closing && l.date! <= closing) return { l, status: 'Skipped: books closed' };
    if (keys.has(k)) return { l, status: 'Duplicate' };
    if (seen.has(k)) return { l, status: 'Duplicate (in file)' };
    seen.add(k); return { l, status: 'New' };
  });
  const fresh = tagged.filter(t => t.status === 'New');

  const doImport = async () => {
    if (!accId) return toast.error('Choose an account first'); if (fresh.length === 0) return toast.error('Nothing new to import');
    setBusy(true);
    const payload = fresh.map(({ l }) => ({ bank_account_id: accId, transaction_date: l.date, transaction_type: l.type, amount: l.amount, description: l.description || null, reference_number: l.reference || null }));
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase.from('bank_transactions').insert(payload.slice(i, i + 200));
      if (error) { setBusy(false); toast.error(`Stopped after ${i} lines: ${error.message}`); reload(); return; }
    }
    if (applyRules) await supabase.rpc('fn_apply_bank_rules', { p_account_id: accId });
    setBusy(false); toast.success(`Imported ${payload.length} lines${applyRules ? ' and suggested categories from rules' : ''}`);
    setRows([]); setPaste(''); setFileName(''); reload();
  };

  const colSel = (label: string, key: keyof Mapping, none = true) => (
    <label className="text-xs text-gray-500">{label}<select value={m[key] as number} onChange={e => setM({ ...m, [key]: Number(e.target.value) })} className={sel + ' block w-full mt-0.5'}>
      {none && <option value={-1}>— none —</option>}{Array.from({ length: cols }, (_, i) => <option key={i} value={i}>{colLabel(i)}</option>)}</select></label>);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Importing into <b>{accName || '—'}</b>. Lines already in the books are skipped. {closing ? `Lines dated on or before ${closing} are skipped (books closed).` : ''}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <label className={sel + ' inline-flex items-center gap-1 cursor-pointer'}><Upload size={14} /> Choose CSV / Excel file<input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={e => { onFile(e.target.files?.[0] || null); e.target.value = ''; }} /></label>
        {fileName && <span className="text-sm text-gray-600">{fileName}</span>}
      </div>
      <textarea value={paste} onChange={e => { setPaste(e.target.value); setRows([]); }} rows={3} placeholder="…or paste rows copied from Excel here" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono" />
      {rawRows.length > 0 && (<>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 bg-white border border-gray-200 rounded-lg p-3">
          {colSel('Date', 'date', false)}{colSel('Description', 'desc', false)}{colSel('Reference', 'ref')}{colSel('Withdrawal', 'debit')}{colSel('Deposit', 'credit')}{colSel('Single amount column', 'amount')}
          <label className="text-xs text-gray-500">Date style<select value={m.style} onChange={e => setM({ ...m, style: e.target.value as any })} className={sel + ' block w-full mt-0.5'}><option value="dmy">Day / Month / Year</option><option value="mdy">Month / Day / Year</option></select></label>
          <div className="text-xs text-gray-600 space-y-1"><label className="block"><input type="checkbox" checked={m.hasHeader} onChange={e => setM({ ...m, hasHeader: e.target.checked })} /> First row is a heading</label><label className="block"><input type="checkbox" checked={m.invert} onChange={e => setM({ ...m, invert: e.target.checked })} /> Swap money in / out</label></div>
        </div>
        <p className="text-sm"><b>{fresh.length}</b> new · {tagged.filter(t => t.status.startsWith('Duplicate')).length} duplicates · {tagged.filter(t => t.status.startsWith('Skipped')).length} skipped · {tagged.length} rows read. With a single amount column, a minus sign means money out.</p>
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto max-h-80">
          <table className="w-full text-sm"><thead className="text-left text-xs text-gray-500 uppercase sticky top-0 bg-white"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className={th}>In</th><th className={th}>Out</th><th className="px-3 py-2">Status</th></tr></thead>
            <tbody>{tagged.slice(0, 100).map(({ l, status }) => (
              <tr key={l.row} className="border-t border-gray-100"><td className="px-3 py-1.5">{l.row}</td><td className="px-3 py-1.5">{l.date || '—'}</td><td className="px-3 py-1.5">{l.description}</td>
                <td className={th}>{l.type === 'inflow' ? inr(l.amount) : ''}</td><td className={th}>{l.type === 'outflow' ? inr(l.amount) : ''}</td>
                <td className={`px-3 py-1.5 text-xs ${status === 'New' ? 'text-green-700' : 'text-gray-500'}`}>{status}</td></tr>))}</tbody></table>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <label className="text-sm"><input type="checkbox" checked={applyRules} onChange={e => setApplyRules(e.target.checked)} /> Suggest categories from my rules after import</label>
          <button onClick={doImport} disabled={busy || fresh.length === 0} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold disabled:opacity-50">{busy ? 'Importing…' : `Import ${fresh.length} new lines`}</button>
        </div>
      </>)}
    </div>
  );
}

export default function BankingNewPage() { return (<AdminOnlyGate><Inner /></AdminOnlyGate>); }
