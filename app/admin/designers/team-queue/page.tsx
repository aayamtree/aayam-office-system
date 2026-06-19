'use client';

import { useState } from 'react';
import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { Users, Search, User, Clock, LayoutGrid, List, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

// ─── Stage config matching app theme ─────────────────────────────────────────
const stageConfig: Record<string, { borderColor: string; tintBg: string; badgeBg: string; badgeText: string; label: string }> = {
    new: { borderColor: 'border-l-stone-400', tintBg: 'bg-stone-50', badgeBg: 'bg-stone-100', badgeText: 'text-stone-600', label: 'To Do' },
    awaiting_admin: { borderColor: 'border-l-amber-400', tintBg: 'bg-amber-50/50', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700', label: 'Awaiting' },
    designing: { borderColor: 'border-l-violet-400', tintBg: 'bg-violet-50/60', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700', label: 'Designing' },
    approval: { borderColor: 'border-l-blue-400', tintBg: 'bg-blue-50/60', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', label: 'Approval' },
    pre_print_qc: { borderColor: 'border-l-cyan-400', tintBg: 'bg-cyan-50/60', badgeBg: 'bg-cyan-100', badgeText: 'text-cyan-700', label: 'Pre-Print QC' },
    print_file_ready: { borderColor: 'border-l-blue-400', tintBg: 'bg-blue-50/60', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', label: 'File Ready' },
    file_sent_client: { borderColor: 'border-l-green-400', tintBg: 'bg-green-50/60', badgeBg: 'bg-green-100', badgeText: 'text-green-700', label: 'File Sent' },
    file_received: { borderColor: 'border-l-stone-400', tintBg: 'bg-stone-50', badgeBg: 'bg-stone-100', badgeText: 'text-stone-600', label: 'File In' },
    file_check: { borderColor: 'border-l-cyan-400', tintBg: 'bg-cyan-50/60', badgeBg: 'bg-cyan-100', badgeText: 'text-cyan-700', label: 'Printability QC' },
    ready_to_print: { borderColor: 'border-l-indigo-400', tintBg: 'bg-indigo-50/60', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700', label: 'Ready to Print' },
    printing: { borderColor: 'border-l-orange-400', tintBg: 'bg-orange-50/60', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700', label: 'In Print' },
    material_received: { borderColor: 'border-l-teal-400', tintBg: 'bg-teal-50/60', badgeBg: 'bg-teal-100', badgeText: 'text-teal-700', label: 'Material In' },
    finishing: { borderColor: 'border-l-amber-400', tintBg: 'bg-amber-50/60', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700', label: 'Finishing' },
    quality_check: { borderColor: 'border-l-cyan-400', tintBg: 'bg-cyan-50/60', badgeBg: 'bg-cyan-100', badgeText: 'text-cyan-700', label: 'Material QC' },
    ready: { borderColor: 'border-l-green-400', tintBg: 'bg-green-50/60', badgeBg: 'bg-green-100', badgeText: 'text-green-700', label: 'Ready' },
};

// ─── Deadline badge ───────────────────────────────────────────────────────────
function deadlineBadge(deadline: string | null | undefined) {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'bg-red-50 text-red-600 border border-red-200' };
    if (days === 0) return { label: 'Due Today', cls: 'bg-amber-50 text-amber-600 border border-amber-200' };
    if (days === 1) return { label: 'Tomorrow', cls: 'bg-amber-50 text-amber-500 border border-amber-200' };
    return { label: `${days}d left`, cls: 'bg-stone-100 text-stone-500 border border-stone-200' };
}

// ─── Kanban stage columns ─────────────────────────────────────────────────────
const kanbanCols = [
    { id: 'new', label: 'To Do' },
    { id: 'designing', label: 'Designing' },
    { id: 'approval', label: 'Approval' },
    { id: 'pre_print_qc', label: 'Pre-Print QC' },
    { id: 'print_file_ready', label: 'File Ready' },
];

export default function TeamQueue() {
    const { jobs, loading } = useJobs({
        filter: [{ column: 'current_stage', value: ['new', 'awaiting_admin', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready'], op: 'in' }]
    });
    const { clients } = useClients();
    const { designers } = useDesigners();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDesigner, setFilterDesigner] = useState('all');
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

    const allTasks = (jobs || [])
        .filter(job => !['delivered', 'dispatched'].includes(job.current_stage))
        .map(job => ({
            id: job.id,
            title: job.project_name,
            client: clients.find(c => c.id === job.client_id)?.company || clients.find(c => c.id === job.client_id)?.name || 'Unknown',
            designer: designers.find(d => d.id === job.designer_id)?.name || 'Unassigned',
            designerId: job.designer_id,
            status: job.current_stage || 'new',
            priority: job.priority || 'normal',
            deadline: job.client_deadline,
            jobNumber: job.job_number,
        }));

    const filteredTasks = allTasks.filter(task => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = (task.title || '').toLowerCase().includes(q) || (task.client || '').toLowerCase().includes(q);
        const matchesDesigner = filterDesigner === 'all' || task.designerId === filterDesigner;
        return matchesSearch && matchesDesigner;
    });

    const designerCounts = designers.map(d => ({
        id: d.id, name: d.name,
        count: allTasks.filter(t => t.designerId === d.id).length
    }));

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
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-page-title text-foreground flex items-center gap-2">
                        <Users size={20} className="text-primary" /> Team Queue
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{filteredTasks.length} active tasks</p>
                </div>
                {/* View toggle */}
                <div className="flex bg-card border border-border rounded-md overflow-hidden text-xs">
                    <button
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-2 flex items-center gap-1.5 font-semibold transition-all ${viewMode === 'cards' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <LayoutGrid size={12} /> Cards
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-2 flex items-center gap-1.5 font-semibold transition-all border-l border-border ${viewMode === 'table' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <List size={12} /> Table
                    </button>
                </div>
            </div>

            {/* Designer mini stats */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {designerCounts.filter(d => d.count > 0).map(d => (
                    <button
                        key={d.id}
                        onClick={() => setFilterDesigner(filterDesigner === d.id ? 'all' : d.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium whitespace-nowrap transition-all ${filterDesigner === d.id
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-card border-border text-muted-foreground hover:border-foreground/30'
                            }`}
                    >
                        <User size={10} />
                        <span>{d.name}</span>
                        <span className={`px-1 rounded text-[10px] ${filterDesigner === d.id ? 'bg-white/20' : 'bg-muted'}`}>{d.count}</span>
                    </button>
                ))}
            </div>

            {/* Search + designer filter */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <input
                        type="text"
                        placeholder="Search tasks or clients…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
                <select
                    value={filterDesigner}
                    onChange={e => setFilterDesigner(e.target.value)}
                    className="px-3 py-2 border border-border rounded-md bg-card text-sm text-foreground focus:outline-none"
                >
                    <option value="all">All Designers</option>
                    {designers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>

            {filteredTasks.length === 0 ? (
                <div className="text-center py-16">
                    <Users size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground font-medium">No tasks found</p>
                </div>
            ) : viewMode === 'cards' ? (
                /* ── Card grid — grouped by kanban stage ── */
                <div className="space-y-4">
                    {kanbanCols.map(col => {
                        const stageTasks = filteredTasks.filter(t =>
                            col.id === 'new' ? ['new', 'awaiting_admin'].includes(t.status) : t.status === col.id
                        );
                        if (!stageTasks.length) return null;
                        const cfg = stageConfig[col.id] || stageConfig['new'];
                        return (
                            <div key={col.id} className="space-y-2">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${cfg.tintBg.replace('/60', '/30')} border-border`}>
                                    <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.badgeText}`}>{col.label}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.badgeBg} ${cfg.badgeText}`}>{stageTasks.length}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                                    {stageTasks.map(task => {
                                        const tcfg = stageConfig[task.status] || stageConfig['new'];
                                        const dl = deadlineBadge(task.deadline);
                                        return (
                                            <Link key={task.id} href="/admin/designers/tasks">
                                                <div className={`bg-card rounded-md border border-border border-l-4 ${tcfg.borderColor} hover:shadow-sm transition-shadow ${dl?.label.includes('overdue') ? 'ring-1 ring-red-200' : ''}`}>
                                                    <div className={`${tcfg.tintBg} px-3 py-2 flex items-center justify-between border-b border-border/50`}>
                                                        <span className="text-[10px] font-mono text-muted-foreground">#{task.jobNumber}</span>
                                                        <div className="flex items-center gap-1">
                                                            {['urgent', 'high'].includes(task.priority) && (
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${task.priority === 'urgent' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                                    {task.priority}
                                                                </span>
                                                            )}
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${tcfg.badgeBg} ${tcfg.badgeText}`}>
                                                                {tcfg.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="px-3 pt-2 pb-3 space-y-2">
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground truncate">{task.client}</p>
                                                            <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5">{task.title}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                                                                <User size={9} /> {task.designer}
                                                            </span>
                                                            {dl && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dl.cls}`}>{dl.label}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ── Table view ── */
                <div className="bg-card rounded-md border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px] text-sm">
                            <thead className="bg-muted border-b border-border">
                                <tr>
                                    {['Task', 'Client', 'Designer', 'Status', 'Deadline'].map(h => (
                                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.map((task, i) => {
                                    const cfg = stageConfig[task.status] || stageConfig['new'];
                                    const dl = deadlineBadge(task.deadline);
                                    return (
                                        <tr
                                            key={task.id}
                                            className={`border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
                                            onClick={() => window.location.href = '/admin/designers/tasks'}
                                        >
                                            <td className="px-4 py-2.5">
                                                <div className="font-medium text-foreground line-clamp-1">{task.title}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono">#{task.jobNumber}</div>
                                            </td>
                                            <td className="px-4 py-2.5 text-sm text-muted-foreground">{task.client}</td>
                                            <td className="px-4 py-2.5">
                                                <span className="flex items-center gap-1 text-sm text-muted-foreground"><User size={12} /> {task.designer}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${cfg.badgeBg} ${cfg.badgeText}`}>{cfg.label}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {dl ? (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dl.cls}`}>{dl.label}</span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/50">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
