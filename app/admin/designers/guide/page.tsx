'use client';

import { useState } from 'react';
import {
    Palette, Clock, ListChecks, Upload, CheckCircle2, ChevronDown,
    ChevronRight, ArrowRight, AlertCircle, FileImage, MessageSquare,
    BarChart2, PenTool, Target
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
        subtitle: 'તમારી ક્યુ ખોલો અને કામ પ્લાન કરો', subtitleEn: 'Open your queue and plan your work',
        color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', headerBg: 'bg-pink-700',
        steps: [
            { label: 'તમારી પર્સનલ ક્યુ ખોલો', labelEn: 'Open your personal queue', path: 'Design Studio → My Queue', detail: 'ફક્ત તમને એસાઇન થયેલી બધી જોબ — ડેડલાઇન પ્રમાણે ગોઠવેલી', detailEn: 'See all jobs assigned specifically to you, sorted by deadline' },
            { label: 'તમારું કેલેન્ડર ચેક કરો', labelEn: 'Check your calendar', path: 'Calendar', detail: 'તમારા ટાસ્કની ડેડલાઇન અહીં દેખાય — આજે શું પૂરું કરવાનું છે તે એક નજરમાં', detailEn: 'Your task deadlines appear here — so you can see what\'s due today at a glance' },
            { label: 'ઓવરડ્યુ ટાસ્ક ચેક કરો', labelEn: 'Check for overdue tasks', path: 'My Queue → filter by deadline', detail: 'લાલ ડેડલાઇન બેજ = સમય વીતી ગયો. પહેલા આ પૂરા કરો.', detailEn: 'Red deadline badge = past due. Prioritise these first.' },
            { label: 'આજની નોટ્સ / સૂચનાઓ ચેક કરો', labelEn: 'Check today\'s briefings / notes', path: 'Design Studio → My Notes', detail: 'એડમિને સૂચના કે નવી જોબની ડિટેલ મૂકી હોઈ શકે', detailEn: 'Admin may have left instructions or new job details' },
        ],
        tip: 'હંમેશા પહેલા My Queue ચેક કરો. ઓવરડ્યુ ટાસ્ક પૂરા કર્યા વગર નવું ટાસ્ક શરૂ ના કરો.', tipEn: 'Always check My Queue first. Never start a new task before completing existing overdue ones.',
    },
    {
        id: 'pickup',
        icon: <PenTool className="w-5 h-5" />,
        title: '2. જોબ હાથમાં લેવી', titleEn: '2. Picking Up a Job',
        subtitle: 'જોબ એસાઇન થઈ → હવે જવાબદારી તમારી', subtitleEn: 'Job assigned → you take ownership',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'જોબ કાર્ડ ખોલો', labelEn: 'Open the job card', path: 'My Queue → [Job card] → Click to open', detail: 'ક્લાયન્ટ નામ, જરૂરિયાત, ડેડલાઇન, રેફરન્સ ફાઇલ્સ જુઓ', detailEn: 'See client name, requirements, deadline, reference files' },
            { label: 'બ્રીફ ધ્યાનથી વાંચો', labelEn: 'Read the brief carefully', path: 'Job Details → Notes / Brief section', detail: 'સ્પેક્સ: સાઇઝ, બ્લીડ, કલર, ક્વોન્ટિટી, ખાસ સૂચનાઓ', detailEn: 'Specs: size, bleed, colours, quantity, special instructions' },
            { label: 'રેફરન્સ ફાઇલ ડાઉનલોડ કરો', labelEn: 'Download reference files', path: 'Job Details → Files section → Download', detail: 'જૂનું આર્ટવર્ક, લોગો, બ્રાન્ડ ગાઇડ — Google Drive માંથી', detailEn: 'Old artwork, logo, brand guide from Google Drive' },
            { label: 'ટાસ્ક સ્ટેટસ Live કરો', labelEn: 'Set your task status to Live', path: 'My Queue → Task → 🟢 Live pill', detail: 'Live પિલ દબાવો એટલે ખબર પડે કે તમે કામ શરૂ કર્યું', detailEn: 'Tap the Live pill to show you\'ve started working' },
        ],
        tip: 'કામ શરૂ કરતા પહેલા આખું બ્રીફ વાંચો. પ્રિન્ટ થયા પછી ભૂલ સુધારવી ₹₹₹ માં પડે.', tipEn: 'Read the full brief before starting. Fixing mistakes after printing costs ₹₹₹.',
    },
    {
        id: 'status',
        icon: <ListChecks className="w-5 h-5" />,
        title: '3. ટાસ્ક સ્ટેટસ પિલ્સ — તમારી સિગ્નલ સિસ્ટમ', titleEn: '3. Task Status Pills — Your Signal System',
        subtitle: 'ટીમને હંમેશા ખબર રહે કે તમે ક્યાં પહોંચ્યા છો', subtitleEn: 'Tell the team exactly where you are at all times',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: '🟢 Live — હું અત્યારે આ કામ કરી રહ્યો છું', labelEn: '🟢 Live — I am actively working on this right now', path: 'My Queue / Tasks → Live pill', detail: 'જોબ હાથમાં લઈ ડિઝાઇન શરૂ કરો ત્યારે આ સેટ કરો', detailEn: 'Set this when you pick up and start designing' },
            { label: '🟡 Pause — કામ અટક્યું છે, કંઈકની રાહ જોવાય છે', labelEn: '🟡 Pause — Paused, waiting for something', path: 'My Queue / Tasks → Pause pill', detail: 'ક્લાયન્ટની ફાઇલ, ફીડબેક કે સ્પષ્ટતાની રાહ હોય ત્યારે વાપરો', detailEn: 'Use when waiting for client files, feedback, or clarification' },
            { label: '🔵 Review — ક્લાયન્ટ / ટીમને અપ્રૂવલ માટે મોકલ્યું', labelEn: '🔵 Review — Sent to client / team for approval', path: 'My Queue / Tasks → Review pill', detail: 'ડિઝાઇન પૂરી, હવે ફીડબેક કે અપ્રૂવલની રાહ', detailEn: 'Design is done, now awaiting feedback or sign-off' },
            { label: '✅ End — કામ પૂરું, આગળ સોંપવા તૈયાર', labelEn: '✅ End — Work complete, ready to hand off', path: 'My Queue / Tasks → End pill', detail: 'ફાઇનલ ફાઇલ અપલોડ થઈ ગઈ, બ્રીફ પૂરું — હવે એડમિન સંભાળે', detailEn: 'Final file uploaded, brief is fulfilled — admin takes over' },
            { label: '🔁 Transfer — બીજા ડિઝાઇનરને સોંપવું', labelEn: '🔁 Transfer — Reassigning to another designer', path: 'My Queue / Tasks → Transfer pill', detail: 'તમે પૂરું ના કરી શકો તો — એડમિનને કારણ જણાવો', detailEn: 'If you can\'t complete it — let admin know the reason' },
        ],
        tip: 'કંઈ પણ બદલાય એટલે તરત સ્ટેટસ અપડેટ કરો. એડમિન આ પિલ્સ જોઈને દરેક જોબની લાઇવ સ્થિતિ જાણે છે.', tipEn: 'Update your status every time something changes. Admin watches these pills to know the live state of every job.',
    },
    {
        id: 'work',
        icon: <FileImage className="w-5 h-5" />,
        title: '4. ડિઝાઇન પર કામ કરવું', titleEn: '4. Working on Design',
        subtitle: 'ક્રિએટિવ કામ કરો, પછી અપલોડ કરો', subtitleEn: 'Do the creative work, then upload',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'તમારા સોફ્ટવેરમાં ડિઝાઇન કરો', labelEn: 'Work on design in your software', path: '—', detail: 'Illustrator, Photoshop, CorelDRAW — તમારા ટૂલ્સ', detailEn: 'Illustrator, Photoshop, CorelDRAW — your tools' },
            { label: 'ચાલુ કામની (WIP) ફાઇલ અપલોડ કરો', labelEn: 'Upload work-in-progress file', path: 'Job Details → Files → Upload', detail: 'મોટું કામ સેવ થાય એટલે દર વખતે Google Drive પર અપલોડ કરો', detailEn: 'Upload to Google Drive every time you save major progress' },
            { label: 'શું કર્યું તેની નોટ ઉમેરો', labelEn: 'Add a note about what you did', path: 'Job Details → Notes → Add Note', detail: 'દા.ત.: "Draft 1 અપલોડ કર્યો. ક્લાયન્ટના કલર ફીડબેકની રાહ."', detailEn: 'Example: "Draft 1 uploaded. Awaiting client colour feedback."' },
            { label: 'ફીડબેક માટે તૈયાર થાય એટલે સ્ટેટસ Review કરો', labelEn: 'Set status to Review when ready for feedback', path: 'Task → 🔵 Review pill', detail: 'એડમિનને ખબર પડે કે હવે ક્લાયન્ટને મોકલવાનું છે', detailEn: 'Admin knows to send to client now' },
            { label: 'ફાઇનલ આર્ટવર્ક અપલોડ કરી સ્ટેટસ End કરો', labelEn: 'Upload final artwork and set status to End', path: 'Files → Upload final → Task → ✅ End pill', detail: 'બ્લીડ અને ક્રોપ માર્ક સાથે print-ready PDF કે AI ફાઇલ', detailEn: 'Print-ready PDF or AI file with bleeds & crops' },
        ],
        tip: 'ફાઇલ નિયમિત અપલોડ કરો — જોબ પૂરી થાય તેની રાહ ના જુઓ. લોકલ કામ ખોવાય તો Drive માં બેકઅપ રહે.', tipEn: 'Upload files regularly — don\'t wait until the job is done. If you lose local work, Drive has backup.',
    },
    {
        id: 'newjob',
        icon: <Upload className="w-5 h-5" />,
        title: '5. નવું ડિઝાઇન ટાસ્ક ઉમેરવું', titleEn: '5. Adding a New Design Task',
        subtitle: 'એડમિન કે તમે New Project થી ટાસ્ક બનાવી શકો', subtitleEn: 'Admin or you can create tasks via New Project',
        color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', headerBg: 'bg-teal-700',
        steps: [
            { label: 'New Project પર ક્લિક કરો', labelEn: 'Click New Project', path: 'Design Studio → + New Project', detail: 'ટાસ્ક બનાવવાનું આખું ફોર્મ ખૂલે', detailEn: 'Opens the full task creation form' },
            { label: 'ક્લાયન્ટ, જોબ ટાઇપ, ડેડલાઇન ભરો', labelEn: 'Fill in client, job type, deadline', path: 'New Project form', detail: 'હાલની જોબનો ભાગ હોય તો તેની સાથે લિંક કરો', detailEn: 'Link to an existing job if it\'s part of one' },
            { label: 'તમને કે બીજા ડિઝાઇનરને એસાઇન કરો', labelEn: 'Assign to yourself or a designer', path: 'Assign To field', detail: 'ટાસ્ક તરત તે ડિઝાઇનરની My Queue માં દેખાય', detailEn: 'Task appears in that designer\'s My Queue immediately' },
            { label: 'શરૂઆતનું સ્ટેટસ સેટ કરો', labelEn: 'Set initial status', path: 'Status field → Live / Pause', detail: 'અત્યારે શરૂ કરો તો Live, પછી કરવાનું હોય તો Pause', detailEn: 'Live if starting now, Hold if queued for later' },
        ],
        tip: 'મોટા ભાગના ટાસ્ક એડમિન બનાવે — પણ તમે તમારા કામ માટે સબ-ટાસ્ક બનાવી શકો.', tipEn: 'Admin creates most tasks — but you can create sub-tasks for your own workflow.',
    },
    {
        id: 'timeline',
        icon: <BarChart2 className="w-5 h-5" />,
        title: '6. તમારા કામનું ટ્રેકિંગ', titleEn: '6. Tracking Your Work',
        subtitle: 'ટાઇમલાઇન, ડોઝિયર, નોટ્સ', subtitleEn: 'Timeline, dossier, notes',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'તમારી ટાઇમલાઇન જુઓ', labelEn: 'View your timeline', path: 'Design Studio → Timeline', detail: 'તમારા બધા ટાસ્કનો તારીખ પ્રમાણે Gantt-સ્ટાઇલ ચાર્ટ', detailEn: 'Gantt-style bar chart of all your tasks by date' },
            { label: 'આખી જોબ હિસ્ટ્રી જુઓ (Dossier)', labelEn: 'View full job history (Dossier)', path: 'Design Studio → Dossier (admin only)', detail: 'એડમિન વ્યૂ: અત્યાર સુધીના બધા ટાસ્ક, સ્ટેટસ અને ટાઇમ લોગ સાથે', detailEn: 'Admin view: every task ever created with status and time logs' },
            { label: 'પર્સનલ સ્ટીકી નોટ્સ ઉમેરો', labelEn: 'Add personal sticky notes', path: 'Design Studio → My Notes', detail: 'ફક્ત તમને દેખાતી પ્રાઇવેટ નોટ્સ — રિમાઇન્ડર, કલર કોડ, ક્લાયન્ટની પસંદ માટે', detailEn: 'Private notes visible only to you — use for reminders, colour codes, client preferences' },
            { label: 'તમારું કેલેન્ડર ચેક કરો', labelEn: 'Check your calendar', path: 'Calendar', detail: 'તમારા ટાસ્કની ડેડલાઇન કેલેન્ડરમાં દેખાય — ફક્ત તમારા ટાસ્ક, બીજાના નહીં', detailEn: 'Deadlines for your assigned tasks show on the calendar — only YOUR tasks, not others' },
        ],
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '7. EOD રિપોર્ટ', titleEn: '7. EOD Report',
        subtitle: 'લોગ આઉટ પહેલા સબમિટ કરો — રોજ', subtitleEn: 'Submit before you log out — every day',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'End My Day બટન દબાવો', labelEn: 'Click End My Day button', path: 'Sidebar bottom → End My Day button', detail: 'આજનો EOD રિપોર્ટ ખૂલે', detailEn: 'This opens the EOD report for today' },
            { label: 'આજે પૂરી કરેલી ડિઝાઇન લખો', labelEn: 'List designs completed today', path: 'What did you do today?', detail: 'જોબ નામ / ટાસ્ક નામ / કયો ડ્રાફ્ટ પૂરો કર્યો', detailEn: 'Job name / task name / draft number completed' },
            { label: 'હજુ ચાલુ હોય તે ડિઝાઇન લખો', labelEn: 'List designs still in progress', path: 'Current WIP', detail: 'શું બાકી છે અને ક્યારે તૈયાર થશે?', detailEn: 'What\'s not done yet and when will it be ready?' },
            { label: 'અડચણો (blockers) લખો', labelEn: 'Mention blockers', path: 'Blockers section', detail: 'બ્રીફ નથી મળ્યું? ક્લાયન્ટ ફીડબેકની રાહ છે? અહીં નોંધો.', detailEn: 'Missing brief? Waiting for client feedback? Note it here.' },
            { label: 'સબમિટ કરો', labelEn: 'Submit', path: 'Submit EOD button', detail: 'એડમિન રોજ તમારું કામ રિવ્યૂ કરી રેટિંગ આપે', detailEn: 'Admin reviews your output daily and rates it' },
        ],
        tip: 'એડમિન તમારું ટાસ્ક સ્ટેટસ (Live/End) અને EOD ક્વોલિટી બંને જુએ છે. સબમિટ કરતા પહેલા સ્ટેટસ પિલ્સ અપડેટ કરો.', tipEn: 'Admin looks at both your task status (Live/End) AND your EOD quality. Update status pills before submitting.',
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
                    { icon: '📂', text: 'દરેક મોટા સેવ પછી Drive પર અપલોડ કરો — રાહ ના જુઓ.', textEn: 'Upload every major save to Drive — don\'t wait.' },
                    { icon: '📝', text: 'સ્ટેટસ બદલો ત્યારે દર વખતે નોટ ઉમેરો.', textEn: 'Add a note every time you change status.' },
                    { icon: '⏰', text: 'લાલ ડેડલાઇન = અરજન્ટ. પહેલા આ કરો.', textEn: 'Red deadline = urgent. Do this first.' },
                    { icon: '🎨', text: 'ફાઇનલ ફાઇલ અપલોડ કર્યા પછી હંમેશા Complete માર્ક કરો.', textEn: 'Always mark Complete after uploading final file.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-pink-50 border border-pink-100 rounded-md text-xs text-pink-900">
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
