'use client';

import Link from 'next/link';
import { Users, Building2, UserPlus, TrendingUp } from 'lucide-react';

export default function CRMPage() {
  const stats = [
    { label: 'Total Clients', value: '156', change: '+12 this month', icon: Users, color: 'bg-blue-500' },
    { label: 'Total Vendors', value: '34', change: '+3 this month', icon: Building2, color: 'bg-purple-500' },
    { label: 'New This Month', value: '15', change: '↑ 25%', icon: UserPlus, color: 'bg-green-500' },
    { label: 'Active Orders', value: '23', change: 'From 45 clients', icon: TrendingUp, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">CRM</h1>
          <p className="text-gray-500 mt-1">Manage your clients and vendors</p>
        </div>
        <Link
          href="/admin/crm/clients?new=true"
          className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-3 rounded-xl shadow-lg shadow-gray-900/20 transition-all hover:scale-105 active:scale-95 font-medium"
        >
          <UserPlus size={20} />
          <span>Add Client</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-shadow hover:shadow-md group">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                <stat.icon size={22} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
            <p className="text-xs font-medium text-green-600 mt-2 bg-green-50 w-fit px-2 py-1 rounded-full">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clients Card */}
        <Link href="/admin/crm/clients" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={28} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Clients</h2>
              <p className="text-sm font-medium text-gray-500">156 total clients</p>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            Manage your client database, view contact details, and track order history.
          </p>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="text-green-700 bg-green-50 px-2.5 py-1 rounded-full">142 Active</span>
            <span className="text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">14 Inactive</span>
          </div>
        </Link>

        {/* Vendors Card */}
        <Link href="/admin/crm/vendors" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 size={28} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Vendors</h2>
              <p className="text-sm font-medium text-gray-500">34 total vendors</p>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            Manage suppliers, track purchases, and maintain vendor relationships.
          </p>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="text-green-700 bg-green-50 px-2.5 py-1 rounded-full">30 Active</span>
            <span className="text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">4 Inactive</span>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
          <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
        </div>
        <div className="space-y-3">
          {[
            { action: 'New client added', name: 'Tech Solutions Pvt Ltd', time: '2 hours ago', type: 'client' },
            { action: 'Client updated', name: 'ABC Industries', time: '5 hours ago', type: 'client' },
            { action: 'New vendor added', name: 'Paper World Supplies', time: '1 day ago', type: 'vendor' },
            { action: 'Order placed by', name: 'Global Traders', time: '1 day ago', type: 'client' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'client' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                }`}>
                {item.type === 'client' ? (
                  <Users size={20} />
                ) : (
                  <Building2 size={20} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{item.action}</p>
                <p className="text-xs font-medium text-gray-500 mt-0.5">{item.name}</p>
              </div>
              <span className="text-xs font-medium text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
