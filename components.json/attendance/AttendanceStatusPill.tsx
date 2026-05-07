'use client';

import { useState, useEffect, useCallback } from 'react';

interface AttendanceStatus {
  status: 'active' | 'logged_out' | 'absent';
  first_login_time: string | null;
  last_logout_time: string | null;
  total_minutes_worked: number;
}

/**
 * Slim sidebar pill — no buttons, fully silent.
 * Just shows: ● Present since 9:32 AM  or  ✓ 7h 30m today
 */
export default function AttendanceStatusPill() {
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/my-status');
      if (res.ok) {
        const json = await res.json();
        setAttendance(json.data ?? null);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (!attendance || attendance.status === 'absent') return null;

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const fmtDur = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const isActive = attendance.status === 'active';

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] ${
      isActive ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-50'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
      {isActive
        ? <span>Present since <strong>{fmt(attendance.first_login_time)}</strong></span>
        : <span>Done · <strong>{fmtDur(attendance.total_minutes_worked)}</strong> today</span>
      }
    </div>
  );
}
