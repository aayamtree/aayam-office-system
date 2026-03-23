'use client';

import { useState, useEffect, useCallback } from 'react';

interface AttendanceStatus {
  status: 'active' | 'logged_out' | 'absent';
  first_login_time: string | null;
  last_logout_time: string | null;
  total_minutes_worked: number;
}

/**
 * AttendanceClock — silent passive status strip.
 *
 * No buttons, no manual intervention. Login = clock-in, browser
 * close = clock-out. This widget just shows the current state.
 */
export default function AttendanceClock() {
  const [attendance, setAttendance]   = useState<AttendanceStatus | null>(null);
  const [liveMinutes, setLiveMinutes] = useState(0);

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

  // Live clock — update every 60 s
  useEffect(() => {
    const calc = () => {
      if (!attendance?.first_login_time || attendance.status !== 'active') return;
      const loginMs   = new Date(attendance.first_login_time).getTime();
      const nowMs     = Date.now();
      const todayIST  = new Date(nowMs + 5.5 * 3600000).toISOString().split('T')[0];
      const workStart = new Date(`${todayIST}T02:30:00Z`).getTime(); // 8 AM IST
      const workEnd   = new Date(`${todayIST}T15:30:00Z`).getTime(); // 9 PM IST
      setLiveMinutes(Math.max(0, Math.round(
        (Math.min(nowMs, workEnd) - Math.max(loginMs, workStart)) / 60000
      )));
    };
    calc();
    const t = setInterval(calc, 60_000);
    return () => clearInterval(t);
  }, [attendance]);

  if (!attendance || attendance.status === 'absent') return null;

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const fmtDur = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const isActive    = attendance.status === 'active';
  const displayMins = isActive ? liveMinutes : (attendance.total_minutes_worked ?? 0);

  return (
    <div className={`mb-3 rounded-lg px-3 py-2 flex items-center gap-2 text-xs ${
      isActive
        ? 'bg-green-50 border border-green-200 text-green-800'
        : 'bg-gray-50 border border-gray-200 text-gray-500'
    }`}>
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />

      {isActive ? (
        <span>
          <span className="font-semibold">{fmtDur(displayMins)}</span>
          {' '}· Present since {fmt(attendance.first_login_time)}
          <span className="text-green-600 ml-1 text-[10px]">· closes automatically</span>
        </span>
      ) : (
        <span>
          Day complete · <span className="font-semibold">{fmtDur(displayMins)}</span>
          {' '}({fmt(attendance.first_login_time)} → {fmt(attendance.last_logout_time)})
        </span>
      )}
    </div>
  );
}
