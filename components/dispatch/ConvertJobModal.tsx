'use client';

/**
 * "Mark a running job as stock": lists printed jobs that have not gone out yet
 * (no box, no invoice, no money received) so one can be turned into a stock job.
 * The database re-checks every rule, so a wrong tick can never move a job that already left.
 */
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import JobThumb from '@/components/shared/JobThumb';
import { jobMatches } from '@/lib/page-search';
import { ConvertToStockButton } from '@/components/dispatch/StockSection';

const STAGE_LABEL: Record<string, string> = {
  material_received: 'Material received',
  quality_check: 'QC',
  ready: 'Ready',
};

export default function ConvertJobModal({ onClose, onConverted }: { onClose: () => void; onConverted: () => void }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('jobs')
      .select('id, job_number, project_name, client_id, quantity, current_stage, invoice_reference, amount_received, thumbnail_url, files, client:clients(id, name, company), invoices:invoices(id)')
      .eq('is_stock', false)
      .in('current_stage', ['material_received', 'quality_check', 'ready'])
      .is('package_id', null)
      .is('stock_source_job_id', null)
      .order('created_at', { ascending: false })
      .limit(300);
    if (err) setError(err.message);
    else {
      setJobs((data || []).filter((j: any) =>
        !(j.invoices && j.invoices.length) && !(j.invoice_reference || '').trim() && !(Number(j.amount_received) > 0)));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = q.trim() ? jobs.filter(j => jobMatches(j, q.trim())) : jobs;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Mark a running job as stock</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Shows printed jobs that are not packed, not invoiced and not dispatched. A stock job has no price and is not an order.
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search job no., client or job name…"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <div className="overflow-y-auto space-y-2 flex-1">
          {loading ? (
            <p className="text-xs text-gray-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading jobs…</p>
          ) : error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No eligible jobs found.</p>
          ) : shown.map(j => (
            <div key={j.id} className="flex items-center gap-3 border border-border rounded-md p-2.5">
              <JobThumb job={j} size={48} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground truncate">
                  <span className="font-mono">#{j.job_number}</span> · {j.client?.company || j.client?.name} · {STAGE_LABEL[j.current_stage] || j.current_stage}
                </p>
                <p className="text-sm font-semibold text-foreground line-clamp-2">{j.project_name}</p>
                <p className="text-[10px] text-muted-foreground">Qty on job: {j.quantity}</p>
              </div>
              <ConvertToStockButton jobId={j.id} onDone={() => { onConverted(); load(); }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
