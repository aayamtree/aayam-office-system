'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { Calendar, Clock, User, AlertCircle, Search, Palette, Users, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';

export default function UnifiedQueue() {
    const { profile } = useAuth();
    const { jobs, loading } = useJobs();
    const { clients } = useClients();
    const { designers } = useDesigners();
    const [searchQuery, setSearchQuery] = useState('');
    const [showAll, setShowAll] = useState(false);

    // Find the designer record whose user_id matches the logged-in profile
    const myDesigner = designers.find(d => d.user_id === profile?.id)
        || designers.find(d => d.name?.toLowerCase() === profile?.full_name?.toLowerCase());
    const isAdmin = profile?.role === 'admin';

    // Get all active tasks
    const allTasks = (jobs || [])
        .filter(job => job.current_stage !== 'delivered' && job.current_stage !== 'dispatched' && job.current_stage !== 'cancelled')
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
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.jobType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.productCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.designer.toLowerCase().includes(searchQuery.toLowerCase())
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
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const renderTaskCard = (task: typeof filteredTasks[0]) => {
        const isOverdue = task.deadline && new Date(task.deadline) < new Date();
        const typeTag = getJobTypeTag(task.jobType);
        const catTag = getCategoryTag(task.productCategory);
        const isEditable = task.isMyTask;

        return (
            <Link
                key={task.id}
                href={isEditable ? '/admin/designers/tasks' : '#'}
                onClick={(e) => !isEditable && e.preventDefault()}
            >
                <div className={`p-4 rounded-lg border transition-all ${isEditable
                    ? 'bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer'
                    : 'bg-gray-50/50 cursor-default opacity-80'
                    } ${isOverdue && task.status !== 'delivered' ? 'border-l-4 border-l-red-400' : 'border-gray-200'}`}>

                    {/* Tags row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span className="font-mono text-[10px] text-gray-400 tracking-wide">#{task.jobNumber}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${typeTag.bg} ${typeTag.text}`}>{typeTag.label}</span>
                        {catTag && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${catTag.bg} ${catTag.text}`}>{catTag.label}</span>}
                        {/* Priority inline */}
                        {task.priority === 'urgent' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">URGENT</span>}
                        {task.priority === 'high' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">HIGH</span>}
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-sm text-gray-900 mb-1 leading-snug">{task.title}</h3>
                    <p className="text-xs text-gray-500 mb-3">{task.client}</p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${task.isMyTask && !isAdmin ? 'text-primary bg-muted' : 'text-gray-500 bg-gray-100'} border border-gray-200`}>
                                <User size={10} />
                                {task.designer}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${task.status === 'designing' ? 'bg-violet-50 text-violet-600' :
                                task.status === 'approval' ? 'bg-amber-50 text-amber-600' :
                                    task.status === 'printing' ? 'bg-emerald-50 text-emerald-600' :
                                        'bg-gray-100 text-gray-600'
                                }`}>
                                {task.status === 'new' ? 'To Do' : task.status === 'designing' ? 'Designing' : task.status === 'approval' ? 'Approval' : task.status}
                            </span>
                        </div>
                        {task.deadline && (
                            <span className={`text-[10px] font-medium flex items-center gap-1 ${isOverdue && task.status !== 'delivered' ? 'text-red-500' : 'text-gray-400'}`}>
                                {isOverdue && task.status !== 'delivered' && <AlertCircle size={10} />}
                                {new Date(task.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                        )}
                    </div>

                    {/* Read-only indicator for team tasks */}
                    {!isEditable && (
                        <div className="mt-2 text-[9px] text-gray-400 uppercase tracking-wider text-center border-t pt-2">
                            View Only
                        </div>
                    )}
                </div>
            </Link>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-3 md:p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
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
                    <div className="flex bg-white border rounded-lg overflow-hidden">
                        <button
                            onClick={() => setShowAll(false)}
                            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all ${!showAll ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <User size={14} /> My Tasks
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${!showAll ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {allTasks.filter(t => t.isMyTask).length}
                            </span>
                        </button>
                        <button
                            onClick={() => setShowAll(true)}
                            className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all border-l ${showAll ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <Users size={14} /> All Team
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${showAll ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {allTasks.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Designer summary when viewing all */}
                {showAll && designerCounts.length > 0 && (
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                        {designerCounts.map(d => (
                            <div key={d.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border whitespace-nowrap">
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
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-300"
                    />
                </div>

                {/* Task list grouped by priority */}
                <div className="space-y-4">
                    {urgentTasks.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <AlertCircle size={14} /> Urgent ({urgentTasks.length})
                            </h3>
                            <div className="space-y-2">
                                {urgentTasks.map(renderTaskCard)}
                            </div>
                        </div>
                    )}

                    {highTasks.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                ⚠️ High Priority ({highTasks.length})
                            </h3>
                            <div className="space-y-2">
                                {highTasks.map(renderTaskCard)}
                            </div>
                        </div>
                    )}

                    {normalTasks.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                Normal ({normalTasks.length})
                            </h3>
                            <div className="space-y-2">
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
