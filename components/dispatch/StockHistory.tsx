'use client';

/** Every change of warehouse stock: put in, released, returned, adjusted. Who, when, why. */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const KIND_LABEL: Record<string, string> = {
  in: 'Put in stock',
  release: 'Released to order',
  return: 'Returned to stock',
  adjust: 'Adjusted',
};

interface Props { query: string; clientId: string; reloadKey?: number }

export default function StockHistory({ query, clientId, reloadKey = 0 }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('stock_movements')
        .select('id, kind, qty, reason, created_at, created_by, stock_job:jobs!stock_job_id(job_number, project_name, client_id, client:clients(name, company)), order_job:jobs!order_job_id(job_number)')
        .order('created_at', { ascending: false })
        .limit(300);
      if (!live) return;
      if (err) { setError(err.message); setLoading(false); return; }
      setRows(data || []);
      const ids = Array.from(new Set((data || []).map((r: any) => r.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        if (live) setNames(Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name])));
      }
      setLoading(false);
    })();
    return () => { live = false; };
  }, [reloadKey]);

  const q = query.trim().toLowerCase();
  const shown = rows.filter((r: any) => {
    if (clientId && r.stock_job?.client_id !== clientId) return false;
    if (!q) return true;
    const hay = [r.stock_job?.job_number, r.stock_job?.project_name, r.stock_job?.client?.company, r.stock_job?.client?.name, r.order_job?.job_number, r.reason]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  if (loading) return <p className="text-xs text-gray-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading history…</p>;
  if (error) return <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">Could not load history: {error}</p>;
  if (shown.length === 0) return <p className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-md px-4 py-6 text-center">No stock movements yet.</p>;

  return (
    <div className="overflow-x-auto border border-border rounded-md bg-card">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-muted-foreground">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">What</th>
            <th className="px-3 py-2 font-medium">Job</th>
            <th className="px-3 py-2 font-medium text-right">Pieces</th>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">By</th>
            <th className="px-3 py-2 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r: any) => (
            <tr key={r.id} className="border-t border-border/60 align-top">
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                {new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{KIND_LABEL[r.kind] || r.kind}</td>
              <td className="px-3 py-2">
                <span className="font-mono">#{r.stock_job?.job_number}</span>{' '}
                <span className="text-muted-foreground">{r.stock_job?.client?.company || r.stock_job?.client?.name} · {r.stock_job?.project_name}</span>
              </td>
              <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${r.qty < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {r.qty > 0 ? '+' : ''}{r.qty.toLocaleString('en-IN')}
              </td>
              <td className="px-3 py-2 font-mono whitespace-nowrap">{r.order_job?.job_number ? `#${r.order_job.job_number}` : '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{names[r.created_by] || '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.reason || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
