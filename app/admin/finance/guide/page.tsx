'use client';

import { useState } from 'react';
import {
    IndianRupee, Clock, FileText, CreditCard, Building2, BarChart3,
    ChevronDown, ChevronRight, ArrowRight, AlertCircle, Target, Landmark, Receipt
} from 'lucide-react';

interface Step { label: string; labelEn?: string; path?: string; detail?: string; detailEn?: string; }
interface Phase {
    id: string; icon: React.ReactNode; title: string; titleEn?: string; subtitle: string; subtitleEn?: string;
    color: string; bg: string; border: string; headerBg: string;
    steps: Step[]; tip?: string; tipEn?: string;
}

const phases: Phase[] = [
    {
        id: 'daily',
        icon: <Clock className="w-5 h-5" />,
        title: '1. રોજનું રૂટિન', titleEn: '1. Daily Routine',
        subtitle: 'દરરોજ સવારે શું ચેક કરવું', subtitleEn: 'What to check every morning',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'ક્લાયન્ટના બાકી પેમેન્ટ ચેક કરો', labelEn: 'Check pending payments from clients', path: 'Finance → Payments → Pending tab', detail: 'જે જોબમાં બાકી રકમ > 0 હોય', detailEn: 'Jobs with outstanding balance > 0' },
            { label: 'આજે ભરવાના વેન્ડર બિલ ચેક કરો', labelEn: 'Check vendor bills due today', path: 'Finance → Vendors → Bills → Due Today', detail: 'આજે પેમેન્ટ કરવાના વેન્ડર ઇન્વૉઇસ', detailEn: 'Vendor invoices that need payment today' },
            { label: 'આજની બેંક પોઝિશન જુઓ', labelEn: 'Review daily bank position', path: 'Finance → Daily', detail: 'બધા એકાઉન્ટનું આજનું ઓપનિંગ બેલેન્સ', detailEn: 'Opening balance for today across accounts' },
            { label: 'ગઈકાલની બાકી એન્ટ્રી નાખો', labelEn: 'Record yesterday\'s pending entries', path: 'Finance → Daily → Add Entry', detail: 'એન્ટ્રી 1 દિવસથી વધારે બાકી ના રાખો', detailEn: 'Never leave entries pending for more than 1 day' },
        ],
        tip: 'વ્યવહાર (transaction) હંમેશા તે જ દિવસે રેકોર્ડ કરો. મોડી એન્ટ્રીથી રિકન્સિલિએશનમાં ભૂલ થાય.', tipEn: 'Always record transactions on the SAME DAY. Delayed entries cause reconciliation errors.',
    },
    {
        id: 'payment',
        icon: <CreditCard className="w-5 h-5" />,
        title: '2. ક્લાયન્ટ પેમેન્ટ રેકોર્ડ કરવું', titleEn: '2. Recording Client Payment',
        subtitle: 'ક્લાયન્ટ પેમેન્ટ કરે → તરત રેકોર્ડ કરો', subtitleEn: 'Client pays → record immediately',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Finance → Payments → New Payment ખોલો', labelEn: 'Open Finance → Payments → New Payment', path: 'Finance → Payments → + New Payment', detail: '' },
            { label: 'જોબ પસંદ કરો', labelEn: 'Select the job', path: 'Payment Form → Select Job', detail: 'પેમેન્ટ સાચી જોબ સાથે લિંક થાય', detailEn: 'Links payment to the correct job' },
            { label: 'મળેલી રકમ નાખો', labelEn: 'Enter amount received', path: 'Amount field', detail: 'આંશિક (partial) કે પૂરું પેમેન્ટ — બંને ચાલે', detailEn: 'Can be partial or full payment' },
            { label: 'પેમેન્ટ મોડ પસંદ કરો', labelEn: 'Select payment mode', path: 'Mode: Bank Transfer / Cheque', detail: 'ક્લાયન્ટે જે રીતે પેમેન્ટ કર્યું તે જ પસંદ કરો', detailEn: 'Pick the actual method client used' },
            { label: 'કયા એકાઉન્ટમાં આવ્યું તે પસંદ કરો', labelEn: 'Select bank account received into', path: 'Account field', detail: 'HDFC Current વગેરે', detailEn: 'HDFC Current, etc.' },
            { label: 'સેવ કરો', labelEn: 'Save', path: 'Save button', detail: 'જોબની બાકી રકમ ઓટોમેટિક અપડેટ. પૂરું પેમેન્ટ હોય તો કમિશન ઓટોમેટિક ટ્રિગર.', detailEn: 'Job outstanding balance auto-updates. Commission auto-triggers if fully paid.' },
        ],
        tip: 'મળેલી રકમ = જોબની કુલ રકમ થાય એટલે માર્કેટિંગ વ્યક્તિનું કમિશન સ્ટેટસ ઓટોમેટિક Eligible થાય.', tipEn: 'When amount received = job total, commission status auto-changes to Eligible for the marketing person.',
    },
    {
        id: 'invoice',
        icon: <Receipt className="w-5 h-5" />,
        title: '3. ઇન્વૉઇસ બનાવવું', titleEn: '3. Creating Invoices',
        subtitle: 'ક્લાયન્ટ માટે GST ઇન્વૉઇસ બનાવો', subtitleEn: 'Generate GST invoice for clients',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'Finance → Invoices → New Invoice ખોલો', labelEn: 'Open Finance → Invoices → New Invoice', path: 'Finance → Invoices → + New Invoice', detail: '' },
            { label: 'ક્લાયન્ટ અને જોબ પસંદ કરો', labelEn: 'Select client and linked job', path: 'Invoice Form → Client, Job', detail: 'આઇટમ જોબમાંથી ઓટોમેટિક ભરાય', detailEn: 'Line items auto-populate from job' },
            { label: 'GST % સેટ કરો', labelEn: 'Set GST %', path: 'GST field → 5% / 12% / 18% / 28%', detail: 'પ્રોડક્ટ ટાઇપ પ્રમાણે', detailEn: 'Depends on product type' },
            { label: 'ચેક કરી સેવ કરો', labelEn: 'Review and save', path: 'Save → Download PDF', detail: 'ક્લાયન્ટને મોકલવા PDF તૈયાર', detailEn: 'PDF ready to share with client' },
        ],
    },
    {
        id: 'vendor',
        icon: <Building2 className="w-5 h-5" />,
        title: '4. વેન્ડર બિલ અને ખરીદી', titleEn: '4. Vendor Bills & Purchases',
        subtitle: 'આપણે શું ખરીદ્યું / વેન્ડરને શું આપવાનું છે', subtitleEn: 'Record what we buy or owe vendors',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Finance → Vendors → [વેન્ડરનું નામ] ખોલો', labelEn: 'Open Finance → Vendors → [Vendor Name]', path: 'Finance → Vendors → [Name]', detail: '' },
            { label: 'ખરીદી / બિલ ઉમેરો', labelEn: 'Add a purchase / bill', path: 'Vendor page → Add Purchase', detail: 'તેમની પાસેથી લીધેલા પેપર, પ્રિન્ટ, સર્વિસ વગેરે', detailEn: 'Paper, print, services etc. bought from them' },
            { label: 'વેન્ડરને કરેલું પેમેન્ટ રેકોર્ડ કરો', labelEn: 'Record payment to vendor', path: 'Vendor page → Pay Bill', detail: 'આજે કયા બિલ ભરો છો તે માર્ક કરો', detailEn: 'Mark which bills you\'re paying today' },
            { label: 'વેન્ડર લેજર જુઓ', labelEn: 'View vendor ledger', path: 'Vendor page → Ledger tab', detail: 'આ વેન્ડર સાથેની આખી હિસ્ટ્રી', detailEn: 'Full transaction history with this vendor' },
        ],
        tip: 'વેન્ડર બિલ મળે ત્યારે જ રેકોર્ડ કરો, પેમેન્ટ કરો ત્યારે નહીં. તો જ સાચું બાકી (payables) દેખાય.', tipEn: 'Record vendor bills WHEN you receive them, not when you pay. This shows accurate payables.',
    },
    {
        id: 'daily_entry',
        icon: <Landmark className="w-5 h-5" />,
        title: '5. રોજની ખર્ચ એન્ટ્રી', titleEn: '5. Daily Expense Entries',
        subtitle: 'નાના ખર્ચા, ઓફિસ ખર્ચ', subtitleEn: 'Small expenses, office costs',
        color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-700',
        steps: [
            { label: 'Finance → Daily ખોલો', labelEn: 'Open Finance → Daily', path: 'Finance → Daily', detail: 'આજની બુક ઓટોમેટિક ખૂલે', detailEn: 'Today\'s book automatically opens' },
            { label: 'ખર્ચની એન્ટ્રી ઉમેરો', labelEn: 'Add expense entry', path: 'Add Entry → Expense → Category, Amount, Note', detail: 'ચા, કુરિયર, સ્ટેશનરી વગેરે', detailEn: 'Tea, courier, stationery, etc.' },
            { label: 'એકાઉન્ટ વચ્ચે ટ્રાન્સફર ઉમેરો', labelEn: 'Add transfer between accounts', path: 'Add Entry → Transfer', detail: 'દા.ત.: એક બેંક એકાઉન્ટમાંથી બીજામાં', detailEn: 'Example: one bank account to another' },
        ],
        tip: 'કેશ અને UPI અહીં રેકોર્ડ થતા નથી — તે Vyapar માં નાખવાના. આ સિસ્ટમ ફક્ત HDFC એકાઉન્ટ સંભાળે છે.', tipEn: 'Cash and UPI are not recorded here — they go in Vyapar. This system tracks the HDFC account only.',
    },
    {
        id: 'accounts',
        icon: <Receipt className="w-5 h-5" />,
        title: '6. બેંક એકાઉન્ટ્સ અને લેજર', titleEn: '6. Bank Accounts & Ledger',
        subtitle: 'દરેક એકાઉન્ટની હિસ્ટ્રી જુઓ', subtitleEn: 'View per-account transaction history',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'એકાઉન્ટ લિસ્ટ ખોલો', labelEn: 'Open Accounts list', path: 'Finance → Accounts', detail: 'બધા બેંક એકાઉન્ટ — ચાલુ બેલેન્સ સાથે', detailEn: 'See all bank accounts with running balance' },
            { label: 'એકાઉન્ટ સ્ટેટમેન્ટ ખોલો', labelEn: 'Open account statement', path: 'Finance → Accounts → [Account name] → Statement', detail: 'તે એકાઉન્ટનું આખું લેજર — દરેક ડેબિટ/ક્રેડિટ એન્ટ્રી', detailEn: 'Full ledger for that account — every debit and credit entry' },
            { label: 'નવું બેંક એકાઉન્ટ ઉમેરો', labelEn: 'Add a new bank account', path: 'Finance → Accounts → Add Account', detail: 'તેમાં કોઈ વ્યવહાર નાખતા પહેલા ઉમેરો', detailEn: 'Add it before recording any transactions against it' },
            { label: 'Daily Summary જુઓ', labelEn: 'View Daily Summary', path: 'Finance → Daily Summary', detail: 'ફક્ત એડમિન: કોઈ પણ તારીખના બધા એકાઉન્ટ બેલેન્સ એક સાથે', detailEn: 'Admin-only: overview of all account balances for any selected date' },
        ],
        tip: 'પેમેન્ટ કે ખર્ચ રેકોર્ડ કરતા પહેલા હંમેશા બેંક એકાઉન્ટ ઉમેરો.', tipEn: 'Always add your bank accounts before recording payments or expenses.',
    },
    {
        id: 'banking',
        icon: <Landmark className="w-5 h-5" />,
        title: '7. બેંકિંગ અને રિકન્સિલિએશન', titleEn: '7. Banking & Reconciliation',
        subtitle: 'App ને ખરા બેંક સ્ટેટમેન્ટ સાથે મેચ કરો', subtitleEn: 'Match app with actual bank statement',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'મહિનાનું બેંક સ્ટેટમેન્ટ ડાઉનલોડ કરો', labelEn: 'Download monthly bank statement', path: '—', detail: 'તમારી બેંકના નેટ બેંકિંગ પોર્ટલમાંથી', detailEn: 'From your bank\'s net banking portal' },
            { label: 'Banking મોડ્યુલ ખોલો', labelEn: 'Open Banking module', path: 'Finance → Banking', detail: 'દરેક એકાઉન્ટનું app માં નોંધાયેલું બેલેન્સ જુઓ', detailEn: 'See app\'s recorded balance for each account' },
            { label: 'બેંક સ્ટેટમેન્ટ સાથે સરખાવો', labelEn: 'Compare against bank statement', path: '—', detail: 'કોઈ ફરક = app માં એન્ટ્રી ખૂટે છે અથવા ડબલ છે', detailEn: 'Any mismatch = missing or duplicate entry in app' },
            { label: 'ફરક સુધારો', labelEn: 'Fix discrepancies', path: 'Finance → Daily → Add missing entry', detail: 'બેંકમાં હોય પણ app માં ના હોય તે એન્ટ્રી ઉમેરો', detailEn: 'Add any transaction found in bank but not in app' },
        ],
        tip: 'દર અઠવાડિયે કે મહિને રિકન્સાઇલ કરો. જેટલું મોડું, એટલું અઘરું.', tipEn: 'Reconcile weekly or monthly. The longer you wait, the harder it gets.',
    },
    {
        id: 'reports',
        icon: <BarChart3 className="w-5 h-5" />,
        title: '8. રિપોર્ટ્સ', titleEn: '8. Reports',
        subtitle: 'ફાઇનાન્સ પરફોર્મન્સ અને સમરી જુઓ', subtitleEn: 'View financial performance & summaries',
        color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', headerBg: 'bg-slate-700',
        steps: [
            { label: 'ફાઇનાન્સ Overview', labelEn: 'Finance overview', path: 'Finance → Overview', detail: 'આ મહિનાની આવક, ખર્ચ, બાકી રકમ', detailEn: 'Revenue this month, expenses, outstanding' },
            { label: 'ક્લાયન્ટ બાકી રિપોર્ટ', labelEn: 'Client outstanding report', path: 'Finance → Reports → Client Outstanding', detail: 'કોણ કેટલા પૈસા આપવાના બાકી છે', detailEn: 'Who owes us money and how much' },
            { label: 'વેન્ડર પેમેન્ટ રિપોર્ટ', labelEn: 'Vendor payment report', path: 'Finance → Reports → Vendor Reports', detail: 'આપણે વેન્ડરને શું આપવાનું બાકી છે', detailEn: 'What we owe vendors' },
            { label: 'P&L સમરી', labelEn: 'P&L summary', path: 'Finance → Reports → P&L', detail: 'આવક vs ખર્ચ — સમયગાળાનો નફો', detailEn: 'Revenue vs expenses — profit for the period' },
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
                        <h1 className="text-xl font-bold">Finance — આ App કેવી રીતે વાપરવી</h1>
                        <p className="text-green-200 text-sm">પેમેન્ટ, ઇન્વૉઇસ, વેન્ડર, રોજના ખર્ચ, રિપોર્ટ</p>
                    </div>
                </div>
            </div>

            {/* PHASE 4, 2026-09-02. The steps further down this page still say
                "Finance → Payments → New Payment" and "Finance → Invoices → New
                Invoice". Those screens have been closed for writing since
                2026-08 and are no longer in the menu, so following them now
                leads to a refusal. Rewriting every bilingual step is its own
                job; until then this block says plainly what changed, at the top,
                where it is read first. */}
            <div className="rounded-md border-2 border-blue-600 bg-blue-50 p-4 space-y-3">
                <div>
                    <p className="text-sm font-bold text-blue-900">
                        નવું: ફાયનાન્સ હવે પાંચ દરવાજા છે
                    </p>
                    <p className="text-sm font-semibold text-blue-800">
                        New: Finance is now five doors
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                    {[
                        ['Money In', 'આપણને કોણ પૈસા આપવાના બાકી છે', 'Who owes us money'],
                        ['Money Out', 'આપણે કોને પૈસા આપવાના બાકી છે', 'Who we owe money to'],
                        ['Bank', 'બેન્કમાં શું દેખાય છે', 'What the bank statement shows'],
                        ['To Do', 'બાકી રહેલું કામ', 'Work still unfinished'],
                        ['Reports', 'મહિનાનો હિસાબ', 'The month\u2019s figures'],
                    ].map(([door, gu, en]) => (
                        <div key={door} className="rounded-md bg-white border border-blue-200 px-3 py-2">
                            <p className="text-xs font-bold text-blue-900">{door}</p>
                            <p className="text-xs text-gray-700">{gu}</p>
                            <p className="text-[11px] text-gray-500">{en}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-md bg-amber-50 border border-amber-300 px-3 py-2.5">
                    <p className="text-xs font-bold text-amber-900 mb-1">
                        ⚠️ ઇન્વૉઇસ, બિલ અને જર્નલ એન્ટ્રી હવે <u>Zoho Books</u> માં જ કરવાનાં — આ એપમાં નહીં.
                    </p>
                    <p className="text-xs text-amber-800">
                        Invoices, purchase bills and journal entries are now made in Zoho Books, not in this
                        app. Zoho is the book of record. This app shows you what is in Zoho, links each
                        invoice to its job, and collects payment proofs.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1.5">
                        નીચેનાં પગલાંમાં જ્યાં &ldquo;Finance → Payments&rdquo; કે &ldquo;Finance → Invoices&rdquo;
                        લખ્યું હોય તે હવે જૂનું છે. · The steps below that mention Payments, Invoices, Daily or
                        Journal are out of date and kept only as history.
                    </p>
                </div>

                <p className="text-xs text-blue-900">
                    રોકડ (cash) અને UPI આ સિસ્ટમમાં નથી — તે <b>Vyapar</b> માં નાખો. અહીં ફક્ત HDFC બેંક એકાઉન્ટ. ·
                    Cash and UPI are not in this system — enter them in <b>Vyapar</b>. This system tracks the HDFC bank account only.
                </p>
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
                    { icon: '📅', text: 'એન્ટ્રી તે જ દિવસે નાખો — ક્યારેય મોડું નહીં.', textEn: 'Record entries on the same day — never delay.' },
                    { icon: '🔗', text: 'પેમેન્ટ હંમેશા સાચી જોબ સાથે લિંક કરો.', textEn: 'Always link payments to the correct job.' },
                    { icon: '🏦', text: 'ભૂલ વહેલી પકડવા દર અઠવાડિયે બેંક રિકન્સાઇલ કરો.', textEn: 'Reconcile bank weekly to catch errors early.' },
                    { icon: '📄', text: 'પેમેન્ટ માંગતા પહેલા ઇન્વૉઇસ બનાવો.', textEn: 'Create invoice before requesting payment.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-green-50 border border-green-100 rounded-md text-xs text-green-900">
                        <span className="text-base">{r.icon}</span><span>{r.text}{r.textEn && <span className="block opacity-70 mt-0.5">{r.textEn}</span>}</span>
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
                                        <p className="font-bold text-sm">{phase.title}</p>{phase.titleEn && <p className={`text-xs font-semibold ${isOpen ? "text-white/80" : "opacity-75"}`}>{phase.titleEn}</p>}
                                        <p className={`text-xs ${isOpen ? 'text-white/70' : 'opacity-60'}`}>{phase.subtitle}</p>{phase.subtitleEn && <p className={`text-[11px] ${isOpen ? 'text-white/50' : 'opacity-40'}`}>{phase.subtitleEn}</p>}
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
                                                <p className="text-sm font-semibold text-gray-900">{step.label}</p>{step.labelEn && <p className="text-xs text-gray-500">{step.labelEn}</p>}
                                                {step.path && <p className="text-xs font-mono text-gray-500 mt-0.5 flex items-center gap-1"><ArrowRight className="w-3 h-3 text-gray-400" />{step.path}</p>}
                                                {step.detail && <><p className="text-xs text-gray-400 mt-0.5 italic">{step.detail}</p>{step.detailEn && <p className="text-xs text-gray-400 italic opacity-80">{step.detailEn}</p>}</>}
                                            </div>
                                        </div>
                                    ))}
                                    {phase.tip && (
                                        <div className={`mt-3 flex items-start gap-2 p-3 rounded-md ${phase.bg} ${phase.border} border`}>
                                            <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${phase.color}`} />
                                            <div><p className={`text-xs font-medium ${phase.color}`}>{phase.tip}</p>{phase.tipEn && <p className={`text-xs mt-0.5 opacity-70 ${phase.color}`}>{phase.tipEn}</p>}</div>
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
