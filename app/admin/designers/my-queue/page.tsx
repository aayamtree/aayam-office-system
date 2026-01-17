'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import {
    Calendar, Clock, User, AlertCircle, CheckCircle2,
    Filter, Search, Plus, ChevronLeft, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function MyQueueRedesigned() {
    const { profile } = useAuth();
    const { jobs, loading, updateJob, updateJobStage } = useJobs();
    const { clients } = useClients();
    const { designers } = useDesigners();

    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'urgent' | 'today'>('all');
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Filter tasks assigned to current user
    const myTasks = (jobs || [])
        .filter(job => {
            const isMyTask = job.design_assignee === profile?.id;
            const notCompleted = job.design_stage !== 'delivered' && job.design_stage !== 'completed';
            return isMyTask && notCompleted;
        })
        .map(job => ({
            id: job.id,
            title: job.project_name,
            client: clients.find(c => c.id === job.client_id)?.name || 'Unknown',
            status: job.design_stage || 'pending',
            priority: job.priority || 'normal',
            deadline: job.design_deadline ? new Date(job.design_deadline) : null,
            jobType: job.job_type,
            jobNumber: job.job_number
        }));

    // Apply filters
    const filteredTasks = myTasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.client.toLowerCase().includes(searchQuery.toLowerCase());

        if (filter === 'urgent') return matchesSearch && task.priority === 'urgent';
        if (filter === 'today') {
            const today = new Date().toDateString();
            return matchesSearch && task.deadline && task.deadline.toDateString() === today;
        }
        return matchesSearch;
    });

    // Group by priority and status
    const urgentTasks = filteredTasks.filter(t => t.priority === 'urgent');
    const highTasks = filteredTasks.filter(t => t.priority === 'high' && t.priority !== 'urgent');
    const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress' && t.priority === 'normal');
    const todoTasks = filteredTasks.filter(t => t.status === 'pending' && t.priority === 'normal');

    // Calendar logic
    const getDaysInMonth = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const days = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }
        return days;
    };

    const getTasksForDate = (day: number) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        return myTasks.filter(task => {
            if (!task.deadline) return false;
            return task.deadline.toDateString() === date.toDateString();
        });
    };

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

    const TaskCard = ({ task }: { task: any }) => {
        const isOverdue = task.deadline && task.deadline < new Date();
        const daysLeft = task.deadline
            ? Math.ceil((task.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null;

        const statusColors: any = {
            pending: 'bg-gray-100 text-gray-700',
            in_progress: 'bg-blue-100 text-blue-700',
            review: 'bg-purple-100 text-purple-700',
        };

        return (
            <div className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{task.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <User size={14} />
                            <span>{task.client}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs text-gray-500">#{task.jobNumber}</span>
                        </div>
                    </div>
                    {task.priority === 'urgent' && (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700">
                            URGENT
                        </span>
                    )}
                    {task.priority === 'high' && !urgentTasks.includes(task) && (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700">
                            HIGH
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[task.status] || statusColors.pending}`}>
                        {task.status === 'in_progress' ? 'Designing' : task.status === 'pending' ? 'To Do' : 'Review'}
                    </span>

                    {task.deadline && (
                        <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                            <Clock size={14} />
                            <span>
                                {isOverdue ? 'Overdue!' : daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">My Queue</h1>
                            <p className="text-gray-500">{filteredTasks.length} active tasks</p>
                        </div>
                        <Link
                            href="/admin/jobs/new"
                            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                        >
                            <Plus size={18} />
                            New Task
                        </Link>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                            />
                        </div>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="px-4 py-2 border rounded-lg bg-white"
                        >
                            <option value="all">All Tasks</option>
                            <option value="urgent">Urgent Only</option>
                            <option value="today">Due Today</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Task Lists - 2/3 width */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Urgent Tasks */}
                        {urgentTasks.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertCircle className="text-red-600" size={20} />
                                    <h2 className="text-lg font-bold text-red-600">Urgent ({urgentTasks.length})</h2>
                                </div>
                                <div className="space-y-3">
                                    {urgentTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </div>
                            </div>
                        )}

                        {/* High Priority */}
                        {highTasks.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertCircle className="text-orange-600" size={20} />
                                    <h2 className="text-lg font-bold text-orange-600">High Priority ({highTasks.length})</h2>
                                </div>
                                <div className="space-y-3">
                                    {highTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </div>
                            </div>
                        )}

                        {/* In Progress */}
                        {inProgressTasks.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Clock className="text-blue-600" size={20} />
                                    <h2 className="text-lg font-bold text-blue-600">In Progress ({inProgressTasks.length})</h2>
                                </div>
                                <div className="space-y-3">
                                    {inProgressTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </div>
                            </div>
                        )}

                        {/* To Do */}
                        {todoTasks.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="text-gray-600" size={20} />
                                    <h2 className="text-lg font-bold text-gray-600">To Do ({todoTasks.length})</h2>
                                </div>
                                <div className="space-y-3">
                                    {todoTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </div>
                            </div>
                        )}

                        {filteredTasks.length === 0 && (
                            <div className="bg-white rounded-xl p-12 text-center">
                                <p className="text-gray-500">No tasks found</p>
                            </div>
                        )}
                    </div>

                    {/* Calendar - 1/3 width */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl p-4 border sticky top-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-gray-900">
                                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </h2>
                                <div className="flex gap-2">
                                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                    <div key={i}>{day}</div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                                {getDaysInMonth().map((day, i) => {
                                    if (!day) return <div key={i} className="aspect-square"></div>;

                                    const tasksOnDay = getTasksForDate(day);
                                    const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();

                                    return (
                                        <div
                                            key={i}
                                            className={`aspect-square flex flex-col items-center justify-center rounded text-sm relative
                        ${isToday ? 'bg-purple-100 font-bold text-purple-700' : 'hover:bg-gray-50'}
                      `}
                                        >
                                            <span>{day}</span>
                                            {tasksOnDay.length > 0 && (
                                                <span className="absolute bottom-1 w-1 h-1 bg-purple-600 rounded-full"></span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-4 pt-4 border-t">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Quick Stats</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Active</span>
                                        <span className="font-bold">{myTasks.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">This Month</span>
                                        <span className="font-bold text-purple-600">{filteredTasks.filter(t => t.deadline && t.deadline.getMonth() === currentMonth.getMonth()).length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
