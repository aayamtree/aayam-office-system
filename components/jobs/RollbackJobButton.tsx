'use client';

/**
 * Admin-only "Roll back" button for a job. Opens a small box: pick the earlier stage,
 * type WHY, confirm. The database records who, when and why.
 * Reads the job's current stage itself, so it can be dropped on any card or page.
 */
import { useState } from 'react';
import { Undo2, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { getStageName } from '@/lib/job-workflow';
import { getRollbackTargets, describeRollbackEffects, rollbackJob, type RollbackTarget } from '@/lib/job-rollback';

interface Props {
    jobId: string;
    /** Called after a successful rollback so the page can refresh. */
    onDone?: () => void;
    /** Small text-style button for crowded cards. */
    compact?: boolean;
    label?: string;
}

export default function RollbackJobButton({ jobId, onDone, compact = true, label = 'Roll back' }: Props) {
    const { profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [job, setJob] = useState<any>(null);
    const [targets, setTargets] = useState<RollbackTarget[]>([]);
    const [toStage, setToStage] = useState('');
    const [reason, setReason] = useState('');

    if (profile?.role !== 'admin') return null;

    const openBox = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setOpen(true);
        setLoading(true);
        setReason('');
        const { data, error } = await supabase
            .from('jobs')
            .select('id, job_number, project_name, job_type, current_stage')
            .eq('id', jobId)
            .single();
        setLoading(false);
        if (error || !data) { toast.error('Could not load the job'); setOpen(false); return; }
        const t = getRollbackTargets(data.job_type, data.current_stage);
        setJob(data);
        setTargets(t);
        // Default: one step back.
        setToStage(t.length ? t[t.length - 1].stage : '');
    };

    const close = () => { if (!saving) setOpen(false); };

    const confirm = async () => {
        if (!job || !toStage) return;
        if (reason.trim().length < 5) { toast.error('Please write the reason (at least a few words)'); return; }
        setSaving(true);
        const res = await rollbackJob(job.id, toStage, reason);
        setSaving(false);
        if (!res.ok) { toast.error(res.error || 'Rollback failed'); return; }
        toast.success(`${job.job_number} rolled back to ${getStageName(toStage)}`);
        setOpen(false);
        onDone?.();
    };

    const effects = job && toStage ? describeRollbackEffects(job.job_type, job.current_stage, toStage) : [];

    return (
        <>
            <button
                type="button"
                onClick={openBox}
                title="Move this job back to an earlier stage (admin only, reason is recorded)"
                className={compact
                    ? 'inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 whitespace-nowrap'
                    : 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 whitespace-nowrap'}
            >
                <Undo2 className={compact ? 'w-3 h-3' : 'w-4 h-4'} /> {label}
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={close}>
                    <div className="bg-white rounded-md w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <div className="min-w-0">
                                <h2 className="text-section font-semibold">Roll back job</h2>
                                {job && <p className="text-xs text-gray-500 truncate">#{job.job_number} · {job.project_name}</p>}
                            </div>
                            <button onClick={close} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="p-4 space-y-3">
                            {loading || !job ? (
                                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                            ) : targets.length === 0 ? (
                                <p className="text-sm text-gray-600">This job is at the first stage of its flow — there is nothing earlier to go back to.</p>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-700">
                                        Now at <b>{getStageName(job.current_stage)}</b>. Go back to:
                                    </p>
                                    <select
                                        value={toStage}
                                        onChange={e => setToStage(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                                    >
                                        {targets.map(t => <option key={t.stage} value={t.stage}>{t.label}</option>)}
                                    </select>

                                    {effects.length > 0 && (
                                        <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5 space-y-1 list-disc list-inside">
                                            {effects.map((x, i) => <li key={i}>{x}</li>)}
                                        </ul>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Why? <span className="text-red-500">*</span></label>
                                        <textarea
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                            rows={3}
                                            placeholder="e.g. Moved to Dispatch by mistake — still in design"
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">Saved with your name and the time. Anyone can see it in the job history.</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 p-4 border-t">
                            <button onClick={close} disabled={saving} className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">Cancel</button>
                            {targets.length > 0 && (
                                <button
                                    onClick={confirm}
                                    disabled={saving || loading || !toStage || reason.trim().length < 5}
                                    className="px-3 py-2 text-sm rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                                >
                                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Roll back
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
