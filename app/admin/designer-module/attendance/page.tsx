'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Clock, LogIn, LogOut, Calendar, RefreshCw, Briefcase } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  active:  'bg-green-100 text-green-700',
  idle:    'bg-yellow-100 text-yellow-700',
  offline: 'bg-gray-100 text-gray-500',
  absent:  'bg-red-100 text-red-600',
};

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface AtEntry {
  id: string; full_name: string; email: string;
  status: string;
  first_login_time: string | null;
  last_logout_time: string | null;
  last_heartbeat_time: string | null;
  total_minutes_worked: number;
  // range-only fields
  present_days?: number;
  total_days_in_range?: number;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [rangeDates, setRangeDates] = useState<{ start: string; end: string } | null>(null);

  const fetchData = useCallback(async (p: 'today' | 'week' | 'month') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/range?period=${p}`);
      if (res.ok) {
        const json = await res.json();
        setRecords(json.data || []);
        if (json.startDate && json.endDate) {
          setRangeDates({ start: json.startDate, end: json.endDate });
        }
      }
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(period); }, [fetchData, period]);

  const handlePeriodChange = (p: 'today' | 'week' | 'month') => {
    setPeriod(p);
    fetchData(p);
  };

  const totalHours = records.reduce((sum, r) => sum + (r.total_minutes_worked || 0), 0);
  const presentCount = records.filter(r => r.status !== 'absent').length;
  const absentCount = records.filter(r => r.status === 'absent').length;

  const isRangeView = period !== 'today';

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">Designer login and work time tracking</p>
        </div>
        <button onClick={() => fetchData(period)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Period toggle */}
      <div className="flex gap-2 items-center">
        {(['today', 'week', 'month'] as const).map(p => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`px-4 py-1.5 text-sm rounded-lg capitalize font-medium border transition-colors
              ${period === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
        {rangeDates && isRangeView && (
          <span className="text-xs text-gray-400 self-center ml-2">
            {fmtDate(rangeDates.start)} — {fmtDate(rangeDates.end)}
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Present',     val: presentCount,        icon: LogIn,  color: 'text-green-600 bg-green-50 border-green-100' },
          { label: 'Absent',      val: absentCount,         icon: Users,  color: 'text-red-600 bg-red-50 border-red-100' },
          { label: 'Total Hours', val: fmtHours(totalHours),icon: Clock,  color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'Designers',   val: records.length,      icon: Users,  color: 'text-purple-600 bg-purple-50 border-purple-100' },
        ].map(card => (
          <div key={card.label} className={`border rounded-xl p-4 flex items-center gap-3 ${card.color}`}>
            <card.icon size={20} />
            <div>
              <div className="text-xl font-bold">{card.val}</div>
              <div className="text-xs font-medium opacity-70">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Designer</th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              {!isRangeView ? (
                <>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Login Time</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Logout Time</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Active</th>
                </>
              ) : (
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Attended</th>
              )}
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Hours Worked</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={isRangeView ? 5 : 7} className="py-12 text-center text-gray-400"><RefreshCw className="animate-spin mx-auto mb-2" size={20} />Loading...</td></tr>
              : records.length === 0
                ? <tr><td colSpan={isRangeView ? 5 : 7} className="py-12 text-center text-gray-400">No attendance records found</td></tr>
                : records.map((r, i) => (
                  <tr key={r.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} border-b border-gray-50 last:border-0`}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{r.full_name}</div>
                      <div className="text-xs text-gray-400">{r.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    {!isRangeView ? (
                      <>
                        <td className="py-3 px-4 text-gray-600">{fmtTime(r.first_login_time)}</td>
                        <td className="py-3 px-4 text-gray-600">{fmtTime(r.last_logout_time)}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{fmtTime(r.last_heartbeat_time)}</td>
                      </>
                    ) : (
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        {r.present_days ?? 0} / {r.total_days_in_range ?? 0} days
                      </td>
                    )}
                    <td className="py-3 px-4 font-semibold text-gray-800">
                      {r.status === 'absent' && !isRangeView
                        ? <span className="text-gray-300">—</span>
                        : fmtHours(r.total_minutes_worked || 0)}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
        {!loading && (
          <div className="bg-gray-50 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
            Showing {records.length} designers
            {rangeDates && isRangeView
              ? ` • ${fmtDate(rangeDates.start)} to ${fmtDate(rangeDates.end)}`
              : ` • ${fmtDate(new Date().toISOString())}`
            }
            {' '}• Total: {fmtHours(totalHours)}
          </div>
        )}
      </div>
    </div>
  );
}
