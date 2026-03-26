'use client';

import { useState } from 'react';
import {
    Palette, Clock, ListChecks, Upload, CheckCircle2, ChevronDown,
    ChevronRight, ArrowRight, AlertCircle, FileImage, Target,
    PenTool, BarChart2, UserCheck, Layers
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
        title: '1. Attendance — Subah Login, Shaam Logout',
        subtitle: 'Har din karna zaroori hai — bhoolna nahi!',
        color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', headerBg: 'bg-emerald-700',
        steps: [
            { label: 'Office aate hi app open karo aur Login karo', path: 'Sidebar → Attendance → Login', detail: 'Isse tumhara attendance record hota hai. Bina login ke kaam start mat karo.' },
            { label: 'Poore din heartbeat auto-track hoti hai', path: '—', detail: 'App automatically track karta hai ki tum active ho. Kuch karna nahi.' },
            { label: 'Shaam ko kaam khatam hone par Logout karo', path: 'Sidebar → Attendance → Logout', detail: 'Logout karte waqt ek chhota EOD summary bhi dena hoga.' },
            { label: 'Agar bhool gaye toh admin se bolo', path: 'Admin → Attendance → Override', detail: 'Admin manually attendance fix kar sakta hai.' },
        ],
        tip: 'Attendance bahut important hai — admin daily dekhta hai kaun aaya, kaun nahi. Logout karna mat bhoolna warna time record galat ho jaayega.',
    },
    {
        id: 'daily',
        icon: <Clock className="w-5 h-5" />,
        title: '2. Din Ka Shuruaat — Subah Ka Routine',
        subtitle: 'Login ke baad yahi 4 cheezein check karo',
        color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', headerBg: 'bg-pink-700',
        steps: [
            { label: 'Apna personal queue kholo', path: 'Design Studio → My Queue', detail: 'Sirf tumhare jobs dikhenge — deadline ke hisaab se sort hue' },
            { label: 'My Work page check karo', path: 'My Work', detail: 'Tumhare saare assigned tasks aur subtasks ek jagah — quick overview ke liye' },
            { label: 'Calendar dekho', path: 'Calendar', detail: 'Aaj ki deadlines yahan dikhti hain — sirf tumhare tasks, doosron ke nahi' },
            { label: 'My Notes check karo', path: 'Design Studio → My Notes', detail: 'Admin ne koi instruction ya new job detail chhodi hogi toh yahan milegi' },
        ],
        tip: 'Pehle My Queue aur overdue tasks dekho. Jo kaam late ho gaya hai use pehle khatam karo, phir naya kaam uthao.',
    },
    {
        id: 'pickup',
        icon: <PenTool className="w-5 h-5" />,
        title: '3. Job Uthana — Brief Padhna Zaroori Hai',
        subtitle: 'Job milte hi yeh steps follow karo',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'Job card kholo aur poora padhho', path: 'My Queue → [Job card] → Click to open', detail: 'Client ka naam, requirement, deadline, reference files — sab yahan hai' },
            { label: 'Brief dhyan se padhho', path: 'Job Details → Notes / Brief section', detail: 'Size, bleed, colours, quantity, special instructions — koi bhi cheez miss mat karo' },
            { label: 'Reference files download karo', path: 'Job Details → Files section → Download', detail: 'Old artwork, logo, brand guide Google Drive se milega' },
            { label: 'Task status Live kar do', path: 'My Queue → Task → 🟢 Live pill', detail: 'Isse admin ko pata chalta hai tum kaam shuru kar diye ho' },
        ],
        tip: 'Brief padhne ke baad kaam shuru karo. Print hone ke baad galti fix karna bahut mehenga padta hai — ₹₹₹ waste hota hai!',
    },
    {
        id: 'status',
        icon: <ListChecks className="w-5 h-5" />,
        title: '4. Status Pills — Apni State Batao Hamesha',
        subtitle: 'Admin yahi dekhta hai — har change pe update karo',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: '🟢 Live — Main abhi is job par kaam kar raha/rahi hoon', path: 'My Queue / Tasks → Live pill', detail: 'Jab bhi kaam shuru karo yeh lagao' },
            { label: '🟡 Pause — Rok ke rakha hai, kisi cheez ka wait hai', path: 'My Queue / Tasks → Pause pill', detail: 'Client files chahiye, feedback chahiye, ya clarification chahiye toh Pause' },
            { label: '🔵 Review — Client / admin ko bhej diya, approval ka wait hai', path: 'My Queue / Tasks → Review pill', detail: 'Design ready hai, ab feedback aayega' },
            { label: '✅ End — Kaam poora ho gaya, admin le lo', path: 'My Queue / Tasks → End pill', detail: 'Final file upload ho gayi, brief fulfill ho gaya' },
            { label: '🔁 Transfer — Kisi aur designer ko dena hai', path: 'My Queue / Tasks → Transfer pill', detail: 'Agar tum complete nahi kar sakte — reason bhi batao admin ko' },
        ],
        tip: 'Har baar kuch change ho toh status update karo. Admin in pills ko dekhke decide karta hai ki kaunsa job production ke liye ready hai.',
    },
    {
        id: 'subtasks',
        icon: <Layers className="w-5 h-5" />,
        title: '5. Subtasks — Bade Job Ko Chhote Pieces Mein Todo',
        subtitle: 'Ek job ke andar multiple tasks manage karo',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Job ke andar Subtasks section dekho', path: 'Job Details → Subtasks tab', detail: 'Admin ne subtasks banaaye honge — ya tum khud bana sakte ho apne kaam ke liye' },
            { label: 'Apna assigned subtask kholo', path: 'My Work → Subtasks section', detail: 'Sirf tumhare assigned subtasks dikhenge' },
            { label: 'Subtask ka status update karo', path: 'Subtask → Status dropdown', detail: 'Pending → In Progress → Done — admin ko pata rahega' },
            { label: 'Subtask complete karo', path: 'Subtask → Mark Done', detail: 'Sab subtasks done hone par main job bhi automatically advance hoti hai' },
        ],
        tip: 'Agar koi subtask unclear hai toh admin se baat karo. Subtask ka status update karna mat bhoolna — admin isiliye dekhta hai ki kaun kya kar raha hai.',
    },
    {
        id: 'work',
        icon: <FileImage className="w-5 h-5" />,
        title: '6. Design Karna aur File Upload Karna',
        subtitle: 'Kaam karo, save karo, upload karo — baar baar',
        color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', headerBg: 'bg-teal-700',
        steps: [
            { label: 'Apne software mein design karo', path: '—', detail: 'Illustrator, Photoshop, CorelDRAW — jo tumhara tool hai' },
            { label: 'Har major save ke baad Drive pe upload karo', path: 'Job Details → Files → Upload', detail: 'Draft 1, Draft 2 — sab versions rakhho. Local work delete ho sakta hai.' },
            { label: 'Note add karo kya kiya', path: 'Job Details → Notes → Add Note', detail: 'Example: "Draft 1 upload kiya. Client ka colour feedback wait hai."' },
            { label: 'Review ready hone par status change karo', path: 'Task → 🔵 Review pill', detail: 'Admin ko signal milega ki client ko bhejne ka time aa gaya' },
            { label: 'Final artwork upload karke End karo', path: 'Files → Upload final → Task → ✅ End pill', detail: 'Print-ready PDF ya AI file with bleeds aur crops — sab theek check karo' },
        ],
        tip: 'File regularly upload karo — job khatam hone ka wait mat karo. Drive backup hai agar local kaam kho jaaye.',
    },
    {
        id: 'timeline',
        icon: <BarChart2 className="w-5 h-5" />,
        title: '7. Apna Kaam Track Karna',
        subtitle: 'Timeline, notes, calendar — sab ek jagah',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'Apni timeline dekho', path: 'Design Studio → Timeline', detail: 'Gantt chart style mein tumhare saare tasks by date — visual overview' },
            { label: 'My Notes mein apne notes likho', path: 'Design Studio → My Notes', detail: 'Private notes — sirf tumhein dikhenge. Client preferences, colour codes, reminders.' },
            { label: 'Calendar check karo', path: 'Calendar', detail: 'Tumhare assigned tasks ki deadlines calendar pe dikhti hain — sirf tumhari, doosron ki nahi' },
            { label: 'Dossier (admin only)', path: 'Design Studio → Dossier', detail: 'Admin dekhta hai — har task ki poori history with status aur time logs' },
        ],
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '8. EOD Report — Logout Se Pehle Bharna Zaroori',
        subtitle: 'Attendance logout ke saath EOD bhi karo — roz',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'EOD Report kholo', path: 'EOD Report → Submit Report', detail: 'Din mein sirf ek baar submit hota hai' },
            { label: 'Aaj kya kiya — list karo', path: 'What did you do today?', detail: 'Job name / task name / draft number — jo bhi complete kiya' },
            { label: 'Kya WIP mein hai — batao', path: 'Current WIP section', detail: 'Kya abhi tak nahi hua aur kab tak hoga?' },
            { label: 'Koi blocker hai toh note karo', path: 'Blockers section', detail: 'Brief missing? Client feedback nahi mila? Yahan likho.' },
            { label: 'Submit karo', path: 'Submit EOD button', detail: 'Admin roz tumhara output dekhta hai aur rate karta hai' },
        ],
        tip: 'Admin dono cheezein dekhta hai — status pills (Live/End) aur EOD quality. Submit karne se pehle apne sabhi task status update karo.',
    },
];

const flowItems = [
    { label: 'Login ✓', color: 'bg-emerald-600' },
    { label: 'Job Mila', color: 'bg-pink-500' },
    { label: 'Brief Padha', color: 'bg-violet-500' },
    { label: '🟢 Live', color: 'bg-green-600' },
    { label: 'Design Kiya', color: 'bg-blue-600' },
    { label: 'Upload Kiya', color: 'bg-cyan-600' },
    { label: '✅ End', color: 'bg-gray-800' },
    { label: 'EOD + Logout', color: 'bg-rose-600' },
];

export default function DesignerGuidePage() {
    const [openPhase, setOpenPhase] = useState<string | null>('attendance');

    return (
        <div className="space-y-5 max-w-3xl pb-16">
            {/* Header */}
            <div className="bg-pink-700 rounded-md p-5 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-yellow-300 rounded-md flex items-center justify-center">
                        <Palette className="w-5 h-5 text-pink-900" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Designer Guide — Aayam Office App</h1>
                        <p className="text-pink-200 text-sm">Login → Brief padho → Design karo → Upload karo → EOD karo</p>
                    </div>
                </div>
                <p className="text-sm text-pink-100 mt-2 leading-relaxed">
                    Yeh guide tumhare liye hai — Sunil, Dilip, Janvi, Vivek. Roz subah attendance se shuru karo, raat ko EOD se khatam karo. Beech mein status pills update karna mat bhoolna.
                </p>
            </div>

            {/* Flow */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tumhara Roz Ka Flow</p>
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
                    { icon: '🟢', text: 'Kaam shuru karo toh Live — khatam karo toh End. Beech mein status mat bhoolna.' },
                    { icon: '📂', text: 'Har major draft Drive pe upload karo — local pe save karna kaafi nahi.' },
                    { icon: '🔴', text: 'Red deadline = urgent. Pehle yahi karo, baad mein nayi job uthao.' },
                    { icon: '📝', text: 'Status change karne ke saath ek chhota note bhi add karo — admin ko context milta hai.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-pink-50 border border-pink-100 rounded-md text-xs text-pink-900">
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

            {/* Bottom reminder */}
            <div className="bg-gray-900 rounded-md p-4 text-white text-xs">
                <p className="font-bold text-yellow-300 mb-2">⚡ Yaad Rakho — Roz Ka Checklist</p>
                <div className="space-y-1 text-gray-300">
                    <p>✅ Attendance Login (subah)</p>
                    <p>✅ My Queue + My Work check karo</p>
                    <p>✅ Status pills update karo jab bhi kuch change ho</p>
                    <p>✅ Files Drive pe upload karo</p>
                    <p>✅ EOD submit karo + Attendance Logout (shaam)</p>
                </div>
            </div>
        </div>
    );
}
