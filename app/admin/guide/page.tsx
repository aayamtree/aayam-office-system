'use client';

import { useState } from 'react';
import {
    Users, Building2, Truck, UserCheck, TrendingUp, MessageSquare,
    FileText, Briefcase, Palette, Package, Send, IndianRupee,
    ClipboardList, BarChart3, ChevronDown, ChevronRight,
    CheckCircle2, ArrowRight, Star, Zap, Shield,
    Calendar, Clock, AlertCircle, Layers, Activity
} from 'lucide-react';

interface Step { label: string; path?: string; detail?: string; }
interface Phase {
    id: string; icon: React.ReactNode; title: string; subtitle: string;
    color: string; bg: string; border: string; headerBg: string;
    steps: Step[]; tip?: string;
}

const phases: Phase[] = [
    {
        id: 'setup',
        icon: <Shield className="w-5 h-5" />,
        title: '1. Ek Baar Ka Setup — Pehle Yeh Karo',
        subtitle: 'App use karne se pehle ek baar configure karo',
        color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', headerBg: 'bg-purple-700',
        steps: [
            { label: 'Marketing staff add karo', path: 'Settings → Users → Add User (role: marketing)', detail: 'Har person ka commission % bhi set karo unke profile mein' },
            { label: 'Vendors / suppliers add karo', path: 'Finance → Vendors → Add Vendor', detail: 'Paper suppliers, printing vendors, etc.' },
            { label: 'Transporters add karo', path: 'Dispatch → Transporters → Add Transporter', detail: 'Delivery management ke liye' },
            { label: 'Bank accounts set up karo', path: 'Finance → Banks → Add Bank', detail: 'Cash, current account, etc. — sab link karo' },
            { label: 'Opening balance configure karo', path: 'Finance → Opening Balance', detail: 'Starting cash/bank balance set karo' },
        ],
        tip: 'Yeh setup sirf ek baar karna hai. Iske baad daily workflow shuru ho jaayega.',
    },
    {
        id: 'attendance',
        icon: <UserCheck className="w-5 h-5" />,
        title: '2. Attendance Monitor — Kaun Aaya, Kaun Nahi',
        subtitle: 'Staff ka daily attendance admin yahan dekhta hai',
        color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', headerBg: 'bg-emerald-700',
        steps: [
            { label: 'Aaj ki attendance dekho', path: 'Designers → Attendance', detail: 'Kaun login hai, kaun active hai, kaun absent hai — live view' },
            { label: 'Kisi ka attendance galat ho toh fix karo', path: 'Attendance → Override', detail: 'Admin manually login/logout time override kar sakta hai' },
            { label: 'Attendance history dekho', path: 'Attendance → Range / History', detail: 'Past dates ka record — kaun kitne ghante aaya' },
            { label: 'Staff ko remind karo login/logout karne ke liye', path: '—', detail: 'Agar koi bhool jaata hai toh unhe batao — app se remind karo' },
        ],
        tip: 'Staff ko pehle din hi bata do — roz attendance login/logout compulsory hai. Baad mein enforce karna mushkil hota hai.',
    },
    {
        id: 'marketing',
        icon: <TrendingUp className="w-5 h-5" />,
        title: '3. Marketing Pipeline — Lead Se Client Tak',
        subtitle: 'Lead → Follow-up → Quotation → Client',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Marketing staff lead add karta hai', path: 'Marketing → Leads → New Lead', detail: 'Naam, phone, service type, requirement' },
            { label: 'Admin lead assign karta hai (zaroori!)', path: 'Marketing → Leads → Edit Lead → Assign To', detail: 'Bina assignment ke commission track nahi hoga — yeh mat bhoolna' },
            { label: 'Follow-up aur quotation', path: 'Marketing → Leads → Move to Follow-up', detail: 'Follow-up date set hoti hai, notes add hote hain' },
            { label: 'Client ban gaya toh Convert karo', path: 'Marketing → Leads → Convert to Client', detail: 'Automatically CRM mein Client record ban jaata hai' },
            { label: 'Client ke liye Job create karo', path: 'Jobs → New Job → Select Client', detail: 'Ab job production pipeline mein aa jaati hai' },
            { label: 'Dispatched orders dekho', path: 'Marketing → Dispatched Orders', detail: 'Marketing staff ke clients ke orders ka dispatch status' },
        ],
        tip: 'Commission sirf tab auto-trigger hoga jab lead assign ho aur job fully paid ho. Lead assignment bhoolna = commission nahi milega staff ko.',
    },
    {
        id: 'crm',
        icon: <UserCheck className="w-5 h-5" />,
        title: '4. CRM — Clients Ka Poora Record',
        subtitle: 'Existing clients ki history aur details',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'Sab clients dekho', path: 'CRM → Clients', detail: 'Naam, company, brand se search karo' },
            { label: 'Direct client add karo (bina lead ke)', path: 'CRM → Clients → Add Client', detail: 'Walk-in ya referral clients ke liye' },
            { label: 'Client ki job history dekho', path: 'CRM → Clients → View Client', detail: 'Sab jobs, total billed, received, outstanding — ek jagah' },
            { label: 'Client details edit karo', path: 'CRM → Clients → Edit', detail: 'Contact, brand name, GST, city — update karo' },
        ],
        tip: 'Job history aur financials automatically populate hote hain existing jobs se. Manually kuch nahi karna.',
    },
    {
        id: 'jobs',
        icon: <Briefcase className="w-5 h-5" />,
        title: '5. Jobs Queue — Operation Ka Dil',
        subtitle: 'Har job ka lifecycle yahan track hota hai',
        color: 'text-gray-900', bg: 'bg-gray-50', border: 'border-gray-300', headerBg: 'bg-gray-900',
        steps: [
            { label: 'Naya job create karo', path: 'Jobs → New Job', detail: 'Client, job type (Print/Design/Both), quantity, amount, deadline' },
            { label: 'Job Queue (Kanban) dekho', path: 'Jobs → Queue', detail: 'New → Designing → Approval → Printing → Dispatched → Delivered — drag karke move karo' },
            { label: 'Job details kholo', path: 'Jobs → Queue → [Job Card]', detail: 'Files, notes, stage history, payment status' },
            { label: 'Designer assign karo', path: 'Job Details → Assign Designer', detail: 'Active designers mein se choose karo' },
            { label: 'Subtasks create karo (agar job complex hai)', path: 'Job Details → Subtasks → Add Subtask', detail: 'Bade job ko chhote pieces mein todo — har designer ko specific task do' },
            { label: 'Payment add karo', path: 'Job Details → Payments → Add Payment', detail: 'Commission auto-eligible hota hai jab fully paid ho' },
            { label: 'Overdue jobs check karo', path: 'Jobs → Overdue', detail: 'Jo jobs deadline se late ho gayi hain — foran attention do' },
        ],
        tip: 'Amount received = total amount ho jaaye tab commission automatically "Eligible" ho jaata hai. Kuch alag nahi karna.',
    },
    {
        id: 'design',
        icon: <Palette className="w-5 h-5" />,
        title: '6. Design Studio — Admin Ki Nazar',
        subtitle: 'Designers kya kar rahe hain — live dekho',
        color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', headerBg: 'bg-pink-700',
        steps: [
            { label: 'Poori team ka queue dekho', path: 'Design Studio → Tasks (Admin view)', detail: 'Kaun kya kar raha hai, overdue tasks, sab status pills' },
            { label: 'Status pills monitor karo', path: 'Tasks → Status pills', detail: '🟢 Live = kaam ho raha hai | 🟡 Pause = rukka hua | 🔵 Review = client ke paas | ✅ End = complete | 🔁 Transfer = reassign' },
            { label: 'New design task / subtask banao', path: 'Design Studio → + New Project', detail: 'Job ko design steps mein todo — specific designer ko assign karo' },
            { label: 'Timeline dekho', path: 'Design Studio → Timeline', detail: 'Gantt chart — sab tasks by date' },
            { label: 'Dossier (full history)', path: 'Design Studio → Dossier', detail: 'Admin only: har task ki poori history with status aur time logs' },
        ],
        tip: 'Designers ko remind karo ki status pills hamesha update rakho. Tum wahi dekh sakte ho jo pills mein show hota hai.',
    },
    {
        id: 'print',
        icon: <Package className="w-5 h-5" />,
        title: '7. Print aur Production',
        subtitle: 'Artwork approval se printed job tak',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'Print run plan karo', path: 'Print Planner → New Plan', detail: 'Job, paper stock, quantity, machine select karo' },
            { label: 'Paper stock dekho', path: 'CMYK Print → Paper Stock', detail: 'Available paper by type aur size track karo' },
            { label: 'Job Printing stage mein move karo', path: 'Jobs → Queue → Move to Printing stage', detail: 'Printing ke baad QC start hogi' },
        ],
    },
    {
        id: 'dispatch',
        icon: <Send className="w-5 h-5" />,
        title: '8. QC aur Dispatch',
        subtitle: 'Quality check → Pack → Deliver',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'QC check karo printed job ka', path: 'Dispatch → QC Check → [Job] → Pass/Fail', detail: 'Colour, cuts, quantities check karo dispatch se pehle' },
            { label: 'Transporter assign karo', path: 'Dispatch → [Job] → Assign Transporter', detail: 'Saved transporters mein se choose karo' },
            { label: 'Dispatched mark karo', path: 'Dispatch → Mark Dispatched', detail: 'Dispatch date, transporter, notes record hota hai' },
            { label: 'Delivered mark karo', path: 'Jobs → Queue → Delivered', detail: 'Final stage — order complete' },
            { label: 'Dispatch history dekho', path: 'Dispatch → History', detail: 'Sab past dispatches with dates aur transporters' },
        ],
        tip: 'QC pass hone ke baad hi dispatch allow hota hai. Shortcut mat lo — wrong delivery bahut mehenga padti hai.',
    },
    {
        id: 'finance',
        icon: <IndianRupee className="w-5 h-5" />,
        title: '9. Finance — Paise Ka Hisaab',
        subtitle: 'Payments, invoices, accounts, reports',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'Client payment record karo', path: 'Finance → Payments → New Payment', detail: 'Job se link hota hai, outstanding auto-update' },
            { label: 'Invoice / bill create karo', path: 'Finance → Invoices → New Invoice', detail: 'GST invoice with job details' },
            { label: 'Vendor purchase/bill record karo', path: 'Finance → Vendors → [Vendor] → Purchases', detail: 'Paper, printing materials, services' },
            { label: 'Daily cash / expense entry karo', path: 'Finance → Daily → Add Entry', detail: 'Petty cash aur daily expenses' },
            { label: 'Daily Summary dekho', path: 'Finance → Daily Summary', detail: 'Kisi bhi date ke sab account balances ek jagah' },
            { label: 'Bank reconciliation karo', path: 'Finance → Banking', detail: 'Bank statement ko app records se match karo' },
            { label: 'Financial reports dekho', path: 'Finance → Reports', detail: 'P&L, cashbook, client outstanding, vendor reports' },
        ],
        tip: 'Client payment add karne se commission automatic "Eligible" ho jaata hai agar job fully paid ho. Kuch extra karna nahi.',
    },
    {
        id: 'commission',
        icon: <Star className="w-5 h-5" />,
        title: '10. Commissions — Marketing Staff Ki Kamaai',
        subtitle: 'Auto-calculate hota hai — sirf approve karna hai',
        color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', headerBg: 'bg-yellow-700',
        steps: [
            { label: 'Full payment ke baad commission auto-appear karta hai', path: 'Commissions page → Eligible tab', detail: 'Status = Eligible automatically aa jaata hai' },
            { label: '% set karo aur approve karo', path: 'Commissions → [Job] → Set % & Approve', detail: 'Default rate override kar sakte ho per job' },
            { label: 'Physically paisa do aur Paid mark karo', path: 'Commissions → [Job] → Mark as Paid', detail: 'Paid date record ho jaati hai' },
            { label: 'Marketing person apni earnings dekh sakta hai', path: 'Marketing → Dashboard → Commission widget', detail: 'Eligible / Approved / Paid amounts' },
        ],
        tip: 'Har marketing person ka default commission rate set karo Settings → Users mein. Jo rate set hai wahi default aayega — per job change kar sakte ho.',
    },
    {
        id: 'eod',
        icon: <ClipboardList className="w-5 h-5" />,
        title: '11. EOD Reports — Roz Ka Accountability',
        subtitle: 'Har staff member ka daily summary tumhare paas',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'Staff EOD submit karta hai', path: 'EOD Report → Submit Report', detail: 'Aaj kya kiya, kya WIP hai, koi blocker — sab likhte hain' },
            { label: 'Admin sab ke EOD reports review karta hai', path: 'EOD Report → Admin View', detail: 'Aaj ke sab staff ke reports — rate karo har ek ko' },
            { label: 'Past reports dekho', path: 'EOD Report → Admin View → Filter by Date', detail: 'Historical archive — kisi bhi date ke reports dekho' },
        ],
        tip: 'Staff sirf ek EOD per day submit kar sakta hai. Agar submit nahi kiya toh unhe remind karo — yeh accountability ka sabse important tool hai.',
    },
    {
        id: 'monitoring',
        icon: <Activity className="w-5 h-5" />,
        title: '12. Admin Monitoring — Poori Nazar',
        subtitle: 'Dashboard, activity, broadcast — sab control yahan',
        color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', headerBg: 'bg-slate-700',
        steps: [
            { label: 'Overview Dashboard', path: 'Dashboard → Overview', detail: 'Jobs in progress, is month ka revenue, pending payments — snapshot' },
            { label: 'Activity Log', path: 'Activity', detail: 'Har user ne kya kiya — kab, kaunse device se, kya change kiya' },
            { label: 'Broadcast message bhejo', path: 'Broadcast → New Message', detail: 'Announcement sab staff ke dashboard pe instantly dikhta hai' },
            { label: 'Calendar (role-filtered)', path: 'Calendar', detail: 'Admin sab kuch dekhta hai: job deadlines, follow-ups, dispatch dates. Staff sirf apna dekhte hain.' },
            { label: 'System Health check', path: 'System Health', detail: 'DB status, config checks, error logs — kuch gadbad ho toh yahan dikhega' },
        ],
    },
];

const flowItems = [
    { label: 'Lead', color: 'bg-blue-500' },
    { label: 'Follow-up', color: 'bg-indigo-500' },
    { label: 'Quotation', color: 'bg-violet-500' },
    { label: 'Job Bana', color: 'bg-gray-800' },
    { label: 'Designing', color: 'bg-pink-500' },
    { label: 'Printing', color: 'bg-cyan-600' },
    { label: 'QC', color: 'bg-orange-500' },
    { label: 'Dispatched', color: 'bg-amber-600' },
    { label: 'Delivered', color: 'bg-green-600' },
    { label: '💰 Paid', color: 'bg-green-700' },
];

export default function AdminGuidePage() {
    const [openPhase, setOpenPhase] = useState<string | null>('setup');

    return (
        <div className="space-y-6 max-w-4xl pb-20">
            {/* Header */}
            <div className="bg-gray-900 rounded-md p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-yellow-400 rounded-md flex items-center justify-center">
                        <Zap className="w-5 h-5 text-gray-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Admin Guide — Aayam Office App</h1>
                        <p className="text-gray-400 text-sm">Lead aane se le kar delivery aur payment tak — poora control yahan hai</p>
                    </div>
                </div>
                <p className="text-sm text-gray-300 mt-3 leading-relaxed">
                    Tumhara kaam hai — sab kuch coordinate karna. Marketing leads, job creation, designer assignment, QC, dispatch, finance, attendance, commissions — sab ek jagah. Neeche expand karo har section ko step-by-step guide ke liye.
                </p>
            </div>

            {/* Flow Diagram */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Order Lifecycle — Shuru Se Khatam Tak</p>
                <div className="flex flex-wrap items-center gap-1">
                    {flowItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-1">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold text-white ${item.color}`}>
                                {item.label}
                            </span>
                            {i < flowItems.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Role Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    {
                        role: 'Admin (Tum)', icon: <Shield className="w-4 h-4 text-white" />, bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-700',
                        can: ['Sab kuch dekhta hai', 'Commissions approve karta hai', 'EOD reports review karta hai', 'Vendors, clients, staff manage karta hai', 'Poora finance control']
                    },
                    {
                        role: 'Marketing', icon: <TrendingUp className="w-4 h-4 text-blue-700" />, bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200',
                        can: ['Leads aur follow-ups add karta hai', 'Quotations create karta hai', 'Leads ko clients mein convert karta hai', 'Apna commission dekhta hai', 'Dispatched orders track karta hai']
                    },
                    {
                        role: 'Designer', icon: <Palette className="w-4 h-4 text-pink-700" />, bg: 'bg-pink-50', text: 'text-pink-900', border: 'border-pink-200',
                        can: ['Assigned jobs My Queue mein dekhta hai', 'Status pills update karta hai', 'EOD report submit karta hai', 'Files upload karta hai', 'Attendance login/logout karta hai']
                    },
                ].map((r) => (
                    <div key={r.role} className={`rounded-md border p-3 ${r.bg} ${r.border}`}>
                        <div className={`flex items-center gap-2 mb-2 ${r.text}`}>
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${r.role === 'Admin (Tum)' ? 'bg-white/10' : r.role === 'Marketing' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                                {r.icon}
                            </div>
                            <span className="text-sm font-bold">{r.role}</span>
                        </div>
                        <ul className={`space-y-1 ${r.text}`}>
                            {r.can.map((c, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-xs">
                                    <CheckCircle2 className="w-3 h-3 flex-shrink-0 opacity-60" />
                                    {c}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {/* Phases Accordion */}
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
                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${isOpen ? 'bg-white/15' : 'bg-white/60'}`}>
                                        {phase.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{phase.title}</p>
                                        <p className={`text-xs ${isOpen ? 'text-white/70' : 'opacity-60'}`}>{phase.subtitle}</p>
                                    </div>
                                </div>
                                {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                            </button>

                            {isOpen && (
                                <div className="p-4 space-y-3 bg-white border-t border-gray-100">
                                    {phase.steps.map((step, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5 ${phase.headerBg}`}>
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                                                {step.path && (
                                                    <p className="text-xs font-mono text-gray-500 mt-0.5 flex items-center gap-1">
                                                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                        {step.path}
                                                    </p>
                                                )}
                                                {step.detail && (
                                                    <p className="text-xs text-gray-400 mt-0.5 italic">{step.detail}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {phase.tip && (
                                        <div className={`mt-4 flex items-start gap-2 p-3 rounded-md ${phase.bg} ${phase.border} border`}>
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

            {/* Quick Tips */}
            <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">⚡ Admin Quick Tips — Yaad Rakho</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                    {[
                        '📌 Lead assign karna mat bhoolna — warna marketing staff ka commission nahi milega',
                        '💰 Commission sirf tab trigger hota hai jab client ka 100% payment aa jaaye',
                        '🎨 Designers ek doosre ke jobs nahi dekh sakte — fully isolated view hai',
                        '📊 EOD reports roz check karo — isse pata chalta hai team kya kar rahi hai',
                        '🔍 Activity Log mein sab kuch record hota hai — kisi bhi action ko audit karo',
                        '🏦 Bank accounts pehle add karo — phir payments record karo',
                        '📱 App mobile pe bhi kaam karta hai — staff phone se use kar sakte hain',
                        '🔔 Broadcast messages sab staff ke dashboards pe instantly dikhte hain',
                        '🟢 Designer ka status Live/End dekh ke pata chalta hai kaam chal raha hai ya nahi',
                        '⏰ Overdue jobs pe roz nazar rakho — Jobs → Overdue page daily check karo',
                    ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-md border border-gray-100">
                            <span>{tip}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
