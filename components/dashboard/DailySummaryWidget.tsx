'use client';

import Link from 'next/link';
import { useDashboardStats } from '@/lib/hooks';
import { Package, Truck, Palette, AlertTriangle, Clock } from 'lucide-react';

export default function DailySummaryWidget() {
    const { stats, loading } = useDashboardStats();

    // Use data already computed by dashboard stats — no extra queries
    const items = [
        {
            icon: Package,
            label: 'New Orders',
            value: stats.ordersThisMonth,
            color: 'bg-blue-50 text-blue-600 border-blue-100',
            iconColor: 'text-blue-500',
            link: '/admin/sales/orders',
        },
        {
            icon: Truck,
            label: 'Dispatched',
            value: stats.pendingDispatches,
            color: 'bg-green-50 text-green-600 border-green-100',
            iconColor: 'text-green-500',
            link: '/admin/dispatch',
        },
        {
            icon: Palette,
            label: 'Design Pending',
            value: (stats.pipeline['designing'] || 0) + (stats.pipeline['approval'] || 0),
            color: 'bg-purple-50 text-purple-600 border-purple-100',
            iconColor: 'text-purple-500',
            link: '/admin/jobs/queue',
        },
        {
            icon: AlertTriangle,
            label: 'Overdue',
            value: stats.todaysFocus.jobsDelayed,
            color: stats.todaysFocus.jobsDelayed > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-100',
            iconColor: stats.todaysFocus.jobsDelayed > 0 ? 'text-red-500' : 'text-gray-400',
            link: '/admin/jobs',
        },
    ];

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-4 md:p-5 text-white">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2 text-white/90">
                    <Clock className="w-4 h-4" />
                    Today&apos;s Summary
                </h3>
                <span className="text-xs text-white/50">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
            </div>

            {loading ? (
                <div className="text-center py-4 text-sm text-white/40">Loading...</div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {items.map((item, i) => (
                        <Link
                            key={i}
                            href={item.link}
                            className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/5 hover:bg-white/20 transition-colors cursor-pointer block"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <item.icon className="w-4 h-4 text-white/60" />
                                <span className="text-xs text-white/60">{item.label}</span>
                            </div>
                            <p className="text-2xl font-bold">{item.value}</p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
