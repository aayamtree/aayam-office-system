'use client';

import Link from 'next/link';
import { useDashboardStats, useJobs } from '@/lib/hooks';
import { Package, Truck, IndianRupee, Palette, AlertTriangle, Clock } from 'lucide-react';

export default function DailySummaryWidget() {
    const { stats, loading: statsLoading } = useDashboardStats();
    const { jobs, loading: jobsLoading } = useJobs();

    const loading = statsLoading || jobsLoading;

    // Calculate today's stats
    const today = new Date().toISOString().split('T')[0];

    const ordersToday = jobs.filter(j => {
        const created = j.created_at?.split('T')[0];
        return created === today;
    }).length;

    const dispatchedToday = jobs.filter(j => {
        const updated = j.updated_at?.split('T')[0];
        return j.current_stage === 'dispatched' && updated === today;
    }).length;

    const designPending = jobs.filter(j =>
        j.current_stage === 'designing' || j.current_stage === 'approval'
    ).length;

    const overdueJobs = jobs.filter(j => {
        if (!j.client_deadline || j.current_stage === 'delivered' || j.current_stage === 'cancelled') return false;
        return new Date(j.client_deadline) < new Date();
    }).length;

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

    const items = [
        {
            icon: Package,
            label: 'New Orders',
            value: ordersToday,
            color: 'bg-blue-50 text-blue-600 border-blue-100',
            iconColor: 'text-blue-500',
            link: '/admin/sales/orders',
        },
        {
            icon: Truck,
            label: 'Dispatched',
            value: dispatchedToday,
            color: 'bg-green-50 text-green-600 border-green-100',
            iconColor: 'text-green-500',
            link: '/admin/dispatch',
        },
        {
            icon: Palette,
            label: 'Design Pending',
            value: designPending,
            color: 'bg-purple-50 text-purple-600 border-purple-100',
            iconColor: 'text-purple-500',
            link: '/admin/jobs/queue',
        },
        {
            icon: AlertTriangle,
            label: 'Overdue',
            value: overdueJobs,
            color: overdueJobs > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-100',
            iconColor: overdueJobs > 0 ? 'text-red-500' : 'text-gray-400',
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
