'use client';

import { useState, useEffect } from 'react';
import { LogIn, LogOut, CheckCircle, Loader2, Clock } from 'lucide-react';
import { toast } from '@/lib/toast';

interface AttendanceStatus {
  status: 'active' | 'logged_out' | 'absent';
  first_login_time: string | null;
  last_logout_time: string | null;
  total_minutes_worked: number;
}

/**
 * ClockInButton — designer manually starts and ends their day.
 * Replaces the fragile auto-detect approach. 100% reliable.
 *
 * States:
 *  absent     → green "Start My Day" button
 *  active     → pulsing indicator + "End My Day" button
 *  logged_out → "Day Complete ✓" (read-only)
 */
export function EndMyDayButton() {
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/attendance/my-status');
      if (res.ok) {
        const json = await res.json();
        setAttendance(json.data);
      }
    } catch { /* silent */ }
    finally { setFetchLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, []);

  // ── Start Day ────────────────────────────────────────────────────────────
  const handleStartDay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/login', { method: 'POST' });
      const json = await res.json();
      if (json.ok || res.ok) {
        toast.success('Day started! Have a productive day 🚀');
        await fetchStatus(); // refresh from server
      } else {
        toast.error(json.error || 'Could not start day. Try again.');
      }
    } catch (e: any) {
      toast.error('Could not start day: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── End Day ──────────────────────────────────────────────────────────────
  const handleEndDay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/end-day', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        const hrs = Math.round((json.total_minutes_worked || 0) / 6) / 10;
        toast.success(`Day ended! ✅ ${hrs}h recorded.`);
        setAttendance(prev => prev ? {
          ...prev,
          status: 'logged_out',
          last_logout_time: json.logout_time,
          total_minutes_worked: json.total_minutes_worked,
        } : prev);
      } else {
        toast.error(json.error || 'Failed to end day');
      }
    } catch (e: any) {
      toast.error('Failed to end day: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const hrs = Math.round((attendance?.total_minutes_worked || 0) / 6) / 10;
  const isAbsent = !attendance || attendance.status === 'absent';
  const isActive = attendance?.status === 'active';
  const isLoggedOut = attendance?.status === 'logged_out';

  if (fetchLoading) return null;

  // ── Absent: show Start My Day ────────────────────────────────────────────
  if (isAbsent) {
    return (
      <div className="px-3 pb-3">
        <button
          onClick={handleStartDay}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-50"
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" /> Starting...</>
            : <><LogIn size={15} /> Start My Day</>
          }
        </button>
      </div>
    );
  }

  // ── Active or Logged-out: show card with times + button ──────────────────
  return (
    <div className="mx-3 mb-3 rounded-md border bg-white shadow-sm overflow-hidden">
      {/* Status bar */}
      <div className={`px-3 py-2 flex items-center gap-2 ${isLoggedOut ? 'bg-gray-100' : 'bg-green-50'}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-xs font-semibold text-gray-700">
          {isActive ? 'Working' : 'Day Ended'}
        </span>
        <span className="ml-auto text-xs text-gray-500 font-mono flex items-center gap-1">
          <Clock size={11} />{hrs}h
        </span>
      </div>

      {/* Times */}
      <div className="px-3 py-1.5 grid grid-cols-2 gap-1 text-xs border-b border-gray-100">
        <div>
          <span className="text-gray-400 block text-[10px]">Started</span>
          <span className="font-semibold text-gray-800">{fmtTime(attendance.first_login_time)}</span>
        </div>
        <div>
          <span className="text-gray-400 block text-[10px]">Ended</span>
          <span className="font-semibold text-gray-800">{fmtTime(attendance.last_logout_time)}</span>
        </div>
      </div>

      {/* Action */}
      <div className="px-3 py-2">
        {isLoggedOut ? (
          <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-green-700 font-semibold">
            <CheckCircle size={14} /> Day Complete
          </div>
        ) : (
          <button
            onClick={handleEndDay}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gray-800 hover:bg-red-600 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
          >
            {loading
              ? <><Loader2 size={13} className="animate-spin" /> Ending...</>
              : <><LogOut size={13} /> End My Day</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
