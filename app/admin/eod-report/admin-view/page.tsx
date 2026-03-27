'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDailyReports } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import DesignerProfileDrawer from '@/components/eod/DesignerProfileDrawer';
import {
    Calendar, ChevronDown, ChevronUp, Clock, CheckCircle,
    X, AlertCircle, Loader2, TrendingUp, ChevronRight, AlertTriangle, Star,
    MessageSquare, Send, ChevronLeft, LayoutGrid, List, Users
} from 'lucide-react';
import Link from 'next/link';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function getDaysInMonth(year: number, month: number): Date[] {
    const days: Date[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return days;
}

function isWeekend(d: Date): boolean {
    const day = d.getDay();
    return day === 0 || day === 6;
}

function isFuture(d: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d > today;
}

function getInitials(name: string): string {
    return (name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#7c3aed', '#0891b2', '#d97706', '#16a34a', '#dc2626', '#9333ea', '#0284c7', '#b45309'];
function avatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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

// ─── Grid Cell ────────────────────────────────────────────────────────────────
function GridCell({ report, isWeekendDay, isFutureDay, onClick }: {
    report: any | null;
    isWeekendDay: boolean;
    isFutureDay: boolean;
    onClick?: () => void;
}) {
    if (isFutureDay) {
        return <div className="w-full h-9 rounded bg-gray-50 border border-dashed border-gray-200" />;
    }
    if (isWeekendDay) {
        return <div className="w-full h-9 rounded bg-gray-50 border border-gray-100 flex items-center justify-center">
            <span className="text-[9px] text-gray-300">—</span>
        </div>;
    }
    if (!report) {
        return (
            <div className="w-full h-9 rounded bg-red-50 border border-red-200 flex flex-col items-center justify-center">
                <X size={10} className="text-red-400" />
            </div>
        );
    }

    const hasBlocker = !!report.blockers?.trim();
    const rating = report.admin_rating || 0;

    return (
        <button
            onClick={onClick}
            title={`${report.work_hours || 0}h${hasBlocker ? ' · Has blocker' : ''}${rating ? ` · ${rating}★` : ''}`}
            className={`w-full h-9 rounded border flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 hover:shadow-sm cursor-pointer
                ${hasBlocker
                    ? 'bg-amber-50 border-amber-300'
                    : rating >= 4
                        ? 'bg-green-50 border-green-300'
                        : 'bg-emerald-50 border-emerald-200'
                }`}>
            <CheckCircle size={10} className={hasBlocker ? 'text-amber-500' : 'text-green-500'} />
            <span className="text-[9px] font-bold text-gray-500">{report.work_hours || 0}h</span>
        </button>
    );
}

// ─── Day View (new clean table) ───────────────────────────────────────────────
function DayView({ reports, allProfiles, onRate }: {
    reports: any[];
    allProfiles: any[];
    onRate: (id: string, rating: number, comment: string) => Promise<void>;
}) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const today = toDateStr(new Date());

    const reportByUser = useMemo(() => {
        const map: Record<string, any> = {};
        for (const r of reports) {
            if (r.report_date === today) map[r.user_id] = r;
        }
        return map;
    }, [reports, today]);

    const displayList = useMemo(() => {
        return [...allProfiles].sort((a, b) => {
            const aSubmitted = !!reportByUser[a.id];
            const bSubmitted = !!reportByUser[b.id];
            if (aSubmitted && !bSubmitted) return -1;
            if (!aSubmitted && bSubmitted) return 1;
            // Sort submitted by submitted_at
            if (aSubmitted && bSubmitted) {
                return new Date(reportByUser[a.id].submitted_at).getTime() - new Date(reportByUser[b.id].submitted_at).getTime();
            }
            return 0;
        });
    }, [allProfiles, reportByUser]);

    const missingProfiles = allProfiles.filter(p => !reportByUser[p.id]);
    const submittedCount = allProfiles.length - missingProfiles.length;
    const totalHours = Object.values(reportByUser).reduce((sum: number, r: any) => sum + (r.work_hours || 0), 0);

    return (
        <div>
            {/* Summary pills */}
            <div className="flex items-center gap-2 flex-wrap px-3 pt-3 pb-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold border border-green-100">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    {submittedCount} Submitted
                </span>
                {missingProfiles.length > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-100">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                        {missingProfiles.length} Missing
                    </span>
                )}
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                    <Clock size={11} />
                    {totalHours.toFixed(1)} hrs total
                </span>
            </div>

            {/* Missing alert */}
            {missingProfiles.length > 0 && (
                <div className="mx-3 mb-3 bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2 text-xs text-red-700">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-red-500" />
                    <span>
                        <strong className="font-bold">{missingProfiles.length} {missingProfiles.length === 1 ? 'member hasn\'t' : 'members haven\'t'} submitted yet:&nbsp;</strong>
                        {missingProfiles.map(p => p.full_name).join(', ')}
                    </span>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 560 }}>
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide px-4 py-2">Member</th>
                            <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide px-3 py-2">Status</th>
                            <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide px-3 py-2">Tasks</th>
                            <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide px-3 py-2">Hours</th>
                            <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide px-3 py-2">Submitted</th>
                            <th className="px-3 py-2 w-8" />
                        </tr>
                    </thead>
                    <tbody>
                        {displayList.map(profile => {
                            const report = reportByUser[profile.id];
                            const isExpanded = expandedId === profile.id;
                            const initials = getInitials(profile.full_name || '');
                            const bgColor = avatarColor(profile.full_name || '');
                            const hasBlocker = !!report?.blockers?.trim();

                            return (
                                <>
                                    <tr
                                        key={profile.id}
                                        onClick={() => report && setExpandedId(isExpanded ? null : profile.id)}
                                        className={`border-b border-gray-50 transition-colors ${report ? 'hover:bg-amber-50/30 cursor-pointer' : 'opacity-60'} ${isExpanded ? 'bg-amber-50/40' : ''}`}
                                    >
                                        {/* Member */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                                    style={{ background: bgColor }}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900 leading-tight">{profile.full_name}</p>
                                                    <p className="text-[10px] text-gray-400 capitalize">{profile.role}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 py-3">
                                            {report ? (
                                                hasBlocker ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <AlertTriangle size={10} /> Blocker
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
                                                        <CheckCircle size={10} /> Submitted
                                                    </span>
                                                )
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
                                                    <X size={10} /> Not submitted
                                                </span>
                                            )}
                                        </td>

                                        {/* Tasks */}
                                        <td className="px-3 py-3">
                                            {report?.task_updates?.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {report.task_updates.slice(0, 3).map((tu: any, i: number) => (
                                                        <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                                            {tu.job?.job_number ? `#${tu.job.job_number}` : tu.job?.project_name?.slice(0, 12) || '—'}
                                                        </span>
                                                    ))}
                                                    {report.task_updates.length > 3 && (
                                                        <span className="text-[10px] text-gray-400">+{report.task_updates.length - 3}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-gray-300">—</span>
                                            )}
                                        </td>

                                        {/* Hours */}
                                        <td className="px-3 py-3">
                                            <span className={`text-sm font-bold ${report ? 'text-gray-900' : 'text-gray-300'}`}>
                                                {report ? `${report.work_hours || 0}h` : '—'}
                                            </span>
                                        </td>

                                        {/* Submitted time */}
                                        <td className="px-3 py-3">
                                            <span className="text-xs text-gray-400">
                                                {report?.submitted_at
                                                    ? new Date(report.submitted_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
                                                    : '—'}
                                            </span>
                                        </td>

                                        {/* Chevron */}
                                        <td className="px-3 py-3">
                                            {report && (
                                                isExpanded
                                                    ? <ChevronUp size={13} className="text-gray-400" />
                                                    : <ChevronRight size={13} className="text-gray-400" />
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded detail row */}
                                    {isExpanded && report && (
                                        <tr key={`${profile.id}-detail`} className="bg-amber-50/30 border-b border-gray-100">
                                            <td colSpan={6} className="px-8 py-4">
                                                {/* Task updates grid */}
                                                {report.task_updates?.length > 0 && (
                                                    <div className="mb-3">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Task Updates</p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {report.task_updates.map((tu: any) => (
                                                                <div key={tu.id} className="flex items-start gap-2 text-xs bg-white rounded-md border border-gray-200 p-2.5">
                                                                    <span className="flex-shrink-0 mt-0.5">{tu.task_status === 'COMPLETE' ? '✅' : tu.task_status === 'NOT START' ? '❌' : '🔄'}</span>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-semibold text-gray-900 truncate">
                                                                            {tu.job?.project_name || `Job #${tu.job?.job_number || '?'}`}
                                                                            {(tu.job?.client?.company || tu.job?.client?.name) && (
                                                                                <span className="font-normal text-gray-400 ml-1.5">· {tu.job.client?.company || tu.job.client?.name}</span>
                                                                            )}
                                                                        </p>
                                                                        {tu.status_update && <p className="text-gray-500 mt-0.5">{tu.status_update}</p>}
                                                                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                                                                            <span>{tu.completion_percentage || 0}% done</span>
                                                                            <span>{tu.time_spent || 0}h</span>
                                                                            {tu.client_approval_received && <span className="text-green-600 font-semibold">✓ Client OK</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Notes / Blockers / Tomorrow */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                                    {report.overall_notes && (
                                                        <div className="bg-white border border-gray-200 rounded-md p-2.5">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><MessageSquare size={9} /> Notes</p>
                                                            <p className="text-xs text-gray-600">{report.overall_notes}</p>
                                                        </div>
                                                    )}
                                                    {report.blockers && (
                                                        <div className="bg-red-50 border border-red-200 rounded-md p-2.5">
                                                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">⚠ Blocker</p>
                                                            <p className="text-xs text-red-700">{report.blockers}</p>
                                                        </div>
                                                    )}
                                                    {report.tomorrow_plan && (
                                                        <div className="bg-blue-50 border border-blue-100 rounded-md p-2.5">
                                                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Tomorrow</p>
                                                            <p className="text-xs text-gray-700">{report.tomorrow_plan}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <ReportRatingPanel report={report} onRate={onRate} />
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ weekStart, reports, allProfiles, onCellClick }: {
    weekStart: Date;
    reports: any[];
    allProfiles: any[];
    onCellClick: (report: any) => void;
}) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const lookup = useMemo(() => {
        const map: Record<string, any> = {};
        for (const r of reports) {
            map[`${r.user_id}_${r.report_date}`] = r;
        }
        return map;
    }, [reports]);

    const dayStats = useMemo(() => days.map(day => {
        const ds = toDateStr(day);
        const weekend = isWeekend(day);
        const future = isFuture(day);
        if (weekend || future) return null;
        const submitted = allProfiles.filter(p => lookup[`${p.id}_${ds}`]).length;
        const total = allProfiles.length;
        return { submitted, total, pct: total ? Math.round((submitted / total) * 100) : 0 };
    }), [days, allProfiles, lookup]);

    if (allProfiles.length === 0) {
        return <div className="p-12 text-center text-xs text-gray-400">No team members found</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 600 }}>
                <thead>
                    <tr>
                        <th className="text-left text-[11px] font-bold text-gray-500 px-3 py-2 w-36 sticky left-0 bg-white border-b border-gray-200">Team Member</th>
                        {days.map((day, i) => {
                            const isToday = toDateStr(day) === toDateStr(new Date());
                            const stat = dayStats[i];
                            return (
                                <th key={i} className={`text-center px-1 py-2 border-b border-gray-200 ${isWeekend(day) ? 'bg-gray-50' : ''}`} style={{ minWidth: 72 }}>
                                    <div className={`text-[11px] font-bold ${isToday ? 'text-blue-600' : isWeekend(day) ? 'text-gray-300' : 'text-gray-600'}`}>{dayNames[i]}</div>
                                    <div className={`text-[10px] ${isToday ? 'text-blue-500 font-semibold' : 'text-gray-400'}`}>{day.getDate()}</div>
                                    {stat && (
                                        <div className="mt-0.5">
                                            <div className="h-1 rounded-full bg-gray-100 overflow-hidden mx-1">
                                                <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${stat.pct}%` }} />
                                            </div>
                                            <div className="text-[9px] text-gray-400 mt-0.5">{stat.submitted}/{stat.total}</div>
                                        </div>
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {allProfiles.map((profile, pi) => (
                        <tr key={profile.id} className={pi % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                            <td className="px-3 py-1.5 sticky left-0 bg-inherit border-r border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                                        style={{ background: avatarColor(profile.full_name || '') }}>
                                        {getInitials(profile.full_name || '')}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-gray-900 whitespace-nowrap">{profile.full_name}</p>
                                        <p className="text-[9px] text-gray-400 capitalize">{profile.role}</p>
                                    </div>
                                </div>
                            </td>
                            {days.map((day, di) => {
                                const ds = toDateStr(day);
                                const report = lookup[`${profile.id}_${ds}`];
                                return (
                                    <td key={di} className="px-1 py-1">
                                        <GridCell
                                            report={report || null}
                                            isWeekendDay={isWeekend(day)}
                                            isFutureDay={isFuture(day)}
                                            onClick={report ? () => onCellClick(report) : undefined}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({ year, month, reports, allProfiles, onCellClick }: {
    year: number; month: number;
    reports: any[];
    allProfiles: any[];
    onCellClick: (report: any) => void;
}) {
    const days = getDaysInMonth(year, month);

    const lookup = useMemo(() => {
        const map: Record<string, any> = {};
        for (const r of reports) {
            map[`${r.user_id}_${r.report_date}`] = r;
        }
        return map;
    }, [reports]);

    const today = toDateStr(new Date());

    const MonthCell = ({ report, day, profile }: { report: any | null; day: Date; profile: any }) => {
        const ds = toDateStr(day);
        const weekend = isWeekend(day);
        const future = isFuture(day);
        const isToday = ds === today;

        if (future) return <div className="w-full aspect-square rounded-sm bg-gray-50 border border-dashed border-gray-100" />;
        if (weekend) return <div className="w-full aspect-square rounded-sm bg-gray-50" />;

        if (!report) {
            return (
                <div title={`${profile.full_name} — ${ds} — Not submitted`}
                    className={`w-full aspect-square rounded-sm border flex items-center justify-center ${isToday ? 'bg-red-100 border-red-400' : 'bg-red-50 border-red-200'}`}>
                    <X size={7} className="text-red-400" />
                </div>
            );
        }

        const hasBlocker = !!report.blockers?.trim();
        const hrs = report.work_hours || 0;
        const rating = report.admin_rating || 0;

        return (
            <button
                onClick={() => onCellClick(report)}
                title={`${profile.full_name} — ${ds} — ${hrs}h${hasBlocker ? ' · Blocker!' : ''}${rating ? ` · ${rating}★` : ''}`}
                className={`w-full aspect-square rounded-sm border flex items-center justify-center transition-all hover:scale-110 hover:z-10 hover:shadow-sm cursor-pointer
                    ${hasBlocker
                        ? 'bg-amber-400 border-amber-500'
                        : rating >= 4
                            ? 'bg-green-400 border-green-500'
                            : 'bg-emerald-300 border-emerald-400'
                    }`}>
                <span className="text-[7px] font-bold text-white leading-none">{hrs > 0 ? hrs : '✓'}</span>
            </button>
        );
    };

    if (allProfiles.length === 0) {
        return <div className="p-12 text-center text-xs text-gray-400">No team members found</div>;
    }

    const weekDayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return (
        <div className="overflow-x-auto">
            <div className="flex items-center gap-3 px-3 pb-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-300 border border-emerald-400 inline-block" /> Submitted</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 border border-amber-500 inline-block" /> Blocker</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 border border-green-500 inline-block" /> Rated 4–5★</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-50 border border-red-200 inline-block" /> Not submitted</span>
            </div>
            <table className="w-full border-collapse" style={{ minWidth: 700 }}>
                <thead>
                    <tr>
                        <th className="text-left text-[11px] font-bold text-gray-500 px-3 py-2 w-36 sticky left-0 bg-white border-b border-gray-200">Team Member</th>
                        {days.map((day, i) => {
                            const isToday = toDateStr(day) === today;
                            const wdLabel = weekDayLabels[(day.getDay() + 6) % 7];
                            return (
                                <th key={i} className={`text-center px-0.5 py-1.5 border-b border-gray-200 ${isWeekend(day) ? 'bg-gray-50' : ''} ${isToday ? 'bg-blue-50' : ''}`}
                                    style={{ minWidth: 28, width: 28 }}>
                                    <div className={`text-[9px] font-bold ${isToday ? 'text-blue-600' : isWeekend(day) ? 'text-gray-300' : 'text-gray-500'}`}>{day.getDate()}</div>
                                    <div className={`text-[8px] ${isToday ? 'text-blue-400' : isWeekend(day) ? 'text-gray-200' : 'text-gray-300'}`}>{wdLabel}</div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {allProfiles.map((profile, pi) => (
                        <tr key={profile.id} className={pi % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                            <td className="px-3 py-1 sticky left-0 bg-inherit border-r border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                                        style={{ background: avatarColor(profile.full_name || '') }}>
                                        {getInitials(profile.full_name || '')}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-gray-900 whitespace-nowrap">{profile.full_name}</p>
                                        <p className="text-[9px] text-gray-400 capitalize">{profile.role}</p>
                                    </div>
                                </div>
                            </td>
                            {days.map((day, di) => {
                                const ds = toDateStr(day);
                                const report = lookup[`${profile.id}_${ds}`];
                                return (
                                    <td key={di} className="p-0.5">
                                        <MonthCell report={report || null} day={day} profile={profile} />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Report Quick Drawer ──────────────────────────────────────────────────────
function ReportQuickDrawer({ report, onClose, onRate }: {
    report: any | null;
    onClose: () => void;
    onRate: (id: string, rating: number, comment: string) => Promise<void>;
}) {
    if (!report) return null;
    const name = report.user?.full_name || 'Unknown';
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
            <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center"
                            style={{ background: avatarColor(name) }}>
                            {getInitials(name)}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900">{name}</p>
                            <p className="text-[11px] text-gray-400">
                                {new Date(report.report_date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                                {' · '}{report.work_hours || 0}h
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <X size={16} className="text-gray-400" />
                    </button>
                </div>

                {report.task_updates?.length > 0 && (
                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Task Updates ({report.task_updates.length})</p>
                        <div className="space-y-1.5">
                            {report.task_updates.map((tu: any) => (
                                <div key={tu.id} className="flex items-start gap-2 text-xs bg-gray-50 rounded-md border border-gray-200 p-2">
                                    <span className="flex-shrink-0 mt-0.5">{tu.task_status === 'COMPLETE' ? '✅' : tu.task_status === 'NOT START' ? '❌' : '🔄'}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-gray-900 truncate">
                                            {tu.job?.project_name || `Job #${tu.job?.job_number || '?'}`}
                                            {(tu.job?.client?.company || tu.job?.client?.name) && (
                                                <span className="font-normal text-gray-400 ml-1.5">· {tu.job.client?.company || tu.job.client?.name}</span>
                                            )}
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
                    </div>
                )}

                <div className="grid grid-cols-1 gap-2 mb-4">
                    {report.overall_notes && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><MessageSquare size={9} /> Notes</p>
                            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 p-2 rounded-md">{report.overall_notes}</p>
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

                <ReportRatingPanel report={report} onRate={onRate} />
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type ViewMode = 'day' | 'week' | 'month' | 'list';

export default function AdminEODDashboard() {
    const { profile } = useAuth();
    const { getAllReports, getTodaySubmissionStatus, getMyReports, rateReport } = useDailyReports();

    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<any[]>([]);
    const [allProfiles, setAllProfiles] = useState<any[]>([]);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [selectedDesigner, setSelectedDesigner] = useState<any | null>(null);
    const [quickReport, setQuickReport] = useState<any | null>(null);

    // List view filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
    const [monthDate, setMonthDate] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    useEffect(() => {
        supabase
            .from('profiles')
            .select('id, full_name, role')
            .order('full_name')
            .then(({ data }) => { if (data) setAllProfiles(data); });
    }, []);

    const gridDateRange = useMemo(() => {
        if (viewMode === 'day') {
            const today = toDateStr(new Date());
            return { start: today, end: today };
        }
        if (viewMode === 'week') {
            return { start: toDateStr(weekStart), end: toDateStr(addDays(weekStart, 6)) };
        }
        if (viewMode === 'month') {
            const days = getDaysInMonth(monthDate.getFullYear(), monthDate.getMonth());
            return { start: toDateStr(days[0]), end: toDateStr(days[days.length - 1]) };
        }
        return { start: startDate, end: endDate };
    }, [viewMode, weekStart, monthDate, startDate, endDate]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const filters = viewMode === 'list'
                ? { userId: selectedUserId || undefined, startDate, endDate, searchQuery }
                : { startDate: gridDateRange.start, endDate: gridDateRange.end };
            const { data: reportsData } = await getAllReports(filters);
            if (reportsData) setReports(reportsData);
        } catch (e) {
            console.error('Error loading reports:', e);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, selectedUserId, startDate, endDate, searchQuery, gridDateRange]);

    useEffect(() => {
        if (profile?.role === 'admin') loadData();
    }, [profile?.role, loadData]);

    const handleRate = async (reportId: string, rating: number, comment: string) => {
        const { error } = await rateReport(reportId, rating, comment);
        if (!error) {
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, admin_rating: rating, admin_comment: comment } : r));
            if (quickReport?.id === reportId) setQuickReport((prev: any) => ({ ...prev, admin_rating: rating, admin_comment: comment }));
        }
    };

    const openDesignerDrawer = (report: any) => {
        if (!report.user) return;
        setSelectedDesigner({ id: report.user_id, full_name: report.user.full_name || 'Unknown', role: report.user.role || 'designer', email: report.user.email });
    };

    const toggleReportExpand = (id: string) => setExpandedReport(prev => prev === id ? null : id);

    // Period label
    const periodLabel = useMemo(() => {
        if (viewMode === 'week') {
            const end = addDays(weekStart, 6);
            return `${weekStart.toLocaleDateString('en', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        if (viewMode === 'month') {
            return monthDate.toLocaleDateString('en', { month: 'long', year: 'numeric' });
        }
        if (viewMode === 'day') {
            return new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        return null;
    }, [viewMode, weekStart, monthDate]);

    // Blockers in current view
    const reportsWithBlockers = reports.filter(r => r.blockers?.trim()).length;

    if (profile?.role !== 'admin') {
        return <div className="text-center py-12"><AlertCircle className="w-12 h-12 mx-auto text-red-500" /><p className="mt-4 text-gray-600">Access denied. Admin only.</p></div>;
    }

    return (
        <div className="space-y-3 max-w-7xl">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900">EOD Reports</h1>
                    <p className="text-xs text-gray-400 mt-0.5">{periodLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    {loading && <Loader2 size={14} className="animate-spin text-gray-300" />}
                    <Link href="/admin/eod-report" className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors">← My Report</Link>
                </div>
            </div>

            {/* Blockers alert */}
            {reportsWithBlockers > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 flex items-center gap-2">
                    <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                        <span className="font-bold">{reportsWithBlockers} {reportsWithBlockers === 1 ? 'report has' : 'reports have'} blockers</span> — expand the row to view details.
                    </p>
                </div>
            )}

            {/* Main card: tabs + content */}
            <div className="bg-white rounded-md border border-gray-200 overflow-hidden">

                {/* Tab bar + navigator */}
                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
                        {([
                            { id: 'day' as ViewMode, label: 'Today', icon: <Users size={12} /> },
                            { id: 'week' as ViewMode, label: 'Week', icon: <LayoutGrid size={12} /> },
                            { id: 'month' as ViewMode, label: 'Month', icon: <Calendar size={12} /> },
                            { id: 'list' as ViewMode, label: 'List', icon: <List size={12} /> },
                        ]).map(tab => (
                            <button key={tab.id} onClick={() => setViewMode(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${viewMode === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                {tab.icon}{tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Period navigator (week / month) */}
                    {(viewMode === 'week' || viewMode === 'month') && (
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={() => {
                                    if (viewMode === 'week') setWeekStart(prev => addDays(prev, -7));
                                    else setMonthDate(prev => addMonths(prev, -1));
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
                                <ChevronLeft size={14} className="text-gray-500" />
                            </button>
                            <span className="text-xs font-semibold text-gray-700 min-w-[160px] text-center">{periodLabel}</span>
                            <button
                                onClick={() => {
                                    if (viewMode === 'week') setWeekStart(prev => addDays(prev, 7));
                                    else setMonthDate(prev => addMonths(prev, 1));
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
                                <ChevronRight size={14} className="text-gray-500" />
                            </button>
                            <button
                                onClick={() => {
                                    if (viewMode === 'week') setWeekStart(getMonday(new Date()));
                                    else setMonthDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors border border-gray-200">
                                Today
                            </button>
                        </div>
                    )}
                </div>

                {/* List filters */}
                {viewMode === 'list' && (
                    <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/40">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                            <input type="text" placeholder="Search reports..." value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-md text-xs bg-white" />
                            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-md text-xs bg-white">
                                <option value="">All Users ({allProfiles.length})</option>
                                {allProfiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                                ))}
                            </select>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-md text-xs bg-white" />
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-md text-xs bg-white" />
                        </div>
                        {allProfiles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                <button onClick={() => setSelectedUserId('')}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${selectedUserId === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    All
                                </button>
                                {allProfiles.map(p => (
                                    <button key={p.id} onClick={() => setSelectedUserId(selectedUserId === p.id ? '' : p.id)}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${selectedUserId === p.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {p.full_name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto" /></div>
                ) : viewMode === 'day' ? (
                    <DayView
                        reports={reports}
                        allProfiles={allProfiles}
                        onRate={handleRate}
                    />
                ) : viewMode === 'week' ? (
                    <WeekView
                        weekStart={weekStart}
                        reports={reports}
                        allProfiles={allProfiles}
                        onCellClick={setQuickReport}
                    />
                ) : viewMode === 'month' ? (
                    <MonthView
                        year={monthDate.getFullYear()}
                        month={monthDate.getMonth()}
                        reports={reports}
                        allProfiles={allProfiles}
                        onCellClick={setQuickReport}
                    />
                ) : (
                    /* List view */
                    <div>
                        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-900">Reports ({reports.length})</h2>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                <TrendingUp size={11} />
                                <span>Avg: {reports.length > 0 ? (reports.reduce((s, r) => s + (r.work_hours || 0), 0) / reports.length).toFixed(1) : 0}h/report</span>
                            </div>
                        </div>
                        {reports.length === 0 ? (
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
                                                    <div className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                                                        style={{ background: avatarColor(name) }}>
                                                        {getInitials(name)}
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
                )}
            </div>

            {/* Quick Report Drawer (grid cell click) */}
            <ReportQuickDrawer
                report={quickReport}
                onClose={() => setQuickReport(null)}
                onRate={handleRate}
            />

            <DesignerProfileDrawer
                designer={selectedDesigner}
                onClose={() => setSelectedDesigner(null)}
                getMyReports={getMyReports}
            />
        </div>
    );
}
