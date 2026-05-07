'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { X, Plus, Loader2, User, Building2, ChevronDown, AlertCircle, CheckCircle2, Sparkles, UserPlus, UserCheck } from 'lucide-react';
import ClientQuickAddModal from '@/components/shared/ClientQuickAddModal';
import VendorQuickAddModal from '@/components/shared/VendorQuickAddModal';
import {
    useExpenseCategories,
    useIncomeCategories,
    useTransactionCategorization,
    TransactionCategorization,
    InvoiceAllocation,
    BillAllocation,
} from '@/lib/categorization-hooks';
import { supabase } from '@/lib/supabase';

// ── Extract human-readable sender name from NEFT/RTGS/IMPS descriptions ──
function extractSenderFromDescription(desc: string): string {
    if (!desc) return '';
    // Pattern: NEFT CR-BANKCODE-SENDER NAME-REFCODE  or  NEFT DR-...
    const neft = desc.match(/NEFT\s+(?:CR|DR)-[A-Z0-9]+-(.+?)(?:-[A-Z0-9]{8,}|$)/i);
    if (neft?.[1]) return neft[1].trim();
    // Pattern: TPT-BANKCODE-SENDER NAME (RTGS)
    const tpt = desc.match(/TPT-[A-Z0-9]+-(.+?)(?:-[A-Z0-9]{8,}|$)/i);
    if (tpt?.[1]) return tpt[1].trim();
    // Pattern: IMPS-ref-SENDER-ref
    const imps = desc.match(/IMPS-\d+-(.+?)(?:-\d+|$)/i);
    if (imps?.[1]) return imps[1].trim();
    // Pattern: UPI transaction — grab after last /
    const upi = desc.match(/UPI(?:.*?)\/(.+?)(?:\/|$)/i);
    if (upi?.[1]) return upi[1].trim();
    return '';
}

// ── Fuzzy match extracted name against existing clients ──
function fuzzyMatchClient(extracted: string, clients: ClientOption[]): ClientOption | null {
    if (!extracted || extracted.length < 3) return null;
    const q = extracted.toUpperCase();
    // 1. Exact company/name match
    const exact = clients.find(c =>
        (c.company || '').toUpperCase() === q || c.name.toUpperCase() === q
    );
    if (exact) return exact;
    // 2. One contains the other (handles partial names)
    return clients.find(c => {
        const co = (c.company || '').toUpperCase();
        const nm = c.name.toUpperCase();
        return (co.length > 3 && (q.includes(co) || co.includes(q))) ||
               (nm.length > 3 && (q.includes(nm) || nm.includes(q)));
    }) || null;
}

// ── Fuzzy match extracted name against existing vendors ──
function fuzzyMatchVendor(extracted: string, vendors: VendorOption[]): VendorOption | null {
    if (!extracted || extracted.length < 3) return null;
    const q = extracted.toUpperCase();
    const exact = vendors.find(v => v.name.toUpperCase() === q);
    if (exact) return exact;
    return vendors.find(v => {
        const nm = v.name.toUpperCase();
        return nm.length > 3 && (q.includes(nm) || nm.includes(q));
    }) || null;
}

// ── Category names that trigger entity-linking panels ──
const CLIENT_CATEGORY_NAMES = ['Customer Payment', 'Customer Advance', 'Client Payment', 'Advance Payment'];
const VENDOR_CATEGORY_NAMES = ['Vendor Payment', 'Vendor Advance'];

interface Transaction {
    id: string;
    transaction_date: string;
    description: string;
    amount: number;
    transaction_type?: 'inflow' | 'outflow';
    is_verified?: boolean;
    categorization_type?: 'expense' | 'income' | null;
    expense_category_id?: string | null;
    income_category_id?: string | null;
    expense_type?: 'goods' | 'services' | null;
    payment_method?: string | null;
    categorization_notes?: string | null;
    client_id?: string | null;
    vendor_id?: string | null;
    [key: string]: any;
}

interface CategoryModalProps {
    transaction: Transaction;
    onClose: () => void;
    onSuccess: () => void;
}

interface ClientOption { id: string; name: string; company?: string; }
interface VendorOption { id: string; name: string; }

interface PendingInvoice {
    id: string; invoice_number: string; invoice_date: string;
    due_date?: string; total_amount: number; amount_paid: number;
    balance_due: number; payment_status: string;
}

interface PendingBill {
    id: string; bill_number: string; bill_date: string;
    due_date?: string; total_amount: number; amount_paid: number;
    vendor_bill_number?: string; description?: string;
}

export function CategoryModal({ transaction, onClose, onSuccess }: CategoryModalProps) {
    const { categories: expenseCategories, createCategory: createExpenseCategory, getParentCategories: getExpenseParents, getSubcategories: getExpenseSubcategories } = useExpenseCategories();
    const { categories: incomeCategories, createCategory: createIncomeCategory, getParentCategories: getIncomeParents, getSubcategories: getIncomeSubcategories } = useIncomeCategories();
    const { categorizeTransaction, saving } = useTransactionCategorization();

    const isEditMode = !!transaction.is_verified;

    // ── Detect transaction type from existing data or transaction_type field ──
    const detectTransactionType = (): 'expense' | 'income' => {
        if (transaction.categorization_type) return transaction.categorization_type;
        if (transaction.transaction_type === 'outflow') return 'expense';
        if (transaction.transaction_type === 'inflow') return 'income';
        if (transaction.amount < 0) return 'expense';
        return 'income';
    };

    // ── Form state ──
    const [transactionType, setTransactionType] = useState<'expense' | 'income'>(detectTransactionType());
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubcategory, setSelectedSubcategory] = useState('');
    const [expenseType, setExpenseType] = useState<'goods' | 'services'>((transaction.expense_type as any) || 'services');
    const [paymentMethod, setPaymentMethod] = useState(transaction.payment_method || 'bank_transfer');
    const [transactionDate, setTransactionDate] = useState(new Date(transaction.transaction_date).toISOString().split('T')[0]);
    const [notes, setNotes] = useState(transaction.categorization_notes || '');
    const [payeeName, setPayeeName] = useState(transaction.payee_name || '');
    const [directPayeeId, setDirectPayeeId] = useState(transaction.direct_payee_id || '');
    const [payees, setPayees] = useState<{ id: string; name: string; payee_type: string }[]>([]);
    const [payeeSearch, setPayeeSearch] = useState(transaction.payee_name || '');
    const [showPayeeDropdown, setShowPayeeDropdown] = useState(false);
    const [creatingPayee, setCreatingPayee] = useState(false);
    const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);

    // ── Client state (income side) ──
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState(transaction.client_id || '');
    const [selectedClientName, setSelectedClientName] = useState('');
    const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [invoiceAllocations, setInvoiceAllocations] = useState<Record<string, string>>({});

    // ── Smart suggestion state (soft — user can always ignore) ──
    const [suggestedClient, setSuggestedClient] = useState<ClientOption | null>(null);
    const [parsedSenderName, setParsedSenderName] = useState('');   // extracted from NEFT desc
    const [suggestionDismissed, setSuggestionDismissed] = useState(false);
    const [showCreateClientModal, setShowCreateClientModal] = useState(false);

    // ── Vendor state (expense side) ──
    const [vendors, setVendors] = useState<VendorOption[]>([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState(transaction.vendor_id || '');
    const [selectedVendorName, setSelectedVendorName] = useState('');
    const [pendingBills, setPendingBills] = useState<PendingBill[]>([]);
    const [loadingBills, setLoadingBills] = useState(false);
    const [billAllocations, setBillAllocations] = useState<Record<string, string>>({});

    // ── Smart suggestion state (vendor side — soft, always dismissible) ──
    const [suggestedVendor, setSuggestedVendor] = useState<VendorOption | null>(null);
    const [parsedPayeeName, setParsedPayeeName] = useState('');
    const [suggestionVendorDismissed, setSuggestionVendorDismissed] = useState(false);
    const [showCreateVendorModal, setShowCreateVendorModal] = useState(false);

    // ── Close on ESC key ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // ── Pre-fill category on edit mode ──
    useEffect(() => {
        if (!isEditMode) return;
        if (expenseCategories.length === 0 && incomeCategories.length === 0) return;

        if (transaction.categorization_type === 'expense' && transaction.expense_category_id) {
            const cat = expenseCategories.find(c => c.id === transaction.expense_category_id);
            if (cat?.parent_id) {
                setSelectedCategory(cat.parent_id);
                setSelectedSubcategory(transaction.expense_category_id);
            } else {
                setSelectedCategory(transaction.expense_category_id);
            }
        }
        if (transaction.categorization_type === 'income' && transaction.income_category_id) {
            const cat = incomeCategories.find(c => c.id === transaction.income_category_id);
            if (cat?.parent_id) {
                setSelectedCategory(cat.parent_id);
                setSelectedSubcategory(transaction.income_category_id);
            } else {
                setSelectedCategory(transaction.income_category_id);
            }
        }
    }, [expenseCategories, incomeCategories]);

    // ── Derived: which category name is selected ──
    const parentCategories = transactionType === 'expense' ? getExpenseParents() : getIncomeParents();
    const subcategories = selectedCategory
        ? (transactionType === 'expense' ? getExpenseSubcategories(selectedCategory) : getIncomeSubcategories(selectedCategory))
        : [];

    // Find the effective category name (subcategory if selected, else parent)
    const effectiveCategoryId = selectedSubcategory || selectedCategory;
    const effectiveCategoryName = (() => {
        const all = transactionType === 'expense' ? expenseCategories : incomeCategories;
        return all.find(c => c.id === effectiveCategoryId)?.name || '';
    })();
    const parentCategoryName = parentCategories.find(c => c.id === selectedCategory)?.name || '';

    const effectiveLower = effectiveCategoryName.toLowerCase();
    const parentLower = parentCategoryName.toLowerCase();

    const showClientSection = transactionType === 'income' &&
        (CLIENT_CATEGORY_NAMES.some(n => effectiveLower.includes(n.toLowerCase())) ||
         CLIENT_CATEGORY_NAMES.some(n => parentLower.includes(n.toLowerCase())));

    const showVendorSection = transactionType === 'expense' &&
        VENDOR_CATEGORY_NAMES.some(n => parentLower.includes(n.toLowerCase()) || effectiveLower.includes(n.toLowerCase()));

    // Reset subcategory when parent changes
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    useEffect(() => {
        if (initialLoadDone) setSelectedSubcategory('');
        else setInitialLoadDone(true);
    }, [selectedCategory]);

    // ── Fetch clients when income type ──
    useEffect(() => {
        if (transactionType !== 'income') return;
        supabase.from('clients').select('id, name, company').eq('is_active', true).order('company', { ascending: true })
            .then(({ data }) => setClients(data || []));
    }, [transactionType]);

    // ── Smart suggestion: extract sender name + fuzzy match — never auto-selects ──
    useEffect(() => {
        if (!showClientSection || selectedClientId || clients.length === 0 || suggestionDismissed) return;
        const extracted = extractSenderFromDescription(transaction.description || '');
        if (extracted) setParsedSenderName(extracted);
        const matched = fuzzyMatchClient(extracted || transaction.description || '', clients);
        setSuggestedClient(matched);
    }, [clients, showClientSection, suggestionDismissed]);

    // ── Restore client name on edit ──
    useEffect(() => {
        if (selectedClientId && clients.length > 0 && !selectedClientName) {
            const c = clients.find(cl => cl.id === selectedClientId);
            if (c) setSelectedClientName(c.company || c.name);
        }
    }, [clients, selectedClientId]);

    // ── Fetch pending invoices when client selected ──
    useEffect(() => {
        if (!selectedClientId) { setPendingInvoices([]); setInvoiceAllocations({}); return; }
        setLoadingInvoices(true);
        supabase.from('invoices')
            .select('id, invoice_number, invoice_date, due_date, total_amount, amount_paid, balance_due, payment_status')
            .eq('client_id', selectedClientId)
            .in('payment_status', ['pending', 'partial', 'overdue'])
            .gt('balance_due', 0)
            .order('invoice_date', { ascending: true })
            .then(({ data }) => {
                setPendingInvoices(data || []);
                setLoadingInvoices(false);
                // Auto-fill from oldest invoice first
                if (data && data.length > 0) {
                    let remaining = Math.abs(transaction.amount);
                    const autoAlloc: Record<string, string> = {};
                    for (const inv of data) {
                        if (remaining <= 0) break;
                        const apply = Math.min(remaining, inv.balance_due);
                        autoAlloc[inv.id] = apply.toFixed(2);
                        remaining -= apply;
                    }
                    setInvoiceAllocations(autoAlloc);
                }
            });
    }, [selectedClientId]);

    // ── Fetch vendors when expense type ──
    useEffect(() => {
        if (transactionType !== 'expense') return;
        supabase.from('vendors').select('id, name').eq('is_active', true).order('name', { ascending: true })
            .then(({ data }) => setVendors(data || []));
    }, [transactionType]);

    // ── Fetch direct payees (employees, landlords, etc.) ──
    useEffect(() => {
        if (transactionType !== 'expense') return;
        supabase.from('direct_payees').select('id, name, payee_type').eq('is_active', true).order('name', { ascending: true })
            .then(({ data }) => setPayees(data || []));
    }, [transactionType]);

    // ── Smart suggestion: extract payee name + fuzzy match vendors — never auto-selects ──
    useEffect(() => {
        if (!showVendorSection || selectedVendorId || vendors.length === 0 || suggestionVendorDismissed) return;
        const extracted = extractSenderFromDescription(transaction.description || '');
        if (extracted) setParsedPayeeName(extracted);
        const matched = fuzzyMatchVendor(extracted || transaction.description || '', vendors);
        setSuggestedVendor(matched);
    }, [vendors, showVendorSection, suggestionVendorDismissed]);

    // ── Restore vendor name on edit ──
    useEffect(() => {
        if (selectedVendorId && vendors.length > 0 && !selectedVendorName) {
            const v = vendors.find(vn => vn.id === selectedVendorId);
            if (v) setSelectedVendorName(v.name);
        }
    }, [vendors, selectedVendorId]);

    // ── Fetch pending bills when vendor selected ──
    useEffect(() => {
        if (!selectedVendorId) { setPendingBills([]); setBillAllocations({}); return; }
        setLoadingBills(true);
        supabase.from('purchase_bills')
            .select('id, bill_number, bill_date, due_date, total_amount, amount_paid, vendor_bill_number, description')
            .eq('vendor_id', selectedVendorId)
            .in('payment_status', ['pending', 'partial'])
            .order('bill_date', { ascending: true })
            .then(({ data }) => {
                setPendingBills(data || []);
                setLoadingBills(false);
                // Auto-fill from oldest bill first
                if (data && data.length > 0) {
                    let remaining = Math.abs(transaction.amount);
                    const autoAlloc: Record<string, string> = {};
                    for (const bill of data) {
                        if (remaining <= 0) break;
                        const pending = Number(bill.total_amount) - Number(bill.amount_paid);
                        const apply = Math.min(remaining, pending);
                        autoAlloc[bill.id] = apply.toFixed(2);
                        remaining -= apply;
                    }
                    setBillAllocations(autoAlloc);
                }
            });
    }, [selectedVendorId]);

    // ── Allocation totals ──
    const txnAmount = Math.abs(transaction.amount);

    const totalInvoiceAllocated = Object.values(invoiceAllocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const invoiceUnallocated = Math.max(0, txnAmount - totalInvoiceAllocated);
    const invoiceOverAllocated = totalInvoiceAllocated > txnAmount + 0.01;

    const totalBillAllocated = Object.values(billAllocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const billUnallocated = Math.max(0, txnAmount - totalBillAllocated);
    const billOverAllocated = totalBillAllocated > txnAmount + 0.01;

    // ── Handlers ──
    const handleSelectClient = (client: ClientOption) => {
        setSelectedClientId(client.id);
        setSelectedClientName(client.company || client.name);
        setClientSearch('');
        setShowClientDropdown(false);
    };
    const handleClearClient = () => {
        setSelectedClientId(''); setSelectedClientName(''); setClientSearch('');
        setPendingInvoices([]); setInvoiceAllocations({});
        // Re-show suggestion if there was one
        setSuggestionDismissed(false);
    };

    const handleSelectVendor = (vendor: VendorOption) => {
        setSelectedVendorId(vendor.id);
        setSelectedVendorName(vendor.name);
        setVendorSearch('');
        setShowVendorDropdown(false);
    };
    const handleClearVendor = () => {
        setSelectedVendorId(''); setSelectedVendorName(''); setVendorSearch('');
        setPendingBills([]); setBillAllocations({});
        setSuggestionVendorDismissed(false);
    };

    const filteredClients = clientSearch.trim()
        ? clients.filter(c => {
            const q = clientSearch.toLowerCase();
            return c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q);
        })
        : clients.slice(0, 40);

    const filteredVendors = vendorSearch.trim()
        ? vendors.filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
        : vendors.slice(0, 40);

    // ── Submit ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedCategory) { toast.error('Please select a category'); return; }
        if (showClientSection && invoiceOverAllocated) {
            toast.error(`Allocated ₹${totalInvoiceAllocated.toLocaleString('en-IN')} exceeds transaction ₹${txnAmount.toLocaleString('en-IN')}`);
            return;
        }
        if (showVendorSection && billOverAllocated) {
            toast.error(`Allocated ₹${totalBillAllocated.toLocaleString('en-IN')} exceeds transaction ₹${txnAmount.toLocaleString('en-IN')}`);
            return;
        }

        const invoiceAllocList: InvoiceAllocation[] = Object.entries(invoiceAllocations)
            .map(([invoice_id, amt]) => ({ invoice_id, amount: parseFloat(amt) || 0 }))
            .filter(a => a.amount > 0);

        const billAllocList: BillAllocation[] = Object.entries(billAllocations)
            .map(([bill_id, amt]) => ({ bill_id, amount: parseFloat(amt) || 0 }))
            .filter(a => a.amount > 0);

        const categorizationData: TransactionCategorization = {
            categorization_type: transactionType,
            payment_method: paymentMethod,
            categorization_notes: notes,
            transaction_date: transactionDate,
        };

        if (transactionType === 'expense') {
            categorizationData.expense_category_id = selectedSubcategory || selectedCategory;
            categorizationData.expense_type = expenseType;
            if (payeeName.trim()) categorizationData.payee_name = payeeName.trim();
            if (directPayeeId) categorizationData.direct_payee_id = directPayeeId;
            if (showVendorSection && selectedVendorId) {
                categorizationData.vendor_id = selectedVendorId;
                categorizationData.bill_allocations = billAllocList.length > 0 ? billAllocList : undefined;
            }
        } else {
            categorizationData.income_category_id = selectedSubcategory || selectedCategory;
            if (showClientSection && selectedClientId) {
                categorizationData.client_id = selectedClientId;
                categorizationData.invoice_allocations = invoiceAllocList.length > 0 ? invoiceAllocList : undefined;
            }
        }

        const { error } = await categorizeTransaction(transaction.id, categorizationData);
        if (error) {
            toast.error(`Error: ${error}`);
        } else {
            toast.success(isEditMode ? 'Updated successfully' : 'Transaction categorized!');
            onSuccess();
            onClose();
        }
    };

    const handleCreateNewCategory = async () => {
        if (!newCategoryName.trim()) { toast.error('Please enter a category name'); return; }
        setCreatingCategory(true);
        try {
            const createFn = transactionType === 'expense' ? createExpenseCategory : createIncomeCategory;
            const { data, error } = await createFn(newCategoryName.trim());
            if (error) { toast.error(`Error: ${error}`); }
            else if (data) {
                setSelectedCategory(data.id);
                setNewCategoryName('');
                setShowNewCategoryForm(false);
                toast.success(`Category "${data.name}" created`);
            }
        } finally { setCreatingCategory(false); }
    };

    return (
        <>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-page-title text-gray-900">
                            {isEditMode ? 'Edit Categorization' : 'Categorize Transaction'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Verify and assign category</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Transaction Summary */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                            <p className="font-semibold text-gray-900">{new Date(transaction.transaction_date).toLocaleDateString('en-IN')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Amount</p>
                            <p className={`text-section font-bold ${transaction.transaction_type === 'inflow' ? 'text-green-600' : 'text-red-600'}`}>
                                {transaction.transaction_type === 'inflow' ? '+' : '-'}₹{Math.abs(transaction.amount).toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Description</p>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">{transaction.description}</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {/* Type Toggle */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Type <span className="text-red-500">*</span></label>
                        <div className="flex gap-3">
                            {(['expense', 'income'] as const).map(t => (
                                <button key={t} type="button" onClick={() => { setTransactionType(t); setSelectedCategory(''); setSelectedSubcategory(''); }}
                                    className={`flex-1 px-4 py-3 rounded-md border-2 font-medium transition-all ${transactionType === t
                                        ? t === 'expense' ? 'border-red-500 bg-red-50 text-red-700' : 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                                    {t === 'expense' ? '🔴 Expense' : '🟢 Income'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Category <span className="text-red-500">*</span></label>
                        <select required value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring/20 bg-white">
                            <option value="">Select category...</option>
                            {parentCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>

                        {!showNewCategoryForm && (
                            <button type="button" onClick={() => setShowNewCategoryForm(true)}
                                className="mt-2 text-sm text-primary font-medium flex items-center gap-1 hover:underline">
                                <Plus size={14} /> Add New Category
                            </button>
                        )}
                        {showNewCategoryForm && (
                            <div className="mt-3 p-3 bg-muted rounded-md border border-border flex gap-2">
                                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="New category name..." autoFocus
                                    className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateNewCategory(); } }} />
                                <button type="button" onClick={handleCreateNewCategory} disabled={creatingCategory}
                                    className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                                    {creatingCategory ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
                                </button>
                                <button type="button" onClick={() => { setShowNewCategoryForm(false); setNewCategoryName(''); }}
                                    className="px-3 py-2 border border-gray-200 rounded-md text-sm">Cancel</button>
                            </div>
                        )}
                    </div>

                    {/* Subcategory */}
                    {subcategories.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Subcategory / Account</label>
                            <select value={selectedSubcategory} onChange={e => setSelectedSubcategory(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring/20 bg-white">
                                <option value="">None (use main category)</option>
                                {subcategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════
                        CLIENT SECTION — shows for Customer Payment / Customer Advance
                    ══════════════════════════════════════════ */}
                    {showClientSection && (
                        <div className="border border-green-200 rounded-lg bg-green-50/40 p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <User size={16} className="text-green-600" />
                                <span className="text-sm font-semibold text-gray-700">Select Client</span>
                                <span className="text-xs text-gray-400">(optional)</span>
                            </div>

                            {/* ── Smart Suggestion Banner (soft — always dismissible) ── */}
                            {!selectedClientId && !suggestionDismissed && (suggestedClient || parsedSenderName) && (
                                <div className={`rounded-md border px-3 py-2.5 flex items-start gap-2.5 ${suggestedClient ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <Sparkles size={15} className={`mt-0.5 shrink-0 ${suggestedClient ? 'text-blue-500' : 'text-amber-500'}`} />
                                    <div className="flex-1 min-w-0">
                                        {suggestedClient ? (
                                            <>
                                                <p className="text-xs text-blue-700">
                                                    Looks like a payment from <span className="font-semibold">{suggestedClient.company || suggestedClient.name}</span>
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <button type="button"
                                                        onClick={() => { handleSelectClient(suggestedClient); setSuggestedClient(null); }}
                                                        className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
                                                        ✓ Yes, link this client
                                                    </button>
                                                    <button type="button"
                                                        onClick={() => { setSuggestionDismissed(true); setSuggestedClient(null); }}
                                                        className="text-xs px-2.5 py-1 border border-blue-300 text-blue-600 rounded hover:bg-blue-100">
                                                        Not this one
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-amber-700">
                                                    <span className="font-semibold">{parsedSenderName}</span> not found in your clients
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <button type="button"
                                                        onClick={() => { setSuggestionDismissed(true); setShowCreateClientModal(true); }}
                                                        className="text-xs px-2.5 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 flex items-center gap-1">
                                                        <UserPlus size={11} /> Create New Client
                                                    </button>
                                                    <button type="button"
                                                        onClick={() => { setSuggestionDismissed(true); setSuggestedClient(null); }}
                                                        className="text-xs px-2.5 py-1 border border-amber-300 text-amber-600 rounded hover:bg-amber-100">
                                                        Skip / Search manually
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <button type="button" onClick={() => { setSuggestionDismissed(true); setSuggestedClient(null); }}
                                        className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
                                        <X size={13} />
                                    </button>
                                </div>
                            )}

                            {/* Client Picker */}
                            <div className="relative">
                                {selectedClientId ? (
                                    <div className="flex items-center gap-2 px-3 py-2.5 border border-green-300 rounded-md bg-white">
                                        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                        <span className="flex-1 text-sm font-medium text-gray-800">{selectedClientName}</span>
                                        <button type="button" onClick={handleClearClient} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input type="text" value={clientSearch}
                                            onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                                            onFocus={() => setShowClientDropdown(true)}
                                            placeholder="Search client by name or company..."
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 bg-white pr-8" />
                                        <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                                        {showClientDropdown && filteredClients.length > 0 && (
                                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
                                                {filteredClients.map(c => (
                                                    <button key={c.id} type="button" onClick={() => handleSelectClient(c)}
                                                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                                                        <span className="font-medium">{c.company || c.name}</span>
                                                        {c.company && <span className="text-gray-400 text-xs ml-1">({c.name})</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {/* Create New Client — always accessible at bottom of search */}
                                        <button type="button"
                                            onClick={() => setShowCreateClientModal(true)}
                                            className="mt-2 text-xs text-gray-500 hover:text-primary flex items-center gap-1 font-medium">
                                            <UserPlus size={12} /> Create New Client
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Pending Invoices */}
                            {selectedClientId && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Pending Invoices</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${invoiceOverAllocated ? 'bg-red-100 text-red-600' : totalInvoiceAllocated > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            ₹{totalInvoiceAllocated.toLocaleString('en-IN')} / ₹{txnAmount.toLocaleString('en-IN')}
                                        </span>
                                    </div>

                                    {loadingInvoices ? (
                                        <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                                            <Loader2 size={14} className="animate-spin" /> Loading invoices...
                                        </div>
                                    ) : pendingInvoices.length === 0 ? (
                                        <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                                            No pending invoices — amount will be recorded as advance.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {pendingInvoices.map(inv => (
                                                <div key={inv.id} className="bg-white rounded-md border border-gray-200 px-3 py-2.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold text-blue-600">{inv.invoice_number}</p>
                                                            <p className="text-xs text-gray-500">
                                                                Due ₹{inv.balance_due.toLocaleString('en-IN')}
                                                                {inv.due_date && ` · ${new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}`}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button type="button"
                                                                onClick={() => setInvoiceAllocations(p => ({ ...p, [inv.id]: inv.balance_due.toFixed(2) }))}
                                                                className="text-xs text-green-600 hover:underline whitespace-nowrap">Pay in Full</button>
                                                            <input type="number" min="0" max={inv.balance_due} step="0.01"
                                                                value={invoiceAllocations[inv.id] ?? ''}
                                                                onChange={e => setInvoiceAllocations(p => ({ ...p, [inv.id]: e.target.value }))}
                                                                placeholder="0"
                                                                className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-400 text-right" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {invoiceUnallocated > 0.01 && (
                                                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                                                    <AlertCircle size={13} />
                                                    ₹{invoiceUnallocated.toLocaleString('en-IN')} unallocated — will be recorded as advance
                                                </div>
                                            )}
                                            {invoiceOverAllocated && (
                                                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">
                                                    <AlertCircle size={13} />
                                                    Over by ₹{(totalInvoiceAllocated - txnAmount).toLocaleString('en-IN')} — please reduce allocation
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════════════════════════
                        VENDOR SECTION — shows for Vendor Payment / Vendor Advance
                    ══════════════════════════════════════════ */}
                    {showVendorSection && (
                        <div className="border border-orange-200 rounded-lg bg-orange-50/40 p-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-orange-600" />
                                <span className="text-sm font-semibold text-gray-700">Select Vendor</span>
                                <span className="text-xs text-gray-400">(optional)</span>
                            </div>

                            {/* ── Smart Vendor Suggestion Banner (soft — always dismissible) ── */}
                            {!selectedVendorId && !suggestionVendorDismissed && (suggestedVendor || parsedPayeeName) && (
                                <div className={`rounded-md border px-3 py-2.5 flex items-start gap-2.5 ${suggestedVendor ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <Sparkles size={15} className={`mt-0.5 shrink-0 ${suggestedVendor ? 'text-orange-500' : 'text-amber-500'}`} />
                                    <div className="flex-1 min-w-0">
                                        {suggestedVendor ? (
                                            <>
                                                <p className="text-xs text-orange-700">
                                                    Looks like a payment to <span className="font-semibold">{suggestedVendor.name}</span>
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <button type="button"
                                                        onClick={() => { handleSelectVendor(suggestedVendor); setSuggestedVendor(null); }}
                                                        className="text-xs px-2.5 py-1 bg-orange-600 text-white rounded font-medium hover:bg-orange-700">
                                                        ✓ Yes, link this vendor
                                                    </button>
                                                    <button type="button"
                                                        onClick={() => { setSuggestionVendorDismissed(true); setSuggestedVendor(null); }}
                                                        className="text-xs px-2.5 py-1 border border-orange-300 text-orange-600 rounded hover:bg-orange-100">
                                                        Not this one
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-amber-700">
                                                    <span className="font-semibold">{parsedPayeeName}</span> not found in your vendors
                                                </p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <button type="button"
                                                        onClick={() => { setSuggestionVendorDismissed(true); setShowCreateVendorModal(true); }}
                                                        className="text-xs px-2.5 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 flex items-center gap-1">
                                                        <UserPlus size={11} /> Create New Vendor
                                                    </button>
                                                    <button type="button"
                                                        onClick={() => { setSuggestionVendorDismissed(true); setSuggestedVendor(null); }}
                                                        className="text-xs px-2.5 py-1 border border-amber-300 text-amber-600 rounded hover:bg-amber-100">
                                                        Skip / Search manually
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <button type="button" onClick={() => { setSuggestionVendorDismissed(true); setSuggestedVendor(null); }}
                                        className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
                                        <X size={13} />
                                    </button>
                                </div>
                            )}

                            {/* Vendor Picker */}
                            <div className="relative">
                                {selectedVendorId ? (
                                    <div className="flex items-center gap-2 px-3 py-2.5 border border-orange-300 rounded-md bg-white">
                                        <CheckCircle2 size={16} className="text-orange-500 shrink-0" />
                                        <span className="flex-1 text-sm font-medium text-gray-800">{selectedVendorName}</span>
                                        <button type="button" onClick={handleClearVendor} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input type="text" value={vendorSearch}
                                            onChange={e => { setVendorSearch(e.target.value); setShowVendorDropdown(true); }}
                                            onFocus={() => setShowVendorDropdown(true)}
                                            placeholder="Search vendor..."
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 bg-white pr-8" />
                                        <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                                        {showVendorDropdown && filteredVendors.length > 0 && (
                                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
                                                {filteredVendors.map(v => (
                                                    <button key={v.id} type="button" onClick={() => handleSelectVendor(v)}
                                                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 font-medium">
                                                        {v.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {/* Create New Vendor — always accessible at bottom of search */}
                                        <button type="button"
                                            onClick={() => setShowCreateVendorModal(true)}
                                            className="mt-2 text-xs text-gray-500 hover:text-primary flex items-center gap-1 font-medium">
                                            <UserPlus size={12} /> Create New Vendor
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Pending Bills */}
                            {selectedVendorId && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Pending Bills</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${billOverAllocated ? 'bg-red-100 text-red-600' : totalBillAllocated > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                                            ₹{totalBillAllocated.toLocaleString('en-IN')} / ₹{txnAmount.toLocaleString('en-IN')}
                                        </span>
                                    </div>

                                    {loadingBills ? (
                                        <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                                            <Loader2 size={14} className="animate-spin" /> Loading bills...
                                        </div>
                                    ) : pendingBills.length === 0 ? (
                                        <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                                            No pending bills — amount will be recorded as advance to vendor.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {pendingBills.map(bill => {
                                                const pendingAmt = Number(bill.total_amount) - Number(bill.amount_paid);
                                                return (
                                                    <div key={bill.id} className="bg-white rounded-md border border-gray-200 px-3 py-2.5">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-orange-600">
                                                                    {bill.bill_number}
                                                                    {bill.vendor_bill_number && <span className="text-gray-400 ml-1">· {bill.vendor_bill_number}</span>}
                                                                </p>
                                                                <p className="text-xs text-gray-500">
                                                                    Due ₹{pendingAmt.toLocaleString('en-IN')}
                                                                    {bill.due_date && ` · ${new Date(bill.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}`}
                                                                </p>
                                                                {bill.description && <p className="text-xs text-gray-400 truncate">{bill.description}</p>}
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button type="button"
                                                                    onClick={() => setBillAllocations(p => ({ ...p, [bill.id]: pendingAmt.toFixed(2) }))}
                                                                    className="text-xs text-orange-600 hover:underline whitespace-nowrap">Pay in Full</button>
                                                                <input type="number" min="0" max={pendingAmt} step="0.01"
                                                                    value={billAllocations[bill.id] ?? ''}
                                                                    onChange={e => setBillAllocations(p => ({ ...p, [bill.id]: e.target.value }))}
                                                                    placeholder="0"
                                                                    className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400 text-right" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {billUnallocated > 0.01 && (
                                                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                                                    <AlertCircle size={13} />
                                                    ₹{billUnallocated.toLocaleString('en-IN')} unallocated — will be recorded as advance to vendor
                                                </div>
                                            )}
                                            {billOverAllocated && (
                                                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">
                                                    <AlertCircle size={13} />
                                                    Over by ₹{(totalBillAllocated - txnAmount).toLocaleString('en-IN')} — please reduce allocation
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Paid To — direct expense (salary, rent, utilities etc.) with autocomplete */}
                    {transactionType === 'expense' && !showVendorSection && (
                        <div className="relative">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Paid To <span className="text-gray-400 font-normal text-xs">(optional)</span>
                            </label>
                            {/* Selected payee chip */}
                            {directPayeeId ? (
                                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-md">
                                    <UserCheck className="w-4 h-4 text-green-600 shrink-0" />
                                    <span className="flex-1 text-sm font-medium text-green-800">{payeeName}</span>
                                    <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                        {payees.find(p => p.id === directPayeeId)?.payee_type || 'payee'}
                                    </span>
                                    <button type="button" onClick={() => { setDirectPayeeId(''); setPayeeName(''); setPayeeSearch(''); }}
                                        className="text-green-500 hover:text-green-700 ml-1">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <input
                                        type="text"
                                        value={payeeSearch}
                                        onChange={e => { setPayeeSearch(e.target.value); setPayeeName(e.target.value); setShowPayeeDropdown(true); }}
                                        onFocus={() => setShowPayeeDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowPayeeDropdown(false), 150)}
                                        placeholder="Search or type name (e.g. Eklavya Soni, Rajendra Mishra...)"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring/20"
                                    />
                                    {showPayeeDropdown && (
                                        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                                            {/* Existing payees matching search */}
                                            {payees
                                                .filter(p => !payeeSearch || p.name.toLowerCase().includes(payeeSearch.toLowerCase()))
                                                .map(p => (
                                                    <button key={p.id} type="button"
                                                        onMouseDown={() => { setDirectPayeeId(p.id); setPayeeName(p.name); setPayeeSearch(p.name); setShowPayeeDropdown(false); }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                                                        <UserCheck className="w-4 h-4 text-gray-400 shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{p.name}</p>
                                                            <p className="text-xs text-gray-400 capitalize">{p.payee_type}</p>
                                                        </div>
                                                    </button>
                                                ))
                                            }
                                            {/* Create new payee option */}
                                            {payeeSearch.trim().length > 1 && !payees.find(p => p.name.toLowerCase() === payeeSearch.toLowerCase()) && (
                                                <button type="button"
                                                    onMouseDown={async () => {
                                                        setCreatingPayee(true);
                                                        const { data } = await supabase.from('direct_payees')
                                                            .insert([{ name: payeeSearch.trim(), payee_type: 'other' }])
                                                            .select().single();
                                                        if (data) {
                                                            setPayees(prev => [...prev, data]);
                                                            setDirectPayeeId(data.id);
                                                            setPayeeName(data.name);
                                                        }
                                                        setShowPayeeDropdown(false);
                                                        setCreatingPayee(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left border-t border-gray-100">
                                                    {creatingPayee ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <UserPlus className="w-4 h-4 text-blue-500" />}
                                                    <span className="text-sm text-blue-600 font-medium">Create &quot;{payeeSearch.trim()}&quot;</span>
                                                </button>
                                            )}
                                            {payees.length === 0 && !payeeSearch && (
                                                <p className="px-4 py-3 text-xs text-gray-400">Type a name to search or create a new payee</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Select existing or type to create — saved for future recurring payments.</p>
                        </div>
                    )}

                    {/* Expense Type (expense only, non-vendor) */}
                    {transactionType === 'expense' && !showVendorSection && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Expense Type <span className="text-red-500">*</span></label>
                            <div className="flex gap-3">
                                {(['goods', 'services'] as const).map(t => (
                                    <button key={t} type="button" onClick={() => setExpenseType(t)}
                                        className={`flex-1 px-4 py-2.5 rounded-md border-2 font-medium transition-all ${expenseType === t ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                                        {t === 'goods' ? '📦 Goods' : '🛠️ Services'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payment Method */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {transactionType === 'expense' ? 'Paid Via' : 'Received Via'}
                        </label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring/20 bg-white">
                            <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                            <option value="upi">UPI</option>
                            <option value="cash">Cash</option>
                            <option value="cheque">Cheque</option>
                            <option value="card">Debit / Credit Card</option>
                        </select>
                    </div>

                    {/* Transaction Date */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Date</label>
                        <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring/20" />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                            placeholder="Add any additional details..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none" />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving || invoiceOverAllocated || billOverAllocated}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving && <Loader2 size={18} className="animate-spin" />}
                            {saving ? 'Saving...' : isEditMode ? 'Update & Verify' : 'Save & Verify'}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        {/* Create New Client — opens on top of this modal, auto-selects on success */}
        <ClientQuickAddModal
            isOpen={showCreateClientModal}
            onClose={() => setShowCreateClientModal(false)}
            onSuccess={(newClientId) => {
                supabase.from('clients').select('id, name, company').eq('id', newClientId).single()
                    .then(({ data }) => {
                        if (data) {
                            setClients(prev => [data, ...prev]);
                            setSelectedClientId(data.id);
                            setSelectedClientName(data.company || data.name);
                        }
                    });
            }}
        />

        {/* Create New Vendor — opens on top of this modal, auto-selects on success */}
        <VendorQuickAddModal
            isOpen={showCreateVendorModal}
            onClose={() => setShowCreateVendorModal(false)}
            onSuccess={(newVendorId) => {
                supabase.from('vendors').select('id, name').eq('id', newVendorId).single()
                    .then(({ data }) => {
                        if (data) {
                            setVendors(prev => [data, ...prev]);
                            setSelectedVendorId(data.id);
                            setSelectedVendorName(data.name);
                        }
                    });
            }}
        />
        </>
    );
}
