'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { IndianRupee, Gift, Loader2, Check } from 'lucide-react';

export type DesignBilling = 'billable' | 'non_billable';

interface Props {
  jobId: string;
  value?: DesignBilling | null;
  /** false = a designer's suggestion awaiting admin confirmation. Defaults to true. */
  confirmed?: boolean;
  /** show only the pill, never the toggle, even for admins */
  readOnly?: boolean;
  size?: 'sm' | 'md';
  /** called after a successful admin change */
  onChange?: (next: DesignBilling) => void;
}

const META: Record<DesignBilling, { label: string; cls: string; Icon: typeof IndianRupee }> = {
  billable: {
    label: 'BILLABLE',
    cls: 'bg-green-100 text-green-700 border-green-300',
    Icon: IndianRupee,
  },
  non_billable: {
    label: 'NON-BILLABLE',
    cls: 'bg-amber-100 text-amber-700 border-amber-300',
    Icon: Gift,
  },
};

/**
 * Finance tag pill. Non-admins always see a read-only badge.
 * Admins get a one-click toggle (server enforces the admin gate too).
 *
 *  🟢 BILLABLE      → design is charged; full effort, revisions OK
 *  🟡 NON-BILLABLE  → free design; keep it fast, minimal revisions
 */
export default function DesignBillingBadge({
  jobId,
  value,
  confirmed = true,
  readOnly = false,
  size = 'sm',
  onChange,
}: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [current, setCurrent] = useState<DesignBilling>(value === 'billable' ? 'billable' : 'non_billable');
  const [isConfirmed, setIsConfirmed] = useState<boolean>(confirmed);
  const [saving, setSaving] = useState(false);

  const meta = META[current];
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  const iconSz = size === 'md' ? 14 : 11;

  const canEdit = isAdmin && !readOnly;

  // Persist a value (and mark confirmed). Admin action only.
  const save = async (next: DesignBilling) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/design-billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_billing: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setCurrent(next);
      setIsConfirmed(true);
      onChange?.(next);
      toast.success(next === current ? `Confirmed ${META[next].label}` : `Marked ${META[next].label}`);
    } catch (e: any) {
      toast.error(e.message || 'Could not update tag');
    } finally {
      setSaving(false);
    }
  };

  // Unconfirmed (designer suggestion): first admin click confirms as-is.
  // Confirmed: admin click toggles the value.
  const handleClick = () => save(isConfirmed ? (current === 'billable' ? 'non_billable' : 'billable') : current);

  const base = `inline-flex items-center gap-1 rounded-full border font-bold tracking-wide ${pad} ${meta.cls}`;

  // Read-only view (designers, other roles)
  if (!canEdit) {
    return (
      <span
        className={`${base} ${!isConfirmed ? 'border-dashed opacity-80' : ''}`}
        title={
          !isConfirmed
            ? 'Suggested — awaiting admin confirmation'
            : current === 'billable' ? 'Design is charged to the client' : 'Free design — keep it fast'
        }
      >
        <meta.Icon size={iconSz} />
        {meta.label}{!isConfirmed ? ' ?' : ''}
      </span>
    );
  }

  // Admin view
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving}
      title={isConfirmed
        ? 'Admin: click to switch billable / non-billable'
        : 'Designer suggestion — click to confirm (click again to switch)'}
      className={`${base} cursor-pointer hover:brightness-95 transition disabled:opacity-60 ${!isConfirmed ? 'border-dashed ring-1 ring-offset-1 ring-current/40 animate-pulse' : ''}`}
    >
      {saving ? <Loader2 size={iconSz} className="animate-spin" /> : !isConfirmed ? <Check size={iconSz} /> : <meta.Icon size={iconSz} />}
      {meta.label}{!isConfirmed ? ' · confirm' : ''}
    </button>
  );
}
