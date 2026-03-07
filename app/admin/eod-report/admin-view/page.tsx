'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDailyReports } from '@/lib/hooks';
import DesignerProfileDrawer from '@/components/eod/DesignerProfileDrawer';
import {
    Calendar, Search, Filter, ChevronDown, ChevronUp, User, Clock, CheckCircle,
    X, AlertCircle, Loader2, Download, TrendingUp, ChevronRight, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

export default function AdminEODDashboard() {
    const { profile } = useAuth();
    const { getAllReports, getTodaySubmissionStatus, getMyReports } = useDailyReports();

    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<any[]>([]);
    const [submissionStatus, setSubmissionStatus] = useState<any[]>([]);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);

    // Designer Profile Drawer
    const [selectedDesigner, setSelectedDesigner] = useState<any | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (profile?.role === 'admin') {
            loadData();
        }
    }, [profile, selectedUser, startDate, endDate, searchQuery]);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: reportsData } = await getAllReports({
                userId: selectedUser || undefined,
                startDate,
                endDate,
                searchQuery
            });
            if (reportsData) setReports(reportsData);

            const { data: statusData } = await getTodaySubmissionStatus();
            if (statusData) setSubmissionStatus(statusData);
        } catch (e) {
            console.error('Error loading reports:', e);
        } finally {
            setLoading(false);
        }
    };

    const openDesignerDrawer = (report: any) => {
        if (!report.user) return;
        setSelectedDesigner({
            id: report.user_id,
            full_name: report.user.full_name || report.user.name || 'Unknown',
            role: report.user.role || 'designer',
            email: report.user.email,
        });
    };

    const openDesignerDrawerFromStatus = (status: any) => {
        setSelectedDesigner({
            id: status.user_id,
            full_name: status.user_name,
            role: status.role || 'designer',
        });
    };

    const toggleReportExpand = (reportId: string) => {
        setExpandedReport(expandedReport === reportId ? null : reportId);
    };

    // Get unique users for filter
    const uniqueUsers = Array.from(new Set(reports.map(r => r.user?.full_name))).filter(Boolean);

    // Stats
    const totalSubmissions = reports.length;
    const todaySubmitted = submissionStatus.filter(s => s.submitted).length;
    const todayPending = submissionStatus.filter(s => !s.submitted).length;
    const avgWorkHours = reports.length > 0
        ? (reports.reduce((sum, r) => sum + (r.work_hours || 0), 0) / reports.length).toFixed(1)
        : '0';
    const reportsWithBlockers = reports.filter(r => r.blockers && r.blockers.trim()).length;

    if (profile?.role !== 'admin') {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
                <p className="mt-4 text-gray-600">Access denied. Admin only.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 md:space-y-5 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900">Team EOD Reports</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Monitor daily work · click any name to see full profile</p>
                </div>
                <Link
                    href="/admin/eod-report"
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                    ← My Report
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                {[
                    { icon: <CheckCircle className="w-4 h-4 text-green-600" />, label: 'Submitted Today', value: todaySubmitted, sub: `of ${submissionStatus.length} total` },
                    { icon: <AlertCircle className="w-4 h-4 text-red-500" />, label: 'Pending Today', value: todayPending, sub: 'waiting for EOD' },
                    { icon: <TrendingUp className="w-4 h-4 text-gray-700" />, label: 'Total Reports', value: totalSubmissions, sub: 'in selected period' },
                    { icon: <Clock className="w-4 h-4 text-gray-700" />, label: 'Avg Work Hours', value: avgWorkHours + 'h', sub: 'per report' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-md p-3 border border-gray-200">
                        <div className="flex items-center gap-2 mb-1.5">
                            {stat.icon}
                            <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 leading-none">{stat.value}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{stat.sub}</p>
                    </div>
                ))}
            </div>

            {/* Blockers Alert */}
            {reportsWithBlockers > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                        <span className="font-bold">{reportsWithBlockers} report{reportsWithBlockers !== 1 ? 's' : ''}</span> have blockers in the selected period.
                        Click a designer's name to see their blocker details.
                    </p>
                </div>
            )}

            {/* Today's Submission Status */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-widest">Today&apos;s Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {submissionStatus.map(status => (
                        <button
                            key={status.user_id}
                            onClick={() => openDesignerDrawerFromStatus(status)}
                            className={`p-3 rounded-md border text-left transition-all hover:scale-[1.02] hover:shadow-sm ${status.submitted
                                    ? 'bg-white border-green-200 hover:border-green-300'
                                    : 'bg-red-50 border-red-200 hover:border-red-300'
                                }`}
                            title="Click to view designer profile"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-900 text-xs truncate">{status.user_name}</span>
                                {status.submitted
                                    ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                    : <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                }
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                                {status.submitted
                                    ? new Date(status.submitted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                    : 'Not submitted'}
                            </p>
                            <p className="text-[10px] text-blue-500 mt-1 font-medium flex items-center gap-0.5">
                                View profile <ChevronRight size={9} />
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-md border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2.5">
                    <Filter className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Filters</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search reports..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm"
                        />
                    </div>
                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-md text-sm"
                    >
                        <option value="">All Users</option>
                        {uniqueUsers.map(userName => (
                            <option key={userName as string} value={userName as string}>{userName as string}</option>
                        ))}
                    </select>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-md text-sm" />
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-md text-sm" />
                </div>
            </div>

            {/* Reports List */}
            <div className="bg-white rounded-md border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900">Reports ({reports.length})</h2>
                    <span className="text-xs text-gray-400">Click designer name to view profile</span>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-7 h-7 animate-spin text-gray-400 mx-auto" />
                        <p className="mt-3 text-sm text-gray-400">Loading reports...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 text-sm">No reports found</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {reports.map(report => (
                            <div key={report.id} className="hover:bg-gray-50/60 transition-colors">
                                {/* Report Header Row */}
                                <div className="flex items-center p-3 gap-2">
                                    {/* Expand toggle */}
                                    <button
                                        onClick={() => toggleReportExpand(report.id)}
                                        className="p-1 hover:bg-gray-100 rounded-md flex-shrink-0"
                                    >
                                        {expandedReport === report.id
                                            ? <ChevronUp size={14} className="text-gray-400" />
                                            : <ChevronDown size={14} className="text-gray-400" />
                                        }
                                    </button>

                                    {/* Designer name — clickable → opens drawer */}
                                    <button
                                        onClick={() => openDesignerDrawer(report)}
                                        className="flex items-center gap-2 flex-shrink-0 group"
                                        title="View designer profile"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                            {(report.user?.full_name || report.user?.name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                                                {report.user?.full_name || report.user?.name || 'Unknown'}
                                                <ChevronRight size={10} className="text-gray-300 group-hover:text-blue-400" />
                                            </p>
                                            <p className="text-[10px] text-gray-400 capitalize">{report.user?.role}</p>
                                        </div>
                                    </button>

                                    {/* Date & time */}
                                    <div className="flex items-center gap-1 text-[11px] text-gray-500 ml-2">
                                        <Calendar size={11} />
                                        {new Date(report.report_date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </div>

                                    {/* Spacer */}
                                    <div className="flex-1" />

                                    {/* Badges */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {report.blockers && (
                                            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                                <AlertTriangle size={9} /> Blocker
                                            </span>
                                        )}
                                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                            <Clock size={10} /> {report.work_hours || 0}h
                                        </span>
                                        <span className="text-[11px] text-gray-400">
                                            {new Date(report.submitted_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedReport === report.id && (
                                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 bg-white">
                                        {/* Task Updates */}
                                        {report.task_updates && report.task_updates.length > 0 && (
                                            <div>
                                                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                                                    Task Updates ({report.task_updates.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {report.task_updates.map((update: any) => (
                                                        <div key={update.id} className="bg-gray-50 rounded-md p-2.5 border border-gray-200">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="font-semibold text-xs text-gray-900">
                                                                    {update.job?.job_number && `#${update.job.job_number} — `}{update.job?.project_name || 'Task'}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400">
                                                                    {update.job?.client?.name || update.job?.client?.company}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-600 mb-1.5">{update.status_update}</p>
                                                            <div className="flex items-center gap-4 text-[11px] text-gray-500">
                                                                <span>{update.completion_percentage || 0}% done</span>
                                                                <span>{update.time_spent || 0}h spent</span>
                                                                {update.client_approval_received && <span className="text-green-700 font-medium">✓ Client OK</span>}
                                                                {update.print_file_ready && <span className="text-blue-700 font-medium">✓ Print Ready</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {report.overall_notes && (
                                                <div className="md:col-span-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                                                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md">{report.overall_notes}</p>
                                                </div>
                                            )}
                                            {report.blockers && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">⚠ Blockers</p>
                                                    <p className="text-xs text-gray-700 bg-red-50 p-2 rounded-md border border-red-200">{report.blockers}</p>
                                                </div>
                                            )}
                                            {report.tomorrow_plan && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Tomorrow</p>
                                                    <p className="text-xs text-gray-700 bg-blue-50 p-2 rounded-md border border-blue-100">{report.tomorrow_plan}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Designer Profile Drawer */}
            <DesignerProfileDrawer
                designer={selectedDesigner}
                onClose={() => setSelectedDesigner(null)}
                getMyReports={getMyReports}
            />
        </div>
    );
}
