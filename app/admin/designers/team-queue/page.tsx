'use client';

import { useState } from 'react';
import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { Users, Search, User, Clock, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';

export default function TeamQueue() {
    const { jobs, loading } = useJobs();
    const { clients } = useClients();
    const { designers } = useDesigners();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDesigner, setFilterDesigner] = useState('all');
    const [viewMode, setViewMode] = useState<'table' | 'board'>('table'); // Default to table for mobile

    // Get all design tasks
    const allTasks = (jobs || [])
        .filter(job => job.current_stage !== 'delivered' && job.current_stage !== 'dispatched')
        .map(job => ({
            id: job.id,
            title: job.project_name,
            client: clients.find(c => c.id === job.client_id)?.company || clients.find(c => c.id === job.client_id)?.name || 'Unknown',
            designer: designers.find(d => d.id === job.designer_id)?.name || 'Unassigned',
            designerId: job.designer_id,
            status: job.current_stage || 'new',
            priority: job.priority || 'normal',
            deadline: job.client_deadline,
            jobNumber: job.job_number
        }));

    // Filter
    const filteredTasks = allTasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.client.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDesigner = filterDesigner === 'all' || task.designerId === filterDesigner;
        return matchesSearch && matchesDesigner;
    });

    // Count by designer
    const designerCounts = designers.map(d => ({
        id: d.id,
        name: d.name,
        count: allTasks.filter(t => t.designerId === d.id).length
    }));

    // Group by status for Kanban
    const statuses = [
        { id: 'new', name: 'To Do', color: 'bg-gray-100' },
        { id: 'designing', name: 'Designing', color: 'bg-blue-100' },
        { id: 'approval', name: 'Approval', color: 'bg-purple-100' },
        { id: 'printing', name: 'Printing', color: 'bg-indigo-100' },
    ];

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-4 md:mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">Team Queue</h1>
                    <p className="text-sm md:text-base text-gray-600">{filteredTasks.length} active tasks</p>
                </div>

                {/* Designer Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                    {designerCounts.map(d => (
                        <div key={d.id} className="bg-white p-4 rounded-xl border text-center">
                            <div className="text-2xl font-bold text-purple-600">{d.count}</div>
                            <div className="text-sm text-gray-600 mt-1">{d.name}</div>
                        </div>
                    ))}
                </div>

                {/* Filters & View Toggle - Responsive */}
                <div className="flex flex-col md:flex-row gap-3 mb-6">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 md:py-3 border rounded-xl text-sm"
                        />
                    </div>

                    <div className="flex gap-3">
                        <select
                            value={filterDesigner}
                            onChange={(e) => setFilterDesigner(e.target.value)}
                            className="flex-1 md:flex-none px-3 md:px-4 py-2.5 md:py-3 border rounded-xl bg-white text-sm"
                        >
                            <option value="all">All Designers</option>
                            {designers.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>

                        {/* View Toggle */}
                        <div className="flex border rounded-xl overflow-hidden bg-white flex-shrink-0">
                            <button
                                onClick={() => setViewMode('board')}
                                className={`px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-1.5 md:gap-2 ${viewMode === 'board' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}
                            >
                                <LayoutGrid size={18} />
                                <span className="text-xs md:text-sm font-medium">Board</span>
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-1.5 md:gap-2 border-l ${viewMode === 'table' ? 'bg-purple-100 text-purple-700' : 'text-gray-600'}`}
                            >
                                <List size={18} />
                                <span className="text-xs md:text-sm font-medium">Table</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Kanban Board View */}
                {viewMode === 'board' && (
                    <div className="grid grid-cols-4 gap-4">
                        {statuses.map(status => {
                            const tasksInStatus = filteredTasks.filter(t => t.status === status.id);
                            return (
                                <div key={status.id} className="bg-white rounded-xl p-4 border">
                                    <div className={`${status.color} rounded-lg p-3 mb-4`}>
                                        <h3 className="font-bold text-gray-900">{status.name}</h3>
                                        <p className="text-sm text-gray-600">{tasksInStatus.length} tasks</p>
                                    </div>

                                    <div className="space-y-3">
                                        {tasksInStatus.map(task => (
                                            <Link key={task.id} href="/admin/designers/tasks">
                                                <div className="bg-gray-50 rounded-lg p-3 border hover:shadow-md transition-shadow cursor-pointer">
                                                    <h4 className="font-semibold text-sm text-gray-900 mb-2">{task.title}</h4>
                                                    <div className="text-xs text-gray-600 mb-2">{task.client}</div>

                                                    {/* Deadline */}
                                                    {task.deadline && (
                                                        <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                            <span>📅</span>
                                                            {new Date(task.deadline).toLocaleDateString()}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="flex items-center gap-1 text-gray-600">
                                                            <User size={12} />
                                                            {task.designer}
                                                        </span>

                                                        {/* Priority Badge */}
                                                        {task.priority === 'urgent' && (
                                                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold text-xs">🔥 Urgent</span>
                                                        )}
                                                        {task.priority === 'high' && (
                                                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-bold text-xs">⚠️ High</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                        {tasksInStatus.length === 0 && (
                                            <p className="text-gray-400 text-sm text-center py-4">No tasks</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Table View */}
                {viewMode === 'table' && (
                    <div className="bg-white rounded-lg md:rounded-xl border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px]">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="text-left p-4 font-semibold text-gray-700">Task</th>
                                        <th className="text-left p-4 font-semibold text-gray-700">Client</th>
                                        <th className="text-left p-4 font-semibold text-gray-700">Designer</th>
                                        <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                                        <th className="text-left p-4 font-semibold text-gray-700">Deadline</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTasks.map(task => (
                                        <tr key={task.id} className="hover:bg-gray-50 cursor-pointer border-b border-gray-200" onClick={() => window.location.href = '/admin/designers/tasks'}>
                                            <td className="p-4">
                                                <div className="font-semibold text-gray-900">{task.title}</div>
                                                <div className="text-sm text-gray-500">#{task.jobNumber}</div>
                                            </td>
                                            <td className="p-4 text-gray-700">{task.client}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-gray-400" />
                                                    <span className="text-gray-700">{task.designer}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                                    task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {task.deadline ? (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Clock size={16} />
                                                        {new Date(task.deadline).toLocaleDateString()}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">No deadline</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredTasks.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-gray-500">
                                                No tasks found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
