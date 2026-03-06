'use client';

import Link from 'next/link';
import { Package, Truck, Palette, AlertTriangle, Clock } from 'lucide-react';

interface Stats {
    ordersThisMonth: number;
    pendingDispatches: number;
    pipeline: Record<string, number>;
    todaysFocus: { jobsDue: number; jobsDelayed: number; jobsCompleted: number; paymentsDue: number };
}

interface DailySummaryWidgetProps {
    initialStats?: Stats;
}

// Default empty stats — used when no server data is passed
const EMPTY: Stats = {
    ordersThisMonth: 0,
    pendingDispatches: 0,
    pipeline: {},
    todaysFocus: { jobsDue: 0, jobsDelayed: 0, jobsCompleted: 0, paymentsDue: 0 },
};

export default function DailySummaryWidget({ initialStats }: DailySummaryWidgetProps) {
    // Use server-provided data directly — no client fetch, no loading state
    const stats = initialStats ?? EMPTY;

    const items = [
        {
            icon: Package,
            label: 'New Orders',
            value: stats.ordersThisMonth,
            link: '/admin/sales/orders',
        },
        {
            icon: Truck,
            label: 'Dispatched',
            value: stats.pendingDispatches,
            link: '/admin/dispatch',
        },
        {
            icon: Palette,
            label: 'Design Pending',
            value: (stats.pipeline['designing'] || 0) + (stats.pipeline['approval'] || 0),
            link: '/admin/jobs/queue',
        },
        {
            icon: AlertTriangle,
            label: 'Overdue',
            value: stats.todaysFocus.jobsDelayed,
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
        </div>
    );
}
