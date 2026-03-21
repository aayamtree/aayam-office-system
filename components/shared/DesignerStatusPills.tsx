'use client';

/**
 * DesignerStatusPills — shared task status pill selector
 *
 * Single source of truth for all designer task status UI across the system.
 * Reads/writes to jobs.designer_status via /api/jobs/[id]/designer-status.
 *
 * Statuses (single DB column: jobs.designer_status):
 *   live     — actively working
 *   hold     — paused / waiting for something
 *   review   — sent for client or internal review
 *   end      — work done, ready to hand off
 *   transfer — reassign to another designer
 */

import { useState } from 'react';
import { Play, Pause, CheckSquare, RotateCcw, ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';

export const DESIGNER_STATUSES = [
  {
    status: 'live',
    label: 'Live',
    icon: Play,
    pill: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200',
    active: 'bg-green-600 text-white border-green-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  {
    status: 'hold',
    label: 'Hold',
    icon: Pause,
    pill: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200',
    active: 'bg-orange-500 text-white border-orange-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    status: 'review',
    label: 'Review',
    icon: CheckSquare,
    pill: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200',
    active: 'bg-blue-600 text-white border-blue-600',
    badge: 'bg-sky-100 text-sky-700',
  },
  {
    status: 'end',
    label: 'End',
    icon: RotateCcw,
    pill: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200',
    active: 'bg-emerald-600 text-white border-emerald-600',
    badge: 'bg-stone-100 text-stone-600',
  },
  {
    status: 'transfer',
    label: 'Transfer',
    icon: ArrowRightLeft,
    pill: 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200',
    active: 'bg-purple-600 text-white border-purple-600',
    badge: 'bg-violet-100 text-violet-700',
  },
] as const;

export type DesignerStatus = typeof DESIGNER_STATUSES[number]['status'];

// ─── Read-only Badge ──────────────────────────────────────────────────────────
// Use when you only want to DISPLAY the status (not change it)
export function DesignerStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const cfg = DESIGNER_STATUSES.find(s => s.status === status);
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${cfg.badge} border-current/20`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ─── Interactive Pill Selector ────────────────────────────────────────────────
// Full pill bar — use on project detail pages (new-project, tasks detail panel)
interface DesignerStatusPillsProps {
  jobId: string;
  currentStatus: string | null;
  onStatusChange?: (newStatus: string) => void;
  /** Pass designers list to enable transfer dropdown */
  designers?: { id: string; full_name: string }[];
  onTransfer?: (designerId: string) => void;
  disabled?: boolean;
  /** 'bar' = full pill row (default), 'compact' = smaller pills */
  size?: 'bar' | 'compact';
  /**
   * Role-based access control — auto-enforced in UI.
   * API is the real gatekeeper, this is just for UX clarity.
   * - 'admin'    → full access, all buttons including Transfer
   * - 'designer' → full access if currentUserId === assignedDesignerId
   * - others     → read-only DesignerStatusBadge shown instead
   */
  userRole?: string;
  currentUserId?: string;
  assignedDesignerId?: string;
}

export function DesignerStatusPills({
  jobId,
  currentStatus,
  onStatusChange,
  designers,
  onTransfer,
  disabled = false,
  size = 'bar',
  userRole,
  currentUserId,
  assignedDesignerId,
}: DesignerStatusPillsProps) {
  const [updating, setUpdating] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferToId, setTransferToId] = useState('');

  // ── Role-based access: non admin/designer → read-only badge ──────────────
  const isAdmin = userRole === 'admin';
  const isAssignedDesigner = userRole === 'designer' && currentUserId === assignedDesignerId;
  const canEdit = !userRole || isAdmin || isAssignedDesigner; // no userRole = unrestricted (legacy/preview)

  if (!canEdit) {
    return <DesignerStatusBadge status={currentStatus} />;
  }

  const handleChange = async (newStatus: string) => {
    if (disabled || updating || newStatus === currentStatus) return;
    if (newStatus === 'transfer') { setShowTransfer(true); return; }

    setUpdating(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/designer-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designer_status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      onStatusChange?.(newStatus);
      toast.success(`Status: ${newStatus.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferToId) { toast.error('Select a designer to transfer to'); return; }
    setUpdating(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/designer-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designer_status: 'transfer', designer_id: transferToId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Transfer failed');
      const name = designers?.find(d => d.id === transferToId)?.full_name || 'designer';
      onStatusChange?.('transfer');
      onTransfer?.(transferToId);
      toast.success(`Transferred to ${name}`);
      setShowTransfer(false);
      setTransferToId('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const isCompact = size === 'compact';

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap gap-2 ${isCompact ? '' : 'p-3 bg-gray-50 rounded-md border border-gray-200'}`}>
        {!isCompact && (
          <span className="text-xs font-semibold text-gray-500 self-center mr-1">Task Status:</span>
        )}
        {DESIGNER_STATUSES.map(cfg => {
          const Icon = cfg.icon;
          const isActive = currentStatus === cfg.status;
          return (
            <button
              key={cfg.status}
              onClick={() => handleChange(cfg.status)}
              disabled={disabled || updating}
              className={`
                inline-flex items-center gap-1.5 border rounded-full font-semibold transition-all
                ${isCompact ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}
                ${isActive ? cfg.active + ' shadow-sm' : cfg.pill}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {updating && isActive
                ? <Loader2 size={isCompact ? 9 : 11} className="animate-spin" />
                : <Icon size={isCompact ? 9 : 11} />
              }
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Transfer Panel */}
      {showTransfer && designers && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-md border border-purple-200">
          <ArrowRightLeft size={14} className="text-purple-600 shrink-0" />
          <select
            value={transferToId}
            onChange={e => setTransferToId(e.target.value)}
            className="flex-1 text-xs border border-purple-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">Select designer to transfer to...</option>
            {designers.map(d => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
          <button
            onClick={handleTransfer}
            disabled={updating || !transferToId}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {updating ? <Loader2 size={12} className="animate-spin" /> : 'Transfer'}
          </button>
          <button
            onClick={() => { setShowTransfer(false); setTransferToId(''); }}
            className="px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
