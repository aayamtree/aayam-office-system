'use client';

import { useEffect, useState, useCallback } from 'react';
import { Send, CheckCircle2, AlertTriangle, Loader2, RefreshCcw } from 'lucide-react';

interface TgHealth {
  lastRun: { ran_at: string; ok: boolean; message: string | null } | null;
  lastRunAgeMin: number | null;
  last24h: { total: number; failed: number };
  perDay: { day: string; total: number; failed: number }[];
  unresolved: { job_number: string; stage: string; sent_at: string; error: string | null; stillAtThatStage: boolean }[];
  unresolvedCount: number;
  departments: { department: string; ok: boolean }[];
}

/** Telegram alert system status — the 30-minute health check's findings, in plain view. */
export default function TelegramHealthCard() {
  const [data, setData] = useState<TgHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/telegram-health');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e: any) {
      setErr(e?.message || 'Could not load Telegram health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The check should report in every 30 minutes. If it has not for 90, it is not running.
  const stale = data ? data.lastRunAgeMin === null || data.lastRunAgeMin > 90 : false;
  const problems = data ? (stale || !data.lastRun?.ok || data.unresolvedCount > 0 || data.departments.some(d => !d.ok)) : false;

  return (
    <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-gray-500" />
          <h3 className="font-bold text-sm text-gray-700">Telegram Alerts</h3>
          {data && (problems
            ? <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">Needs attention</span>
            : <span className="text-[11px] px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-semibold">Healthy</span>)}
        </div>
        <button onClick={load} disabled={loading} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 disabled:opacity-50">
          <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : err ? (
        <p className="p-4 text-sm text-red-600"><AlertTriangle className="w-4 h-4 inline mr-1" />{err}</p>
      ) : data ? (
        <div className="p-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase">Health check</p>
              <p className={`font-semibold ${stale ? 'text-red-600' : 'text-gray-900'}`}>
                {data.lastRunAgeMin === null ? 'Never ran yet' : stale ? `Silent for ${data.lastRunAgeMin} min` : `Ran ${data.lastRunAgeMin} min ago`}
              </p>
              {data.lastRun?.message && <p className="text-xs text-gray-500 truncate" title={data.lastRun.message}>{data.lastRun.message}</p>}
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase">Alerts, 24 hours</p>
              <p className="font-semibold text-gray-900">{data.last24h.total - data.last24h.failed} of {data.last24h.total} delivered</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase">Not yet delivered</p>
              <p className={`font-semibold ${data.unresolvedCount ? 'text-amber-700' : 'text-green-700'}`}>{data.unresolvedCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase">Department groups</p>
              <p className="flex flex-wrap gap-1 mt-0.5">
                {data.departments.map(d => (
                  <span key={d.department} className={`text-[11px] px-1.5 py-0.5 rounded border ${d.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {d.ok ? <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> : <AlertTriangle className="w-3 h-3 inline mr-0.5" />}{d.department}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Last 7 days</p>
            <div className="flex flex-wrap gap-2">
              {data.perDay.map(d => (
                <div key={d.day} className={`px-2 py-1 rounded border text-xs ${d.failed ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                  <span className="font-mono text-gray-500">{d.day.slice(5)}</span>{' '}
                  <span className="font-semibold">{d.total - d.failed}/{d.total}</span>
                </div>
              ))}
              {data.perDay.length === 0 && <span className="text-xs text-gray-400">No alerts recorded.</span>}
            </div>
          </div>

          {data.unresolved.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Alerts still not delivered (re-sent automatically every 30 min)</p>
              <ul className="space-y-1">
                {data.unresolved.map((u, i) => (
                  <li key={i} className="text-xs text-gray-700">
                    <span className="font-mono">#{u.job_number}</span> → {u.stage}
                    {!u.stillAtThatStage && <span className="text-gray-400"> (job has moved on — no resend)</span>}
                    {u.error && <span className="text-gray-400"> · {u.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
