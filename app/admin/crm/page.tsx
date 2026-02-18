'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Building2, UserPlus, TrendingUp, Lock, Unlock, RotateCcw } from 'lucide-react';
import DashboardGrid, { LayoutsMap, resetLayouts } from '@/components/dashboard/DashboardGrid';

const STORAGE_KEY = 'aayam-crm-layouts';

const DEFAULT_LAYOUTS: LayoutsMap = {
  lg: [
    { i: 'stat-total', x: 0, y: 0, w: 4, h: 2 },
    { i: 'stat-new', x: 4, y: 0, w: 4, h: 2 },
    { i: 'stat-active', x: 8, y: 0, w: 4, h: 2 },
    { i: 'link-clients', x: 0, y: 2, w: 6, h: 4 },
    { i: 'recent-activity', x: 6, y: 2, w: 6, h: 4 },
  ],
  md: [
    { i: 'stat-total', x: 0, y: 0, w: 3, h: 2 },
    { i: 'stat-new', x: 3, y: 0, w: 3, h: 2 },
    { i: 'stat-active', x: 0, y: 2, w: 6, h: 2 },
    { i: 'link-clients', x: 0, y: 4, w: 6, h: 4 },
    { i: 'recent-activity', x: 0, y: 8, w: 6, h: 4 },
  ],
  sm: [
    { i: 'stat-total', x: 0, y: 0, w: 2, h: 2 },
    { i: 'stat-new', x: 0, y: 2, w: 2, h: 2 },
    { i: 'stat-active', x: 0, y: 4, w: 2, h: 2 },
    { i: 'link-clients', x: 0, y: 6, w: 2, h: 4 },
    { i: 'recent-activity', x: 0, y: 10, w: 2, h: 4 },
  ],
};

export default function CRMPage() {
  const [isLocked, setIsLocked] = useState(true);

  const statCards = [
    { key: 'stat-total', label: 'Total Clients', value: '156', change: '+12 this month', icon: Users, color: 'bg-primary' },
    { key: 'stat-new', label: 'New This Month', value: '15', change: '↑ 25%', icon: UserPlus, color: 'bg-white0' },
    { key: 'stat-active', label: 'Active Orders', value: '23', change: 'From 45 clients', icon: TrendingUp, color: 'bg-white0' },
  ];

  const recentActivity = [
    { action: 'New client added', name: 'Tech Solutions Pvt Ltd', time: '2 hours ago', type: 'client' },
    { action: 'Client updated', name: 'ABC Industries', time: '5 hours ago', type: 'client' },
    { action: 'Order placed by', name: 'Global Traders', time: '1 day ago', type: 'client' },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-page-title text-gray-900 tracking-tight">CRM</h1>
          <p className="text-gray-500 mt-1">Manage your clients</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/crm/clients?new=true" className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg transition-all font-medium">
            <UserPlus size={20} /><span>Add Client</span>
          </Link>
          {!isLocked && (
            <button onClick={() => { resetLayouts(STORAGE_KEY); window.location.reload(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <button onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${isLocked ? 'border border-gray-200 hover:bg-gray-50' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isLocked ? 'Unlock' : 'Lock'}
          </button>
        </div>
      </div>

      <DashboardGrid defaultLayouts={DEFAULT_LAYOUTS} isLocked={isLocked} storageKey={STORAGE_KEY}>
        {/* Stat Cards */}
        {statCards.map((stat) => (
          <div key={stat.key} className="h-full">
            <div className="bg-white rounded-lg p-5 border border-gray-100 h-full flex flex-col justify-between group">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <stat.icon size={22} className="text-white" />
                </div>
              </div>
              <p className="text-page-title text-gray-900">{stat.value}</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
              <p className="text-label text-gray-900 mt-2 bg-white w-fit px-2 py-1 rounded-full">{stat.change}</p>
            </div>
          </div>
        ))}

        {/* Clients Card */}
        <div key="link-clients" className="h-full">
          <Link href="/admin/crm/clients" className="bg-white rounded-lg p-4 border border-gray-100 hover:-translate-y-1 transition-all duration-300 group h-full flex flex-col justify-between">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users size={28} className="text-foreground" />
              </div>
              <div>
                <h2 className="text-section text-gray-900">Clients</h2>
                <p className="text-sm font-medium text-gray-500">156 total clients</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">Manage your client database, view contact details, and track order history.</p>
            <div className="flex items-center gap-3 text-label">
              <span className="text-gray-900 bg-white px-2.5 py-1 rounded-full">142 Active</span>
              <span className="text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">14 Inactive</span>
            </div>
          </Link>
        </div>

        {/* Recent Activity */}
        <div key="recent-activity" className="h-full">
          <div className="bg-white rounded-lg p-4 border border-gray-100 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-1 h-6 bg-gray-900 rounded-full"></div>
              <h2 className="text-section text-gray-900">Recent Activity</h2>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {recentActivity.map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-4 bg-gray-50/80 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'client' ? 'bg-muted text-foreground' : 'bg-gray-900 text-white'}`}>
                    {item.type === 'client' ? <Users size={20} /> : <Building2 size={20} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{item.action}</p>
                    <p className="text-label text-gray-500 mt-0.5">{item.name}</p>
                  </div>
                  <span className="text-label text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardGrid>
    </div>
  );
}
