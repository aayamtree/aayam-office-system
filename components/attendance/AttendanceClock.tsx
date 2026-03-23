'use client';

import { useState, useEffect, useCallback } from 'react';
import { LogOut, Clock, CheckCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { toast } from '@/lib/toast';

interface AttendanceStatus {
  status: 'active' | 'logged_out' | 'absent';
  first_login_time: string | null;
  last_logout_time: string | null;
  total_minutes_worked: number;
}

/**
 * AttendanceClock — prominent banner shown on designer dashboard.
 *
 * • Auto clocks-in on login (via auth-context), so by the time
 *   the designer sees this widget they're already clocked in.
 * • Shows live running time (updates every 30s).
 * • "End My Day" button for explicit clock-out.
 * • If auto clock-in somehow failed, shows a manual "Start" button.
 * • Hours calculated 8 AM – 9 PM IST window (server-side).
 */
export default function AttendanceClock() {
  const [attendance, setAttendance]     = useState<AttendanceStatus | null>(null);
  const [loading, setLoading]           = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [liveMinutes, setLiveMinutes]   = useState(0);
  const [offline, setOffline]           = useState(false);

  // ── Fetch status ────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/my-status');
      if (res.ok) {
        const json = await res.json();
        setAttendance(json.data ?? null);
        setOffline(false);
      }
    } catch { setOffline(true); }
    finally { setFetchLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Live clock — recalculate every 30s ──────────────────────────────────
  useEffect(() => {
    const calcMins = () => {
      if (!attendance?.first_login_time || attendance.status !== 'active') return;

      const loginMs = new Date(attendance.first_login_time).getTime();
      const nowMs   = Date.now();

      // Clip to 8 AM – 9 PM IST (UTC offsets)
      const todayIST = new Date(nowMs + 5.5 * 3600000).toISOString().split('T')[0];
      const workStart = new Date(`${todayIST}T02:30:00Z`).getTime();
      const workEnd   = new Date(`${todayIST}T15:30:00Z`).getTime();

      const mins = Math.max(0, Math.round(
        (Math.min(nowMs, workEnd) - Math.max(loginMs, workStart)) / 60000
      ));
      setLiveMinutes(mins);
    };
    calcMins();
    const t = setInterval(calcMins, 30_000);
    return () => clearInterval(t);
  }, [attendance]);

  // ── Manual start (fallback if auto clock-in failed) ────────────────────
  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/login', { method: 'POST' });
      if (res.ok) {
        toast.success('Clocked in! Have a great day 🚀');
        await fetchStatus();
      } else {
        toast.error('Could not clock in — please try again.');
      }
    } catch { toast.error('Network error — check connection.'); }
    finally { setLoading(false); }
  };

  // ── End day ────────────────────────────────────────────────────────────
  const handleEnd = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/attendance/end-day', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        const h = Math.floor((json.total_minutes_worked || 0) / 60);
        const m = (json.total_minutes_worked || 0) % 60;
        toast.success(`Day ended! ✅  ${h}h ${m}m recorded.`);
        setAttendance(prev => prev
          ? { ...prev, status: 'logged_out', last_logout_time: json.logout_time, total_minutes_worked: json.total_minutes_worked }
          : prev);
      } else {
        toast.error(json.error || 'Failed to end day');
      }
    } catch { toast.error('Network error — please try again.'); }
    finally { setLoading(false); }
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const fmtDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  if (fetchLoading) return null;

  const isAbsent    = !attendance || attendance.status === 'absent';
  const isActive    = attendance?.status === 'active';
  const isLoggedOut = attendance?.status === 'logged_out';
  const displayMins = isActive ? liveMinutes : (attendance?.total_minutes_worked ?? 0);

  // ── Not clocked in — show start button ──────────────────────────────────
  if (isAbsent) {
    return (
      <div className="mb-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">Not clocked in yet</p>
            <p className="text-xs text-amber-600">Tap the button to start your work day</p>
          </div>
        </div>
        <button
          onClick={handleStart}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
          {loading ? 'Starting…' : 'Start My Day'}
        </button>
      </div>
    );
  }

  // ── Active — show running clock ─────────────────────────────────────────
  if (isActive) {
    return (
      <div className="mb-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 flex items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          {/* Live pulse */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-white rounded-full border-2 border-green-600 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums leading-none">{fmtDuration(displayMins)}</span>
              <span className="text-xs bg-white/20 rounded px-1.5 py-0.5 font-medium">TODAY</span>
            </div>
            <p className="text-xs text-green-100 mt-0.5">
              Clocked in at {fmtTime(attendance?.first_login_time ?? null)} &nbsp;·&nbsp; 8 AM – 9 PM window
              {offline && <span className="ml-2 inline-flex items-center gap-1 text-amber-200"><WifiOff size={10} /> offline</span>}
            </p>
          </div>
        </div>
        <button
          onClick={handleEnd}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 shrink-0 border border-white/30"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
          {loading ? 'Ending…' : 'End My Day'}
        </button>
      </div>
    );
  }

  // ── Logged out — show summary ───────────────────────────────────────────
  if (isLoggedOut) {
    return (
      <div className="mb-4 rounded-xl bg-gray-100 border border-gray-200 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">{fmtDuration(displayMins)}</span>
              <span className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5 font-semibold">DAY COMPLETE</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {fmtTime(attendance?.first_login_time ?? null)} → {fmtTime(attendance?.last_logout_time ?? null)}
              &nbsp;·&nbsp; 8 AM – 9 PM window
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
          <Wifi size={12} className="text-gray-300" /> Synced
        </div>
      </div>
    );
  }

  return null;
}
