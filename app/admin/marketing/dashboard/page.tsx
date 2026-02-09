'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLeads, useFollowUps, useJobs } from '@/lib/hooks';
import {
    Users, TrendingUp, AlertCircle, CheckCircle, Clock, Calendar,
    IndianRupee, FileText, ArrowRight, Activity
} from 'lucide-react';

export default function AdminMarketingDashboard() {
    const router = useRouter();
    const { profile } = useAuth();
    const { leads, loading: leadsLoading } = useLeads();
    const { followUps, loading: followUpsLoading } = useFollowUps();
    const { jobs, loading: jobsLoading } = useJobs();

    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const stats = {
        todayFollowUps: followUps?.filter(f => f.follow_up_date === today).length || 0,
        overdueTasks: followUps?.filter(f => f.follow_up_date < today && !f.completed).length || 0,
        newLeads: leads?.filter(l => l.created_at >= sevenDaysAgo).length || 0,
        convertedLeads: leads?.filter(l => l.status === 'converted').length || 0,
        leadsWaiting: leads?.filter(l => ['follow_up', 'quoted', 'negotiating'].includes(l.status)).length || 0,
        activeQuotations: 0, // TODO: Add quotations hook
    };

    // Stat cards configuration
    const statCards = [
        {
            title: "Today's Follow Ups",
            value: stats.todayFollowUps,
            icon: Calendar,
            color: 'bg-primary',
            textColor: 'text-foreground',
            bgColor: 'bg-muted',
            link: '/admin/marketing/follow-ups?filter=today'
        },
        {
            title: 'Overdue Tasks',
            value: stats.overdueTasks,
            icon: AlertCircle,
            color: 'bg-red-500',
            textColor: 'text-red-600',
            bgColor: 'bg-red-50',
            link: '/admin/marketing/follow-ups?filter=overdue'
        },
        {
            title: 'New Leads (7d)',
            value: stats.newLeads,
            icon: TrendingUp,
            color: 'bg-white0',
            textColor: 'text-gray-900',
            bgColor: 'bg-white',
            link: '/admin/marketing/leads?filter=new'
        },
        {
            title: 'Converted',
            value: stats.convertedLeads,
            icon: CheckCircle,
            color: 'bg-gray-900',
            textColor: 'text-white',
            bgColor: 'bg-gray-900',
            link: '/admin/marketing/leads?filter=converted'
        },
        {
            title: 'Leads Waiting',
            value: stats.leadsWaiting,
            icon: Clock,
            color: 'bg-white0',
            textColor: 'text-gray-600',
            bgColor: 'bg-white',
            link: '/admin/marketing/leads?filter=waiting'
        },
        {
            title: 'Active Quotations',
            value: stats.activeQuotations,
            icon: FileText,
            color: 'bg-gray-900',
            textColor: 'text-white',
            bgColor: 'bg-gray-900',
            link: '/admin/quotations?filter=active'
        },
    ];

    // Get team activity (group by assigned_to)
    const teamActivity = leads?.reduce((acc: any, lead) => {
        const owner = lead.assigned_user?.full_name || 'Unassigned';
        const ownerId = lead.assigned_to || 'unassigned';

        if (!acc[ownerId]) {
            acc[ownerId] = {
                name: owner,
                leads: 0,
                followUps: 0,
                converted: 0,
                commission: 0 // TODO: Calculate from commissions
            };
        }

        acc[ownerId].leads++;
        if (lead.status === 'converted') acc[ownerId].converted++;

        return acc;
    }, {});

    const teamMembers = Object.values(teamActivity || {});

    const loading = leadsLoading || followUpsLoading || jobsLoading;

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
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-page-title text-gray-900 flex items-center gap-3">
                        <Activity className="text-gray-900" size={28} />
                        Marketing Team Overview
                    </h1>
                    <p className="text-gray-500 mt-1">Monitor team performance and key metrics</p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {statCards.map((stat) => (
                        <button
                            key={stat.title}
                            onClick={() => router.push(stat.link)}
                            className="bg-white rounded-md p-4 border border-gray-200 transition-all hover:shadow-sm text-left group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-md ${stat.bgColor}`}>
                                    <stat.icon className={stat.textColor} size={20} />
                                </div>
                                <ArrowRight className="text-gray-400 group-hover:text-gray-900 transition-colors" size={16} />
                            </div>
                            <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.title}</h3>
                            <p className="text-page-title text-gray-900">{loading ? '...' : stat.value}</p>
                        </button>
                    ))}
                </div>

                {/* Team Activity Section */}
                <div className="bg-white rounded-md p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-1.5">
                        <div>
                            <h2 className="text-page-title text-gray-900 flex items-center gap-2">
                                <Users className="text-gray-900" size={20} />
                                Team Activity
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">Performance breakdown by marketing person</p>
                        </div>
                    </div>

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

                <div className="bg-white rounded-md p-4 border border-gray-200">
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">Total This Month</p>
                            <p className="text-page-title text-gray-900">₹0</p>
                            <p className="text-xs text-gray-400 mt-1">0 eligible projects</p>
                        </div>
                        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">Paid Out</p>
                            <p className="text-page-title text-gray-900">₹0</p>
                            <p className="text-xs text-gray-400 mt-1">Last month</p>
                        </div>
                        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
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
    );
}
