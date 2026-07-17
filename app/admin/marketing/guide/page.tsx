'use client';

import { useState } from 'react';
import {
    TrendingUp, Phone, FileText, UserCheck, IndianRupee, Star,
    ChevronDown, ChevronRight, ArrowRight, AlertCircle, CheckCircle2,
    Zap, Calendar, MessageSquare, Target, Clock, Users
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
        title: '1. દિવસની શરૂઆત',
        subtitle: 'આજે શેના પર ધ્યાન આપવાનું છે તે ચેક કરો',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'આજના ફોલો-અપ ચેક કરો', path: 'Marketing → Follow-ups → Today tab', detail: 'આ ક્લાયન્ટ આજે તમારા કોલની રાહ જુએ છે' },
            { label: 'ઓવરડ્યુ ફોલો-અપ ચેક કરો', path: 'Marketing → Follow-ups → Overdue tab', detail: 'આ છૂટવા ના દો — તરત કોલ કરો' },
            { label: 'તમારી લીડ પાઇપલાઇન જુઓ', path: 'Marketing → Leads', detail: 'બધી એક્ટિવ લીડ અને તેમનું સ્ટેટસ' },
            { label: 'તમારા ઓર્ડર જુઓ', path: 'Marketing → My Orders', detail: 'તમે લાવેલા ઓર્ડર ટ્રેક કરો' },
            { label: 'ડિસ્પેચ થયેલા ઓર્ડર ચેક કરો', path: 'Marketing → Dispatched Orders', detail: 'તમારા ક્લાયન્ટના કયા ઓર્ડર ડિસ્પેચ કે ડિલિવર થયા તે જુઓ' },
            { label: 'તમારું કેલેન્ડર ચેક કરો', path: 'Calendar', detail: 'તમારી ફોલો-અપ તારીખો અને લીડ ડેડલાઇન અહીં દેખાય — ફક્ત તમારી, બીજાની નહીં' },
        ],
        tip: 'નવી લીડ ઉમેરતા પહેલા આજના ફોલો-અપ પહેલા પૂરા કરો.',
    },
    {
        id: 'leads',
        icon: <Users className="w-5 h-5" />,
        title: '2. નવી લીડ ઉમેરવી',
        subtitle: 'કોઈ રસ બતાવે — તરત તેને ઉમેરો',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'New Lead પર ક્લિક કરો', path: 'Marketing → Leads → + New Lead', detail: 'નામ, ફોન, સર્વિસ ટાઇપ, જરૂરિયાત ભરો' },
            { label: 'જરૂરિયાતની ડિટેલ ઉમેરો', path: 'Lead Form → Requirement field', detail: 'ચોક્કસ લખો — પ્રોડક્ટ ટાઇપ, ક્વોન્ટિટી, ડેડલાઇન' },
            { label: 'લીડ સેવ કરો', path: 'Save Lead button', detail: 'લીડ તમારી પાઇપલાઇનમાં બની જાય' },
            { label: 'ફોલો-અપ શેડ્યુલ કરો', path: 'Lead card → Set Follow-up Date', detail: 'ક્યારે પાછો કોલ કરશો તે તારીખ પસંદ કરો' },
            { label: 'દરેક કોલ પછી નોટ ઉમેરો', path: 'Lead → Add Note', detail: 'શું વાત થઈ, વાંધા, આગળનું પગલું — બધું નોંધો' },
        ],
        tip: 'લીડ માર્કેટિંગ વ્યક્તિને એડમિન એસાઇન કરે. લીડ એસાઇન ના થઈ હોય તો એડમિનને યાદ કરાવો.',
    },
    {
        id: 'followup',
        icon: <Phone className="w-5 h-5" />,
        title: '3. ફોલો-અપ કરવું',
        subtitle: 'નિયમિત ફોલો-અપ = કન્વર્ઝન',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'ફોલો-અપ ખોલો', path: 'Marketing → Follow-ups', detail: 'બધા આજના અને ઓવરડ્યુ ફોલો-અપ જુઓ' },
            { label: 'ક્લાયન્ટને કોલ કરો', path: '—', detail: 'ખરો કોલ app ની બહાર કરવાનો' },
            { label: 'પરિણામ + નોટ્સ રેકોર્ડ કરો', path: 'Follow-up → Add Note', detail: 'શું થયું? રસ છે? સમય જોઈએ? લીડ ગઈ?' },
            { label: 'લીડ સ્ટેટસ અપડેટ કરો', path: 'Lead → Edit Status', detail: 'સેટ કરો: Follow-up / Quoted / Negotiating / Converted / Lost' },
            { label: 'આગળનું ફોલો-અપ સેટ કરો', path: 'Lead → Set Next Follow-up Date', detail: 'Converted કે Lost થાય ત્યાં સુધી લૂપ ચાલુ રાખો' },
        ],
        tip: 'લીડને Lost માર્ક કરતા પહેલા 3–5 ફોલો-અપ થાય તે નોર્મલ છે.',
    },
    {
        id: 'quotation',
        icon: <FileText className="w-5 h-5" />,
        title: '4. ક્વોટેશન બનાવવું',
        subtitle: 'ક્લાયન્ટને ફોર્મલ ભાવ મોકલો',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'નવું ક્વોટેશન બનાવો', path: 'Marketing → Quotations → New Quotation', detail: 'લીડ સાથે લિંક કરો' },
            { label: 'જોબ ડિટેલ્સ અને ભાવ ઉમેરો', path: 'Quotation form → Items, GST, total', detail: 'પ્રોડક્ટ, ક્વોન્ટિટી, રેટ અલગ-અલગ લખો' },
            { label: 'સેવ કરી ક્લાયન્ટને મોકલો', path: 'Save → Share / Print', detail: 'WhatsApp કે ઇમેઇલથી મોકલો' },
            { label: 'ક્વોટેશન પર ફોલો-અપ કરો', path: 'Marketing → Follow-ups → Quotation tab', detail: '1–2 દિવસમાં પાછું પૂછો' },
        ],
    },
    {
        id: 'convert',
        icon: <UserCheck className="w-5 h-5" />,
        title: '5. લીડ કન્વર્ટ કરવી',
        subtitle: 'ક્લાયન્ટ હા પાડે — ઓર્ડરમાં કન્વર્ટ કરો',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'લીડ ખોલો', path: 'Marketing → Leads → [Lead name]', detail: '' },
            { label: 'Convert to Client પર ક્લિક કરો', path: 'Lead → Convert to Client button', detail: 'CRM માં ક્લાયન્ટ રેકોર્ડ ઓટોમેટિક બની જાય' },
            { label: 'એડમિન જોબ બનાવે', path: 'Jobs → New Job → Select this client', detail: 'જોબ તમે નહીં — બ્રીફિંગ પછી એડમિન બનાવે' },
            { label: 'એડમિનને જરૂરિયાત સમજાવો', path: '—', detail: 'બધા સ્પેક્સ આપો: સાઇઝ, ક્વોન્ટિટી, મટીરિયલ, ડેડલાઇન' },
        ],
        tip: 'આ ક્લાયન્ટ માટે જોબ બને તે ક્ષણથી તમારું કમિશન ટ્રેક થવા લાગે.',
    },
    {
        id: 'commission',
        icon: <IndianRupee className="w-5 h-5" />,
        title: '6. તમારું કમિશન',
        subtitle: 'ઓટોમેટિક — કોઈ મેન્યુઅલ એન્ટ્રી નહીં',
        color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', headerBg: 'bg-yellow-700',
        steps: [
            { label: 'જોબનું પૂરું પેમેન્ટ થાય એટલે કમિશન ઓટોમેટિક બને', path: 'Marketing → Commissions', detail: 'સ્ટેટસ "Eligible" દેખાય — એડમિન અપ્રૂવલની રાહ' },
            { label: 'એડમિન અપ્રૂવ કરી % સેટ કરે', path: 'Admin action — તમારું કામ નહીં', detail: 'તમારી પ્રોફાઇલના રેટ પ્રમાણે અથવા જોબ પ્રમાણે અલગ' },
            { label: 'એડમિન રૂબરૂ પેમેન્ટ કરી Paid માર્ક કરે', path: 'Admin action', detail: 'App માં સ્ટેટસ "Paid" થઈ જાય' },
            { label: 'તમારી કમાણી જુઓ', path: 'Marketing → Dashboard → Commission widget', detail: 'Pending / Approved / Paid રકમ સ્પષ્ટ દેખાય' },
        ],
        tip: 'કમિશન GST બાદ કરેલી BASE રકમ પર ગણાય. દા.ત.: ₹1,18,000 ની જોબ, 18% GST → base = ₹1,00,000 → 5% કમિશન = ₹5,000.',
    },
    {
        id: 'dispatched',
        icon: <MessageSquare className="w-5 h-5" />,
        title: '7. ડિસ્પેચ થયેલા ઓર્ડર',
        subtitle: 'તમારા ક્લાયન્ટની ડિલિવરી ટ્રેક કરો',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Dispatched Orders ખોલો', path: 'Marketing → Dispatched Orders', detail: 'તમારી લીડ સાથે જોડાયેલી ડિસ્પેચ કે ડિલિવર થયેલી બધી જોબ' },
            { label: 'ક્લાયન્ટ સાથે ડિલિવરી કન્ફર્મ કરો', path: '—', detail: 'કોલ કરી પૂછો કે ઓર્ડર સારી હાલતમાં મળ્યો કે નહીં' },
            { label: 'ડિલિવરી ફીડબેક નોંધો', path: 'Lead / Job → Add Note', detail: 'ક્લાયન્ટનો ફીડબેક — ક્વોલિટી પ્રોબ્લેમ, ફરી ઓર્ડરની શક્યતા, રેફરલ' },
        ],
        tip: 'ડિલિવર થયેલો ઓર્ડર = રિપીટ ઓર્ડર કે રેફરલ માંગવાની તક. હંમેશા ફોલો-અપ કરો.',
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '8. EOD રિપોર્ટ (End of Day)',
        subtitle: 'નીકળતા પહેલા સબમિટ કરો — રોજ',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'EOD રિપોર્ટ ખોલો', path: 'EOD Report → Submit Report', detail: 'દિવસમાં ફક્ત એક જ વાર' },
            { label: 'આજે પૂરા કરેલા કામ લખો', path: 'What did you do today?', detail: 'કેટલા કોલ, નવી લીડ, મોકલેલા ક્વોટેશન, મીટિંગ' },
            { label: 'અડચણ હોય તો લખો', path: 'Blockers section', detail: 'લીડ કન્વર્ટ કરવામાં જે કંઈ નડતું હોય' },
            { label: 'કાલનો પ્લાન લખો', path: 'Tomorrow\'s plan section', detail: 'કઈ લીડ પર ફોલો-અપ કરશો?' },
            { label: 'સબમિટ કરો', path: 'Submit EOD button', detail: 'એડમિનને નોટિફિકેશન મળે' },
        ],
        tip: 'EOD રિપોર્ટ રોજ સબમિટ કરવો ફરજિયાત. એડમિન રિવ્યૂ કરી રેટિંગ આપે.',
    },
];

const flowItems = [
    { label: 'New Lead', color: 'bg-blue-500' },
    { label: 'Follow-up', color: 'bg-indigo-500' },
    { label: 'Quotation', color: 'bg-violet-500' },
    { label: 'Negotiating', color: 'bg-purple-500' },
    { label: 'Converted ✓', color: 'bg-green-600' },
    { label: 'Job Created', color: 'bg-gray-800' },
    { label: '💰 Commission', color: 'bg-yellow-600' },
];

export default function MarketingGuidePage() {
    const [openPhase, setOpenPhase] = useState<string | null>('daily');

    return (
        <div className="space-y-5 max-w-3xl pb-16">
            {/* Header */}
            <div className="bg-blue-700 rounded-md p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-yellow-400 rounded-md flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-blue-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Marketing — આ App કેવી રીતે વાપરવી</h1>
                        <p className="text-blue-200 text-sm">તમારી રોજની પૂરી ગાઇડ: લીડ → કન્વર્ઝન → કમિશન</p>
                    </div>
                </div>
            </div>

            {/* Flow */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">તમારો Pipeline Flow</p>
                <div className="flex flex-wrap items-center gap-1">
                    {flowItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-1">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold text-white ${item.color}`}>{item.label}</span>
                            {i < flowItems.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Rules */}
            <div className="grid grid-cols-2 gap-2">
                {[
                    { icon: '📞', text: 'પહેલા કોલ, પછી app અપડેટ. નોટ ઉમેરવામાં મોડું ના કરો.' },
                    { icon: '💬', text: 'દરેક કોલ પછી નોટ ઉમેરો — એડમિન આ વાંચે છે.' },
                    { icon: '📅', text: 'હંમેશા આગળની ફોલો-અપ તારીખ સેટ કરો — લીડ લટકતી ના મૂકો.' },
                    { icon: '💰', text: 'ક્લાયન્ટ પૂરું પેમેન્ટ કરે પછી જ કમિશન બને.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-900">
                        <span className="text-base">{r.icon}</span>
                        <span>{r.text}</span>
                    </div>
                ))}
            </div>

            {/* Steps Accordion */}
            <div className="space-y-2">
                {phases.map((phase) => {
                    const isOpen = openPhase === phase.id;
                    return (
                        <div key={phase.id} className={`rounded-md border overflow-hidden ${phase.border}`}>
                            <button
                                onClick={() => setOpenPhase(isOpen ? null : phase.id)}
                                className={`w-full flex items-center justify-between px-4 py-3 text-left ${isOpen ? phase.headerBg + ' text-white' : phase.bg + ' ' + phase.color} transition-colors`}
                            >
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
