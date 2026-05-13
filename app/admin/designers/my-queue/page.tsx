'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useJobs, useDesigners } from '@/lib/hooks';
import { Calendar, Clock, User, AlertCircle, Search, Palette, Users, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { DesignerStatusBadge } from '@/components/shared/DesignerStatusPills';

// ─── Stage color config matching app theme ────────────────────────────────────
const stageConfig: Record<string, { borderColor: string; tintBg: string; badgeBg: string; badgeText: string; label: string }> = {
    new: { borderColor: 'border-l-stone-400', tintBg: 'bg-stone-50', badgeBg: 'bg-stone-100', badgeText: 'text-stone-600', label: 'To Do' },
    awaiting_admin: { borderColor: 'border-l-amber-400', tintBg: 'bg-amber-50/50', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700', label: 'Awaiting' },
    designing: { borderColor: 'border-l-violet-400', tintBg: 'bg-violet-50/60', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700', label: 'Designing' },
    approval: { borderColor: 'border-l-blue-400', tintBg: 'bg-blue-50/60', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', label: 'Approval' },
    printing: { borderColor: 'border-l-orange-400', tintBg: 'bg-orange-50/60', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700', label: 'Printing' },
    finishing: { borderColor: 'border-l-amber-400', tintBg: 'bg-amber-50/60', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700', label: 'Finishing' },
    quality_check: { borderColor: 'border-l-cyan-400', tintBg: 'bg-cyan-50/60', badgeBg: 'bg-cyan-100', badgeText: 'text-cyan-700', label: 'QC' },
    ready: { borderColor: 'border-l-green-400', tintBg: 'bg-green-50/60', badgeBg: 'bg-green-100', badgeText: 'text-green-700', label: 'Ready' },
};

// ─── Priority groups ──────────────────────────────────────────────────────────
const priorityGroups = [
    { key: 'urgent', label: '🔴 Urgent', textCls: 'text-red-600', borderCls: 'border-red-200', bgCls: 'bg-red-50/50' },
    { key: 'high', label: '🟠 High Priority', textCls: 'text-orange-600', borderCls: 'border-orange-200', bgCls: 'bg-orange-50/30' },
    { key: 'normal', label: 'Normal', textCls: 'text-stone-500', borderCls: 'border-border', bgCls: 'bg-transparent' },
];

// ─── Deadline badge ───────────────────────────────────────────────────────────
function deadlineBadge(deadline: string | null | undefined) {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'bg-red-50 text-red-600 border border-red-200' };
    if (days === 0) return { label: 'Due Today', cls: 'bg-amber-50 text-amber-600 border border-amber-200' };
    if (days === 1) return { label: 'Tomorrow', cls: 'bg-amber-50 text-amber-500 border border-amber-200' };
    return { label: `${days}d left`, cls: 'bg-stone-100 text-stone-500 border border-stone-200' };
}

// ─── Job type badges ──────────────────────────────────────────────────────────
const jobTypeBadge: Record<string, { label: string; bg: string; text: string }> = {
    'Design': { label: 'Design', bg: 'bg-violet-100', text: 'text-violet-700' },
    'Printing': { label: 'Print', bg: 'bg-orange-100', text: 'text-orange-700' },
    'Design + Printing': { label: 'Design+Print', bg: 'bg-sky-100', text: 'text-sky-700' },
    'Design + Print': { label: 'Design+Print', bg: 'bg-sky-100', text: 'text-sky-700' },
};

export default function UnifiedQueue() {
    const { profile } = useAuth();
    const { designers } = useDesigners();  // already filtered — no placeholders
    // Build a quick lookup map: profileId → full_name
    const profileMap = Object.fromEntries((designers || []).map((d: any) => [d.id, d.full_name || d.name]));

    const { jobs, loading } = useJobs({
        // Remove designer:profiles join — replaced by manual profileMap lookup
        select: 'id, project_name, job_number, current_stage, priority, client_deadline, designer_id, job_type, product_category, designer_status, client:clients(id, name, company)',
        filter: [{ column: 'current_stage', value: ['new', 'awaiting_admin', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready'], op: 'in' }]
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const isAdmin = profile?.role === 'admin';

    const allTasks = (jobs || [])
        .filter(job => !['delivered', 'dispatched', 'cancelled'].includes(job.current_stage))
        .map((job: any) => ({
            id: job.id,
            title: job.project_name,
            client: job.client?.company || job.client?.name || 'Unknown',
            designer: job.designer_id ? (profileMap[job.designer_id] || 'Unassigned') : 'Unassigned',
            designerId: job.designer_id,
            status: job.current_stage || 'new',
            taskStatus: (job as any).designer_status || null,
            priority: job.priority || 'normal',
            deadline: job.client_deadline,
            jobNumber: job.job_number,
            jobType: (job as any).job_type || 'Design',
            isMyTask: isAdmin || job.designer_id === profile?.id,
        }));

    const visibleTasks = showAll ? allTasks : allTasks.filter(t => t.isMyTask);

    const filteredTasks = visibleTasks.filter(task =>
        (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.client || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.designer || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleGroup = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4 px-2 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-foreground flex items-center gap-2">
                        <Palette size={20} className="text-primary" /> Queue
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {showAll ? `${filteredTasks.length} team tasks` : `${filteredTasks.length} tasks assigned to you`}
                    </p>
                </div>
                {/* My Tasks / All Team toggle */}
                <div className="flex bg-card border border-border rounded-md overflow-hidden text-xs">
                    <button
                        onClick={() => setShowAll(false)}
                        className={`px-3 py-2 flex items-center gap-1.5 font-semibold transition-all ${!showAll ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <User size={12} /> My Tasks
                        <span className={`px-1.5 py-0.5 rounded ${!showAll ? 'bg-white/20' : 'bg-muted'}`}>
                            {allTasks.filter(t => t.isMyTask).length}
                        </span>
                    </button>
                    <button
                        onClick={() => setShowAll(true)}
                        className={`px-3 py-2 flex items-center gap-1.5 font-semibold transition-all border-l border-border ${showAll ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Users size={12} /> All Team
                        <span className={`px-1.5 py-0.5 rounded ${showAll ? 'bg-white/20' : 'bg-muted'}`}>
                            {allTasks.length}
                        </span>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input
                    type="text"
                    placeholder="Search tasks, clients, designers…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                />
            </div>

            {/* Tasks grouped by priority */}
            {filteredTasks.length === 0 ? (
                <div className="text-center py-16">
                    <Palette size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground font-medium">No tasks found</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        {showAll ? 'No active team tasks' : 'You have no assigned tasks right now'}
                    </p>
                </div>
            ) : (
                priorityGroups.map(group => {
                    const groupKey = group.key;
                    const tasks = filteredTasks.filter(t =>
                        groupKey === 'normal' ? !['urgent', 'high'].includes(t.priority) : t.priority === groupKey
                    );
                    if (!tasks.length) return null;
                    const isCollapsed = collapsedGroups.has(groupKey);

                    return (
                        <div key={groupKey} className="space-y-2">
                            {/* Group header */}
                            <button
                                onClick={() => toggleGroup(groupKey)}
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md border ${group.borderCls} ${group.bgCls} transition-all`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-semibold uppercase tracking-wide ${group.textCls}`}>{group.label}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${group.bgCls} ${group.textCls} border ${group.borderCls}`}>
                                        {tasks.length}
                                    </span>
                                </div>
                                {isCollapsed
                                    ? <ChevronDown className={`w-3.5 h-3.5 ${group.textCls}`} />
                                    : <ChevronUp className={`w-3.5 h-3.5 ${group.textCls}`} />
                                }
                            </button>

                            {!isCollapsed && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                                    {tasks.map(task => {
                                        const cfg = stageConfig[task.status] || stageConfig['new'];
                                        const dl = deadlineBadge(task.deadline);
                                        const isOverdue = dl?.label.includes('overdue');
                                        const typeTag = jobTypeBadge[task.jobType] || { label: task.jobType, bg: 'bg-muted', text: 'text-muted-foreground' };
                                        const isEditable = task.isMyTask;

                                        return (
                                            <Link
                                                key={task.id}
                                                href={isEditable ? `/admin/designers/tasks?view=my_tasks&task=${task.id}` : '#'}
                                                onClick={e => !isEditable && e.preventDefault()}
                                            >
                                                <div className={`
                          bg-card rounded-md border border-border border-l-4 ${cfg.borderColor}
                          hover:shadow-sm transition-shadow
                          ${isOverdue ? 'ring-1 ring-red-200' : ''}
                          ${!isEditable ? 'opacity-75' : ''}
                        `}>
                                                    {/* Card top */}
                                                    <div className={`${cfg.tintBg} px-3 py-2 flex items-center justify-between rounded-tr-md border-b border-border/50`}>
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className="text-[10px] font-mono text-muted-foreground truncate">#{task.jobNumber}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${typeTag.bg} ${typeTag.text}`}>
                                                                {typeTag.label}
                                                            </span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${cfg.badgeBg} ${cfg.badgeText}`}>
                                                                {cfg.label}
                                                            </span>
                                                            {/* Designer task status badge (Live / Hold / Review / End) */}
                                                            <DesignerStatusBadge status={task.taskStatus} />
                                                        </div>
                                                    </div>

                                                    {/* Card body */}
                                                    <div className="px-3 pt-2 pb-3 space-y-2">
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground truncate leading-tight">{task.client}</p>
                                                            <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mt-0.5">{task.title}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                                                                <User size={9} /> {task.designer}
                                                            </span>
                                                            {dl && (
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dl.cls}`}>{dl.label}</span>
                                                            )}
                                                        </div>
                                                        {!isEditable && (
                                                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider text-center border-t border-border pt-1.5">
                                                                View Only
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}
