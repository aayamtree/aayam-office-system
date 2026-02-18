'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import { useLeads } from '@/lib/hooks';
import { Lead } from '@/types/database';
import Link from 'next/link';
import {
  Users, Calendar, AlertCircle, CheckCircle, Clock,
  ArrowRight, Phone, TrendingUp, Lock, Unlock, RotateCcw
} from 'lucide-react';
import DashboardGrid, { LayoutsMap, resetLayouts } from '@/components/dashboard/DashboardGrid';

const STORAGE_KEY = 'aayam-mktg-role-layouts';

const DEFAULT_LAYOUTS: LayoutsMap = {
  lg: [
    { i: 'stat-today', x: 0, y: 0, w: 3, h: 2 },
    { i: 'stat-overdue', x: 3, y: 0, w: 3, h: 2 },
    { i: 'stat-new', x: 6, y: 0, w: 3, h: 2 },
    { i: 'stat-converted', x: 9, y: 0, w: 3, h: 2 },
    { i: 'todays-calls', x: 0, y: 2, w: 6, h: 5 },
    { i: 'overdue-list', x: 6, y: 2, w: 6, h: 5 },
    { i: 'new-leads-strip', x: 0, y: 7, w: 12, h: 2 },
  ],
  md: [
    { i: 'stat-today', x: 0, y: 0, w: 3, h: 2 },
    { i: 'stat-overdue', x: 3, y: 0, w: 3, h: 2 },
    { i: 'stat-new', x: 0, y: 2, w: 3, h: 2 },
    { i: 'stat-converted', x: 3, y: 2, w: 3, h: 2 },
    { i: 'todays-calls', x: 0, y: 4, w: 6, h: 5 },
    { i: 'overdue-list', x: 0, y: 9, w: 6, h: 5 },
    { i: 'new-leads-strip', x: 0, y: 14, w: 6, h: 2 },
  ],
  sm: [
    { i: 'stat-today', x: 0, y: 0, w: 2, h: 2 },
    { i: 'stat-overdue', x: 0, y: 2, w: 2, h: 2 },
    { i: 'stat-new', x: 0, y: 4, w: 2, h: 2 },
    { i: 'stat-converted', x: 0, y: 6, w: 2, h: 2 },
    { i: 'todays-calls', x: 0, y: 8, w: 2, h: 5 },
    { i: 'overdue-list', x: 0, y: 13, w: 2, h: 5 },
    { i: 'new-leads-strip', x: 0, y: 18, w: 2, h: 2 },
  ],
};

export default function MarketingDashboard() {
  const { user, profile } = useAuth();
  const { leads, loading } = useLeads();
  const [isLocked, setIsLocked] = useState(true);

  // Filter for Marketing User
  const myLeads = leads.filter(lead => {
    if (profile?.role === 'marketing') {
      return lead.assigned_to === profile.id || lead.created_by === profile.id;
    }
    return true;
  });

  // Calculate Dates
  const today = new Date().toISOString().split('T')[0];

  const isToday = (dateString?: string) => {
    if (!dateString) return false;
    return dateString.split('T')[0] === today;
  };

  const isOverdue = (dateString?: string) => {
    if (!dateString) return false;
    return dateString.split('T')[0] < today;
  };

  // Metrics
  const newLeads = myLeads.filter(l => l.status === 'new');
  const todayFollowUps = myLeads.filter(l => l.status === 'follow_up' && isToday(l.next_follow_up));
  const overdueFollowUps = myLeads.filter(l => l.status === 'follow_up' && isOverdue(l.next_follow_up));
  const convertedLeads = myLeads.filter(l => l.status === 'converted');

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Loading Dashboard...</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in px-2 pb-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
        <div>
          <h1 className="text-page-title text-gray-900">Marketing Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, {profile?.full_name || 'Marketer'}. Here is your daily focus.</p>
        </div>
        <div className="flex items-center gap-2">
          <DriveConnectionStatus />
          {!isLocked && (
            <button
              onClick={() => { resetLayouts(STORAGE_KEY); window.location.reload(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${isLocked ? 'border border-gray-200 hover:bg-gray-50' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isLocked ? 'Unlock' : 'Lock'}
          </button>
        </div>
      </div>

      <DashboardGrid defaultLayouts={DEFAULT_LAYOUTS} isLocked={isLocked} storageKey={STORAGE_KEY}>
        {/* Stat Cards */}
        <div key="stat-today" className="h-full">
          <div className="bg-gray-900 rounded-lg p-4 text-white h-full flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2 opacity-90">
              <Calendar size={20} /><span className="font-medium">Today&apos;s Follow-ups</span>
            </div>
            <div className="text-page-title">{todayFollowUps.length}</div>
            <div className="mt-2 text-sm bg-white/20 inline-block px-3 py-1 rounded-full backdrop-blur-sm w-fit">Action Required</div>
          </div>
        </div>

        <div key="stat-overdue" className="h-full">
          <div className="bg-white rounded-lg p-4 border border-red-100 h-full flex flex-col justify-between relative overflow-hidden">
            {overdueFollowUps.length > 0 && (
              <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle size={80} className="text-red-500" /></div>
            )}
            <div className="flex items-center gap-3 mb-2 text-red-600">
              <Clock size={20} /><span className="font-medium">Overdue Tasks</span>
            </div>
            <div className="text-page-title text-gray-900">{overdueFollowUps.length}</div>
            <p className="mt-2 text-sm text-gray-500">Missed follow-ups</p>
          </div>
        </div>

        <div key="stat-new" className="h-full">
          <div className="bg-white rounded-lg p-4 border border-border h-full flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2 text-foreground">
              <Users size={20} /><span className="font-medium">New Leads</span>
            </div>
            <div className="text-page-title text-gray-900">{newLeads.length}</div>
            <p className="mt-2 text-sm text-gray-500">Waiting for contact</p>
          </div>
        </div>

        <div key="stat-converted" className="h-full">
          <div className="bg-white rounded-lg p-4 border border-green-100 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2 text-gray-900">
              <TrendingUp size={20} /><span className="font-medium">Converted</span>
            </div>
            <div className="text-page-title text-gray-900">{convertedLeads.length}</div>
            <p className="mt-2 text-sm text-gray-500">Successful deals</p>
          </div>
        </div>

        {/* Today's Calls */}
        <div key="todays-calls" className="h-full">
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-section text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-primary" /> Today&apos;s Calls
              </h2>
              <span className="text-sm text-gray-500">{today}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {todayFollowUps.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <p>No follow-ups scheduled for today.</p>
                  <Link href="/admin/marketing/leads" className="text-primary text-sm font-medium mt-2 inline-block">Browse All Leads</Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {todayFollowUps.map(lead => (
                    <div key={lead.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                      <div>
                        <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                        <p className="text-xs text-gray-500">{lead.company}</p>
                        {lead.notes && <p className="text-xs text-gray-600 mt-1 line-clamp-1 italic">&quot;{lead.notes}&quot;</p>}
                      </div>
                      <div className="flex gap-2">
                        <a href={`tel:${lead.phone}`} className="p-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors">
                          <Phone size={16} />
                        </a>
                        <Link href="/admin/marketing/leads" className="p-2 border text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overdue List */}
        <div key="overdue-list" className="h-full">
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-red-50/50 shrink-0">
              <h2 className="text-section text-red-700 flex items-center gap-2">
                <AlertCircle size={18} /> Overdue ({overdueFollowUps.length})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {overdueFollowUps.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <CheckCircle size={40} className="mx-auto mb-2 text-muted-foreground" />
                  <p>All caught up! No overdue tasks.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {overdueFollowUps.map(lead => (
                    <div key={lead.id} className="p-4 hover:bg-red-50/10 transition-colors flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                            Due: {new Date(lead.next_follow_up || '').toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Link href="/admin/marketing/leads" className="px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                        Action
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Leads Strip */}
        <div key="new-leads-strip" className="h-full">
          <div className="bg-muted border border-border rounded-lg p-4 flex items-center justify-between h-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-foreground">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{newLeads.length} New Leads Waiting</h3>
                <p className="text-sm text-foreground">These leads haven&apos;t been contacted yet.</p>
              </div>
            </div>
            <Link href="/admin/marketing/leads?status=new" className="bg-gray-900 text-white px-5 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">
              Start Call List
            </Link>
          </div>
        </div>
      </DashboardGrid>
    </div>
  );
}
