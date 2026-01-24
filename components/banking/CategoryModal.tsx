'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { useExpenseCategories, useIncomeCategories, useTransactionCategorization, TransactionCategorization } from '@/lib/categorization-hooks';

interface Transaction {
    id: string;
    transaction_date: string;
    description: string;
    amount: number;
    type: 'credit' | 'debit';
}

interface CategoryModalProps {
    transaction: Transaction;
    onClose: () => void;
    onSuccess: () => void;
}

export function CategoryModal({ transaction, onClose, onSuccess }: CategoryModalProps) {
    // Hooks
    const { categories: expenseCategories, createCategory: createExpenseCategory, getParentCategories: getExpenseParents, getSubcategories: getExpenseSubcategories } = useExpenseCategories();
    const { categories: incomeCategories, createCategory: createIncomeCategory, getParentCategories: getIncomeParents, getSubcategories: getIncomeSubcategories } = useIncomeCategories();
    const { categorizeTransaction, saving } = useTransactionCategorization();

    // Form state - Auto-detect transaction type based on transaction data
    const detectTransactionType = (): 'expense' | 'income' => {
        // Method 1: Check transaction_type field (outflow/inflow)
        if ('transaction_type' in transaction) {
            return (transaction as any).transaction_type === 'outflow' ? 'expense' : 'income';
        }

        // Method 2: Check type field (debit/credit) 
        if (transaction.type === 'debit') return 'expense';
        if (transaction.type === 'credit') return 'income';

        // Method 3: Check amount sign (negative = outflow/expense, positive = inflow/income)
        if (transaction.amount < 0) return 'expense';
        if (transaction.amount > 0) return 'income';

        // Default to expense if unclear
        return 'expense';
    };

    const [transactionType, setTransactionType] = useState<'expense' | 'income'>(detectTransactionType());
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubcategory, setSelectedSubcategory] = useState('');
    const [expenseType, setExpenseType] = useState<'goods' | 'services'>('services');
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
    const [transactionDate, setTransactionDate] = useState(
        new Date(transaction.transaction_date).toISOString().split('T')[0]
    );
    const [notes, setNotes] = useState('');

    // New category state
    const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);

    // Get relevant categories based on transaction type
    const parentCategories = transactionType === 'expense'
        ? getExpenseParents()
        : getIncomeParents();

    const subcategories = selectedCategory
        ? (transactionType === 'expense'
            ? getExpenseSubcategories(selectedCategory)
            : getIncomeSubcategories(selectedCategory))
        : [];

    // Reset subcategory when parent changes
    useEffect(() => {
        setSelectedSubcategory('');
    }, [selectedCategory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!selectedCategory) {
            alert('Please select a category');
            return;
        }

        // Prepare categorization data
        const categorizationData: TransactionCategorization = {
            categorization_type: transactionType,
            payment_method: paymentMethod,
            categorization_notes: notes,
            transaction_date: transactionDate,
        };

        // Add category based on type
        if (transactionType === 'expense') {
            categorizationData.expense_category_id = selectedSubcategory || selectedCategory;
            categorizationData.expense_type = expenseType;
        } else {
            categorizationData.income_category_id = selectedSubcategory || selectedCategory;
        }

        // Save categorization
        const { error } = await categorizeTransaction(transaction.id, categorizationData);

        if (error) {
            alert(`Error: ${error}`);
        } else {
            onSuccess();
            onClose();
        }
    };

    const handleCreateNewCategory = async () => {
        if (!newCategoryName.trim()) {
            alert('Please enter a category name');
            return;
        }

        setCreatingCategory(true);

        try {
            const createFn = transactionType === 'expense' ? createExpenseCategory : createIncomeCategory;
            const { data, error } = await createFn(newCategoryName.trim());

            if (error) {
                alert(`Error creating category: ${error}`);
            } else if (data) {
                setSelectedCategory(data.id);
                setNewCategoryName('');
                setShowNewCategoryForm(false);
            }
        } finally {
            setCreatingCategory(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Categorize Transaction</h2>
                        <p className="text-sm text-gray-500 mt-1">Verify and assign category</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Transaction Details */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                            <p className="font-semibold text-gray-900">
                                {new Date(transaction.transaction_date).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Amount</p>
                            <p className={`font-bold text-lg ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Description</p>
                        <p className="text-sm text-gray-900 mt-1 line-clamp-2" title={transaction.description}>
                            {transaction.description}
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Transaction Type */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Type <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setTransactionType('expense')}
                                className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${transactionType === 'expense'
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                🔴 Expense
                            </button>
                            <button
                                type="button"
                                onClick={() => setTransactionType('income')}
                                className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${transactionType === 'income'
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                🟢 Income
                            </button>
                        </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            <option value="">Select category...</option>
                            {parentCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>

                        {/* New Category Button */}
                        {!showNewCategoryForm && (
                            <button
                                type="button"
                                onClick={() => setShowNewCategoryForm(true)}
                                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                            >
                                <Plus size={14} /> Add New Category
                            </button>
                        )}

                        {/* New Category Form */}
                        {showNewCategoryForm && (
                            <div className="mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="New category name..."
                                        className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCreateNewCategory}
                                        disabled={creatingCategory}
                                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400"
                                    >
                                        {creatingCategory ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowNewCategoryForm(false);
                                            setNewCategoryName('');
                                        }}
                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Subcategory (if available) */}
                    {subcategories.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Subcategory / Account
                            </label>
                            <select
                                value={selectedSubcategory}
                                onChange={(e) => setSelectedSubcategory(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                <option value="">None (use main category)</option>
                                {subcategories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Expense Type (only for expenses) */}
                    {transactionType === 'expense' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Expense Type <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setExpenseType('goods')}
                                    className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-medium transition-all ${expenseType === 'goods'
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    📦 Goods
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpenseType('services')}
                                    className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-medium transition-all ${expenseType === 'services'
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    🛠️ Services
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Payment Method */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {transactionType === 'expense' ? 'Paid' : 'Received'} Via
                        </label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="cheque">Cheque</option>
                            <option value="card">Debit/Credit Card</option>
                        </select>
                    </div>

                    {/* Transaction Date */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Transaction Date
                        </label>
                        <input
                            type="date"
                            value={transactionDate}
                            onChange={(e) => setTransactionDate(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Add any additional details..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 size={18} className="animate-spin" />}
                            {saving ? 'Saving...' : 'Save & Verify'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
