'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Check, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const EXPENSE_CATEGORIES = [
    'Office Supplies',
    'Utilities',
    'Travel',
    'Salaries',
    'Rent',
    'Maintenance',
    'Professional Fees',
    'Marketing',
    'Miscellaneous'
];

export default function QuickExpensePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [vendors, setVendors] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [recentExpenses, setRecentExpenses] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        category: '',
        amount: '',
        description: '',
        payment_mode: 'cash',
        vendor_id: '',
        reference_number: '',
        payment_date: new Date().toISOString().split('T')[0],
        account_id: ''
    });

    useEffect(() => {
        loadData();
        loadRecentExpenses();
    }, []);

    const loadData = async () => {
        // Load vendors
        const { data: vendorData } = await supabase
            .from('vendors')
            .select('id, name, company')
            .order('name');
        setVendors(vendorData || []);

        // Load bank accounts
        const { data: bankData } = await supabase
            .from('bank_accounts')
            .select('*')
            .eq('is_active', true)
            .order('name');
        setBankAccounts(bankData || []);

        // Load cash accounts
        const { data: cashData } = await supabase
            .from('cash_accounts')
            .select('*')
            .eq('is_active', true)
            .order('name');
        setCashAccounts(cashData || []);

        // Auto-select first cash account if available
        if (cashData && cashData.length > 0) {
            setFormData(prev => ({ ...prev, account_id: cashData[0].id }));
        }
    };

    const loadRecentExpenses = async () => {
        const { data } = await supabase
            .from('vendor_payments')
            .select('*, vendors(name, company)')
            .order('created_at', { ascending: false })
            .limit(10);

        setRecentExpenses(data || []);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            // Validation
            if (!formData.amount || parseFloat(formData.amount) <= 0) {
                throw new Error('Please enter a valid amount');
            }
            if (!formData.description) {
                throw new Error('Please enter a description');
            }
            if (!formData.account_id) {
                throw new Error('Please select an account');
            }

            // Determine vendor - create a generic one if none selected
            let vendorId = formData.vendor_id;
            if (!vendorId) {
                // Create a generic "Petty Expense" vendor if it doesn't exist
                const { data: existingVendor } = await supabase
                    .from('vendors')
                    .select('id')
                    .eq('name', 'Petty Expenses')
                    .single();

                if (existingVendor) {
                    vendorId = existingVendor.id;
                } else {
                    const { data: newVendor } = await supabase
                        .from('vendors')
                        .insert({ name: 'Petty Expenses', company: 'Internal' })
                        .select()
                        .single();
                    vendorId = newVendor?.id;
                }
            }

            // Call the existing RPC function
            const { data, error: rpcError } = await supabase.rpc('record_vendor_payment', {
                p_vendor_id: vendorId,
                p_amount: parseFloat(formData.amount),
                p_payment_mode: formData.payment_mode,
                p_payment_date: formData.payment_date,
                p_bank_account_id: formData.payment_mode === 'cash' ? null : formData.account_id,
                p_reference: formData.reference_number || `${formData.category} - ${formData.description}`,
                p_notes: `Category: ${formData.category}\n${formData.description}`
            });

            if (rpcError) throw rpcError;

            setSuccess(true);
            loadRecentExpenses();

            // Reset form
            setFormData({
                category: '',
                amount: '',
                description: '',
                payment_mode: 'cash',
                vendor_id: '',
                reference_number: '',
                payment_date: new Date().toISOString().split('T')[0],
                account_id: formData.payment_mode === 'cash'
                    ? (cashAccounts[0]?.id || '')
                    : (bankAccounts[0]?.id || '')
            });

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(false), 3000);

        } catch (err: any) {
            setError(err.message || 'Failed to record expense');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentModeChange = (mode: string) => {
        setFormData(prev => ({
            ...prev,
            payment_mode: mode,
            account_id: mode === 'cash'
                ? (cashAccounts[0]?.id || '')
                : (bankAccounts[0]?.id || '')
        }));
    };

    const accounts = formData.payment_mode === 'cash' ? cashAccounts : bankAccounts;

    return (
        <div className="space-y-4 md:space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-3 md:gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                    <h1 className="text-xl md:text-page-title truncate">Quick Expense Entry</h1>
                    <p className="text-sm md:text-base text-gray-500 line-clamp-1">Record expenses quickly without full vendor flow</p>
                </div>
            </div>

            {/* Main Grid - Stack on mobile, side-by-side on desktop */}
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 md:gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl border p-4 md:p-6">
                        <h2 className="text-section mb-4">Add New Expense</h2>

                        {success && (
                            <div className="mb-4 p-3 md:p-4 bg-white border border-green-200 rounded-lg flex items-center gap-2 text-sm md:text-base text-green-800">
                                <Check size={18} className="flex-shrink-0" />
                                <span>Expense recorded successfully!</span>
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm md:text-base text-red-800">
                                <AlertCircle size={18} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Category & Amount - Stack on mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-oms-blue text-sm"
                                        required
                                    >
                                        <option value="">Select category</option>
                                        {EXPENSE_CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-oms-blue text-sm"
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Enter expense details..."
                                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-oms-blue text-sm"
                                    rows={3}
                                    required
                                />
                            </div>

                            {/* Payment Mode & Account - Stack on mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Payment Mode */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Payment Mode <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.payment_mode}
                                        onChange={(e) => handlePaymentModeChange(e.target.value)}
                                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-oms-blue text-sm"
                                        required
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="upi">UPI</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>

                                {/* Account Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {formData.payment_mode === 'cash' ? 'Cash Account' : 'Bank Account'} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.account_id}
                                        onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-oms-blue text-sm"
                                        required
                                    >
                                        <option value="">Select account</option>
                                        {accounts.map((acc) => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} (₹{(acc.current_balance || 0).toLocaleString()})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Vendor & Date - Stack on mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Vendor (Optional) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Vendor (Optional)
                                    </label>
                                    <select
                                        value={formData.vendor_id}
                                        onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-oms-blue text-sm"
                                    >
                                        <option value="">None (Petty Expense)</option>
                                        {vendors.map((vendor) => (
                                            <option key={vendor.id} value={vendor.id}>
                                                {vendor.name} {vendor.company && `- ${vendor.company}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.payment_date}
                                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                        className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-oms-blue text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Reference Number (Optional) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reference Number (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.reference_number}
                                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                                    placeholder="Invoice/Receipt number..."
                                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-oms-blue text-sm"
                                />
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-[rgba(0,0,255,0.1)] hover:bg-[rgba(0,0,255,0.1)] text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    {loading ? (
                                        <>Processing...</>
                                    ) : (
                                        <>
                                            <Plus size={18} />
                                            Record Expense
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.back()}
                                    className="px-6 py-3 border rounded-lg hover:bg-gray-50 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Recent Expenses Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl border p-4 md:p-5">
                        <h3 className="font-bold mb-4">Recent Expenses</h3>
                        <div className="space-y-3">
                            {recentExpenses.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">No recent expenses</p>
                            ) : (
                                recentExpenses.map((expense) => (
                                    <div key={expense.id} className="p-3 bg-gray-50 rounded-lg">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="font-medium text-sm truncate flex-1 mr-2">
                                                {expense.vendors?.name || 'Expense'}
                                            </p>
                                            <p className="font-bold text-sm text-red-600 flex-shrink-0">
                                                ₹{expense.amount?.toLocaleString()}
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-500">{expense.payment_mode}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(expense.payment_date).toLocaleDateString('en-IN')}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
