'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { IndianRupee, Gift, Loader2, Check } from 'lucide-react';

export type DesignBilling = 'billable' | 'non_billable';

interface Props {
  jobId: string;
  value?: DesignBilling | null;
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
  readOnly = false,
  size = 'sm',
  onChange,
}: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [current, setCurrent] = useState<DesignBilling>(value === 'billable' ? 'billable' : 'non_billable');
  const [saving, setSaving] = useState(false);

  const meta = META[current];
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  const iconSz = size === 'md' ? 14 : 11;

  const canEdit = isAdmin && !readOnly;

  const handleToggle = async () => {
    if (!canEdit || saving) return;
    const next: DesignBilling = current === 'billable' ? 'non_billable' : 'billable';
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
      onChange?.(next);
      toast.success(`Marked ${META[next].label}`);
    } catch (e: any) {
      toast.error(e.message || 'Could not update tag');
    } finally {
      setSaving(false);
    }
  };

  const base = `inline-flex items-center gap-1 rounded-full border font-bold tracking-wide ${pad} ${meta.cls}`;

  if (!canEdit) {
    return (
      <span className={base} title={current === 'billable' ? 'Design is charged to the client' : 'Free design — keep it fast'}>
        <meta.Icon size={iconSz} />
        {meta.label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      title="Admin: click to switch billable / non-billable"
      className={`${base} cursor-pointer hover:brightness-95 transition disabled:opacity-60`}
    >
      {saving ? <Loader2 size={iconSz} className="animate-spin" /> : <meta.Icon size={iconSz} />}
      {meta.label}
    </button>
  );
}
