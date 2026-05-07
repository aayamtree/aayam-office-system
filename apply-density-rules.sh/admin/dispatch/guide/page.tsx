'use client';

import { useState } from 'react';
import {
    Truck, Clock, PackageCheck, Send, History, AlertCircle,
    ChevronDown, ChevronRight, ArrowRight, CheckCircle2, Target, Shield
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
        subtitle: 'Check what\'s ready for dispatch',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Open Dispatch Command Center', path: 'Dispatch → Command Center', detail: 'See all jobs at Printing and QC stages' },
            { label: 'Check jobs pending QC', path: 'Dispatch → QC & Packing tab', detail: 'These are printed and waiting for your check' },
            { label: 'Check today\'s scheduled deliveries', path: 'Dispatch → Scheduled Deliveries', detail: 'Follow up with transporter on pending deliveries' },
            { label: 'Check your calendar', path: 'Calendar', detail: 'See dispatch deadlines for jobs — design tasks are not shown in your calendar view' },
        ],
    },
    {
        id: 'qc',
        icon: <PackageCheck className="w-5 h-5" />,
        title: '2. Quality Check (QC)',
        subtitle: 'Inspect every job before packing',
        color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', headerBg: 'bg-red-700',
        steps: [
            { label: 'Open QC for a job', path: 'Dispatch → QC & Packing → [Job]', detail: 'See specs: quantity, size, colour, client' },
            { label: 'Physically inspect material', path: '—', detail: 'Check: colour accuracy, cut marks, quantity, no defects' },
            { label: 'Mark QC as PASS', path: 'QC → Pass button', detail: 'Job moves to "Ready to Dispatch"' },
            { label: 'Mark QC as FAIL (if defects)', path: 'QC → Fail → Add reason', detail: 'Job goes back to printing. Admin is notified.' },
        ],
        tip: 'NEVER skip QC. A wrong delivery costs more than QC time.',
    },
    {
        id: 'dispatch',
        icon: <Send className="w-5 h-5" />,
        title: '3. Packing & Dispatching',
        subtitle: 'Pack → assign transporter → send',
        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-700',
        steps: [
            { label: 'Pack the job', path: '—', detail: 'Box / bubble wrap as needed. Label with job number + client name.' },
            { label: 'Open ready-to-dispatch job', path: 'Dispatch → Command Center → [Job]', detail: 'QC must be passed first' },
            { label: 'Assign transporter', path: 'Job → Assign Transporter', detail: 'Choose from saved list. Or select "In-House" for self delivery.' },
            { label: 'Mark as Dispatched', path: 'Dispatch button', detail: 'Job stage = Dispatched. Time recorded automatically.' },
        ],
    },
    {
        id: 'delivered',
        icon: <CheckCircle2 className="w-5 h-5" />,
        title: '4. Confirming Delivery',
        subtitle: 'Confirm with transporter, then close',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'Transporter confirms delivery', path: '—', detail: 'Call/WhatsApp from transporter' },
            { label: 'Mark job as Delivered', path: 'Dispatch → [Job] → Mark Delivered', detail: 'Final stage — job is complete' },
            { label: 'Add delivery confirmation note', path: 'Job → Note', detail: 'Who received it, date, any client feedback' },
        ],
        tip: 'Get transporter photo proof when possible.',
    },
    {
        id: 'history',
        icon: <History className="w-5 h-5" />,
        title: '5. History & Transporters',
        subtitle: 'Track past deliveries, manage transporters',
        color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', headerBg: 'bg-slate-700',
        steps: [
            { label: 'View delivery history', path: 'Dispatch → Delivery History', detail: 'Filter by date, transporter, or client' },
            { label: 'Add new transporter', path: 'Dispatch → Transporters → Add Transporter', detail: 'Name, phone, vehicle type' },
            { label: 'Edit transporter details', path: 'Dispatch → Transporters → [Name] → Edit', detail: 'Update phone, rates' },
        ],
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '6. EOD Report',
        subtitle: 'Submit before leaving — daily',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'Open EOD Report', path: 'EOD Report → Submit Report', detail: '' },
            { label: 'List dispatches, QC done today', path: 'What did you do today?', detail: 'Job numbers, deliveries confirmed, QC results' },
            { label: 'Note any delays or issues', path: 'Blockers section', detail: 'Failed QC, transport issues, missing materials' },
            { label: 'Submit', path: 'Submit EOD button', detail: '' },
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
                        <h1 className="text-xl font-bold">Dispatch — How to Use This App</h1>
                        <p className="text-orange-200 text-sm">QC → Pack → Dispatch → Delivered</p>
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
                    { icon: '🔍', text: 'Never skip QC. One error costs a full reprint.' },
                    { icon: '📦', text: 'Label every package with job number + client name.' },
                    { icon: '🚚', text: 'Assign transporter before clicking Dispatch.' },
                    { icon: '✅', text: 'Mark Delivered only after transporter confirms.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-md text-xs text-orange-900">
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
