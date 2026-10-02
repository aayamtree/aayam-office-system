'use client';

import { useState } from 'react';
import {
    TrendingUp, Phone, FileText, UserCheck, IndianRupee, Star,
    ChevronDown, ChevronRight, ArrowRight, AlertCircle, CheckCircle2,
    Zap, Calendar, MessageSquare, Target, Clock, Users
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
        subtitle: 'આજે શેના પર ધ્યાન આપવાનું છે તે ચેક કરો', subtitleEn: 'Check what needs your attention today',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'આજના ફોલો-અપ ચેક કરો', labelEn: 'Check today\'s follow-ups', path: 'Marketing → Follow-ups → Today tab', detail: 'આ ક્લાયન્ટ આજે તમારા કોલની રાહ જુએ છે', detailEn: 'These clients expect a call today' },
            { label: 'ઓવરડ્યુ ફોલો-અપ ચેક કરો', labelEn: 'Check overdue follow-ups', path: 'Marketing → Follow-ups → Overdue tab', detail: 'આ છૂટવા ના દો — તરત કોલ કરો', detailEn: 'Don\'t let these slip — call immediately' },
            { label: 'તમારી લીડ પાઇપલાઇન જુઓ', labelEn: 'View your leads pipeline', path: 'Marketing → Leads', detail: 'બધી એક્ટિવ લીડ અને તેમનું સ્ટેટસ', detailEn: 'See all active leads and their status' },
            { label: 'તમારા ઓર્ડર જુઓ', labelEn: 'Review your orders', path: 'Marketing → My Orders', detail: 'તમે લાવેલા ઓર્ડર ટ્રેક કરો', detailEn: 'Track orders you originated' },
            { label: 'ડિસ્પેચ થયેલા ઓર્ડર ચેક કરો', labelEn: 'Check dispatched orders', path: 'Marketing → Dispatched Orders', detail: 'તમારા ક્લાયન્ટના કયા ઓર્ડર ડિસ્પેચ કે ડિલિવર થયા તે જુઓ', detailEn: 'See which of your client orders have been dispatched or delivered' },
            { label: 'તમારું કેલેન્ડર ચેક કરો', labelEn: 'Check your calendar', path: 'Calendar', detail: 'તમારી ફોલો-અપ તારીખો અને લીડ ડેડલાઇન અહીં દેખાય — ફક્ત તમારી, બીજાની નહીં', detailEn: 'Your follow-up dates and lead deadlines show here — only your own, not others' },
        ],
        tip: 'નવી લીડ ઉમેરતા પહેલા આજના ફોલો-અપ પહેલા પૂરા કરો.', tipEn: 'Complete today\'s follow-ups FIRST before adding new leads.',
    },
    {
        id: 'leads',
        icon: <Users className="w-5 h-5" />,
        title: '2. નવી લીડ ઉમેરવી', titleEn: '2. Adding a New Lead',
        subtitle: 'કોઈ રસ બતાવે — તરત તેને ઉમેરો', subtitleEn: 'Someone shows interest — add them immediately',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'New Lead પર ક્લિક કરો', labelEn: 'Click New Lead', path: 'Marketing → Leads → + New Lead', detail: 'નામ, ફોન, સર્વિસ ટાઇપ, જરૂરિયાત ભરો', detailEn: 'Fill name, phone, service type, requirement' },
            { label: 'જરૂરિયાતની ડિટેલ ઉમેરો', labelEn: 'Add their requirement details', path: 'Lead Form → Requirement field', detail: 'ચોક્કસ લખો — પ્રોડક્ટ ટાઇપ, ક્વોન્ટિટી, ડેડલાઇન', detailEn: 'Be specific — product type, quantity, deadline' },
            { label: 'લીડ સેવ કરો', labelEn: 'Save the lead', path: 'Save Lead button', detail: 'લીડ તમારી પાઇપલાઇનમાં બની જાય', detailEn: 'Lead is created in your pipeline' },
            { label: 'ફોલો-અપ શેડ્યુલ કરો', labelEn: 'Schedule a follow-up', path: 'Lead card → status button (or lead number menu) → Add follow-up', detail: 'નોટ લખો અને ક્યારે પાછો કોલ કરશો તે તારીખ પસંદ કરો', detailEn: 'Write a note and pick the date you\'ll call back' },
            { label: 'દરેક કોલ પછી નોટ ઉમેરો', labelEn: 'Add notes after each call', path: 'Lead → Add Note', detail: 'શું વાત થઈ, વાંધા, આગળનું પગલું — બધું નોંધો', detailEn: 'Record what was discussed, objections, next step' },
        ],
        tip: 'લીડ માર્કેટિંગ વ્યક્તિને એડમિન એસાઇન કરે. લીડ એસાઇન ના થઈ હોય તો એડમિનને યાદ કરાવો.', tipEn: 'Admin assigns leads to marketing persons. If a lead has no assignment, remind admin.',
    },
    {
        id: 'followup',
        icon: <Phone className="w-5 h-5" />,
        title: '3. ફોલો-અપ કરવું', titleEn: '3. Following Up',
        subtitle: 'નિયમિત ફોલો-અપ = કન્વર્ઝન', subtitleEn: 'Consistent follow-ups = conversions',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'ફોલો-અપ ખોલો', labelEn: 'Open follow-up', path: 'Marketing → Follow-ups', detail: 'બધા આજના અને ઓવરડ્યુ ફોલો-અપ જુઓ', detailEn: 'See all due and overdue follow-ups' },
            { label: 'ક્લાયન્ટને કોલ કરો', labelEn: 'Call the client', path: '—', detail: 'ખરો કોલ app ની બહાર કરવાનો', detailEn: 'Make the actual call outside the app' },
            { label: 'પરિણામ + નોટ્સ રેકોર્ડ કરો', labelEn: 'Record outcome + notes', path: 'Follow-up → Add Note', detail: 'શું થયું? રસ છે? સમય જોઈએ? લીડ ગઈ?', detailEn: 'What happened? Interested? Need more time? Lost?' },
            { label: 'લીડ સ્ટેટસ અપડેટ કરો', labelEn: 'Update lead status', path: 'Lead card → coloured status button → Switch to', detail: 'Fresh Lead / In Followup / In Review / Deal Done / Cancelled / Not Interested / Not In Product. નોટ ફરજિયાત; History માં દેખાય.', detailEn: 'Fresh Lead / In Followup / In Review / Deal Done / Cancelled / Not Interested / Not In Product. A note is required; it shows in History.' },
            { label: 'આગળનું ફોલો-અપ સેટ કરો', labelEn: 'Reschedule next follow-up', path: 'Lead → Add follow-up (or the date in the Switch box)', detail: 'Deal Done કે Cancelled થાય ત્યાં સુધી લૂપ ચાલુ રાખો', detailEn: 'Keep the loop going until Deal Done or closed' },
        ],
        tip: 'લીડને Lost માર્ક કરતા પહેલા 3–5 ફોલો-અપ થાય તે નોર્મલ છે.', tipEn: '3–5 follow-ups before marking a lead as Lost is normal.',
    },
    {
        id: 'quotation',
        icon: <FileText className="w-5 h-5" />,
        title: '4. ક્વોટેશન બનાવવું', titleEn: '4. Creating a Quotation',
        subtitle: 'ક્લાયન્ટને ફોર્મલ ભાવ મોકલો', subtitleEn: 'Send a formal price to the client',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'લીડ પરથી ક્વોટેશન બનાવો', labelEn: 'Make a quotation from the lead', path: 'Marketing → Leads → lead number menu → Make quotation', detail: 'ક્લાયન્ટ ઓટોમેટિક બને અથવા જૂનો ક્લાયન્ટ લિંક થાય, અને લીડ ક્વોટેશન સાથે જોડાય. Cancelled / Not Interested / Not In Product લીડ પર આ ઓપ્શન નથી.', detailEn: 'The client is made (or the existing one linked) and the lead is attached to the quotation. The option is hidden for Cancelled / Not Interested / Not In Product leads.' },
            { label: 'જોબ ડિટેલ્સ અને ભાવ ઉમેરો', labelEn: 'Add job details & pricing', path: 'Quotation form → Items, GST, total', detail: 'પ્રોડક્ટ, ક્વોન્ટિટી, રેટ અલગ-અલગ લખો', detailEn: 'Break down product, qty, rate' },
            { label: 'સેવ કરી ક્લાયન્ટને મોકલો', labelEn: 'Save & share with client', path: 'Save → Share / Print', detail: 'WhatsApp કે ઇમેઇલથી મોકલો', detailEn: 'Send via WhatsApp or email' },
            { label: 'ક્વોટેશન પર ફોલો-અપ કરો', labelEn: 'Follow up on quotation', path: 'Marketing → Follow-ups → Quotation tab', detail: '1–2 દિવસમાં પાછું પૂછો', detailEn: 'Check back in 1–2 days' },
        ],
    },
    {
        id: 'convert',
        icon: <UserCheck className="w-5 h-5" />,
        title: '5. લીડ કન્વર્ટ કરવી', titleEn: '5. Converting a Lead',
        subtitle: 'ક્લાયન્ટ હા પાડે — ઓર્ડરમાં કન્વર્ટ કરો', subtitleEn: 'Client says YES — convert to order',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'લીડ ખોલો', labelEn: 'Open the lead', path: 'Marketing → Leads → [Lead name]', detail: '' },
            { label: 'Convert to Client પર ક્લિક કરો', labelEn: 'Click Convert to Client', path: 'Lead → Convert to Client button', detail: 'CRM માં ક્લાયન્ટ રેકોર્ડ ઓટોમેટિક બની જાય', detailEn: 'Creates client record in CRM automatically' },
            { label: 'એડમિન જોબ બનાવે', labelEn: 'Admin creates the job', path: 'Jobs → New Job → Select this client', detail: 'જોબ તમે નહીં — બ્રીફિંગ પછી એડમિન બનાવે', detailEn: 'You don\'t create jobs — admin does after briefing' },
            { label: 'એડમિનને જરૂરિયાત સમજાવો', labelEn: 'Brief admin on requirements', path: '—', detail: 'બધા સ્પેક્સ આપો: સાઇઝ, ક્વોન્ટિટી, મટીરિયલ, ડેડલાઇન', detailEn: 'Share all specs: size, qty, material, deadline' },
        ],
        tip: 'આ ક્લાયન્ટ માટે જોબ બને તે ક્ષણથી તમારું કમિશન ટ્રેક થવા લાગે.', tipEn: 'Your commission starts being tracked from the moment a job is created for this client.',
    },
    {
        id: 'commission',
        icon: <IndianRupee className="w-5 h-5" />,
        title: '6. તમારું કમિશન', titleEn: '6. Your Commission',
        subtitle: 'ઓટોમેટિક — કોઈ મેન્યુઅલ એન્ટ્રી નહીં', subtitleEn: 'Automatic — no manual entry needed',
        color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', headerBg: 'bg-yellow-700',
        steps: [
            { label: 'જોબનું પૂરું પેમેન્ટ થાય એટલે કમિશન ઓટોમેટિક બને', labelEn: 'Commission is auto-created when job is fully paid', path: 'Marketing → Commissions', detail: 'સ્ટેટસ "Eligible" દેખાય — એડમિન અપ્રૂવલની રાહ', detailEn: 'Status shows "Eligible" — waiting admin approval' },
            { label: 'એડમિન અપ્રૂવ કરી % સેટ કરે', labelEn: 'Admin approves & sets the %', path: 'Admin action — તમારું કામ નહીં', detail: 'તમારી પ્રોફાઇલના રેટ પ્રમાણે અથવા જોબ પ્રમાણે અલગ', detailEn: 'Based on your profile rate or custom per job' },
            { label: 'એડમિન રૂબરૂ પેમેન્ટ કરી Paid માર્ક કરે', labelEn: 'Admin pays you physically + marks paid', path: 'Admin action', detail: 'App માં સ્ટેટસ "Paid" થઈ જાય', detailEn: 'Status updates to "Paid" in the app' },
            { label: 'તમારી કમાણી જુઓ', labelEn: 'View your earnings', path: 'Marketing → Dashboard → Commission widget', detail: 'Pending / Approved / Paid રકમ સ્પષ્ટ દેખાય', detailEn: 'Pending / Approved / Paid amounts clearly shown' },
        ],
        tip: 'કમિશન GST બાદ કરેલી BASE રકમ પર ગણાય. દા.ત.: ₹1,18,000 ની જોબ, 18% GST → base = ₹1,00,000 → 5% કમિશન = ₹5,000.', tipEn: 'Commissions are on the BASE amount after GST is deducted. Example: ₹1,18,000 job at 18% GST → base = ₹1,00,000 → 5% commission = ₹5,000.',
    },
    {
        id: 'dispatched',
        icon: <MessageSquare className="w-5 h-5" />,
        title: '7. ડિસ્પેચ થયેલા ઓર્ડર', titleEn: '7. Dispatched Orders',
        subtitle: 'તમારા ક્લાયન્ટની ડિલિવરી ટ્રેક કરો', subtitleEn: 'Track deliveries for your clients',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Dispatched Orders ખોલો', labelEn: 'Open Dispatched Orders', path: 'Marketing → Dispatched Orders', detail: 'તમારી લીડ સાથે જોડાયેલી ડિસ્પેચ કે ડિલિવર થયેલી બધી જોબ', detailEn: 'See all jobs linked to your leads that are dispatched or delivered' },
            { label: 'ક્લાયન્ટ સાથે ડિલિવરી કન્ફર્મ કરો', labelEn: 'Confirm delivery with client', path: '—', detail: 'કોલ કરી પૂછો કે ઓર્ડર સારી હાલતમાં મળ્યો કે નહીં', detailEn: 'Call the client to confirm they received the order in good condition' },
            { label: 'ડિલિવરી ફીડબેક નોંધો', labelEn: 'Note any delivery feedback', path: 'Lead / Job → Add Note', detail: 'ક્લાયન્ટનો ફીડબેક — ક્વોલિટી પ્રોબ્લેમ, ફરી ઓર્ડરની શક્યતા, રેફરલ', detailEn: 'Add any client feedback — quality issues, reorder interest, referrals' },
        ],
        tip: 'ડિલિવર થયેલો ઓર્ડર = રિપીટ ઓર્ડર કે રેફરલ માંગવાની તક. હંમેશા ફોલો-અપ કરો.', tipEn: 'A delivered order is an opportunity to ask for a repeat order or referral. Always follow up.',
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '8. EOD રિપોર્ટ (End of Day)', titleEn: '8. EOD Report (End of Day)',
        subtitle: 'નીકળતા પહેલા સબમિટ કરો — રોજ', subtitleEn: 'Submit before leaving — every day',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'EOD રિપોર્ટ ખોલો', labelEn: 'Open EOD Report', path: 'EOD Report → Submit Report', detail: 'દિવસમાં ફક્ત એક જ વાર', detailEn: 'Available only once per day' },
            { label: 'આજે પૂરા કરેલા કામ લખો', labelEn: 'List today\'s tasks completed', path: 'What did you do today?', detail: 'કેટલા કોલ, નવી લીડ, મોકલેલા ક્વોટેશન, મીટિંગ', detailEn: 'Calls made, leads added, quotations sent, meetings done' },
            { label: 'અડચણ હોય તો લખો', labelEn: 'Mention blockers if any', path: 'Blockers section', detail: 'લીડ કન્વર્ટ કરવામાં જે કંઈ નડતું હોય', detailEn: 'Anything stopping you from converting leads' },
            { label: 'કાલનો પ્લાન લખો', labelEn: 'Add tomorrow\'s plan', path: 'Tomorrow\'s plan section', detail: 'કઈ લીડ પર ફોલો-અપ કરશો?', detailEn: 'Which leads will you follow up on?' },
            { label: 'સબમિટ કરો', labelEn: 'Submit', path: 'Submit EOD button', detail: 'એડમિનને નોટિફિકેશન મળે', detailEn: 'Admin gets notified' },
        ],
        tip: 'EOD રિપોર્ટ રોજ સબમિટ કરવો ફરજિયાત. એડમિન રિવ્યૂ કરી રેટિંગ આપે.', tipEn: 'EOD report must be submitted daily. Admin reviews and rates your report.',
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
                    { icon: '📞', text: 'પહેલા કોલ, પછી app અપડેટ. નોટ ઉમેરવામાં મોડું ના કરો.', textEn: 'Call first, then update app. Don\'t delay adding notes.' },
                    { icon: '💬', text: 'દરેક કોલ પછી નોટ ઉમેરો — એડમિન આ વાંચે છે.', textEn: 'Add notes after EVERY call — admin reads these.' },
                    { icon: '📅', text: 'હંમેશા આગળની ફોલો-અપ તારીખ સેટ કરો — લીડ લટકતી ના મૂકો.', textEn: 'Always set a next follow-up date — never leave a lead hanging.' },
                    { icon: '💰', text: 'ક્લાયન્ટ પૂરું પેમેન્ટ કરે પછી જ કમિશન બને.', textEn: 'Commission only happens after the client FULLY pays.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-900">
                        <span className="text-base">{r.icon}</span>
                        <span>{r.text}{r.textEn && <span className="block opacity-70 mt-0.5">{r.textEn}</span>}</span>
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
