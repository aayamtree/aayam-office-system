'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DesignerAvailabilityDropdown from '@/components/designer-module/DesignerAvailabilityDropdown';
import {
  ArrowLeft, Play, Pause, Eye, RotateCcw, CheckCircle2,
  Timer, Clock, Loader2, AlertTriangle, ArrowRightLeft,
  User, CalendarDays, AlertCircle, ChevronDown
} from 'lucide-react';

type TStatus = 'created' | 'live' | 'hold' | 'review' | 'rework' | 'end';

const STATUS_COLORS: Record<TStatus, string> = {
  created: 'bg-gray-100 text-gray-700 border-gray-200',
  live:    'bg-green-100 text-green-700 border-green-200',
  hold:    'bg-orange-100 text-orange-700 border-orange-200',
  review:  'bg-blue-100 text-blue-700 border-blue-200',
  rework:  'bg-red-100 text-red-700 border-red-200',
  end:     'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const VALID_NEXT: Record<TStatus, TStatus[]> = {
  created: ['live'],
  live:    ['hold', 'review', 'end'],
  hold:    ['live'],
  review:  ['live', 'rework', 'end'],
  rework:  ['live'],
  end:     ['rework'],
};

const HOLD_REASONS = [
  'Priority change',
  'Urgent task assigned',
  'Waiting for internal input',
  'Client content pending',
  'Other',
];

const DOSSIER_ICON: Record<string, string> = {
  TASK_CREATED:    '🆕',
  LIVE_STARTED:    '▶️',
  LIVE_PAUSED:     '⏸️',
  HOLD_APPLIED:    '⏳',
  REVIEW_STARTED:  '👁️',
  REWORK_CREATED:  '🔄',
  TASK_ENDED:      '✅',
  TASK_TRANSFERRED:'🔀',
  STATUS_CHANGED:  '🔁',
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function LiveTimer({ startTime, accumulatedMinutes }: { startTime: string; accumulatedMinutes: number }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const update = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setSeconds(elapsed);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const totalSeconds = seconds + accumulatedMinutes * 60;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
      <Timer size={16} className="text-green-600 animate-pulse" />
      <span className="font-mono text-lg font-bold text-green-700">
        {h.toString().padStart(2,'0')}:{m.toString().padStart(2,'0')}:{s.toString().padStart(2,'0')}
      </span>
      <span className="text-xs text-green-600">LIVE</span>
    </div>
  );
}

function DossierTimeline({ entries }: { entries: any[] }) {
  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3 group">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <span className="text-lg leading-none">{DOSSIER_ICON[entry.entry_type] || '📝'}</span>
            {idx < entries.length - 1 && (
              <div className="flex-1 w-px bg-gray-200 my-1" />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-sm font-semibold text-gray-800 capitalize">
                  {entry.entry_type.replace(/_/g, ' ').toLowerCase()}
                </span>
                {entry.actor && (
                  <span className="text-xs text-gray-400 ml-2">by {entry.actor.full_name}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                {new Date(entry.created_at).toLocaleString('en-IN', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>

            {/* Entry data */}
            {entry.data_json?.reason && (
              <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                Reason: {entry.data_json.reason}
              </p>
            )}
            {entry.data_json?.rework_number && (
              <p className="text-xs text-red-600 mt-1">Rework #{entry.data_json.rework_number}</p>
            )}
            {entry.data_json?.to_user_name && (
              <p className="text-xs text-blue-600 mt-1">
                Transferred from {entry.data_json.from_user_name} → {entry.data_json.to_user_name}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { profile, isAdmin } = useAuth();

  const [task, setTask] = useState<any>(null);
  const [dossier, setDossier] = useState<any[]>([]);
  const [timeSummary, setTimeSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Hold modal
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdCustomReason, setHoldCustomReason] = useState('');

  // Rework modal
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkNotes, setReworkNotes] = useState('');

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // End summary modal
  const [showEndSummary, setShowEndSummary] = useState(false);

  const fetchAll = useCallback(async () => {
    const [taskRes, dossierRes, timeRes] = await Promise.all([
      fetch(`/api/design-tasks/${id}`),
      fetch(`/api/design-tasks/${id}/dossier`),
      fetch(`/api/design-tasks/${id}/time`),
    ]);

    if (taskRes.status === 403) { setError('Access denied'); setLoading(false); return; }
    if (taskRes.status === 404) { setError('Task not found'); setLoading(false); return; }

    const [taskJson, dossierJson, timeJson] = await Promise.all([
      taskRes.json(), dossierRes.json(), timeRes.json()
    ]);

    setTask(taskJson.data);
    setDossier(dossierJson.data || []);
    setTimeSummary(timeJson.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const performStatusChange = async (newStatus: TStatus, reason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/design-tasks/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: newStatus, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (newStatus === 'end') setShowEndSummary(true);
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusButton = async (nextStatus: TStatus) => {
    if (nextStatus === 'hold') { setShowHoldModal(true); return; }
    if (nextStatus === 'rework') { setShowReworkModal(true); return; }
    await performStatusChange(nextStatus);
  };

  const handleHoldConfirm = async () => {
    const reason = holdReason === 'Other' ? holdCustomReason : holdReason;
    if (!reason) return;
    setShowHoldModal(false);
    await performStatusChange('hold', reason);
    setHoldReason('');
    setHoldCustomReason('');
  };

  const handleReworkConfirm = async () => {
    if (!reworkNotes.trim()) return;
    setShowReworkModal(false);
    await performStatusChange('rework', reworkNotes);
    setReworkNotes('');
  };

  const handleTransferConfirm = async () => {
    if (!transferTo) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/design-tasks/${id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferred_to: transferTo, reason: transferReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setShowTransferModal(false);
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
      <AlertTriangle size={32} className="text-red-400" />
      <p className="text-gray-600">{error}</p>
      <button onClick={() => router.back()} className="text-sm text-primary underline">Go back</button>
    </div>
  );

  if (!task) return null;

  const currentStatus = task.current_status as TStatus;
  const nextStatuses = VALID_NEXT[currentStatus] || [];
  const userId = profile?.id || '';
  const isOwner = task.assigned_to === userId || task.created_by === userId;
  const canAct = isAdmin || isOwner;
  const isReadOnly = !isAdmin && !isOwner;
  const openSession = timeSummary?.open_session;
  const accumulatedMinutes = timeSummary?.completed_minutes || 0;

  const STATUS_BUTTON_STYLE: Record<string, string> = {
    live:   'bg-green-600 hover:bg-green-700 text-white',
    hold:   'bg-orange-500 hover:bg-orange-600 text-white',
    review: 'bg-blue-600 hover:bg-blue-700 text-white',
    rework: 'bg-red-500 hover:bg-red-600 text-white',
    end:    'bg-emerald-600 hover:bg-emerald-700 text-white',
  };

  const STATUS_BUTTON_LABEL: Record<string, string> = {
    live:   'Go LIVE',
    hold:   'Put on HOLD',
    review: 'Send to REVIEW',
    rework: 'Mark REWORK',
    end:    'Mark as DONE',
  };

  const STATUS_BUTTON_ICON: any = {
    live:   Play,
    hold:   Pause,
    review: Eye,
    rework: RotateCcw,
    end:    CheckCircle2,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-gray-400">{task.task_code}</span>
            <span className={`text-sm font-bold px-3 py-0.5 rounded-full border capitalize ${STATUS_COLORS[currentStatus]}`}>
              {currentStatus}
            </span>
            {task.rework_count > 0 && (
              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
                Rework #{task.rework_count}
              </span>
            )}
            {isReadOnly && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Read only</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Info + Actions */}
        <div className="lg:col-span-2 space-y-4">

          {/* Task Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-gray-900 font-medium mb-4 text-base leading-relaxed">{task.description}</p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {task.client && (
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Client</span>
                  <span className="font-medium text-gray-800">{task.client.company || task.client.name}</span>
                </div>
              )}
              {task.product_type && (
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Product Type</span>
                  <span className="font-medium text-gray-800">{task.product_type.name}</span>
                </div>
              )}
              {task.dimensions && (
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Dimensions</span>
                  <span className="font-medium text-gray-800">{task.dimensions}</span>
                </div>
              )}
              {task.deadline && (
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Deadline</span>
                  <span className={`font-medium flex items-center gap-1 ${new Date(task.deadline) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>
                    <CalendarDays size={12} />
                    {new Date(task.deadline).toLocaleDateString('en-IN')}
                  </span>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Priority</span>
                <span className={`font-semibold capitalize ${task.priority === 'critical' ? 'text-red-600' : task.priority === 'urgent' ? 'text-orange-500' : 'text-gray-700'}`}>
                  {task.priority}
                </span>
              </div>
              {task.assigned_user && (
                <div>
                  <span className="text-xs text-gray-400 block mb-0.5">Assigned To</span>
                  <span className="font-medium text-gray-800 flex items-center gap-1">
                    <User size={12} /> {task.assigned_user.full_name}
                  </span>
                </div>
              )}
            </div>

            {/* Live Timer */}
            {currentStatus === 'live' && openSession && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <LiveTimer
                  startTime={openSession.session_start}
                  accumulatedMinutes={accumulatedMinutes}
                />
              </div>
            )}

            {/* Time Summary (when not live) */}
            {timeSummary && timeSummary.total_minutes > 0 && currentStatus !== 'live' && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                <Clock size={14} className="text-gray-400" />
                Total time: <strong>{formatDuration(timeSummary.total_minutes)}</strong>
                <span className="text-gray-400">({timeSummary.session_count} session{timeSummary.session_count !== 1 ? 's' : ''})</span>
              </div>
            )}
          </div>

          {/* Status Action Buttons */}
          {canAct && currentStatus !== 'end' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map(nextStatus => {
                  const Icon = STATUS_BUTTON_ICON[nextStatus];
                  return (
                    <button
                      key={nextStatus}
                      onClick={() => handleStatusButton(nextStatus)}
                      disabled={actionLoading}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-semibold transition-colors disabled:opacity-50
                        ${STATUS_BUTTON_STYLE[nextStatus]}`}
                    >
                      {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                      {STATUS_BUTTON_LABEL[nextStatus]}
                    </button>
                  );
                })}

                {/* Transfer button (admin only) */}
                {isAdmin && (
                  <button
                    onClick={() => setShowTransferModal(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                  >
                    <ArrowRightLeft size={14} /> Transfer
                  </button>
                )}
              </div>
              {error && (
                <p className="mt-3 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
            </div>
          )}

          {/* End Summary */}
          {currentStatus === 'end' && timeSummary && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h3 className="font-bold text-emerald-800">Task Completed</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-emerald-600">Total Time</span>
                  <p className="font-bold text-emerald-900">{formatDuration(timeSummary.total_minutes)}</p>
                </div>
                <div>
                  <span className="text-xs text-emerald-600">Total Reworks</span>
                  <p className="font-bold text-emerald-900">{task.rework_count}</p>
                </div>
                <div>
                  <span className="text-xs text-emerald-600">Started</span>
                  <p className="font-bold text-emerald-900">{new Date(task.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <span className="text-xs text-emerald-600">Completed</span>
                  <p className="font-bold text-emerald-900">{new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleStatusButton('rework')}
                  className="mt-4 flex items-center gap-2 px-3 py-1.5 text-xs border border-emerald-300 rounded-lg text-emerald-700 hover:bg-emerald-100"
                >
                  <RotateCcw size={12} /> Reopen with Rework
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Dossier Timeline */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock size={14} /> Task History
              <span className="ml-auto text-xs text-gray-400">{dossier.length} events</span>
            </h3>
            {dossier.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No history yet</p>
            ) : (
              <DossierTimeline entries={dossier} />
            )}
          </div>
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* Hold Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Pause size={16} className="text-orange-500" /> Hold Task
            </h3>
            <p className="text-sm text-gray-600 mb-3">Select a reason to put this task on hold:</p>
            <div className="space-y-2 mb-4">
              {HOLD_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setHoldReason(r)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors
                    ${holdReason === r ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            {holdReason === 'Other' && (
              <input
                autoFocus
                value={holdCustomReason}
                onChange={e => setHoldCustomReason(e.target.value)}
                placeholder="Describe the reason..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-orange-300"
              />
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowHoldModal(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleHoldConfirm}
                disabled={!holdReason || (holdReason === 'Other' && !holdCustomReason)}
                className="flex-1 px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rework Modal */}
      {showReworkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <RotateCcw size={16} className="text-red-500" /> Mark as Rework
            </h3>
            <p className="text-sm text-gray-600 mb-2">What needs to change?</p>
            <textarea
              autoFocus
              value={reworkNotes}
              onChange={e => setReworkNotes(e.target.value)}
              rows={3}
              placeholder="Describe what needs to be reworked..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none mb-4 focus:outline-none focus:ring-1 focus:ring-red-300"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowReworkModal(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleReworkConfirm}
                disabled={!reworkNotes.trim()}
                className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40"
              >
                Confirm Rework
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal (admin only) */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-blue-500" /> Transfer Task
            </h3>
            <DesignerAvailabilityDropdown
              value={transferTo}
              onChange={setTransferTo}
              isAdmin={true}
              label="Transfer To"
            />
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Reason (optional)</label>
              <textarea
                value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
                rows={2}
                placeholder="Why is this task being transferred?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowTransferModal(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleTransferConfirm}
                disabled={!transferTo || actionLoading}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
