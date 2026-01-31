'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    DollarSign, Plus, Download, Calculator,
    CheckCircle, Clock, TrendingUp, AlertCircle
} from 'lucide-react';
import { calculateCommission, COMMON_GST_RATES, formatCurrency, CommissionInput } from '@/lib/commission-calculator';

export default function CommissionsPage() {
    const { profile } = useAuth();
    const [showAddModal, setShowAddModal] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');

    // TODO: Replace with real data hook
    const commissions: any[] = [];
    const loading = false;

    // Only admin can access this page
    if (profile?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
                    <p className="text-gray-500 mt-2">This page is only accessible to admins.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <DollarSign className="text-green-600" size={32} />
                                Commission Management
                            </h1>
                            <p className="text-gray-500 mt-1">Track and manage marketing commissions with flexible GST</p>
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Add Commission
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Clock className="text-blue-600" size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Pending</p>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">₹0</p>
                        <p className="text-xs text-gray-400 mt-1">0 projects</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-[rgba(0,0,255,0.1)] rounded-lg">
                                <CheckCircle className="text-oms-blue" size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Approved</p>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">₹0</p>
                        <p className="text-xs text-gray-400 mt-1">0 projects</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <TrendingUp className="text-green-600" size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Paid</p>
                        </div>
                        <p className="text-2xl font-bold text-green-600">₹0</p>
                        <p className="text-xs text-gray-400 mt-1">0 projects</p>
                    </div>
                    <div className="bg-oms-blue rounded-2xl p-6 border border-[rgba(0,0,255,0.2)]-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white rounded-lg">
                                <DollarSign className="text-oms-blue" size={20} />
                            </div>
                            <p className="text-sm text-gray-600 font-medium">Total This Month</p>
                        </div>
                        <p className="text-2xl font-bold text-indigo-900">₹0</p>
                        <p className="text-xs text-gray-500 mt-1">Eligible commissions</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {(['all', 'pending', 'approved', 'paid'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize ${filter === f
                                        ? f === 'all' ? 'bg-[rgba(0,0,255,0.1)] text-white'
                                            : f === 'pending' ? 'bg-blue-600 text-white'
                                                : f === 'approved' ? 'bg-[rgba(0,0,255,0.1)] text-white'
                                                    : 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm font-bold flex items-center gap-2">
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                {/* Commissions List */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900">Commission Records</h2>
                        <p className="text-sm text-gray-500 mt-1">All commission calculations with GST breakdown</p>
                    </div>
                    <div className="p-6">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(0,0,255,0.2)]-600"></div>
                            </div>
                        ) : commissions.length === 0 ? (
                            <div className="text-center py-12">
                                <DollarSign className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-medium">No commissions added yet</p>
                                <p className="text-sm text-gray-400 mt-1">Click &quot;Add Commission&quot; to create your first entry</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {commissions.map((commission) => (
                                    <div key={commission.id} className="border border-gray-100 rounded-xl p-4 hover:border-indigo-200 transition-all">
                                        {/* Commission card content */}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Commission Modal */}
            {showAddModal && <AddCommissionModal onClose={() => setShowAddModal(false)} />}
        </div>
    );
}

// Add Commission Modal with Live Calculator
function AddCommissionModal({ onClose }: { onClose: () => void }) {
    const [formData, setFormData] = useState({
        projectName: '',
        projectTotal: '',
        gstPercentage: '18',
        commissionType: 'percentage' as 'percentage' | 'fixed',
        commissionValue: '5',
    });

    const [calculationResult, setCalculationResult] = useState<any>(null);

    // Calculate in real-time
    const handleCalculate = () => {
        if (!formData.projectTotal || !formData.gstPercentage || !formData.commissionValue) {
            setCalculationResult(null);
            return;
        }

        const input: CommissionInput = {
            projectTotalAmount: parseFloat(formData.projectTotal),
            gstPercentage: parseFloat(formData.gstPercentage),
            commissionType: formData.commissionType,
            commissionValue: parseFloat(formData.commissionValue),
        };

        const result = calculateCommission(input);
        setCalculationResult(result);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
                    <h3 className="text-2xl font-bold flex items-center gap-3">
                        <Calculator size={28} />
                        Add Commission with GST Calculator
                    </h3>
                    <p className="text-green-100 text-sm mt-1">User-configurable GST rates for all printing materials</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Project Name */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Project Name</label>
                        <input
                            type="text"
                            value={formData.projectName}
                            onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-green-500/20 focus:border-green-500 transition-all"
                            placeholder="e.g., Pouch - ABC Company"
                        />
                    </div>

                    {/* Project Total */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Project Total Amount (including GST) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                            <input
                                type="number"
                                value={formData.projectTotal}
                                onChange={(e) => {
                                    setFormData({ ...formData, projectTotal: e.target.value });
                                    setTimeout(handleCalculate, 100);
                                }}
                                className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-lg font-bold focus:ring-4 ring-green-500/20 focus:border-green-500 transition-all"
                                placeholder="56000"
                            />
                        </div>
                    </div>

                    {/* GST Percentage */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            GST Percentage (User-Configurable) <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-5 gap-2 mb-3">
                            {COMMON_GST_RATES.map((rate) => (
                                <button
                                    key={rate.value}
                                    onClick={() => {
                                        if (rate.value > 0) {
                                            setFormData({ ...formData, gstPercentage: rate.value.toString() });
                                            setTimeout(handleCalculate, 100);
                                        }
                                    }}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${formData.gstPercentage === rate.value.toString()
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {rate.value > 0 ? `${rate.value}%` : 'Custom'}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                value={formData.gstPercentage}
                                onChange={(e) => {
                                    setFormData({ ...formData, gstPercentage: e.target.value });
                                    setTimeout(handleCalculate, 100);
                                }}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:ring-4 ring-green-500/20 focus:border-green-500 transition-all"
                                placeholder="18"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">💡 Enter any GST % - policies change and you work with all materials!</p>
                    </div>

                    {/* Commission Type & Value */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Commission Type</label>
                            <select
                                value={formData.commissionType}
                                onChange={(e) => {
                                    setFormData({ ...formData, commissionType: e.target.value as any });
                                    setTimeout(handleCalculate, 100);
                                }}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold focus:ring-4 ring-green-500/20 focus:border-green-500 transition-all"
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Commission Value {formData.commissionType === 'percentage' ? '(%)' : '(₹)'}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.commissionValue}
                                onChange={(e) => {
                                    setFormData({ ...formData, commissionValue: e.target.value });
                                    setTimeout(handleCalculate, 100);
                                }}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:ring-4 ring-green-500/20 focus:border-green-500 transition-all"
                                placeholder="5"
                            />
                        </div>
                    </div>

                    {/* Live Calculation Result */}
                    {calculationResult && (
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                            <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                                <Calculator size={20} />
                                Live Calculation
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Project Total (incl. GST)</span>
                                    <span className="font-bold text-gray-900">{formatCurrency(calculationResult.projectTotalAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center text-red-600">
                                    <span className="text-sm">GST ({calculationResult.gstPercentage}%)</span>
                                    <span className="font-bold">- {formatCurrency(calculationResult.gstAmount)}</span>
                                </div>
                                <div className="border-t-2 border-green-200 pt-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-700">Base Amount (excl. GST)</span>
                                    <span className="font-bold text-gray-900">{formatCurrency(calculationResult.baseAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center text-blue-600">
                                    <span className="text-sm">
                                        Commission ({formData.commissionType === 'percentage' ? `${calculationResult.commissionValue}%` : 'Fixed'})
                                    </span>
                                    <span className="font-bold">× {formData.commissionType === 'percentage' ? `${calculationResult.commissionValue}%` : formatCurrency(calculationResult.commissionValue)}</span>
                                </div>
                                <div className="border-t-2 border-green-300 pt-3 mt-3"></div>
                                <div className="flex justify-between items-center bg-green-600 text-white rounded-xl p-3">
                                    <span className="font-bold">Final Commission</span>
                                    <span className="text-2xl font-bold">{formatCurrency(calculationResult.commissionAmount)}</span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-600 mt-3 italic">{calculationResult.breakdown}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t-2 border-gray-100 bg-gray-50 flex gap-4 justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            alert('Commission saving feature coming soon - database table creation needed!');
                            onClose();
                        }}
                        className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                    >
                        Save Commission
                    </button>
                </div>
            </div>
        </div>
    );
}
