'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDailyReports } from '@/lib/hooks';
import { Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Calendar, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import ProductChecklistCard from '@/components/eod/ProductChecklistCard';

export default function EODReportPage() {
    const { profile } = useAuth();
    const { fetchMyTodayTasks, submitEODReport, getMyReports, fetchProductChecklist } = useDailyReports();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [todayTasks, setTodayTasks] = useState<any[]>([]);
    const [pastReports, setPastReports] = useState<any[]>([]);
    const [todayReport, setTodayReport] = useState<any>(null);

    // Form state
    const today = new Date().toISOString().split('T')[0];
    const [reportDate] = useState(today);
    const [overallNotes, setOverallNotes] = useState('');
    const [blockers, setBlockers] = useState('');
    const [tomorrowPlan, setTomorrowPlan] = useState('');
    const [workHours, setWorkHours] = useState<number>(8);

    // Task updates state
    const [taskUpdates, setTaskUpdates] = useState<Record<string, {
        task_status: 'NOT START' | 'START WORK' | 'COMPLETE';
        status_update: string;
        completion_percentage: number;
        time_spent: number;
        product_type: string;
        checklist_items: Array<{ item: string; checked: boolean; comment: string; order: number }>;
        client_approval_received: boolean;
        print_file_ready: boolean;
        print_checklist_done: boolean;
        client_comments: string;
        expanded: boolean;
    }>>({});

    // Load data
    useEffect(() => {
        if (profile?.id) {
            loadData();
        }
    }, [profile?.id]);

    const loadData = async () => {
        if (!profile?.id) return;

        setLoading(true);
        try {
            // Fetch today's tasks
            const { data: tasks, error: tasksError } = await fetchMyTodayTasks(profile.id);
            if (!tasksError && tasks) {
                setTodayTasks(tasks);

                // Initialize task updates
                const initialUpdates: any = {};
                tasks.forEach((task: any) => {
                    initialUpdates[task.id] = {
                        task_status: 'START WORK',
                        status_update: '',
                        completion_percentage: 0,
                        time_spent: 0,
                        product_type: task.product_category || task.job_type || '',
                        checklist_items: [],
                        client_approval_received: false,
                        print_file_ready: false,
                        print_checklist_done: false,
                        client_comments: '',
                        expanded: true
                    };
                });
                setTaskUpdates(initialUpdates);
            }

            // Fetch past reports
            const { data: reports } = await getMyReports(profile.id);
            if (reports) {
                setPastReports(reports);

                // Check if today's report exists
                const existingReport = reports.find((r: any) => r.report_date === today);
                if (existingReport) {
                    setTodayReport(existingReport);
                    // Load existing data
                    setOverallNotes(existingReport.overall_notes || '');
                    setBlockers(existingReport.blockers || '');
                    setTomorrowPlan(existingReport.tomorrow_plan || '');
                    setWorkHours(existingReport.work_hours || 8);
                }
            }
        } catch (e) {
            console.error('Error loading data:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleTaskUpdate = (taskId: string, field: string, value: any) => {
        setTaskUpdates(prev => ({
            ...prev,
            [taskId]: {
                ...prev[taskId],
                [field]: value
            }
        }));
    };

    const toggleTaskExpanded = (taskId: string) => {
        setTaskUpdates(prev => ({
            ...prev,
            [taskId]: {
                ...prev[taskId],
                expanded: !prev[taskId].expanded
            }
        }));
    };

    // Handle status change and load appropriate checklist
    const handleStatusChange = async (taskId: string, newStatus: 'NOT START' | 'START WORK' | 'COMPLETE') => {
        const task = taskUpdates[taskId];

        // Fetch checklist if status is COMPLETE
        let checklistItems: any[] = [];
        if (newStatus === 'COMPLETE' && task.product_type) {
            const { data } = await fetchProductChecklist(task.product_type, 'design');
            checklistItems = data || [];
        }

        setTaskUpdates(prev => ({
            ...prev,
            [taskId]: {
                ...prev[taskId],
                task_status: newStatus,
                checklist_items: checklistItems
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        setSubmitting(true);
        try {
            // Filter tasks that have updates
            const updates = Object.keys(taskUpdates)
                .filter(taskId => taskUpdates[taskId].status_update.trim() !== '')
                .map(taskId => ({
                    job_id: taskId,
                    task_status: taskUpdates[taskId].task_status,
                    product_type: taskUpdates[taskId].product_type,
                    status_update: taskUpdates[taskId].status_update,
                    completion_percentage: taskUpdates[taskId].completion_percentage,
                    time_spent: taskUpdates[taskId].time_spent,
                    checklist: taskUpdates[taskId].checklist_items,
                    client_approval_received: taskUpdates[taskId].client_approval_received,
                    print_file_ready: taskUpdates[taskId].print_file_ready,
                    print_checklist_done: taskUpdates[taskId].print_checklist_done,
                    client_comments: taskUpdates[taskId].client_comments
                }));

            const { error } = await submitEODReport({
                user_id: profile.id,
                report_date: reportDate,
                overall_notes: overallNotes,
                blockers: blockers,
                tomorrow_plan: tomorrowPlan,
                work_hours: workHours,
                task_updates: updates
            });

            if (error) {
                alert('Error submitting report: ' + error);
            } else {
                alert('✅ EOD Report submitted successfully!');
                await loadData(); // Reload to show updated status
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-oms-blue" size={32} />
                <span className="ml-3 text-gray-600">Loading your tasks...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900">End of Day Report</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {todayReport ? '✅ Submitted Today' : '⏰ Pending Submission'} | {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                {profile?.role === 'admin' && (
                    <Link
                        href="/admin/eod-report/admin-view"
                        className="px-4 py-2 bg-oms-blue text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                        Admin Dashboard →
                    </Link>
                )}
            </div>

            {/* Status Banner */}
            {todayReport && (
                <div className="bg-white border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="text-gray-900" size={24} />
                    <div>
                        <p className="font-medium text-green-900">Report submitted at {new Date(todayReport.submitted_at).toLocaleTimeString()}</p>
                        <p className="text-sm text-gray-900">You can update it anytime before midnight</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tasks Section */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-section text-gray-900 mb-4">Today&apos;s Tasks ({todayTasks.length})</h2>

                    {todayTasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>No active tasks assigned to you</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {todayTasks.map(task => (
                                <div key={task.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                    {/* Task Header */}
                                    <div
                                        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => toggleTaskExpanded(task.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {taskUpdates[task.id]?.expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            <div>
                                                <p className="font-medium text-gray-900">#{task.job_number} - {task.project_name}</p>
                                                <p className="text-sm text-gray-600">{task.client?.name || task.client?.company}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-gray-500">Stage: <span className="font-medium text-gray-900">{task.current_stage}</span></span>
                                            {task.client_deadline && (
                                                <span className="flex items-center gap-1 text-gray-500">
                                                    <Calendar size={14} />
                                                    Due: {new Date(task.client_deadline).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Task Update Form */}
                                    {taskUpdates[task.id]?.expanded && (
                                        <div className="p-4 space-y-4 bg-white">
                                            {/* Status Selection */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Task Status
                                                </label>
                                                <select
                                                    value={taskUpdates[task.id]?.task_status || 'START WORK'}
                                                    onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oms-blue focus:border-transparent font-medium"
                                                >
                                                    <option value="NOT START">❌ Not Started</option>
                                                    <option value="START WORK">🔄 Start Work / Pending</option>
                                                    <option value="COMPLETE">✅ Complete</option>
                                                </select>
                                            </div>

                                            {/* Status Update */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Status Update <span className="text-red-500">*</span>
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={taskUpdates[task.id]?.status_update || ''}
                                                    onChange={(e) => handleTaskUpdate(task.id, 'status_update', e.target.value)}
                                                    placeholder="What did you work on today? Use #hashtags for easy search (e.g., #ClientApproved, #Revision2)"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oms-blue focus:border-transparent"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Tip: Add hashtags like #approved #pending #blocked for better tracking</p>
                                            </div>

                                            {/* Completion & Time */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Completion %</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={taskUpdates[task.id]?.completion_percentage || 0}
                                                        onChange={(e) => handleTaskUpdate(task.id, 'completion_percentage', parseInt(e.target.value))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Time Spent (hours)</label>
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        min="0"
                                                        value={taskUpdates[task.id]?.time_spent || 0}
                                                        onChange={(e) => handleTaskUpdate(task.id, 'time_spent', parseFloat(e.target.value))}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                    />
                                                </div>
                                            </div>

                                            {/* Dynamic Checklist - Show based on status */}
                                            {taskUpdates[task.id]?.checklist_items && taskUpdates[task.id].checklist_items.length > 0 && (
                                                <div>
                                                    <ProductChecklistCard
                                                        productType={task.product_category || task.job_type || 'Other'}
                                                        taskStatus={taskUpdates[task.id].task_status}
                                                        checklistItems={taskUpdates[task.id].checklist_items}
                                                        onUpdate={(items) => handleTaskUpdate(task.id, 'checklist_items', items)}
                                                        category="design"
                                                    />
                                                </div>
                                            )}

                                            {/* Checklists */}
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700">Quick Checks</label>
                                                <div className="flex flex-wrap gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={taskUpdates[task.id]?.client_approval_received || false}
                                                            onChange={(e) => handleTaskUpdate(task.id, 'client_approval_received', e.target.checked)}
                                                            className="w-4 h-4 text-oms-blue rounded"
                                                        />
                                                        <span className="text-sm text-gray-700">Client Approval Received</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={taskUpdates[task.id]?.print_file_ready || false}
                                                            onChange={(e) => handleTaskUpdate(task.id, 'print_file_ready', e.target.checked)}
                                                            className="w-4 h-4 text-oms-blue rounded"
                                                        />
                                                        <span className="text-sm text-gray-700">Print File Ready</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={taskUpdates[task.id]?.print_checklist_done || false}
                                                            onChange={(e) => handleTaskUpdate(task.id, 'print_checklist_done', e.target.checked)}
                                                            className="w-4 h-4 text-oms-blue rounded"
                                                        />
                                                        <span className="text-sm text-gray-700">Pre-print Checklist Done</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Client Comments */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Client Comments (if any)</label>
                                                <input
                                                    type="text"
                                                    value={taskUpdates[task.id]?.client_comments || ''}
                                                    onChange={(e) => handleTaskUpdate(task.id, 'client_comments', e.target.value)}
                                                    placeholder="Any feedback from client?"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Overall Summary */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                    <h2 className="text-section text-gray-900">Overall Summary</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Overall Notes</label>
                        <textarea
                            rows={3}
                            value={overallNotes}
                            onChange={(e) => setOverallNotes(e.target.value)}
                            placeholder="General notes about your day, achievements, meetings, etc."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Blockers / Issues</label>
                        <textarea
                            rows={2}
                            value={blockers}
                            onChange={(e) => setBlockers(e.target.value)}
                            placeholder="Any problems or blockers that prevented progress?"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tomorrow&apos;s Plan</label>
                        <textarea
                            rows={2}
                            value={tomorrowPlan}
                            onChange={(e) => setTomorrowPlan(e.target.value)}
                            placeholder="What will you focus on tomorrow?"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Total Work Hours</label>
                        <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={workHours}
                            onChange={(e) => setWorkHours(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg max-w-xs"
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <AlertCircle size={16} />
                        <span>Updates must be submitted before leaving office</span>
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-3 bg-[rgba(0,0,255,0.1)] text-white rounded-xl font-medium hover:bg-[rgba(0,0,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                {todayReport ? 'Update Report' : 'Submit Report'}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Past Reports */}
            {pastReports.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-section text-gray-900 mb-4">Past Reports</h2>
                    <div className="space-y-2">
                        {pastReports.slice(0, 5).map(report => (
                            <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Calendar size={16} className="text-gray-400" />
                                    <span className="font-medium text-gray-900">{new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                    <span className="text-sm text-gray-600">• {report.task_updates?.length || 0} tasks updated</span>
                                </div>
                                <span className="text-xs text-gray-500">{new Date(report.submitted_at).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
