'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLeads, useFollowUps } from '@/lib/hooks';
import {
    Users, TrendingUp, AlertCircle, CheckCircle, Clock, Calendar,
    IndianRupee, FileText, ArrowRight, Activity, Lock, Unlock, RotateCcw
} from 'lucide-react';
import DashboardGrid, { resetLayouts, type LayoutsMap } from '@/components/dashboard/DashboardGrid';

// ─── Default Grid Layouts for Marketing Dashboard ──────────────
const DEFAULT_LAYOUTS: LayoutsMap = {
    lg: [
        // Row 1: 6 stat cards — 2 cols each
        { i: 'stat-today-followups', x: 0, y: 0, w: 4, h: 3 },
        { i: 'stat-overdue', x: 4, y: 0, w: 4, h: 3 },
        { i: 'stat-new-leads', x: 8, y: 0, w: 4, h: 3 },
        { i: 'stat-converted', x: 0, y: 3, w: 4, h: 3 },
        { i: 'stat-leads-waiting', x: 4, y: 3, w: 4, h: 3 },
        { i: 'stat-quotations', x: 8, y: 3, w: 4, h: 3 },
        // Row 3: Team Activity (full width)
        { i: 'team-activity', x: 0, y: 6, w: 12, h: 8 },
        // Row 4: Commission Overview (full width)
        { i: 'commission', x: 0, y: 14, w: 12, h: 7 },
    ],
    md: [
        { i: 'stat-today-followups', x: 0, y: 0, w: 3, h: 3 },
        { i: 'stat-overdue', x: 3, y: 0, w: 3, h: 3 },
        { i: 'stat-new-leads', x: 0, y: 3, w: 3, h: 3 },
        { i: 'stat-converted', x: 3, y: 3, w: 3, h: 3 },
        { i: 'stat-leads-waiting', x: 0, y: 6, w: 3, h: 3 },
        { i: 'stat-quotations', x: 3, y: 6, w: 3, h: 3 },
        { i: 'team-activity', x: 0, y: 9, w: 6, h: 8 },
        { i: 'commission', x: 0, y: 17, w: 6, h: 7 },
    ],
    sm: [
        { i: 'stat-today-followups', x: 0, y: 0, w: 2, h: 3 },
        { i: 'stat-overdue', x: 0, y: 3, w: 2, h: 3 },
        { i: 'stat-new-leads', x: 0, y: 6, w: 2, h: 3 },
        { i: 'stat-converted', x: 0, y: 9, w: 2, h: 3 },
        { i: 'stat-leads-waiting', x: 0, y: 12, w: 2, h: 3 },
        { i: 'stat-quotations', x: 0, y: 15, w: 2, h: 3 },
        { i: 'team-activity', x: 0, y: 18, w: 2, h: 8 },
        { i: 'commission', x: 0, y: 26, w: 2, h: 7 },
    ],
};

export default function AdminMarketingDashboard() {
    const router = useRouter();
    const { profile } = useAuth();
    const { leads, loading: leadsLoading } = useLeads();
    const { followUps, loading: followUpsLoading } = useFollowUps();
    const [isLocked, setIsLocked] = useState(true);

    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const stats = {
        todayFollowUps: followUps?.filter(f => f.follow_up_date === today).length || 0,
        overdueTasks: followUps?.filter(f => f.follow_up_date < today && !f.completed).length || 0,
        newLeads: leads?.filter(l => l.created_at >= sevenDaysAgo).length || 0,
        convertedLeads: leads?.filter(l => l.status === 'converted').length || 0,
        leadsWaiting: leads?.filter(l => ['follow_up', 'quoted', 'negotiating'].includes(l.status)).length || 0,
        activeQuotations: 0,
    };

    // Get team activity
    const teamActivity = leads?.reduce((acc: any, lead) => {
        const owner = lead.assigned_user?.full_name || 'Unassigned';
        const ownerId = lead.assigned_to || 'unassigned';
        if (!acc[ownerId]) {
            acc[ownerId] = { name: owner, leads: 0, followUps: 0, converted: 0, commission: 0 };
        }
        acc[ownerId].leads++;
        if (lead.status === 'converted') acc[ownerId].converted++;
        return acc;
    }, {});

    const teamMembers = Object.values(teamActivity || {});
    const loading = leadsLoading || followUpsLoading;

    // Stat cards configuration
    const statCards = [
        { key: 'stat-today-followups', title: "Today's Follow Ups", value: stats.todayFollowUps, icon: Calendar, textColor: 'text-foreground', bgColor: 'bg-muted', link: '/admin/marketing/follow-ups?filter=today' },
        { key: 'stat-overdue', title: 'Overdue Tasks', value: stats.overdueTasks, icon: AlertCircle, textColor: 'text-red-600', bgColor: 'bg-red-50', link: '/admin/marketing/follow-ups?filter=overdue' },
        { key: 'stat-new-leads', title: 'New Leads (7d)', value: stats.newLeads, icon: TrendingUp, textColor: 'text-gray-900', bgColor: 'bg-white', link: '/admin/marketing/leads?filter=new' },
        { key: 'stat-converted', title: 'Converted', value: stats.convertedLeads, icon: CheckCircle, textColor: 'text-white', bgColor: 'bg-gray-900', link: '/admin/marketing/leads?filter=converted' },
        { key: 'stat-leads-waiting', title: 'Leads Waiting', value: stats.leadsWaiting, icon: Clock, textColor: 'text-gray-600', bgColor: 'bg-white', link: '/admin/marketing/leads?filter=waiting' },
        { key: 'stat-quotations', title: 'Active Quotations', value: stats.activeQuotations, icon: FileText, textColor: 'text-white', bgColor: 'bg-gray-900', link: '/admin/quotations?filter=active' },
    ];

    // Only show for admin
    if (profile?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-page-title text-gray-900">Access Denied</h2>
                    <p className="text-gray-500 mt-2">This page is only accessible to admins.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-page-title text-gray-900 flex items-center gap-3">
                            <Activity className="text-gray-900" size={28} />
                            Marketing Team Overview
                        </h1>
                        <p className="text-gray-500 mt-1">Monitor team performance and key metrics</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isLocked && (
                            <button
                                onClick={() => { resetLayouts('aayam-mktg-layouts'); window.location.reload(); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                <RotateCcw className="h-3 w-3" /> Reset Layout
                            </button>
                        )}
                        <button
                            onClick={() => setIsLocked(!isLocked)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${isLocked ? 'border border-gray-200 hover:bg-gray-50' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        >
                            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                            {isLocked ? 'Layout Locked' : 'Editing Layout'}
                        </button>
                    </div>
                </div>
            </div>

            {!isLocked && (
                <div className="max-w-7xl mx-auto px-4 mt-3">
                    <div className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-1.5 flex items-center gap-2">
                        ℹ Drag widgets by the <strong>⋮⋮ handle</strong> to rearrange. Drag <strong>edges/dots</strong> to resize. Click <strong>Layout Locked</strong> when done.
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto p-4">
                <DashboardGrid defaultLayouts={DEFAULT_LAYOUTS} isLocked={isLocked} storageKey="aayam-mktg-layouts">
                    {/* ── Stat Cards ── */}
                    {statCards.map((stat) => (
                        <div key={stat.key}>
                            <button
                                onClick={() => router.push(stat.link)}
                                className="h-full w-full bg-white rounded-md p-4 border border-gray-200 transition-all hover:shadow-sm text-left group flex flex-col"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-md ${stat.bgColor}`}>
                                        <stat.icon className={stat.textColor} size={20} />
                                    </div>
                                    <ArrowRight className="text-gray-400 group-hover:text-gray-900 transition-colors" size={16} />
                                </div>
                                <div className="flex-1 flex flex-col justify-center">
                                    <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.title}</h3>
                                    <p className="text-page-title text-gray-900">{loading ? '...' : stat.value}</p>
                                </div>
                            </button>
                        </div>
                    ))}

                    {/* ── Team Activity ── */}
                    <div key="team-activity">
                        <div className="h-full bg-white rounded-md p-4 border border-gray-200 flex flex-col">
                            <div className="flex items-center justify-between mb-1.5">
                                <div>
                                    <h2 className="text-page-title text-gray-900 flex items-center gap-2">
                                        <Users className="text-gray-900" size={20} />
                                        Team Activity
                                    </h2>
                                    <p className="text-gray-500 text-sm mt-1">Performance breakdown by marketing person</p>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {loading ? (
                                    <div className="text-center py-8">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                                    </div>
                                ) : teamMembers.length === 0 ? (
                                    <p className="text-center text-gray-400 py-8">No activity data available</p>
                                ) : (
                                    <div className="space-y-4">
                                        {teamMembers.map((member: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-4 rounded-md border border-gray-200 hover:border-gray-300 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center font-bold text-white">
                                                        {member.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{member.name}</p>
                                                        <p className="text-sm text-gray-500">{member.leads} leads | {member.converted} converted</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-500">Commission Est.</p>
                                                    <p className="text-section text-gray-900">₹{member.commission.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Commission Overview ── */}
                    <div key="commission">
                        <div className="h-full bg-white rounded-md p-4 border border-gray-200 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-page-title text-gray-900 flex items-center gap-2">
                                        <IndianRupee className="text-gray-900" size={24} />
                                        Commission Overview
                                    </h2>
                                    <p className="text-gray-500 text-sm mt-1">This month&apos;s earnings summary</p>
                                </div>
                                <button
                                    onClick={() => router.push('/admin/marketing/commissions')}
                                    className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm font-medium"
                                >
                                    View All
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                                    <div className="bg-gray-50 rounded-md p-4 border border-gray-200 flex flex-col justify-center">
                                        <p className="text-sm text-gray-500 mb-1">Total This Month</p>
                                        <p className="text-page-title text-gray-900">₹0</p>
                                        <p className="text-xs text-gray-400 mt-1">0 eligible projects</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-md p-4 border border-gray-200 flex flex-col justify-center">
                                        <p className="text-sm text-gray-500 mb-1">Paid Out</p>
                                        <p className="text-page-title text-gray-900">₹0</p>
                                        <p className="text-xs text-gray-400 mt-1">Last month</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-md p-4 border border-gray-200 flex flex-col justify-center">
                                        <p className="text-sm text-gray-500 mb-1">Pending</p>
                                        <p className="text-page-title text-destructive">₹0</p>
                                        <p className="text-xs text-gray-400 mt-1">Awaiting payment</p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-4 text-center">
                                    💡 Commission system will be configured based on GST calculations
                                </p>
                            </div>
                        </div>
                    </div>
                </DashboardGrid>
            </div>
        </div>
    );
}
