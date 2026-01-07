'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useJobs } from '@/lib/hooks';
import {
    IndianRupee, Calendar, CheckCircle, Clock,
    TrendingUp, AlertCircle, ArrowRight
} from 'lucide-react';
import { Job } from '@/types/database';

export default function CommissionsPage() {
    const { profile } = useAuth();
    const { jobs, loading } = useJobs();

    // Safely access commission rate (defaults to 0 if not set)
    const commissionRate = profile?.commission_rate || 0;

    // Filter jobs linked to this marketing person
    const myJobs = useMemo(() => {
        if (!profile?.id) return [];
        return jobs.filter(job =>
            // Filter by sales_person_id (requires SQL update to work)
            job.sales_person_id === profile.id
        );
    }, [jobs, profile]);

    // Calculate Stats
    const stats = useMemo(() => {
        let totalProjected = 0; // All linked jobs
        let totalRealized = 0;  // Fully paid jobs
        let pendingCount = 0;

        myJobs.forEach(job => {
            const netAmount = (job.subtotal || 0) - (job.discount_amount || 0);
            const commission = netAmount * (commissionRate / 100);

            totalProjected += commission;

            if (job.payment_status === 'paid') {
                totalRealized += commission;
            } else {
                pendingCount++;
            }
        });

        return {
            totalProjected,
            totalRealized,
            pendingCount,
            count: myJobs.length
        };
    }, [myJobs, commissionRate]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-700';
            case 'partial': return 'bg-amber-100 text-amber-700';
            case 'pending': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading commission data...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Commissions</h1>
                <p className="text-gray-500">Track your earnings and payout status</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <TrendingUp size={20} className="text-indigo-600" />
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md">
                            Fixed Rate
                        </span>
                    </div>
                    <p className="text-sm text-gray-500">Commission Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{commissionRate}%</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <CheckCircle size={20} className="text-green-600" />
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-md">
                            Realized
                        </span>
                    </div>
                    <p className="text-sm text-gray-500">Paid & Earned</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRealized)}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-amber-50 rounded-lg">
                            <Clock size={20} className="text-amber-600" />
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">
                            Projected
                        </span>
                    </div>
                    <p className="text-sm text-gray-500">Total Potential</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalProjected)}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <ArrowRight size={20} className="text-blue-600" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500">Orders Linked</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.count}</p>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">Order History</h2>
                </div>

                {myJobs.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-400">No linked orders found.</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Ensure orders are converted by you (or assigned to you) and commission SQL is run.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Value</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission ({commissionRate}%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {myJobs.map((job) => {
                                    const netAmount = (job.subtotal || 0) - (job.discount_amount || 0);
                                    const commission = netAmount * (commissionRate / 100);
                                    return (
                                        <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-gray-900">{job.job_number}</span>
                                                <p className="text-xs text-gray-500">{new Date(job.order_date).toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {job.client?.company || job.client?.name || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {formatCurrency(netAmount)} <span className="text-xs text-gray-400">(Ex. Tax)</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.payment_status)}`}>
                                                    {job.payment_status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`font-bold ${job.payment_status === 'paid' ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {formatCurrency(commission)}
                                                </span>
                                                {job.payment_status !== 'paid' && (
                                                    <p className="text-[10px] text-gray-400">Pending Receipt</p>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
