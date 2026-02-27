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
            client: clients.find(c => c.id === job.client_id)?.name || 'Unknown',
            designer: designers.find(d => d.id === job.designer_id)?.name || 'Unassigned',
            deadline: new Date(job.client_deadline!),
            status: job.current_stage,
            priority: job.priority
        }))
        .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

    if (loading) {
        return <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
        </div>;
    }

    return (
        <div className="space-y-2 md:space-y-4 px-2 animate-fade-in">
            <div>
                <h1 className="text-page-title text-gray-900">Production Timeline</h1>
                <p className="text-xs md:text-sm text-gray-500">{activeTasks.length} active jobs with deadlines</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeTasks.map((task) => {
                    const daysLeft = Math.ceil((task.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysLeft < 0;
                    const isUrgent = task.priority === 'urgent';

                    // Header bg: overdue = red, urgent = dark gray, normal = gray-900/muted
                    const headerBg = isOverdue ? 'bg-red-600' : isUrgent ? 'bg-gray-800' : 'bg-gray-900';

                    return (
                        <div key={task.id} className="bg-white rounded-md overflow-hidden border border-gray-200 hover:shadow-sm transition-all">
                            {/* Dark header bar */}
                            <div className={`${headerBg} px-3 py-2 flex items-center justify-between`}>
                                <div className="flex items-center gap-1.5">
                                    {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-white/80" />}
                                    <span className="text-white font-semibold text-sm truncate max-w-[160px]">{task.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isOverdue && (
                                        <span className="text-xs px-2 py-0.5 bg-white/25 rounded-md font-bold text-white">
                                            {Math.abs(daysLeft)}d overdue
                                        </span>
                                    )}
                                    {isUrgent && !isOverdue && (
                                        <span className="text-xs px-2 py-0.5 bg-white/25 rounded-md font-bold text-white uppercase">urgent</span>
                                    )}
                                    {!isOverdue && (
                                        <span className="text-white/80 text-xs">{daysLeft}d left</span>
                                    )}
                                </div>
                            </div>

                            {/* Card body */}
                            <div className="p-3">
                                <p className="text-gray-500 text-xs mb-2">
                                    {task.deadline.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                                        <User size={10} />
                                        {task.designer}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md capitalize">
                                        {task.status?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {activeTasks.length === 0 && (
                    <div className="col-span-full bg-white rounded-md border border-gray-200 p-12 text-center">
                        <Calendar className="mx-auto mb-3 text-gray-300" size={40} />
                        <p className="text-gray-500 font-medium">No tasks with deadlines</p>
                    </div>
                )}
            </div>
        </div>
    );
}
