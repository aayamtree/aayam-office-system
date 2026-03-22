'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Clock, LogIn, LogOut, RefreshCw } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  active:  'bg-green-100 text-green-700 border-green-200',
  idle:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  offline: 'bg-gray-100 text-gray-500 border-gray-200',
  absent:  'bg-red-100 text-red-600 border-red-200',
};

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

interface AtEntry {
  id: string; full_name: string; email: string;
  status: string; first_login_time: string | null; last_logout_time: string | null;
  last_heartbeat_time: string | null; total_minutes_worked: number;
}

export default function DesignStudioAttendancePage() {
  const [records, setRecords] = useState<AtEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/today');
      if (res.ok) {
        const json = await res.json();
        setRecords(json.data || []);
      }
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const presentCount = records.filter(r => r.status !== 'absent').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const totalHours = records.reduce((sum, r) => sum + Math.round((r.total_minutes_worked || 0) / 6) / 10, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Designer Attendance</h1>
          <p className="text-sm text-muted-foreground">Daily login and work time log</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 bg-green-50 border-green-100 flex items-center gap-3">
          <LogIn size={18} className="text-green-600" />
          <div><div className="text-xl font-bold text-green-700">{presentCount}</div><div className="text-xs text-green-600">Present</div></div>
        </div>
        <div className="border rounded-xl p-4 bg-red-50 border-red-100 flex items-center gap-3">
          <Users size={18} className="text-red-600" />
          <div><div className="text-xl font-bold text-red-700">{absentCount}</div><div className="text-xs text-red-600">Absent</div></div>
        </div>
        <div className="border rounded-xl p-4 bg-blue-50 border-blue-100 flex items-center gap-3">
          <Clock size={18} className="text-blue-600" />
          <div><div className="text-xl font-bold text-blue-700">{Math.round(totalHours * 10) / 10}h</div><div className="text-xs text-blue-600">Total Hours</div></div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {['Name', 'Status', 'Login Time', 'Logout Time', 'Hours Worked'].map(h => (
                <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">
                <RefreshCw className="animate-spin mx-auto mb-2" size={20} />Loading...
              </td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No attendance records for today</td></tr>
            ) : records.map((r, i) => (
              <tr key={r.id} className={`${i % 2 === 0 ? '' : 'bg-muted/20'} border-b last:border-0`}>
                <td className="py-3 px-4">
                  <div className="font-medium text-foreground">{r.full_name || '(No name)'}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{fmtTime(r.first_login_time)}</td>
                <td className="py-3 px-4 text-muted-foreground">{fmtTime(r.last_logout_time)}</td>
                <td className="py-3 px-4 font-semibold">
                  {r.status === 'absent'
                    ? <span className="text-muted-foreground">—</span>
                    : `${Math.round((r.total_minutes_worked || 0) / 6) / 10}h`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
