'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useDesigners } from '@/lib/hooks';
import { Users } from 'lucide-react';
import { ScrollList } from '@/components/ui/ScrollList';

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

    // ═══ 2026-09-14 restyle ═══════════════════════════════════════════
    // This card was the one Satish photographed: nine rows each reading
    // "0 / 0", inside a card stretched to match the chart beside it, so the
    // bottom third was empty. Three changes fix it, and none of them touch
    // the query above.
    //
    //   · A completion RING at the top gives the card a headline figure, so
    //     it has something to say before the roster begins.
    //   · Idle people recede — faded avatar, lighter name, empty track — so
    //     the eye lands on whoever is actually carrying work instead of
    //     sweeping nine identical zeros.
    //   · The footer states the split in words. "7 of 8 idle" is the fact he
    //     wanted from this card; it was previously something you had to
    //     count for yourself.
    //
    // The hardcoded bg-white / text-gray-* of the old version also meant this
    // card stayed light in dark mode. It is on semantic tokens now.
    const totalAllotted = workloads.reduce((n, w) => n + w.tasks_allotted, 0);
    const totalDone = workloads.reduce((n, w) => n + w.tasks_done, 0);
    const pct = totalAllotted > 0 ? Math.round((totalDone / totalAllotted) * 100) : 0;
    const idle = workloads.filter(w => w.tasks_allotted === 0);
    const busy = workloads.filter(w => w.tasks_allotted > 0);

    const R = 27;
    const C = 2 * Math.PI * R;

    return (
        <div className="flex min-w-0 flex-1 flex-col rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold tracking-[-0.008em]">Team workload</span>
                <div className="flex gap-0.5 rounded-full bg-muted p-0.5">
                    {(['week', 'month'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${period === p
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {p === 'week' ? '7 days' : '30 days'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex animate-pulse items-center gap-3">
                            <div className="h-6 w-6 shrink-0 rounded-full bg-muted" />
                            <div className="h-2.5 flex-1 rounded bg-muted" />
                            <div className="h-2.5 w-8 rounded bg-muted" />
                        </div>
                    ))}
                </div>
            ) : workloads.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
                    <Users className="h-7 w-7 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No designers found</p>
                    <p className="text-xs text-muted-foreground/70">Add designers to see their workload</p>
                </div>
            ) : (
                <>
                    {/* ── the headline: how much of what was given out came back ── */}
                    <div className="mb-3.5 flex items-center gap-4 border-b pb-3.5">
                        <div className="relative h-16 w-16 shrink-0">
                            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                                <circle cx="32" cy="32" r={R} fill="none" strokeWidth="8" className="stroke-muted" />
                                <circle
                                    cx="32" cy="32" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
                                    className="stroke-oms-orange transition-[stroke-dashoffset] duration-500"
                                    strokeDasharray={C}
                                    strokeDashoffset={C * (1 - pct / 100)}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[17px] font-bold tabular-nums tracking-[-0.02em]">{pct}%</span>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[15px] font-semibold tabular-nums">
                                {totalAllotted} {totalAllotted === 1 ? 'job' : 'jobs'} allotted
                            </p>
                            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                                {totalAllotted === 0
                                    ? 'Nothing given out in this period.'
                                    : totalDone === 0
                                        ? `None finished yet${busy.length === 1 ? ' — one designer carrying everything.' : '.'}`
                                        : `${totalDone} finished, ${totalAllotted - totalDone} still open.`}
                            </p>
                        </div>
                    </div>

                    {/* ── the roster, loaded first ── */}
                    <ScrollList size="md">
                        {[...busy, ...idle].map(w => {
                            const load = maxTasks > 0 ? (w.tasks_allotted / maxTasks) * 100 : 0;
                            const isIdle = w.tasks_allotted === 0;
                            return (
                                <Link
                                    key={w.designer_id}
                                    href="/admin/design-tasks"
                                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-[7px] transition-colors hover:bg-muted/50"
                                >
                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isIdle
                                        ? 'bg-muted text-muted-foreground/60'
                                        : 'bg-foreground text-background'}`}>
                                        {w.designer_name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className={`min-w-0 flex-1 truncate text-[12px] ${isIdle
                                        ? 'font-normal text-muted-foreground'
                                        : 'font-medium text-foreground'}`}>
                                        {w.designer_name}
                                    </span>
                                    <span className="h-[5px] w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                                        {!isIdle && (
                                            <span
                                                className="block h-full rounded-full bg-oms-orange transition-all duration-500"
                                                style={{ width: `${Math.max(load, 12)}%` }}
                                            />
                                        )}
                                    </span>
                                    <span className={`w-[34px] shrink-0 text-right text-[11.5px] tabular-nums ${isIdle
                                        ? 'font-medium text-muted-foreground/50'
                                        : 'font-semibold text-muted-foreground'}`}>
                                        {w.tasks_done}/{w.tasks_allotted}
                                    </span>
                                </Link>
                            );
                        })}
                    </ScrollList>

                    {idle.length > 0 && (
                        <p className="mt-auto border-t pt-3.5 text-[11.5px] leading-snug text-muted-foreground">
                            <span className="font-semibold text-foreground/75">
                                {idle.length} of {workloads.length} idle.
                            </span>{' '}
                            {busy.length === 0
                                ? 'Nothing is allotted to anyone in this period.'
                                : busy.length === 1
                                    ? `${busy[0].designer_name} is carrying the only work allotted.`
                                    : `${busy.length} people are carrying all of it.`}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
