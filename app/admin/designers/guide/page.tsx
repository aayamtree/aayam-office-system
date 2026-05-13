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
            { label: 'Open your personal queue', path: 'Design Studio → My Queue', detail: 'See all jobs assigned specifically to you, sorted by deadline' },
            { label: 'Check your calendar', path: 'Calendar', detail: 'Your task deadlines appear here — so you can see what\'s due today at a glance' },
            { label: 'Check for overdue tasks', path: 'My Queue → filter by deadline', detail: 'Red deadline badge = past due. Prioritise these first.' },
            { label: 'Check today\'s briefings / notes', path: 'Design Studio → My Notes', detail: 'Admin may have left instructions or new job details' },
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
            { label: 'Set your task status to Live', path: 'My Queue → Task → 🟢 Live pill', detail: 'Tap the Live pill to show you\'ve started working' },
        ],
        tip: 'Read the full brief before starting. Fixing mistakes after printing costs ₹₹₹.',
    },
    {
        id: 'status',
        icon: <ListChecks className="w-5 h-5" />,
        title: '3. Task Status Pills — Your Signal System',
        subtitle: 'Tell the team exactly where you are at all times',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: '🟢 Live — I am actively working on this right now', path: 'My Queue / Tasks → Live pill', detail: 'Set this when you pick up and start designing' },
            { label: '🟡 Pause — Paused, waiting for something', path: 'My Queue / Tasks → Pause pill', detail: 'Use when waiting for client files, feedback, or clarification' },
            { label: '🔵 Review — Sent to client / team for approval', path: 'My Queue / Tasks → Review pill', detail: 'Design is done, now awaiting feedback or sign-off' },
            { label: '✅ End — Work complete, ready to hand off', path: 'My Queue / Tasks → End pill', detail: 'Final file uploaded, brief is fulfilled — admin takes over' },
            { label: '🔁 Transfer — Reassigning to another designer', path: 'My Queue / Tasks → Transfer pill', detail: 'If you can\'t complete it — let admin know the reason' },
        ],
        tip: 'Update your status every time something changes. Admin watches these pills to know the live state of every job.',
    },
    {
        id: 'work',
        icon: <FileImage className="w-5 h-5" />,
        title: '4. Working on Design',
        subtitle: 'Do the creative work, then upload',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Work on design in your software', path: '—', detail: 'Illustrator, Photoshop, CorelDRAW — your tools' },
            { label: 'Upload work-in-progress file', path: 'Job Details → Files → Upload', detail: 'Upload to Google Drive every time you save major progress' },
            { label: 'Add a note about what you did', path: 'Job Details → Notes → Add Note', detail: 'Example: "Draft 1 uploaded. Awaiting client colour feedback."' },
            { label: 'Set status to Review when ready for feedback', path: 'Task → 🔵 Review pill', detail: 'Admin knows to send to client now' },
            { label: 'Upload final artwork and set status to End', path: 'Files → Upload final → Task → ✅ End pill', detail: 'Print-ready PDF or AI file with bleeds & crops' },
        ],
        tip: 'Upload files regularly — don\'t wait until the job is done. If you lose local work, Drive has backup.',
    },
    {
        id: 'newjob',
        icon: <Upload className="w-5 h-5" />,
        title: '5. Adding a New Design Task',
        subtitle: 'Admin or you can create tasks via New Project',
        color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', headerBg: 'bg-teal-700',
        steps: [
            { label: 'Click New Project', path: 'Design Studio → + New Project', detail: 'Opens the full task creation form' },
            { label: 'Fill in client, job type, deadline', path: 'New Project form', detail: 'Link to an existing job if it\'s part of one' },
            { label: 'Assign to yourself or a designer', path: 'Assign To field', detail: 'Task appears in that designer\'s My Queue immediately' },
            { label: 'Set initial status', path: 'Status field → Live / Pause', detail: 'Live if starting now, Hold if queued for later' },
        ],
        tip: 'Admin creates most tasks — but you can create sub-tasks for your own workflow.',
    },
    {
        id: 'timeline',
        icon: <BarChart2 className="w-5 h-5" />,
        title: '6. Tracking Your Work',
        subtitle: 'Timeline, dossier, notes',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'View your timeline', path: 'Design Studio → Timeline', detail: 'Gantt-style bar chart of all your tasks by date' },
            { label: 'View full job history (Dossier)', path: 'Design Studio → Dossier (admin only)', detail: 'Admin view: every task ever created with status and time logs' },
            { label: 'Add personal sticky notes', path: 'Design Studio → My Notes', detail: 'Private notes visible only to you — use for reminders, colour codes, client preferences' },
            { label: 'Check your calendar', path: 'Calendar', detail: 'Deadlines for your assigned tasks show on the calendar — only YOUR tasks, not others' },
        ],
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '7. EOD Report',
        subtitle: 'Submit before you log out — every day',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'Click End My Day button', path: 'Sidebar bottom → End My Day button', detail: 'This opens the EOD report for today' },
            { label: 'List designs completed today', path: 'What did you do today?', detail: 'Job name / task name / draft number completed' },
            { label: 'List designs still in progress', path: 'Current WIP', detail: 'What\'s not done yet and when will it be ready?' },
            { label: 'Mention blockers', path: 'Blockers section', detail: 'Missing brief? Waiting for client feedback? Note it here.' },
            { label: 'Submit', path: 'Submit EOD button', detail: 'Admin reviews your output daily and rates it' },
        ],
        tip: 'Admin looks at both your task status (Live/End) AND your EOD quality. Update status pills before submitting.',
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
