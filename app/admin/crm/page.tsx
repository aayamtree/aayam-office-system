'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Building2, UserPlus, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function CRMPage() {
  const statCards = [
    { label: 'Total Clients', value: '156', change: '+12 this month', icon: Users },
    { label: 'New This Month', value: '15', change: '↑ 25%', icon: UserPlus },
    { label: 'Active Orders', value: '23', change: 'From 45 clients', icon: TrendingUp },
  ];

  const recentActivity = [
    { action: 'New client added', name: 'Tech Solutions Pvt Ltd', time: '2 hours ago', type: 'client' },
    { action: 'Client updated', name: 'ABC Industries', time: '5 hours ago', type: 'client' },
    { action: 'Order placed by', name: 'Global Traders', time: '1 day ago', type: 'client' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">CRM</h1>
        <Button asChild>
          <Link href="/admin/crm/clients?new=true" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add Client
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Clients + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link href="/admin/crm/clients">
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Users className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Clients</CardTitle>
                  <CardDescription>156 total clients</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Manage client database, view contacts, and track order history.</p>
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-muted px-2 py-1 rounded-md">142 Active</span>
                <span className="bg-muted px-2 py-1 rounded-md">14 Inactive</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {item.type === 'client' ? <Users className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
