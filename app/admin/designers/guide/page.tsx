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
        title: '1. Start of Day',
        subtitle: 'Open your queue and plan your work',
        color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', headerBg: 'bg-pink-700',
        steps: [
            { label: 'Open your personal queue', path: 'Design Studio → My Queue', detail: 'See all jobs assigned specifically to you' },
            { label: 'Check for overdue tasks', path: 'My Queue → Overdue filter', detail: 'Red deadline badge = past due. Prioritise these.' },
            { label: 'Check team queue (if admin)', path: 'Design Studio → Team Queue', detail: 'Admin view: who has what, capacity check' },
            { label: 'Check today\'s briefings / notes', path: 'Design Studio → My Notes', detail: 'Admin may have left instructions' },
        ],
        tip: 'Always check My Queue first. Never start a new task before completing existing overdue ones.',
    },
    {
        id: 'pickup',
        icon: <PenTool className="w-5 h-5" />,
        title: '2. Picking Up a Job',
        subtitle: 'Job assigned → you take ownership',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'Open the job card', path: 'My Queue → [Job card] → Click to open', detail: 'See client name, requirements, deadline, reference files' },
            { label: 'Read the brief carefully', path: 'Job Details → Notes / Brief section', detail: 'Specs: size, bleed, colours, quantity, special instructions' },
            { label: 'Download reference files', path: 'Job Details → Files section → Download', detail: 'Old artwork, logo, brand guide from Google Drive' },
            { label: 'Add a task for the job', path: 'Design Studio → Tasks → + Add Task', detail: 'Break it into steps: Concept / Layout / Revision / Final' },
            { label: 'Mark task as In Progress', path: 'Task → Status → In Progress', detail: 'So team can see you\'ve started' },
        ],
        tip: 'Read the full brief before starting. Fixing mistakes after printing costs ₹₹₹.',
    },
    {
        id: 'work',
        icon: <FileImage className="w-5 h-5" />,
        title: '3. Working on Design',
        subtitle: 'Do the creative work, then upload',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Work on design in your software', path: '—', detail: 'Illustrator, Photoshop, CorelDRAW — your tools' },
            { label: 'Upload work-in-progress file', path: 'Job Details → Files → Upload', detail: 'Upload to Google Drive every time you save major progress' },
            { label: 'Add a note about what you did', path: 'Job Details → Notes → Add Note', detail: 'Example: "Draft 1 uploaded. Awaiting client colour feedback."' },
            { label: 'Upload final artwork', path: 'Job Details → Files → Upload → Mark as Final', detail: 'Print-ready PDF or AI file with bleeds & crops' },
        ],
        tip: 'Upload files regularly — don\'t wait until the job is done. If you lose local work, Drive has backup.',
    },
    {
        id: 'complete',
        icon: <CheckCircle2 className="w-5 h-5" />,
        title: '4. Completing & Sending for Approval',
        subtitle: 'Done → Mark complete → Admin reviews',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'Mark task as Complete', path: 'My Queue → [Task] → Mark Complete', detail: 'Job stage automatically moves to "Approval"' },
            { label: 'Add completion note', path: 'Task → Note → "Completed — [details]"', detail: 'Mention if anything unusual. Example: "Used brand new logo file from client."' },
            { label: 'Admin sends to client for approval', path: 'Admin action', detail: 'You don\'t talk to client directly — admin handles this' },
            { label: 'Handle revisions if needed', path: 'My Queue → Job → Revise task', detail: 'Stage will move back to "Designing" — redo and re-complete' },
        ],
        tip: 'When you mark complete, the job moves to Approval stage — admin and client see it. Make sure files are uploaded first!',
    },
    {
        id: 'timeline',
        icon: <BarChart2 className="w-5 h-5" />,
        title: '5. Tracking Your Work',
        subtitle: 'Gantt view, notes, personal history',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'View your timeline', path: 'Design Studio → Timeline', detail: 'Gantt-style bar chart of all your tasks by date' },
            { label: 'Track your projects', path: 'Design Studio → Projects', detail: 'History of all jobs you\'ve worked on' },
            { label: 'Add personal sticky notes', path: 'Design Studio → My Notes', detail: 'Private notes visible only to you — use for reminders' },
        ],
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '6. EOD Report',
        subtitle: 'Submit before you log out — every day',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'Open EOD Report', path: 'EOD Report → Submit Report', detail: 'Appears in your sidebar' },
            { label: 'List designs completed today', path: 'What did you do today?', detail: 'Job name / task name / draft number completed' },
            { label: 'List designs still in progress', path: 'Current WIP', detail: 'What\'s not done yet and when will it be ready?' },
            { label: 'Mention blockers', path: 'Blockers section', detail: 'Missing brief? Waiting for client feedback? Note it here.' },
            { label: 'Submit', path: 'Submit EOD button', detail: 'Admin reviews your output daily' },
        ],
        tip: 'Admin looks at both your task completion count AND your EOD quality. Be specific.',
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
                        <h1 className="text-xl font-bold">Design Studio — How to Use This App</h1>
                        <p className="text-pink-200 text-sm">Your daily workflow: brief → design → upload → complete</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your Work Flow</p>
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
                    { icon: '📂', text: 'Upload every major save to Drive — don\'t wait.' },
                    { icon: '📝', text: 'Add a note every time you change status.' },
                    { icon: '⏰', text: 'Red deadline = urgent. Do this first.' },
                    { icon: '🎨', text: 'Always mark Complete after uploading final file.' },
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
