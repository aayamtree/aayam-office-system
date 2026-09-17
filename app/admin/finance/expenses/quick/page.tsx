'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Check, AlertCircle, Pencil, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ConfirmModal';
import { refuseLegacyWrite } from '@/lib/legacy-ledger';
import ReadOnlyLedgerBanner from '@/components/finance/ReadOnlyLedgerBanner';

// Fallback list only used if the expense_categories table can't be loaded
const FALLBACK_CATEGORIES = [
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
    const confirmDialog = useConfirm();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [vendors, setVendors] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

    const [formData, setFormData] = useState({
        category: '',
        amount: '',
        description: '',
        payment_mode: 'bank_transfer',
        vendor_id: '',
        reference_number: '',
        payment_date: new Date().toISOString().split('T')[0],
        account_id: ''
    });

    useEffect(() => {
        loadData();
        loadRecentExpenses();
    }, []);

    const loadExpenseCategories = async () => {
        const { data, error } = await supabase
            .from('expense_categories')
            .select('id, name')
            .eq('is_active', true)
            .order('name');
        if (error || !data || data.length === 0) {
            setCategories(FALLBACK_CATEGORIES.map(n => ({ id: n, name: n })));
        } else {
            setCategories(data);
        }
    };

    const loadData = async () => {
        loadExpenseCategories();
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

        // Auto-select the first bank account if there is one.
        if (bankData && bankData.length > 0) {
            setFormData(prev => ({ ...prev, account_id: bankData[0].id }));
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

    // Notes are stored as "Category: X\n<description>" — parse them back for editing
    const parseNotes = (notes: string | null) => {
        if (!notes) return { category: '', description: '' };
        const m = notes.match(/^Category:\s*(.*)$/m);
        if (m) {
            return { category: m[1].trim(), description: notes.split('\n').slice(1).join('\n') };
        }
        return { category: '', description: notes };
    };

    const resetForm = () => {
        setFormData({
            category: '',
            amount: '',
            description: '',
            payment_mode: 'bank_transfer',
            vendor_id: '',
            reference_number: '',
            payment_date: new Date().toISOString().split('T')[0],
            account_id: bankAccounts[0]?.id || ''
        });
    };

    const startEdit = (expense: any) => {
        const { category, description } = parseNotes(expense.notes);
        // The reference field falls back to "Category - description" when left
        // blank at entry time — treat that fallback as empty.
        const fallbackRef = `${category} - ${description}`;
        const ref = expense.reference_number && expense.reference_number !== fallbackRef
            ? expense.reference_number : '';
        setFormData({
            category,
            amount: String(expense.amount ?? ''),
            description,
            payment_mode: expense.payment_mode || 'bank_transfer',
            vendor_id: expense.vendor_id || '',
            reference_number: ref,
            payment_date: expense.payment_date,
            account_id: expense.bank_account_id || ''
        });
        setEditingExpense(expense);
        setError('');
        setSuccess('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingExpense(null);
        resetForm();
    };

    const handleDelete = async (expense: any) => {
        if (refuseLegacyWrite('Deleting an expense')) return;

        // Was a native window.confirm on what is a full accounting reversal.
        const { confirmed } = await confirmDialog({
            title: 'Delete this expense?',
            message: `Rs ${expense.amount?.toLocaleString('en-IN')} paid to ${expense.vendor_name || 'this vendor'}. This reverses the accounting, it does not just hide the row.`,
            consequences: [
                'The payment, its ledger entry and its bank or cash line are all removed.',
                'The account balance is put back to what it was before.',
                'If this payment settled a bill, that bill goes back to unpaid.',
            ],
            variant: 'danger',
            confirmLabel: 'Delete expense',
            requireExactInput: 'DELETE',
        });
        if (!confirmed) return;
        setError('');
        const { error: delError } = await supabase.rpc('fn_delete_expense', { p_payment_id: expense.id });
        if (delError) {
            setError(delError.message || 'Failed to delete expense');
            return;
        }
        if (editingExpense?.id === expense.id) cancelEdit();
        setSuccess('Expense deleted and balances reversed.');
        setTimeout(() => setSuccess(''), 3000);
        loadRecentExpenses();
        router.refresh();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        // preventDefault FIRST. Returning before it lets the browser submit the
        // form natively: the page reloads, the refusal toast is destroyed with
        // it, and the form is wiped — the visual signature of a SUCCESSFUL save.
        e.preventDefault();
        if (refuseLegacyWrite('Recording an expense')) return;
        setLoading(true);
        setError('');
        setSuccess('');

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

            // vendor_id is optional — petty/internal expenses have no vendor
            const vendorId = formData.vendor_id || null;

            // Map the selected category name to its id (for ledger account routing)
            const catMatch = categories.find((c) => c.name === formData.category);
            const categoryId = catMatch && /^[0-9a-f-]{36}$/i.test(catMatch.id) ? catMatch.id : null;

            const rpcParams = {
                p_category_id: categoryId,
                p_vendor_id: vendorId,
                p_amount: parseFloat(formData.amount),
                p_payment_mode: formData.payment_mode,
                p_payment_date: formData.payment_date,
                p_bank_account_id: formData.account_id,
                p_cash_account_id: null,
                p_reference: formData.reference_number || `${formData.category} - ${formData.description}`,
                p_notes: `Category: ${formData.category}\n${formData.description}`
            };

            // Record new OR update existing: both RPCs post/rebuild the double
            // entry and keep account balances in sync.
            const { error: rpcError } = editingExpense
                ? await supabase.rpc('fn_update_expense', { p_payment_id: editingExpense.id, ...rpcParams })
                : await supabase.rpc('fn_record_expense', rpcParams);

            if (rpcError) throw rpcError;

            setSuccess(editingExpense ? 'Expense updated successfully!' : 'Expense recorded successfully!');
            setEditingExpense(null);
            loadRecentExpenses();
            // Push the new expense onto any cached server views (Finance Overview, etc.)
            // so the figures update immediately instead of staying stale.
            router.refresh();

            resetForm();

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(''), 3000);

        } catch (err: any) {
            setError(err.message || 'Failed to record expense');
        } finally {
            setLoading(false);
        }
    };

    // Single "Pay From" dropdown: pick an account directly; payment mode is
    // derived automatically (cash account -> cash, bank account -> bank_transfer).
    const handleAccountChange = (id: string) => {
        setFormData(prev => ({
            ...prev,
            account_id: id,
            payment_mode: 'bank_transfer'
        }));
    };

    return (
        <div className="space-y-2 md:space-y-6 pb-16 md:pb-20">
            <ReadOnlyLedgerBanner what="Quick Expense" />

            {/* Header */}
            <div className="flex items-center gap-3 md:gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 rounded-md flex-shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                    <h1 className="text-xl md:text-page-title truncate">Quick Expense Entry</h1>
                    <p className="text-sm md:text-base text-gray-500 line-clamp-1">Record expenses quickly without full vendor flow</p>
                </div>
            </div>

            {/* Main Grid - Stack on mobile, side-by-side on desktop */}
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-2 md:gap-4 md:gap-4">
                {/* Main Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-md border p-4 md:p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-section">
                                {editingExpense ? `Edit Expense${editingExpense.payment_number ? ` — ${editingExpense.payment_number}` : ''}` : 'Add New Expense'}
                            </h2>
                            {editingExpense && (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border rounded-md px-2 py-1 hover:bg-gray-50"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Cancel edit
                                </button>
                            )}
                        </div>

                        {editingExpense && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                                Editing a recorded expense — the account balance and ledger entry will be adjusted automatically.
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 p-3 md:p-4 bg-white border border-green-200 rounded-md flex items-center gap-2 text-sm md:text-base text-green-800">
                                <Check className="w-4 h-4 md:w-4.5 md:h-4.5 flex-shrink-0" />
                                <span>{success}</span>
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 p-3 md:p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm md:text-base text-red-800">
                                <AlertCircle className="w-4 h-4 md:w-4.5 md:h-4.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Category & Amount - Stack on mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2.5 border rounded-md focus:ring-2 focus:ring-gray-400 text-sm"
                                        required
                                    >
                                        <option value="">Select category</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.name}>{cat.name}</option>
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
                                        value={formData.amount || ''}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2.5 border rounded-md focus:ring-2 focus:ring-gray-400 text-sm"
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
                                    className="w-full px-3 py-2.5 border rounded-md focus:ring-2 focus:ring-gray-400 text-sm"
                                    rows={3}
                                    required
                                />
                            </div>

                            {/* Pay From — single dropdown listing every account (cash + bank) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pay From <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.account_id}
                                    onChange={(e) => handleAccountChange(e.target.value)}
                                    className="w-full px-3 py-2.5 border rounded-md focus:ring-2 focus:ring-gray-400 text-sm"
                                    required
                                >
                                    <option value="">Select account</option>
                                    {bankAccounts.length > 0 && (
                                        <optgroup label="Bank">
                                            {bankAccounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name} (₹{(acc.current_balance || 0).toLocaleString('en-IN')})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">
                                    Pick the cash or bank account — the payment method is set automatically.
                                </p>
                            </div>

                            {/* Vendor & Date - Stack on mobile */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                                {/* Vendor (Optional) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Vendor (Optional)
                                    </label>
                                    <select
                                        value={formData.vendor_id}
                                        onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                        className="w-full px-3 py-2.5 border rounded-md focus:ring-2 focus:ring-gray-400 text-sm"
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
                                        className="w-full px-3 py-2.5 border rounded-md focus:ring-2 focus:ring-gray-400 text-sm"
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
                                    className="w-full px-3 py-2.5 border rounded-md focus:ring-2 focus:ring-gray-400 text-sm"
                                />
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-gray-900 hover:bg-gray-900 text-white font-medium py-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    {loading ? (
                                        <>Processing...</>
                                    ) : editingExpense ? (
                                        <>
                                            <Check className="w-4 h-4 md:w-4.5 md:h-4.5" />
                                            Update Expense
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
                                            Record Expense
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => editingExpense ? cancelEdit() : router.back()}
                                    className="px-4 py-2 border rounded-md hover:bg-gray-50 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Recent Expenses Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-md border p-4 md:p-5">
                        <h3 className="font-bold mb-4">Recent Expenses</h3>
                        <div className="space-y-3">
                            {recentExpenses.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">No recent expenses</p>
                            ) : (
                                recentExpenses.map((expense) => (
                                    <div
                                        key={expense.id}
                                        className={`p-3 rounded-md ${editingExpense?.id === expense.id
                                            ? 'bg-amber-50 border border-amber-300'
                                            : 'bg-gray-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="font-medium text-sm truncate flex-1 mr-2">
                                                {expense.vendors?.name || 'Expense'}
                                            </p>
                                            <p className="font-bold text-sm text-red-600 flex-shrink-0">
                                                ₹{expense.amount?.toLocaleString()}
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-500">{expense.payment_mode}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-gray-400">
                                                {new Date(expense.payment_date).toLocaleDateString('en-IN')}
                                            </p>
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(expense)}
                                                    title="Edit expense"
                                                    className="p-1.5 rounded hover:bg-white text-gray-400 hover:text-gray-700"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(expense)}
                                                    title="Delete expense"
                                                    className="p-1.5 rounded hover:bg-white text-gray-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
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
