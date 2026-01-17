'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useJobs, useClients } from '@/lib/hooks';
import { Calendar, Clock, User, AlertCircle, Search } from 'lucide-react';
import Link from 'next/link';

export default function MyQueue() {
    const { profile } = useAuth();
    const { jobs, loading } = useJobs();
    const { clients } = useClients();
    const [searchQuery, setSearchQuery] = useState('');

    // Get my tasks
    const myTasks = (jobs || [])
        .filter(job => job.designer_id === profile?.id)
        .filter(job => job.current_stage !== 'delivered' && job.current_stage !== 'dispatched')
        .map(job => ({
            id: job.id,
            title: job.project_name,
            client: clients.find(c => c.id === job.client_id)?.name || 'Unknown',
            status: job.current_stage || 'new',
            priority: job.priority || 'normal',
            deadline: job.client_deadline,
            jobNumber: job.job_number
        }));

    // Filter by search
    const filteredTasks = myTasks.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.client.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group by priority
    const urgentTasks = filteredTasks.filter(t => t.priority === 'urgent');
    const highTasks = filteredTasks.filter(t => t.priority === 'high');
    const normalTasks = filteredTasks.filter(t => t.priority === 'normal' || t.priority === 'low');

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">My Queue</h1>
                    <p className="text-gray-600">{filteredTasks.length} active tasks</p>
                </div>

                {/* Search */}
                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border rounded-lg"
                    />
                </div>

                {/* Task Groups */}
                <div className="space-y-8">
                    {/* Urgent */}
                    {urgentTasks.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <AlertCircle className="text-red-600" size={24} />
                                <h2 className="text-xl font-bold text-red-600">Urgent ({urgentTasks.length})</h2>
                            </div>
                            <div className="grid gap-4">
                                {urgentTasks.map(task => (
                                    <Link key={task.id} href="/admin/designers/tasks">
                                        <div className="bg-white p-6 rounded-xl border-2 border-red-200 shadow-sm hover:shadow-lg transition-shadow cursor-pointer">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                                        <User size={16} />
                                                        <span>{task.client}</span>
                                                        <span className="text-gray-400">•</span>
                                                        <span>#{task.jobNumber}</span>
                                                    </div>
                                                </div>
                                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                                                    URGENT
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
                            </div>
                        </div>
                    )}

                    {/* High Priority */}
                    {highTasks.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <AlertCircle className="text-orange-600" size={24} />
                                <h2 className="text-xl font-bold text-orange-600">High Priority ({highTasks.length})</h2>
                            </div>
                            <div className="grid gap-4">
                                {highTasks.map(task => (
                                    <Link key={task.id} href="/admin/designers/tasks">
                                        <div className="bg-white p-6 rounded-xl border-2 border-orange-200 shadow-sm hover:shadow-lg transition-shadow cursor-pointer">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                                        <User size={16} />
                                                        <span>{task.client}</span>
                                                        <span className="text-gray-400">•</span>
                                                        <span>#{task.jobNumber}</span>
                                                    </div>
                                                </div>
                                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-bold">
                                                    HIGH
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

                    {/* Normal Tasks */}
                    {normalTasks.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar className="text-blue-600" size={24} />
                                <h2 className="text-xl font-bold text-blue-600">All Tasks ({normalTasks.length})</h2>
                            </div>
                            <div className="grid gap-4">
                                {normalTasks.map(task => (
                                    <Link key={task.id} href="/admin/designers/tasks">
                                        <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                                        <User size={16} />
                                                        <span>{task.client}</span>
                                                        <span className="text-gray-400">•</span>
                                                        <span>#{task.jobNumber}</span>
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
                        <div className="bg-white rounded-xl p-12 text-center">
                            <p className="text-gray-500 text-lg">No tasks found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
