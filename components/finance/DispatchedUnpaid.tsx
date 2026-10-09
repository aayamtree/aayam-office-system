'use client';

// ─────────────────────────────────────────────────────────────
// Goods gone, money not in.
//
// Dispatch releases consignments before payment for recurring work
// and long-standing clients — that is intentional. The gap was that
// nothing counted the days afterwards. This list does, from the
// dispatch date, and it is the same data the daily Telegram brief
// sends, so the screen and the message can never disagree.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  getPendingPayments, bucketFor, inr,
  type PendingPayment, type PendingPaymentsSnapshot,
} from '@/lib/pending-payments';
import { Truck, Building2, Loader2, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { matchesQuery } from '@/lib/page-search';

function ageClass(days: number): string {
  if (days > 60) return 'bg-red-50 border-l-red-600';
  if (days > 30) return 'bg-orange-50 border-l-orange-500';
  if (days > 15) return 'bg-amber-50 border-l-amber-400';
  return 'bg-white border-l-emerald-400';
}

function ageBadge(days: number): string {
  if (days > 60) return 'bg-red-600 text-white';
  if (days > 30) return 'bg-orange-500 text-white';
  if (days > 15) return 'bg-amber-400 text-white';
  return 'bg-emerald-100 text-emerald-700';
}

export default function DispatchedUnpaid({ query = '' }: { query?: string }) {
  const [snap, setSnap] = useState<PendingPaymentsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [filterBucket, setFilterBucket] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnap(await getPendingPayments(supabase));
    } catch (e: any) {
      // Say so. A silent empty list here reads as "everyone has paid".
      setError(e?.message || 'Could not load dispatched-unpaid jobs.');
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (job: PendingPayment) => {
    setSaving(job.id);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: job.total_amount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to mark paid');
      setSnap(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== job.id) } : prev);
    } catch (e: any) {
      setError(e?.message || 'Failed to mark paid');
    } finally {
      setSaving(null);
    }
  };

  const q = query.trim();
  const items = (snap?.items.filter(i => !filterBucket || i.bucket === filterBucket) || [])
    .filter(i => !q || matchesQuery([i.job_number, i.project_name, i.client_name, i.invoice_reference, i.client_ref_no], q));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-700" />
            Dispatched &amp; Unpaid
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Counting from the day the goods left, not from the invoice date.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border rounded-md px-3 py-1.5 hover:bg-gray-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : !snap || snap.items.length === 0 ? (
        <div className="bg-white border rounded-lg py-8 text-center">
          <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">Nothing dispatched is unpaid.</p>
        </div>
      ) : (
        <>
          {/* Ageing buckets — click to filter */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <button
              onClick={() => setFilterBucket(null)}
              className={`text-left bg-white border rounded-lg p-3 transition-all hover:shadow-sm ${!filterBucket ? 'ring-2 ring-gray-400' : 'opacity-80 hover:opacity-100'}`}
            >
              <p className="text-xl font-bold text-gray-900">{inr(snap.totalOutstanding)}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{snap.items.length} consignment{snap.items.length !== 1 ? 's' : ''}</p>
            </button>
            {snap.byBucket.map(({ bucket, count, value }) => (
              <button
                key={bucket.id}
                onClick={() => setFilterBucket(prev => prev === bucket.id ? null : bucket.id)}
                disabled={count === 0}
                className={`text-left bg-white border rounded-lg p-3 transition-all hover:shadow-sm disabled:opacity-40 disabled:cursor-default ${filterBucket === bucket.id ? 'ring-2 ring-gray-800' : ''}`}
              >
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{bucket.icon} {bucket.label}</p>
                {value > 0 && <p className="text-[11px] font-semibold text-gray-700 mt-0.5">{inr(value)}</p>}
              </button>
            ))}
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_1.5fr_1fr_110px_120px_120px] gap-0 border-b bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:grid">
              <span>Job</span>
              <span>Project / Client</span>
              <span>Invoice</span>
              <span>Since Dispatch</span>
              <span>Balance</span>
              <span />
            </div>
            <div className="divide-y">
              {items.map(job => (
                <div
                  key={job.id}
                  className={`border-l-4 ${ageClass(job.days_since_dispatch)} grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_110px_120px_120px] gap-2 md:gap-0 px-4 py-3 items-center hover:bg-black/[0.02]`}
                >
                  <div>
                    <Link href={`/admin/jobs/${job.id}`} className="font-mono text-xs font-bold text-gray-700 hover:underline">
                      {job.job_number || '—'}
                    </Link>
                    {job.dispatched_at && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        out {new Date(job.dispatched_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{job.project_name || '—'}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{job.client_name}</span>
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-mono text-gray-700 truncate">{job.invoice_reference || <span className="text-gray-300 italic font-sans">no invoice no.</span>}</p>
                    {job.client_ref_no && <p className="text-[10px] text-gray-400 truncate">their ref: {job.client_ref_no}</p>}
                  </div>

                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${ageBadge(job.days_since_dispatch)}`}>
                      {bucketFor(job.days_since_dispatch).icon} {job.days_since_dispatch}d
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-gray-900">{inr(job.balance)}</p>
                    {job.amount_received > 0 && (
                      <p className="text-[10px] text-emerald-600">{inr(job.amount_received)} received</p>
                    )}
                  </div>

                  <div className="flex md:justify-end">
                    <button
                      onClick={() => markPaid(job)}
                      disabled={saving === job.id}
                      className="flex items-center gap-1.5 text-sm font-medium bg-emerald-600 text-white rounded-md px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving === job.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Mark Paid
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
