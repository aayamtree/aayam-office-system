'use client';

import { useState } from 'react';
import {
    TrendingUp, Phone, FileText, UserCheck, IndianRupee, Star,
    ChevronDown, ChevronRight, ArrowRight, AlertCircle, CheckCircle2,
    Zap, Calendar, MessageSquare, Target, Clock, Users
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
        subtitle: 'Check what needs your attention today',
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-700',
        steps: [
            { label: 'Check today\'s follow-ups', path: 'Marketing → Follow-ups → Today tab', detail: 'These clients expect a call today' },
            { label: 'Check overdue follow-ups', path: 'Marketing → Follow-ups → Overdue tab', detail: 'Don\'t let these slip — call immediately' },
            { label: 'View your leads pipeline', path: 'Marketing → Leads', detail: 'See all active leads and their status' },
            { label: 'Review your orders', path: 'Marketing → My Orders', detail: 'Track orders you originated' },
        ],
        tip: 'Complete today\'s follow-ups FIRST before adding new leads.',
    },
    {
        id: 'leads',
        icon: <Users className="w-5 h-5" />,
        title: '2. Adding a New Lead',
        subtitle: 'Someone shows interest — add them immediately',
        color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-700',
        steps: [
            { label: 'Click New Lead', path: 'Marketing → Leads → + New Lead', detail: 'Fill name, phone, service type, requirement' },
            { label: 'Add their requirement details', path: 'Lead Form → Requirement field', detail: 'Be specific — product type, quantity, deadline' },
            { label: 'Save the lead', path: 'Save Lead button', detail: 'Lead is created in your pipeline' },
            { label: 'Schedule a follow-up', path: 'Lead card → Set Follow-up Date', detail: 'Pick a date when you\'ll call back' },
            { label: 'Add notes after each call', path: 'Lead → Add Note', detail: 'Record what was discussed, objections, next step' },
        ],
        tip: 'Admin assigns leads to marketing persons. If a lead has no assignment, remind admin.',
    },
    {
        id: 'followup',
        icon: <Phone className="w-5 h-5" />,
        title: '3. Following Up',
        subtitle: 'Consistent follow-ups = conversions',
        color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-700',
        steps: [
            { label: 'Open follow-up', path: 'Marketing → Follow-ups', detail: 'See all due and overdue follow-ups' },
            { label: 'Call the client', path: '—', detail: 'Make the actual call outside the app' },
            { label: 'Record outcome + notes', path: 'Follow-up → Add Note', detail: 'What happened? Interested? Need more time? Lost?' },
            { label: 'Update lead status', path: 'Lead → Edit Status', detail: 'Set: Follow-up / Quoted / Negotiating / Converted / Lost' },
            { label: 'Reschedule next follow-up', path: 'Lead → Set Next Follow-up Date', detail: 'Keep the loop going until converted or lost' },
        ],
        tip: '3–5 follow-ups before marking a lead as Lost is normal.',
    },
    {
        id: 'quotation',
        icon: <FileText className="w-5 h-5" />,
        title: '4. Creating a Quotation',
        subtitle: 'Send a formal price to the client',
        color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-700',
        steps: [
            { label: 'Create new quotation', path: 'Marketing → Quotations → New Quotation', detail: 'Link it to the lead' },
            { label: 'Add job details & pricing', path: 'Quotation form → Items, GST, total', detail: 'Break down product, qty, rate' },
            { label: 'Save & share with client', path: 'Save → Share / Print', detail: 'Send via WhatsApp or email' },
            { label: 'Follow up on quotation', path: 'Marketing → Follow-ups → Quotation tab', detail: 'Check back in 1–2 days' },
        ],
    },
    {
        id: 'convert',
        icon: <UserCheck className="w-5 h-5" />,
        title: '5. Converting a Lead',
        subtitle: 'Client says YES — convert to order',
        color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', headerBg: 'bg-green-700',
        steps: [
            { label: 'Open the lead', path: 'Marketing → Leads → [Lead name]', detail: '' },
            { label: 'Click Convert to Client', path: 'Lead → Convert to Client button', detail: 'Creates client record in CRM automatically' },
            { label: 'Admin creates the job', path: 'Jobs → New Job → Select this client', detail: 'You don\'t create jobs — admin does after briefing' },
            { label: 'Brief admin on requirements', path: '—', detail: 'Share all specs: size, qty, material, deadline' },
        ],
        tip: 'Your commission starts being tracked from the moment a job is created for this client.',
    },
    {
        id: 'commission',
        icon: <IndianRupee className="w-5 h-5" />,
        title: '6. Your Commission',
        subtitle: 'Automatic — no manual entry needed',
        color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', headerBg: 'bg-yellow-700',
        steps: [
            { label: 'Commission is auto-created when job is fully paid', path: 'Marketing → Commissions', detail: 'Status shows "Eligible" — waiting admin approval' },
            { label: 'Admin approves & sets the %', path: 'Admin action — not yours', detail: 'Based on your profile rate or custom per job' },
            { label: 'Admin pays you physically + marks paid', path: 'Admin action', detail: 'Status updates to "Paid" in the app' },
            { label: 'View your earnings', path: 'Marketing → Dashboard → Commission widget', detail: 'Pending / Approved / Paid amounts clearly shown' },
        ],
        tip: 'Commissions are on the BASE amount after GST is deducted. Example: ₹1,18,000 job at 18% GST → base = ₹1,00,000 → 5% commission = ₹5,000.',
    },
    {
        id: 'eod',
        icon: <Target className="w-5 h-5" />,
        title: '7. EOD Report (End of Day)',
        subtitle: 'Submit before leaving — every day',
        color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-700',
        steps: [
            { label: 'Open EOD Report', path: 'EOD Report → Submit Report', detail: 'Available only once per day' },
            { label: 'List today\'s tasks completed', path: 'What did you do today?', detail: 'Calls made, leads added, quotations sent, meetings done' },
            { label: 'Mention blockers if any', path: 'Blockers section', detail: 'Anything stopping you from converting leads' },
            { label: 'Add tomorrow\'s plan', path: 'Tomorrow\'s plan section', detail: 'Which leads will you follow up on?' },
            { label: 'Submit', path: 'Submit EOD button', detail: 'Admin gets notified' },
        ],
        tip: 'EOD report must be submitted daily. Admin reviews and rates your report.',
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
                        <h1 className="text-xl font-bold">Marketing — How to Use This App</h1>
                        <p className="text-blue-200 text-sm">Your complete daily guide: leads → conversions → commissions</p>
                    </div>
                </div>
            </div>

            {/* Flow */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your Pipeline Flow</p>
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
                    { icon: '📞', text: 'Call first, then update app. Don\'t delay adding notes.' },
                    { icon: '💬', text: 'Add notes after EVERY call — admin reads these.' },
                    { icon: '📅', text: 'Always set a next follow-up date — never leave a lead hanging.' },
                    { icon: '💰', text: 'Commission only happens after the client FULLY pays.' },
                ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-900">
                        <span className="text-base">{r.icon}</span>
                        <span>{r.text}</span>
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
