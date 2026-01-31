'use client';

import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { Calendar, User } from 'lucide-react';

export default function Timeline() {
    const { jobs, loading } = useJobs();
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
        return <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oms-blue"></div>
        </div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-page-title text-gray-900 mb-3 md:mb-6">Production Timeline</h1>

                <div className="space-y-4">
                    {activeTasks.map((task, index) => {
                        const daysLeft = Math.ceil((task.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        const isOverdue = daysLeft < 0;

                        return (
                            <div key={task.id} className="bg-white rounded-lg md:rounded-2xl p-3 md:p-6 border-l-4" style={{
                                borderLeftColor: isOverdue ? '#ef4444' : task.priority === 'urgent' ? '#f97316' : '#8b5cf6'
                            }}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-section text-gray-900">{task.title}</h3>
                                        <p className="text-sm text-gray-600">{task.client}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-sm font-bold ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                                            {task.deadline.toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 md:gap-4 text-sm text-gray-600">
                                    <div className="flex items-center gap-1">
                                        <User size={14} />
                                        {task.designer}
                                    </div>
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs capitalize">{task.status}</span>
                                </div>
                            </div>
                        );
                    })}

                    {activeTasks.length === 0 && (
                        <div className="bg-white rounded-xl p-12 text-center">
                            <Calendar className="mx-auto mb-4 text-gray-400" size={48} />
                            <p className="text-gray-500">No tasks with deadlines</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
