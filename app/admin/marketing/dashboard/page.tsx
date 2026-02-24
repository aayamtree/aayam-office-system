'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLeads, useFollowUps } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import {
    Users, TrendingUp, AlertCircle, CheckCircle, Clock, Calendar,
    IndianRupee, FileText, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function AdminMarketingDashboard() {
    const router = useRouter();
    const { profile } = useAuth();
    const { leads, loading: leadsLoading } = useLeads();
    const { followUps, loading: followUpsLoading } = useFollowUps();

    const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
    useEffect(() => {
        supabase.from('profiles')
            .select('id, full_name')
            .in('role', ['marketing', 'admin'])
            .eq('is_active', true)
            .then(({ data }) => {
                if (data) {
                    const map: Record<string, string> = {};
                    data.forEach(p => { map[p.id] = p.full_name || 'Unknown'; });
                    setProfilesMap(map);
                }
            });
    }, []);

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

    const teamActivity = leads?.reduce((acc: any, lead) => {
        const ownerId = lead.assigned_to || 'unassigned';
        const owner = profilesMap[ownerId] || 'Unassigned';
        if (!acc[ownerId]) {
            acc[ownerId] = { name: owner, leads: 0, followUps: 0, converted: 0, commission: 0 };
        }
        acc[ownerId].leads++;
        if (lead.status === 'converted') acc[ownerId].converted++;
        return acc;
    }, {});

    const teamMembers = Object.values(teamActivity || {});
    const loading = leadsLoading || followUpsLoading;

    const statCards = [
        { title: "Today's Follow Ups", value: stats.todayFollowUps, icon: Calendar, link: '/admin/marketing/follow-ups?filter=today' },
        { title: 'Overdue Tasks', value: stats.overdueTasks, icon: AlertCircle, link: '/admin/marketing/follow-ups?filter=overdue' },
        { title: 'New Leads (7d)', value: stats.newLeads, icon: TrendingUp, link: '/admin/marketing/leads?filter=new' },
        { title: 'Converted', value: stats.convertedLeads, icon: CheckCircle, link: '/admin/marketing/leads?filter=converted' },
        { title: 'Leads Waiting', value: stats.leadsWaiting, icon: Clock, link: '/admin/marketing/leads?filter=waiting' },
        { title: 'Active Quotations', value: stats.activeQuotations, icon: FileText, link: '/admin/quotations?filter=active' },
    ];

    if (profile?.role !== 'admin' && profile?.role !== 'marketing') {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-4" />
                    <h2 className="text-lg font-semibold">Access Denied</h2>
                    <p className="text-sm text-muted-foreground mt-2">This page is only accessible to admins.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold tracking-tight">Marketing Team Overview</h1>
                    <p className="text-sm text-muted-foreground">Monitor team performance and key metrics</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {statCards.map((stat) => (
                    <Card key={stat.title} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(stat.link)}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <div className="flex items-center gap-2">
                                <stat.icon className="h-4 w-4 text-muted-foreground" />
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? '...' : stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Team Activity */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <CardTitle className="text-sm font-medium">Team Activity</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">Performance breakdown by marketing person</p>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-foreground"></div>
                        </div>
                    ) : teamMembers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">No activity data available</p>
                    ) : (
                        <div className="space-y-2">
                            {teamMembers.map((member: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{member.name}</p>
                                            <p className="text-xs text-muted-foreground">{member.leads} leads | {member.converted} converted</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Commission Est.</p>
                                        <p className="text-sm font-semibold">₹{member.commission.toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Commission Overview */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <IndianRupee className="h-4 w-4" />
                            <CardTitle className="text-sm font-medium">Commission Overview</CardTitle>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => router.push('/admin/marketing/commissions')}>
                            View All
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">This month&apos;s earnings summary</p>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Total This Month</p>
                            <p className="text-lg font-semibold">₹0</p>
                            <p className="text-xs text-muted-foreground mt-1">0 eligible projects</p>
                        </div>
                        <div className="p-3 rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Paid Out</p>
                            <p className="text-lg font-semibold">₹0</p>
                            <p className="text-xs text-muted-foreground mt-1">Last month</p>
                        </div>
                        <div className="p-3 rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Pending</p>
                            <p className="text-lg font-semibold text-destructive">₹0</p>
                            <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                        💡 Commission system will be configured based on GST calculations
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
