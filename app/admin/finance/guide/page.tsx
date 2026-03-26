'use client';

import { useState } from 'react';
import {
    IndianRupee, Clock, FileText, CreditCard, Building2, BarChart3,
    ChevronDown, ChevronRight, ArrowRight, AlertCircle, Landmark,
    Receipt, UserCheck, Target
} from 'lucide-react';

interface Step { label: string; path?: string; detail?: string; }
interface Phase {
    id: string; icon: React.ReactNode; title: string; subtitle: string;
    color: string; bg: string; border: string; headerBg: string;
    steps: Step[]; tip?: string;
}

const phases: Phase[] = [
    {
        id: 'attendance',
        icon: <UserCheck className="w-5 h-5" />,
        title: '1. Attendance — Roz Login aur Logout Zaroori',
        subtitle: 'Office start hote hi yeh pehle karo',
        color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', headerBg: 'bg-emerald-700',
        steps: [
            { label: 'Office aate hi Login karo', path: 'Sidebar → Attendance → Login', detail: 'Time record hona shuru ho jaata hai. Bina login ke tumhara din count nahi hoga.' },
            { label: 'Din bhar kaam karte raho — automatic track hota hai', path: '—', detail: 'Kuch extra nahi karna' },
            { label: 'Shaam ko Logout karo', path: 'Sidebar → Attendance → Logout', detail: 'EOD ke saath saath logout bhi karo' },
        ],
        tip: 'Logout karna mat bhoolna — warna tumhara poora time record galat ho jaayega.',
    },
    {
        id: 'daily',
        icon: <Clock className="w-5 h-5" />,
        title: '2. Subah Ka Routine — Roz Yeh Check Karo',
        subtitle: 'Din shuru karne se pehle in 4 cheezein ka hisaab lagao',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'Clients ka pending payment check karo', path: 'Finance → Payments → Pending tab', detail: 'Jinke jobs ka outstanding balance > 0 hai — kab milega paisa?' },
            { label: 'Aaj ke vendor bills check karo', path: 'Finance → Vendors → Bills → Due Today', detail: 'Aaj kaunse vendor ko paisa dena hai' },
            { label: 'Cash position dekho', path: 'Finance → Daily', detail: 'Aaj subah ka opening balance — kitna cash hai, kitna bank mein' },
            { label: 'Kal ki pending entries record karo', path: 'Finance → Daily → Add Entry', detail: 'Koi bhi entry 1 din se zyada pending mat rakho' },
        ],
        tip: 'Same day mein transaction record karo — ek din bhi delay karo toh reconciliation mein bahut gadbad ho jaati hai.',
    },
    {
        id: 'payment',
        icon: <CreditCard className="w-5 h-5" />,
        title: '3. Client Payment Record Karna',
        subtitle: 'Client ne paisa diya — foran app mein daalo',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'New Payment kholo', path: 'Finance → Payments → + New Payment', detail: '' },
            { label: 'Job select karo', path: 'Payment Form → Select Job', detail: 'Payment sahi job se link honi chahiye' },
            { label: 'Amount enter karo', path: 'Amount field', detail: 'Partial ya full — jo bhi mila' },
            { label: 'Payment mode select karo', path: 'Mode: Cash / Bank Transfer / UPI / Cheque', detail: 'Client ne jis method se diya — wahi lagao' },
            { label: 'Kaunse account mein aaya select karo', path: 'Account field', detail: 'Cash, HDFC Current, ya jo bhi account' },
            { label: 'Save karo', path: 'Save button', detail: 'Job ka outstanding automatically update ho jaata hai. Full payment pe commission auto-trigger hota hai.' },
        ],
        tip: 'Jab amount received = job total, marketing person ka commission status automatic "Eligible" ho jaata hai. Kuch alag karna nahi padta.',
    },
    {
        id: 'invoice',
        icon: <Receipt className="w-5 h-5" />,
        title: '4. Invoice Banana',
        subtitle: 'Client ke liye GST invoice generate karo',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'New Invoice kholo', path: 'Finance → Invoices → + New Invoice', detail: '' },
            { label: 'Client aur linked job select karo', path: 'Invoice Form → Client, Job', detail: 'Line items automatically job se aa jaate hain' },
            { label: 'GST % set karo', path: 'GST field → 5% / 12% / 18% / 28%', detail: 'Product type ke hisaab se — confirm karo agar doubt ho' },
            { label: 'Review karo aur save karo', path: 'Save → Download PDF', detail: 'PDF ready ho jaata hai client ko bhejne ke liye' },
        ],
        tip: 'Invoice pehle banao, phir payment request karo. Invoice number important hai GST filing ke liye.',
    },
    {
        id: 'vendor',
        icon: <Building2 className="w-5 h-5" />,
        title: '5. Vendor Bills aur Purchases',
        subtitle: 'Humne jo kharida ya jinhe dena hai — record karo',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Vendor page kholo', path: 'Finance → Vendors → [Vendor Name]', detail: '' },
            { label: 'Purchase / bill add karo', path: 'Vendor page → Add Purchase', detail: 'Paper, print, services — jo bhi unse liya' },
            { label: 'Vendor ko payment record karo', path: 'Vendor page → Pay Bill', detail: 'Aaj kaunse bills pay kar rahe ho — mark karo' },
            { label: 'Vendor ledger dekho', path: 'Vendor page → Ledger tab', detail: 'Us vendor ke saath poori transaction history' },
        ],
        tip: 'Bill milte hi record karo — payment karne ke time nahi. Isse accurate payables dikhega aur missing bill ka pata chalega.',
    },
    {
        id: 'daily_entry',
        icon: <Landmark className="w-5 h-5" />,
        title: '6. Daily Cash aur Petty Expenses',
        subtitle: 'Chhote kharche — roz record karo',
        color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-700',
        steps: [
            { label: 'Finance → Daily kholo', path: 'Finance → Daily', detail: 'Aaj ka cashbook automatically khulta hai' },
            { label: 'Expense entry add karo', path: 'Add Entry → Expense → Category, Amount, Note', detail: 'Chai, courier, stationery, petrol — sab kuch yahan' },
            { label: 'Account transfer add karo', path: 'Add Entry → Transfer', detail: 'Cash se bank mein, ya bank se cash petty expenses ke liye' },
            { label: 'Closing balance confirm karo', path: 'Daily screen → Closing balance', detail: 'App ka balance aur haath mein cash barabar hona chahiye' },
        ],
    },
    {
        id: 'accounts',
        icon: <Receipt className="w-5 h-5" />,
        title: '7. Bank Accounts aur Ledger',
        subtitle: 'Har account ki poori history dekho',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'Accounts list kholo', path: 'Finance → Accounts', detail: 'Cash, HDFC Current — sab accounts running balance ke saath' },
            { label: 'Account statement kholo', path: 'Finance → Accounts → [Account name] → Statement', detail: 'Us account ki poori ledger — har debit credit entry' },
            { label: 'Naya bank account add karo', path: 'Finance → Accounts → Add Account', detail: 'Koi bhi transaction record karne se pehle account banana zaroori hai' },
            { label: 'Daily Summary dekho (admin only)', path: 'Finance → Daily Summary', detail: 'Kisi bhi date ke sab accounts ka balance ek jagah' },
        ],
        tip: 'Pehle accounts add karo — phir payments aur expenses record karo. Sequence mat todna.',
    },
    {
        id: 'banking',
        icon: <Landmark className="w-5 h-5" />,
        title: '8. Bank Reconciliation — Monthly Must',
        subtitle: 'App ka balance aur bank statement match karo',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'Bank se monthly statement download karo', path: '—', detail: 'Net banking se PDF download karo' },
            { label: 'Banking module kholo', path: 'Finance → Banking', detail: 'App mein har account ka recorded balance dekho' },
            { label: 'Bank statement se compare karo', path: '—', detail: 'Koi difference = app mein missing ya duplicate entry hai' },
            { label: 'Discrepancies fix karo', path: 'Finance → Daily → Add missing entry', detail: 'Jo bank mein hai but app mein nahi — woh add karo' },
        ],
        tip: 'Weekly ya monthly reconcile karo. Jitna late karoge utna mushkil hoga. Bank statement jhooth nahi bolta.',
    },
    {
        id: 'reports',
        icon: <BarChart3 className="w-5 h-5" />,
        title: '9. Reports — Performance aur Summary',
        subtitle: 'Finance ka poora picture ek jagah',
        color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', headerBg: 'bg-slate-700',
        steps: [
            { label: 'Finance overview dekho', path: 'Finance → Overview', detail: 'Is month ka revenue, expenses, outstanding, cashbook' },
            { label: 'Client outstanding report', path: 'Finance → Reports → Client Outstanding', detail: 'Kaunsa client kitna paisa dena hai humein' },
            { label: 'Vendor payment report', path: 'Finance → Reports → Vendor Reports', detail: 'Hum kaunse vendor ko kitna dena hai' },
            { label: 'P&L summary', path: 'Finance → Reports → P&L', detail: 'Revenue vs expenses — kitna profit hua' },
            { label: 'Cashbook', path: 'Finance → Reports → Cashbook', detail: 'Poori cash movement by date' },
        ],
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '10. EOD Report — Roz Bharna Compulsory',
        subtitle: 'Jaane se pehle EOD submit karo aur logout karo',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'EOD Report kholo', path: 'EOD Report → Submit Report', detail: 'Din mein ek baar — khatam karne se pehle' },
            { label: 'Aaj ki entries list karo', path: 'What did you do today?', detail: 'Payments received, invoices made, vendor bills recorded, reconciliation done' },
            { label: 'Koi pending ho toh batao', path: 'Pending / Blockers section', detail: 'Client ka payment pending? Vendor ka bill unclear? Note karo.' },
            { label: 'Submit karo', path: 'Submit EOD button', detail: 'Admin dekhta hai' },
        ],
        tip: 'Finance ka EOD admin ke liye bahut important hai — isse pata chalta hai aaj ka cash position aur kya pending hai.',
    },
];

const flowItems = [
    { label: 'Login ✓', color: 'bg-emerald-600' },
    { label: 'Job Done', color: 'bg-gray-700' },
    { label: 'Invoice Banao', color: 'bg-indigo-500' },
    { label: 'Payment Liya', color: 'bg-blue-600' },
    { label: 'Outstanding = 0', color: 'bg-green-600' },
    { label: '💰 Commission Auto', color: 'bg-yellow-600' },
];

export default function FinanceGuidePage() {
    const [openPhase, setOpenPhase] = useState<string | null>('attendance');
    return (
        <div className="space-y-5 max-w-3xl pb-16">
            {/* Header */}
            <div className="bg-green-700 rounded-md p-5 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-300 rounded-md flex items-center justify-center">
                        <IndianRupee className="w-5 h-5 text-green-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Finance Guide — Aayam Office App</h1>
                        <p className="text-green-200 text-sm">Payments, invoices, vendors, daily cash, reports — sab kuch yahan</p>
                    </div>
                </div>
                <p className="text-sm text-green-100 mt-2 leading-relaxed">
                    Finance ka kaam hai — har rupaye ka hisaab rakhna. Same day entry, correct account linking, aur daily reconciliation — yahi teen cheezein sab theek rakhti hain.
                </p>
            </div>

            {/* Flow */}
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

            {/* Quick Rules */}
            <div className="grid grid-cols-2 gap-2">
                {[
                    { icon: '📅', text: 'Same day entry karo — kal pe mat chhodo. Delay = reconciliation mess.' },
                    { icon: '🔗', text: 'Payment hamesha sahi job se link karo — warna outstanding galat dikhega.' },
                    { icon: '🏦', text: 'Bank weekly reconcile karo — monthly se zyada delay mat karo.' },
                    { icon: '📄', text: 'Invoice pehle banao, phir payment collect karo — sequence follow karo.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-md text-xs text-green-900">
                        <span className="text-base">{r.icon}</span><span>{r.text}</span>
                    </div>
                ))}
            </div>

            {/* Accordion */}
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

            {/* Checklist */}
            <div className="bg-gray-900 rounded-md p-4 text-white text-xs">
                <p className="font-bold text-yellow-300 mb-2">⚡ Roz Ka Finance Checklist</p>
                <div className="space-y-1 text-gray-300">
                    <p>✅ Attendance Login (subah)</p>
                    <p>✅ Pending client payments check karo</p>
                    <p>✅ Aaj ke vendor bills check karo</p>
                    <p>✅ Sab transactions same day record karo</p>
                    <p>✅ Closing balance confirm karo</p>
                    <p>✅ EOD submit karo + Attendance Logout (shaam)</p>
                </div>
            </div>
        </div>
    );
}
