'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDailyReports } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import DesignerProfileDrawer from '@/components/eod/DesignerProfileDrawer';
import {
    Calendar, Search, Filter, ChevronDown, ChevronUp, Clock, CheckCircle,
    X, AlertCircle, Loader2, TrendingUp, ChevronRight, AlertTriangle, Star,
    MessageSquare, Send, User
} from 'lucide-react';
import Link from 'next/link';

// ─── Star Rating Widget ───────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly = false, size = 'md' }: {
    value: number; onChange?: (v: number) => void; readonly?: boolean; size?: 'sm' | 'md';
}) {
    const [hovered, setHovered] = useState(0);
    const sz = size === 'sm' ? 14 : 18;
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" disabled={readonly}
                    onClick={() => !readonly && onChange?.(star)}
                    onMouseEnter={() => !readonly && setHovered(star)}
                    onMouseLeave={() => !readonly && setHovered(0)}
                    className={readonly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}>
                    <Star size={sz} className={`transition-colors ${star <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'fill-gray-100 text-gray-300'}`} />
                </button>
            ))}
        </div>
    );
}

const RATING_LABELS: Record<number, string> = {
    1: 'Needs improvement', 2: 'Below expectations', 3: 'Met expectations',
    4: 'Good work', 5: 'Outstanding!'
};

// ─── Rating Panel ────────────────────────────────────────────────────────────
function ReportRatingPanel({ report, onRate }: {
    report: any;
    onRate: (reportId: string, rating: number, comment: string) => Promise<void>;
}) {
    const [rating, setRating] = useState(report.admin_rating || 0);
    const [comment, setComment] = useState(report.admin_comment || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(!!report.admin_rating);
    const hasChanges = rating !== (report.admin_rating || 0) || comment !== (report.admin_comment || '');

    const handleSave = async () => {
        if (!rating) return;
        setSaving(true);
        await onRate(report.id, rating, comment);
        setSaved(true);
        setSaving(false);
    };

    return (
        <div className="border-t border-gray-100 pt-3 mt-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Star size={10} /> Admin Feedback
                {saved && !hasChanges && <span className="text-[10px] font-medium text-green-600 ml-1 normal-case tracking-normal">· Saved</span>}
            </p>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <StarRating value={rating} onChange={v => { setRating(v); setSaved(false); }} />
                    {rating > 0 && <span className="text-xs text-gray-500 italic">{RATING_LABELS[rating]}</span>}
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder="Add a comment for the designer... (optional)"
                        value={comment} onChange={e => { setComment(e.target.value); setSaved(false); }}
                        onKeyDown={e => e.key === 'Enter' && rating && handleSave()}
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 bg-white" />
                    <button onClick={handleSave} disabled={!rating || saving || (!hasChanges && saved)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${!rating || (!hasChanges && saved) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        {saving ? 'Saving...' : saved && !hasChanges ? 'Saved' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminEODDashboard() {
    const { profile } = useAuth();
    const { getAllReports, getTodaySubmissionStatus, getMyReports, rateReport } = useDailyReports();

    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<any[]>([]);
    const [submissionStatus, setSubmissionStatus] = useState<any[]>([]);
    const [allProfiles, setAllProfiles] = useState<any[]>([]); // ALL users for dropdown
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [selectedDesigner, setSelectedDesigner] = useState<any | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(''); // filter by actual user_id
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Fetch ALL profiles independently for the dropdown (not tied to report data)
    useEffect(() => {
        supabase
            .from('profiles')
            .select('id, full_name, role')
            .order('full_name')
            .then(({ data }) => { if (data) setAllProfiles(data); });
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: reportsData } = await getAllReports({ userId: selectedUserId || undefined, startDate, endDate, searchQuery });
            if (reportsData) setReports(reportsData);
            const { data: statusData } = await getTodaySubmissionStatus();
            if (statusData) setSubmissionStatus(statusData);
        } catch (e) {
            console.error('Error loading reports:', e);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUserId, startDate, endDate, searchQuery]);

    useEffect(() => {
        if (profile?.role === 'admin') loadData();
    }, [profile?.role, loadData]);

    const openDesignerDrawer = (report: any) => {
        if (!report.user) return;
        setSelectedDesigner({ id: report.user_id, full_name: report.user.full_name || 'Unknown', role: report.user.role || 'designer', email: report.user.email });
    };

    const openDesignerDrawerFromStatus = (status: any) => {
        setSelectedDesigner({ id: status.user_id, full_name: status.user_name, role: status.role || 'designer' });
    };

    const openDesignerDrawerFromProfile = (p: any) => {
        setSelectedDesigner({ id: p.id, full_name: p.full_name, role: p.role || 'designer' });
    };

    const handleRate = async (reportId: string, rating: number, comment: string) => {
        const { error } = await rateReport(reportId, rating, comment);
        if (!error) {
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, admin_rating: rating, admin_comment: comment } : r));
        }
    };

    const toggleReportExpand = (id: string) => setExpandedReport(prev => prev === id ? null : id);

    // Stats
    const todaySubmitted = submissionStatus.filter(s => s.submitted).length;
    const todayPending = submissionStatus.filter(s => !s.submitted).length;
    const avgWorkHours = reports.length > 0 ? (reports.reduce((sum, r) => sum + (r.work_hours || 0), 0) / reports.length).toFixed(1) : '0';
    const reportsWithBlockers = reports.filter(r => r.blockers?.trim()).length;
    const ratedCount = reports.filter(r => r.admin_rating).length;
    const unratedCount = reports.length - ratedCount;

    if (profile?.role !== 'admin') {
        return <div className="text-center py-12"><AlertCircle className="w-12 h-12 mx-auto text-red-500" /><p className="mt-4 text-gray-600">Access denied. Admin only.</p></div>;
    }

    return (
        <div className="space-y-4 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900">Team EOD Reports</h1>
                    <p className="text-xs text-gray-400 mt-0.5">Click any designer name to view profile · Rate reports to track performance</p>
                </div>
                <Link href="/admin/eod-report" className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors">← My Report</Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                    { icon: <CheckCircle size={14} className="text-green-600" />, label: 'Submitted Today', value: todaySubmitted, sub: `of ${submissionStatus.length}` },
                    { icon: <AlertCircle size={14} className="text-red-500" />, label: 'Pending', value: todayPending, sub: 'not submitted' },
                    { icon: <TrendingUp size={14} className="text-gray-600" />, label: 'Total Reports', value: reports.length, sub: 'in period' },
                    { icon: <Clock size={14} className="text-gray-600" />, label: 'Avg Hours', value: avgWorkHours + 'h', sub: 'per report' },
                    { icon: <Star size={14} className="text-amber-500" />, label: 'Rated', value: `${ratedCount}/${reports.length}`, sub: unratedCount > 0 ? `${unratedCount} pending` : 'all rated ✓' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-md p-3 border border-gray-200">
                        <div className="flex items-center gap-1.5 mb-1.5">{stat.icon}<span className="text-[11px] text-gray-500">{stat.label}</span></div>
                        <p className="text-xl font-bold text-gray-900 leading-none">{stat.value}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</p>
                    </div>
                ))}
            </div>

            {/* Alerts */}
            <div className="flex flex-col gap-2">
                {reportsWithBlockers > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-800"><span className="font-bold">{reportsWithBlockers} report{reportsWithBlockers !== 1 ? 's' : ''}</span> have blockers — click a designer&apos;s name to view details.</p>
                    </div>
                )}
                {unratedCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5 flex items-center gap-2">
                        <Star size={14} className="text-blue-500 flex-shrink-0" />
                        <p className="text-xs text-blue-800"><span className="font-bold">{unratedCount} report{unratedCount !== 1 ? 's' : ''}</span> haven&apos;t been rated yet. Expand rows to rate effort.</p>
                    </div>
                )}
            </div>

            {/* Today's Status */}
            <div className="bg-white rounded-md border border-gray-200 p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Today&apos;s Status</p>
                {submissionStatus.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No users found in profiles table.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {submissionStatus.map(status => (
                            <button key={status.user_id} onClick={() => openDesignerDrawerFromStatus(status)}
                                className={`p-2.5 rounded-md border text-left transition-all hover:shadow-sm group ${status.submitted ? 'bg-white border-green-200 hover:border-green-300' : 'bg-red-50 border-red-200 hover:border-red-300'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-gray-900 truncate">{status.user_name}</span>
                                    {status.submitted ? <CheckCircle size={12} className="text-green-600 flex-shrink-0" /> : <X size={12} className="text-red-500 flex-shrink-0" />}
                                </div>
                                <p className="text-[10px] text-gray-400">{status.submitted ? new Date(status.submitted_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : 'Not submitted'}</p>
                                <p className="text-[10px] text-blue-400 group-hover:text-blue-600 mt-0.5 flex items-center gap-0.5">Profile <ChevronRight size={8} /></p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-md border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                    <Filter size={12} className="text-gray-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Filters</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search reports..." value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-xs" />
                    </div>
                    {/* ✅ All users dropdown — populated from profiles table directly */}
                    <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-md text-xs">
                        <option value="">All Users ({allProfiles.length})</option>
                        {allProfiles.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                        ))}
                    </select>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-md text-xs" />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-md text-xs" />
                </div>

                {/* Quick user pills from profiles */}
                {allProfiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <button onClick={() => setSelectedUserId('')}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${selectedUserId === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            All
                        </button>
                        {allProfiles.map(p => (
                            <button key={p.id} onClick={() => setSelectedUserId(selectedUserId === p.id ? '' : p.id)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1 ${selectedUserId === p.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {p.full_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Reports List */}
            <div className="bg-white rounded-md border border-gray-200">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900">Reports ({reports.length})</h2>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><Star size={11} className="text-amber-400" /> Expand to rate</span>
                        <span className="flex items-center gap-1"><User size={11} /> Click name for profile</span>
                    </div>
                </div>
                {loading ? (
                    <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto" /></div>
                ) : reports.length === 0 ? (
                    <div className="p-12 text-center text-xs text-gray-400">No reports in this period</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {reports.map(report => {
                            const name = report.user?.full_name || 'Unknown';
                            const isExpanded = expandedReport === report.id;
                            return (
                                <div key={report.id} className="hover:bg-gray-50/40 transition-colors">
                                    <div className="flex items-center p-3 gap-2">
                                        <button onClick={() => toggleReportExpand(report.id)} className="p-1 hover:bg-gray-100 rounded-md flex-shrink-0">
                                            {isExpanded ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
                                        </button>
                                        <button onClick={() => openDesignerDrawer(report)} className="flex items-center gap-2 group flex-shrink-0">
                                            <div className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                                {name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                                                    {name}<ChevronRight size={9} className="text-gray-300 group-hover:text-blue-400" />
                                                </p>
                                                <p className="text-[10px] text-gray-400 capitalize">{report.user?.role || 'designer'}</p>
                                            </div>
                                        </button>
                                        <span className="text-[11px] text-gray-400 flex items-center gap-1 ml-2">
                                            <Calendar size={10} />
                                            {new Date(report.report_date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </span>
                                        <div className="flex-1" />
                                        {report.admin_rating > 0 && <StarRating value={report.admin_rating} readonly size="sm" />}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {!report.admin_rating && (
                                                <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-600 px-1.5 py-0.5 rounded font-semibold">Rate ↓</span>
                                            )}
                                            {report.blockers && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                                                    <AlertTriangle size={9} /> Blocker
                                                </span>
                                            )}
                                            <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={10} />{report.work_hours || 0}h</span>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 bg-gray-50/30 pt-3">
                                            {report.task_updates?.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Task Updates ({report.task_updates.length})</p>
                                                    {report.task_updates.map((tu: any) => (
                                                        <div key={tu.id} className="flex items-start gap-2 text-xs bg-white rounded-md border border-gray-200 p-2">
                                                            <span className="flex-shrink-0 mt-0.5">{tu.task_status === 'COMPLETE' ? '✅' : tu.task_status === 'NOT START' ? '❌' : '🔄'}</span>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-semibold text-gray-900 truncate">
                                                                    {tu.job?.project_name || `Job #${tu.job?.job_number || '?'}`}
                                                                    {(tu.job?.client?.company || tu.job?.client?.name) && <span className="font-normal text-gray-400 ml-1.5">· {tu.job.client?.company || tu.job.client?.name}</span>}
                                                                </p>
                                                                <p className="text-gray-500 mt-0.5">{tu.status_update}</p>
                                                                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                                                                    <span>{tu.completion_percentage || 0}% done</span>
                                                                    <span>{tu.time_spent || 0}h</span>
                                                                    {tu.client_approval_received && <span className="text-green-600 font-semibold">✓ Client OK</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                {report.overall_notes && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><MessageSquare size={9} /> Notes</p>
                                                        <p className="text-xs text-gray-600 bg-white border border-gray-200 p-2 rounded-md">{report.overall_notes}</p>
                                                    </div>
                                                )}
                                                {report.blockers && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">⚠ Blocker</p>
                                                        <p className="text-xs text-gray-700 bg-red-50 border border-red-200 p-2 rounded-md">{report.blockers}</p>
                                                    </div>
                                                )}
                                                {report.tomorrow_plan && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Tomorrow</p>
                                                        <p className="text-xs text-gray-700 bg-blue-50 border border-blue-100 p-2 rounded-md">{report.tomorrow_plan}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <ReportRatingPanel report={report} onRate={handleRate} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <DesignerProfileDrawer
                designer={selectedDesigner}
                onClose={() => setSelectedDesigner(null)}
                getMyReports={getMyReports}
            />
        </div>
    );
}
