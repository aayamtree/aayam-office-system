'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import {
    IndianRupee, CheckCircle, Clock, TrendingUp, Loader2,
    AlertCircle, Briefcase, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { useCommissions } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';

const fmtCur = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUS_COLORS: Record<string, string> = {
    eligible: 'bg-amber-100 text-amber-800 border-amber-200',
    approved: 'bg-blue-100 text-blue-800 border-blue-200',
    paid: 'bg-green-100 text-green-800 border-green-200',
};

export default function CommissionsPage() {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';

    // Marketing user sees only their own; admin sees all
    const { commissions, loading, stats, approveCommission, markCommissionPaid } = useCommissions();

    const [filter, setFilter] = useState<'all' | 'eligible' | 'approved' | 'paid'>('all');
    const [approveModal, setApproveModal] = useState<{ jobId: string; name: string; defaultPct: number; gstPct: number } | null>(null);
    const [pctInput, setPctInput] = useState('5');
    const [saving, setSaving] = useState(false);

    if (profile?.role !== 'admin' && profile?.role !== 'marketing') {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-lg font-bold text-gray-900">Access Denied</h2>
                </div>
            </div>
        );
    }

    const filtered = filter === 'all' ? commissions : commissions.filter(c => c.commission_status === filter);

    const handleApprove = async () => {
        if (!approveModal) return;
        setSaving(true);
        const { error } = await approveCommission(approveModal.jobId, parseFloat(pctInput), approveModal.gstPct);
        setSaving(false);
        if (error) { toast.error('Failed: ' + error); return; }
        toast.success('Commission approved!');
        setApproveModal(null);
    };

    const handleMarkPaid = async (jobId: string) => {
        const { error } = await markCommissionPaid(jobId);
        if (error) { toast.error('Failed: ' + error); return; }
        toast.success('Commission marked as paid!');
    };

    return (
        <div className="space-y-4 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-page-title text-gray-900 flex items-center gap-2">
                        <IndianRupee className="w-6 h-6 text-yellow-500" />
                        {isAdmin ? 'Commission Management' : 'My Commissions'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {isAdmin ? 'Marketing staff commissions — tied to jobs, auto from full payment' : 'Your earnings from converted jobs'}
                    </p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700">Eligible (Pending)</span>
                    </div>
                    <p className="text-lg font-bold text-amber-900">{fmtCur(stats.pendingAmount)}</p>
                    <p className="text-xs text-amber-600">{stats.pendingCount} job{stats.pendingCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Approved</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900">{fmtCur(stats.approvedAmount)}</p>
                    <p className="text-xs text-blue-600">{stats.approvedCount} job{stats.approvedCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Paid Out</span>
                    </div>
                    <p className="text-lg font-bold text-green-900">{fmtCur(stats.paidAmount)}</p>
                    <p className="text-xs text-green-600">{stats.paidCount} job{stats.paidCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <IndianRupee className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs font-medium text-white">This Month</span>
                    </div>
                    <p className="text-lg font-bold text-white">{fmtCur(stats.thisMonthAmount)}</p>
                    <p className="text-xs text-gray-400">All statuses</p>
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 flex-wrap">
                {(['all', 'eligible', 'approved', 'paid'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {f === 'eligible' ? '⏳ Eligible' : f === 'approved' ? '✅ Approved' : f === 'paid' ? '💰 Paid' : 'All'}
                    </button>
                ))}
            </div>

            {/* Commission List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin w-6 h-6 text-gray-400" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-md border border-dashed border-gray-200">
                        <IndianRupee className="mx-auto w-10 h-10 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No commissions yet</p>
                        <p className="text-xs text-gray-400 mt-1">Commissions are automatically created when a linked job is fully paid</p>
                    </div>
                ) : (
                    filtered.map((job) => (
                        <div key={job.id} className="bg-white rounded-md border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
                            {/* Header bar */}
                            <div className="bg-gray-900 px-3 py-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Briefcase className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                                    <span className="text-xs font-bold text-white truncate">{job.project_name}</span>
                                    <span className="text-gray-400 text-xs font-mono">{job.job_number}</span>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border capitalize flex-shrink-0 ${STATUS_COLORS[job.commission_status] || 'bg-gray-100 text-gray-600'}`}>
                                    {job.commission_status}
                                </span>
                            </div>

                            {/* Body */}
                            <div className="p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                                {isAdmin && job.commission_user && (
                                    <div>
                                        <span className="text-xs text-gray-400">Marketer</span>
                                        <p className="font-semibold text-gray-900">{(job.commission_user as any).full_name}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-xs text-gray-400">Job Total</span>
                                    <p className="font-semibold text-gray-900">{fmtCur(job.total_amount)}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-400">Commission %</span>
                                    <p className="font-semibold text-gray-900">{job.commission_percentage ?? '—'}%</p>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-400">Commission Amt</span>
                                    <p className="font-bold text-green-700">{fmtCur(job.commission_amount || 0)}</p>
                                </div>
                                {job.commission_paid_at && (
                                    <div>
                                        <span className="text-xs text-gray-400">Paid On</span>
                                        <p className="font-medium text-gray-900">{formatDate(job.commission_paid_at)}</p>
                                    </div>
                                )}
                            </div>

                            {/* Admin Actions */}
                            {isAdmin && job.commission_status !== 'paid' && (
                                <div className="flex items-center border-t border-gray-100">
                                    {job.commission_status === 'eligible' && (
                                        <button
                                            onClick={() => { setPctInput(String(job.commission_percentage || 5)); setApproveModal({ jobId: job.id, name: job.project_name, defaultPct: job.commission_percentage || 5, gstPct: job.gst_percentage || 18 }); }}
                                            className="flex-1 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors text-center"
                                        >
                                            ✅ Set % & Approve
                                        </button>
                                    )}
                                    {job.commission_status === 'approved' && (
                                        <button
                                            onClick={() => handleMarkPaid(job.id)}
                                            className="flex-1 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors text-center"
                                        >
                                            💰 Mark as Paid
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Approve Modal */}
            {approveModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-md w-full max-w-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900">Approve Commission</h3>
                            <button onClick={() => setApproveModal(null)} className="p-1 hover:bg-gray-100 rounded-md">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-600">Job: <span className="font-semibold">{approveModal.name}</span></p>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Commission Percentage (%)</label>
                            <input
                                type="number" step="0.5" min="0" max="100"
                                value={pctInput}
                                onChange={e => setPctInput(e.target.value)}
                                className="w-full border border-gray-200 rounded-md px-3 py-2 text-lg font-bold focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                            />
                            <p className="text-xs text-gray-400 mt-1">GST rate used: {approveModal.gstPct}%</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setApproveModal(null)} className="flex-1 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button onClick={handleApprove} disabled={saving} className="flex-1 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
