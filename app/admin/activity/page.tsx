'use client';

import { useState } from 'react';
import { Search, Loader2, Upload, FileText, RotateCcw, CheckSquare, Package, MessageSquare, PlusCircle, DollarSign, Bell, LogIn, ChevronDown, Printer } from 'lucide-react';
import { useActivityLogs } from '@/lib/hooks';
import { createAuditedBrowserClient } from '@/lib/supabase';
import useSWR from 'swr';

const supabase = createAuditedBrowserClient();

// ─── Event type detection ─────────────────────────────────────────────────────
type EventType = 'file_upload' | 'print_file' | 'stage_change' | 'checklist' | 'qc' | 'payment' | 'note' | 'job_created' | 'login' | 'notification' | 'other';

function detectEventType(action: string, description: string): EventType {
  const a = (action || '').toLowerCase();
  const d = (description || '').toLowerCase();
  if (a === 'print_file_upload' || a.includes('print_file') || d.includes('print file submitted')) return 'print_file';
  if (a === 'upload' || a === 'logfileupload' || d.includes('upload')) return 'file_upload';
  if (a === 'checklist' || d.includes('checklist')) return 'checklist';
  if (a === 'qc' || d.includes('qc') || d.includes('quality check')) return 'qc';
  if (a === 'payment' || d.includes('payment') || d.includes('invoice')) return 'payment';
  if (a === 'stage_change' || a === 'updated job stage' || d.includes('moved from') || d.includes('stage')) return 'stage_change';
  if (d.includes('created') || a === 'created job' || d.includes('new job')) return 'job_created';
  if (a === 'login' || a === 'logout') return 'login';
  if (d.includes('note') || d.includes('mention') || d.includes('mentioned')) return 'note';
  if (a === 'notification') return 'notification';
  return 'other';
}

const EVENT_CONFIG: Record<EventType, { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  file_upload: { label: 'File Upload', icon: Upload, bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-400' },
  print_file: { label: 'Print File', icon: Printer, bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  stage_change: { label: 'Stage Change', icon: RotateCcw, bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400' },
  checklist: { label: 'Checklist', icon: CheckSquare, bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-400' },
  qc: { label: 'QC Check', icon: Package, bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  payment: { label: 'Payment', icon: DollarSign, bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  note: { label: 'Note / Mention', icon: MessageSquare, bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  job_created: { label: 'New Job', icon: PlusCircle, bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  login: { label: 'Login', icon: LogIn, bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-300' },
  notification: { label: 'Alert', icon: Bell, bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  other: { label: 'Activity', icon: FileText, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-300' },
};

// ─── Extract real name from notification message ──────────────────────────────
function extractNameFromMessage(msg: string): string | null {
  // "SATISH V uploaded..." or "SATISH V mentioned..."
  const match = msg.match(/^([A-Z][A-Z\s]+?)\s+(uploaded|mentioned|created|moved|added|completed|requested|dispatched)/);
  return match ? match[1].trim() : null;
}

// ─── Initials avatar ──────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500', 'bg-amber-500', 'bg-indigo-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0 text-white text-xs font-bold`}>
      {initials || '?'}
    </div>
  );
}

// ─── Time format ─────────────────────────────────────────────────────────────
// DB stores UTC in a `timestamp without time zone` column, so the string
// arrives with no timezone marker. Treat it as UTC by appending 'Z'.
function parseUtc(dateStr: string): number {
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(dateStr);
  const normalized = hasTz ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  return new Date(normalized).getTime();
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - parseUtc(dateStr)) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(parseUtc(dateStr)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Fetch notifications ──────────────────────────────────────────────────────
function useNotifications(limit = 100) {
  return useSWR('activity-notifs', async () => {
    const { data } = await supabase
      .from('broadcast_notifications')
      .select('id, message, created_at, priority')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map((n: any) => {
      const extractedName = extractNameFromMessage(n.message || '');
      return {
        id: `n-${n.id}`,
        user_name: extractedName || 'System',
        description: n.message,
        action: 'notification',
        created_at: n.created_at,
        _source: 'notification',
      };
    });
  }, { revalidateOnFocus: false });
}

const EVENT_FILTERS = [
  { key: 'all', label: 'All Events' },
  { key: 'print_file', label: '🖨️ Print Files' },
  { key: 'file_upload', label: '📤 Uploads' },
  { key: 'job_created', label: '🆕 New Jobs' },
  { key: 'stage_change', label: '🔄 Stage Changes' },
  { key: 'checklist', label: '✅ Checklists' },
  { key: 'qc', label: '📦 QC Checks' },
  { key: 'note', label: '💬 Notes' },
  { key: 'payment', label: '💰 Payments' },
  { key: 'notification', label: '🔔 Alerts' },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const { logs, loading } = useActivityLogs(300);
  const { data: notifLogs = [], isLoading: notifLoading } = useNotifications(100);

  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showLogins, setShowLogins] = useState(false);

  // Merge activity_logs + notifications, sort newest-first
  const activityLogs = (logs || []).map((l: any) => ({ ...l, _source: 'activity' }));
  const merged = [...activityLogs, ...notifLogs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const todayEvents = merged.filter(l => l.created_at?.startsWith(today));
  const uniqueUsers = new Set(merged.map((l: any) => l.user_name).filter(n => n && n !== 'System')).size;
  const fileUploads = merged.filter(l => detectEventType(l.action, l.description) === 'file_upload').length;
  const jobsCreated = merged.filter(l => detectEventType(l.action, l.description) === 'job_created').length;

  // Unique real user names for filter
  const uniqueUserNames = ['', ...Array.from(new Set(
    merged.map((l: any) => l.user_name).filter((n: string) => n && n !== 'System')
  ))];

  // Filter
  const filtered = merged.filter((log: any) => {
    const eventType = detectEventType(log.action, log.description || '');
    if (!showLogins && eventType === 'login') return false;
    if (eventFilter !== 'all' && eventType !== eventFilter) return false;
    const desc = (log.description || '').toLowerCase();
    const name = (log.user_name || '').toLowerCase();
    if (search && !desc.includes(search.toLowerCase()) && !name.includes(search.toLowerCase())) return false;
    if (userFilter && log.user_name !== userFilter) return false;
    if (dateFilter && !log.created_at?.startsWith(dateFilter)) return false;
    return true;
  });

  if (loading && notifLoading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" size={28} />
        <span className="text-gray-500">Loading system monitor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">System Monitor</h1>
        <p className="text-sm text-gray-400">Track how your team uses the system — every upload, job, stage change and action</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Events", value: todayEvents.length, sub: 'Across all users', color: 'text-blue-600' },
          { label: 'Active Users', value: uniqueUsers, sub: 'With named activity', color: 'text-green-600' },
          { label: 'File Uploads', value: fileUploads, sub: 'Total logged', color: 'text-violet-600' },
          { label: 'Jobs Created', value: jobsCreated, sub: 'All time', color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-300">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Event type filter pills */}
      <div className="flex gap-2 flex-wrap">
        {EVENT_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setEventFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${eventFilter === f.key
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-lg p-2.5 border border-gray-100 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, action, job number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-sm"
          />
        </div>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white min-w-[130px]">
          {(uniqueUserNames as string[]).map(u => (
            <option key={u} value={u}>{u || 'All Users'}</option>
          ))}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-md text-sm" />
        <button
          onClick={() => setShowLogins(v => !v)}
          className={`px-3 py-1.5 text-xs border rounded-md transition-colors ${showLogins ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-400 border-gray-200 hover:text-gray-600'}`}
        >
          {showLogins ? '✓ Logins' : 'Show Logins'}
        </button>
        {(search || eventFilter !== 'all' || userFilter || dateFilter) && (
          <button onClick={() => { setSearch(''); setEventFilter('all'); setUserFilter(''); setDateFilter(''); }}
            className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-md">
            Clear
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} events</span>
      </div>

      {/* Timeline feed */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">No events found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((log: any) => {
              const eventType = detectEventType(log.action, log.description || '');
              const cfg = EVENT_CONFIG[eventType];
              const Icon = cfg.icon;
              const displayName = log.user_name && log.user_name !== 'System'
                ? log.user_name
                : extractNameFromMessage(log.description || '') || 'System';

              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors">
                  {/* Avatar */}
                  {displayName !== 'System' ? (
                    <Avatar name={displayName} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon size={14} className="text-gray-400" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      {displayName !== 'System' && (
                        <span className="text-xs font-bold text-gray-900">{displayName}</span>
                      )}
                      {/* Event badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                        <Icon size={9} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 leading-snug">{log.description || log.action}</p>
                  </div>

                  {/* Time */}
                  <span className="text-xs text-gray-300 whitespace-nowrap flex-shrink-0 mt-0.5">
                    {timeAgo(log.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
