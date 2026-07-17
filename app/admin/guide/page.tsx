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
        title: '1. શરૂઆતનું Setup',
        subtitle: 'App વાપરતા પહેલા આ એક જ વાર કરવાનું',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        headerBg: 'bg-purple-700',
        steps: [
            { label: 'માર્કેટિંગ સ્ટાફ ઉમેરો', path: 'Settings → Users → Add User (role: marketing)', detail: 'દરેક વ્યક્તિની પ્રોફાઇલમાં કમિશન % સેટ કરો' },
            { label: 'વેન્ડર / સપ્લાયર ઉમેરો', path: 'Finance → Vendors → Add Vendor', detail: 'પેપર સપ્લાયર, પ્રિન્ટિંગ વેન્ડર વગેરે' },
            { label: 'ટ્રાન્સપોર્ટર ઉમેરો', path: 'Dispatch → Transporters → Add Transporter', detail: 'ડિલિવરી મેનેજમેન્ટ માટે' },
            { label: 'બેંક એકાઉન્ટ સેટ કરો', path: 'Finance → Banks → Add Bank', detail: 'કેશ, કરંટ એકાઉન્ટ વગેરે લિંક કરો' },
            { label: 'ઓપનિંગ બેલેન્સ સેટ કરો', path: 'Finance → Opening Balance', detail: 'શરૂઆતનું કેશ/બેંક બેલેન્સ નાખો' },
        ],
        tip: 'Setup ફક્ત એક જ વાર કરવાનું છે. પછી રોજનું કામ (daily workflow) શરૂ થાય.',
    },
    {
        id: 'marketing',
        icon: <TrendingUp className="w-5 h-5" />,
        title: '2. માર્કેટિંગ પાઇપલાઇન',
        subtitle: 'લીડ → ફોલો-અપ → ક્વોટેશન → ક્લાયન્ટ',
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        headerBg: 'bg-blue-700',
        steps: [
            { label: 'માર્કેટિંગ સ્ટાફ નવી લીડ ઉમેરે', path: 'Marketing → Leads → New Lead', detail: 'નામ, ફોન, સર્વિસ ટાઇપ, જરૂરિયાત' },
            { label: 'એડમિન લીડ માર્કેટિંગ વ્યક્તિને એસાઇન કરે', path: 'Marketing → Leads → Edit Lead → Assign To', detail: 'ફક્ત એડમિન કરી શકે. તે વ્યક્તિ ફોલો-અપ સંભાળે.' },
            { label: 'ફોલો-અપ → Follow-ups માં મૂવ કરો', path: 'Marketing → Leads → Move to Follow-up', detail: 'ફોલો-અપ તારીખ સેટ થાય, નોટ્સ ઉમેરાય' },
            { label: 'ક્વોટેશન બનાવો', path: 'Marketing → Quotations → New Quotation', detail: 'ક્લાયન્ટને ભાવ (price estimate) મોકલો' },
            { label: 'જીતી ગયા તો Client માં કન્વર્ટ કરો', path: 'Marketing → Leads → Convert to Client', detail: 'CRM માં ક્લાયન્ટ રેકોર્ડ ઓટોમેટિક બની જાય' },
            { label: 'ક્લાયન્ટ માટે જોબ બનાવો', path: 'Jobs → New Job → Select Client', detail: 'જોબ હવે પ્રોડક્શન પાઇપલાઇનમાં આવી ગઈ' },
            { label: 'Dispatched Orders જુઓ', path: 'Marketing → Dispatched Orders', detail: 'માર્કેટિંગ સ્ટાફ પોતાના ક્લાયન્ટના કયા ઓર્ડર ડિસ્પેચ કે ડિલિવર થયા તે ટ્રેક કરી શકે' },
        ],
        tip: 'આ લીડની જોબનું પૂરું પેમેન્ટ આવે એટલે કમિશન ઓટોમેટિક ટ્રિગર થાય.',
    },
    {
        id: 'crm',
        icon: <UserCheck className="w-5 h-5" />,
        title: '3. CRM — ક્લાયન્ટ્સ',
        subtitle: 'હાલના ક્લાયન્ટ અને તેમની હિસ્ટ્રી મેનેજ કરો',
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        headerBg: 'bg-indigo-700',
        steps: [
            { label: 'બધા ક્લાયન્ટ જુઓ', path: 'CRM → Clients', detail: 'નામ, કંપની, બ્રાન્ડથી સર્ચ કરો' },
            { label: 'ડાયરેક્ટ ક્લાયન્ટ ઉમેરો (લીડ વગર)', path: 'CRM → Clients → Add Client', detail: 'વોક-ઇન કે રેફરલ ક્લાયન્ટ માટે' },
            { label: 'ક્લાયન્ટની જોબ હિસ્ટ્રી જુઓ', path: 'CRM → Clients → View Client', detail: 'બધી જોબ, કુલ બિલ, મળેલી રકમ, બાકી રકમ' },
            { label: 'ક્લાયન્ટ ડિટેલ્સ એડિટ કરો', path: 'CRM → Clients → Edit', detail: 'કોન્ટેક્ટ, બ્રાન્ડ નામ, GST, શહેર અપડેટ કરો' },
        ],
        tip: 'જોબ હિસ્ટ્રી અને ફાઇનાન્સ આંકડા જોબમાંથી ઓટોમેટિક ભરાય છે.',
    },
    {
        id: 'jobs',
        icon: <Briefcase className="w-5 h-5" />,
        title: '4. જોબ્સ ક્યુ (Jobs Queue)',
        subtitle: 'આખા ઓપરેશનનું હૃદય',
        color: 'text-gray-900',
        bg: 'bg-gray-50',
        border: 'border-gray-300',
        headerBg: 'bg-gray-900',
        steps: [
            { label: 'નવી જોબ બનાવો', path: 'Jobs → New Job', detail: 'ક્લાયન્ટ, જોબ ટાઇપ (Print/Design/Both), ક્વોન્ટિટી, રકમ, ડેડલાઇન પસંદ કરો' },
            { label: 'જોબ ક્યુ જુઓ (Kanban)', path: 'Jobs → Queue', detail: 'જોબને સ્ટેજ વચ્ચે ડ્રેગ કરો: New → Designing → Approval → Printing → Dispatched → Delivered' },
            { label: 'જોબ ડિટેલ્સ ખોલો', path: 'Jobs → Queue → [Job Card]', detail: 'ફાઇલ્સ, નોટ્સ, સ્ટેજ હિસ્ટ્રી, પેમેન્ટ સ્ટેટસ' },
            { label: 'ડિઝાઇનર એસાઇન કરો', path: 'Job Details → Assign Designer', detail: 'એક્ટિવ ડિઝાઇનરમાંથી પસંદ કરો' },
            { label: 'સ્ટેજ મેન્યુઅલી બદલો', path: 'Job Details → Change Stage', detail: 'અથવા Queue વ્યૂમાં કાર્ડ ડ્રેગ કરો' },
            { label: 'મળેલું પેમેન્ટ ઉમેરો', path: 'Job Details → Payments → Add Payment', detail: 'પૂરું પેમેન્ટ થાય તો કમિશન Eligible થાય' },
            { label: 'બધી જોબ લિસ્ટમાં જુઓ', path: 'Jobs → All Jobs', detail: 'ક્લાયન્ટ, સ્ટેજ, તારીખ પ્રમાણે sort/filter કરો' },
        ],
        tip: 'જ્યારે મળેલી રકમ = કુલ રકમ, ત્યારે કમિશન ઓટોમેટિક Eligible બની જાય.',
    },
    {
        id: 'design',
        icon: <Palette className="w-5 h-5" />,
        title: '5. ડિઝાઇન સ્ટુડિયો',
        subtitle: 'ડિઝાઇનર માટે (અને એડમિનની દેખરેખ માટે)',
        color: 'text-pink-700',
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        headerBg: 'bg-pink-700',
        steps: [
            { label: 'ડિઝાઇનર પોતાની ક્યુ જુએ', path: 'Design Studio → My Queue', detail: 'ફક્ત તેને એસાઇન થયેલી જોબ — ડેડલાઇન પ્રમાણે ગોઠવેલી' },
            { label: 'એડમિન બધા ડિઝાઇનર જુએ', path: 'Design Studio → Team Queue', detail: 'કોણ શું કરી રહ્યું છે, ઓવરડ્યુ ટાસ્ક, બધા સ્ટેટસ પિલ્સ' },
            { label: 'સ્ટેટસ પિલ્સ — લાઇવ ટ્રેકિંગ', path: 'My Queue → Task → Status pill', detail: '🟢 Live = અત્યારે કામ ચાલુ | 🟡 Pause = રાહ જોવાય છે | 🔵 Review = અપ્રૂવલ માટે મોકલ્યું | ✅ End = કામ પૂરું | 🔁 Transfer = બીજા ડિઝાઇનરને સોંપવું' },
            { label: 'ડિઝાઇન ટાસ્ક / સબ-ટાસ્ક ઉમેરો', path: 'Design Studio → + New Project', detail: 'જોબને ડિઝાઇન સ્ટેપમાં વહેંચી ડિઝાઇનરને એસાઇન કરો' },
            { label: 'ફાઇલ અપલોડ કરો (Google Drive)', path: 'Job Details → Files → Upload', detail: 'ફાઇલ Google Drive માં સ્ટોર થાય, જોબ સાથે લિંક રહે' },
            { label: 'ડિઝાઇનર ટાઇમલાઇન જુએ', path: 'Design Studio → Timeline', detail: 'બધા ટાસ્કનો તારીખ પ્રમાણે Gantt-સ્ટાઇલ ચાર્ટ' },
            { label: 'આખી ટાસ્ક હિસ્ટ્રી જુઓ (Dossier)', path: 'Design Studio → Dossier', detail: 'ફક્ત એડમિન: અત્યાર સુધીના બધા ટાસ્ક, સ્ટેટસ અને ટાઇમ લોગ સાથે' },
        ],
        tip: 'એડમિન સ્ટેટસ પિલ્સ જોઈને દરેક ડિઝાઇન જોબની લાઇવ સ્થિતિ જાણી શકે. ડિઝાઇનરને યાદ કરાવો — કંઈ પણ બદલાય એટલે પિલ અપડેટ કરે.',
    },
    {
        id: 'print',
        icon: <Package className="w-5 h-5" />,
        title: '6. પ્રિન્ટ અને પ્રોડક્શન',
        subtitle: 'આર્ટવર્ક અપ્રૂવલથી પ્રિન્ટેડ જોબ સુધી',
        color: 'text-cyan-700',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        headerBg: 'bg-cyan-700',
        steps: [
            { label: 'પ્રિન્ટ રન પ્લાન કરો', path: 'Print Planner → New Plan', detail: 'જોબ, પેપર સ્ટોક, ક્વોન્ટિટી, મશીન પસંદ કરો' },
            { label: 'પેપર સ્ટોક જુઓ', path: 'CMYK Print → Paper Stock', detail: 'ટાઇપ અને સાઇઝ પ્રમાણે ઉપલબ્ધ પેપર ટ્રેક કરો' },
            { label: 'પ્રિન્ટ કોસ્ટ ગણો', path: 'CMYK Print → Cost Calculator', detail: 'ક્વોન્ટિટી, પેપર, ઇંક પ્રમાણે કોસ્ટ ઓટોમેટિક ગણાય' },
            { label: 'જોબને Printing સ્ટેજમાં મૂકો', path: 'Jobs → Queue → Move to Printing stage', detail: 'પ્રિન્ટિંગ પૂરું થાય પછી QC શરૂ થાય' },
        ],
    },
    {
        id: 'dispatch',
        icon: <Send className="w-5 h-5" />,
        title: '7. QC અને ડિસ્પેચ',
        subtitle: 'ક્વોલિટી ચેક → પેકિંગ → ડિલિવરી',
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        headerBg: 'bg-orange-700',
        steps: [
            { label: 'પ્રિન્ટેડ જોબનું QC કરો', path: 'Dispatch → QC Check → [Job] → Pass/Fail', detail: 'ડિસ્પેચ પહેલા કલર, કટિંગ, ક્વોન્ટિટી ચેક કરો' },
            { label: 'ટ્રાન્સપોર્ટર એસાઇન કરો', path: 'Dispatch → [Job] → Assign Transporter', detail: 'સેવ કરેલા ટ્રાન્સપોર્ટરમાંથી પસંદ કરો' },
            { label: 'Dispatched માર્ક કરો', path: 'Dispatch → Mark Dispatched', detail: 'ડિસ્પેચ તારીખ, ટ્રાન્સપોર્ટર, નોટ્સ રેકોર્ડ થાય' },
            { label: 'Delivered માર્ક કરો', path: 'Jobs → Queue → Delivered', detail: 'છેલ્લું સ્ટેજ — ઓર્ડર પૂરો' },
            { label: 'ડિસ્પેચ હિસ્ટ્રી જુઓ', path: 'Dispatch → History', detail: 'બધા જૂના ડિસ્પેચ — તારીખ અને ટ્રાન્સપોર્ટર સાથે' },
        ],
        tip: 'QC પાસ થાય પછી જ ડિસ્પેચ થઈ શકે.',
    },
    {
        id: 'finance',
        icon: <IndianRupee className="w-5 h-5" />,
        title: '8. ફાઇનાન્સ',
        subtitle: 'પેમેન્ટ, ઇન્વૉઇસ, એકાઉન્ટ્સ',
        color: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-200',
        headerBg: 'bg-green-700',
        steps: [
            { label: 'ક્લાયન્ટ પાસેથી મળેલું પેમેન્ટ રેકોર્ડ કરો', path: 'Finance → Payments → New Payment', detail: 'જોબ સાથે લિંક થાય, બાકી રકમ ઓટોમેટિક અપડેટ થાય' },
            { label: 'ઇન્વૉઇસ / બિલ બનાવો', path: 'Finance → Invoices → New Invoice', detail: 'જોબ ડિટેલ્સ સાથે GST ઇન્વૉઇસ' },
            { label: 'વેન્ડર ખરીદી / બિલ રેકોર્ડ કરો', path: 'Finance → Vendors → [Vendor] → Purchases', detail: 'પેપર, પ્રિન્ટિંગ મટીરિયલ, સર્વિસની ખરીદી' },
            { label: 'કેશ / બેંક ખર્ચ રેકોર્ડ કરો', path: 'Finance → Daily → Add Entry', detail: 'રોજનો પેટી કેશ અને ખર્ચા' },
            { label: 'એકાઉન્ટ લેજર / સ્ટેટમેન્ટ જુઓ', path: 'Finance → Accounts → [Account] → Statement', detail: 'દરેક એકાઉન્ટની આખી ડેબિટ/ક્રેડિટ હિસ્ટ્રી' },
            { label: 'Daily Summary (ફક્ત એડમિન)', path: 'Finance → Daily Summary', detail: 'કોઈ પણ તારીખના બધા એકાઉન્ટ બેલેન્સ એક નજરમાં' },
            { label: 'બેંક રિકન્સિલિએશન', path: 'Finance → Banking', detail: 'બેંક સ્ટેટમેન્ટને app ના રેકોર્ડ સાથે મેચ કરો' },
            { label: 'ફાઇનાન્સ રિપોર્ટ જુઓ', path: 'Finance → Reports', detail: 'P&L, કેશબુક, ક્લાયન્ટ બાકી, વેન્ડર રિપોર્ટ' },
        ],
        tip: 'જોબનું પૂરું પેમેન્ટ થઈ જાય એટલે ક્લાયન્ટ પેમેન્ટ ઉમેરતાં જ કમિશન ઓટોમેટિક Eligible થાય.',
    },
    {
        id: 'commission',
        icon: <Star className="w-5 h-5" />,
        title: '9. કમિશન',
        subtitle: 'માર્કેટિંગ સ્ટાફ માટે ઓટોમેટિક ગણાય',
        color: 'text-yellow-700',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        headerBg: 'bg-yellow-700',
        steps: [
            { label: 'પૂરા પેમેન્ટ પછી કમિશન ઓટોમેટિક દેખાય', path: 'Commissions page → Eligible tab', detail: 'સ્ટેટસ ઓટોમેટિક Eligible થાય' },
            { label: 'એડમિન % સેટ કરી અપ્રૂવ કરે', path: 'Commissions → [Job] → Set % & Approve', detail: 'દરેક વ્યક્તિનો ડિફોલ્ટ રેટ બદલી પણ શકાય' },
            { label: 'એડમિન સ્ટાફને રૂબરૂ પેમેન્ટ કરે', path: 'Commissions → [Job] → Mark as Paid', detail: 'પેમેન્ટ તારીખ રેકોર્ડ થાય' },
            { label: 'માર્કેટિંગ વ્યક્તિ પોતાની કમાણી જુએ', path: 'Marketing → Dashboard → Commission widget', detail: 'Eligible / Approved / Paid રકમ' },
        ],
        tip: 'દરેક માર્કેટિંગ વ્યક્તિનો ડિફોલ્ટ કમિશન રેટ તેની પ્રોફાઇલમાં સેટ કરો (Settings → Users).',
    },
    {
        id: 'eod',
        icon: <ClipboardList className="w-5 h-5" />,
        title: '10. EOD રિપોર્ટ',
        subtitle: 'દરેક સ્ટાફનો દિવસના અંતનો રિપોર્ટ',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        headerBg: 'bg-rose-700',
        steps: [
            { label: 'સ્ટાફ EOD રિપોર્ટ સબમિટ કરે', path: 'EOD Report → Submit Report', detail: 'આજે કરેલા કામ, અડચણો (blockers), કાલનો પ્લાન' },
            { label: 'એડમિન બધા EOD રિપોર્ટ રિવ્યૂ કરે', path: 'EOD Report → Admin View', detail: 'આજના બધા સ્ટાફ રિપોર્ટ જુઓ. દરેકને રેટિંગ આપો.' },
            { label: 'જૂના રિપોર્ટ જુઓ', path: 'EOD Report → Admin View → Filter by Date', detail: 'બધા સબમિશનનું હિસ્ટ્રી આર્કાઇવ' },
        ],
        tip: 'સ્ટાફ દિવસમાં ફક્ત એક જ EOD સબમિટ કરી શકે.',
    },
    {
        id: 'monitoring',
        icon: <BarChart3 className="w-5 h-5" />,
        title: '11. એડમિન મોનિટરિંગ',
        subtitle: 'ડેશબોર્ડ, એક્ટિવિટી, બ્રોડકાસ્ટ',
        color: 'text-slate-700',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        headerBg: 'bg-slate-700',
        steps: [
            { label: 'Overview ડેશબોર્ડ', path: 'Dashboard → Overview', detail: 'ચાલુ જોબ, આ મહિનાની આવક, બાકી પેમેન્ટ' },
            { label: 'એક્ટિવિટી લોગ', path: 'Activity', detail: 'દરેક યુઝરની દરેક એક્શન — કોણે શું અને ક્યારે કર્યું' },
            { label: 'બધા સ્ટાફને બ્રોડકાસ્ટ મેસેજ', path: 'Broadcast → New Message', detail: 'બધા યુઝરના ડેશબોર્ડ પર દેખાતી જાહેરાત' },
            { label: 'કેલેન્ડર વ્યૂ (રોલ પ્રમાણે)', path: 'Calendar', detail: 'એડમિન બધું જુએ: જોબ ડેડલાઇન, ફોલો-અપ, ડિસ્પેચ તારીખ. દરેક સ્ટાફ ફક્ત પોતાનું જ જુએ.' },
            { label: 'System Health ચેક', path: 'System Health', detail: 'DB સ્ટેટસ, કન્ફિગ ચેક, એરર લોગ' },
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
                        can: ['બધું જોઈ શકે', 'કમિશન અપ્રૂવ કરે', 'EOD રિપોર્ટ રિવ્યૂ કરે', 'વેન્ડર, ક્લાયન્ટ, સ્ટાફ મેનેજ કરે', 'આખું ફાઇનાન્સ']
                    },
                    {
                        role: 'Marketing', icon: <TrendingUp className="w-4 h-4 text-blue-700" />, bg: 'bg-blue-50', text: 'text-blue-900',
                        can: ['લીડ અને ફોલો-અપ ઉમેરે', 'ક્વોટેશન બનાવે', 'લીડને ક્લાયન્ટમાં કન્વર્ટ કરે', 'પોતાનું કમિશન જુએ', 'ડિસ્પેચ થયેલા ઓર્ડર ટ્રેક કરે']
                    },
                    {
                        role: 'Designer', icon: <Palette className="w-4 h-4 text-pink-700" />, bg: 'bg-pink-50', text: 'text-pink-900',
                        can: ['My Queue માં પોતાની જોબ જુએ', 'સ્ટેટસ પિલ્સ અપડેટ કરે (Live/Pause/Review/End)', 'EOD રિપોર્ટ સબમિટ કરે', 'ફાઇલ અપલોડ કરે', 'My Notes અને કેલેન્ડર']
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
                        '📌 લીડ હંમેશા માર્કેટિંગ સ્ટાફને એસાઇન કરો — નહીંતર કમિશન કામ નહીં કરે',
                        '💰 ક્લાયન્ટ પાસેથી 100% પેમેન્ટ આવે પછી જ કમિશન ટ્રિગર થાય',
                        '🎨 ડિઝાઇનર બીજા ડિઝાઇનરની જોબ જોઈ ના શકે — સંપૂર્ણ અલગ વ્યૂ',
                        '📊 દરેક સ્ટાફે રોજ EOD રિપોર્ટ સબમિટ કરવો ફરજિયાત',
                        '🔍 એક્ટિવિટી લોગમાં દરેક એક્શન રેકોર્ડ થાય — યુઝર ઓડિટ માટે વાપરો',
                        '🏦 કોઈ પણ પેમેન્ટ રેકોર્ડ કરતા પહેલા બેંક એકાઉન્ટ ઉમેરો',
                        '📱 App મોબાઇલ પર પણ ચાલે — સ્ટાફ ફોનમાં વાપરી શકે',
                        '🔔 બ્રોડકાસ્ટ મેસેજ બધા સ્ટાફના ડેશબોર્ડ પર તરત દેખાય',
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
