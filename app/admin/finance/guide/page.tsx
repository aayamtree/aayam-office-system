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
        title: '1. રોજનું રૂટિન',
        subtitle: 'દરરોજ સવારે શું ચેક કરવું',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'ક્લાયન્ટના બાકી પેમેન્ટ ચેક કરો', path: 'Finance → Payments → Pending tab', detail: 'જે જોબમાં બાકી રકમ > 0 હોય' },
            { label: 'આજે ભરવાના વેન્ડર બિલ ચેક કરો', path: 'Finance → Vendors → Bills → Due Today', detail: 'આજે પેમેન્ટ કરવાના વેન્ડર ઇન્વૉઇસ' },
            { label: 'આજની કેશ પોઝિશન જુઓ', path: 'Finance → Daily', detail: 'બધા એકાઉન્ટનું આજનું ઓપનિંગ બેલેન્સ' },
            { label: 'ગઈકાલની બાકી એન્ટ્રી નાખો', path: 'Finance → Daily → Add Entry', detail: 'એન્ટ્રી 1 દિવસથી વધારે બાકી ના રાખો' },
        ],
        tip: 'વ્યવહાર (transaction) હંમેશા તે જ દિવસે રેકોર્ડ કરો. મોડી એન્ટ્રીથી રિકન્સિલિએશનમાં ભૂલ થાય.',
    },
    {
        id: 'payment',
        icon: <CreditCard className="w-5 h-5" />,
        title: '2. ક્લાયન્ટ પેમેન્ટ રેકોર્ડ કરવું',
        subtitle: 'ક્લાયન્ટ પેમેન્ટ કરે → તરત રેકોર્ડ કરો',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Finance → Payments → New Payment ખોલો', path: 'Finance → Payments → + New Payment', detail: '' },
            { label: 'જોબ પસંદ કરો', path: 'Payment Form → Select Job', detail: 'પેમેન્ટ સાચી જોબ સાથે લિંક થાય' },
            { label: 'મળેલી રકમ નાખો', path: 'Amount field', detail: 'આંશિક (partial) કે પૂરું પેમેન્ટ — બંને ચાલે' },
            { label: 'પેમેન્ટ મોડ પસંદ કરો', path: 'Mode: Cash / Bank Transfer / UPI / Cheque', detail: 'ક્લાયન્ટે જે રીતે પેમેન્ટ કર્યું તે જ પસંદ કરો' },
            { label: 'કયા એકાઉન્ટમાં આવ્યું તે પસંદ કરો', path: 'Account field', detail: 'કેશ, HDFC Current વગેરે' },
            { label: 'સેવ કરો', path: 'Save button', detail: 'જોબની બાકી રકમ ઓટોમેટિક અપડેટ. પૂરું પેમેન્ટ હોય તો કમિશન ઓટોમેટિક ટ્રિગર.' },
        ],
        tip: 'મળેલી રકમ = જોબની કુલ રકમ થાય એટલે માર્કેટિંગ વ્યક્તિનું કમિશન સ્ટેટસ ઓટોમેટિક Eligible થાય.',
    },
    {
        id: 'invoice',
        icon: <Receipt className="w-5 h-5" />,
        title: '3. ઇન્વૉઇસ બનાવવું',
        subtitle: 'ક્લાયન્ટ માટે GST ઇન્વૉઇસ બનાવો',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'Finance → Invoices → New Invoice ખોલો', path: 'Finance → Invoices → + New Invoice', detail: '' },
            { label: 'ક્લાયન્ટ અને જોબ પસંદ કરો', path: 'Invoice Form → Client, Job', detail: 'આઇટમ જોબમાંથી ઓટોમેટિક ભરાય' },
            { label: 'GST % સેટ કરો', path: 'GST field → 5% / 12% / 18% / 28%', detail: 'પ્રોડક્ટ ટાઇપ પ્રમાણે' },
            { label: 'ચેક કરી સેવ કરો', path: 'Save → Download PDF', detail: 'ક્લાયન્ટને મોકલવા PDF તૈયાર' },
        ],
    },
    {
        id: 'vendor',
        icon: <Building2 className="w-5 h-5" />,
        title: '4. વેન્ડર બિલ અને ખરીદી',
        subtitle: 'આપણે શું ખરીદ્યું / વેન્ડરને શું આપવાનું છે',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Finance → Vendors → [વેન્ડરનું નામ] ખોલો', path: 'Finance → Vendors → [Name]', detail: '' },
            { label: 'ખરીદી / બિલ ઉમેરો', path: 'Vendor page → Add Purchase', detail: 'તેમની પાસેથી લીધેલા પેપર, પ્રિન્ટ, સર્વિસ વગેરે' },
            { label: 'વેન્ડરને કરેલું પેમેન્ટ રેકોર્ડ કરો', path: 'Vendor page → Pay Bill', detail: 'આજે કયા બિલ ભરો છો તે માર્ક કરો' },
            { label: 'વેન્ડર લેજર જુઓ', path: 'Vendor page → Ledger tab', detail: 'આ વેન્ડર સાથેની આખી હિસ્ટ્રી' },
        ],
        tip: 'વેન્ડર બિલ મળે ત્યારે જ રેકોર્ડ કરો, પેમેન્ટ કરો ત્યારે નહીં. તો જ સાચું બાકી (payables) દેખાય.',
    },
    {
        id: 'daily_entry',
        icon: <Landmark className="w-5 h-5" />,
        title: '5. રોજની કેશ અને ખર્ચ એન્ટ્રી',
        subtitle: 'પેટી કેશ, નાના ખર્ચા, ઓફિસ ખર્ચ',
        color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-700',
        steps: [
            { label: 'Finance → Daily ખોલો', path: 'Finance → Daily', detail: 'આજની કેશબુક ઓટોમેટિક ખૂલે' },
            { label: 'ખર્ચની એન્ટ્રી ઉમેરો', path: 'Add Entry → Expense → Category, Amount, Note', detail: 'ચા, કુરિયર, સ્ટેશનરી વગેરે' },
            { label: 'એકાઉન્ટ વચ્ચે ટ્રાન્સફર ઉમેરો', path: 'Add Entry → Transfer', detail: 'દા.ત.: કેશમાંથી બેંક, અથવા પેટી કેશ માટે બેંકમાંથી કેશ' },
            { label: 'ક્લોઝિંગ બેલેન્સ કન્ફર્મ કરો', path: 'Daily screen → Closing balance', detail: 'હાથમાં રહેલી ખરી કેશ સાથે મેચ થવું જોઈએ' },
        ],
    },
    {
        id: 'accounts',
        icon: <Receipt className="w-5 h-5" />,
        title: '6. બેંક એકાઉન્ટ્સ અને લેજર',
        subtitle: 'દરેક એકાઉન્ટની હિસ્ટ્રી જુઓ',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'એકાઉન્ટ લિસ્ટ ખોલો', path: 'Finance → Accounts', detail: 'બધા એકાઉન્ટ: કેશ, HDFC Current વગેરે — ચાલુ બેલેન્સ સાથે' },
            { label: 'એકાઉન્ટ સ્ટેટમેન્ટ ખોલો', path: 'Finance → Accounts → [Account name] → Statement', detail: 'તે એકાઉન્ટનું આખું લેજર — દરેક ડેબિટ/ક્રેડિટ એન્ટ્રી' },
            { label: 'નવું બેંક એકાઉન્ટ ઉમેરો', path: 'Finance → Accounts → Add Account', detail: 'કેશ, બેંક કે બીજું — તેમાં કોઈ વ્યવહાર નાખતા પહેલા ઉમેરો' },
            { label: 'Daily Summary જુઓ', path: 'Finance → Daily Summary', detail: 'ફક્ત એડમિન: કોઈ પણ તારીખના બધા એકાઉન્ટ બેલેન્સ એક સાથે' },
        ],
        tip: 'પેમેન્ટ કે ખર્ચ રેકોર્ડ કરતા પહેલા હંમેશા બેંક એકાઉન્ટ ઉમેરો.',
    },
    {
        id: 'banking',
        icon: <Landmark className="w-5 h-5" />,
        title: '7. બેંકિંગ અને રિકન્સિલિએશન',
        subtitle: 'App ને ખરા બેંક સ્ટેટમેન્ટ સાથે મેચ કરો',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'મહિનાનું બેંક સ્ટેટમેન્ટ ડાઉનલોડ કરો', path: '—', detail: 'તમારી બેંકના નેટ બેંકિંગ પોર્ટલમાંથી' },
            { label: 'Banking મોડ્યુલ ખોલો', path: 'Finance → Banking', detail: 'દરેક એકાઉન્ટનું app માં નોંધાયેલું બેલેન્સ જુઓ' },
            { label: 'બેંક સ્ટેટમેન્ટ સાથે સરખાવો', path: '—', detail: 'કોઈ ફરક = app માં એન્ટ્રી ખૂટે છે અથવા ડબલ છે' },
            { label: 'ફરક સુધારો', path: 'Finance → Daily → Add missing entry', detail: 'બેંકમાં હોય પણ app માં ના હોય તે એન્ટ્રી ઉમેરો' },
        ],
        tip: 'દર અઠવાડિયે કે મહિને રિકન્સાઇલ કરો. જેટલું મોડું, એટલું અઘરું.',
    },
    {
        id: 'reports',
        icon: <BarChart3 className="w-5 h-5" />,
        title: '8. રિપોર્ટ્સ',
        subtitle: 'ફાઇનાન્સ પરફોર્મન્સ અને સમરી જુઓ',
        color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', headerBg: 'bg-slate-700',
        steps: [
            { label: 'ફાઇનાન્સ Overview', path: 'Finance → Overview', detail: 'આ મહિનાની આવક, ખર્ચ, બાકી રકમ, કેશબુક' },
            { label: 'ક્લાયન્ટ બાકી રિપોર્ટ', path: 'Finance → Reports → Client Outstanding', detail: 'કોણ કેટલા પૈસા આપવાના બાકી છે' },
            { label: 'વેન્ડર પેમેન્ટ રિપોર્ટ', path: 'Finance → Reports → Vendor Reports', detail: 'આપણે વેન્ડરને શું આપવાનું બાકી છે' },
            { label: 'P&L સમરી', path: 'Finance → Reports → P&L', detail: 'આવક vs ખર્ચ — સમયગાળાનો નફો' },
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
                        <p className="text-green-200 text-sm">પેમેન્ટ, ઇન્વૉઇસ, વેન્ડર, રોજની કેશ, રિપોર્ટ</p>
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
                    { icon: '📅', text: 'એન્ટ્રી તે જ દિવસે નાખો — ક્યારેય મોડું નહીં.' },
                    { icon: '🔗', text: 'પેમેન્ટ હંમેશા સાચી જોબ સાથે લિંક કરો.' },
                    { icon: '🏦', text: 'ભૂલ વહેલી પકડવા દર અઠવાડિયે બેંક રિકન્સાઇલ કરો.' },
                    { icon: '📄', text: 'પેમેન્ટ માંગતા પહેલા ઇન્વૉઇસ બનાવો.' },
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
