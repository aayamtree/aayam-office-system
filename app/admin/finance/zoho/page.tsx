'use client';

// /admin/finance/zoho — invoices & quotes synced from Zoho Books.
//
// Zoho is the source of truth (it holds the HDFC bank feed). This page is a
// read-only mirror fed by /api/zoho/webhook; nothing here edits Zoho.

import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { RefreshCw, Loader2, FileText, Receipt, ExternalLink, ChevronRight, ChevronDown, Landmark, History } from 'lucide-react';

// Zoho sends ~250 fields per document; these are the ones worth showing.
interface ZohoLineItem {
  name?: string;
  description?: string;
  hsn_or_sac?: string;
  quantity?: number;
  rate?: number;
  item_total?: number;
  tax_name?: string;
  tax_percentage?: number;
}

interface ZohoTxn {
  id: string;
  zoho_transaction_id: string;
  txn_date: string | null;
  amount: number | null;
  debit_or_credit: string | null;
  transaction_type: string | null;
  status: string | null;
  is_categorized: boolean | null;
  description: string | null;
  reference_number: string | null;
  payee: string | null;
  account_name: string | null;
  offset_account_name: string | null;
}

interface SyncRun {
  ran_at: string;
  ok: boolean;
  fetched: number | null;
  message: string | null;
}

interface ZohoDoc {
  id: string;
  doc_type: 'invoice' | 'estimate';
  zoho_id: string;
  doc_number: string | null;
  customer_name: string | null;
  doc_date: string | null;
  due_date: string | null;
  status: string | null;
  sub_total: number | null;
  tax_total: number | null;
  total: number | null;
  balance: number | null;
  line_items: ZohoLineItem[] | null;
  last_synced_at: string;
}

const inr = (n: number | null) =>
  n === null ? '—' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-600',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  invoiced: 'bg-green-100 text-green-700',
};

export default function ZohoDocumentsPage() {
  const [docs, setDocs] = useState<ZohoDoc[]>([]);
  const [txns, setTxns] = useState<ZohoTxn[]>([]);
  const [lastSync, setLastSync] = useState<SyncRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'invoice' | 'estimate' | 'bank'>('invoice');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    const [docsRes, txnRes, runRes] = await Promise.all([
      supabase
        .from('zoho_documents')
        .select('id, doc_type, zoho_id, doc_number, customer_name, doc_date, due_date, status, sub_total, tax_total, total, balance, line_items, last_synced_at')
        .order('doc_date', { ascending: false })
        .limit(500),
      supabase
        .from('zoho_bank_transactions')
        .select('id, zoho_transaction_id, txn_date, amount, debit_or_credit, transaction_type, status, is_categorized, description, reference_number, payee, account_name, offset_account_name')
        .order('txn_date', { ascending: false })
        .limit(500),
      supabase
        .from('zoho_sync_runs')
        .select('ran_at, ok, fetched, message')
        .eq('kind', 'bank')
        .order('ran_at', { ascending: false })
        .limit(1),
    ]);

    if (docsRes.error) setError(docsRes.error.message);
    else setDocs((docsRes.data as ZohoDoc[]) || []);

    // The bank tables only exist after the banking migration; a missing table
    // must not blank out the invoices the page already showed fine.
    if (!txnRes.error) setTxns((txnRes.data as ZohoTxn[]) || []);
    if (!runRes.error) setLastSync(((runRes.data || [])[0] as SyncRun) || null);

    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  // One-off historical pull. Chunked server-side (line items cost one call each),
  // so keep calling until it reports nothing remaining.
  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      let rounds = 0;
      let last: Record<string, unknown> | null = null;
      while (rounds < 15) {
        const res = await fetch('/api/zoho/backfill', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          setBackfillMsg({ ok: false, text: json?.error || 'Backfill failed.' });
          setBackfilling(false);
          return;
        }
        last = json;
        rounds += 1;
        if (!json.remaining_without_line_items) break;
      }
      const inv = Number(last?.invoices ?? 0);
      const est = Number(last?.estimates ?? 0);
      const bank = Number(last?.banktransactions ?? 0);
      setBackfillMsg({
        ok: true,
        text: `Fetched from ${last?.from}: ${inv} invoices, ${est} quotes, ${bank} bank transactions. ${last?.note ?? ''}`,
      });
      await fetchDocs();
    } catch {
      setBackfillMsg({ ok: false, text: 'Could not reach the server.' });
    }
    setBackfilling(false);
  };

  const shown = docs.filter(d => d.doc_type === tab);
  const invoiceCount = docs.filter(d => d.doc_type === 'invoice').length;
  const estimateCount = docs.filter(d => d.doc_type === 'estimate').length;
  const outstanding = docs
    .filter(d => d.doc_type === 'invoice' && (d.balance || 0) > 0)
    .reduce((sum, d) => sum + (d.balance || 0), 0);

  const moneyIn = txns
    .filter(t => t.debit_or_credit === 'credit')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const moneyOut = txns
    .filter(t => t.debit_or_credit === 'debit')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const uncategorised = txns.filter(t => t.is_categorized === false).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zoho Books</h1>
          <p className="text-sm text-gray-500 mt-1">
            Invoices &amp; quotes made in Zoho, mirrored here automatically. Zoho is the source of truth.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runBackfill}
            disabled={backfilling}
            title="One-off: pull this financial year's invoices, quotes and bank lines from Zoho"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
            {backfilling ? 'Fetching…' : 'Fetch this FY from Zoho'}
          </button>
          <button
            onClick={fetchDocs}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {backfillMsg && (
        <div className={`text-sm rounded-md p-4 border ${backfillMsg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {backfillMsg.text}
        </div>
      )}

      {tab === 'bank' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Money in (60 days)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{inr(moneyIn)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Money out (60 days)</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{inr(moneyOut)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Not yet categorised</p>
            <p className={`text-2xl font-bold mt-1 ${uncategorised > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {uncategorised}
            </p>
            {uncategorised > 0 && (
              <p className="text-xs text-gray-500 mt-1">Categorise these in Zoho</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Invoices synced</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{invoiceCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Quotes synced</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{estimateCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">Outstanding (Zoho)</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{inr(outstanding)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('invoice')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${tab === 'invoice' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
        >
          <Receipt className="w-4 h-4" /> Invoices
        </button>
        <button
          onClick={() => setTab('estimate')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${tab === 'estimate' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
        >
          <FileText className="w-4 h-4" /> Quotes
        </button>
        <button
          onClick={() => setTab('bank')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${tab === 'bank' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
        >
          <Landmark className="w-4 h-4" /> Bank Feed
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-4">
          Could not load Zoho documents: {error}
        </div>
      )}

      {tab === 'bank' ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : txns.length === 0 ? (
            <div className="text-center py-16 px-6">
              <p className="text-gray-500 font-medium">No bank transactions yet</p>
              <p className="text-sm text-gray-400 mt-2 max-w-lg mx-auto">
                Once Zoho Books is connected, the HDFC feed syncs here twice a day —
                with whatever category you gave each line in Zoho. Nothing to download or paste.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3 text-right">Out</th>
                    <th className="px-4 py-3 text-right">In</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map(t => (
                    <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {t.txn_date ? formatDate(t.txn_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900">{t.description || t.transaction_type || '—'}</span>
                        {(t.payee || t.reference_number) && (
                          <span className="block text-xs text-gray-500">
                            {[t.payee, t.reference_number].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.offset_account_name ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {t.offset_account_name}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            uncategorised
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t.account_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {t.debit_or_credit === 'debit' ? inr(t.amount) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {t.debit_or_credit === 'credit' ? inr(t.amount) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-gray-500 font-medium">Nothing synced yet</p>
            <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
              When you create or edit {tab === 'invoice' ? 'an invoice' : 'a quote'} in Zoho Books,
              it will appear here within a few seconds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                  <th className="px-2 py-3 w-8"></th>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">{tab === 'invoice' ? 'Due' : 'Expires'}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  {tab === 'invoice' && <th className="px-4 py-3 text-right">Balance</th>}
                </tr>
              </thead>
              <tbody>
                {shown.map(doc => {
                  const open = openRow === doc.id;
                  const items = Array.isArray(doc.line_items) ? doc.line_items : [];
                  return (
                  <Fragment key={doc.id}>
                  <tr
                    onClick={() => setOpenRow(open ? null : doc.id)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-2 py-3 text-gray-400">
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{doc.doc_number || doc.zoho_id}</td>
                    <td className="px-4 py-3 text-gray-700">{doc.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{doc.doc_date ? formatDate(doc.doc_date) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{doc.due_date ? formatDate(doc.due_date) : '—'}</td>
                    <td className="px-4 py-3">
                      {doc.status ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[doc.status] || 'bg-gray-100 text-gray-600'}`}>
                          {doc.status.replace(/_/g, ' ')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{inr(doc.total)}</td>
                    {tab === 'invoice' && (
                      <td className={`px-4 py-3 text-right font-semibold ${(doc.balance || 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {inr(doc.balance)}
                      </td>
                    )}
                  </tr>
                  {open && (
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td colSpan={tab === 'invoice' ? 8 : 7} className="px-6 py-4">
                        {items.length === 0 ? (
                          <p className="text-sm text-gray-500">No line items in this document.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-500 uppercase">
                                <th className="py-2 pr-4">Item</th>
                                <th className="py-2 pr-4">HSN/SAC</th>
                                <th className="py-2 pr-4 text-right">Qty</th>
                                <th className="py-2 pr-4 text-right">Rate</th>
                                <th className="py-2 pr-4">Tax</th>
                                <th className="py-2 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, i) => (
                                <tr key={i} className="border-t border-gray-200">
                                  <td className="py-2 pr-4">
                                    <span className="font-medium text-gray-900">{item.name || '—'}</span>
                                    {item.description && (
                                      <span className="block text-gray-500">{item.description}</span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-4 text-gray-600">{item.hsn_or_sac || '—'}</td>
                                  <td className="py-2 pr-4 text-right text-gray-600">
                                    {item.quantity?.toLocaleString('en-IN') ?? '—'}
                                  </td>
                                  <td className="py-2 pr-4 text-right text-gray-600">{inr(item.rate ?? null)}</td>
                                  <td className="py-2 pr-4 text-gray-600">
                                    {item.tax_name ? `${item.tax_name} ${item.tax_percentage ?? ''}%` : '—'}
                                  </td>
                                  <td className="py-2 text-right font-medium text-gray-900">
                                    {inr(item.item_total ?? null)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <div className="flex flex-wrap gap-x-8 gap-y-1 mt-4 pt-3 border-t border-gray-200 text-xs">
                          <span className="text-gray-500">Subtotal <span className="text-gray-900 font-medium ml-1">{inr(doc.sub_total)}</span></span>
                          <span className="text-gray-500">Tax <span className="text-gray-900 font-medium ml-1">{inr(doc.tax_total)}</span></span>
                          <span className="text-gray-500">Total <span className="text-gray-900 font-semibold ml-1">{inr(doc.total)}</span></span>
                          <span className="text-gray-400 ml-auto">
                            Synced {new Date(doc.last_synced_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          {tab === 'bank'
            ? 'Categorise transactions in Zoho — the category follows them here.'
            : 'To edit any document, open it in Zoho Books — changes sync back here automatically.'}
        </span>
        {tab === 'bank' && (
          <span className="ml-auto">
            {lastSync
              ? lastSync.ok
                ? `Last sync ${new Date(lastSync.ran_at).toLocaleString('en-IN')} · ${lastSync.fetched ?? 0} lines`
                : `Last sync FAILED ${new Date(lastSync.ran_at).toLocaleString('en-IN')}${lastSync.message ? ' — ' + lastSync.message : ''}`
              : 'Never synced yet'}
          </span>
        )}
      </div>
    </div>
  );
}
