'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import DispatchedUnpaid from '@/components/finance/DispatchedUnpaid';
import {
  IndianRupee, Building2, User, RefreshCw, Loader2, CheckCircle2, Clock,
} from 'lucide-react';

interface PayJob {
  id: string;
  job_number: string;
  project_name: string;
  client_deadline: string | null;
  total_amount: number | null;
  client_id: string | null;
  designer_id: string | null;
  client_name: string;
  designer_name: string;
}

export default function AwaitingPaymentPage() {
  const [jobs, setJobs] = useState<PayJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      // Delivered DESIGN jobs (file handed to client) that are billable and not yet paid.
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_number, project_name, client_deadline, total_amount, client_id, designer_id, payment_status, design_billing, current_stage')
        .eq('current_stage', 'file_sent_client')
        .eq('design_billing', 'billable')
        .neq('payment_status', 'paid')
        .order('client_deadline', { ascending: true });
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) { setJobs([]); return; }

      const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter(Boolean)));
      const designerIds = Array.from(new Set(rows.map(r => r.designer_id).filter(Boolean)));
      const [clientsRes, designersRes] = await Promise.all([
        clientIds.length ? supabase.from('clients').select('id, name, company').in('id', clientIds) : Promise.resolve({ data: [] }),
        designerIds.length ? supabase.from('profiles').select('id, full_name').in('id', designerIds) : Promise.resolve({ data: [] }),
      ]);
      const clientMap: Record<string, string> = {};
      (clientsRes.data || []).forEach((c: any) => { clientMap[c.id] = c.company || c.name || '—'; });
      const designerMap: Record<string, string> = {};
      (designersRes.data || []).forEach((p: any) => { designerMap[p.id] = p.full_name || '—'; });

      setJobs(rows.map((j) => ({
        id: j.id,
        job_number: j.job_number,
        project_name: j.project_name,
        client_deadline: j.client_deadline,
        total_amount: j.total_amount,
        client_id: j.client_id,
        designer_id: j.designer_id,
        client_name: j.client_id ? (clientMap[j.client_id] || '—') : '—',
        designer_name: j.designer_id ? (designerMap[j.designer_id] || 'Unassigned') : 'Unassigned',
      })));
    } catch (e: any) {
      console.error('Error fetching awaiting-payment jobs:', e);
      setError('Could not load the list. Try Refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const markPaid = async (job: PayJob) => {
    setSaving(job.id);
    setError(null);
    try {
      const typed = amounts[job.id];
      const amount = typed !== undefined && typed !== '' ? Number(typed) : undefined;
      const res = await fetch(`/api/jobs/${job.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(amount !== undefined ? { amount } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to mark paid');
      // Drop it from the list optimistically.
      setJobs(prev => prev.filter(j => j.id !== job.id));
    } catch (e: any) {
      setError(e.message || 'Failed to mark paid');
    } finally {
      setSaving(null);
    }
  };

  const outstanding = useMemo(
    () => jobs.reduce((sum, j) => sum + (Number(j.total_amount) || 0), 0),
    [jobs]
  );
  const withAmount = jobs.filter(j => Number(j.total_amount) > 0).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-emerald-600" />
          Awaiting Payment
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Everything we have delivered that has not been paid for — print consignments and design files.
        </p>
      </div>

      {/* Print / production work that has already shipped. Listed first
          because the goods are gone: that money is at more risk than a
          design file we could still withhold. */}
      <DispatchedUnpaid />

      <hr className="border-gray-200" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            Design Files Sent
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Billable design jobs delivered to the client, waiting for payment. Mark paid to close.
          </p>
        </div>
        <button
          onClick={fetchJobs}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border rounded-md px-3 py-1.5 hover:bg-gray-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Jobs awaiting payment</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
          <p className="text-2xl font-bold text-emerald-700">₹{outstanding.toLocaleString('en-IN')}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Known outstanding ({withAmount} with amount)</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
          <p className="text-2xl font-bold text-amber-600">{jobs.length - withAmount}</p>
          <p className="text-xs text-amber-600 mt-0.5">Amount not entered yet</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">All settled!</h2>
          <p className="text-sm text-gray-500 mt-1">No billable design jobs are waiting on payment.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_1.5fr_1fr_150px_120px] gap-0 border-b bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:grid">
            <span>Job</span>
            <span>Project / Client</span>
            <span>Designer</span>
            <span>Amount (₹)</span>
            <span />
          </div>
          <div className="divide-y">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_150px_120px] gap-2 md:gap-0 px-4 py-3 items-center hover:bg-black/[0.02]"
              >
                <div>
                  <span className="font-mono text-xs font-bold text-gray-700">{job.job_number}</span>
                  {job.client_deadline && (
                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> due {new Date(job.client_deadline).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{job.project_name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{job.client_name}</span>
                  </p>
                </div>
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <User className="w-3 h-3 shrink-0 text-gray-400" />
                  <span className="truncate">{job.designer_name}</span>
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder={job.total_amount ? String(job.total_amount) : 'amount'}
                    value={amounts[job.id] ?? (job.total_amount ? String(job.total_amount) : '')}
                    onChange={(e) => setAmounts(prev => ({ ...prev, [job.id]: e.target.value }))}
                    className="w-28 text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
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
      )}

      <p className="text-xs text-gray-400 text-center">
        <IndianRupee className="inline w-3 h-3 mr-1" />
        Non-billable design jobs close automatically when the file is sent. Only billable ones appear here.
      </p>
    </div>
  );
}
