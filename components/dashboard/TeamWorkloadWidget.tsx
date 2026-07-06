'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useDesigners } from '@/lib/hooks';
import { Users, CheckCircle2, Briefcase } from 'lucide-react';

interface DesignerWorkload {
    designer_id: string;
    designer_name: string;
    tasks_done: number;
    tasks_allotted: number;
}

// Stages that mean design work is completed / moved past design
const DONE_STAGES = ['printing', 'finishing', 'ready', 'packed', 'dispatched', 'delivered'];

export default function TeamWorkloadWidget() {
    const { designers } = useDesigners();
    const [workloads, setWorkloads] = useState<DesignerWorkload[]>([]);
    const [period, setPeriod] = useState<'week' | 'month'>('week');
    const [loading, setLoading] = useState(false); // never set to true — no skeleton flash

    // PERF FIX: useDesigners() returns a new array reference every render (due to .map())
    // so [designers] as a dependency causes this effect to fire 70+ times/second.
    // Use designers.length as a stable primitive — only re-fetch when count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (designers.length > 0) {
            fetchWorkload(designers);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [designers.length, period]);

    const fetchWorkload = async (currentDesigners: typeof designers) => {
        try {
            // Compute startDate ONCE per fetch call, not per render
            const startDate = new Date();
            if (period === 'week') {
                startDate.setDate(startDate.getDate() - 7);
            } else {
                startDate.setDate(startDate.getDate() - 30);
            }
            const startISO = startDate.toISOString(); // stable — computed once per call

            // Fetch jobs assigned to designers in this period
            const { data: jobs } = await supabase
                .from('jobs')
                .select('designer_id, current_stage, created_at')
                .not('designer_id', 'is', null)
                .neq('current_stage', 'cancelled')
                .gte('created_at', startISO);

            // NOTE: design_tasks secondary fetch removed 2026-07-06 — table is empty/legacy
            // (workload is fully derived from jobs). It was adding a pointless DB query per refresh.

            // Group by designer from jobs
            const grouped: Record<string, { done: number; total: number }> = {};

            jobs?.forEach(j => {
                const dId = j.designer_id;
                if (!dId) return;
                if (!grouped[dId]) grouped[dId] = { done: 0, total: 0 };
                grouped[dId].total++;
                if (DONE_STAGES.includes(j.current_stage || '')) {
                    grouped[dId].done++;
                }
            });

            const result: DesignerWorkload[] = currentDesigners
                .filter(d => (d as any).is_active !== false)
                .map(d => ({
                    designer_id: d.id,
                    designer_name: (d as any).name || 'Unknown',
                    tasks_done: grouped[d.id]?.done || 0,
                    tasks_allotted: grouped[d.id]?.total || 0,
                }))
                .sort((a, b) => b.tasks_allotted - a.tasks_allotted);

            setWorkloads(result);
        } catch (error) {
            console.error('Error fetching workload:', error);
        }
    };


    const maxTasks = Math.max(...workloads.map(w => w.tasks_allotted), 1);

    return (
        <div className="bg-white rounded-lg border border-gray-100 p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    Team Workload
                </h3>
                <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
                    <button
                        onClick={() => setPeriod('week')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${period === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${period === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        30 Days
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse" />
                                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                                </div>
                                <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                        </div>
                    ))}
                </div>
            ) : workloads.length === 0 ? (
                <div className="text-center py-6">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No designers found</p>
                    <p className="text-xs text-gray-400">Add designers to see their workload</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {workloads.map(w => {
                        const barWidth = maxTasks > 0 ? (w.tasks_allotted / maxTasks) * 100 : 0;
                        const doneWidth = w.tasks_allotted > 0 ? (w.tasks_done / w.tasks_allotted) * 100 : 0;

                        return (
                            <Link key={w.designer_id} href="/admin/design-tasks" className="group block hover:bg-gray-50 rounded-md px-2 -mx-2 py-1 transition-colors cursor-pointer">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                            {w.designer_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">{w.designer_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-right">
                                        <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {w.tasks_done}
                                        </span>
                                        <span className="text-xs text-gray-400">/</span>
                                        <span className="flex items-center gap-1 text-xs font-semibold text-gray-600">
                                            <Briefcase className="w-3 h-3" />
                                            {w.tasks_allotted}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative" style={{ width: `${Math.max(barWidth, 20)}%` }}>
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${w.tasks_done > 0 ? 'bg-green-500' : 'bg-gray-200'}`}
                                        style={{ width: `${doneWidth}%` }}
                                    />
                                </div>
                            </Link>
                        );
                    })}

                    {workloads.every(w => w.tasks_allotted === 0) && (
                        <p className="text-xs text-gray-400 italic text-center mt-2">
                            No work allotted in this period yet.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
