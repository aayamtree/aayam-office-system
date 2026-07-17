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
    labelEn?: string;
    path?: string;
    detail?: string;
    detailEn?: string;
}

interface Phase {
    id: string;
    icon: React.ReactNode;
    title: string;
    titleEn?: string;
    subtitle: string;
    subtitleEn?: string;
    color: string;
    bg: string;
    border: string;
    headerBg: string;
    steps: Step[];
    tip?: string;
    tipEn?: string;
}

// ── Data ───────────────────────────────────────────────────────────
const phases: Phase[] = [
    {
        id: 'setup',
        icon: <Shield className="w-5 h-5" />,
        title: '1. શરૂઆતનું Setup', titleEn: '1. Initial Setup',
        subtitle: 'App વાપરતા પહેલા આ એક જ વાર કરવાનું', subtitleEn: 'Do this once before using the app',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        headerBg: 'bg-purple-700',
        steps: [
            { label: 'માર્કેટિંગ સ્ટાફ ઉમેરો', labelEn: 'Add marketing staff', path: 'Settings → Users → Add User (role: marketing)', detail: 'દરેક વ્યક્તિની પ્રોફાઇલમાં કમિશન % સેટ કરો', detailEn: 'Set commission % per person in their profile' },
            { label: 'વેન્ડર / સપ્લાયર ઉમેરો', labelEn: 'Add vendors / suppliers', path: 'Finance → Vendors → Add Vendor', detail: 'પેપર સપ્લાયર, પ્રિન્ટિંગ વેન્ડર વગેરે', detailEn: 'Paper suppliers, printing vendors, etc.' },
            { label: 'ટ્રાન્સપોર્ટર ઉમેરો', labelEn: 'Add transporters', path: 'Dispatch → Transporters → Add Transporter', detail: 'ડિલિવરી મેનેજમેન્ટ માટે', detailEn: 'For delivery management' },
            { label: 'બેંક એકાઉન્ટ સેટ કરો', labelEn: 'Set up bank accounts', path: 'Finance → Banks → Add Bank', detail: 'કેશ, કરંટ એકાઉન્ટ વગેરે લિંક કરો', detailEn: 'Link cash, current account, etc.' },
            { label: 'ઓપનિંગ બેલેન્સ સેટ કરો', labelEn: 'Configure opening balance', path: 'Finance → Opening Balance', detail: 'શરૂઆતનું કેશ/બેંક બેલેન્સ નાખો', detailEn: 'Set starting cash/bank balance' },
        ],
        tip: 'Setup ફક્ત એક જ વાર કરવાનું છે. પછી રોજનું કામ (daily workflow) શરૂ થાય.', tipEn: 'Setup only needs to happen once. After this, the daily workflow begins.',
    },
    {
        id: 'marketing',
        icon: <TrendingUp className="w-5 h-5" />,
        title: '2. માર્કેટિંગ પાઇપલાઇન', titleEn: '2. Marketing Pipeline',
        subtitle: 'લીડ → ફોલો-અપ → ક્વોટેશન → ક્લાયન્ટ', subtitleEn: 'Lead → Follow-up → Quotation → Client',
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        headerBg: 'bg-blue-700',
        steps: [
            { label: 'માર્કેટિંગ સ્ટાફ નવી લીડ ઉમેરે', labelEn: 'Marketing staff adds a lead', path: 'Marketing → Leads → New Lead', detail: 'નામ, ફોન, સર્વિસ ટાઇપ, જરૂરિયાત', detailEn: 'Name, phone, service type, requirement' },
            { label: 'એડમિન લીડ માર્કેટિંગ વ્યક્તિને એસાઇન કરે', labelEn: 'Admin assigns to marketing person', path: 'Marketing → Leads → Edit Lead → Assign To', detail: 'ફક્ત એડમિન કરી શકે. તે વ્યક્તિ ફોલો-અપ સંભાળે.', detailEn: 'Admin-only. The person handles follow-up.' },
            { label: 'ફોલો-અપ → Follow-ups માં મૂવ કરો', labelEn: 'Follow-up → Move to Follow-ups', path: 'Marketing → Leads → Move to Follow-up', detail: 'ફોલો-અપ તારીખ સેટ થાય, નોટ્સ ઉમેરાય', detailEn: 'Sets a follow-up date, adds notes' },
            { label: 'ક્વોટેશન બનાવો', labelEn: 'Create quotation', path: 'Marketing → Quotations → New Quotation', detail: 'ક્લાયન્ટને ભાવ (price estimate) મોકલો', detailEn: 'Share price estimate with the client' },
            { label: 'જીતી ગયા તો Client માં કન્વર્ટ કરો', labelEn: 'Convert to Client (if won)', path: 'Marketing → Leads → Convert to Client', detail: 'CRM માં ક્લાયન્ટ રેકોર્ડ ઓટોમેટિક બની જાય', detailEn: 'Automatically creates a Client record in CRM' },
            { label: 'ક્લાયન્ટ માટે જોબ બનાવો', labelEn: 'Create Job for the client', path: 'Jobs → New Job → Select Client', detail: 'જોબ હવે પ્રોડક્શન પાઇપલાઇનમાં આવી ગઈ', detailEn: 'Job is now in the production pipeline' },
            { label: 'Dispatched Orders જુઓ', labelEn: 'View Dispatched Orders', path: 'Marketing → Dispatched Orders', detail: 'માર્કેટિંગ સ્ટાફ પોતાના ક્લાયન્ટના કયા ઓર્ડર ડિસ્પેચ કે ડિલિવર થયા તે ટ્રેક કરી શકે', detailEn: 'Marketing staff can track which of their client orders have been dispatched or delivered' },
        ],
        tip: 'આ લીડની જોબનું પૂરું પેમેન્ટ આવે એટલે કમિશન ઓટોમેટિક ટ્રિગર થાય.', tipEn: 'Commission is auto-triggered when the job from this lead is fully paid.',
    },
    {
        id: 'crm',
        icon: <UserCheck className="w-5 h-5" />,
        title: '3. CRM — ક્લાયન્ટ્સ', titleEn: '3. CRM — Clients',
        subtitle: 'હાલના ક્લાયન્ટ અને તેમની હિસ્ટ્રી મેનેજ કરો', subtitleEn: 'Manage existing clients & their history',
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        headerBg: 'bg-indigo-700',
        steps: [
            { label: 'બધા ક્લાયન્ટ જુઓ', labelEn: 'View all clients', path: 'CRM → Clients', detail: 'નામ, કંપની, બ્રાન્ડથી સર્ચ કરો', detailEn: 'Search by name, company, brand' },
            { label: 'ડાયરેક્ટ ક્લાયન્ટ ઉમેરો (લીડ વગર)', labelEn: 'Add a direct client (no lead)', path: 'CRM → Clients → Add Client', detail: 'વોક-ઇન કે રેફરલ ક્લાયન્ટ માટે', detailEn: 'For walk-in or referral clients' },
            { label: 'ક્લાયન્ટની જોબ હિસ્ટ્રી જુઓ', labelEn: 'View client job history', path: 'CRM → Clients → View Client', detail: 'બધી જોબ, કુલ બિલ, મળેલી રકમ, બાકી રકમ', detailEn: 'See all jobs, total billed, received, outstanding' },
            { label: 'ક્લાયન્ટ ડિટેલ્સ એડિટ કરો', labelEn: 'Edit client details', path: 'CRM → Clients → Edit', detail: 'કોન્ટેક્ટ, બ્રાન્ડ નામ, GST, શહેર અપડેટ કરો', detailEn: 'Update contact, brand name, GST, city' },
        ],
        tip: 'જોબ હિસ્ટ્રી અને ફાઇનાન્સ આંકડા જોબમાંથી ઓટોમેટિક ભરાય છે.', tipEn: 'Job history and financials are auto-populated from existing jobs.',
    },
    {
        id: 'jobs',
        icon: <Briefcase className="w-5 h-5" />,
        title: '4. જોબ્સ ક્યુ (Jobs Queue)', titleEn: '4. Jobs Queue',
        subtitle: 'આખા ઓપરેશનનું હૃદય', subtitleEn: 'The heart of the operation',
        color: 'text-gray-900',
        bg: 'bg-gray-50',
        border: 'border-gray-300',
        headerBg: 'bg-gray-900',
        steps: [
            { label: 'નવી જોબ બનાવો', labelEn: 'Create new job', path: 'Jobs → New Job', detail: 'ક્લાયન્ટ, જોબ ટાઇપ (Print/Design/Both), ક્વોન્ટિટી, રકમ, ડેડલાઇન પસંદ કરો', detailEn: 'Select client, job type (Print/Design/Both), quantity, amount, deadline' },
            { label: 'જોબ ક્યુ જુઓ (Kanban)', labelEn: 'View Job Queue (Kanban)', path: 'Jobs → Queue', detail: 'જોબને સ્ટેજ વચ્ચે ડ્રેગ કરો: New → Designing → Approval → Printing → Dispatched → Delivered', detailEn: 'Drag jobs between stages: New → Designing → Approval → Printing → Dispatched → Delivered' },
            { label: 'જોબ ડિટેલ્સ ખોલો', labelEn: 'Open job details', path: 'Jobs → Queue → [Job Card]', detail: 'ફાઇલ્સ, નોટ્સ, સ્ટેજ હિસ્ટ્રી, પેમેન્ટ સ્ટેટસ', detailEn: 'Files, notes, stage history, payment status' },
            { label: 'ડિઝાઇનર એસાઇન કરો', labelEn: 'Assign designer', path: 'Job Details → Assign Designer', detail: 'એક્ટિવ ડિઝાઇનરમાંથી પસંદ કરો', detailEn: 'Pick from active designers' },
            { label: 'સ્ટેજ મેન્યુઅલી બદલો', labelEn: 'Move stage manually', path: 'Job Details → Change Stage', detail: 'અથવા Queue વ્યૂમાં કાર્ડ ડ્રેગ કરો', detailEn: 'Or drag card in Queue view' },
            { label: 'મળેલું પેમેન્ટ ઉમેરો', labelEn: 'Add payment received', path: 'Job Details → Payments → Add Payment', detail: 'પૂરું પેમેન્ટ થાય તો કમિશન Eligible થાય', detailEn: 'Triggers commission eligible if fully paid' },
            { label: 'બધી જોબ લિસ્ટમાં જુઓ', labelEn: 'View all jobs (list)', path: 'Jobs → All Jobs', detail: 'ક્લાયન્ટ, સ્ટેજ, તારીખ પ્રમાણે sort/filter કરો', detailEn: 'Sort/filter by client, stage, date' },
        ],
        tip: 'જ્યારે મળેલી રકમ = કુલ રકમ, ત્યારે કમિશન ઓટોમેટિક Eligible બની જાય.', tipEn: 'When amount_received = total_amount, commission auto-becomes Eligible.',
    },
    {
        id: 'design',
        icon: <Palette className="w-5 h-5" />,
        title: '5. ડિઝાઇન સ્ટુડિયો', titleEn: '5. Design Studio',
        subtitle: 'ડિઝાઇનર માટે (અને એડમિનની દેખરેખ માટે)', subtitleEn: 'For designers (& admin oversight)',
        color: 'text-pink-700',
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        headerBg: 'bg-pink-700',
        steps: [
            { label: 'ડિઝાઇનર પોતાની ક્યુ જુએ', labelEn: 'Designer sees their queue', path: 'Design Studio → My Queue', detail: 'ફક્ત તેને એસાઇન થયેલી જોબ — ડેડલાઇન પ્રમાણે ગોઠવેલી', detailEn: 'Only jobs assigned to them — sorted by deadline' },
            { label: 'એડમિન બધા ડિઝાઇનર જુએ', labelEn: 'Admin sees all designers', path: 'Design Studio → Team Queue', detail: 'કોણ શું કરી રહ્યું છે, ઓવરડ્યુ ટાસ્ક, બધા સ્ટેટસ પિલ્સ', detailEn: 'Who is working on what, overdue tasks, all status pills' },
            { label: 'સ્ટેટસ પિલ્સ — લાઇવ ટ્રેકિંગ', labelEn: 'Status pills — live tracking', path: 'My Queue → Task → Status pill', detail: '🟢 Live = અત્યારે કામ ચાલુ | 🟡 Pause = રાહ જોવાય છે | 🔵 Review = અપ્રૂવલ માટે મોકલ્યું | ✅ End = કામ પૂરું | 🔁 Transfer = બીજા ડિઝાઇનરને સોંપવું', detailEn: '🟢 Live = working now | 🟡 Pause = waiting | 🔵 Review = sent for approval | ✅ End = complete | 🔁 Transfer = reassigning' },
            { label: 'ડિઝાઇન ટાસ્ક / સબ-ટાસ્ક ઉમેરો', labelEn: 'Add design task / sub-task', path: 'Design Studio → + New Project', detail: 'જોબને ડિઝાઇન સ્ટેપમાં વહેંચી ડિઝાઇનરને એસાઇન કરો', detailEn: 'Break a job into design steps and assign to a designer' },
            { label: 'ફાઇલ અપલોડ કરો (Google Drive)', labelEn: 'Upload files (Google Drive)', path: 'Job Details → Files → Upload', detail: 'ફાઇલ Google Drive માં સ્ટોર થાય, જોબ સાથે લિંક રહે', detailEn: 'Files stored in Google Drive, linked to job' },
            { label: 'ડિઝાઇનર ટાઇમલાઇન જુએ', labelEn: 'Designer views timeline', path: 'Design Studio → Timeline', detail: 'બધા ટાસ્કનો તારીખ પ્રમાણે Gantt-સ્ટાઇલ ચાર્ટ', detailEn: 'Gantt-style bar chart of all tasks by date' },
            { label: 'આખી ટાસ્ક હિસ્ટ્રી જુઓ (Dossier)', labelEn: 'View full task history (Dossier)', path: 'Design Studio → Dossier', detail: 'ફક્ત એડમિન: અત્યાર સુધીના બધા ટાસ્ક, સ્ટેટસ અને ટાઇમ લોગ સાથે', detailEn: 'Admin-only: every task ever created, with status and time logs' },
        ],
        tip: 'એડમિન સ્ટેટસ પિલ્સ જોઈને દરેક ડિઝાઇન જોબની લાઇવ સ્થિતિ જાણી શકે. ડિઝાઇનરને યાદ કરાવો — કંઈ પણ બદલાય એટલે પિલ અપડેટ કરે.', tipEn: 'Admin watches status pills to know the live state of every design job. Remind designers to update pills every time something changes.',
    },
    {
        id: 'print',
        icon: <Package className="w-5 h-5" />,
        title: '6. પ્રિન્ટ અને પ્રોડક્શન', titleEn: '6. Print & Production',
        subtitle: 'આર્ટવર્ક અપ્રૂવલથી પ્રિન્ટેડ જોબ સુધી', subtitleEn: 'From artwork approval to printed job',
        color: 'text-cyan-700',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        headerBg: 'bg-cyan-700',
        steps: [
            { label: 'પ્રિન્ટ રન પ્લાન કરો', labelEn: 'Plan a print run', path: 'Print Planner → New Plan', detail: 'જોબ, પેપર સ્ટોક, ક્વોન્ટિટી, મશીન પસંદ કરો', detailEn: 'Select job, paper stock, quantity, machine' },
            { label: 'પેપર સ્ટોક જુઓ', labelEn: 'View paper stock', path: 'CMYK Print → Paper Stock', detail: 'ટાઇપ અને સાઇઝ પ્રમાણે ઉપલબ્ધ પેપર ટ્રેક કરો', detailEn: 'Track available paper by type & size' },
            { label: 'પ્રિન્ટ કોસ્ટ ગણો', labelEn: 'Calculate print cost', path: 'CMYK Print → Cost Calculator', detail: 'ક્વોન્ટિટી, પેપર, ઇંક પ્રમાણે કોસ્ટ ઓટોમેટિક ગણાય', detailEn: 'Auto-calculates cost by qty, paper, ink' },
            { label: 'જોબને Printing સ્ટેજમાં મૂકો', labelEn: 'Mark job as Printing', path: 'Jobs → Queue → Move to Printing stage', detail: 'પ્રિન્ટિંગ પૂરું થાય પછી QC શરૂ થાય', detailEn: 'QC begins after printing is done' },
        ],
    },
    {
        id: 'dispatch',
        icon: <Send className="w-5 h-5" />,
        title: '7. QC અને ડિસ્પેચ', titleEn: '7. QC & Dispatch',
        subtitle: 'ક્વોલિટી ચેક → પેકિંગ → ડિલિવરી', subtitleEn: 'Quality check → Pack → Deliver',
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        headerBg: 'bg-orange-700',
        steps: [
            { label: 'પ્રિન્ટેડ જોબનું QC કરો', labelEn: 'QC check printed job', path: 'Dispatch → QC Check → [Job] → Pass/Fail', detail: 'ડિસ્પેચ પહેલા કલર, કટિંગ, ક્વોન્ટિટી ચેક કરો', detailEn: 'Check colour, cuts, quantities before dispatching' },
            { label: 'ટ્રાન્સપોર્ટર એસાઇન કરો', labelEn: 'Assign transporter', path: 'Dispatch → [Job] → Assign Transporter', detail: 'સેવ કરેલા ટ્રાન્સપોર્ટરમાંથી પસંદ કરો', detailEn: 'Pick from saved transporters' },
            { label: 'Dispatched માર્ક કરો', labelEn: 'Mark as Dispatched', path: 'Dispatch → Mark Dispatched', detail: 'ડિસ્પેચ તારીખ, ટ્રાન્સપોર્ટર, નોટ્સ રેકોર્ડ થાય', detailEn: 'Records dispatch date, transporter, notes' },
            { label: 'Delivered માર્ક કરો', labelEn: 'Mark as Delivered', path: 'Jobs → Queue → Delivered', detail: 'છેલ્લું સ્ટેજ — ઓર્ડર પૂરો', detailEn: 'Final stage — order complete' },
            { label: 'ડિસ્પેચ હિસ્ટ્રી જુઓ', labelEn: 'View dispatch history', path: 'Dispatch → History', detail: 'બધા જૂના ડિસ્પેચ — તારીખ અને ટ્રાન્સપોર્ટર સાથે', detailEn: 'All past dispatches with dates & transporters' },
        ],
        tip: 'QC પાસ થાય પછી જ ડિસ્પેચ થઈ શકે.', tipEn: 'QC must pass before dispatch is allowed.',
    },
    {
        id: 'finance',
        icon: <IndianRupee className="w-5 h-5" />,
        title: '8. ફાઇનાન્સ', titleEn: '8. Finance',
        subtitle: 'પેમેન્ટ, ઇન્વૉઇસ, એકાઉન્ટ્સ', subtitleEn: 'Payments, invoices, accounts',
        color: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-200',
        headerBg: 'bg-green-700',
        steps: [
            { label: 'ક્લાયન્ટ પાસેથી મળેલું પેમેન્ટ રેકોર્ડ કરો', labelEn: 'Record payment received from client', path: 'Finance → Payments → New Payment', detail: 'જોબ સાથે લિંક થાય, બાકી રકમ ઓટોમેટિક અપડેટ થાય', detailEn: 'Links to job, auto-updates outstanding' },
            { label: 'ઇન્વૉઇસ / બિલ બનાવો', labelEn: 'Create invoice / bill', path: 'Finance → Invoices → New Invoice', detail: 'જોબ ડિટેલ્સ સાથે GST ઇન્વૉઇસ', detailEn: 'GST invoice with job details' },
            { label: 'વેન્ડર ખરીદી / બિલ રેકોર્ડ કરો', labelEn: 'Record vendor purchase/bill', path: 'Finance → Vendors → [Vendor] → Purchases', detail: 'પેપર, પ્રિન્ટિંગ મટીરિયલ, સર્વિસની ખરીદી', detailEn: 'Paper, printing materials, services bought' },
            { label: 'કેશ / બેંક ખર્ચ રેકોર્ડ કરો', labelEn: 'Record cash / bank expense', path: 'Finance → Daily → Add Entry', detail: 'રોજનો પેટી કેશ અને ખર્ચા', detailEn: 'Daily petty cash and expenses' },
            { label: 'એકાઉન્ટ લેજર / સ્ટેટમેન્ટ જુઓ', labelEn: 'View account ledger / statement', path: 'Finance → Accounts → [Account] → Statement', detail: 'દરેક એકાઉન્ટની આખી ડેબિટ/ક્રેડિટ હિસ્ટ્રી', detailEn: 'Full debit/credit history per account' },
            { label: 'Daily Summary (ફક્ત એડમિન)', labelEn: 'Daily Summary (admin only)', path: 'Finance → Daily Summary', detail: 'કોઈ પણ તારીખના બધા એકાઉન્ટ બેલેન્સ એક નજરમાં', detailEn: 'All account balances for any selected date at a glance' },
            { label: 'બેંક રિકન્સિલિએશન', labelEn: 'Bank reconciliation', path: 'Finance → Banking', detail: 'બેંક સ્ટેટમેન્ટને app ના રેકોર્ડ સાથે મેચ કરો', detailEn: 'Match bank statement with app records' },
            { label: 'ફાઇનાન્સ રિપોર્ટ જુઓ', labelEn: 'View financial reports', path: 'Finance → Reports', detail: 'P&L, કેશબુક, ક્લાયન્ટ બાકી, વેન્ડર રિપોર્ટ', detailEn: 'P&L, cashbook, client outstanding, vendor reports' },
        ],
        tip: 'જોબનું પૂરું પેમેન્ટ થઈ જાય એટલે ક્લાયન્ટ પેમેન્ટ ઉમેરતાં જ કમિશન ઓટોમેટિક Eligible થાય.', tipEn: 'Adding a payment from client auto-triggers commission eligible if job is fully paid.',
    },
    {
        id: 'commission',
        icon: <Star className="w-5 h-5" />,
        title: '9. કમિશન', titleEn: '9. Commissions',
        subtitle: 'માર્કેટિંગ સ્ટાફ માટે ઓટોમેટિક ગણાય', subtitleEn: 'Auto-calculated for marketing staff',
        color: 'text-yellow-700',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        headerBg: 'bg-yellow-700',
        steps: [
            { label: 'પૂરા પેમેન્ટ પછી કમિશન ઓટોમેટિક દેખાય', labelEn: 'Commission auto-appears after full payment', path: 'Commissions page → Eligible tab', detail: 'સ્ટેટસ ઓટોમેટિક Eligible થાય', detailEn: 'Status = Eligible automatically' },
            { label: 'એડમિન % સેટ કરી અપ્રૂવ કરે', labelEn: 'Admin sets % and approves', path: 'Commissions → [Job] → Set % & Approve', detail: 'દરેક વ્યક્તિનો ડિફોલ્ટ રેટ બદલી પણ શકાય', detailEn: 'Can override default rate per person' },
            { label: 'એડમિન સ્ટાફને રૂબરૂ પેમેન્ટ કરે', labelEn: 'Admin physically pays staff', path: 'Commissions → [Job] → Mark as Paid', detail: 'પેમેન્ટ તારીખ રેકોર્ડ થાય', detailEn: 'Records paid date' },
            { label: 'માર્કેટિંગ વ્યક્તિ પોતાની કમાણી જુએ', labelEn: 'Marketing person sees their earnings', path: 'Marketing → Dashboard → Commission widget', detail: 'Eligible / Approved / Paid રકમ', detailEn: 'Eligible / Approved / Paid amounts' },
        ],
        tip: 'દરેક માર્કેટિંગ વ્યક્તિનો ડિફોલ્ટ કમિશન રેટ તેની પ્રોફાઇલમાં સેટ કરો (Settings → Users).', tipEn: 'Set each marketing person\'s default commission rate in their profile (Settings → Users).',
    },
    {
        id: 'eod',
        icon: <ClipboardList className="w-5 h-5" />,
        title: '10. EOD રિપોર્ટ', titleEn: '10. EOD Reports',
        subtitle: 'દરેક સ્ટાફનો દિવસના અંતનો રિપોર્ટ', subtitleEn: 'End-of-day summary from every staff member',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        headerBg: 'bg-rose-700',
        steps: [
            { label: 'સ્ટાફ EOD રિપોર્ટ સબમિટ કરે', labelEn: 'Staff submits EOD report', path: 'EOD Report → Submit Report', detail: 'આજે કરેલા કામ, અડચણો (blockers), કાલનો પ્લાન', detailEn: 'List of tasks done, blockers, next day plan' },
            { label: 'એડમિન બધા EOD રિપોર્ટ રિવ્યૂ કરે', labelEn: 'Admin reviews all EOD reports', path: 'EOD Report → Admin View', detail: 'આજના બધા સ્ટાફ રિપોર્ટ જુઓ. દરેકને રેટિંગ આપો.', detailEn: 'See all staff reports for today. Rate each report.' },
            { label: 'જૂના રિપોર્ટ જુઓ', labelEn: 'View past reports', path: 'EOD Report → Admin View → Filter by Date', detail: 'બધા સબમિશનનું હિસ્ટ્રી આર્કાઇવ', detailEn: 'Historical archive of all submissions' },
        ],
        tip: 'સ્ટાફ દિવસમાં ફક્ત એક જ EOD સબમિટ કરી શકે.', tipEn: 'Staff can only submit one EOD per day.',
    },
    {
        id: 'monitoring',
        icon: <BarChart3 className="w-5 h-5" />,
        title: '11. એડમિન મોનિટરિંગ', titleEn: '11. Admin Monitoring',
        subtitle: 'ડેશબોર્ડ, એક્ટિવિટી, બ્રોડકાસ્ટ', subtitleEn: 'Dashboard, activity, broadcast',
        color: 'text-slate-700',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        headerBg: 'bg-slate-700',
        steps: [
            { label: 'Overview ડેશબોર્ડ', labelEn: 'Overview Dashboard', path: 'Dashboard → Overview', detail: 'ચાલુ જોબ, આ મહિનાની આવક, બાકી પેમેન્ટ', detailEn: 'Jobs in progress, revenue this month, pending payments' },
            { label: 'એક્ટિવિટી લોગ', labelEn: 'Activity Log', path: 'Activity', detail: 'દરેક યુઝરની દરેક એક્શન — કોણે શું અને ક્યારે કર્યું', detailEn: 'Every action by every user — who did what and when' },
            { label: 'બધા સ્ટાફને બ્રોડકાસ્ટ મેસેજ', labelEn: 'Broadcast message to all staff', path: 'Broadcast → New Message', detail: 'બધા યુઝરના ડેશબોર્ડ પર દેખાતી જાહેરાત', detailEn: 'Announcements visible to all users on dashboard' },
            { label: 'કેલેન્ડર વ્યૂ (રોલ પ્રમાણે)', labelEn: 'Calendar view (role-filtered)', path: 'Calendar', detail: 'એડમિન બધું જુએ: જોબ ડેડલાઇન, ફોલો-અપ, ડિસ્પેચ તારીખ. દરેક સ્ટાફ ફક્ત પોતાનું જ જુએ.', detailEn: 'Admin sees all: job deadlines, follow-ups, dispatch dates. Each staff member only sees their own.' },
            { label: 'System Health ચેક', labelEn: 'System Health check', path: 'System Health', detail: 'DB સ્ટેટસ, કન્ફિગ ચેક, એરર લોગ', detailEn: 'DB status, config checks, error logs' },
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
                        <h1 className="text-xl font-bold">Admin Guide — Aayam Office કેવી રીતે વાપરવું</h1>
                        <p className="text-gray-400 text-sm">એડમિન માટે ક્લિક-બાય-ક્લિક પૂરી ગાઇડ</p>
                    </div>
                </div>
                <p className="text-sm text-gray-300 mt-3 leading-relaxed">
                    લીડ આવે ત્યાંથી લઈને પેમેન્ટ કલેક્શન, કમિશન અને ડિલિવરી પૂરી થાય ત્યાં સુધીના બધા સ્ટેપ આ ગાઇડમાં છે.
                    વિગતવાર સ્ટેપ જોવા નીચે કોઈ પણ સેક્શન પર ક્લિક કરો.
                </p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    This guide covers every step from the moment a lead walks in to payment collected, commission paid, and delivery done.
                    Click any section below to expand the detailed steps.
                </p>
            </div>

            {/* Flow Diagram */}
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Order Lifecycle — ઓર્ડરની આખી સફર (શરૂઆત → અંત)</p>
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
                        can: ['બધું જોઈ શકે', 'કમિશન અપ્રૂવ કરે', 'EOD રિપોર્ટ રિવ્યૂ કરે', 'વેન્ડર, ક્લાયન્ટ, સ્ટાફ મેનેજ કરે', 'આખું ફાઇનાન્સ'],
                        canEn: ['Sees everything', 'Approves commissions', 'Reviews EOD reports', 'Manages vendors, clients, staff', 'All finance']
                    },
                    {
                        role: 'Marketing', icon: <TrendingUp className="w-4 h-4 text-blue-700" />, bg: 'bg-blue-50', text: 'text-blue-900',
                        can: ['લીડ અને ફોલો-અપ ઉમેરે', 'ક્વોટેશન બનાવે', 'લીડને ક્લાયન્ટમાં કન્વર્ટ કરે', 'પોતાનું કમિશન જુએ', 'ડિસ્પેચ થયેલા ઓર્ડર ટ્રેક કરે'],
                        canEn: ['Adds leads & follow-ups', 'Creates quotations', 'Converts leads to clients', 'Sees own commissions', 'Tracks dispatched orders']
                    },
                    {
                        role: 'Designer', icon: <Palette className="w-4 h-4 text-pink-700" />, bg: 'bg-pink-50', text: 'text-pink-900',
                        can: ['My Queue માં પોતાની જોબ જુએ', 'સ્ટેટસ પિલ્સ અપડેટ કરે (Live/Pause/Review/End)', 'EOD રિપોર્ટ સબમિટ કરે', 'ફાઇલ અપલોડ કરે', 'My Notes અને કેલેન્ડર'],
                        canEn: ['Sees assigned jobs in My Queue', 'Updates status pills (Live/Pause/Review/End)', 'Submits EOD report', 'Uploads files', 'My Notes & Calendar']
                    },
                ].map((r) => (
                    <div key={r.role} className={`rounded-md border p-3 ${r.bg} ${r.role === 'Admin' ? 'border-gray-700' : r.role === 'Marketing' ? 'border-blue-200' : 'border-pink-200'}`}>
                        <div className={`flex items-center gap-2 mb-2 ${r.text}`}>
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${r.role === 'Admin' ? 'bg-white/10' : r.role === 'Marketing' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                                {r.icon}
                            </div>
                            <span className="text-sm font-bold">{r.role}</span>
                        </div>
                        <ul className={`space-y-1.5 ${r.text}`}>
                            {r.can.map((c, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs">
                                    <CheckCircle2 className="w-3 h-3 flex-shrink-0 opacity-60 mt-0.5" />
                                    <span>{c}{r.canEn?.[i] && <span className="block opacity-60">{r.canEn[i]}</span>}</span>
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
                                        <p className="font-bold text-sm">{phase.title}</p>{phase.titleEn && <p className={`text-xs font-semibold ${isOpen ? "text-white/80" : "opacity-75"}`}>{phase.titleEn}</p>}
                                        <p className={`text-xs ${isOpen ? 'text-white/70' : 'opacity-60'}`}>{phase.subtitle}</p>{phase.subtitleEn && <p className={`text-[11px] ${isOpen ? 'text-white/50' : 'opacity-40'}`}>{phase.subtitleEn}</p>}
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
                                                <p className="text-sm font-semibold text-gray-900">{step.label}</p>{step.labelEn && <p className="text-xs text-gray-500">{step.labelEn}</p>}
                                                {step.path && (
                                                    <p className="text-xs font-mono text-gray-500 mt-0.5 flex items-center gap-1">
                                                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                        {step.path}
                                                    </p>
                                                )}
                                                {step.detail && (
                                                    <><p className="text-xs text-gray-400 mt-0.5 italic">{step.detail}</p>{step.detailEn && <p className="text-xs text-gray-400 italic opacity-80">{step.detailEn}</p>}</>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {phase.tip && (
                                        <div className={`mt-4 flex items-start gap-2 p-3 rounded-md ${phase.bg} ${phase.border} border`}>
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

            {/* Quick Tips */}
            <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">⚡ Quick Tips</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                    {[
                        { gu: '📌 લીડ હંમેશા માર્કેટિંગ સ્ટાફને એસાઇન કરો — નહીંતર કમિશન કામ નહીં કરે', en: 'Always assign leads to marketing staff — else commission won\'t work' },
                        { gu: '💰 ક્લાયન્ટ પાસેથી 100% પેમેન્ટ આવે પછી જ કમિશન ટ્રિગર થાય', en: 'Commission only triggers after 100% payment is received from client' },
                        { gu: '🎨 ડિઝાઇનર બીજા ડિઝાઇનરની જોબ જોઈ ના શકે — સંપૂર્ણ અલગ વ્યૂ', en: 'Designers can\'t see other designers\' jobs — fully isolated view' },
                        { gu: '📊 દરેક સ્ટાફે રોજ EOD રિપોર્ટ સબમિટ કરવો ફરજિયાત', en: 'EOD reports must be submitted daily by each staff member' },
                        { gu: '🔍 એક્ટિવિટી લોગમાં દરેક એક્શન રેકોર્ડ થાય — યુઝર ઓડિટ માટે વાપરો', en: 'Activity Log records every action — use it to audit user activity' },
                        { gu: '🏦 કોઈ પણ પેમેન્ટ રેકોર્ડ કરતા પહેલા બેંક એકાઉન્ટ ઉમેરો', en: 'Add bank accounts before recording any payments' },
                        { gu: '📱 App મોબાઇલ પર પણ ચાલે — સ્ટાફ ફોનમાં વાપરી શકે', en: 'App works on mobile — staff can use it on their phones' },
                        { gu: '🔔 બ્રોડકાસ્ટ મેસેજ બધા સ્ટાફના ડેશબોર્ડ પર તરત દેખાય', en: 'Broadcast messages appear on all staff dashboards instantly' },
                    ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-md border border-gray-100">
                            <span>{tip.gu}<span className="block opacity-70 mt-0.5">{tip.en}</span></span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
