'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Loader2, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { logActivity } from '@/lib/logger';

export default function PaymentsPageNew() {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [paymentType, setPaymentType] = useState<'received' | 'paid'>('received');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [clients, setClients] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);

    // Fetch payments
    const fetchPayments = async () => {
        try {
            setLoading(true);
            const { data: received, error: recError } = await supabase.rpc('get_all_payments_received');
            const { data: paid, error: paidError } = await supabase.rpc('get_all_vendor_payments');

            if (recError) throw recError;
            if (paidError) throw paidError;

            const allPayments = [
                ...(received || []).map((p: any) => ({ ...p, type: 'received' })),
                ...(paid || []).map((p: any) => ({ ...p, type: 'paid' }))
            ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

            setPayments(allPayments);
            setError(null);
        } catch (err: any) {
            setError(err.message);
            console.error('Fetch error:', err);
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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const type = formData.get('type') as string;
        const amount = parseFloat(formData.get('amount') as string);
        const payMode = formData.get('payment_mode') as string;
        const accountId = formData.get('account_id') as string;

        try {
            if (type === 'received') {
                const clientId = formData.get('client_id') as string;
                const { error } = await supabase.rpc('record_payment_received', {
                    p_client_id: clientId,
                    p_amount: amount,
                    p_payment_mode: payMode,
                    p_payment_date: formData.get('payment_date') || new Date().toISOString().split('T')[0],
                    p_bank_account_id: payMode === 'cash' ? null : accountId,
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
            alert('Payment recorded successfully!');
        } catch (err: any) {
            alert('Error: ' + err.message);
            console.error('Submit error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin" size={32} />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-4 max-w-7xl mx-auto">
            {/* Header - Stack on mobile */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-1.5">
                <div>
                    <h1 className="text-xl md:text-page-title">Payments (New)</h1>
                    <p className="text-sm text-gray-500">{payments.length} transactions</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl hover:bg-blue-600 w-full sm:w-auto justify-center text-sm font-medium"
                >
                    <Plus size={18} />
                    Record Payment
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
                    Error: {error}
                </div>
            )}

            {/* Table - Horizontal scroll on mobile */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Type</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Party</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Amount</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Mode</th>
                                <th className="text-left p-3 md:p-4 text-xs md:text-sm font-semibold text-gray-700">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {payments.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center p-8 text-gray-500">
                                        No payments found
                                    </td>
                                </tr>
                            ) : (
                                payments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50">
                                        <td className="p-3 md:p-4">
                                            <span className={`flex items-center gap-1.5 md:gap-2 text-xs md:text-sm ${payment.type === 'received' ? 'text-gray-900' : 'text-red-600'}`}>
                                                {payment.type === 'received' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                                {payment.type === 'received' ? 'Received' : 'Paid'}
                                            </span>
                                        </td>
                                        <td className="p-3 md:p-4">
                                            <div>
                                                <div className="font-medium text-xs md:text-sm">{payment.type === 'received' ? payment.client_name : payment.vendor_name}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-[150px]">{payment.type === 'received' ? payment.client_company : payment.vendor_company}</div>
                                            </div>
                                        </td>
                                        <td className="p-3 md:p-4 font-bold text-xs md:text-sm">₹{payment.amount?.toLocaleString('en-IN')}</td>
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
                    <div className="bg-white rounded-lg w-full max-w-md p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-page-title">Record Payment</h2>
                            <button onClick={() => setShowModal(false)}>
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

                            <div>
                                <label className="block mb-2 font-medium">Payment Method</label>
                                <select
                                    name="payment_mode"
                                    className="w-full border rounded p-2"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="upi">UPI</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>

                            {/* Account Selection */}
                            <div>
                                <label className="block mb-2 font-medium">
                                    {paymentMethod === 'cash' ? 'Cash Account' : 'Bank Account'}
                                </label>
                                {paymentMethod === 'cash' ? (
                                    <select name="account_id" required className="w-full border rounded p-2">
                                        <option value="">Select cash account...</option>
                                        {cashAccounts.map((acc: any) => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} - ₹{acc.current_balance?.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <select name="account_id" required className="w-full border rounded p-2">
                                        <option value="">Select bank account...</option>
                                        {bankAccounts.map((acc: any) => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} ({acc.account_number}) - ₹{acc.current_balance?.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    Current balance shown
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

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
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
