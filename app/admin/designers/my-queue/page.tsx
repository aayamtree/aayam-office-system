'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { Calendar, Clock, User, AlertCircle, Search, Palette } from 'lucide-react';
import Link from 'next/link';

export default function MyQueue() {
    const { profile } = useAuth();
    const { jobs, loading } = useJobs();
    const { clients } = useClients();
    const { designers } = useDesigners();
    const [searchQuery, setSearchQuery] = useState('');

    // Find the designer record whose user_id matches the logged-in profile (with name fallback)
    const myDesigner = designers.find(d => d.user_id === profile?.id)
        || designers.find(d => d.name?.toLowerCase() === profile?.full_name?.toLowerCase());
    const isAdmin = profile?.role === 'admin';

    // Get my tasks: match on designers table ID, not profile ID
    const myTasks = (jobs || [])
        .filter(job => {
            if (isAdmin) return true; // Admin sees all
            return job.designer_id === myDesigner?.id;
        })
        .filter(job => job.current_stage !== 'delivered' && job.current_stage !== 'dispatched' && job.current_stage !== 'cancelled')
        .map(job => ({
            id: job.id,
            title: job.project_name,
            client: clients.find(c => c.id === job.client_id)?.name || 'Unknown',
            designer: designers.find(d => d.id === job.designer_id)?.name || '',
            status: job.current_stage || 'new',
            priority: job.priority || 'normal',
            deadline: job.client_deadline,
            jobNumber: job.job_number,
            jobType: job.job_type || 'Design'
        }));

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

    // Filter by search (now includes jobType)
    const filteredTasks = myTasks.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.jobType.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group by priority
    const urgentTasks = filteredTasks.filter(t => t.priority === 'urgent');
    const highTasks = filteredTasks.filter(t => t.priority === 'high');
    const normalTasks = filteredTasks.filter(t => t.priority === 'normal' || t.priority === 'low');

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 md:p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-4 md:mb-1.5">
                    <h1 className="text-page-title text-gray-900 mb-1 md:mb-2">My Queue</h1>
                    <p className="text-sm md:text-base text-gray-600">{filteredTasks.length} active tasks</p>
                </div>

                {/* Search */}
                <div className="mb-4 md:mb-1.5 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3 md:pr-4 py-2.5 md:py-3 border rounded-lg text-sm md:text-base"
                    />
                </div>

                {/* Task Groups */}
                <div className="space-y-3 md:space-y-6 md:space-y-8">
                    {/* Urgent */}
                    {urgentTasks.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 md:mb-4">
                                <AlertCircle className="text-red-600" size={20} />
                                <h2 className="text-lg md:text-page-title text-red-600">Urgent ({urgentTasks.length})</h2>
                            </div>
                            <div className="grid gap-3 md:gap-4">
                                {urgentTasks.map(task => (
                                    <Link key={task.id} href="/admin/designers/tasks">
                                        <div className="bg-white p-4 md:p-4 rounded-lg md:rounded-lg border-2 border-red-200  transition-shadow cursor-pointer">
                                            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 md:gap-0 mb-2 md:mb-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {(() => { const t = getJobTypeTag(task.jobType); return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.bg} ${t.text}`}>{t.label}</span>; })()}
                                                    </div>
                                                    <h3 className="text-base md:text-section text-gray-900 line-clamp-2">{task.title}</h3>
                                                    <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 mt-1">
                                                        <User size={14} className="md:hidden" />
                                                        <User size={16} className="hidden md:block" />
                                                        <span>{task.client}</span>
                                                        <span className="text-gray-400">•</span>
                                                        <span>#{task.jobNumber}</span>
                                                        {task.designer && (
                                                            <>
                                                                <span className="text-gray-400">•</span>
                                                                <span className="flex items-center gap-1"><Palette size={12} />{task.designer}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="px-2.5 md:px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs md:text-sm font-bold whitespace-nowrap self-start">
                                                    URGENT
                                                </span>
                                            </div>
                                            {task.deadline && (
                                                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                                                    <Clock size={14} className="md:hidden" />
                                                    <Clock size={16} className="hidden md:block" />
                                                    <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* High Priority */}
                    {highTasks.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 md:mb-4">
                                <AlertCircle className="text-orange-600" size={20} />
                                <h2 className="text-lg md:text-page-title text-orange-600">High Priority ({highTasks.length})</h2>
                            </div>
                            <div className="grid gap-3 md:gap-4">
                                {highTasks.map(task => (
                                    <Link key={task.id} href="/admin/designers/tasks">
                                        <div className="bg-white p-4 md:p-4 rounded-lg md:rounded-lg border-2 border-orange-200  transition-shadow cursor-pointer">
                                            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 md:gap-0 mb-2 md:mb-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {(() => { const t = getJobTypeTag(task.jobType); return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.bg} ${t.text}`}>{t.label}</span>; })()}
                                                    </div>
                                                    <h3 className="text-base md:text-section text-gray-900 line-clamp-2">{task.title}</h3>
                                                    <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 mt-1">
                                                        <User size={14} className="md:hidden" />
                                                        <User size={16} className="hidden md:block" />
                                                        <span>{task.client}</span>
                                                        <span className="text-gray-400">•</span>
                                                        <span>#{task.jobNumber}</span>
                                                        {task.designer && (
                                                            <>
                                                                <span className="text-gray-400">•</span>
                                                                <span className="flex items-center gap-1"><Palette size={12} />{task.designer}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="px-2.5 md:px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs md:text-sm font-bold whitespace-nowrap self-start">
                                                    HIGH
                                                </span>
                                            </div>
                                            {task.deadline && (
                                                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                                                    <Clock size={14} className="md:hidden" />
                                                    <Clock size={16} className="hidden md:block" />
                                                    <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>                      </div>
                    )}

                    {/* Normal Tasks */}
                    {normalTasks.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 md:mb-4">
                                <Calendar className="text-foreground" size={20} />
                                <h2 className="text-lg md:text-page-title text-foreground">All Tasks ({normalTasks.length})</h2>
                            </div>
                            <div className="grid gap-3 md:gap-4">
                                {normalTasks.map(task => (
                                    <Link key={task.id} href="/admin/designers/tasks">
                                        <div className="bg-white p-4 rounded-lg border  transition-shadow cursor-pointer">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {(() => { const t = getJobTypeTag(task.jobType); return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.bg} ${t.text}`}>{t.label}</span>; })()}
                                                    </div>
                                                    <h3 className="text-section text-gray-900">{task.title}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                                        <User size={16} />
                                                        <span>{task.client}</span>
                                                        <span className="text-gray-400">•</span>
                                                        <span>#{task.jobNumber}</span>
                                                        {task.designer && (
                                                            <>
                                                                <span className="text-gray-400">•</span>
                                                                <span className="flex items-center gap-1"><Palette size={12} />{task.designer}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm capitalize">
                                                    {task.status}
                                                </span>
                                            </div>
                                            {task.deadline && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Clock size={16} />
                                                    <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>                      </div>
                    )}

                    {filteredTasks.length === 0 && (
                        <div className="bg-white rounded-lg p-12 text-center">
                            <p className="text-gray-500 text-lg">No tasks found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
