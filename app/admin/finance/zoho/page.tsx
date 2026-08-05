'use client';

// /admin/finance/zoho — invoices & quotes synced from Zoho Books.
//
// Zoho is the source of truth (it holds the HDFC bank feed). This page is a
// read-only mirror fed by /api/zoho/webhook; nothing here edits Zoho.

import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { RefreshCw, Loader2, FileText, Receipt, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'invoice' | 'estimate'>('invoice');
  const [openRow, setOpenRow] = useState<string | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    const { data, error: qError } = await supabase
      .from('zoho_documents')
      .select('id, doc_type, zoho_id, doc_number, customer_name, doc_date, due_date, status, sub_total, tax_total, total, balance, line_items, last_synced_at')
      .order('doc_date', { ascending: false })
      .limit(500);
    if (qError) {
      setError(qError.message);
    } else {
      setDocs((data as ZohoDoc[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const shown = docs.filter(d => d.doc_type === tab);
  const invoiceCount = docs.filter(d => d.doc_type === 'invoice').length;
  const estimateCount = docs.filter(d => d.doc_type === 'estimate').length;
  const outstanding = docs
    .filter(d => d.doc_type === 'invoice' && (d.balance || 0) > 0)
    .reduce((sum, d) => sum + (d.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zoho Books</h1>
          <p className="text-sm text-gray-500 mt-1">
            Invoices &amp; quotes made in Zoho, mirrored here automatically. Zoho is the source of truth.
          </p>
        </div>
        <button
          onClick={fetchDocs}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

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

      <div className="flex gap-2">
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
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-4">
          Could not load Zoho documents: {error}
        </div>
      )}

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

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        To edit any document, open it in Zoho Books — changes sync back here automatically.
      </p>
    </div>
  );
}
