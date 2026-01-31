'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, CheckSquare, Square, Save, Loader2, AlertCircle } from 'lucide-react';
import { useJobChecklists, useJobs } from '@/lib/hooks';
import { Job, JobChecklist } from '@/types/database';

interface ChecklistModalProps {
    job: Job;
    onClose: () => void;
    onSave?: () => void;
}

export default function ChecklistModal({ job, onClose, onSave }: ChecklistModalProps) {
    const { checklists, loading: loadingChecklists } = useJobChecklists();
    const { updateJob } = useJobs();

    const [progress, setProgress] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);

    // Initialize progress from job data
    useEffect(() => {
        if (job.checklist_progress) {
            setProgress(job.checklist_progress);
        }
    }, [job]);

    // Find the relevant checklist template
    const matchedChecklist = useMemo(() => {
        if (!checklists || !job.job_type) return null;
        return checklists.find(c => c.job_type.toLowerCase() === job.job_type?.toLowerCase())
            || checklists.find(c => c.job_type === 'Other') // Fallback
            || checklists[0]; // Ultimate fallback
    }, [checklists, job.job_type]);

    const toggleItem = (item: string) => {
        setProgress(prev => ({
            ...prev,
            [item]: !prev[item]
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await updateJob(job.id, {
                checklist_progress: progress
            });

            if (error) throw error;

            if (onSave) onSave();
            onClose();
        } catch (err) {
            console.error('Failed to save checklist:', err);
            alert('Failed to save checklist progress');
        } finally {
            setSaving(false);
        }
    };

    const completedCount = matchedChecklist?.items ? matchedChecklist.items.filter(i => progress[i]).length : 0;
    const totalCount = matchedChecklist?.items?.length || 0;
    const isComplete = totalCount > 0 && completedCount === totalCount;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg  overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h2 className="text-page-title text-gray-900 flex items-center gap-2">
                            <CheckSquare className="text-oms-blue" size={24} />
                            Quality Checklist
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {job.job_type || 'General'} Job • {job.job_number}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loadingChecklists ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <Loader2 className="animate-spin mb-3 text-oms-blue" size={32} />
                            <p>Loading checklist templates...</p>
                        </div>
                    ) : !matchedChecklist ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">No Checklist Found</h3>
                            <p className="text-gray-500">No checklist template found for &quot;{job.job_type}&quot;.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Progress Bar */}
                            <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-[rgba(0,0,255,0.1)]'}`}
                                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-gray-500">
                                <span>Progress</span>
                                <span>{completedCount} / {totalCount} items</span>
                            </div>

                            {/* Items List */}
                            <div className="space-y-3">
                                {matchedChecklist.items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => toggleItem(item)}
                                        className={`
                      flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group select-none
                      ${progress[item]
                                                ? 'bg-green-50 border-green-200'
                                                : 'bg-white border-gray-200 hover:border-oms-blue/20 hover:bg-gray-50'
                                            }
                    `}
                                    >
                                        <div className={`
                      w-6 h-6 rounded-md flex items-center justify-center border transition-colors shrink-0
                      ${progress[item]
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'bg-white border-gray-300 text-transparent group-hover:border-oms-blue-400'
                                            }
                    `}>
                                            <CheckSquare size={16} />
                                        </div>
                                        <span className={`font-medium ${progress[item] ? 'text-green-900 line-through decoration-green-300' : 'text-gray-700'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loadingChecklists || !matchedChecklist}
                        className="px-5 py-2.5 bg-[rgba(0,0,255,0.1)] text-white rounded-xl font-semibold hover:bg-[rgba(0,0,255,0.1)] transition-colors -200 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {saving ? 'Saving...' : 'Save Progress'}
                    </button>
                </div>
            </div>
        </div>
    );
}
