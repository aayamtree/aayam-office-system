'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Clock, LogIn, LogOut, RefreshCw, Edit2, Check, X, AlertTriangle, Shield } from 'lucide-react';
import { toast } from '@/lib/toast';

const STATUS_BADGE: Record<string, string> = {
  active:     'bg-green-100 text-green-700 border-green-200',
  logged_out: 'bg-gray-100 text-gray-500 border-gray-200',
  absent:     'bg-red-100 text-red-600 border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
  active:     'Active',
  logged_out: 'Tapped Out',
  absent:     'Absent',
};

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  // Convert ISO to local datetime-local input format (YYYY-MM-DDTHH:MM)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface AtEntry {
  id: string; full_name: string; email: string;
  status: string;
  first_login_time: string | null;
  last_logout_time: string | null;
  last_heartbeat_time: string | null;
  total_minutes_worked: number;
  admin_override?: boolean;
  tap_out_method?: string;
}

interface EditState {
  login: string;
  logout: string;
  minutes: string;
  reason: string;
}

export default function DesignStudioAttendancePage() {
  const [records, setRecords] = useState<AtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ login: '', logout: '', minutes: '', reason: '' });
  const [saving, setSaving] = useState(false);

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
  // Count designers who are still "active" at end of day (didn't tap out)
  const noTapOutCount = records.filter(r => r.status === 'active').length;

  const startEdit = (r: AtEntry) => {
    setEditingId(r.id);
    setEditState({
      login: toLocalInputValue(r.first_login_time),
      logout: toLocalInputValue(r.last_logout_time),
      minutes: String(r.total_minutes_worked || 0),
      reason: '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState({ login: '', logout: '', minutes: '', reason: '' });
  };

  const saveOverride = async (recordId: string) => {
    setSaving(true);
    try {
      const body: Record<string, any> = { record_id: recordId, override_reason: editState.reason || 'Admin correction' };
      if (editState.login) body.first_login_time = new Date(editState.login).toISOString();
      if (editState.logout) body.last_logout_time = new Date(editState.logout).toISOString();
      if (editState.minutes !== '') body.total_minutes_worked = parseInt(editState.minutes) || 0;

      const res = await fetch('/api/attendance/override', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();

      if (json.ok) {
        toast.success('Attendance record corrected ✅');
        cancelEdit();
        await fetchData();
      } else {
        toast.error('Save failed: ' + (json.error || 'Unknown error'));
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Designer Attendance</h1>
          <p className="text-sm text-muted-foreground">Daily login and work time log · Office hours: 9:00 AM – 7:30 PM</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-md p-3 bg-green-50 border-green-100 flex items-center gap-3">
          <LogIn size={18} className="text-green-600" />
          <div><div className="text-xl font-bold text-green-700">{presentCount}</div><div className="text-xs text-green-600">Present</div></div>
        </div>
        <div className="border rounded-md p-3 bg-red-50 border-red-100 flex items-center gap-3">
          <Users size={18} className="text-red-600" />
          <div><div className="text-xl font-bold text-red-700">{absentCount}</div><div className="text-xs text-red-600">Absent</div></div>
        </div>
        <div className="border rounded-md p-3 bg-blue-50 border-blue-100 flex items-center gap-3">
          <Clock size={18} className="text-blue-600" />
          <div><div className="text-xl font-bold text-blue-700">{Math.round(totalHours * 10) / 10}h</div><div className="text-xs text-blue-600">Total Hours</div></div>
        </div>
        <div className={`border rounded-md p-3 flex items-center gap-3 ${noTapOutCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
          <LogOut size={18} className={noTapOutCount > 0 ? 'text-amber-600' : 'text-gray-400'} />
          <div>
            <div className={`text-xl font-bold ${noTapOutCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{noTapOutCount}</div>
            <div className={`text-xs ${noTapOutCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>No Tap-Out</div>
          </div>
        </div>
      </div>

      {/* No tap-out warning */}
      {noTapOutCount > 0 && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">{noTapOutCount} designer{noTapOutCount > 1 ? 's' : ''} still active — no tap-out recorded</p>
            <p className="text-xs text-amber-700 mt-0.5">Hours may be inflated if they left but PC stayed on. Use ✏️ to correct time and minutes manually.</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {['Name', 'Status', 'Login Time', 'Logout Time', 'Hours Worked', 'Correct'].map(h => (
                <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">
                <RefreshCw className="animate-spin mx-auto mb-2" size={20} />Loading...
              </td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No attendance records for today</td></tr>
            ) : records.map((r, i) => (
              <>
                <tr key={r.id} className={`${i % 2 === 0 ? '' : 'bg-muted/20'} border-b last:border-0`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{r.full_name || '(No name)'}</span>
                      {r.admin_override && (
                        <span title="Admin corrected" className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 border border-purple-200 font-semibold">
                          <Shield size={9} className="mr-0.5" />ADM
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                      {r.status === 'active' && <span title="No tap-out yet"><AlertTriangle size={13} className="text-amber-500" /></span>}
                      {r.tap_out_method === 'manual' && <span className="text-[10px] text-green-600 font-semibold">✓ Tapped out</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{fmtTime(r.first_login_time)}</td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{fmtTime(r.last_logout_time)}</td>
                  <td className="py-3 px-4">
                    {r.status === 'absent'
                      ? <span className="text-muted-foreground">—</span>
                      : <span className={`font-semibold ${r.admin_override ? 'text-purple-700' : ''}`}>
                          {Math.round((r.total_minutes_worked || 0) / 6) / 10}h
                          <span className="text-xs text-muted-foreground ml-1">({r.total_minutes_worked || 0}m)</span>
                        </span>
                    }
                  </td>
                  <td className="py-3 px-4">
                    {r.status !== 'absent' && (
                      <button
                        onClick={() => editingId === r.id ? cancelEdit() : startEdit(r)}
                        className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 hover:text-gray-800 transition-colors"
                        title="Correct this record"
                      >
                        {editingId === r.id ? <X size={14} /> : <Edit2 size={14} />}
                      </button>
                    )}
                  </td>
                </tr>

                {/* Inline Edit Row */}
                {editingId === r.id && (
                  <tr key={r.id + '-edit'} className="bg-purple-50 border-b border-purple-100">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Login Time</label>
                          <input
                            type="datetime-local"
                            value={editState.login}
                            onChange={e => setEditState(s => ({ ...s, login: e.target.value }))}
                            className="px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Logout Time</label>
                          <input
                            type="datetime-local"
                            value={editState.logout}
                            onChange={e => setEditState(s => ({ ...s, logout: e.target.value }))}
                            className="px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Minutes Worked</label>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={editState.minutes || ''}
                            onChange={e => setEditState(s => ({ ...s, minutes: e.target.value }))}
                            className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                            placeholder="e.g. 420"
                          />
                          <span className="ml-1 text-xs text-gray-500">= {Math.round(parseInt(editState.minutes || '0') / 6) / 10}h</span>
                        </div>
                        <div className="flex-1 min-w-40">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Reason (optional)</label>
                          <input
                            type="text"
                            value={editState.reason}
                            onChange={e => setEditState(s => ({ ...s, reason: e.target.value }))}
                            placeholder="e.g. Left at 4pm without tapping out"
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                        <button
                          onClick={() => saveOverride(r.id)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 text-white text-xs font-semibold rounded-md hover:bg-purple-800 disabled:opacity-50"
                        >
                          <Check size={13} /> {saving ? 'Saving...' : 'Save Correction'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-md hover:bg-gray-50"
                        >
                          <X size={13} /> Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
