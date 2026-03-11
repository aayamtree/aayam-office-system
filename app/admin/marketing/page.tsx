'use client';

import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import { useLeads, useFollowUps } from '@/lib/hooks';
import Link from 'next/link';
import { Users, Calendar, AlertCircle, CheckCircle, Clock, ArrowRight, Phone, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function MarketingDashboard() {
  const { profile } = useAuth();
  const { leads, loading } = useLeads();
  const { followUps, loading: followUpsLoading } = useFollowUps();

  const myLeads = leads.filter(lead => {
    if (profile?.role === 'marketing') {
      return lead.assigned_to === profile.id || lead.created_by === profile.id;
    }
    return true;
  });

  const today = new Date().toISOString().split('T')[0];
  const isToday = (dateString?: string) => dateString ? dateString.split('T')[0] === today : false;
  const isOverdue = (dateString?: string) => dateString ? dateString.split('T')[0] < today : false;

  const newLeads = myLeads.filter(l => l.status === 'new');
  const todayFollowUps = myLeads.filter(l => l.status === 'follow_up' && isToday(l.next_follow_up));
  const overdueFollowUps = myLeads.filter(l => l.status === 'follow_up' && isOverdue(l.next_follow_up));
  const convertedLeads = myLeads.filter(l => l.status === 'converted');

  if (loading || followUpsLoading) {
    return <div className="p-10 text-center text-muted-foreground">Loading Dashboard...</div>;
  }

  const statCards = [
    { label: "Today's Follow-ups", value: todayFollowUps.length, change: 'Action Required', icon: Calendar },
    { label: 'Follow-ups', value: followUps.length, change: 'Total follow-ups logged', icon: Clock },
    { label: 'New Leads', value: newLeads.length, change: 'Waiting for contact', icon: Users },
    { label: 'Converted', value: convertedLeads.length, change: 'Successful deals', icon: TrendingUp },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Marketing Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {profile?.full_name || 'Marketer'}</p>
        </div>
        <DriveConnectionStatus />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Calls + Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Today&apos;s Calls
              </CardTitle>
              <span className="text-xs text-muted-foreground">{today}</span>
            </div>
          </CardHeader>
          <CardContent>
            {todayFollowUps.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <p>No follow-ups scheduled for today.</p>
                <Link href="/admin/marketing/leads" className="text-primary text-sm font-medium mt-2 inline-block">Browse All Leads</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todayFollowUps.map(lead => (
                  <div key={lead.id} className="p-3 rounded-md border hover:bg-muted/50 transition-colors flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">{lead.name}</h3>
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                      {lead.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">&quot;{lead.notes}&quot;</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="default" size="icon" className="h-8 w-8" asChild>
                        <a href={`tel:${lead.phone}`}><Phone className="h-4 w-4" /></a>
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                        <Link href="/admin/marketing/leads"><ArrowRight className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" /> Overdue ({overdueFollowUps.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {overdueFollowUps.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p>All caught up! No overdue tasks.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {overdueFollowUps.map(lead => (
                  <div key={lead.id} className="p-3 rounded-md border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">{lead.name}</h3>
                      <Badge variant="destructive" className="mt-1 text-xs">
                        Due: {new Date(lead.next_follow_up || '').toLocaleDateString()}
                      </Badge>
                    </div>
                    <Button variant="destructive" size="sm" className="text-xs" asChild>
                      <Link href="/admin/marketing/leads">Action</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Leads Strip */}
      <Card className="bg-muted">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-background rounded-md flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{newLeads.length} New Leads Waiting</p>
              <p className="text-xs text-muted-foreground">These leads haven&apos;t been contacted yet.</p>
            </div>
          </div>
          <Button asChild>
            <Link href="/admin/marketing/leads?status=new">Start Call List</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
