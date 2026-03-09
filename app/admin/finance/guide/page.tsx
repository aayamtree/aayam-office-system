'use client';

import { useState } from 'react';
import {
    IndianRupee, Clock, FileText, CreditCard, Building2, BarChart3,
    ChevronDown, ChevronRight, ArrowRight, AlertCircle, Target, Landmark, Receipt
} from 'lucide-react';

interface Step { label: string; path?: string; detail?: string; }
interface Phase {
    id: string; icon: React.ReactNode; title: string; subtitle: string;
    color: string; bg: string; border: string; headerBg: string;
    steps: Step[]; tip?: string;
}

const phases: Phase[] = [
    {
        id: 'daily',
        icon: <Clock className="w-5 h-5" />,
        title: '1. Daily Routine',
        subtitle: 'What to check every morning',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'Check pending payments from clients', path: 'Finance → Payments → Pending tab', detail: 'Jobs with outstanding balance > 0' },
            { label: 'Check vendor bills due today', path: 'Finance → Vendors → Bills → Due Today', detail: 'Vendor invoices that need payment today' },
            { label: 'Review daily cash position', path: 'Finance → Daily', detail: 'Opening balance for today across accounts' },
            { label: 'Record yesterday\'s pending entries', path: 'Finance → Daily → Add Entry', detail: 'Never leave entries pending for more than 1 day' },
        ],
        tip: 'Always record transactions on the SAME DAY. Delayed entries cause reconciliation errors.',
    },
    {
        id: 'payment',
        icon: <CreditCard className="w-5 h-5" />,
        title: '2. Recording Client Payment',
        subtitle: 'Client pays → record immediately',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Open Finance → Payments → New Payment', path: 'Finance → Payments → + New Payment', detail: '' },
            { label: 'Select the job', path: 'Payment Form → Select Job', detail: 'Links payment to the correct job' },
            { label: 'Enter amount received', path: 'Amount field', detail: 'Can be partial or full payment' },
            { label: 'Select payment mode', path: 'Mode: Cash / Bank Transfer / UPI / Cheque', detail: 'Pick the actual method client used' },
            { label: 'Select bank account received into', path: 'Account field', detail: 'Cash, HDFC Current, etc.' },
            { label: 'Save', path: 'Save button', detail: 'Job outstanding balance auto-updates. Commission auto-triggers if fully paid.' },
        ],
        tip: 'When amount received = job total, commission status auto-changes to Eligible for the marketing person.',
    },
    {
        id: 'invoice',
        icon: <Receipt className="w-5 h-5" />,
        title: '3. Creating Invoices',
        subtitle: 'Generate GST invoice for clients',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'Open Finance → Invoices → New Invoice', path: 'Finance → Invoices → + New Invoice', detail: '' },
            { label: 'Select client and linked job', path: 'Invoice Form → Client, Job', detail: 'Line items auto-populate from job' },
            { label: 'Set GST %', path: 'GST field → 5% / 12% / 18% / 28%', detail: 'Depends on product type' },
            { label: 'Review and save', path: 'Save → Download PDF', detail: 'PDF ready to share with client' },
        ],
    },
    {
        id: 'vendor',
        icon: <Building2 className="w-5 h-5" />,
        title: '4. Vendor Bills & Purchases',
        subtitle: 'Record what we buy or owe vendors',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Open Finance → Vendors → [Vendor Name]', path: 'Finance → Vendors → [Name]', detail: '' },
            { label: 'Add a purchase / bill', path: 'Vendor page → Add Purchase', detail: 'Paper, print, services etc. bought from them' },
            { label: 'Record payment to vendor', path: 'Vendor page → Pay Bill', detail: 'Mark which bills you\'re paying today' },
            { label: 'View vendor ledger', path: 'Vendor page → Ledger tab', detail: 'Full transaction history with this vendor' },
        ],
        tip: 'Record vendor bills WHEN you receive them, not when you pay. This shows accurate payables.',
    },
    {
        id: 'daily_entry',
        icon: <Landmark className="w-5 h-5" />,
        title: '5. Daily Cash & Expense Entries',
        subtitle: 'Petty cash, small expenses, office costs',
        color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-700',
        steps: [
            { label: 'Open Finance → Daily', path: 'Finance → Daily', detail: 'Today\'s cash book automatically opens' },
            { label: 'Add expense entry', path: 'Add Entry → Expense → Category, Amount, Note', detail: 'Tea, courier, stationery, etc.' },
            { label: 'Add transfer between accounts', path: 'Add Entry → Transfer', detail: 'Example: Cash to bank, or bank to cash for petty cash' },
            { label: 'Confirm closing balance', path: 'Daily screen → Closing balance', detail: 'Must match physical cash on hand' },
        ],
    },
    {
        id: 'banking',
        icon: <Landmark className="w-5 h-5" />,
        title: '6. Banking & Reconciliation',
        subtitle: 'Match app with actual bank statement',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'Download monthly bank statement', path: '—', detail: 'From your bank\'s net banking portal' },
            { label: 'Open Banking module', path: 'Finance → Banking', detail: 'See app\'s recorded balance for each account' },
            { label: 'Compare against bank statement', path: '—', detail: 'Any mismatch = missing or duplicate entry in app' },
            { label: 'Fix discrepancies', path: 'Finance → Daily → Add missing entry', detail: 'Add any transaction found in bank but not in app' },
        ],
        tip: 'Reconcile weekly or monthly. The longer you wait, the harder it gets.',
    },
    {
        id: 'reports',
        icon: <BarChart3 className="w-5 h-5" />,
        title: '7. Reports',
        subtitle: 'View financial performance & summaries',
        color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', headerBg: 'bg-slate-700',
        steps: [
            { label: 'Finance overview', path: 'Finance → Overview', detail: 'Revenue this month, expenses, outstanding, cashbook' },
            { label: 'Client outstanding report', path: 'Finance → Reports → Client Outstanding', detail: 'Who owes us money and how much' },
            { label: 'Vendor payment report', path: 'Finance → Reports → Vendor Reports', detail: 'What we owe vendors' },
            { label: 'P&L summary', path: 'Finance → Reports → P&L', detail: 'Revenue vs expenses — profit for the period' },
        ],
    },
];

const flowItems = [
    { label: 'Job Done', color: 'bg-gray-700' },
    { label: 'Invoice Created', color: 'bg-indigo-500' },
    { label: 'Payment Received', color: 'bg-blue-600' },
    { label: 'Outstanding = 0', color: 'bg-green-600' },
    { label: '💰 Commission Auto', color: 'bg-yellow-600' },
];

export default function FinanceGuidePage() {
    const [openPhase, setOpenPhase] = useState<string | null>('daily');
    return (
        <div className="space-y-5 max-w-3xl pb-16">
            <div className="bg-green-700 rounded-md p-5 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-300 rounded-md flex items-center justify-center">
                        <IndianRupee className="w-5 h-5 text-green-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Finance — How to Use This App</h1>
                        <p className="text-green-200 text-sm">Payments, invoices, vendors, daily cash, reports</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Finance Flow</p>
                <div className="flex flex-wrap items-center gap-1">
                    {flowItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-1">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold text-white ${item.color}`}>{item.label}</span>
                            {i < flowItems.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {[
                    { icon: '📅', text: 'Record entries on the same day — never delay.' },
                    { icon: '🔗', text: 'Always link payments to the correct job.' },
                    { icon: '🏦', text: 'Reconcile bank weekly to catch errors early.' },
                    { icon: '📄', text: 'Create invoice before requesting payment.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-md text-xs text-green-900">
                        <span className="text-base">{r.icon}</span><span>{r.text}</span>
                    </div>
                ))}
            </div>

            <div className="space-y-2">
                {phases.map((phase) => {
                    const isOpen = openPhase === phase.id;
                    return (
                        <div key={phase.id} className={`rounded-md border overflow-hidden ${phase.border}`}>
                            <button onClick={() => setOpenPhase(isOpen ? null : phase.id)}
                                className={`w-full flex items-center justify-between px-4 py-3 text-left ${isOpen ? phase.headerBg + ' text-white' : phase.bg + ' ' + phase.color} transition-colors`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${isOpen ? 'bg-white/15' : 'bg-white/60'}`}>{phase.icon}</div>
                                    <div>
                                        <p className="font-bold text-sm">{phase.title}</p>
                                        <p className={`text-xs ${isOpen ? 'text-white/70' : 'opacity-60'}`}>{phase.subtitle}</p>
                                    </div>
                                </div>
                                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {isOpen && (
                                <div className="p-4 space-y-3 bg-white border-t border-gray-100">
                                    {phase.steps.map((step, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5 ${phase.headerBg}`}>{i + 1}</div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                                                {step.path && <p className="text-xs font-mono text-gray-500 mt-0.5 flex items-center gap-1"><ArrowRight className="w-3 h-3 text-gray-400" />{step.path}</p>}
                                                {step.detail && <p className="text-xs text-gray-400 mt-0.5 italic">{step.detail}</p>}
                                            </div>
                                        </div>
                                    ))}
                                    {phase.tip && (
                                        <div className={`mt-3 flex items-start gap-2 p-3 rounded-md ${phase.bg} ${phase.border} border`}>
                                            <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${phase.color}`} />
                                            <p className={`text-xs font-medium ${phase.color}`}>{phase.tip}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
