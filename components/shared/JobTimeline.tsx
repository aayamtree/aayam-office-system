'use client';

import { useEffect, useState } from 'react';
import { Clock, ArrowRight, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface StageChange {
    id: string;
    from_stage: string;
    to_stage: string;
    notes: string | null;
    created_at: string;
}

interface JobTimelineProps {
    jobId: string;
    stages: { id: string; name: string; color: string }[];
}

export default function JobTimeline({ jobId, stages }: JobTimelineProps) {
    const [history, setHistory] = useState<StageChange[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!jobId || !isSupabaseConfigured()) return;

        const fetchHistory = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('job_stage_history')
                .select('*')
                .eq('job_id', jobId)
                .order('created_at', { ascending: true });

            setHistory(data || []);
            setLoading(false);
        };

        fetchHistory();
    }, [jobId]);

    const getStageName = (stageId: string) =>
        stages.find(s => s.id === stageId)?.name || stageId?.replace(/_/g, ' ') || 'Unknown';

    const getStageColor = (stageId: string) =>
        stages.find(s => s.id === stageId)?.color || 'bg-gray-400';

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="text-center py-6 text-gray-400 text-sm">
                <Clock className="w-5 h-5 mx-auto mb-1" />
                No stage changes recorded yet
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200" />

            <div className="space-y-4">
                {history.map((change, i) => (
                    <div key={change.id} className="relative flex gap-3 items-start">
                        {/* Dot */}
                        <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getStageColor(change.to_stage)} text-white`}>
                            <span className="text-xs font-bold">{i + 1}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-gray-50 rounded-lg p-3 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-600">
                                    {getStageName(change.from_stage)}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-sm font-bold text-gray-900">
                                    {getStageName(change.to_stage)}
                                </span>
                            </div>

                            {change.notes && (
                                <p className="text-xs text-gray-500 mt-1">{change.notes}</p>
                            )}

                            <p className="text-xs text-gray-400 mt-1.5">
                                {new Date(change.created_at).toLocaleString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
