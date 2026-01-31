'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Loader2, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function PaymentsPageNew() {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);

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
        setClients(clientsData || []);
        setVendors(vendorsData || []);
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

        try {
            if (type === 'received') {
                const { error } = await supabase.rpc('record_payment_received', {
                    p_client_id: formData.get('client_id'),
                    p_amount: amount,
                    p_payment_mode: formData.get('payment_mode') || 'cash',
                    p_payment_date: formData.get('payment_date') || new Date().toISOString().split('T')[0],
                    p_bank_account_id: null,
                    p_reference: formData.get('reference') as string,
                    p_notes: formData.get('notes') as string,
                    p_invoice_id: null,
                    p_attachment_url: null
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('record_vendor_payment', {
                    p_vendor_id: formData.get('vendor_id'),
                    p_amount: amount,
                    p_payment_mode: formData.get('payment_mode') || 'cash',
                    p_payment_date: formData.get('payment_date') || new Date().toISOString().split('T')[0],
                    p_bank_account_id: null,
                    p_reference: formData.get('reference') as string,
                    p_notes: formData.get('notes') as string,
                    p_purchase_bill_id: null,
                    p_attachment_url: null
                });
                if (error) throw error;
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
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-3 md:mb-6">
                <div>
                    <h1 className="text-page-title">Payments (New)</h1>
                    <p className="text-gray-500">{payments.length} transactions</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                >
                    <Plus size={20} />
                    Record Payment
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
                    Error: {error}
                </div>
            )}

            <div className="bg-white rounded-lg shadow">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-4">Type</th>
                            <th className="text-left p-4">Party</th>
                            <th className="text-left p-4">Amount</th>
                            <th className="text-left p-4">Mode</th>
                            <th className="text-left p-4">Date</th>
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
                                    <td className="p-4">
                                        <span className={`flex items-center gap-2 ${payment.type === 'received' ? 'text-gray-900' : 'text-red-600'}`}>
                                            {payment.type === 'received' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                                            {payment.type === 'received' ? 'Received' : 'Paid'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div>
                                            <div className="font-medium">{payment.type === 'received' ? payment.client_name : payment.vendor_name}</div>
                                            <div className="text-sm text-gray-500">{payment.type === 'received' ? payment.client_company : payment.vendor_company}</div>
                                        </div>
                                    </td>
                                    <td className="p-4 font-bold">₹{payment.amount?.toLocaleString('en-IN')}</td>
                                    <td className="p-4 capitalize">{payment.payment_mode?.replace('_', ' ')}</td>
                                    <td className="p-4">{new Date(payment.payment_date).toLocaleDateString('en-IN')}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-page-title">Record Payment</h2>
                            <button onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block mb-2 font-medium">Type</label>
                                <select name="type" required className="w-full border rounded p-2" defaultValue="received">
                                    <option value="received">Received (from client)</option>
                                    <option value="paid">Paid (to vendor)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">Client</label>
                                <select name="client_id" required className="w-full border rounded p-2">
                                    <option value="">Select client...</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} - {c.company}</option>
                                    ))}
                                </select>
                            </div>

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
                                <select name="payment_mode" className="w-full border rounded p-2" defaultValue="cash">
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="upi">UPI</option>
                                    <option value="cheque">Cheque</option>
                                </select>
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
