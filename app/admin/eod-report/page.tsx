'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDailyReports } from '@/lib/hooks';
import { toast } from '@/hooks/use-toast';
import {
    Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, ChevronLeft,
    Calendar, Loader2, Send, FileText, History, Lock, Pencil
} from 'lucide-react';
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
    const [expandedReport, setExpandedReport] = useState<string | null>(null);

    // History month navigation
    const [historyMonth, setHistoryMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [historyLoading, setHistoryLoading] = useState(false);

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
        product_category: string;
        checklist_items: Array<{ item: string; checked: boolean; comment: string; order: number }>;
        client_approval_received: boolean;
        print_file_ready: boolean;
        print_checklist_done: boolean;
        client_comments: string;
        expanded: boolean;
    }>>({});

    // Check if it's EOD time (6-7 PM)
    const currentHour = new Date().getHours();
    const isEODTime = currentHour >= 18 && currentHour < 19;
    const isPastEODTime = currentHour >= 19;

    // Load data
    useEffect(() => {
        if (profile?.id) {
            loadData();
        }
    }, [profile?.id]);

    // Load history when month changes
    useEffect(() => {
        if (profile?.id) {
            loadHistory();
        }
    }, [profile?.id, historyMonth.year, historyMonth.month]);

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
                        product_category: task.product_category || task.job_type || '',
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

            // Check if today's report exists
            const { data: reports } = await getMyReports(profile.id);
            if (reports) {
                const existingReport = reports.find((r: any) => r.report_date === today);
                if (existingReport) {
                    setTodayReport(existingReport);
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

    const loadHistory = async () => {
        if (!profile?.id) return;
        setHistoryLoading(true);
        try {
            const startDate = new Date(historyMonth.year, historyMonth.month, 1).toISOString().split('T')[0];
            const endDate = new Date(historyMonth.year, historyMonth.month + 1, 0).toISOString().split('T')[0];
            const { data: reports } = await getMyReports(profile.id, startDate, endDate);
            setPastReports(reports || []);
        } catch (e) {
            console.error('Error loading history:', e);
        } finally {
            setHistoryLoading(false);
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

    const handleStatusChange = async (taskId: string, newStatus: 'NOT START' | 'START WORK' | 'COMPLETE') => {
        const task = taskUpdates[taskId];
        let checklistItems: any[] = [];
        if (newStatus === 'COMPLETE' && task.product_category) {
            const { data } = await fetchProductChecklist(task.product_category, 'design');
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
            const updates = Object.keys(taskUpdates)
                .filter(taskId => taskUpdates[taskId].status_update.trim() !== '')
                .map(taskId => ({
                    job_id: taskId,
                    task_status: taskUpdates[taskId].task_status,
                    product_category: taskUpdates[taskId].product_category,
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
                toast({ title: '❌ Error submitting report', description: String(error), variant: 'destructive' });
            } else {
                toast({ title: '✅ EOD Report submitted successfully!' });
                await loadData();
                await loadHistory();
            }
        } catch (e: any) {
            toast({ title: '❌ Error', description: e.message, variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    const navigateMonth = (direction: -1 | 1) => {
        setHistoryMonth(prev => {
            let newMonth = prev.month + direction;
            let newYear = prev.year;
            if (newMonth < 0) { newMonth = 11; newYear--; }
            if (newMonth > 11) { newMonth = 0; newYear++; }
            return { year: newYear, month: newMonth };
        });
    };

    const isCurrentMonth = () => {
        const now = new Date();
        return historyMonth.year === now.getFullYear() && historyMonth.month === now.getMonth();
    };

    const monthLabel = new Date(historyMonth.year, historyMonth.month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-gray-600">Loading your tasks...</span>
            </div>
        );
    }

    return (
        <div className="space-y-3 md:space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl lg:text-page-title text-gray-900">End of Day Report</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {todayReport ? '✅ Submitted Today' : '⏰ Pending Submission'} | {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                {profile?.role === 'admin' && (
                    <Link
                        href="/admin/eod-report/admin-view"
                        className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        Admin Dashboard →
                    </Link>
                )}
            </div>

            {/* EOD Time Banner */}
            {isEODTime && !todayReport && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="font-medium text-amber-800 text-sm">It&apos;s EOD time! Please submit your report before leaving.</p>
                    </div>
                </div>
            )}
            {isPastEODTime && !todayReport && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                        <p className="font-medium text-red-800 text-sm">EOD report overdue! Please submit immediately.</p>
                    </div>
                </div>
            )}

            {/* Status Banner */}
            {todayReport && (
                <div className="bg-white border border-green-200 rounded-md p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-green-900 text-sm">Report submitted at {new Date(todayReport.submitted_at).toLocaleTimeString()}</p>
                            <p className="text-xs text-gray-500">You can still edit and update today&apos;s report</p>
                        </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-md">
                        <Pencil className="w-3 h-3" /> Editable
                    </span>
                </div>
            )}

            {/* Main 2-Column Layout: Form (left) + History (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* LEFT: EOD Form — 3 columns */}
                <div className="lg:col-span-3">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Tasks Section */}
                        <div className="bg-white rounded-md border border-gray-200 p-4">
                            <h2 className="text-section text-gray-900 mb-3">Today&apos;s Tasks ({todayTasks.length})</h2>

                            {todayTasks.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                    <FileText className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                    <p>No active tasks assigned to you</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {todayTasks.map(task => (
                                        <div key={task.id} className="border border-gray-200 rounded-md overflow-hidden">
                                            {/* Task Header */}
                                            <div
                                                className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => toggleTaskExpanded(task.id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {taskUpdates[task.id]?.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm">#{task.job_number} - {task.project_name}</p>
                                                        <p className="text-xs text-gray-600">{task.client?.name || task.client?.company}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-500">Stage: <span className="font-medium text-gray-900">{task.current_stage}</span></span>
                                                    {task.client_deadline && (
                                                        <span className="flex items-center gap-1 text-gray-500">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(task.client_deadline).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Task Update Form */}
                                            {taskUpdates[task.id]?.expanded && (
                                                <div className="p-3 space-y-3 bg-white">
                                                    {/* Status Selection */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Task Status</label>
                                                        <select
                                                            value={taskUpdates[task.id]?.task_status || 'START WORK'}
                                                            onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm font-medium"
                                                        >
                                                            <option value="NOT START">❌ Not Started</option>
                                                            <option value="START WORK">🔄 Start Work / Pending</option>
                                                            <option value="COMPLETE">✅ Complete</option>
                                                        </select>
                                                    </div>

                                                    {/* Status Update */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Status Update <span className="text-red-500">*</span>
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={taskUpdates[task.id]?.status_update || ''}
                                                            onChange={(e) => handleTaskUpdate(task.id, 'status_update', e.target.value)}
                                                            placeholder="What did you work on today?"
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                                                        />
                                                    </div>

                                                    {/* Completion & Time */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 mb-1">Completion %</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={taskUpdates[task.id]?.completion_percentage || 0}
                                                                onChange={(e) => handleTaskUpdate(task.id, 'completion_percentage', parseInt(e.target.value))}
                                                                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 mb-1">Time Spent (hrs)</label>
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                min="0"
                                                                value={taskUpdates[task.id]?.time_spent || 0}
                                                                onChange={(e) => handleTaskUpdate(task.id, 'time_spent', parseFloat(e.target.value))}
                                                                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Dynamic Checklist */}
                                                    {taskUpdates[task.id]?.checklist_items && taskUpdates[task.id].checklist_items.length > 0 && (
                                                        <div>
                                                            <ProductChecklistCard
                                                                productCategory={task.product_category || task.job_type || 'Other'}
                                                                taskStatus={taskUpdates[task.id].task_status}
                                                                checklistItems={taskUpdates[task.id].checklist_items}
                                                                onUpdate={(items) => handleTaskUpdate(task.id, 'checklist_items', items)}
                                                                category="design"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Quick Checks */}
                                                    <div className="space-y-1">
                                                        <label className="block text-xs font-medium text-gray-700">Quick Checks</label>
                                                        <div className="flex flex-wrap gap-3">
                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={taskUpdates[task.id]?.client_approval_received || false}
                                                                    onChange={(e) => handleTaskUpdate(task.id, 'client_approval_received', e.target.checked)}
                                                                    className="w-3.5 h-3.5 text-primary rounded"
                                                                />
                                                                <span className="text-xs text-gray-700">Client Approval</span>
                                                            </label>
                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={taskUpdates[task.id]?.print_file_ready || false}
                                                                    onChange={(e) => handleTaskUpdate(task.id, 'print_file_ready', e.target.checked)}
                                                                    className="w-3.5 h-3.5 text-primary rounded"
                                                                />
                                                                <span className="text-xs text-gray-700">Print File Ready</span>
                                                            </label>
                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={taskUpdates[task.id]?.print_checklist_done || false}
                                                                    onChange={(e) => handleTaskUpdate(task.id, 'print_checklist_done', e.target.checked)}
                                                                    className="w-3.5 h-3.5 text-primary rounded"
                                                                />
                                                                <span className="text-xs text-gray-700">Pre-print Checklist</span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* Client Comments */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Client Comments</label>
                                                        <input
                                                            type="text"
                                                            value={taskUpdates[task.id]?.client_comments || ''}
                                                            onChange={(e) => handleTaskUpdate(task.id, 'client_comments', e.target.value)}
                                                            placeholder="Any feedback from client?"
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
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
                        <div className="bg-white rounded-md border border-gray-200 p-4 space-y-3">
                            <h2 className="text-section text-gray-900">Overall Summary</h2>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Overall Notes</label>
                                <textarea
                                    rows={2}
                                    value={overallNotes}
                                    onChange={(e) => setOverallNotes(e.target.value)}
                                    placeholder="General notes about your day..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Blockers / Issues</label>
                                <textarea
                                    rows={2}
                                    value={blockers}
                                    onChange={(e) => setBlockers(e.target.value)}
                                    placeholder="Any problems or blockers?"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Tomorrow&apos;s Plan</label>
                                <textarea
                                    rows={2}
                                    value={tomorrowPlan}
                                    onChange={(e) => setTomorrowPlan(e.target.value)}
                                    placeholder="What will you focus on tomorrow?"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Total Work Hours</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="24"
                                    value={workHours}
                                    onChange={(e) => setWorkHours(parseFloat(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md max-w-[120px] text-sm"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-md p-3 border border-gray-200">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Submit before leaving office</span>
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-4 py-2 bg-gray-900 text-white rounded-md font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm text-sm"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        {todayReport ? 'Update Report' : 'Submit Report'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* RIGHT: History Panel — 2 columns */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-md border border-gray-200 sticky top-4">
                        {/* Month Navigator */}
                        <div className="flex items-center justify-between p-3 border-b border-gray-200">
                            <button
                                onClick={() => navigateMonth(-1)}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
                            </div>
                            <button
                                onClick={() => navigateMonth(1)}
                                disabled={isCurrentMonth()}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* History Stats */}
                        <div className="grid grid-cols-2 gap-2 p-3 border-b border-gray-100">
                            <div className="bg-gray-50 rounded-md p-2 text-center">
                                <p className="text-lg font-bold text-gray-900">{pastReports.length}</p>
                                <p className="text-[10px] text-gray-500 uppercase font-medium">Reports</p>
                            </div>
                            <div className="bg-gray-50 rounded-md p-2 text-center">
                                <p className="text-lg font-bold text-gray-900">
                                    {pastReports.reduce((sum, r) => sum + (r.work_hours || 0), 0).toFixed(1)}
                                </p>
                                <p className="text-[10px] text-gray-500 uppercase font-medium">Total Hours</p>
                            </div>
                        </div>

                        {/* Reports List */}
                        <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                </div>
                            ) : pastReports.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    <Calendar className="w-5 h-5 mx-auto mb-2" />
                                    <p>No reports this month</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {pastReports.map(report => (
                                        <div key={report.id}>
                                            <button
                                                onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                                                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${report.report_date === today ? 'bg-green-500' : 'bg-gray-300'
                                                        }`} />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500">
                                                            {report.task_updates?.length || 0} tasks • {report.work_hours || 0}h
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {report.report_date === today ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                                            <Pencil className="w-2.5 h-2.5" /> Editable
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                                            <Lock className="w-2.5 h-2.5" />
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-gray-400">
                                                        {new Date(report.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {expandedReport === report.id
                                                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                                    }
                                                </div>
                                            </button>

                                            {/* Expanded Report Details */}
                                            {expandedReport === report.id && (
                                                <div className="px-3 pb-3 space-y-2">
                                                    {report.overall_notes && (
                                                        <div className="bg-gray-50 rounded-md p-2">
                                                            <p className="text-[10px] uppercase font-medium text-gray-400 mb-1">Notes</p>
                                                            <p className="text-xs text-gray-700">{report.overall_notes}</p>
                                                        </div>
                                                    )}
                                                    {report.blockers && (
                                                        <div className="bg-red-50 rounded-md p-2">
                                                            <p className="text-[10px] uppercase font-medium text-red-400 mb-1">Blockers</p>
                                                            <p className="text-xs text-red-700">{report.blockers}</p>
                                                        </div>
                                                    )}
                                                    {report.tomorrow_plan && (
                                                        <div className="bg-gray-50 rounded-md p-2">
                                                            <p className="text-[10px] uppercase font-medium text-gray-400 mb-1">Next Day Plan</p>
                                                            <p className="text-xs text-gray-700">{report.tomorrow_plan}</p>
                                                        </div>
                                                    )}
                                                    {report.task_updates && report.task_updates.length > 0 && (
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase font-medium text-gray-400">Tasks</p>
                                                            {report.task_updates.map((tu: any, idx: number) => (
                                                                <div key={idx} className="flex items-start gap-2 text-xs bg-white border border-gray-100 rounded-md p-2">
                                                                    <span className={`mt-0.5 flex-shrink-0 ${tu.task_status === 'COMPLETE' ? 'text-green-500' :
                                                                        tu.task_status === 'NOT START' ? 'text-red-500' : 'text-amber-500'
                                                                        }`}>
                                                                        {tu.task_status === 'COMPLETE' ? '✅' : tu.task_status === 'NOT START' ? '❌' : '🔄'}
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <p className="font-medium text-gray-900 truncate">
                                                                            {tu.job?.job_number ? `#${tu.job.job_number}` : 'Task'}
                                                                            {tu.job?.project_name && ` - ${tu.job.project_name}`}
                                                                        </p>
                                                                        {tu.status_update && <p className="text-gray-600 mt-0.5">{tu.status_update}</p>}
                                                                        {tu.completion_percentage > 0 && (
                                                                            <div className="flex items-center gap-2 mt-1">
                                                                                <div className="flex-1 h-1 bg-gray-200 rounded-full">
                                                                                    <div className="h-1 bg-gray-900 rounded-full" style={{ width: `${tu.completion_percentage}%` }} />
                                                                                </div>
                                                                                <span className="text-[10px] text-gray-500">{tu.completion_percentage}%</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
