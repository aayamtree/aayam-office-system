'use client';

import { useState } from 'react';
import {
    TrendingUp, Phone, FileText, UserCheck, IndianRupee, Star,
    ChevronDown, ChevronRight, ArrowRight, AlertCircle, CheckCircle2,
    Calendar, Target, Clock, Users, Send
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
        title: '1. Attendance — Office Aate Hi Login Karo',
        subtitle: 'Subah pehle kaam — attendance mark karo',
        color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', headerBg: 'bg-emerald-700',
        steps: [
            { label: 'Office aate hi app open karo aur Login karo', path: 'Sidebar → Attendance → Login', detail: 'Tumhara time record hona start hota hai. Bina login ke kaam ka time count nahi hoga.' },
            { label: 'Din bhar app normally use karo', path: '—', detail: 'Heartbeat automatic track hoti hai — kuch alag nahi karna' },
            { label: 'Shaam ko Logout karo', path: 'Sidebar → Attendance → Logout', detail: 'Logout ke time ek chhota summary bharna hoga — EOD ke saath hi kar do' },
        ],
        tip: 'Attendance sirf attendance nahi hai — admin isse dekhta hai ki tum kab se kab tak active the. Logout karna mat bhoolna!',
    },
    {
        id: 'daily',
        icon: <Clock className="w-5 h-5" />,
        title: '2. Subah Ka Routine — Yeh Pehle Karo',
        subtitle: 'Din ki shuruaat in 5 cheezein se karo',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Aaj ke follow-ups check karo', path: 'Marketing → Follow-ups → Today tab', detail: 'Yeh clients aaj call ka wait kar rahe hain — pehle inhe karo' },
            { label: 'Overdue follow-ups check karo', path: 'Marketing → Follow-ups → Overdue tab', detail: 'Yeh late ho gaye hain — foran call karo, aur late mat karo' },
            { label: 'Apna leads pipeline dekho', path: 'Marketing → Leads', detail: 'Sab active leads aur unka current status' },
            { label: 'Apne orders dekho', path: 'Marketing → My Orders', detail: 'Tumhare client ke orders ka status — printing mein hai, dispatch hua, deliver hua?' },
            { label: 'Calendar check karo', path: 'Calendar', detail: 'Aaj ke follow-up dates aur lead deadlines — sirf tumhare, doosron ke nahi' },
        ],
        tip: 'Pehle aaj ke follow-ups karo. New leads baad mein add karo. Follow-up miss karna = lead lose karna.',
    },
    {
        id: 'leads',
        icon: <Users className="w-5 h-5" />,
        title: '3. Naya Lead Add Karna',
        subtitle: 'Koi bhi interest dikhaye — foran app mein daalo',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'New Lead click karo', path: 'Marketing → Leads → + New Lead', detail: 'Naam, phone, service type, requirement — sab bharo' },
            { label: 'Requirement detail mein likho', path: 'Lead Form → Requirement field', detail: 'Product type, quantity, deadline — jitna specific utna better' },
            { label: 'Lead save karo', path: 'Save Lead button', detail: 'Tumhare pipeline mein aa jaayega' },
            { label: 'Follow-up date set karo', path: 'Lead card → Set Follow-up Date', detail: 'Kab call karoge — ek specific date choose karo' },
            { label: 'Har call ke baad note add karo', path: 'Lead → Add Note', detail: 'Kya baat hui, kya objection tha, next step kya hai' },
        ],
        tip: 'Admin leads assign karta hai tumhare paas. Agar koi lead unassigned hai toh admin ko remind karo — warna commission nahi milega.',
    },
    {
        id: 'followup',
        icon: <Phone className="w-5 h-5" />,
        title: '4. Follow-Up Karna — Consistency Hi Conversion Hai',
        subtitle: 'Baar baar follow up karo — leads convert hoti hain',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'Follow-up list kholo', path: 'Marketing → Follow-ups', detail: 'Aaj ke aur overdue sab dikhenge' },
            { label: 'Client ko call karo', path: '—', detail: 'App ke bahar actual call karo' },
            { label: 'Call ka outcome + note likhho', path: 'Follow-up → Add Note', detail: 'Kya hua? Interested hai? Time chahiye? Lost ho gaya?' },
            { label: 'Lead status update karo', path: 'Lead → Edit Status', detail: 'Follow-up / Quoted / Negotiating / Converted / Lost — sahi status lagao' },
            { label: 'Agla follow-up date set karo', path: 'Lead → Set Next Follow-up Date', detail: 'Jab tak convert ya lost na ho — loop chalate raho' },
        ],
        tip: 'Normal hai ki 3–5 follow-ups ke baad lead convert ho. Pehle call pe "nahi" sunke mat rukko.',
    },
    {
        id: 'quotation',
        icon: <FileText className="w-5 h-5" />,
        title: '5. Quotation Banana',
        subtitle: 'Client ko formal price bhejo',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'Naya quotation banao', path: 'Marketing → Quotations → New Quotation', detail: 'Lead se link karo' },
            { label: 'Job details aur pricing bharo', path: 'Quotation form → Items, GST, total', detail: 'Product, quantity, rate — clearly breakdown karo' },
            { label: 'Save karke client ko bhejo', path: 'Save → Share / Print', detail: 'WhatsApp ya email se bhejo' },
            { label: '1–2 din mein follow-up karo quotation pe', path: 'Marketing → Follow-ups', detail: 'Client ne quotation dekha? Koi sawaal hai? Budget fit hai?' },
        ],
    },
    {
        id: 'convert',
        icon: <UserCheck className="w-5 h-5" />,
        title: '6. Lead Convert Karna — Client Tayyar Ho Gaya!',
        subtitle: 'Client ne haan kaha — ab yeh karo',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'Lead kholo', path: 'Marketing → Leads → [Lead name]', detail: '' },
            { label: 'Convert to Client click karo', path: 'Lead → Convert to Client button', detail: 'Automatically CRM mein client record ban jaata hai' },
            { label: 'Admin ko sab specifications batao', path: '—', detail: 'Size, quantity, material, deadline — koi bhi cheez chhupo mat' },
            { label: 'Admin job create karta hai', path: 'Jobs → New Job → Select this client', detail: 'Tum job nahi banaate — admin banata hai briefing ke baad' },
        ],
        tip: 'Tumhara commission us moment se track hona start ho jaata hai jab is client ke liye job create hoti hai.',
    },
    {
        id: 'commission',
        icon: <IndianRupee className="w-5 h-5" />,
        title: '7. Tumhara Commission',
        subtitle: 'Automatic track hota hai — kuch karna nahi',
        color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', headerBg: 'bg-yellow-700',
        steps: [
            { label: 'Jab job fully paid ho jaaye tab commission "Eligible" ho jaata hai', path: 'Marketing → Commissions', detail: 'Automatic — tumhe kuch nahi karna. Status "Eligible" dikhega.' },
            { label: 'Admin % set karke approve karta hai', path: 'Admin ka kaam — tumhara nahi', detail: 'Tumhare profile rate pe ya custom per job' },
            { label: 'Admin physically paisa deta hai aur "Paid" mark karta hai', path: 'Admin ka kaam', detail: 'App mein "Paid" status update ho jaata hai' },
            { label: 'Apni earnings dekho', path: 'Marketing → Dashboard → Commission widget', detail: 'Eligible / Approved / Paid — clearly dikhega' },
        ],
        tip: 'Commission base amount pe hota hai (GST remove karke). Example: ₹1,18,000 job at 18% GST → base = ₹1,00,000 → 5% commission = ₹5,000. Poora paisa milne ke baad hi milega.',
    },
    {
        id: 'dispatched',
        icon: <Send className="w-5 h-5" />,
        title: '8. Dispatched Orders — Apne Client Ka Track Rakho',
        subtitle: 'Tumhare client ka order deliver hua ya nahi?',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Dispatched Orders kholo', path: 'Marketing → Dispatched Orders', detail: 'Tumhare leads se linked jo orders dispatch ya deliver ho gaye hain' },
            { label: 'Client ko call karke confirm karo', path: '—', detail: 'Order mila? Condition theek hai? Khush hai?' },
            { label: 'Koi feedback ho toh note karo', path: 'Lead / Job → Add Note', detail: 'Quality issue, reorder interest, referral — sab yahan likho' },
        ],
        tip: 'Delivery ke baad follow-up karna = repeat order ya referral ka chance. Is opportunity ko waste mat karo!',
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '9. EOD Report — Roz Bharna Zaroori',
        subtitle: 'Attendance logout ke saath EOD bhi submit karo',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'EOD Report kholo', path: 'EOD Report → Submit Report', detail: 'Ek din mein sirf ek baar submit hota hai' },
            { label: 'Aaj kya kiya — list karo', path: 'What did you do today?', detail: 'Calls ki, leads add kiye, quotations bheje, meetings hui' },
            { label: 'Koi blocker ho toh batao', path: 'Blockers section', detail: 'Kya cheez hai jo lead convert karne se rok rahi hai' },
            { label: 'Kal ka plan likho', path: "Tomorrow's plan section", detail: 'Kaun se leads pe follow-up karoge?' },
            { label: 'Submit karo', path: 'Submit EOD button', detail: 'Admin ko notification milti hai' },
        ],
        tip: 'EOD roz bharna compulsory hai. Admin review karta hai aur rate karta hai. Kaam ki quality isse bhi judge hoti hai.',
    },
];

const flowItems = [
    { label: 'Login ✓', color: 'bg-emerald-600' },
    { label: 'Follow-up', color: 'bg-blue-500' },
    { label: 'Quotation', color: 'bg-violet-500' },
    { label: 'Negotiating', color: 'bg-purple-500' },
    { label: 'Converted ✓', color: 'bg-green-600' },
    { label: 'Job Bana', color: 'bg-gray-800' },
    { label: '💰 Commission', color: 'bg-yellow-600' },
];

export default function MarketingGuidePage() {
    const [openPhase, setOpenPhase] = useState<string | null>('attendance');

    return (
        <div className="space-y-5 max-w-3xl pb-16">
            {/* Header */}
            <div className="bg-blue-700 rounded-md p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-yellow-400 rounded-md flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-blue-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Marketing Guide — Aayam Office App</h1>
                        <p className="text-blue-200 text-sm">Login → Leads → Follow-up → Convert → Commission</p>
                    </div>
                </div>
                <p className="text-sm text-blue-100 mt-2 leading-relaxed">
                    Tumhara ek kaam hai — leads ko clients mein convert karo. App tumhara poora pipeline track karta hai — follow-ups se commission tak. Roz login se shuru karo.
                </p>
            </div>

            {/* Flow */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tumhara Pipeline Flow</p>
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
                    { icon: '📞', text: 'Pehle call karo, phir app update karo. Notes delay mat karo.' },
                    { icon: '💬', text: 'Har call ke baad note daalo — admin padhta hai yeh sab.' },
                    { icon: '📅', text: 'Har lead pe next follow-up date set karo — kabhi empty mat chhodho.' },
                    { icon: '💰', text: 'Commission tabhi milega jab client POORA paisa de — partial nahi chalega.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-900">
                        <span className="text-base">{r.icon}</span>
                        <span>{r.text}</span>
                    </div>
                ))}
            </div>

            {/* Accordion */}
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

            {/* Checklist */}
            <div className="bg-gray-900 rounded-md p-4 text-white text-xs">
                <p className="font-bold text-yellow-300 mb-2">⚡ Roz Ka Checklist — Yaad Rakho</p>
                <div className="space-y-1 text-gray-300">
                    <p>✅ Attendance Login (subah office aate hi)</p>
                    <p>✅ Aaj ke follow-ups complete karo</p>
                    <p>✅ Har call ke baad note add karo</p>
                    <p>✅ Lead status hamesha updated rakho</p>
                    <p>✅ EOD submit karo + Attendance Logout (jaane se pehle)</p>
                </div>
            </div>
        </div>
    );
}
