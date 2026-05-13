'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, IndianRupee, Loader2, Receipt, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface JobProfitabilityProps {
    jobId: string;
    totalAmount: number;  // Job's total_amount (quoted revenue)
    amountReceived: number; // Amount actually collected
}

interface CostBreakdown {
    purchaseBillsTotal: number;
    purchaseBillsCount: number;
}

export default function JobProfitabilityCard({ jobId, totalAmount, amountReceived }: JobProfitabilityProps) {
    const [costs, setCosts] = useState<CostBreakdown>({ purchaseBillsTotal: 0, purchaseBillsCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!jobId) return;
        fetchCosts();
    }, [jobId]);

    const fetchCosts = async () => {
        setLoading(true);
        try {
            // Fetch purchase bills linked to this job
            const { data: bills } = await supabase
                .from('purchase_bills')
                .select('total_amount')
                .eq('job_id', jobId);

            const purchaseBillsTotal = (bills || []).reduce((sum, b) => sum + (b.total_amount || 0), 0);
            const purchaseBillsCount = (bills || []).length;

            setCosts({ purchaseBillsTotal, purchaseBillsCount });
        } catch (error) {
            console.error('Error fetching profitability data:', error);
        } finally {
            setLoading(false);
        }
    };

    const revenue = totalAmount;
    const totalCosts = costs.purchaseBillsTotal;
    const profit = revenue - totalCosts;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const isProfit = profit >= 0;

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-400">Loading profitability...</span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Job Profitability
            </h4>

            {/* Main Profit/Loss Card */}
            <div className={`rounded-lg p-4 border ${isProfit ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">
                        {isProfit ? 'Profit' : 'Loss'}
                    </span>
                    <div className={`flex items-center gap-1 ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className="text-sm font-bold">{margin.toFixed(1)}% margin</span>
                    </div>
                </div>
                <p className={`text-2xl font-bold ${isProfit ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(Math.abs(profit))}
                </p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                        <IndianRupee className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-400 uppercase">Revenue</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(revenue)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Collected: {formatCurrency(amountReceived)}
                    </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                        <ShoppingCart className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-400 uppercase">Costs</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(totalCosts)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {costs.purchaseBillsCount} purchase bill{costs.purchaseBillsCount !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            {totalCosts === 0 && (
                <p className="text-xs text-gray-400 italic text-center">
                    No purchase bills linked yet — link bills to this job for accurate costing.
                </p>
            )}
        </div>
    );
}
