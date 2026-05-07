'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDailyReports, useWorkLogs, useJobs } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import {
    Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, ChevronLeft,
    Calendar, Loader2, Send, FileText, History, Lock, Pencil, X
} from 'lucide-react';
import Link from 'next/link';
import ProductChecklistCard from '@/components/eod/ProductChecklistCard';

// ── Constants ─────────────────────────────────────────────────────────────────
const BLOCKER_CHIPS = [
    'Waiting for client',
    'Content not received',
    'Rework requested',
    'Machine / print issue',
    'Other',
];

const WORK_HOURS_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 10];
const PROGRESS_OPTIONS = [0, 25, 50, 75, 100];

const STATUS_CONFIG = {
    'NOT START':  { label: 'Not Started', color: 'bg-gray-100 text-gray-600 border-gray-200',  dot: 'bg-gray-400'  },
    'START WORK': { label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
    'COMPLETE':   { label: 'Done ✓',      color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function EODReportPage() {
    const { profile } = useAuth();
    const router = useRouter();
    const {
        fetchMyTodayTasks, submitEODReport, getMyReports, fetchProductChecklist,
        loadTodayTaskResponses, loadLastTaskResponsesForUser, submitPastEODEdit
    } = useDailyReports();
    const { updateJobStage } = useJobs();

    const [loading, setLoading]           = useState(true);
    const [submitting, setSubmitting]     = useState(false);
    const [todayTasks, setTodayTasks]     = useState<any[]>([]);
    const [pastReports, setPastReports]   = useState<any[]>([]);
    const [pastDayReports, setPastDayReports] = useState<any[]>([]);
    const [todayReport, setTodayReport]   = useState<any>(null);
    const [expandedReport, setExpandedReport]   = useState<string | null>(null);
    const [expandedPastDay, setExpandedPastDay] = useState<string | null>(null);
    const [editingPastCard, setEditingPastCard] = useState<string | null>(null);
    const [pastCardEdits, setPastCardEdits]     = useState<Record<string, any>>({});
    const [savingPastCard, setSavingPastCard]   = useState<string | null>(null);
    const [savingTask, setSavingTask]           = useState<string | null>(null);

    // History month
    const [historyMonth, setHistoryMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [historyLoading, setHistoryLoading] = useState(false);

    // Form state
    const today = new Date().toISOString().split('T')[0];
    const [reportDate] = useState(today);
    const [overallNotes, setOverallNotes]       = useState('');
    const [selectedBlockers, setSelectedBlockers] = useState<string[]>([]);
    const [tomorrowPlan, setTomorrowPlan]       = useState('');
    const [workHours, setWorkHours]             = useState<number>(8);

    // Derive blockers string from chips (keeps DB schema unchanged)
    const blockers = selectedBlockers.join(', ');

    // Work logs (keep for auto-populate overall notes)
    const { todaySummary: workLogSummary, logs: workLogs } = useWorkLogs(profile?.id);

    // Per-task state
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
        editMode: boolean;
        confirmed: boolean;   // ← NEW: "no change today" tapped
        _saved_id?: string;
    }>>({});

    const currentHour = new Date().getHours();
    const isEODTime    = currentHour >= 18 && currentHour < 19;
    const isPastEODTime = currentHour >= 19;

    // Redirect admin to admin view
    useEffect(() => {
        if (profile?.role === 'admin') router.replace('/admin/eod-report/admin-view');
    }, [profile?.role, router]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (profile?.id) loadData(); },    [profile?.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (profile?.id) loadHistory(); }, [profile?.id, historyMonth.year, historyMonth.month]);

    // ── Data loading ──────────────────────────────────────────────────────────
    const loadData = async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            const { data: tasks, error: tasksError } = await fetchMyTodayTasks(profile.id);
            if (!tasksError && tasks) {
                setTodayTasks(tasks);

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
                        expanded: false,   // ← CLOSED by default
                        editMode: false,
                        confirmed: false,
                    };
                });

                const applySaved = (taskId: string, saved: any) => {
                    initialUpdates[taskId] = {
                        ...initialUpdates[taskId],
                        task_status: saved.task_status || 'START WORK',
                        status_update: saved.status_update || '',
                        completion_percentage: saved.completion_percentage || 0,
                        time_spent: saved.time_spent || 0,
                        checklist_items: saved.checklist || [],
                        client_approval_received: saved.client_approval_received || false,
                        print_file_ready: saved.print_file_ready || false,
                        print_checklist_done: saved.print_checklist_done || false,
                        client_comments: saved.client_comments || '',
                        expanded: false,
                        editMode: false,
                        confirmed: false,
                        _saved_id: saved.id
                    };
                };

                const { data: reports } = await getMyReports(profile.id);
                if (reports) {
                    const existingReport = reports.find((r: any) => r.report_date === today);
                    if (existingReport) {
                        setTodayReport(existingReport);
                        setOverallNotes(existingReport.overall_notes || '');
                        setTomorrowPlan(existingReport.tomorrow_plan || '');
                        setWorkHours(existingReport.work_hours || 8);
                        // Parse blockers string back to chip array
                        if (existingReport.blockers) {
                            setSelectedBlockers(existingReport.blockers.split(', ').filter(Boolean));
                        }
                        const savedResponses = await loadTodayTaskResponses(existingReport.id);
                        tasks.forEach((task: any) => {
                            const saved = savedResponses[task.id];
                            if (saved) {
                                applySaved(task.id, saved);
                                initialUpdates[task.id].confirmed = true; // already saved today → confirmed
                            }
                        });
                        const pastOnly = reports.filter((r: any) => r.report_date !== today);
                        setPastDayReports(pastOnly.slice(0, 7));
                    } else {
                        // No report yet — carry forward last state (no text pre-fill needed)
                        const jobIds = tasks.map((t: any) => t.id);
                        const lastResponses = await loadLastTaskResponsesForUser(profile.id, jobIds);
                        tasks.forEach((task: any) => {
                            const last = lastResponses[task.id];
                            if (last) applySaved(task.id, last);
                        });
                        if (workLogSummary) setOverallNotes(workLogSummary);
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
            const endDate   = new Date(historyMonth.year, historyMonth.month + 1, 0).toISOString().split('T')[0];
            const { data: reports } = await getMyReports(profile.id, startDate, endDate);
            setPastReports(reports || []);
        } catch (e: any) {
            toast.error('Failed to load history: ' + (e.message || 'Unknown error'));
        } finally {
            setHistoryLoading(false);
        }
    };

    // ── Task helpers ──────────────────────────────────────────────────────────
    const handleTaskUpdate = (taskId: string, field: string, value: any) => {
        setTaskUpdates(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: value } }));
    };

    const handleStatusChange = async (taskId: string, newStatus: 'NOT START' | 'START WORK' | 'COMPLETE') => {
        const task = taskUpdates[taskId];
        let checklistItems: any[] = task.checklist_items;
        if (newStatus === 'COMPLETE' && task.product_category && checklistItems.length === 0) {
            const { data } = await fetchProductChecklist(task.product_category, 'design');
            checklistItems = data || [];
        }
        setTaskUpdates(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], task_status: newStatus, checklist_items: checklistItems }
        }));
    };

    // "No change today" — silently saves with carried-forward state
    const handleNoChange = async (taskId: string) => {
        if (savingTask === taskId) return;
        setSavingTask(taskId);
        try {
            const taskData = taskUpdates[taskId];
            const { error, data: savedReport } = await submitEODReport({
                user_id: profile!.id,
                report_date: reportDate,
                overall_notes: overallNotes,
                blockers,
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
                toast.error('Failed: ' + error);
            } else {
                setTaskUpdates(prev => ({
                    ...prev,
                    [taskId]: { ...prev[taskId], confirmed: true, expanded: false }
                }));
                if (savedReport) setTodayReport(savedReport);
            }
        } catch (e: any) {
            toast.error('Error: ' + (e.message || 'Unknown error'));
        } finally {
            setSavingTask(null);
        }
    };

    // Save after editing a task
    const handleSaveTaskEdit = async (taskId: string) => {
        if (!profile?.id) return;
        const taskData = taskUpdates[taskId];
        if (!taskData) return;
        setSavingTask(taskId);
        try {
            const { error, data: savedReport } = await submitEODReport({
                user_id: profile.id,
                report_date: reportDate,
                overall_notes: overallNotes,
                blockers,
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
                toast.success('Saved!');
                setTaskUpdates(prev => ({
                    ...prev,
                    [taskId]: { ...prev[taskId], expanded: false, confirmed: true }
                }));
                if (savedReport) setTodayReport(savedReport);
            }
        } catch (e: any) {
            toast.error('Error: ' + (e.message || 'Unknown error'));
        } finally {
            setSavingTask(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;
        setSubmitting(true);
        try {
            const updates = Object.keys(taskUpdates).map(taskId => ({
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
                blockers,
                tomorrow_plan: tomorrowPlan,
                work_hours: workHours,
                task_updates: updates
            });
            if (error) {
                toast.error('Error submitting report: ' + String(error));
            } else {
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
                    toast.success(`✅ ${completedTasks.length === 1 ? `"${completedTasks[0].project_name}" moved` : `${completedTasks.length} jobs moved`} to Approval`);
                } else {
                    toast.success('EOD Report submitted!');
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

    // ── Past EOD editing (unchanged) ──────────────────────────────────────────
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

    const handlePastCardSave = async (report: any, taskUpdate: any) => {
        if (!profile?.id) return;
        const edits = pastCardEdits[taskUpdate.id];
        if (!edits) return;
        const changes: Array<{ field: string; old_value: string | null; new_value: string | null }> = [];
        const fields = ['task_status', 'status_update', 'time_spent', 'client_comments'] as const;
        for (const field of fields) {
            const oldVal = String(taskUpdate[field] ?? '');
            const newVal = String(edits[field] ?? '');
            if (oldVal !== newVal) changes.push({ field, old_value: oldVal || null, new_value: newVal || null });
        }
        if (changes.length === 0) { setEditingPastCard(null); return; }
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
            if (error) toast.error('Failed: ' + error);
            else {
                toast.success('Past EOD updated. Admin notified.');
                setEditingPastCard(null);
                await loadData();
            }
        } finally {
            setSavingPastCard(null);
        }
    };

    const navigateMonth = (direction: -1 | 1) => {
        setHistoryMonth(prev => {
            let m = prev.month + direction, y = prev.year;
            if (m < 0)  { m = 11; y--; }
            if (m > 11) { m = 0;  y++; }
            return { year: y, month: m };
        });
    };
    const isCurrentMonth = () => {
        const now = new Date();
        return historyMonth.year === now.getFullYear() && historyMonth.month === now.getMonth();
    };
    const monthLabel = new Date(historyMonth.year, historyMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // ── Derived counts ────────────────────────────────────────────────────────
    const confirmedCount = Object.values(taskUpdates).filter((t: any) => t.confirmed).length;
    const pendingCount   = todayTasks.length - confirmedCount;

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-gray-600">Loading your tasks...</span>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-3 md:space-y-4 animate-fade-in">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl lg:text-page-title text-gray-900">End of Day Report</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {todayReport ? '✓ Submitted' : '⏰ Pending'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
                {profile?.role === 'admin' && (
                    <Link href="/admin/eod-report/admin-view"
                        className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm">
                        Admin Dashboard →
                    </Link>
                )}
            </div>

            {/* Time banners */}
            {isEODTime && !todayReport && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="font-medium text-amber-800 text-sm">It&apos;s EOD time! Please submit before leaving.</p>
                </div>
            )}
            {isPastEODTime && !todayReport && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="font-medium text-red-800 text-sm">EOD report overdue! Please submit now.</p>
                </div>
            )}

            {/* Submitted banner */}
            {todayReport && (
                <div className="bg-white border border-green-200 rounded-md p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-green-900 text-sm">
                                Submitted at {new Date(todayReport.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">You can still update any task</p>
                        </div>
                    </div>
                    <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-md flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Editable
                    </span>
                </div>
            )}

            {/* Main layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* ── LEFT: Form ─────────────────────────────────────────── */}
                <div className="lg:col-span-3">
                    <form onSubmit={handleSubmit} className="space-y-3">

                        {/* Progress bar */}
                        {todayTasks.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-700">
                                        Today&apos;s Tasks ({todayTasks.length})
                                    </span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                        pendingCount === 0
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-amber-50 text-amber-700'
                                    }`}>
                                        {pendingCount === 0 ? '✓ All confirmed' : `${pendingCount} need review`}
                                    </span>
                                </div>
                                {/* Progress bar */}
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div
                                        className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                                        style={{ width: `${todayTasks.length > 0 ? (confirmedCount / todayTasks.length) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{confirmedCount} of {todayTasks.length} confirmed</p>
                            </div>
                        )}

                        {/* Task cards */}
                        {todayTasks.length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-md p-8 text-center text-gray-400">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">No active tasks assigned to you</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {todayTasks.map(task => {
                                    const t = taskUpdates[task.id];
                                    if (!t) return null;
                                    const statusCfg = STATUS_CONFIG[t.task_status];

                                    return (
                                        <div key={task.id}
                                            className={`bg-white border rounded-md overflow-hidden transition-all ${
                                                t.expanded
                                                    ? 'border-amber-300 shadow-sm'
                                                    : t.confirmed
                                                    ? 'border-green-200'
                                                    : 'border-gray-200'
                                            }`}>

                                            {/* ── Collapsed row ── */}
                                            <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                        #{task.job_number} · {task.project_name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {task.client?.company || task.client?.name}
                                                        {task.client_deadline && (
                                                            <span className="ml-2 text-gray-400">
                                                                · due {new Date(task.client_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>

                                                {/* Status chip */}
                                                <span className={`hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${statusCfg.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                                    {statusCfg.label}
                                                </span>

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {t.confirmed && !t.expanded ? (
                                                        // Confirmed — show green tick + edit option
                                                        <>
                                                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                                <CheckCircle className="w-3.5 h-3.5" /> Done
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleTaskUpdate(task.id, 'expanded', true)}
                                                                className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-1 rounded hover:bg-gray-100 transition-colors"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    ) : t.expanded ? (
                                                        // Currently editing — show close
                                                        <button
                                                            type="button"
                                                            onClick={() => handleTaskUpdate(task.id, 'expanded', false)}
                                                            className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-1 rounded hover:bg-gray-100 transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        // Not confirmed, not expanded
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleNoChange(task.id)}
                                                                disabled={savingTask === task.id}
                                                                className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                                                            >
                                                                {savingTask === task.id
                                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                    : 'No change'
                                                                }
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleTaskUpdate(task.id, 'expanded', true)}
                                                                className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md transition-colors"
                                                            >
                                                                Update
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ── Expanded edit form ── */}
                                            {t.expanded && (
                                                <div className="border-t border-amber-100 p-3 space-y-3 bg-amber-50/30">

                                                    {/* Status — 3 big tap buttons */}
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                                                        <div className="grid grid-cols-3 gap-1.5">
                                                            {(['NOT START', 'START WORK', 'COMPLETE'] as const).map(s => (
                                                                <button
                                                                    key={s}
                                                                    type="button"
                                                                    onClick={() => handleStatusChange(task.id, s)}
                                                                    className={`py-2 px-2 rounded-md text-xs font-semibold border transition-all ${
                                                                        t.task_status === s
                                                                            ? STATUS_CONFIG[s].color + ' border-current shadow-sm'
                                                                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                                    }`}
                                                                >
                                                                    {STATUS_CONFIG[s].label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Progress — tap chips */}
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Progress</label>
                                                        <div className="flex gap-1.5">
                                                            {PROGRESS_OPTIONS.map(p => (
                                                                <button
                                                                    key={p}
                                                                    type="button"
                                                                    onClick={() => handleTaskUpdate(task.id, 'completion_percentage', p)}
                                                                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                                                                        t.completion_percentage === p
                                                                            ? 'bg-gray-900 text-white border-gray-900'
                                                                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                                                    }`}
                                                                >
                                                                    {p}%
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Design-specific toggles */}
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Design Checks</label>
                                                        <div className="grid grid-cols-2 gap-1.5">
                                                            {[
                                                                { field: 'client_approval_received', label: '✓ Client approved' },
                                                                { field: 'print_file_ready',         label: '✓ Print file ready' },
                                                                { field: 'print_checklist_done',     label: '✓ Pre-print done' },
                                                            ].map(({ field, label }) => (
                                                                <button
                                                                    key={field}
                                                                    type="button"
                                                                    onClick={() => handleTaskUpdate(task.id, field, !t[field as keyof typeof t])}
                                                                    className={`py-1.5 px-2 rounded-md text-xs font-medium border text-left transition-all ${
                                                                        t[field as keyof typeof t]
                                                                            ? 'bg-green-50 text-green-700 border-green-300'
                                                                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                                                    }`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Dynamic checklist (only when COMPLETE) */}
                                                    {t.task_status === 'COMPLETE' && t.checklist_items.length > 0 && (
                                                        <ProductChecklistCard
                                                            productCategory={task.product_category || task.job_type || 'Other'}
                                                            taskStatus={t.task_status}
                                                            checklistItems={t.checklist_items}
                                                            onUpdate={(items) => handleTaskUpdate(task.id, 'checklist_items', items)}
                                                            category="design"
                                                        />
                                                    )}

                                                    {/* Optional note — 1 line only */}
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                                                            Note <span className="font-normal text-gray-400">(optional)</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={t.status_update}
                                                            onChange={(e) => handleTaskUpdate(task.id, 'status_update', e.target.value)}
                                                            placeholder="Any quick note..."
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                                                        />
                                                    </div>

                                                    {/* Save / Cancel */}
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSaveTaskEdit(task.id)}
                                                            disabled={savingTask === task.id}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            {savingTask === task.id
                                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                : <CheckCircle className="w-4 h-4" />
                                                            }
                                                            {savingTask === task.id ? 'Saving…' : 'Save'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleTaskUpdate(task.id, 'expanded', false)}
                                                            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Day Summary ────────────────────────────────── */}
                        <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
                            <h2 className="text-sm font-semibold text-gray-900">Day Summary</h2>

                            {/* Work hours — tap chips */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hours worked today</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {WORK_HOURS_OPTIONS.map(h => (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => setWorkHours(h)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                                                workHours === h
                                                    ? 'bg-gray-900 text-white border-gray-900'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                            }`}
                                        >
                                            {h}h
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Blockers — tap chips */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Any blockers? <span className="font-normal text-gray-400">(optional)</span>
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {BLOCKER_CHIPS.map(chip => {
                                        const active = selectedBlockers.includes(chip);
                                        return (
                                            <button
                                                key={chip}
                                                type="button"
                                                onClick={() =>
                                                    setSelectedBlockers(prev =>
                                                        active ? prev.filter(b => b !== chip) : [...prev, chip]
                                                    )
                                                }
                                                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                                                    active
                                                        ? 'bg-red-50 text-red-700 border-red-300'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {active ? '✕ ' : ''}{chip}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ── Submit ─────────────────────────────────────── */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 bg-gray-900 text-white rounded-md font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm transition-colors"
                        >
                            {submitting
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                                : <><Send className="w-4 h-4" /> {todayReport ? 'Update EOD Report' : 'Submit EOD Report'}</>
                            }
                        </button>
                    </form>
                </div>

                {/* ── RIGHT: History Panel (unchanged) ───────────────────── */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-md border border-gray-200 sticky top-4">
                        {/* Month navigator */}
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

                        {/* Performance stats */}
                        {(() => {
                            const totalHours = pastReports.reduce((sum, r) => sum + (r.work_hours || 0), 0);
                            const avgHours   = pastReports.length > 0 ? (totalHours / pastReports.length) : 0;
                            const now        = new Date();
                            const daysInMonth = new Date(historyMonth.year, historyMonth.month + 1, 0).getDate();
                            const workingDays = Array.from({ length: daysInMonth }, (_, i) => {
                                const d = new Date(historyMonth.year, historyMonth.month, i + 1);
                                return d.getDay() !== 0 && d.getDay() !== 6 &&
                                    (historyMonth.year < now.getFullYear() || historyMonth.month < now.getMonth() || i + 1 <= now.getDate());
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

                        {/* Reports list */}
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
                                                            {report.task_updates?.length || 0} tasks · {report.work_hours || 0}h
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {report.report_date === today ? (
                                                        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                                            <Pencil className="w-2.5 h-2.5" /> Editable
                                                        </span>
                                                    ) : (
                                                        <Lock className="w-3 h-3 text-gray-400" />
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
                        <h2 className="text-sm font-semibold text-gray-700">Previous EOD Reports</h2>
                        <span className="text-xs text-gray-400">({pastDayReports.length} entries — edit triggers audit log)</span>
                    </div>

                    {pastDayReports.map(report => {
                        const dateLabel = new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'long', day: 'numeric', month: 'short'
                        });
                        const isExpanded = expandedPastDay === report.id;
                        return (
                            <div key={report.id} className="bg-white border border-gray-200 rounded-md overflow-hidden">
                                <button
                                    onClick={() => setExpandedPastDay(isExpanded ? null : report.id)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{dateLabel}</p>
                                            <p className="text-xs text-gray-500">
                                                {report.task_updates?.length || 0} tasks · {report.work_hours || 0}h worked
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-medium">🔒 Locked</span>
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-2 bg-gray-50/50">
                                        {(report.overall_notes || report.blockers) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                                                {report.overall_notes && (
                                                    <div className="bg-white border border-gray-200 rounded-md p-2">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Notes</p>
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
                                        {(report.task_updates || []).map((tu: any) => {
                                            const isEditing = editingPastCard === tu.id;
                                            const edits     = pastCardEdits[tu.id] || {};
                                            const isSaving  = savingPastCard === tu.id;
                                            return (
                                                <div key={tu.id} className={`border rounded-md overflow-hidden ${isEditing ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
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
                                                    {!isEditing ? (
                                                        <div className="p-2.5 space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CONFIG[tu.task_status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                                    {STATUS_CONFIG[tu.task_status as keyof typeof STATUS_CONFIG]?.label || tu.task_status}
                                                                </span>
                                                                {tu.completion_percentage > 0 && (
                                                                    <span className="text-xs text-gray-500">{tu.completion_percentage}%</span>
                                                                )}
                                                                {tu.time_spent > 0 && (
                                                                    <span className="text-xs text-gray-500">{tu.time_spent}h</span>
                                                                )}
                                                            </div>
                                                            {tu.status_update && <p className="text-xs text-gray-600">{tu.status_update}</p>}
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 space-y-2">
                                                            <select
                                                                value={edits.task_status || ''}
                                                                onChange={e => setPastCardEdits(prev => ({ ...prev, [tu.id]: { ...prev[tu.id], task_status: e.target.value } }))}
                                                                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                                                            >
                                                                <option value="NOT START">Not Started</option>
                                                                <option value="START WORK">In Progress</option>
                                                                <option value="COMPLETE">Done</option>
                                                            </select>
                                                            <input
                                                                type="text"
                                                                value={edits.status_update || ''}
                                                                onChange={e => setPastCardEdits(prev => ({ ...prev, [tu.id]: { ...prev[tu.id], status_update: e.target.value } }))}
                                                                placeholder="Status note..."
                                                                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handlePastCardSave(report, tu)}
                                                                    disabled={isSaving}
                                                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-md text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
                                                                >
                                                                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                                    {isSaving ? 'Saving…' : 'Save Edit'}
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingPastCard(null)}
                                                                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
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
