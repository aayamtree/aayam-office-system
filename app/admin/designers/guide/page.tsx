'use client';

import { useState } from 'react';
import {
    Palette, Clock, ListChecks, Upload, CheckCircle2, ChevronDown,
    ChevronRight, ArrowRight, AlertCircle, FileImage, MessageSquare,
    BarChart2, PenTool, Target
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
        subtitle: 'તમારી ક્યુ ખોલો અને કામ પ્લાન કરો',
        color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', headerBg: 'bg-pink-700',
        steps: [
            { label: 'તમારી પર્સનલ ક્યુ ખોલો', path: 'Design Studio → My Queue', detail: 'ફક્ત તમને એસાઇન થયેલી બધી જોબ — ડેડલાઇન પ્રમાણે ગોઠવેલી' },
            { label: 'તમારું કેલેન્ડર ચેક કરો', path: 'Calendar', detail: 'તમારા ટાસ્કની ડેડલાઇન અહીં દેખાય — આજે શું પૂરું કરવાનું છે તે એક નજરમાં' },
            { label: 'ઓવરડ્યુ ટાસ્ક ચેક કરો', path: 'My Queue → filter by deadline', detail: 'લાલ ડેડલાઇન બેજ = સમય વીતી ગયો. પહેલા આ પૂરા કરો.' },
            { label: 'આજની નોટ્સ / સૂચનાઓ ચેક કરો', path: 'Design Studio → My Notes', detail: 'એડમિને સૂચના કે નવી જોબની ડિટેલ મૂકી હોઈ શકે' },
        ],
        tip: 'હંમેશા પહેલા My Queue ચેક કરો. ઓવરડ્યુ ટાસ્ક પૂરા કર્યા વગર નવું ટાસ્ક શરૂ ના કરો.',
    },
    {
        id: 'pickup',
        icon: <PenTool className="w-5 h-5" />,
        title: '2. જોબ હાથમાં લેવી',
        subtitle: 'જોબ એસાઇન થઈ → હવે જવાબદારી તમારી',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'જોબ કાર્ડ ખોલો', path: 'My Queue → [Job card] → Click to open', detail: 'ક્લાયન્ટ નામ, જરૂરિયાત, ડેડલાઇન, રેફરન્સ ફાઇલ્સ જુઓ' },
            { label: 'બ્રીફ ધ્યાનથી વાંચો', path: 'Job Details → Notes / Brief section', detail: 'સ્પેક્સ: સાઇઝ, બ્લીડ, કલર, ક્વોન્ટિટી, ખાસ સૂચનાઓ' },
            { label: 'રેફરન્સ ફાઇલ ડાઉનલોડ કરો', path: 'Job Details → Files section → Download', detail: 'જૂનું આર્ટવર્ક, લોગો, બ્રાન્ડ ગાઇડ — Google Drive માંથી' },
            { label: 'ટાસ્ક સ્ટેટસ Live કરો', path: 'My Queue → Task → 🟢 Live pill', detail: 'Live પિલ દબાવો એટલે ખબર પડે કે તમે કામ શરૂ કર્યું' },
        ],
        tip: 'કામ શરૂ કરતા પહેલા આખું બ્રીફ વાંચો. પ્રિન્ટ થયા પછી ભૂલ સુધારવી ₹₹₹ માં પડે.',
    },
    {
        id: 'status',
        icon: <ListChecks className="w-5 h-5" />,
        title: '3. ટાસ્ક સ્ટેટસ પિલ્સ — તમારી સિગ્નલ સિસ્ટમ',
        subtitle: 'ટીમને હંમેશા ખબર રહે કે તમે ક્યાં પહોંચ્યા છો',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: '🟢 Live — હું અત્યારે આ કામ કરી રહ્યો છું', path: 'My Queue / Tasks → Live pill', detail: 'જોબ હાથમાં લઈ ડિઝાઇન શરૂ કરો ત્યારે આ સેટ કરો' },
            { label: '🟡 Pause — કામ અટક્યું છે, કંઈકની રાહ જોવાય છે', path: 'My Queue / Tasks → Pause pill', detail: 'ક્લાયન્ટની ફાઇલ, ફીડબેક કે સ્પષ્ટતાની રાહ હોય ત્યારે વાપરો' },
            { label: '🔵 Review — ક્લાયન્ટ / ટીમને અપ્રૂવલ માટે મોકલ્યું', path: 'My Queue / Tasks → Review pill', detail: 'ડિઝાઇન પૂરી, હવે ફીડબેક કે અપ્રૂવલની રાહ' },
            { label: '✅ End — કામ પૂરું, આગળ સોંપવા તૈયાર', path: 'My Queue / Tasks → End pill', detail: 'ફાઇનલ ફાઇલ અપલોડ થઈ ગઈ, બ્રીફ પૂરું — હવે એડમિન સંભાળે' },
            { label: '🔁 Transfer — બીજા ડિઝાઇનરને સોંપવું', path: 'My Queue / Tasks → Transfer pill', detail: 'તમે પૂરું ના કરી શકો તો — એડમિનને કારણ જણાવો' },
        ],
        tip: 'કંઈ પણ બદલાય એટલે તરત સ્ટેટસ અપડેટ કરો. એડમિન આ પિલ્સ જોઈને દરેક જોબની લાઇવ સ્થિતિ જાણે છે.',
    },
    {
        id: 'work',
        icon: <FileImage className="w-5 h-5" />,
        title: '4. ડિઝાઇન પર કામ કરવું',
        subtitle: 'ક્રિએટિવ કામ કરો, પછી અપલોડ કરો',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'તમારા સોફ્ટવેરમાં ડિઝાઇન કરો', path: '—', detail: 'Illustrator, Photoshop, CorelDRAW — તમારા ટૂલ્સ' },
            { label: 'ચાલુ કામની (WIP) ફાઇલ અપલોડ કરો', path: 'Job Details → Files → Upload', detail: 'મોટું કામ સેવ થાય એટલે દર વખતે Google Drive પર અપલોડ કરો' },
            { label: 'શું કર્યું તેની નોટ ઉમેરો', path: 'Job Details → Notes → Add Note', detail: 'દા.ત.: "Draft 1 અપલોડ કર્યો. ક્લાયન્ટના કલર ફીડબેકની રાહ."' },
            { label: 'ફીડબેક માટે તૈયાર થાય એટલે સ્ટેટસ Review કરો', path: 'Task → 🔵 Review pill', detail: 'એડમિનને ખબર પડે કે હવે ક્લાયન્ટને મોકલવાનું છે' },
            { label: 'ફાઇનલ આર્ટવર્ક અપલોડ કરી સ્ટેટસ End કરો', path: 'Files → Upload final → Task → ✅ End pill', detail: 'બ્લીડ અને ક્રોપ માર્ક સાથે print-ready PDF કે AI ફાઇલ' },
        ],
        tip: 'ફાઇલ નિયમિત અપલોડ કરો — જોબ પૂરી થાય તેની રાહ ના જુઓ. લોકલ કામ ખોવાય તો Drive માં બેકઅપ રહે.',
    },
    {
        id: 'newjob',
        icon: <Upload className="w-5 h-5" />,
        title: '5. નવું ડિઝાઇન ટાસ્ક ઉમેરવું',
        subtitle: 'એડમિન કે તમે New Project થી ટાસ્ક બનાવી શકો',
        color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', headerBg: 'bg-teal-700',
        steps: [
            { label: 'New Project પર ક્લિક કરો', path: 'Design Studio → + New Project', detail: 'ટાસ્ક બનાવવાનું આખું ફોર્મ ખૂલે' },
            { label: 'ક્લાયન્ટ, જોબ ટાઇપ, ડેડલાઇન ભરો', path: 'New Project form', detail: 'હાલની જોબનો ભાગ હોય તો તેની સાથે લિંક કરો' },
            { label: 'તમને કે બીજા ડિઝાઇનરને એસાઇન કરો', path: 'Assign To field', detail: 'ટાસ્ક તરત તે ડિઝાઇનરની My Queue માં દેખાય' },
            { label: 'શરૂઆતનું સ્ટેટસ સેટ કરો', path: 'Status field → Live / Pause', detail: 'અત્યારે શરૂ કરો તો Live, પછી કરવાનું હોય તો Pause' },
        ],
        tip: 'મોટા ભાગના ટાસ્ક એડમિન બનાવે — પણ તમે તમારા કામ માટે સબ-ટાસ્ક બનાવી શકો.',
    },
    {
        id: 'timeline',
        icon: <BarChart2 className="w-5 h-5" />,
        title: '6. તમારા કામનું ટ્રેકિંગ',
        subtitle: 'ટાઇમલાઇન, ડોઝિયર, નોટ્સ',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'તમારી ટાઇમલાઇન જુઓ', path: 'Design Studio → Timeline', detail: 'તમારા બધા ટાસ્કનો તારીખ પ્રમાણે Gantt-સ્ટાઇલ ચાર્ટ' },
            { label: 'આખી જોબ હિસ્ટ્રી જુઓ (Dossier)', path: 'Design Studio → Dossier (admin only)', detail: 'એડમિન વ્યૂ: અત્યાર સુધીના બધા ટાસ્ક, સ્ટેટસ અને ટાઇમ લોગ સાથે' },
            { label: 'પર્સનલ સ્ટીકી નોટ્સ ઉમેરો', path: 'Design Studio → My Notes', detail: 'ફક્ત તમને દેખાતી પ્રાઇવેટ નોટ્સ — રિમાઇન્ડર, કલર કોડ, ક્લાયન્ટની પસંદ માટે' },
            { label: 'તમારું કેલેન્ડર ચેક કરો', path: 'Calendar', detail: 'તમારા ટાસ્કની ડેડલાઇન કેલેન્ડરમાં દેખાય — ફક્ત તમારા ટાસ્ક, બીજાના નહીં' },
        ],
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '7. EOD રિપોર્ટ',
        subtitle: 'લોગ આઉટ પહેલા સબમિટ કરો — રોજ',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'End My Day બટન દબાવો', path: 'Sidebar bottom → End My Day button', detail: 'આજનો EOD રિપોર્ટ ખૂલે' },
            { label: 'આજે પૂરી કરેલી ડિઝાઇન લખો', path: 'What did you do today?', detail: 'જોબ નામ / ટાસ્ક નામ / કયો ડ્રાફ્ટ પૂરો કર્યો' },
            { label: 'હજુ ચાલુ હોય તે ડિઝાઇન લખો', path: 'Current WIP', detail: 'શું બાકી છે અને ક્યારે તૈયાર થશે?' },
            { label: 'અડચણો (blockers) લખો', path: 'Blockers section', detail: 'બ્રીફ નથી મળ્યું? ક્લાયન્ટ ફીડબેકની રાહ છે? અહીં નોંધો.' },
            { label: 'સબમિટ કરો', path: 'Submit EOD button', detail: 'એડમિન રોજ તમારું કામ રિવ્યૂ કરી રેટિંગ આપે' },
        ],
        tip: 'એડમિન તમારું ટાસ્ક સ્ટેટસ (Live/End) અને EOD ક્વોલિટી બંને જુએ છે. સબમિટ કરતા પહેલા સ્ટેટસ પિલ્સ અપડેટ કરો.',
    },
];

const flowItems = [
    { label: 'Job Assigned', color: 'bg-pink-500' },
    { label: 'Read Brief', color: 'bg-violet-500' },
    { label: 'Add Task', color: 'bg-blue-500' },
    { label: 'Design', color: 'bg-blue-600' },
    { label: 'Upload', color: 'bg-cyan-600' },
    { label: 'Mark Complete', color: 'bg-green-600' },
    { label: 'Approval', color: 'bg-amber-500' },
    { label: 'Printing ✓', color: 'bg-gray-800' },
];

export default function DesignerGuidePage() {
    const [openPhase, setOpenPhase] = useState<string | null>('daily');

    return (
        <div className="space-y-5 max-w-3xl pb-16">
            <div className="bg-pink-700 rounded-md p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-yellow-300 rounded-md flex items-center justify-center">
                        <Palette className="w-5 h-5 text-pink-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Design Studio — આ App કેવી રીતે વાપરવી</h1>
                        <p className="text-pink-200 text-sm">તમારું રોજનું કામ: બ્રીફ → ડિઝાઇન → અપલોડ → પૂરું</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">તમારો Work Flow</p>
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
                    { icon: '📂', text: 'દરેક મોટા સેવ પછી Drive પર અપલોડ કરો — રાહ ના જુઓ.' },
                    { icon: '📝', text: 'સ્ટેટસ બદલો ત્યારે દર વખતે નોટ ઉમેરો.' },
                    { icon: '⏰', text: 'લાલ ડેડલાઇન = અરજન્ટ. પહેલા આ કરો.' },
                    { icon: '🎨', text: 'ફાઇનલ ફાઇલ અપલોડ કર્યા પછી હંમેશા Complete માર્ક કરો.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-pink-50 border border-pink-100 rounded-md text-xs text-pink-900">
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
