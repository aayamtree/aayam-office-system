'use client';

import { useState, useEffect } from 'react';
import { LogOut, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

interface AttendanceStatus {
  status: 'active' | 'logged_out' | 'absent';
  first_login_time: string | null;
  last_logout_time: string | null;
  total_minutes_worked: number;
}

export function EndMyDayButton() {
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  // Fetch own attendance status
  useEffect(() => {
    const fetchMyAttendance = async () => {
      try {
        const res = await fetch('/api/attendance/my-status');
        if (res.ok) {
          const json = await res.json();
          setAttendance(json.data);
        }
      } catch { }
      finally { setFetchLoading(false); }
    };
    fetchMyAttendance();
  }, []);

  const handleEndDay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/end-day', { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        const hrs = Math.round((json.total_minutes_worked || 0) / 6) / 10;
        toast.success(`Day ended! ✅ Total: ${hrs}h recorded.`);
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
  const isLoggedOut = attendance?.status === 'logged_out';
  const isActive = attendance?.status === 'active';

  if (fetchLoading) return null;
  if (!attendance || attendance.status === 'absent') return null;

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-2.5 flex items-center gap-2 ${isLoggedOut ? 'bg-gray-100' : 'bg-green-50'}`}>
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-xs font-semibold text-gray-700">
          {isActive ? 'Working Now' : 'Day Ended'}
        </span>
        <span className="ml-auto text-xs text-gray-500 font-mono">{hrs}h logged</span>
      </div>

      {/* Times */}
      <div className="px-4 py-2 grid grid-cols-2 gap-2 text-xs border-b border-gray-100">
        <div>
          <span className="text-gray-400 block">Login</span>
          <span className="font-semibold text-gray-800">{fmtTime(attendance.first_login_time)}</span>
        </div>
        <div>
          <span className="text-gray-400 block">Logout</span>
          <span className="font-semibold text-gray-800">{fmtTime(attendance.last_logout_time)}</span>
        </div>
      </div>

      {/* Button */}
      <div className="px-3 py-2.5">
        {isLoggedOut ? (
          <div className="flex items-center justify-center gap-2 py-1.5 text-sm text-green-700 font-semibold">
            <CheckCircle size={16} />
            Day Completed
          </div>
        ) : (
          <button
            onClick={handleEndDay}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gray-900 hover:bg-red-600 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-50"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Ending...</>
              : <><LogOut size={15} /> End My Day</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
