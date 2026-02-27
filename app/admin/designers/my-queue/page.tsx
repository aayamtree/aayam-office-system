'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useJobs } from '@/lib/hooks';
import { Calendar, Clock, User, AlertCircle, Search, Palette, Users, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';

export default function UnifiedQueue() {
    const { profile } = useAuth();
    // PERF: Single query with joins instead of 3 separate queries (jobs + clients + designers)
    const { jobs, loading } = useJobs({
        select: 'id, project_name, job_number, current_stage, priority, client_deadline, designer_id, job_type, product_category, client:clients(id, name, company), designer:designers(id, name, user_id)',
        filter: [{ column: 'current_stage', value: ['new', 'awaiting_admin', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready'], op: 'in' }]
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [showAll, setShowAll] = useState(false);

    // Find the designer record whose user_id matches the logged-in profile
    const designers = Array.from(new Map((jobs || []).filter((j: any) => j.designer).map((j: any) => [j.designer.id, j.designer])).values()) as any[];
    const myDesigner = designers.find((d: any) => d.user_id === profile?.id)
        || designers.find((d: any) => d.name?.toLowerCase() === profile?.full_name?.toLowerCase());
    const isAdmin = profile?.role === 'admin';

    // Get all active tasks
    const allTasks = (jobs || [])
        .filter(job => job.current_stage !== 'delivered' && job.current_stage !== 'dispatched' && job.current_stage !== 'cancelled')
        .map((job: any) => ({
            id: job.id,
            title: job.project_name,
            client: job.client?.company || job.client?.name || 'Unknown',
            designer: job.designer?.name || 'Unassigned',
            designerId: job.designer_id,
            status: job.current_stage || 'new',
            priority: job.priority || 'normal',
            deadline: job.client_deadline,
            jobNumber: job.job_number,
            jobType: job.job_type || 'Design',
            productCategory: job.product_category || '',
            isMyTask: isAdmin || job.designer_id === myDesigner?.id,
        }));

    // Show toggle: "My Tasks" shows only user's tasks, "All Team" shows everyone's
    const visibleTasks = showAll ? allTasks : allTasks.filter(t => t.isMyTask);

    // Helper for job type tag styling
    const getJobTypeTag = (type: string) => {
        const map: Record<string, { label: string; bg: string; text: string }> = {
            'Design': { label: 'DESIGN', bg: 'bg-violet-100', text: 'text-violet-700' },
            'Printing': { label: 'PRINT', bg: 'bg-emerald-100', text: 'text-emerald-700' },
            'Design + Printing': { label: 'DESIGN+PRINT', bg: 'bg-sky-100', text: 'text-sky-700' },
            'Design + Print': { label: 'DESIGN+PRINT', bg: 'bg-sky-100', text: 'text-sky-700' },
        };
        return map[type] || { label: type?.toUpperCase() || 'PROJECT', bg: 'bg-gray-100', text: 'text-gray-600' };
    };

    // Helper for product category tag styling
    const getCategoryTag = (cat: string) => {
        const map: Record<string, { label: string; bg: string; text: string }> = {
            'box': { label: '📦 BOX', bg: 'bg-amber-100', text: 'text-amber-700' },
            'pouch': { label: '👝 POUCH', bg: 'bg-rose-100', text: 'text-rose-700' },
            'label': { label: '🏷️ LABEL', bg: 'bg-indigo-100', text: 'text-indigo-700' },
            'sticker': { label: '⭐ STICKER', bg: 'bg-pink-100', text: 'text-pink-700' },
            'other': { label: 'OTHER', bg: 'bg-gray-100', text: 'text-gray-600' },
        };
        return map[cat?.toLowerCase()] || null;
    };

    // Filter by search
    const filteredTasks = visibleTasks.filter(task =>
        (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.client || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.jobType || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.productCategory || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.designer || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group by priority
    const urgentTasks = filteredTasks.filter(t => t.priority === 'urgent');
    const highTasks = filteredTasks.filter(t => t.priority === 'high');
    const normalTasks = filteredTasks.filter(t => t.priority === 'normal' || t.priority === 'low');

    // Count by designer for summary bar
    const designerCounts = designers.map(d => ({
        id: d.id,
        name: d.name,
        count: allTasks.filter(t => t.designerId === d.id).length
    })).filter(d => d.count > 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const renderTaskCard = (task: typeof filteredTasks[0]) => {
        const isOverdue = task.deadline && new Date(task.deadline) < new Date();
        const typeTag = getJobTypeTag(task.jobType);
        const catTag = getCategoryTag(task.productCategory);
        const isEditable = task.isMyTask;

        // Header bg varies by priority + overdue
        const headerBg = isOverdue && task.status !== 'delivered'
            ? 'bg-red-600'
            : task.priority === 'urgent'
                ? 'bg-gray-900'
                : task.priority === 'high'
                    ? 'bg-gray-800'
                    : 'bg-gray-700';

        return (
            <Link
                key={task.id}
                href={isEditable ? '/admin/designers/tasks' : '#'}
                onClick={(e) => !isEditable && e.preventDefault()}
            >
                <div className={`bg-white rounded-md overflow-hidden border border-gray-200 hover:shadow-sm transition-all ${!isEditable ? 'opacity-80' : ''}`}>

                    {/* Dark header bar */}
                    <div className={`${headerBg} px-3 py-2 flex items-center justify-between`}>
                        <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-white/70 tracking-wide">#{task.jobNumber}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${typeTag.bg} ${typeTag.text}`}>{typeTag.label}</span>
                            {catTag && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${catTag.bg} ${catTag.text}`}>{catTag.label}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                            {task.priority === 'urgent' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/25 text-white uppercase">URGENT</span>}
                            {task.priority === 'high' && !isOverdue && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/25 text-white uppercase">HIGH</span>}
                            {isOverdue && task.status !== 'delivered' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/25 text-white">OVERDUE</span>}
                        </div>
                    </div>

                    {/* Card body */}
                    <div className="p-3">
                        <p className="text-gray-500 text-xs mb-0.5">{task.client}</p>
                        <h3 className="font-semibold text-sm text-gray-900 mb-2 leading-snug">{task.title}</h3>

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${task.isMyTask && !isAdmin ? 'text-primary bg-muted' : 'text-gray-500 bg-gray-100'} border border-gray-200`}>
                                    <User size={10} />
                                    {task.designer}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-md font-medium bg-gray-100 text-gray-600`}>
                                    {task.status === 'awaiting_admin' ? 'Awaiting Approval' : task.status === 'new' ? 'To Do' : task.status === 'designing' ? 'Designing' : task.status === 'approval' ? 'Client Approval' : task.status}
                                </span>
                            </div>
                            {task.deadline && (
                                <span className={`text-xs font-medium ${isOverdue && task.status !== 'delivered' ? 'text-red-500' : 'text-gray-400'}`}>
                                    {new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                            )}
                        </div>

                        {/* Read-only indicator for team tasks */}
                        {!isEditable && (
                            <div className="mt-2 text-[9px] text-gray-400 uppercase tracking-wider text-center border-t pt-1.5">
                                View Only
                            </div>
                        )}
                    </div>
                </div>
            </Link>
        );
    };

    return (
        <div className="space-y-4">
            <div>
                <div className="mb-4">
                    <h1 className="text-page-title text-gray-900 mb-1 flex items-center gap-2">
                        <Palette size={24} className="text-primary" /> Queue
                    </h1>
                    <p className="text-sm text-gray-600">
                        {showAll ? `${filteredTasks.length} team tasks` : `${filteredTasks.length} tasks assigned to you`}
                    </p>
                </div>

                {/* My Tasks / All Team Toggle */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex bg-white border rounded-md overflow-hidden">
                        <button
                            onClick={() => setShowAll(false)}
                            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all ${!showAll ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <User size={14} /> My Tasks
                            <span className={`text-xs px-1.5 py-0.5 rounded-md ${!showAll ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {allTasks.filter(t => t.isMyTask).length}
                            </span>
                        </button>
                        <button
                            onClick={() => setShowAll(true)}
                            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all border-l ${showAll ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <Users size={14} /> All Team
                            <span className={`text-xs px-1.5 py-0.5 rounded-md ${showAll ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {allTasks.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Designer summary when viewing all */}
                {showAll && designerCounts.length > 0 && (
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                        {designerCounts.map(d => (
                            <div key={d.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border whitespace-nowrap">
                                <span className="text-sm font-bold text-primary">{d.count}</span>
                                <span className="text-xs text-gray-600">{d.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search tasks, clients, designers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-gray-300"
                    />
                </div>

                {/* Task list grouped by priority */}
                <div className="space-y-4">
                    {urgentTasks.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <AlertCircle size={14} /> Urgent ({urgentTasks.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {urgentTasks.map(renderTaskCard)}
                            </div>
                        </div>
                    )}

                    {highTasks.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                ⚠️ High Priority ({highTasks.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {highTasks.map(renderTaskCard)}
                            </div>
                        </div>
                    )}

                    {normalTasks.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                Normal ({normalTasks.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {normalTasks.map(renderTaskCard)}
                            </div>
                        </div>
                    )}

                    {filteredTasks.length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                            <Palette size={32} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No tasks found</p>
                            <p className="text-xs mt-1">{showAll ? 'No active team tasks' : 'You have no assigned tasks right now'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
