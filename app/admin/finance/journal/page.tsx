'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Type for a Journal Line Item
type JournalLine = {
    id: string;
    account: string;  // e.g. "Bank", "Cash", "Sales", "Expense"
    description: string;
    debit: number;
    credit: number;
};

export default function ManualJournalPage() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [lines, setLines] = useState<JournalLine[]>([
        { id: '1', account: '', description: '', debit: 0, credit: 0 },
        { id: '2', account: '', description: '', debit: 0, credit: 0 }
    ]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Suggested Accounts
    const accounts = [
        'Cash on Hand', 'HDFC Bank', 'Accounts Receivable', 'Accounts Payable',
        'Sales Revenue', 'Office Expenses', 'Salaries', 'Rent', 'Electricity',
        'Owner Equity', 'Opening Balance Adjustment'
    ];

    const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const addLine = () => {
        setLines([...lines, { id: Date.now().toString(), account: '', description: '', debit: 0, credit: 0 }]);
    };

    const removeLine = (id: string) => {
        if (lines.length <= 2) return;
        setLines(lines.filter(l => l.id !== id));
    };

    const updateLine = (id: string, field: keyof JournalLine, value: any) => {
        setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const handleSave = async () => {
        if (!isBalanced) return setError('Journal Entry is not balanced. Debits must equal Credits.');
        if (!date) return setError('Date is required.');

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // 1. Create Journal Header
            const { data: header, error: headerError } = await supabase
                .from('journal_entries')
                .insert([{
                    date,
                    reference,
                    notes,
                    total_amount: totalDebit,
                    created_by: 'admin' // Should use auth user
                }])
                .select()
                .single();

            if (headerError) throw headerError;

            // 2. Create Journal Lines
            const { error: linesError } = await supabase
                .from('journal_lines')
                .insert(lines.map(l => ({
                    journal_id: header.id,
                    account: l.account,
                    description: l.description,
                    debit: l.debit,
                    credit: l.credit
                })));

            if (linesError) throw linesError;

            setSuccess(true);
            // Reset form
            setNotes('');
            setReference('');
            setLines([
                { id: Date.now().toString(), account: '', description: '', debit: 0, credit: 0 },
                { id: (Date.now() + 1).toString(), account: '', description: '', debit: 0, credit: 0 }
            ]);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save Journal Entry');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-3 md:space-y-6 px-2 animate-fade-in px-2 pb-16 md:pb-20">
            {/* Header */}
            <div className="flex items-center gap-2 md:gap-4">
                <Link href="/admin/reports" className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                    <ArrowLeft />
                </Link>
                <div>
                    <h1 className="text-page-title text-gray-900">Manual Journal Entry</h1>
                    <p className="text-gray-500">General Ledger Adjustments</p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Top Info */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 border-b bg-gray-50">
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Reference #</label>
                        <input
                            type="text"
                            placeholder="e.g. ADJ-001"
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Notes</label>
                        <input
                            type="text"
                            placeholder="Reason for adjustment..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg p-2"
                        />
                    </div>
                </div>

                {/* Lines */}
                <div className="p-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 border-b">
                                <th className="pb-3 pl-2 w-1/3">Account</th>
                                <th className="pb-3 w-1/3">Description</th>
                                <th className="pb-3 text-right">Debit</th>
                                <th className="pb-3 text-right">Credit</th>
                                <th className="pb-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {lines.map((line, index) => (
                                <tr key={line.id} className="group">
                                    <td className="py-2 pr-2">
                                        <input
                                            list="accounts"
                                            className="w-full p-2 border rounded hover:border-oms-blue-400 focus:border-oms-blue focus:ring-1 focus:ring-oms-blue outline-none transition-colors"
                                            placeholder="Select Account"
                                            value={line.account}
                                            onChange={e => updateLine(line.id, 'account', e.target.value)}
                                        />
                                    </td>
                                    <td className="py-2 pr-2">
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded hover:border-gray-400 outline-none"
                                            placeholder="Line description"
                                            value={line.description}
                                            onChange={e => updateLine(line.id, 'description', e.target.value)}
                                        />
                                    </td>
                                    <td className="py-2 pr-2">
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded text-right hover:border-gray-400 outline-none"
                                            placeholder="0.00"
                                            value={line.debit || ''}
                                            onChange={e => {
                                                updateLine(line.id, 'debit', parseFloat(e.target.value) || 0);
                                                updateLine(line.id, 'credit', 0); // Clear credit if debit entered
                                            }}
                                        />
                                    </td>
                                    <td className="py-2 pr-2">
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded text-right hover:border-gray-400 outline-none"
                                            placeholder="0.00"
                                            value={line.credit || ''}
                                            onChange={e => {
                                                updateLine(line.id, 'credit', parseFloat(e.target.value) || 0);
                                                updateLine(line.id, 'debit', 0); // Clear debit if credit entered
                                            }}
                                        />
                                    </td>
                                    <td className="py-2 text-center">
                                        <button onClick={() => removeLine(line.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button onClick={addLine} className="mt-4 flex items-center gap-2 text-sm text-oms-blue font-medium hover:text-indigo-800">
                        <Plus size={16} /> Add Line
                    </button>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 border-t flex justify-end items-center gap-8">
                    <div className="text-right">
                        <p className="text-gray-500 text-xs uppercase font-bold">Total Debit</p>
                        <p className="text-xl font-mono text-gray-900">{totalDebit.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-500 text-xs uppercase font-bold">Total Credit</p>
                        <p className="text-xl font-mono text-gray-900">{totalCredit.toFixed(2)}</p>
                    </div>
                    <div className={`text-right px-4 py-2 rounded-lg border ${isBalanced ? 'bg-white border-green-100 text-gray-900' : 'bg-red-50 border-red-100 text-red-700'}`}>
                        <p className="text-xs uppercase font-bold">Difference</p>
                        <p className="text-xl font-mono">{Math.abs(totalDebit - totalCredit).toFixed(2)}</p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!isBalanced || loading}
                        className={`ml-4 px-4 py-2 rounded-xl font-bold text-white flex items-center gap-2 ${isBalanced ? 'bg-oms-blue hover:bg-oms-blue -200' : 'bg-gray-300 cursor-not-allowed'
                            }`}
                    >
                        {loading ? 'Saving...' : <><Save size={18} /> Save Journal</>}
                    </button>
                </div>
            </div>

            <datalist id="accounts">
                {accounts.map(a => <option key={a} value={a} />)}
            </datalist>

            {/* Success / Error Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex gap-3 items-start">
                    <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-bold">Error Saving Journal</h3>
                        <p className="text-sm mt-1">{error}</p>
                        {error.includes('relation "journal_entries" does not exist') && (
                            <div className="mt-3 bg-white p-3 rounded border border-red-100 text-xs font-mono overflow-auto">
                                <p className="text-gray-500 mb-1">Run this SQL in Supabase SQL Editor to create tables:</p>
                                <code className="text-gray-700">
                                    CREATE TABLE journal_entries (<br />
                                    &nbsp;&nbsp;id uuid DEFAULT gen_random_uuid() PRIMARY KEY,<br />
                                    &nbsp;&nbsp;date date NOT NULL,<br />
                                    &nbsp;&nbsp;reference text,<br />
                                    &nbsp;&nbsp;notes text,<br />
                                    &nbsp;&nbsp;total_amount numeric,<br />
                                    &nbsp;&nbsp;created_by text,<br />
                                    &nbsp;&nbsp;created_at timestamptz DEFAULT now()<br />
                                    );<br /><br />
                                    CREATE TABLE journal_lines (<br />
                                    &nbsp;&nbsp;id uuid DEFAULT gen_random_uuid() PRIMARY KEY,<br />
                                    &nbsp;&nbsp;journal_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE,<br />
                                    &nbsp;&nbsp;account text NOT NULL,<br />
                                    &nbsp;&nbsp;description text,<br />
                                    &nbsp;&nbsp;debit numeric DEFAULT 0,<br />
                                    &nbsp;&nbsp;credit numeric DEFAULT 0<br />
                                    );
                                </code>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {success && (
                <div className="bg-white border border-green-200 text-gray-900 p-4 rounded-xl">
                    <h3 className="font-bold">Success!</h3>
                    <p>Journal Entry saved successfully.</p>
                </div>
            )}

        </div>
    );
}
