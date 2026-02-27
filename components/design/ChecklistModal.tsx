'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from '@/lib/toast';
import {
    X, CheckSquare, Save, Loader2, AlertCircle,
    ToggleLeft, Type, Hash, AlignLeft, List, AlertTriangle
} from 'lucide-react';
import { useJobChecklists, useJobs } from '@/lib/hooks';
import { Job } from '@/types/database';
import { logActivity } from '@/lib/logger';
import { useAuth } from '@/lib/auth-context';
import type { ChecklistItem, ChecklistItemType } from '@/app/admin/settings/production/page';

interface ChecklistModalProps {
    job: Job;
    onClose: () => void;
    onSave?: () => void;
}

// Normalize old string[] items
function normalizeItems(raw: any[]): ChecklistItem[] {
    return (raw || []).map(i =>
        typeof i === 'string'
            ? { label: i, type: 'checkbox' as ChecklistItemType, required: false }
            : i
    );
}

/** Returns true if the item is considered "filled" */
function isFilled(value: any, type: ChecklistItemType): boolean {
    if (type === 'checkbox') return value === true;
    return value !== undefined && value !== null && String(value).trim() !== '';
}

const typeIcon: Record<ChecklistItemType, React.ReactNode> = {
    checkbox: <ToggleLeft size={14} />,
    short_text: <Type size={14} />,
    number: <Hash size={14} />,
    long_text: <AlignLeft size={14} />,
    dropdown: <List size={14} />,
};

export default function ChecklistModal({ job, onClose, onSave }: ChecklistModalProps) {
    const { checklists, loading: loadingChecklists } = useJobChecklists();
    const { updateJob } = useJobs();
    const { profile } = useAuth();

    // progress: { [label]: true | string | number }
    const [progress, setProgress] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState(false);
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);

    useEffect(() => {
        if (job.checklist_progress) setProgress(job.checklist_progress as Record<string, any>);
    }, [job]);

    // Match by product_category (Pouch, Banner etc.) first, then job_type, then Other
    const matchedChecklist = useMemo(() => {
        if (!checklists) return null;
        const productCat = (job as any).product_category || '';
        return checklists.find(c => productCat && c.job_type.toLowerCase() === productCat.toLowerCase())
            || checklists.find(c => c.job_type.toLowerCase() === job.job_type?.toLowerCase())
            || checklists.find(c => c.job_type === 'Other')
            || checklists[0];
    }, [checklists, job]);

    const items: ChecklistItem[] = useMemo(
        () => normalizeItems(matchedChecklist?.items || []),
        [matchedChecklist]
    );

    // Derived stats
    const requiredItems = items.filter(i => i.required);
    const missingRequired = requiredItems.filter(i => !isFilled(progress[i.label], i.type));
    const filledCount = items.filter(i => isFilled(progress[i.label], i.type)).length;
    const isComplete = filledCount === items.length && items.length > 0;

    const setValue = (label: string, value: any) => {
        setProgress(prev => ({ ...prev, [label]: value }));
    };

    const handleSave = async () => {
        setAttemptedSubmit(true);
        if (missingRequired.length > 0) {
            toast.error(`${missingRequired.length} required field(s) must be filled before saving.`);
            return;
        }
        setSaving(true);
        try {
            const { error } = await updateJob(job.id, { checklist_progress: progress });
            if (error) throw error;
            // Log to activity trail
            logActivity('checklist', 'Design', job.id,
                `Checklist saved for ${job.job_number} (${job.project_name || ''}) by ${profile?.full_name || 'designer'}`,
                undefined, profile?.id
            );
            if (onSave) onSave();
            onClose();
        } catch {
            toast.error('Failed to save checklist progress');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-md w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gray-900 px-5 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-white font-bold flex items-center gap-2">
                            <CheckSquare size={18} className="text-white/70" />
                            Pre-Print Checklist
                        </h2>
                        <p className="text-white/50 text-xs mt-0.5">
                            Template: <span className="text-white/80 font-medium">{matchedChecklist?.job_type || 'Other'}</span>
                            {' · '}{(job as any).product_category || job.job_type || 'General'}{' · '}{job.job_number}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Progress bar */}
                {items.length > 0 && (
                    <div className="px-5 pt-4 shrink-0">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
                            <span>Progress</span>
                            <span>{filledCount} / {items.length} items</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
                                style={{ width: `${(filledCount / items.length) * 100}%` }} />
                        </div>
                    </div>
                )}

                {/* Required warning */}
                {attemptedSubmit && missingRequired.length > 0 && (
                    <div className="mx-5 mt-3 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 shrink-0">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>Fill in all required fields (*) before completing the checklist.</span>
                    </div>
                )}

                {/* Content */}
                <div className="px-5 py-4 overflow-y-auto flex-1">
                    {loadingChecklists ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <Loader2 className="animate-spin mb-3 text-primary" size={28} />
                            <p className="text-sm">Loading checklist…</p>
                        </div>
                    ) : !matchedChecklist ? (
                        <div className="text-center py-12 bg-gray-50 rounded-md border-2 border-dashed border-gray-200">
                            <AlertCircle className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                            <p className="text-gray-500 text-sm">No checklist template found for &quot;{job.job_type}&quot;.</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">No items configured for this checklist.</div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item, idx) => {
                                const value = progress[item.label];
                                const filled = isFilled(value, item.type);
                                const missing = attemptedSubmit && item.required && !filled;

                                return (
                                    <div key={idx} className={`rounded-md border transition-all ${missing ? 'border-red-300 bg-red-50'
                                        : filled ? 'border-green-200 bg-green-50'
                                            : 'border-gray-200 bg-white'
                                        }`}>
                                        {/* Item label row */}
                                        <div className="flex items-center gap-2 px-3 py-2">
                                            <span className="text-gray-400 shrink-0">{typeIcon[item.type]}</span>
                                            <span className={`text-sm font-medium flex-1 ${filled ? 'text-green-800' : 'text-gray-700'}`}>
                                                {item.label}
                                            </span>
                                            {item.required && (
                                                <span className={`text-xs font-bold shrink-0 ${missing ? 'text-red-500' : 'text-gray-400'}`}>*</span>
                                            )}
                                            {filled && item.type === 'checkbox' && (
                                                <span className="text-green-500 shrink-0">✓</span>
                                            )}
                                        </div>

                                        {/* Input area */}
                                        <div className="px-3 pb-3">
                                            {item.type === 'checkbox' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setValue(item.label, !value)}
                                                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-md border text-sm font-medium transition-all ${value
                                                        ? 'bg-green-500 text-white border-green-500'
                                                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary/40'
                                                        }`}
                                                >
                                                    <CheckSquare size={16} />
                                                    {value ? 'Done ✓' : 'Mark as done'}
                                                </button>
                                            )}

                                            {item.type === 'short_text' && (
                                                <input
                                                    type="text"
                                                    value={value || ''}
                                                    onChange={e => setValue(item.label, e.target.value)}
                                                    placeholder={item.placeholder || 'Enter value…'}
                                                    className={`w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 ${missing ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary/20'
                                                        }`}
                                                />
                                            )}

                                            {item.type === 'number' && (
                                                <input
                                                    type="number"
                                                    value={value ?? ''}
                                                    onChange={e => setValue(item.label, e.target.value === '' ? '' : Number(e.target.value))}
                                                    placeholder={item.placeholder || 'Enter number…'}
                                                    className={`w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 ${missing ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary/20'
                                                        }`}
                                                />
                                            )}

                                            {item.type === 'long_text' && (
                                                <textarea
                                                    value={value || ''}
                                                    onChange={e => setValue(item.label, e.target.value)}
                                                    placeholder={item.placeholder || 'Enter notes…'}
                                                    rows={3}
                                                    className={`w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 resize-none ${missing ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary/20'
                                                        }`}
                                                />
                                            )}

                                            {item.type === 'dropdown' && (
                                                <select
                                                    value={value || ''}
                                                    onChange={e => setValue(item.label, e.target.value)}
                                                    className={`w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 ${missing ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary/20'
                                                        }`}
                                                >
                                                    <option value="">— Select —</option>
                                                    {(item.options || []).map((opt, oi) => (
                                                        <option key={oi} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t bg-gray-50/50 flex justify-between items-center gap-3 shrink-0">
                    <div className="text-xs text-gray-500">
                        {missingRequired.length > 0
                            ? <span className="text-red-500 font-medium">{missingRequired.length} required field(s) missing</span>
                            : isComplete
                                ? <span className="text-green-600 font-medium">✓ All items complete</span>
                                : <span>{items.length - filledCount} item(s) remaining</span>
                        }
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-md font-semibold text-gray-600 hover:bg-white text-sm">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving || loadingChecklists || !matchedChecklist}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 text-sm">
                            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                            {saving ? 'Saving…' : 'Save Progress'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
