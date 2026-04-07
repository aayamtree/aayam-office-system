'use client';

import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { Calendar, User, AlertTriangle } from 'lucide-react';

export default function Timeline() {
    const { jobs, loading } = useJobs({
        filter: [{ column: 'current_stage', value: ['new', 'awaiting_admin', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready'], op: 'in' }]
    });
    const { clients } = useClients();
    const { designers } = useDesigners();

    const activeTasks = (jobs || [])
        .filter(job => job.current_stage !== 'delivered' && job.current_stage !== 'dispatched')
        .filter(job => job.client_deadline)
        .map(job => ({
            id: job.id,
            title: job.project_name,
            client: (clients.find(c => c.id === job.client_id) as any)?.company || clients.find(c => c.id === job.client_id)?.name || 'Unknown',
            designer: designers.find(d => d.id === job.designer_id)?.name || 'Unassigned',
            deadline: new Date(job.client_deadline!),
            status: job.current_stage,
            priority: job.priority
        }))
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

    // Stage accent colors — left-border palette aligned with app theme
    const stageAccent: Record<string, { border: string; tint: string; badge: string }> = {
        new: { border: 'border-l-stone-400', tint: 'bg-stone-50/80', badge: 'bg-stone-100 text-stone-700' },
        awaiting_admin: { border: 'border-l-amber-400', tint: 'bg-amber-50/80', badge: 'bg-amber-100 text-amber-700' },
        designing: { border: 'border-l-indigo-400', tint: 'bg-indigo-50/80', badge: 'bg-indigo-100 text-indigo-700' },
        approval: { border: 'border-l-violet-400', tint: 'bg-violet-50/80', badge: 'bg-violet-100 text-violet-700' },
        printing: { border: 'border-l-orange-400', tint: 'bg-orange-50/80', badge: 'bg-orange-100 text-orange-700' },
        finishing: { border: 'border-l-yellow-400', tint: 'bg-yellow-50/80', badge: 'bg-yellow-100 text-yellow-700' },
        quality_check: { border: 'border-l-cyan-400', tint: 'bg-cyan-50/80', badge: 'bg-cyan-100 text-cyan-700' },
        ready: { border: 'border-l-green-400', tint: 'bg-green-50/80', badge: 'bg-green-100 text-green-700' },
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 px-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-card rounded-md border border-border border-l-4 border-l-stone-300 animate-pulse">
                        <div className="h-8 bg-muted rounded-t-md" />
                        <div className="p-3 space-y-2">
                            <div className="h-4 w-3/4 bg-muted rounded" />
                            <div className="h-3 w-1/2 bg-muted rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2 md:space-y-4 px-2 animate-fade-in">
            <div>
                <h1 className="text-page-title text-foreground">Production Timeline</h1>
                <p className="text-xs md:text-sm text-muted-foreground">{activeTasks.length} active jobs with deadlines</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                {activeTasks.map((task) => {
                    const daysLeft = Math.ceil((task.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysLeft < 0;
                    const isUrgent = task.priority === 'urgent';
                    const accent = stageAccent[task.status] || stageAccent.new;

                    return (
                        <div key={task.id} className={`bg-card rounded-md border border-border border-l-4 ${accent.border} hover:shadow-sm transition-shadow ${isOverdue ? 'ring-1 ring-red-200' : ''}`}>
                            {/* Tinted top strip */}
                            <div className={`${accent.tint} px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md`}>
                                <div className="flex items-center gap-1 min-w-0">
                                    {isOverdue && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                                    <span className="text-xs font-bold text-foreground truncate">{task.title}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                    {isUrgent && !isOverdue && (
                                        <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold uppercase">Urgent</span>
                                    )}
                                    {isOverdue ? (
                                        <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-bold">
                                            {Math.abs(daysLeft)}d overdue
                                        </span>
                                    ) : (
                                        <span className="text-[9px] text-muted-foreground">{daysLeft}d left</span>
                                    )}
                                </div>
                            </div>

                            {/* Card body */}
                            <div className="px-3 pt-2 pb-3 space-y-2">
                                <p className="text-[10px] text-muted-foreground">
                                    {task.deadline.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">{task.client}</p>
                                <div className="flex flex-wrap items-center gap-1">
                                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        <User size={9} />
                                        {task.designer}
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${accent.badge}`}>
                                        {task.status?.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {activeTasks.length === 0 && (
                    <div className="col-span-full bg-card rounded-md border border-border p-12 text-center">
                        <Calendar className="mx-auto mb-3 text-muted-foreground/30" size={36} />
                        <p className="text-muted-foreground font-medium text-sm">No tasks with deadlines</p>
                    </div>
                )}
            </div>
        </div>
    );
}
