'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Loader2, CheckCircle2, XCircle, AlertCircle, FileImage,
  ChevronDown, ChevronUp, ExternalLink, Clock,
} from 'lucide-react';

interface HistoryRecord {
  id: string;
  created_at: string;
  file_name: string | null;
  file_url: string | null;
  file_size_kb: number | null;
  status: string;
  attempt_number: number;
  check_type: string;
  check_results: any;
  approved_at: string | null;
  label_brands: { name_en: string } | null;
  label_products: { name_en: string } | null;
  submitter: { full_name: string } | null;
  approver: { full_name: string } | null;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    passed:  'bg-green-50  text-green-700  border-green-200',
    failed:  'bg-red-50    text-red-700    border-red-200',
    pending: 'bg-gray-50   text-gray-600   border-gray-200',
    approved:'bg-blue-50   text-blue-700   border-blue-200',
  };
  const icon: Record<string, React.ReactNode> = {
    passed:  <CheckCircle2 className="h-3 w-3" />,
    failed:  <XCircle className="h-3 w-3" />,
    pending: <AlertCircle className="h-3 w-3" />,
    approved:<CheckCircle2 className="h-3 w-3" />,
  };
  return (
    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border w-fit ${map[status] || map.pending}`}>
      {icon[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ReportDetail({ results }: { results: any }) {
  const [open, setOpen] = useState(false);
  if (!results) return null;
  const { summary, brand_checks = [], product_checks = [] } = results;
  const issues = [...brand_checks, ...product_checks].filter((c: any) => c.status !== 'pass');

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? 'Hide report' : 'View full report'}
        {summary && (
          <span className="ml-1 text-gray-500">
            ({summary.pass} pass · {summary.fail} fail · {summary.missing} missing)
          </span>
        )}
      </button>
      {open && (
        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
          {issues.length === 0 ? (
            <div className="px-4 py-3 text-sm text-green-700 bg-green-50">
              ✅ All fields passed — no issues found
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {issues.map((item: any, i: number) => (
                <div key={i} className="px-4 py-2.5 bg-red-50/40">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
                      item.status === 'fail'    ? 'bg-red-100    text-red-700    border-red-200'    :
                      item.status === 'missing' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                  'bg-yellow-100 text-yellow-700 border-yellow-200'
                    }`}>{item.status.toUpperCase()}</span>
                    <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground ml-8">
                    <div>Expected: <span className="text-gray-700 font-medium">{item.expected}</span></div>
                    {item.found && <div>Found: <span className="text-red-600 font-medium">{item.found}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('label_checks')
        .select(`
          id, created_at, file_name, file_url, file_size_kb,
          status, attempt_number, check_type, check_results, approved_at,
          label_brands:brand_id(name_en),
          label_products:product_id(name_en),
          submitter:submitted_by(full_name),
          approver:approved_by(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setRecords(data as any);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = records.filter(r => filter === 'all' || r.status === filter);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Check History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All label checks — every upload attempt, result, and correction. Full audit trail.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'passed', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              filter === f
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-xs opacity-70">
              {f === 'all' ? records.length : records.filter(r => r.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg">
          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No checks yet. Run your first label check to see history here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* File icon */}
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <FileImage className="h-5 w-5 text-gray-400" />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {r.label_brands?.name_en || '—'} · {r.label_products?.name_en || '—'}
                    </span>
                    <StatusPill status={r.status} />
                    <span className="text-xs text-muted-foreground ml-auto">
                      Attempt #{r.attempt_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{r.file_name || 'Unknown file'}</span>
                    {r.file_size_kb && <span>{r.file_size_kb} KB</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmt(r.created_at)}
                    </span>
                    {r.submitter?.full_name && <span>by {r.submitter.full_name}</span>}
                    {r.file_url && (
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors">
                        <ExternalLink className="h-3 w-3" />View file
                      </a>
                    )}
                  </div>

                  {/* Expandable report */}
                  <ReportDetail results={r.check_results} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
