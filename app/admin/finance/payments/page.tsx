'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { Plus, X, Loader2, ArrowDownRight, ArrowUpRight, Building2, Tag } from 'lucide-react';
import { logActivity } from '@/lib/logger';

export default function PaymentsPageNew() {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [paymentType, setPaymentType] = useState<'received' | 'paid'>('received');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [accountId, setAccountId] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);

    // Filter state
    const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'banking'>('all');

    // Fetch payments (manual + categorized bank transactions)
    const fetchPayments = async () => {
        try {
            setLoading(true);

            // PERF: All 3 fetches run in parallel — was sequential (3× slower)
            const [receivedRes, paidRes, bankTxnsRes] = await Promise.all([
                supabase.rpc('get_all_payments_received'),
                supabase.rpc('get_all_vendor_payments'),
                supabase
                    .from('bank_transactions')
                    .select(`
                        id, transaction_date, transaction_type, amount, description,
                        reference_number, categorization_type, expense_category_id,
                        income_category_id, expense_type, payment_method,
                        categorization_notes, is_verified, verified_at,
                        expense_category:expense_categories(id, name),
                        income_category:income_categories(id, name),
                        bank_account:bank_accounts(id, name, bank_name)
                    `)
                    .eq('is_verified', true)
                    .order('transaction_date', { ascending: false })
                    .limit(1000),
            ]);

            const { data: received, error: recError } = receivedRes;
            const { data: paid, error: paidError } = paidRes;
            const { data: bankTxns, error: bankError } = bankTxnsRes;

            if (recError) throw recError;
            if (paidError) throw paidError;
            if (bankError) throw bankError;

            // Build unified payment list
            const manualPayments = [
                ...(received || []).map((p: any) => ({ ...p, type: 'received', source: 'manual' })),
                ...(paid || []).map((p: any) => ({ ...p, type: 'paid', source: 'manual' }))
            ];

            // Convert bank transactions to payment format
            const bankPayments = (bankTxns || []).map((txn: any) => ({
                id: txn.id,
                amount: txn.amount,
                payment_date: txn.transaction_date,
                payment_mode: txn.payment_method || 'bank_transfer',
                reference_number: txn.reference_number,
                notes: txn.categorization_notes,
                type: txn.transaction_type === 'inflow' ? 'received' : 'paid',
                source: 'banking',
                // Description / party info from bank description
                description: txn.description,
                // Category info
                category_name: txn.categorization_type === 'expense'
                    ? txn.expense_category?.name
                    : txn.income_category?.name,
                categorization_type: txn.categorization_type,
                expense_type: txn.expense_type,
                bank_account_name: txn.bank_account?.name || txn.bank_account?.bank_name,
                verified_at: txn.verified_at,
                // For display - use description as party name for bank transactions
                client_name: txn.transaction_type === 'inflow' ? (txn.description?.substring(0, 50) || 'Bank Inflow') : null,
                client_company: null,
                vendor_name: txn.transaction_type === 'outflow' ? (txn.description?.substring(0, 50) || 'Bank Outflow') : null,
                vendor_company: null,
            }));

            const allPayments = [...manualPayments, ...bankPayments]
                .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

            setPayments(allPayments);
            setError(null);
        } catch (err: any) {
            setError(err.message);
            toast.error('Failed to load payments: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    // Fetch clients and vendors
    const fetchParties = async () => {
        const { data: clientsData } = await supabase.from('clients').select('id, name, company');
        const { data: vendorsData } = await supabase.from('vendors').select('id, name, company');
        const { data: banksData } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
        const { data: cashData } = await supabase.from('cash_accounts').select('*').eq('is_active', true);
        setClients(clientsData || []);
        setVendors(vendorsData || []);
        setBankAccounts(banksData || []);
        setCashAccounts(cashData || []);
    };

    useEffect(() => {
        fetchPayments();
        fetchParties();
    }, []);

    // Single "Pay From" dropdown: pick an account directly; payment mode is
    // derived automatically (cash account -> cash, bank account -> bank_transfer).
    const handleAccountChange = (id: string) => {
        const isCash = cashAccounts.some((a) => a.id === id);
        setAccountId(id);
        setPaymentMethod(isCash ? 'cash' : 'bank_transfer');
    };

    // Filtered payments
    const filteredPayments = sourceFilter === 'all'
        ? payments
        : payments.filter(p => p.source === sourceFilter);

    // Stats
    const totalReceived = payments.filter(p => p.type === 'received').reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPaid = payments.filter(p => p.type === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);
    const bankTxnCount = payments.filter(p => p.source === 'banking').length;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const type = formData.get('type') as string;
        const amount = parseFloat(formData.get('amount') as string);
        const payMode = paymentMethod;

        try {
            if (!accountId) throw new Error('Please select an account to pay from');

            if (type === 'received') {
                const clientId = formData.get('client_id') as string;
                const { error } = await supabase.rpc('record_payment_received', {
                    p_client_id: clientId,
                    p_amount: amount,
                    p_payment_mode: payMode,
                    p_payment_date: formData.get('payment_date') || new Date().toISOString().split('T')[0],
                    p_bank_account_id: payMode === 'cash' ? null : accountId,
                    p_cash_account_id: payMode === 'cash' ? accountId : null,
                    p_reference: formData.get('reference') as string,
                    p_notes: formData.get('notes') as string,
                    p_invoice_id: null,
                    p_attachment_url: null
                });
                if (error) throw error;

                // Log activity
                const client = clients.find(c => c.id === clientId);
                await logActivity(
                    'Recorded Payment',
                    'Finance',
                    undefined,
                    `Received ₹${amount.toLocaleString()} from ${client?.company || client?.name} via ${payMode.replace('_', ' ')}`
                );
            } else {
                const vendorId = formData.get('vendor_id') as string;
                const { error } = await supabase.rpc('record_vendor_payment', {
                    p_vendor_id: vendorId,
                    p_amount: amount,
                    p_payment_mode: payMode,
                    p_payment_date: formData.get('payment_date') || new Date().toISOString().split('T')[0],
                    p_bank_account_id: payMode === 'cash' ? null : accountId,
                    p_cash_account_id: payMode === 'cash' ? accountId : null,
                    p_reference: formData.get('reference') as string,
                    p_notes: formData.get('notes') as string,
                    p_purchase_bill_id: null,
                    p_attachment_url: null
                });
                if (error) throw error;

                // Log activity
                const vendor = vendors.find(v => v.id === vendorId);
                await logActivity(
                    'Recorded Payment',
                    'Finance',
                    undefined,
                    `Paid ₹${amount.toLocaleString()} to ${vendor?.company || vendor?.name} via ${payMode.replace('_', ' ')}`
                );
            }

            await fetchPayments();
            setShowModal(false);
            setAccountId('');
            setPaymentMethod('cash');
            toast.success('Payment recorded successfully!');
        } catch (err: any) {
            toast.error(String('Error: ' + err.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header - Stack on mobile */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-1.5">
                <div>
                    <h1 className="text-xl md:text-page-title">Payments</h1>
                    <p className="text-sm text-gray-500">{payments.length} transactions total</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-md hover:bg-gray-800 w-full sm:w-auto justify-center text-sm font-medium"
                >
                    <Plus size={18} />
                    Record Payment
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
                    Error: {error}
                </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-500">Total Received</p>
                    <p className="text-xl font-bold text-gray-900">₹{totalReceived.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white p-4 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-500">Total Paid</p>
                    <p className="text-xl font-bold text-red-600">₹{totalPaid.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white p-4 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-500">From Bank Categorization</p>
                    <p className="text-xl font-bold text-blue-600">{bankTxnCount}</p>
                </div>
            </div>

            {/* Source Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                    onClick={() => setSourceFilter('all')}
                    className={`px-4 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors ${
                        sourceFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                    All ({payments.length})
                </button>
                <button
                    onClick={() => setSourceFilter('manual')}
                    className={`px-4 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors ${
                        sourceFilter === 'manual' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                    Manual ({payments.filter(p => p.source === 'manual').length})
                </button>
                <button
                    onClick={() => setSourceFilter('banking')}
                    className={`px-4 py-2 rounded-md font-medium text-sm whitespace-nowrap transition-colors ${
                        sourceFilter === 'banking' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}
                >
                    From Banking ({bankTxnCount})
                </button>
            </div>

            {/* Table - Horizontal scroll on mobile */}
            <div className="bg-white rounded-md shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Type</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Party / Description</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Amount</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Category</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Mode</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-gray-500">
                                        No payments found
                                    </td>
                                </tr>
                            ) : (
                                filteredPayments.map((payment) => (
                                    <tr key={`${payment.source}-${payment.id}`} className="hover:bg-gray-50">
                                        <td className="p-3 md:p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`flex items-center gap-1.5 text-xs md:text-sm font-medium ${payment.type === 'received' ? 'text-gray-900' : 'text-red-600'}`}>
                                                    {payment.type === 'received' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                                    {payment.type === 'received' ? 'Received' : 'Paid'}
                                                </span>
                                                {payment.source === 'banking' && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium w-fit">
                                                        <Building2 size={10} /> Banking
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 md:p-4">
                                            {payment.source === 'banking' ? (
                                                <div>
                                                    <div className="font-medium text-xs md:text-sm text-gray-900 line-clamp-1" title={payment.description}>
                                                        {payment.description}
                                                    </div>
                                                    {payment.bank_account_name && (
                                                        <div className="text-xs text-gray-400 truncate">{payment.bank_account_name}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="font-medium text-xs md:text-sm">
                                                        {payment.type === 'received'
                                                            ? (payment.client_company || payment.client_name)
                                                            : (payment.vendor_company || payment.vendor_name)}
                                                    </div>
                                                    {payment.type === 'received'
                                                        ? (payment.client_company && <div className="text-xs text-gray-500 truncate max-w-[150px]">{payment.client_name}</div>)
                                                        : (payment.vendor_company && <div className="text-xs text-gray-500 truncate max-w-[150px]">{payment.vendor_name}</div>)
                                                    }
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 md:p-4 font-bold text-xs md:text-sm">₹{payment.amount?.toLocaleString('en-IN')}</td>
                                        <td className="p-3 md:p-4">
                                            {payment.category_name ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                                                    <Tag size={10} /> {payment.category_name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 md:p-4 capitalize text-xs md:text-sm">{payment.payment_mode?.replace('_', ' ')}</td>
                                        <td className="p-3 md:p-4 text-xs md:text-sm">{new Date(payment.payment_date).toLocaleDateString('en-IN')}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-md w-full max-w-md p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-page-title">Record Payment</h2>
                            <button onClick={() => { setShowModal(false); setAccountId(''); setPaymentMethod('cash'); }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block mb-2 font-medium">Type</label>
                                <select
                                    name="type"
                                    value={paymentType}
                                    onChange={(e) => setPaymentType(e.target.value as 'received' | 'paid')}
                                    required
                                    className="w-full border rounded p-2"
                                >
                                    <option value="received">Received (from client)</option>
                                    <option value="paid">Paid (to vendor)</option>
                                </select>
                            </div>

                            {paymentType === 'received' ? (
                                <div>
                                    <label className="block mb-2 font-medium">Client</label>
                                    <select name="client_id" required className="w-full border rounded p-2">
                                        <option value="">Select client...</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} - {c.company}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="block mb-2 font-medium">Vendor</label>
                                    <select name="vendor_id" required className="w-full border rounded p-2">
                                        <option value="">Select vendor...</option>
                                        {vendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name} - {v.company}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block mb-2 font-medium">Amount (₹)</label>
                                <input
                                    type="number"
                                    name="amount"
                                    required
                                    min="1"
                                    step="0.01"
                                    className="w-full border rounded p-2"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Pay From / Pay To — single dropdown listing every account (cash + bank) */}
                            <div>
                                <label className="block mb-2 font-medium">
                                    {paymentType === 'received' ? 'Deposit To' : 'Pay From'}
                                </label>
                                <select
                                    value={accountId}
                                    onChange={(e) => handleAccountChange(e.target.value)}
                                    required
                                    className="w-full border rounded p-2"
                                >
                                    <option value="">Select account...</option>
                                    {cashAccounts.length > 0 && (
                                        <optgroup label="Cash">
                                            {cashAccounts.map((acc: any) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name} (₹{(acc.current_balance || 0).toLocaleString('en-IN')})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {bankAccounts.length > 0 && (
                                        <optgroup label="Bank">
                                            {bankAccounts.map((acc: any) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name} (₹{(acc.current_balance || 0).toLocaleString('en-IN')})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Pick the cash or bank account — the payment method is set automatically.
                                </p>
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">Date</label>
                                <input
                                    type="date"
                                    name="payment_date"
                                    required
                                    className="w-full border rounded p-2"
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">Reference / Note</label>
                                <input
                                    type="text"
                                    name="reference"
                                    className="w-full border rounded p-2"
                                    placeholder="Optional"
                                />
                            </div>

                            <input type="hidden" name="notes" value="" />

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setAccountId(''); setPaymentMethod('cash'); }}
                                    className="flex-1 border rounded p-2"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-black text-white rounded p-2 disabled:bg-gray-400"
                                >
                                    {submitting ? 'Saving...' : 'Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
