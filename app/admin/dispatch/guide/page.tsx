'use client';

import { useState } from 'react';
import {
    Truck, Clock, PackageCheck, Send, History, AlertCircle,
    ChevronDown, ChevronRight, ArrowRight, CheckCircle2, Target, Shield
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
        title: '1. દિવસની શરૂઆત', titleEn: '1. Start of Day',
        subtitle: 'ડિસ્પેચ માટે શું તૈયાર છે તે ચેક કરો', subtitleEn: 'Check what\'s ready for dispatch',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Dispatch Command Center ખોલો', labelEn: 'Open Dispatch Command Center', path: 'Dispatch → Command Center', detail: 'Printing અને QC સ્ટેજની બધી જોબ જુઓ', detailEn: 'See all jobs at Printing and QC stages' },
            { label: 'QC બાકી હોય તે જોબ ચેક કરો', labelEn: 'Check jobs pending QC', path: 'Dispatch → QC & Packing tab', detail: 'આ પ્રિન્ટ થઈ ગઈ છે અને તમારા ચેકની રાહ જુએ છે', detailEn: 'These are printed and waiting for your check' },
            { label: 'આજની શેડ્યુલ ડિલિવરી ચેક કરો', labelEn: 'Check today\'s scheduled deliveries', path: 'Dispatch → Scheduled Deliveries', detail: 'બાકી ડિલિવરી માટે ટ્રાન્સપોર્ટર સાથે ફોલો-અપ કરો', detailEn: 'Follow up with transporter on pending deliveries' },
            { label: 'તમારું કેલેન્ડર ચેક કરો', labelEn: 'Check your calendar', path: 'Calendar', detail: 'જોબની ડિસ્પેચ ડેડલાઇન દેખાય — ડિઝાઇન ટાસ્ક તમારા વ્યૂમાં નથી દેખાતા', detailEn: 'See dispatch deadlines for jobs — design tasks are not shown in your calendar view' },
        ],
    },
    {
        id: 'qc',
        icon: <PackageCheck className="w-5 h-5" />,
        title: '2. ક્વોલિટી ચેક (QC)', titleEn: '2. Quality Check (QC)',
        subtitle: 'પેકિંગ પહેલા દરેક જોબ તપાસો', subtitleEn: 'Inspect every job before packing',
        color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', headerBg: 'bg-red-700',
        steps: [
            { label: 'જોબનું QC ખોલો', labelEn: 'Open QC for a job', path: 'Dispatch → QC & Packing → [Job]', detail: 'સ્પેક્સ જુઓ: ક્વોન્ટિટી, સાઇઝ, કલર, ક્લાયન્ટ', detailEn: 'See specs: quantity, size, colour, client' },
            { label: 'મટીરિયલ હાથે તપાસો', labelEn: 'Physically inspect material', path: '—', detail: 'ચેક કરો: કલર બરાબર છે, કટ માર્ક, ક્વોન્ટિટી, કોઈ ખામી નથી', detailEn: 'Check: colour accuracy, cut marks, quantity, no defects' },
            { label: 'QC PASS માર્ક કરો', labelEn: 'Mark QC as PASS', path: 'QC → Pass button', detail: 'જોબ "Ready to Dispatch" માં જાય', detailEn: 'Job moves to "Ready to Dispatch"' },
            { label: 'ખામી હોય તો QC FAIL માર્ક કરો', labelEn: 'Mark QC as FAIL (if defects)', path: 'QC → Fail → Add reason', detail: 'જોબ પાછી પ્રિન્ટિંગમાં જાય. એડમિનને નોટિફિકેશન મળે.', detailEn: 'Job goes back to printing. Admin is notified.' },
        ],
        tip: 'QC ક્યારેય છોડો નહીં. ખોટી ડિલિવરીનો ખર્ચ QC ના સમય કરતા ઘણો વધારે.', tipEn: 'NEVER skip QC. A wrong delivery costs more than QC time.',
    },
    {
        id: 'dispatch',
        icon: <Send className="w-5 h-5" />,
        title: '3. પેકિંગ અને ડિસ્પેચ', titleEn: '3. Packing & Dispatching',
        subtitle: 'પેક કરો → ટ્રાન્સપોર્ટર એસાઇન કરો → મોકલો', subtitleEn: 'Pack → assign transporter → send',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'જોબ પેક કરો', labelEn: 'Pack the job', path: '—', detail: 'જરૂર પ્રમાણે બોક્સ / બબલ રેપ. જોબ નંબર + ક્લાયન્ટ નામનું લેબલ લગાવો.', detailEn: 'Box / bubble wrap as needed. Label with job number + client name.' },
            { label: 'ડિસ્પેચ માટે તૈયાર જોબ ખોલો', labelEn: 'Open ready-to-dispatch job', path: 'Dispatch → Command Center → [Job]', detail: 'પહેલા QC પાસ થવું જરૂરી', detailEn: 'QC must be passed first' },
            { label: 'ટ્રાન્સપોર્ટર એસાઇન કરો', labelEn: 'Assign transporter', path: 'Job → Assign Transporter', detail: 'સેવ કરેલા લિસ્ટમાંથી પસંદ કરો. જાતે ડિલિવરી હોય તો "In-House" પસંદ કરો.', detailEn: 'Choose from saved list. Or select "In-House" for self delivery.' },
            { label: 'Dispatched માર્ક કરો', labelEn: 'Mark as Dispatched', path: 'Dispatch button', detail: 'જોબ સ્ટેજ = Dispatched. સમય ઓટોમેટિક રેકોર્ડ થાય.', detailEn: 'Job stage = Dispatched. Time recorded automatically.' },
        ],
    },
    {
        id: 'delivered',
        icon: <CheckCircle2 className="w-5 h-5" />,
        title: '4. ડિલિવરી કન્ફર્મ કરવી', titleEn: '4. Confirming Delivery',
        subtitle: 'ટ્રાન્સપોર્ટર સાથે કન્ફર્મ કરો, પછી જોબ બંધ કરો', subtitleEn: 'Confirm with transporter, then close',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'ટ્રાન્સપોર્ટર ડિલિવરી કન્ફર્મ કરે', labelEn: 'Transporter confirms delivery', path: '—', detail: 'ટ્રાન્સપોર્ટરનો કોલ/WhatsApp', detailEn: 'Call/WhatsApp from transporter' },
            { label: 'જોબ Delivered માર્ક કરો', labelEn: 'Mark job as Delivered', path: 'Dispatch → [Job] → Mark Delivered', detail: 'છેલ્લું સ્ટેજ — જોબ પૂરી', detailEn: 'Final stage — job is complete' },
            { label: 'ડિલિવરી કન્ફર્મેશન નોટ ઉમેરો', labelEn: 'Add delivery confirmation note', path: 'Job → Note', detail: 'કોણે લીધું, તારીખ, ક્લાયન્ટનો ફીડબેક', detailEn: 'Who received it, date, any client feedback' },
        ],
        tip: 'શક્ય હોય ત્યાં ટ્રાન્સપોર્ટર પાસેથી ફોટો પ્રૂફ લો.', tipEn: 'Get transporter photo proof when possible.',
    },
    {
        id: 'history',
        icon: <History className="w-5 h-5" />,
        title: '5. હિસ્ટ્રી અને ટ્રાન્સપોર્ટર', titleEn: '5. History & Transporters',
        subtitle: 'જૂની ડિલિવરી ટ્રેક કરો, ટ્રાન્સપોર્ટર મેનેજ કરો', subtitleEn: 'Track past deliveries, manage transporters',
        color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', headerBg: 'bg-slate-700',
        steps: [
            { label: 'ડિલિવરી હિસ્ટ્રી જુઓ', labelEn: 'View delivery history', path: 'Dispatch → Delivery History', detail: 'તારીખ, ટ્રાન્સપોર્ટર કે ક્લાયન્ટ પ્રમાણે filter કરો', detailEn: 'Filter by date, transporter, or client' },
            { label: 'નવો ટ્રાન્સપોર્ટર ઉમેરો', labelEn: 'Add new transporter', path: 'Dispatch → Transporters → Add Transporter', detail: 'નામ, ફોન, વાહનનો પ્રકાર', detailEn: 'Name, phone, vehicle type' },
            { label: 'ટ્રાન્સપોર્ટર ડિટેલ્સ એડિટ કરો', labelEn: 'Edit transporter details', path: 'Dispatch → Transporters → [Name] → Edit', detail: 'ફોન, ભાવ અપડેટ કરો', detailEn: 'Update phone, rates' },
        ],
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '6. EOD રિપોર્ટ', titleEn: '6. EOD Report',
        subtitle: 'નીકળતા પહેલા સબમિટ કરો — રોજ', subtitleEn: 'Submit before leaving — daily',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'EOD રિપોર્ટ ખોલો', labelEn: 'Open EOD Report', path: 'EOD Report → Submit Report', detail: '' },
            { label: 'આજના ડિસ્પેચ અને QC લખો', labelEn: 'List dispatches, QC done today', path: 'What did you do today?', detail: 'જોબ નંબર, કન્ફર્મ થયેલી ડિલિવરી, QC ના પરિણામ', detailEn: 'Job numbers, deliveries confirmed, QC results' },
            { label: 'મોડું કે પ્રોબ્લેમ હોય તો નોંધો', labelEn: 'Note any delays or issues', path: 'Blockers section', detail: 'QC ફેલ, ટ્રાન્સપોર્ટ પ્રોબ્લેમ, મટીરિયલ ખૂટે છે', detailEn: 'Failed QC, transport issues, missing materials' },
            { label: 'સબમિટ કરો', labelEn: 'Submit', path: 'Submit EOD button', detail: '' },
        ],
    },
];

const flowItems = [
    { label: 'Job Printed', color: 'bg-cyan-600' },
    { label: 'QC Check', color: 'bg-red-600' },
    { label: 'Pass ✓', color: 'bg-green-600' },
    { label: 'Pack', color: 'bg-amber-600' },
    { label: 'Dispatch', color: 'bg-orange-600' },
    { label: 'Delivered ✓', color: 'bg-gray-800' },
];

export default function DispatchGuidePage() {
    const [openPhase, setOpenPhase] = useState<string | null>('daily');
    return (
        <div className="space-y-5 max-w-3xl pb-16">
            <div className="bg-orange-700 rounded-md p-5 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-300 rounded-md flex items-center justify-center">
                        <Truck className="w-5 h-5 text-orange-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Dispatch — આ App કેવી રીતે વાપરવી</h1>
                        <p className="text-orange-200 text-sm">QC → પેકિંગ → ડિસ્પેચ → ડિલિવર</p>
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Dispatch Flow</p>
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
                    { icon: '🔍', text: 'QC ક્યારેય ના છોડો. એક ભૂલ = આખું રિપ્રિન્ટ.', textEn: 'Never skip QC. One error costs a full reprint.' },
                    { icon: '📦', text: 'દરેક પેકેજ પર જોબ નંબર + ક્લાયન્ટ નામનું લેબલ લગાવો.', textEn: 'Label every package with job number + client name.' },
                    { icon: '🚚', text: 'Dispatch ક્લિક કરતા પહેલા ટ્રાન્સપોર્ટર એસાઇન કરો.', textEn: 'Assign transporter before clicking Dispatch.' },
                    { icon: '✅', text: 'ટ્રાન્સપોર્ટર કન્ફર્મ કરે પછી જ Delivered માર્ક કરો.', textEn: 'Mark Delivered only after transporter confirms.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-md text-xs text-orange-900">
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
