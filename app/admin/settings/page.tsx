'use client';

import Link from 'next/link';
import { Users, Building2, Sliders, Shield, Bell, Database } from 'lucide-react';

export default function SettingsPage() {
  const settingsMenu = [
    { title: 'Users', desc: 'Manage staff accounts & permissions', icon: Users, href: '/admin/settings/users', color: 'bg-blue-100 text-blue-600' },
    { title: 'Company', desc: 'Business details, logo & address', icon: Building2, href: '/admin/settings/company', color: 'bg-green-100 text-green-600' },
    { title: 'Preferences', desc: 'App settings & configurations', icon: Sliders, href: '/admin/settings/preferences', color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your system configurations</p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsMenu.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center`}>
                <item.icon size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{item.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Info */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">App Version</p>
            <p className="text-lg font-semibold text-gray-900">v1.0.0</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">Last Backup</p>
            <p className="text-lg font-semibold text-gray-900">Today, 2:30 AM</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">Active Users</p>
            <p className="text-lg font-semibold text-gray-900">5 Users</p>
          </div>
        </div>
      </div>
    </div>
  );
}
