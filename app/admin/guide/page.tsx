'use client';

import { useState } from 'react';
import {
    Users, Building2, Truck, UserCheck, TrendingUp, MessageSquare,
    FileText, Briefcase, Palette, Package, Send, IndianRupee,
    ClipboardList, BarChart3, ChevronDown, ChevronRight,
    CheckCircle2, Circle, ArrowRight, Star, Zap, Shield,
    Phone, Mail, MapPin, Calendar, Clock, AlertCircle
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface Step {
    label: string;
    path?: string;
    detail?: string;
}

interface Phase {
    id: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    color: string;
    bg: string;
    border: string;
    headerBg: string;
    steps: Step[];
    tip?: string;
}

// ── Data ───────────────────────────────────────────────────────────
const phases: Phase[] = [
    {
        id: 'setup',
        icon: <Shield className="w-5 h-5" />,
        title: '1. Initial Setup',
        subtitle: 'Do this once before using the app',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        headerBg: 'bg-purple-700',
        steps: [
            { label: 'Add marketing staff', path: 'Settings → Users → Add User (role: marketing)', detail: 'Set commission % per person in their profile' },
            { label: 'Add vendors / suppliers', path: 'Finance → Vendors → Add Vendor', detail: 'Paper suppliers, printing vendors, etc.' },
            { label: 'Add transporters', path: 'Dispatch → Transporters → Add Transporter', detail: 'For delivery management' },
            { label: 'Set up bank accounts', path: 'Finance → Banks → Add Bank', detail: 'Link cash, current account, etc.' },
            { label: 'Configure opening balance', path: 'Finance → Opening Balance', detail: 'Set starting cash/bank balance' },
        ],
        tip: 'Setup only needs to happen once. After this, the daily workflow begins.',
    },
    {
        id: 'marketing',
        icon: <TrendingUp className="w-5 h-5" />,
        title: '2. Marketing Pipeline',
        subtitle: 'Lead → Follow-up → Quotation → Client',
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        headerBg: 'bg-blue-700',
        steps: [
            { label: 'Marketing staff adds a lead', path: 'Marketing → Leads → New Lead', detail: 'Name, phone, service type, requirement' },
            { label: 'Admin assigns to marketing person', path: 'Marketing → Leads → Edit Lead → Assign To', detail: 'Admin-only. The person handles follow-up.' },
            { label: 'Follow-up → Move to Follow-ups', path: 'Marketing → Leads → Move to Follow-up', detail: 'Sets a follow-up date, adds notes' },
            { label: 'Create quotation', path: 'Marketing → Quotations → New Quotation', detail: 'Share price estimate with the client' },
            { label: 'Convert to Client (if won)', path: 'Marketing → Leads → Convert to Client', detail: 'Automatically creates a Client record in CRM' },
            { label: 'Create Job for the client', path: 'Jobs → New Job → Select Client', detail: 'Job is now in the production pipeline' },
            { label: 'View Dispatched Orders', path: 'Marketing → Dispatched Orders', detail: 'Marketing staff can track which of their client orders have been dispatched or delivered' },
        ],
        tip: 'Commission is auto-triggered when the job from this lead is fully paid.',
    },
    {
        id: 'crm',
        icon: <UserCheck className="w-5 h-5" />,
        title: '3. CRM — Clients',
        subtitle: 'Manage existing clients & their history',
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        headerBg: 'bg-indigo-700',
        steps: [
            { label: 'View all clients', path: 'CRM → Clients', detail: 'Search by name, company, brand' },
            { label: 'Add a direct client (no lead)', path: 'CRM → Clients → Add Client', detail: 'For walk-in or referral clients' },
            { label: 'View client job history', path: 'CRM → Clients → View Client', detail: 'See all jobs, total billed, received, outstanding' },
            { label: 'Edit client details', path: 'CRM → Clients → Edit', detail: 'Update contact, brand name, GST, city' },
        ],
        tip: 'Job history and financials are auto-populated from existing jobs.',
    },
    {
        id: 'jobs',
        icon: <Briefcase className="w-5 h-5" />,
        title: '4. Jobs Queue',
        subtitle: 'The heart of the operation',
        color: 'text-gray-900',
        bg: 'bg-gray-50',
        border: 'border-gray-300',
        headerBg: 'bg-gray-900',
        steps: [
            { label: 'Create new job', path: 'Jobs → New Job', detail: 'Select client, job type (Print/Design/Both), quantity, amount, deadline' },
            { label: 'View Job Queue (Kanban)', path: 'Jobs → Queue', detail: 'Drag jobs between stages: New → Designing → Approval → Printing → Dispatched → Delivered' },
            { label: 'Open job details', path: 'Jobs → Queue → [Job Card]', detail: 'Files, notes, stage history, payment status' },
            { label: 'Assign designer', path: 'Job Details → Assign Designer', detail: 'Pick from active designers' },
            { label: 'Move stage manually', path: 'Job Details → Change Stage', detail: 'Or drag card in Queue view' },
            { label: 'Add payment received', path: 'Job Details → Payments → Add Payment', detail: 'Triggers commission eligible if fully paid' },
            { label: 'View all jobs (list)', path: 'Jobs → All Jobs', detail: 'Sort/filter by client, stage, date' },
        ],
        tip: 'When amount_received = total_amount, commission auto-becomes Eligible.',
    },
    {
        id: 'design',
        icon: <Palette className="w-5 h-5" />,
        title: '5. Design Studio',
        subtitle: 'For designers (& admin oversight)',
        color: 'text-pink-700',
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        headerBg: 'bg-pink-700',
        steps: [
            { label: 'Designer sees their queue', path: 'Design Studio → My Queue', detail: 'Only jobs assigned to them — sorted by deadline' },
            { label: 'Admin sees all designers', path: 'Design Studio → Team Queue', detail: 'Who is working on what, overdue tasks, all status pills' },
            { label: 'Status pills — live tracking', path: 'My Queue → Task → Status pill', detail: '🟢 Live = working now | 🟡 Hold = waiting | 🔵 Review = sent for approval | ✅ End = complete | 🔁 Transfer = reassigning' },
            { label: 'Add design task / sub-task', path: 'Design Studio → + New Project', detail: 'Break a job into design steps and assign to a designer' },
            { label: 'Upload files (Google Drive)', path: 'Job Details → Files → Upload', detail: 'Files stored in Google Drive, linked to job' },
            { label: 'Designer views timeline', path: 'Design Studio → Timeline', detail: 'Gantt-style bar chart of all tasks by date' },
            { label: 'View full task history (Dossier)', path: 'Design Studio → Dossier', detail: 'Admin-only: every task ever created, with status and time logs' },
        ],
        tip: 'Admin watches status pills to know the live state of every design job. Remind designers to update pills every time something changes.',
    },
    {
        id: 'print',
        icon: <Package className="w-5 h-5" />,
        title: '6. Print & Production',
        subtitle: 'From artwork approval to printed job',
        color: 'text-cyan-700',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        headerBg: 'bg-cyan-700',
        steps: [
            { label: 'Plan a print run', path: 'Print Planner → New Plan', detail: 'Select job, paper stock, quantity, machine' },
            { label: 'View paper stock', path: 'CMYK Print → Paper Stock', detail: 'Track available paper by type & size' },
            { label: 'Calculate print cost', path: 'CMYK Print → Cost Calculator', detail: 'Auto-calculates cost by qty, paper, ink' },
            { label: 'Mark job as Printing', path: 'Jobs → Queue → Move to Printing stage', detail: 'QC begins after printing is done' },
        ],
    },
    {
        id: 'dispatch',
        icon: <Send className="w-5 h-5" />,
        title: '7. QC & Dispatch',
        subtitle: 'Quality check → Pack → Deliver',
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        headerBg: 'bg-orange-700',
        steps: [
            { label: 'QC check printed job', path: 'Dispatch → QC Check → [Job] → Pass/Fail', detail: 'Check colour, cuts, quantities before dispatching' },
            { label: 'Assign transporter', path: 'Dispatch → [Job] → Assign Transporter', detail: 'Pick from saved transporters' },
            { label: 'Mark as Dispatched', path: 'Dispatch → Mark Dispatched', detail: 'Records dispatch date, transporter, notes' },
            { label: 'Mark as Delivered', path: 'Jobs → Queue → Delivered', detail: 'Final stage — order complete' },
            { label: 'View dispatch history', path: 'Dispatch → History', detail: 'All past dispatches with dates & transporters' },
        ],
        tip: 'QC must pass before dispatch is allowed.',
    },
    {
        id: 'finance',
        icon: <IndianRupee className="w-5 h-5" />,
        title: '8. Finance',
        subtitle: 'Payments, invoices, accounts',
        color: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-200',
        headerBg: 'bg-green-700',
        steps: [
            { label: 'Record payment received from client', path: 'Finance → Payments → New Payment', detail: 'Links to job, auto-updates outstanding' },
            { label: 'Create invoice / bill', path: 'Finance → Invoices → New Invoice', detail: 'GST invoice with job details' },
            { label: 'Record vendor purchase/bill', path: 'Finance → Vendors → [Vendor] → Purchases', detail: 'Paper, printing materials, services bought' },
            { label: 'Record cash / bank expense', path: 'Finance → Daily → Add Entry', detail: 'Daily petty cash and expenses' },
            { label: 'View account ledger / statement', path: 'Finance → Accounts → [Account] → Statement', detail: 'Full debit/credit history per account' },
            { label: 'Daily Summary (admin only)', path: 'Finance → Daily Summary', detail: 'All account balances for any selected date at a glance' },
            { label: 'Bank reconciliation', path: 'Finance → Banking', detail: 'Match bank statement with app records' },
            { label: 'View financial reports', path: 'Finance → Reports', detail: 'P&L, cashbook, client outstanding, vendor reports' },
        ],
        tip: 'Adding a payment from client auto-triggers commission eligible if job is fully paid.',
    },
    {
        id: 'commission',
        icon: <Star className="w-5 h-5" />,
        title: '9. Commissions',
        subtitle: 'Auto-calculated for marketing staff',
        color: 'text-yellow-700',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        headerBg: 'bg-yellow-700',
        steps: [
            { label: 'Commission auto-appears after full payment', path: 'Commissions page → Eligible tab', detail: 'Status = Eligible automatically' },
            { label: 'Admin sets % and approves', path: 'Commissions → [Job] → Set % & Approve', detail: 'Can override default rate per person' },
            { label: 'Admin physically pays staff', path: 'Commissions → [Job] → Mark as Paid', detail: 'Records paid date' },
            { label: 'Marketing person sees their earnings', path: 'Marketing → Dashboard → Commission widget', detail: 'Eligible / Approved / Paid amounts' },
        ],
        tip: 'Set each marketing person\'s default commission rate in their profile (Settings → Users).',
    },
    {
        id: 'eod',
        icon: <ClipboardList className="w-5 h-5" />,
        title: '10. EOD Reports',
        subtitle: 'End-of-day summary from every staff member',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        headerBg: 'bg-rose-700',
        steps: [
            { label: 'Staff submits EOD report', path: 'EOD Report → Submit Report', detail: 'List of tasks done, blockers, next day plan' },
            { label: 'Admin reviews all EOD reports', path: 'EOD Report → Admin View', detail: 'See all staff reports for today. Rate each report.' },
            { label: 'View past reports', path: 'EOD Report → Admin View → Filter by Date', detail: 'Historical archive of all submissions' },
        ],
        tip: 'Staff can only submit one EOD per day.',
    },
    {
        id: 'monitoring',
        icon: <BarChart3 className="w-5 h-5" />,
        title: '11. Admin Monitoring',
        subtitle: 'Dashboard, activity, broadcast',
        color: 'text-slate-700',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        headerBg: 'bg-slate-700',
        steps: [
            { label: 'Overview Dashboard', path: 'Dashboard → Overview', detail: 'Jobs in progress, revenue this month, pending payments' },
            { label: 'Activity Log', path: 'Activity', detail: 'Every action by every user — who did what and when' },
            { label: 'Broadcast message to all staff', path: 'Broadcast → New Message', detail: 'Announcements visible to all users on dashboard' },
            { label: 'Calendar view (role-filtered)', path: 'Calendar', detail: 'Admin sees all: job deadlines, follow-ups, dispatch dates. Each staff member only sees their own.' },
            { label: 'System Health check', path: 'System Health', detail: 'DB status, config checks, error logs' },
        ],
    },
];

const flowItems = [
    { label: 'Lead', color: 'bg-blue-500' },
    { label: 'Follow-up', color: 'bg-indigo-500' },
    { label: 'Quotation', color: 'bg-violet-500' },
    { label: 'Job Created', color: 'bg-gray-800' },
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
                        <h1 className="text-xl font-bold">Admin Guide — How to Use Aayam Office</h1>
                        <p className="text-gray-400 text-sm">Complete click-by-click walkthrough for admins</p>
                    </div>
                </div>
                <p className="text-sm text-gray-300 mt-3 leading-relaxed">
                    This guide covers every step from the moment a lead walks in to payment collected, commission paid, and delivery done.
                    Click any section below to expand the detailed steps.
                </p>
            </div>

            {/* Flow Diagram */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Order Lifecycle (Start → End)</p>
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

            {/* Role Quick Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    {
                        role: 'Admin', icon: <Shield className="w-4 h-4 text-white" />, bg: 'bg-gray-900', text: 'text-white',
                        can: ['Sees everything', 'Approves commissions', 'Reviews EOD reports', 'Manages vendors, clients, staff', 'All finance']
                    },
                    {
                        role: 'Marketing', icon: <TrendingUp className="w-4 h-4 text-blue-700" />, bg: 'bg-blue-50', text: 'text-blue-900',
                        can: ['Adds leads & follow-ups', 'Creates quotations', 'Converts leads to clients', 'Sees own commissions', 'Tracks dispatched orders']
                    },
                    {
                        role: 'Designer', icon: <Palette className="w-4 h-4 text-pink-700" />, bg: 'bg-pink-50', text: 'text-pink-900',
                        can: ['Sees assigned jobs in My Queue', 'Updates status pills (Live/Hold/Review/End)', 'Submits EOD report', 'Uploads files', 'My Notes & Calendar']
                    },
                ].map((r) => (
                    <div key={r.role} className={`rounded-md border p-3 ${r.bg} ${r.role === 'Admin' ? 'border-gray-700' : r.role === 'Marketing' ? 'border-blue-200' : 'border-pink-200'}`}>
                        <div className={`flex items-center gap-2 mb-2 ${r.text}`}>
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${r.role === 'Admin' ? 'bg-white/10' : r.role === 'Marketing' ? 'bg-blue-100' : 'bg-pink-100'}`}>
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

            {/* Phases — Accordion */}
            <div className="space-y-2">
                {phases.map((phase) => {
                    const isOpen = openPhase === phase.id;
                    return (
                        <div key={phase.id} className={`rounded-md border overflow-hidden ${phase.border}`}>
                            {/* Phase Header */}
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

                            {/* Steps */}
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
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">⚡ Quick Tips</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                    {[
                        '📌 Always assign leads to marketing staff — else commission won\'t work',
                        '💰 Commission only triggers after 100% payment is received from client',
                        '🎨 Designers can\'t see other designers\' jobs — fully isolated view',
                        '📊 EOD reports must be submitted daily by each staff member',
                        '🔍 Activity Log records every action — use it to audit user activity',
                        '🏦 Add bank accounts before recording any payments',
                        '📱 App works on mobile — staff can use it on their phones',
                        '🔔 Broadcast messages appear on all staff dashboards instantly',
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
