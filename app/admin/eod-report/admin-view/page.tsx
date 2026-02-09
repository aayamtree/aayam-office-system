'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDailyReports } from '@/lib/hooks';
import {
    Calendar, Search, Filter, ChevronDown, ChevronUp, User, Clock, CheckCircle,
    X, AlertCircle, Loader2, Download, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

export default function AdminEODDashboard() {
    const { profile } = useAuth();
    const { getAllReports, getTodaySubmissionStatus } = useDailyReports();

    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<any[]>([]);
    const [submissionStatus, setSubmissionStatus] = useState<any[]>([]);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Last 7 days
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (profile?.role === 'admin') {
            loadData();
        }
    }, [profile, selectedUser, startDate, endDate, searchQuery]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Get all reports with filters
            const { data: reportsData } = await getAllReports({
                userId: selectedUser || undefined,
                startDate,
                endDate,
                searchQuery
            });

            if (reportsData) {
                setReports(reportsData);
            }

            // Get today's submission status
            const { data: statusData } = await getTodaySubmissionStatus();
            if (statusData) {
                setSubmissionStatus(statusData);
            }
        } catch (e) {
            console.error('Error loading reports:', e);
        } finally {
            setLoading(false);
        }
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

    if (profile?.role !== 'admin') {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
                <p className="mt-4 text-gray-600">Access denied. Admin only.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 md:space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900">Team EOD Reports</h1>
                    <p className="text-sm text-gray-500 mt-1">Monitor daily work status and accountability</p>
                </div>
                <Link
                    href="/admin/eod-report"
                    className="px-4 py-2 bg-gray-100 text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                    ← My Report
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-900" />
                        <span className="text-sm text-gray-500">Today Submitted</span>
                    </div>
                    <p className="text-page-title text-gray-900">{todaySubmitted}</p>
                    <p className="text-xs text-gray-400 mt-1">of {submissionStatus.length} total</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 md:w-4.5 md:h-4.5 text-destructive" />
                        <span className="text-sm text-gray-500">Pending Today</span>
                    </div>
                    <p className="text-page-title text-gray-900">{todayPending}</p>
                    <p className="text-xs text-gray-400 mt-1">waiting for EOD</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 md:w-4.5 md:h-4.5 text-foreground" />
                        <span className="text-sm text-gray-500">Total Submissions</span>
                    </div>
                    <p className="text-page-title text-gray-900">{totalSubmissions}</p>
                    <p className="text-xs text-gray-400 mt-1">in selected period</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 md:w-4.5 md:h-4.5 text-primary" />
                        <span className="text-sm text-gray-500">Avg Work Hours</span>
                    </div>
                    <p className="text-page-title text-gray-900">{avgWorkHours}</p>
                    <p className="text-xs text-gray-400 mt-1">per day</p>
                </div>
            </div>

            {/* Today's Submission Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-section text-gray-900 mb-4">Today&apos;s Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {submissionStatus.map(status => (
                        <div
                            key={status.user_id}
                            className={`p-3 rounded-lg border ${status.submitted
                                ? 'bg-white border-green-200'
                                : 'bg-red-50 border-red-200'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900 text-sm">{status.user_name}</span>
                                {status.submitted ? (
                                    <CheckCircle className="w-4 h-4 text-gray-900" />
                                ) : (
                                    <X className="w-4 h-4 text-red-600" />
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {status.submitted
                                    ? new Date(status.submitted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                    : 'Not submitted'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-700">Filters & Search</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 md:w-4.5 md:h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search reports (use #hashtags)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
                        />
                    </div>
                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg"
                    >
                        <option value="">All Users</option>
                        {uniqueUsers.map(userName => (
                            <option key={userName} value={userName}>{userName}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg"
                    />
                </div>
            </div>

            {/* Reports List */}
            <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900">Reports ({reports.length})</h2>
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                        <p className="mt-3 text-gray-500">Loading reports...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        No reports found for the selected filters
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {reports.map(report => (
                            <div key={report.id} className="p-4 hover:bg-gray-50 transition-colors">
                                {/* Report Header */}
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => toggleReportExpand(report.id)}
                                >
                                    <div className="flex items-center gap-2 md:gap-4">
                                        <div className="flex items-center gap-2">
                                            {expandedReport === report.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium text-gray-900">{report.user?.full_name}</span>
                                        </div>
                                        <span className="text-sm text-gray-500">{report.user?.role}</span>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-4 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(report.report_date).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {report.work_hours}h
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(report.submitted_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedReport === report.id && (
                                    <div className="mt-4 pl-6 space-y-4">
                                        {/* Task Updates */}
                                        {report.task_updates && report.task_updates.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Task Updates ({report.task_updates.length})</h4>
                                                <div className="space-y-3">
                                                    {report.task_updates.map((update: any) => (
                                                        <div key={update.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-medium text-sm text-gray-900">
                                                                    {update.job?.job_number} - {update.job?.project_name}
                                                                </span>
                                                                <span className="text-xs text-gray-500">
                                                                    {update.job?.client?.name || update.job?.client?.company}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-700 mb-2">{update.status_update}</p>
                                                            <div className="flex items-center gap-2 md:gap-4 text-xs text-gray-600">
                                                                <span>Progress: {update.completion_percentage}%</span>
                                                                <span>Time: {update.time_spent}h</span>
                                                                {update.client_approval_received && <span className="text-gray-900 font-medium">✓ Client Approved</span>}
                                                                {update.print_file_ready && <span className="text-foreground font-medium">✓ Print Ready</span>}
                                                            </div>
                                                            {update.client_comments && (
                                                                <p className="text-xs text-gray-500 mt-2 italic">Client: {update.client_comments}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Overall Notes */}
                                        {report.overall_notes && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 mb-1">Overall Notes</h4>
                                                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{report.overall_notes}</p>
                                            </div>
                                        )}

                                        {/* Blockers */}
                                        {report.blockers && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-red-700 mb-1">Blockers</h4>
                                                <p className="text-sm text-gray-600 bg-red-50 p-3 rounded-lg border border-red-200">{report.blockers}</p>
                                            </div>
                                        )}

                                        {/* Tomorrow's Plan */}
                                        {report.tomorrow_plan && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 mb-1">Tomorrow&apos;s Plan</h4>
                                                <p className="text-sm text-gray-600 bg-muted p-3 rounded-lg border border-border">{report.tomorrow_plan}</p>
                                            </div>
                                        )}

                                        {/* Hashtags */}
                                        {report.tags && report.tags.length > 0 && (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-label text-gray-500">Tags:</span>
                                                {report.tags.map((tag: string) => (
                                                    <span key={tag} className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
                                                        {tag}
                                                    </span>
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
    );
}
