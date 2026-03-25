'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    X, Briefcase, Clock, CheckCircle, AlertTriangle,
    ChevronRight, Calendar, TrendingUp, FileText, Loader2,
    Target, BarChart2, AlertCircle, Circle
} from 'lucide-react';

interface Designer {
    id: string;
    full_name: string;
    role: string;
    email?: string;
}

interface DesignerProfileDrawerProps {
    designer: Designer | null;
    onClose: () => void;
    getMyReports: (userId: string, start?: string, end?: string) => Promise<{ data: any[]; error: any }>;
}

const STAGE_COLORS: Record<string, string> = {
    briefing: 'bg-gray-100 text-gray-700',
    design: 'bg-blue-100 text-blue-700',
    revision: 'bg-amber-100 text-amber-700',
    pre_print_qc: 'bg-purple-100 text-purple-700',
    approval: 'bg-indigo-100 text-indigo-700',
    printing: 'bg-orange-100 text-orange-700',
    finishing: 'bg-cyan-100 text-cyan-700',
    quality_check: 'bg-yellow-100 text-yellow-700',
    ready: 'bg-green-100 text-green-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-teal-100 text-teal-700',
    on_hold: 'bg-red-100 text-red-700',
};

export default function DesignerProfileDrawer({ designer, onClose, getMyReports }: DesignerProfileDrawerProps) {
    const [activeTab, setActiveTab] = useState<'jobs' | 'history' | 'blockers'>('jobs');
    const [jobs, setJobs] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [loadingReports, setLoadingReports] = useState(true);

    useEffect(() => {
        if (!designer) return;
        setJobs([]);
        setReports([]);
        setLoadingJobs(true);
        setLoadingReports(true);
        setActiveTab('jobs');
        fetchJobs();
        fetchReports();
    }, [designer?.id]);

    const fetchJobs = async () => {
        if (!designer?.id) return;
        try {
            const { data, error } = await supabase
                .from('jobs')
                .select('*, client:clients(name, company)')
                .eq('designer_id', designer.id)
                .not('current_stage', 'in', '(delivered,cancelled)')
                .order('client_deadline', { ascending: true });

            if (!error) setJobs(data || []);
        } catch (e) {
            console.error('Error fetching designer jobs:', e);
        } finally {
            setLoadingJobs(false);
        }
    };

    const fetchReports = async () => {
        if (!designer?.id) return;
        try {
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = new Date().toISOString().split('T')[0];
            const { data } = await getMyReports(designer.id, startDate, endDate);
            setReports(data || []);
        } catch (e) {
            console.error('Error fetching designer reports:', e);
        } finally {
            setLoadingReports(false);
        }
    };

    // Derived stats
    const totalJobs = jobs.length;
    const overdueJobs = jobs.filter(j => j.client_deadline && new Date(j.client_deadline) < new Date()).length;
    const totalReportedHours = reports.reduce((sum, r) => sum + (r.work_hours || 0), 0);
    const submissionRate = (() => {
        const last14 = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        });
        const submitted = last14.filter(date => reports.some(r => r.report_date === date)).length;
        return Math.round((submitted / 14) * 100);
    })();

    const allBlockers = reports
        .filter(r => r.blockers && r.blockers.trim())
        .map(r => ({ date: r.report_date, blocker: r.blockers, report_id: r.id }));

    // Last 14 days for heatmap
    const last14Days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (13 - i));
        const dateStr = d.toISOString().split('T')[0];
        const report = reports.find(r => r.report_date === dateStr);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        return { date: dateStr, report, isWeekend, dayLabel: d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1) };
    });

    if (!designer) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-white z-50 shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">

                {/* ── Header ── */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                                {designer.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900">{designer.full_name}</h2>
                                <p className="text-xs text-gray-500 capitalize">{designer.role} · {designer.email || ''}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-md transition-colors">
                            <X size={16} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-4 gap-2 mt-3">
                        {[
                            { label: 'Active Jobs', value: totalJobs, icon: <Briefcase size={13} />, accent: 'text-gray-900' },
                            { label: 'Overdue', value: overdueJobs, icon: <AlertTriangle size={13} />, accent: overdueJobs > 0 ? 'text-red-600' : 'text-gray-400' },
                            { label: 'Hours (30d)', value: `${totalReportedHours}h`, icon: <Clock size={13} />, accent: 'text-gray-900' },
                            { label: 'Report Rate', value: `${submissionRate}%`, icon: <BarChart2 size={13} />, accent: submissionRate >= 80 ? 'text-green-600' : submissionRate >= 50 ? 'text-amber-600' : 'text-red-600' },
                        ].map(stat => (
                            <div key={stat.label} className="bg-white rounded-md border border-gray-200 p-2 text-center">
                                <div className={`flex items-center justify-center gap-1 ${stat.accent} mb-0.5`}>
                                    {stat.icon}
                                    <span className="text-sm font-bold">{stat.value}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 leading-tight">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="flex border-b border-gray-100 flex-shrink-0 bg-white">
                    {([
                        { key: 'jobs', label: 'Active Jobs', count: totalJobs },
                        { key: 'history', label: 'EOD History', count: reports.length },
                        { key: 'blockers', label: 'Blockers', count: allBlockers.length },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${activeTab === tab.key
                                    ? 'border-gray-900 text-gray-900'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ── */}
                <div className="flex-1 overflow-y-auto">

                    {/* ── Tab: Active Jobs ── */}
                    {activeTab === 'jobs' && (
                        <div className="p-4 space-y-2">
                            {loadingJobs ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={20} className="animate-spin text-gray-400" />
                                </div>
                            ) : jobs.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Briefcase size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No active jobs assigned</p>
                                </div>
                            ) : (
                                jobs.map(job => {
                                    const isOverdue = job.client_deadline && new Date(job.client_deadline) < new Date();
                                    const isDueSoon = !isOverdue && job.client_deadline &&
                                        (new Date(job.client_deadline).getTime() - Date.now()) < 2 * 24 * 3600 * 1000;
                                    const stageColor = STAGE_COLORS[job.current_stage] || 'bg-gray-100 text-gray-600';

                                    return (
                                        <div
                                            key={job.id}
                                            className={`rounded-md border p-3 space-y-2 ${isOverdue ? 'border-red-200 bg-red-50/40' :
                                                    isDueSoon ? 'border-amber-200 bg-amber-50/40' :
                                                        'border-gray-200 bg-white'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 truncate">
                                                        #{job.job_number} — {job.project_name}
                                                    </p>
                                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                                        {job.client?.name || job.client?.company || 'No client'}
                                                    </p>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${stageColor}`}>
                                                    {job.current_stage?.replace(/_/g, ' ')}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px]">
                                                <div className="flex items-center gap-3 text-gray-500">
                                                    <span className="capitalize font-medium text-gray-700">{job.job_type?.replace(/_/g, ' ')}</span>
                                                    {job.client_deadline && (
                                                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold' :
                                                                isDueSoon ? 'text-amber-600 font-bold' :
                                                                    'text-gray-400'
                                                            }`}>
                                                            <Calendar size={10} />
                                                            {isOverdue ? '⚠ ' : isDueSoon ? '⏰ ' : ''}
                                                            {new Date(job.client_deadline).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    )}
                                                </div>
                                                {job.priority && (
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${job.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                                            job.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        {job.priority}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ── Tab: EOD History ── */}
                    {activeTab === 'history' && (
                        <div className="p-4 space-y-4">
                            {loadingReports ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={20} className="animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <>
                                    {/* 14-day submission heatmap */}
                                    <div className="bg-gray-50 rounded-md border border-gray-200 p-3">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Last 14 Days</p>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {last14Days.map(({ date, report, isWeekend, dayLabel }) => (
                                                <div key={date} className="flex flex-col items-center gap-0.5">
                                                    <div
                                                        title={`${date}${report ? `: ${report.work_hours || 0}h worked` : ': No report'}`}
                                                        className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold ${report
                                                                ? 'bg-gray-900 text-white'
                                                                : isWeekend
                                                                    ? 'bg-gray-100 text-gray-300'
                                                                    : 'bg-red-100 text-red-400'
                                                            }`}
                                                    >
                                                        {report ? '✓' : isWeekend ? '—' : '✗'}
                                                    </div>
                                                    <span className="text-[9px] text-gray-400">{dayLabel}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1.5">
                                            <span className="font-semibold">{submissionRate}%</span> submission rate · <span className="w-2 h-2 inline-block bg-gray-900 rounded-sm align-middle mr-0.5"></span> submitted <span className="w-2 h-2 inline-block bg-red-100 rounded-sm align-middle ml-1 mr-0.5"></span> missed
                                        </p>
                                    </div>

                                    {/* Reports List */}
                                    {reports.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            <FileText size={28} className="mx-auto mb-2 opacity-20" />
                                            <p className="text-sm">No reports in the last 30 days</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {reports.map(report => (
                                                <details key={report.id} className="group rounded-md border border-gray-200 bg-white overflow-hidden">
                                                    <summary className="flex items-center justify-between p-3 cursor-pointer list-none hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${report.blockers ? 'bg-red-400' : 'bg-green-400'}`} />
                                                            <span className="text-xs font-semibold text-gray-900">
                                                                {new Date(report.report_date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                            </span>
                                                            {report.task_updates?.length > 0 && (
                                                                <span className="text-[10px] text-gray-400">{report.task_updates.length} task{report.task_updates.length !== 1 ? 's' : ''}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                                            <Clock size={11} /> {report.work_hours || 0}h
                                                            <ChevronRight size={12} className="text-gray-300 group-open:rotate-90 transition-transform" />
                                                        </div>
                                                    </summary>
                                                    <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2">
                                                        {report.task_updates?.map((tu: any) => (
                                                            <div key={tu.id} className="flex items-start gap-2 text-[11px] bg-gray-50 rounded-md p-2">
                                                                <span className="flex-shrink-0 mt-0.5">
                                                                    {tu.task_status === 'COMPLETE' ? '✅' : tu.task_status === 'NOT START' ? '❌' : '🔄'}
                                                                </span>
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-gray-800 truncate">
                                                                        {tu.job?.project_name || `Job #${tu.job?.job_number || '?'}`}
                                                                    </p>
                                                                    <p className="text-gray-500 mt-0.5">{tu.status_update}</p>
                                                                    {tu.completion_percentage > 0 && (
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <div className="flex-1 h-1 bg-gray-200 rounded-full">
                                                                                <div className="h-1 bg-gray-700 rounded-full" style={{ width: `${tu.completion_percentage}%` }} />
                                                                            </div>
                                                                            <span className="text-[10px] text-gray-400">{tu.completion_percentage}%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {report.overall_notes && (
                                                            <p className="text-[11px] text-gray-600 bg-gray-50 rounded-md p-2 italic">{report.overall_notes}</p>
                                                        )}
                                                        {report.tomorrow_plan && (
                                                            <p className="text-[11px] text-blue-700 bg-blue-50 rounded-md p-2">
                                                                <span className="font-semibold">Tomorrow:</span> {report.tomorrow_plan}
                                                            </p>
                                                        )}
                                                        {report.blockers && (
                                                            <p className="text-[11px] text-red-700 bg-red-50 rounded-md p-2 border border-red-200">
                                                                <span className="font-semibold">⚠ Blocker:</span> {report.blockers}
                                                            </p>
                                                        )}
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Tab: Blockers ── */}
                    {activeTab === 'blockers' && (
                        <div className="p-4 space-y-3">
                            {loadingReports ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={20} className="animate-spin text-gray-400" />
                                </div>
                            ) : allBlockers.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <CheckCircle size={32} className="mx-auto mb-2 opacity-20 text-green-400" />
                                    <p className="text-sm font-medium text-green-600">No blockers reported</p>
                                    <p className="text-xs text-gray-400 mt-1">in the last 30 days</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 flex items-center gap-2">
                                        <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                                        <p className="text-xs text-amber-800 font-medium">
                                            {allBlockers.length} blocker{allBlockers.length !== 1 ? 's' : ''} reported · review and follow up
                                        </p>
                                    </div>
                                    {allBlockers.map((b, idx) => (
                                        <div key={idx} className="rounded-md border border-red-200 bg-red-50/60 p-3 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                                                    <AlertTriangle size={11} /> Blocker #{allBlockers.length - idx}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(b.date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-800">{b.blocker}</p>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                    <p className="text-[10px] text-gray-400 text-center">
                        Showing last 30 days of activity for <strong className="text-gray-600">{designer.full_name}</strong>
                    </p>
                </div>
            </div>
        </>
    );
}
