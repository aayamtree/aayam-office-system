'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  Users, Phone, FileText, ShoppingCart, Truck, IndianRupee,
  TrendingUp, Target, Calendar, Clock, ArrowRight, Plus,
  UserPlus, MessageSquare, CheckCircle, AlertCircle, User
} from 'lucide-react';

const stats = {
  myLeads: 24,
  activeFollowUps: 8,
  quotationsSent: 15,
  conversionRate: 32,
  pendingCallbacks: 5,
  thisMonthLeads: 12,
};

const recentLeads = [
  { id: 1, name: 'Sharma Industries', contact: 'Rajesh Sharma', phone: '9876543210', status: 'hot', createdAt: '2025-12-25' },
  { id: 2, name: 'Patel Enterprises', contact: 'Mukesh Patel', phone: '9898989898', status: 'warm', createdAt: '2025-12-24' },
  { id: 3, name: 'Gujarat Textiles', contact: 'Amit Shah', phone: '9825123456', status: 'new', createdAt: '2025-12-24' },
];

const todayFollowUps = [
  { id: 1, client: 'Sharma Industries', type: 'Call', time: '10:00 AM', notes: 'Discuss quotation' },
  { id: 2, client: 'Royal Prints', type: 'Meeting', time: '2:00 PM', notes: 'Product demo' },
  { id: 3, client: 'Patel Enterprises', type: 'Email', time: '4:00 PM', notes: 'Send revised quote' },
];

const pendingQuotations = [
  { id: 'QT-001', client: 'Sharma Industries', amount: 45000, date: '2025-12-24', status: 'sent' },
  { id: 'QT-002', client: 'Gujarat Textiles', amount: 28000, date: '2025-12-23', status: 'viewed' },
];

export default function MarketingPage() {
  const { profile, loading } = useAuth();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'bg-red-100 text-red-700';
      case 'warm': return 'bg-orange-100 text-orange-700';
      case 'new': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Marketing Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, {profile?.full_name || 'Marketing Team'}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/marketing/leads"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 font-medium">
            <UserPlus size={20} />
            <span>New Lead</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Leads', value: stats.myLeads, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100' },
          { label: 'Active Follow-ups', value: stats.activeFollowUps, icon: Phone, color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-100' },
          { label: 'Quotations Sent', value: stats.quotationsSent, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-100' },
          { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', ring: 'ring-green-100' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.bg} ${stat.ring} ring-4 rounded-xl flex items-center justify-center`}>
                <stat.icon className={stat.color} size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Access Cards */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Leads', href: '/admin/marketing/leads', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Follow-ups', href: '/admin/marketing/follow-ups', icon: Phone, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Quotations', href: '/admin/marketing/quotations', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Orders', href: '/admin/marketing/orders', icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Dispatch', href: '/admin/marketing/dispatch', icon: Truck, color: 'text-cyan-600', bg: 'bg-cyan-50' },
            { label: 'Payments', href: '/admin/marketing/payments', icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((item, idx) => (
            <Link key={idx} href={item.href}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-center group">
              <div className={`w-14 h-14 ${item.bg} rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                <item.icon className={item.color} size={24} />
              </div>
              <p className="text-sm font-bold text-gray-900">{item.label}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Follow-ups */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-orange-500 rounded-full"></div>
              <h2 className="font-bold text-gray-900 text-lg">Today&apos;s Follow-ups</h2>
            </div>
            <Link href="/admin/marketing/follow-ups" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-5 space-y-4">
            {todayFollowUps.map(followUp => (
              <div key={followUp.id} className="flex items-center gap-4 p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${followUp.type === 'Call' ? 'bg-green-100 text-green-600' :
                  followUp.type === 'Meeting' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                  }`}>
                  {followUp.type === 'Call' ? <Phone size={20} /> :
                    followUp.type === 'Meeting' ? <Users size={20} /> :
                      <MessageSquare size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{followUp.client}</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5 truncate">{followUp.notes}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-gray-900 font-semibold text-sm">
                    <Clock size={12} className="text-gray-400" />
                    {followUp.time}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mt-1">{followUp.type}</p>
                </div>
              </div>
            ))}
            {todayFollowUps.length === 0 && (
              <p className="text-center text-gray-400 py-8 italic">No follow-ups scheduled today</p>
            )}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
              <h2 className="font-bold text-gray-900 text-lg">Recent Leads</h2>
            </div>
            <Link href="/admin/marketing/leads" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-5 space-y-4">
            {recentLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{lead.name}</p>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <User size={12} />
                    <span>{lead.contact}</span>
                    <span className="text-gray-300">•</span>
                    <Phone size={12} />
                    <span>{lead.phone}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-3">
                  <p className="text-xs font-medium text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">
                    {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Quotations */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
              <h2 className="font-bold text-gray-900 text-lg">Pending Quotations</h2>
            </div>
            <Link href="/admin/marketing/quotations" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-5 space-y-4">
            {pendingQuotations.map(quote => (
              <div key={quote.id} className="flex items-center justify-between p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{quote.id}</span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${quote.status === 'viewed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                      {quote.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{quote.client}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900">{formatCurrency(quote.amount)}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(quote.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <div className="w-1 h-5 bg-green-500 rounded-full"></div>
            <h2 className="font-bold text-gray-900 text-lg">Monthly Performance</h2>
          </div>
          <div className="p-5 space-y-5">
            {[
              { label: 'New Leads', value: stats.thisMonthLeads, color: 'text-gray-900' },
              { label: 'Quotations Created', value: 8, color: 'text-gray-900' },
              { label: 'Orders Converted', value: 4, color: 'text-green-600 font-bold' },
              { label: 'Pending Callbacks', value: stats.pendingCallbacks, color: 'text-orange-600 font-bold' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <span className="text-gray-600 font-medium">{item.label}</span>
                <span className={`text-lg ${item.color}`}>{item.value}</span>
              </div>
            ))}

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl border border-green-100">
                <span className="text-green-900 font-bold">Conversion Rate</span>
                <span className="font-bold text-green-700 text-xl">{stats.conversionRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Access Notice */}
      <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <AlertCircle className="text-blue-600 flex-shrink-0" size={24} />
          </div>
          <div>
            <p className="font-bold text-blue-900 text-lg">Marketing Access Level</p>
            <p className="text-sm text-blue-700 mt-1 leading-relaxed max-w-2xl">
              You have full access to manage leads, follow-ups, and quotations.
              Information regarding Orders, Dispatch, and Payments is available in read-only mode for tracking purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
