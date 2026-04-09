'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDailyReports, useWorkLogs, useJobs } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import {
    Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, ChevronLeft,
    Calendar, Loader2, Send, FileText, History, Lock, Pencil, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import ProductChecklistCard from '@/components/eod/ProductChecklistCard';

export default function EODReportPage() {
    const { profile } = useAuth();
    const router = useRouter();
    const {
        fetchMyTodayTasks, submitEODReport, getMyReports, fetchProductChecklist,
        loadTodayTaskResponses, loadLastTaskResponsesForUser, submitPastEODEdit
    } = useDailyReports();
    const { updateJobStage } = useJobs();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [todayTasks, setTodayTasks] = useState<any[]>([]);
    const [pastReports, setPastReports] = useState<any[]>([]);
    const [pastDayReports, setPastDayReports] = useState<any[]>([]);
    const [todayReport, setTodayReport] = useState<any>(null);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [expandedPastDay, setExpandedPastDay] = useState<string | null>(null);
    const [editingPastCard, setEditingPastCard] = useState<string | null>(null);
    const [pastCardEdits, setPastCardEdits] = useState<Record<string, any>>({});
    const [savingPastCard, setSavingPastCard] = useState<string | null>(null);
    const [savingTask, setSavingTask] = useState<string | null>(null);
    const [autoLogCount, setAutoLogCount] = useState(0);

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

    // Auto work logs – pre-populate EOD notes
    const { todaySummary: workLogSummary, logs: workLogs } = useWorkLogs(profile?.id);

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
        editMode: boolean;   // false = read-only card; true = show edit form
        _saved_id?: string;
    }>>({});

    // Check if it's EOD time (6-7 PM)
    const currentHour = new Date().getHours();
    const isEODTime = currentHour >= 18 && currentHour < 19;
    const isPastEODTime = currentHour >= 19;

    // Admins should never fill EOD – redirect to admin view
    useEffect(() => {
        if (profile?.role === 'admin') {
            router.replace('/admin/eod-report/admin-view');
        }
    }, [profile?.role, router]);

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

                // Build default task update state (blank, editMode on for new tasks)
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
                        expanded: true,
                        editMode: true   // default open for new tasks
                    };
                });

                // Helper: apply a saved response row onto initialUpdates
                // Always keep editMode=true so Save button is always visible
                const applySaved = (taskId: string, saved: any) => {
                    initialUpdates[taskId] = {
                        task_status: saved.task_status || 'START WORK',
                        status_update: saved.status_update || '',
                        completion_percentage: saved.completion_percentage || 0,
                        time_spent: saved.time_spent || 0,
                        product_category: initialUpdates[taskId]?.product_category || '',
                        checklist_items: saved.checklist || [],
                        client_approval_received: saved.client_approval_received || false,
                        print_file_ready: saved.print_file_ready || false,
                        print_checklist_done: saved.print_checklist_done || false,
                        client_comments: saved.client_comments || '',
                        expanded: true,
                        editMode: true,  // always editable — Save button always visible
                        _saved_id: saved.id
                    };
                };

                // Check if today's report already exists
                const { data: reports } = await getMyReports(profile.id);
                if (reports) {
                    const existingReport = reports.find((r: any) => r.report_date === today);
                    if (existingReport) {
                        setTodayReport(existingReport);
                        setOverallNotes(existingReport.overall_notes || '');
                        setBlockers(existingReport.blockers || '');
                        setTomorrowPlan(existingReport.tomorrow_plan || '');
                        setWorkHours(existingReport.work_hours || 8);

                        // Pre-populate task form with today's saved responses
                        const savedResponses = await loadTodayTaskResponses(existingReport.id);
                        tasks.forEach((task: any) => {
                            const saved = savedResponses[task.id];
                            if (saved) applySaved(task.id, saved);
                        });

                        // Load past day reports (up to 7 previous days)
                        const pastOnly = reports.filter((r: any) => r.report_date !== today);
                        setPastDayReports(pastOnly.slice(0, 7));
                    } else {
                        // No report for today yet — carry forward LAST saved state for each task
                        // so designers don't have to re-type the same details every morning.
                        const jobIds = tasks.map((t: any) => t.id);
                        const lastResponses = await loadLastTaskResponsesForUser(profile.id, jobIds);
                        tasks.forEach((task: any) => {
                            const last = lastResponses[task.id];
                            if (last) applySaved(task.id, last);
                        });

                        // Pre-populate overall notes from work logs
                        if (workLogSummary) {
                            setOverallNotes(workLogSummary);
                            setAutoLogCount(workLogs.length);
                        }
                        const pastOnly = reports.filter((r: any) => r.report_date !== today);
                        setPastDayReports(pastOnly.slice(0, 7));
                    }
                }

                setTaskUpdates(initialUpdates);
            }
        } catch (e: any) {
            toast.error('Failed to load tasks: ' + (e.message || 'Unknown error'));
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
        } catch (e: any) {
            toast.error('Failed to load history: ' + (e.message || 'Unknown error'));
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

    const setTaskEditMode = (taskId: string, editMode: boolean) => {
        setTaskUpdates(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], editMode }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        setSubmitting(true);
        try {
            const updates = Object.keys(taskUpdates)
                .map(taskId => ({
                    job_id: taskId,
                    task_status: taskUpdates[taskId].task_status,
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
                toast.error('Error submitting report: ' + String(error));
            } else {
                // Auto-advance stage: jobs marked COMPLETE while in 'designing' move to 'approval'
                // so they drop off the designer's daily task list automatically.
                const completedTasks = todayTasks.filter(
                    (task: any) =>
                        taskUpdates[task.id]?.task_status === 'COMPLETE' &&
                        task.current_stage === 'designing'
                );
                if (completedTasks.length > 0) {
                    await Promise.all(
                        completedTasks.map((task: any) =>
                            updateJobStage(task.id, 'approval', 'Design completed via EOD report')
                        )
                    );
                    if (completedTasks.length === 1) {
                        toast.success(`✅ "${completedTasks[0].project_name}" moved to Approval stage`);
                    } else {
                        toast.success(`✅ ${completedTasks.length} jobs moved to Approval stage`);
                    }
                } else {
                    toast.success('EOD Report submitted successfully!');
                }
                await loadData();
                await loadHistory();
            }
        } catch (e: any) {
            toast.error('Error: ' + (e.message || 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    // Open edit mode for a past EOD task card
    const handlePastCardEdit = (taskUpdate: any) => {
        setEditingPastCard(taskUpdate.id);
        setPastCardEdits(prev => ({
            ...prev,
            [taskUpdate.id]: {
                task_status: taskUpdate.task_status || 'START WORK',
                status_update: taskUpdate.status_update || '',
                time_spent: taskUpdate.time_spent || 0,
                client_comments: taskUpdate.client_comments || ''
            }
        }));
    };

    // Save a single today-task edit (upserts into the report)
    const handleSaveTaskEdit = async (taskId: string) => {
        if (!profile?.id) return;
        const taskData = taskUpdates[taskId];
        if (!taskData) return;

        setSavingTask(taskId);
        try {
            const { error } = await submitEODReport({
                user_id: profile.id,
                report_date: reportDate,
                overall_notes: overallNotes,
                blockers: blockers,
                tomorrow_plan: tomorrowPlan,
                work_hours: workHours,
                task_updates: [{
                    job_id: taskId,
                    task_status: taskData.task_status,
                    status_update: taskData.status_update,
                    completion_percentage: taskData.completion_percentage,
                    time_spent: taskData.time_spent,
                    checklist: taskData.checklist_items,
                    client_approval_received: taskData.client_approval_received,
                    print_file_ready: taskData.print_file_ready,
                    print_checklist_done: taskData.print_checklist_done,
                    client_comments: taskData.client_comments
                }]
            });
            if (error) {
                toast.error('Failed to save: ' + error);
            } else {
                toast.success('Task update saved!');
                // Collapse the card after successful save
                setTaskUpdates(prev => ({
                    ...prev,
                    [taskId]: { ...prev[taskId], expanded: false }
                }));
                await loadData();
            }
        } catch (e: any) {
            toast.error('Error: ' + (e.message || 'Unknown error'));
        } finally {
            setSavingTask(null);
        }
    };

    // Save an edited past EOD card with full audit logging
    const handlePastCardSave = async (report: any, taskUpdate: any) => {
        if (!profile?.id) return;
        const edits = pastCardEdits[taskUpdate.id];
        if (!edits) return;

        const changes: Array<{ field: string; old_value: string | null; new_value: string | null }> = [];
        const fields = ['task_status', 'status_update', 'time_spent', 'client_comments'] as const;
        for (const field of fields) {
            const oldVal = String(taskUpdate[field] ?? '');
            const newVal = String(edits[field] ?? '');
            if (oldVal !== newVal) {
                changes.push({ field, old_value: oldVal || null, new_value: newVal || null });
            }
        }

        if (changes.length === 0) {
            setEditingPastCard(null);
            return;
        }

        setSavingPastCard(taskUpdate.id);
        try {
            const { error } = await submitPastEODEdit({
                report_id: report.id,
                task_update_id: taskUpdate.id,
                job_id: taskUpdate.job_id,
                original_date: report.report_date,
                user_id: profile.id,
                user_name: profile.full_name || 'Unknown',
                changes,
                updatedFields: edits
            });
            if (error) {
                toast.error('Failed to save edit: ' + error);
            } else {
                toast.success('Past EOD updated. Admin has been notified.');
                setEditingPastCard(null);
                await loadData();
            }
        } finally {
            setSavingPastCard(null);
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
                        {todayReport ? '✓ Submitted Today' : '⏰ Pending Submission'} | {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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

            {/* Main 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* LEFT: EOD Form */}
                <div className="lg:col-span-3">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Tasks Section */}
                        <div className="bg-white rounded-md border border-gray-200 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-0.5">Step 1</span>
                                    <h2 className="text-section text-gray-900">Task Updates ({todayTasks.length})</h2>
                                </div>
                                {todayTasks.length > 0 && (() => {
                                    const needsEdit = Object.values(taskUpdates).filter((t: any) => t.editMode).length;
                                    return needsEdit > 0 ? (
                                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 font-medium">
                                            {needsEdit} need update
                                        </span>
                                    ) : (
                                        <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 font-medium">
                                            ✓ All filled
                                        </span>
                                    );
                                })()}
                            </div>

                            {todayTasks.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                    <FileText className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                    <p>No active tasks assigned to you</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {todayTasks.map(task => (
                                        <div key={task.id} className="border border-amber-200 rounded-md overflow-hidden transition-all shadow-sm">
                                            {/* Task Header — always visible */}
                                            <div
                                                className="flex items-center justify-between p-3 cursor-pointer transition-colors bg-amber-50 hover:bg-amber-100"
                                            >
                                                <div className="flex items-center gap-2" onClick={() => toggleTaskExpanded(task.id)}>
                                                    {taskUpdates[task.id]?.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    <div>
                                                        <p className="font-medium text-gray-900 text-sm">#{task.job_number} - {task.project_name}</p>
                                                        <p className="text-xs text-gray-600">{task.client?.company || task.client?.name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-500 hidden sm:inline">Stage: <span className="font-medium text-gray-900">{task.current_stage}</span></span>
                                                    {task.client_deadline && (
                                                        <span className="flex items-center gap-1 text-gray-500 hidden sm:flex">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(task.client_deadline).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {taskUpdates[task.id]?.expanded && (
                                                    /* ── EDIT FORM — always visible ── */
                                                    <div className="p-3 space-y-3 bg-white">
                                                        {/* Row: Status + Time */}
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div className="col-span-2">
                                                                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                                                <select
                                                                    value={taskUpdates[task.id]?.task_status || 'START WORK'}
                                                                    onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm font-medium"
                                                                >
                                                                    <option value="NOT START">⬜ Not Started</option>
                                                                    <option value="START WORK">🔄 In Progress</option>
                                                                    <option value="COMPLETE">✅ Completed</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-700 mb-1">Time (hrs)</label>
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

                                                        {/* Status Update */}
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                                What did you work on? <span className="text-red-500">*</span>
                                                            </label>
                                                            <textarea
                                                                rows={2}
                                                                value={taskUpdates[task.id]?.status_update || ''}
                                                                onChange={(e) => handleTaskUpdate(task.id, 'status_update', e.target.value)}
                                                                placeholder="Quick update on this task..."
                                                                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                                                            />
                                                        </div>

                                                        {/* Only show completion % + checklist + quick checks when COMPLETE */}
                                                        {taskUpdates[task.id]?.task_status === 'COMPLETE' && (
                                                            <div className="space-y-3 border-t border-gray-100 pt-3">
                                                                {/* Completion % */}
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Completion %</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        value={taskUpdates[task.id]?.completion_percentage || 100}
                                                                        onChange={(e) => handleTaskUpdate(task.id, 'completion_percentage', parseInt(e.target.value))}
                                                                        className="w-full max-w-[120px] px-3 py-2 border border-gray-200 rounded-md text-sm"
                                                                    />
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
                                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Client Comments <span className="text-gray-400 font-normal">(optional)</span></label>
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

                                                        {/* Save button at bottom */}
                                                        <div className="flex gap-2 pt-3 border-t border-gray-200">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveTaskEdit(task.id)}
                                                                disabled={savingTask === task.id}
                                                                className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 text-white rounded-md text-sm font-bold hover:bg-green-700 disabled:opacity-50 shadow-sm transition-colors"
                                                            >
                                                                {savingTask === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                                {savingTask === task.id ? 'Saving...' : '💾 Save Changes'}
                                                            </button>
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
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-0.5">Step 2</span>
                                <h2 className="text-section text-gray-900">Day Summary</h2>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-medium text-gray-700">Overall Notes</label>
                                    {autoLogCount > 0 && !todayReport && (
                                        <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md border border-amber-200 font-semibold">
                                            ⚡ Auto-filled from {autoLogCount} activity log{autoLogCount !== 1 ? 's' : ''} today
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    rows={overallNotes ? Math.max(3, overallNotes.split('\n').length + 1) : 2}
                                    value={overallNotes}
                                    onChange={(e) => setOverallNotes(e.target.value)}
                                    placeholder="General notes about your day..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono text-xs"
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

                {/* RIGHT: History Panel */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-md border border-gray-200 sticky top-4">
                        {/* Month Navigator */}
                        <div className="flex items-center justify-between p-3 border-b border-gray-200">
                            <button onClick={() => navigateMonth(-1)} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
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

                        {/* Performance Stats */}
                        {(() => {
                            const totalHours = pastReports.reduce((sum, r) => sum + (r.work_hours || 0), 0);
                            const avgHours = pastReports.length > 0 ? (totalHours / pastReports.length) : 0;
                            // Count working days in the month (Mon-Fri)
                            const now = new Date();
                            const daysInMonth = new Date(historyMonth.year, historyMonth.month + 1, 0).getDate();
                            const workingDays = Array.from({ length: daysInMonth }, (_, i) => {
                                const d = new Date(historyMonth.year, historyMonth.month, i + 1);
                                return d.getDay() !== 0 && d.getDay() !== 6 &&
                                    (historyMonth.year < now.getFullYear() || historyMonth.month < now.getMonth() ||
                                        i + 1 <= now.getDate());
                            }).filter(Boolean).length;
                            const attendance = workingDays > 0 ? Math.round((pastReports.length / workingDays) * 100) : 0;
                            return (
                                <div className="p-3 border-b border-gray-100">
                                    <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-2">My Performance</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-gray-50 rounded-md p-2 text-center">
                                            <p className="text-lg font-bold text-gray-900">{pastReports.length}</p>
                                            <p className="text-xs text-gray-500 uppercase font-medium">Reports</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-md p-2 text-center">
                                            <p className="text-lg font-bold text-gray-900">{totalHours.toFixed(1)}</p>
                                            <p className="text-xs text-gray-500 uppercase font-medium">Total Hrs</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-md p-2 text-center">
                                            <p className="text-lg font-bold text-gray-900">{avgHours.toFixed(1)}</p>
                                            <p className="text-xs text-gray-500 uppercase font-medium">Avg Hrs/Day</p>
                                        </div>
                                        <div className={`rounded-md p-2 text-center ${attendance >= 90 ? 'bg-green-50' : attendance >= 70 ? 'bg-amber-50' : 'bg-red-50'}`}>
                                            <p className={`text-lg font-bold ${attendance >= 90 ? 'text-green-700' : attendance >= 70 ? 'text-amber-700' : 'text-red-700'}`}>
                                                {attendance}%
                                            </p>
                                            <p className={`text-xs uppercase font-medium ${attendance >= 90 ? 'text-green-500' : attendance >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                                                Attendance
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

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
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${report.report_date === today ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {report.task_updates?.length || 0} tasks • {report.work_hours || 0}h
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {report.report_date === today ? (
                                                        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                                            <Pencil className="w-2.5 h-2.5" /> Editable
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-xs text-gray-400">
                                                            <Lock className="w-2.5 h-2.5" />
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-400">
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
                                                            <p className="text-xs uppercase font-medium text-gray-400 mb-1">Notes</p>
                                                            <p className="text-xs text-gray-700">{report.overall_notes}</p>
                                                        </div>
                                                    )}
                                                    {report.blockers && (
                                                        <div className="bg-red-50 rounded-md p-2">
                                                            <p className="text-xs uppercase font-medium text-red-400 mb-1">Blockers</p>
                                                            <p className="text-xs text-red-700">{report.blockers}</p>
                                                        </div>
                                                    )}
                                                    {report.tomorrow_plan && (
                                                        <div className="bg-gray-50 rounded-md p-2">
                                                            <p className="text-xs uppercase font-medium text-gray-400 mb-1">Next Day Plan</p>
                                                            <p className="text-xs text-gray-700">{report.tomorrow_plan}</p>
                                                        </div>
                                                    )}
                                                    {report.task_updates && report.task_updates.length > 0 && (
                                                        <div className="space-y-1">
                                                            <p className="text-xs uppercase font-medium text-gray-400">Tasks</p>
                                                            {report.task_updates.map((tu: any, idx: number) => (
                                                                <div key={idx} className="flex items-start gap-2 text-xs bg-white border border-gray-100 rounded-md p-2">
                                                                    <span className={`mt-0.5 flex-shrink-0 ${tu.task_status === 'COMPLETE' ? 'text-green-500' : tu.task_status === 'NOT START' ? 'text-red-500' : 'text-amber-500'}`}>
                                                                        {tu.task_status === 'COMPLETE' ? '✓' : tu.task_status === 'NOT START' ? '✗' : '↻'}
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <p className="font-medium text-gray-900 truncate">
                                                                            {tu.job?.job_number ? `#${tu.job.job_number}` : 'Task'}
                                                                            {tu.job?.project_name && ` - ${tu.job.project_name}`}
                                                                        </p>
                                                                        {tu.status_update && <p className="text-gray-600 mt-0.5">{tu.status_update}</p>}
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

            {/* ── Previous EOD Reports (locked, editable with audit log) ── */}
            {pastDayReports.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-gray-400" />
                        <h2 className="text-section text-gray-700">Previous EOD Reports</h2>
                        <span className="text-xs text-gray-400">({pastDayReports.length} entries — read-only, edit with audit log)</span>
                    </div>

                    {pastDayReports.map(report => {
                        const dateLabel = new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'long', day: 'numeric', month: 'short'
                        });
                        const isExpanded = expandedPastDay === report.id;

                        return (
                            <div key={report.id} className="bg-white border border-gray-200 rounded-md overflow-hidden">
                                {/* Report header */}
                                <button
                                    onClick={() => setExpandedPastDay(isExpanded ? null : report.id)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{dateLabel}</p>
                                            <p className="text-xs text-gray-500">
                                                {report.task_updates?.length || 0} tasks • {report.work_hours || 0}h worked
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-medium">🔒 Locked</span>
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-2 bg-gray-50/50">
                                        {/* Summary notes */}
                                        {(report.overall_notes || report.blockers) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                                                {report.overall_notes && (
                                                    <div className="bg-white border border-gray-200 rounded-md p-2">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Overall Notes</p>
                                                        <p className="text-xs text-gray-700">{report.overall_notes}</p>
                                                    </div>
                                                )}
                                                {report.blockers && (
                                                    <div className="bg-red-50 border border-red-200 rounded-md p-2">
                                                        <p className="text-[10px] font-bold text-red-400 uppercase mb-1">⚠ Blockers</p>
                                                        <p className="text-xs text-red-700">{report.blockers}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Task cards */}
                                        {(report.task_updates || []).map((tu: any) => {
                                            const isEditing = editingPastCard === tu.id;
                                            const edits = pastCardEdits[tu.id] || {};
                                            const isSaving = savingPastCard === tu.id;

                                            return (
                                                <div key={tu.id} className={`border rounded-md overflow-hidden ${isEditing ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                                                    {/* Card header */}
                                                    <div className="flex items-center justify-between p-2.5 border-b border-gray-100">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {tu.job?.job_number ? `#${tu.job.job_number}` : 'Task'}
                                                                {tu.job?.project_name && ` – ${tu.job.project_name}`}
                                                            </p>
                                                            <p className="text-xs text-gray-500">{tu.job?.client?.company || tu.job?.client?.name}</p>
                                                        </div>
                                                        {!isEditing && (
                                                            <button
                                                                onClick={() => handlePastCardEdit(tu)}
                                                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors font-medium"
                                                            >
                                                                <Pencil className="w-3 h-3" /> Edit
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Card body */}
                                                    <div className="p-2.5">
                                                        {isEditing ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-2 py-1 rounded">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    Editing a past EOD. Changes will be logged and admin will be notified.
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                                                        <select
                                                                            value={edits.task_status || 'START WORK'}
                                                                            onChange={e => setPastCardEdits(prev => ({ ...prev, [tu.id]: { ...prev[tu.id], task_status: e.target.value } }))}
                                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs"
                                                                        >
                                                                            <option value="NOT START">Not Started</option>
                                                                            <option value="START WORK">In Progress</option>
                                                                            <option value="COMPLETE">Completed</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Time (hrs)</label>
                                                                        <input
                                                                            type="number" step="0.5" min="0"
                                                                            value={edits.time_spent || 0}
                                                                            onChange={e => setPastCardEdits(prev => ({ ...prev, [tu.id]: { ...prev[tu.id], time_spent: parseFloat(e.target.value) } }))}
                                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Update / Remarks</label>
                                                                    <textarea
                                                                        rows={2}
                                                                        value={edits.status_update || ''}
                                                                        onChange={e => setPastCardEdits(prev => ({ ...prev, [tu.id]: { ...prev[tu.id], status_update: e.target.value } }))}
                                                                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs"
                                                                    />
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handlePastCardSave(report, tu)}
                                                                        disabled={isSaving}
                                                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-semibold hover:bg-gray-800 disabled:opacity-50"
                                                                    >
                                                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                                                        {isSaving ? 'Saving...' : 'Save & Log'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingPastCard(null)}
                                                                        className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-md text-xs hover:bg-gray-50"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1 text-xs text-gray-700">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-semibold ${tu.task_status === 'COMPLETE' ? 'text-green-700' : tu.task_status === 'NOT START' ? 'text-red-600' : 'text-amber-700'}`}>
                                                                        {tu.task_status === 'COMPLETE' ? '✅ Completed' : tu.task_status === 'NOT START' ? '❌ Not Started' : '🔄 In Progress'}
                                                                    </span>
                                                                    {tu.time_spent > 0 && <span className="text-gray-400">{tu.time_spent}h</span>}
                                                                </div>
                                                                {tu.status_update && (
                                                                    <p className="text-gray-600 bg-gray-50 rounded px-2 py-1">{tu.status_update}</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
