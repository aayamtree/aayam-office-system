'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
    Search, Package, Users, FileText, IndianRupee,
    UserPlus, Printer, ArrowRight, LayoutDashboard, Navigation, CornerDownRight, Loader2
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getStageName } from '@/lib/job-workflow';
import { getRecordLocations, RecordLocation } from '@/lib/record-locations';
import { leadStatusLabel } from '@/lib/lead-status';

interface SearchResult {
    id: string;
    type: 'nav' | 'job' | 'client' | 'lead' | 'invoice' | 'quotation' | 'print_run';
    title: string;
    subtitle: string;
    href: string;
}

const TYPE_CONFIG = {
    nav:       { icon: LayoutDashboard, label: 'Pages',      color: 'text-slate-600 bg-slate-100' },
    job:       { icon: Package,         label: 'Jobs',        color: 'text-blue-600 bg-blue-50' },
    client:    { icon: Users,           label: 'Clients',     color: 'text-green-600 bg-green-50' },
    lead:      { icon: UserPlus,        label: 'Leads',       color: 'text-purple-600 bg-purple-50' },
    invoice:   { icon: FileText,        label: 'Invoices',    color: 'text-amber-600 bg-amber-50' },
    quotation: { icon: IndianRupee,     label: 'Quotations',  color: 'text-cyan-600 bg-cyan-50' },
    print_run: { icon: Printer,         label: 'Print Runs',  color: 'text-indigo-600 bg-indigo-50' },
};

// All navigable pages — searched client-side (instant, case-insensitive)
const NAV_ITEMS: { title: string; subtitle: string; href: string }[] = [
    { title: 'My Work',               subtitle: 'Your tasks & assignments',         href: '/admin/my-work' },
    { title: 'Overview / Dashboard',  subtitle: 'Business overview',                href: '/admin/dashboard' },
    // Projects & Jobs
    { title: 'Projects & Jobs',       subtitle: 'All jobs overview',                href: '/admin/jobs' },
    { title: 'Job Dossier',           subtitle: 'Detailed job records',             href: '/admin/jobs/dossier' },
    { title: 'Production Queue',      subtitle: 'Jobs in printing / finishing',     href: '/admin/jobs/queue' },
    { title: 'Overdue Jobs',          subtitle: 'Past deadline jobs',               href: '/admin/jobs/overdue' },
    // Print Planner
    { title: 'Print Planner',         subtitle: 'Plan production batches',          href: '/admin/print-planner' },
    { title: 'Print Runs',            subtitle: 'View print run history',           href: '/admin/print-runs' },
    // Design Studio
    { title: 'Design Queue',          subtitle: 'Designer task queue',              href: '/admin/designers/my-queue' },
    { title: 'Design Timeline',       subtitle: 'Designer timeline view',           href: '/admin/designers/timeline' },
    { title: 'My Notes',              subtitle: 'Designer personal notes',          href: '/admin/designers/my-notes' },
    { title: 'New Design Project',    subtitle: 'Create a new design project',      href: '/admin/designers/new-project' },
    { title: 'Design Dossier',        subtitle: 'All design projects',              href: '/admin/designers/dossier' },
    { title: 'Designer Guide',        subtitle: 'Designer reference guide',         href: '/admin/designers/guide' },
    // Attendance
    { title: 'Attendance',            subtitle: 'Staff attendance tracker',         href: '/admin/designers/attendance' },
    // Marketing
    { title: 'Marketing Dashboard',   subtitle: 'Marketing overview',               href: '/admin/marketing/dashboard' },
    { title: 'Leads',                 subtitle: 'Sales leads & prospects',          href: '/admin/marketing/leads' },
    { title: 'Follow-ups',            subtitle: 'Pending follow-ups',               href: '/admin/marketing/follow-ups' },
    { title: 'Quotations',            subtitle: 'All quotations',                   href: '/admin/marketing/quotations' },
    { title: 'My Orders',             subtitle: 'Marketing orders',                 href: '/admin/marketing/orders' },
    { title: 'Dispatched Orders',     subtitle: 'Orders dispatched',                href: '/admin/marketing/dispatch' },
    { title: 'Commissions',           subtitle: 'Staff commissions',                href: '/admin/marketing/commissions' },
    { title: 'Marketing Guide',       subtitle: 'Marketing reference guide',        href: '/admin/marketing/guide' },
    // CRM
    { title: 'Clients',               subtitle: 'Client directory',                 href: '/admin/crm/clients' },
    // Sales & Finance
    { title: 'Finance Overview',      subtitle: 'Finance summary',                  href: '/admin/finance' },
    { title: 'Sales Quotations',      subtitle: 'Quotations list',                  href: '/admin/sales/quotations' },
    { title: 'Sales Orders',          subtitle: 'Orders list',                      href: '/admin/sales/orders' },
    // The five doors (phase 4). This list was a back door into the old menu:
    // nine of its entries opened screens that read the ledger closed on
    // 5 August, so typing "invoices" landed you on a page holding two of them.
    { title: 'Money In',              subtitle: 'Who owes us, and who paid',        href: '/admin/finance/money-in' },
    { title: 'Money Out',             subtitle: 'Who we owe, and what we paid',     href: '/admin/finance/money-out' },
    { title: 'Bank',           subtitle: 'What the bank shows',              href: '/admin/finance/bank-cash' },
    { title: 'Finance To Do',         subtitle: 'Payments to chase, cash to enter', href: '/admin/finance/to-do' },
    { title: 'Finance Reports',       subtitle: 'Money in and out, by month',       href: '/admin/finance/reports' },
    // The screens the doors open — still reachable by name.
    { title: 'Awaiting Payment',      subtitle: 'Design work sent, not yet paid',   href: '/admin/finance/awaiting-payment' },
    { title: 'Invoice Matching',      subtitle: 'Link a Zoho invoice to a job',     href: '/admin/finance/invoice-matching' },
    { title: 'Payment Captures',      subtitle: 'Payment proofs from Telegram',     href: '/admin/finance/payment-captures' },
    { title: 'Zoho Books',            subtitle: 'Invoices, bills and bank lines',   href: '/admin/finance/zoho' },
    { title: 'Bank Accounts',         subtitle: 'Manage bank accounts',             href: '/admin/finance/banks' },
    { title: 'Vendors',               subtitle: 'Vendor directory',                 href: '/admin/finance/vendors' },
    { title: 'Finance Guide',         subtitle: 'Finance reference guide',          href: '/admin/finance/guide' },
    // Dispatch
    { title: 'Dispatch Command Center', subtitle: 'Dispatch overview',              href: '/admin/dispatch' },
    { title: 'QC',                    subtitle: 'Quality check',                    href: '/admin/dispatch/qc-check' },
    { title: 'Pack',                  subtitle: 'Box QC-passed jobs together',      href: '/admin/dispatch/pack' },
    { title: 'Delivery History',      subtitle: 'Past deliveries',                  href: '/admin/dispatch/history' },
    { title: 'Transporters',          subtitle: 'Transporter list',                 href: '/admin/dispatch/transporters' },
    { title: 'Dispatch Guide',        subtitle: 'Dispatch reference guide',         href: '/admin/dispatch/guide' },
    // CMYK Print
    { title: 'CMYK Print Station',    subtitle: 'CMYK station overview',            href: '/admin/cmyk-print' },
    { title: 'Paper Stock',           subtitle: 'Paper stock levels',               href: '/admin/cmyk-print/paper-stock' },
    { title: 'Retail POS',            subtitle: 'Point of sale',                    href: '/admin/cmyk-print/retail-pos' },
    // Reports
    // /admin/reports is no longer a statement generator — it is the section
    // overview explaining what was withdrawn on 2026-09-08 and where the current
    // figures live. /admin/reports/finance is history from the app's own ledger
    // (to 5 Aug) and came off the sidebar; it stays searchable, labelled for what
    // it is, so nobody opens it expecting a current P&L.
    { title: 'Reports Overview',      subtitle: 'Where each report figure comes from', href: '/admin/reports' },
    { title: 'Finance Reports (history to 5 Aug)', subtitle: 'Old ledger — not current', href: '/admin/reports/finance' },
    { title: 'Sales Reports',         subtitle: 'Sales reports',                    href: '/admin/reports/sales' },
    { title: 'Vendor Reports',        subtitle: 'Vendor reports',                   href: '/admin/finance/reports/vendor-reports' },
    { title: 'Dispatch Reports',      subtitle: 'Dispatch reports',                 href: '/admin/reports/dispatch' },
    // Other
    { title: 'Activity Log',          subtitle: 'System activity',                  href: '/admin/activity' },
    { title: 'Calendar',              subtitle: 'Team calendar',                    href: '/admin/calendar' },
    { title: 'EOD Report',            subtitle: 'End of day report',                href: '/admin/eod-report' },
    { title: 'Broadcast',             subtitle: 'Send team announcements',          href: '/admin/broadcast' },
    { title: 'Team Files',            subtitle: 'Shared team files',                href: '/admin/team/files' },
    { title: 'All Uploads',           subtitle: 'Every uploaded file, one gallery',  href: '/admin/uploads' },
    { title: 'My Profile',            subtitle: 'Your profile settings',            href: '/admin/settings/profile' },
    { title: 'Settings',              subtitle: 'System settings',                  href: '/admin/settings' },
    { title: 'Company Info',          subtitle: 'Company details',                  href: '/admin/settings/company' },
    { title: 'System Health',         subtitle: 'System health check',              href: '/admin/system-health' },
];

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Cmd+K / Ctrl+K shortcut + custom event from sidebar button
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
        };
        const handleOpenEvent = () => setOpen(true);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('aayam:open-search', handleOpenEvent);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('aayam:open-search', handleOpenEvent);
        };
    }, []);

    const navigateToHref = useCallback((href: string) => {
        setOpen(false);
        router.push(href);
    }, [router]);

    // ── "Where does this live?" expansion ────────────────────────────────────
    // A job is a card in Design Studio, a line in the Print Planner, a row on
    // Dispatch and an invoice in Finance, all at once. Opening one of those on
    // the user's behalf is a guess. Pressing → on a result asks the database
    // which of those places the record is actually in and lists them.
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [locations, setLocations] = useState<RecordLocation[]>([]);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [locationIndex, setLocationIndex] = useState(0);

    const collapse = useCallback(() => {
        setExpandedId(null);
        setLocations([]);
        setLocationIndex(0);
    }, []);

    const expandResult = useCallback(async (result: SearchResult) => {
        if (result.type === 'nav') return;   // a page is already its own place
        setExpandedId(result.id);
        setLocations([]);
        setLocationIndex(0);
        setLocationsLoading(true);
        const found = await getRecordLocations(result.type, result.id);
        setLocationsLoading(false);
        // One place (or none we can determine) is not worth a menu — just go.
        if (found.length <= 1) {
            collapse();
            navigateToHref(result.href);
            return;
        }
        setLocations(found);
    }, [collapse, navigateToHref]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            collapse();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open, collapse]);

    // Search function — nav items are instant & case-insensitive; DB uses ilike
    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }

        // 1. Nav items — instant, case-insensitive
        const q = searchQuery.toLowerCase();
        const navResults: SearchResult[] = NAV_ITEMS
            .filter(item =>
                item.title.toLowerCase().includes(q) ||
                item.subtitle.toLowerCase().includes(q)
            )
            .slice(0, 5)
            .map(item => ({
                id: `nav-${item.href}`,
                type: 'nav' as const,
                title: item.title,
                subtitle: item.subtitle,
                href: item.href,
            }));

        // Show nav results immediately
        setResults(navResults);
        setSelectedIndex(0);

        if (!isSupabaseConfigured()) return;

        // 2. DB search — async
        setLoading(true);
        // PostgREST's `or=` filter is comma-and-parenthesis delimited, so those
        // characters in a user's query would corrupt the filter and silently
        // return the wrong rows. Strip them rather than risk it.
        const safeQuery = searchQuery.replace(/[,()]/g, ' ').trim();
        if (!safeQuery) { setLoading(false); return; }
        const dbQ = `%${safeQuery}%`;

        try {
            const [jobsRes, clientsRes, leadsRes, invoicesRes, quotationsRes, dispatchRes, printRunsRes] = await Promise.all([
                // A job carries FOUR numbers people quote back at us: ours, the
                // client's own PO, the invoice, and the e-way bill. Searching
                // only our own job number meant that a client ringing up with
                // "invoice INV-2026-0142" could not be answered.
                supabase.from('jobs')
                    .select('id, job_number, project_name, current_stage, invoice_reference, eway_bill_number, client_ref_no')
                    .or([
                        `job_number.ilike.${dbQ}`,
                        `project_name.ilike.${dbQ}`,
                        `invoice_reference.ilike.${dbQ}`,
                        `eway_bill_number.ilike.${dbQ}`,
                        `client_ref_no.ilike.${dbQ}`,
                    ].join(','))
                    .limit(6),
                supabase.from('clients').select('id, name, company, phone')
                    .or(`name.ilike.${dbQ},company.ilike.${dbQ},phone.ilike.${dbQ}`).limit(5),
                supabase.from('leads').select('id, lead_number, name, company, status')
                    .or(`lead_number.ilike.${dbQ},name.ilike.${dbQ},company.ilike.${dbQ}`).limit(5),
                // Zoho is the book of record. This searched the app's own
                // `invoices` table, which holds 2 rows against Zoho's 1,501 — so
                // a client ringing up with an invoice number got "no results",
                // and on the rare hit was sent to a screen closed for writing.
                supabase.from('zoho_documents')
                    .select('id, doc_number, customer_name, total, balance, status')
                    .eq('doc_type', 'invoice')
                    .or(`doc_number.ilike.${dbQ},customer_name.ilike.${dbQ}`).limit(5),
                supabase.from('quotations').select('id, quote_number, total_amount, status')
                    .or(`quote_number.ilike.${dbQ}`).limit(5),
                // The LR / consignment number lives on the dispatch, not the job,
                // so it needs its own lookup — then we land on the job it belongs to.
                supabase.from('dispatches')
                    .select('id, tracking_number, dispatch_number, consignment_no, job_id, job:jobs(id, job_number, project_name, current_stage)')
                    .or(`tracking_number.ilike.${dbQ},dispatch_number.ilike.${dbQ},consignment_no.ilike.${dbQ}`).limit(5),
                // Print runs (PP-xxxxx) were not searched at all, so a run number
                // typed here always said "No results". ilike = case-insensitive.
                supabase.from('print_runs')
                    .select('id, print_run_number, title, status, invoice_reference, eway_bill_number')
                    .or([
                        `print_run_number.ilike.${dbQ}`,
                        `title.ilike.${dbQ}`,
                        `invoice_reference.ilike.${dbQ}`,
                        `eway_bill_number.ilike.${dbQ}`,
                    ].join(','))
                    .order('created_at', { ascending: false })
                    .limit(6),
            ]);

            const dbResults: SearchResult[] = [];
            // A job can match on more than one identifier, and can also be
            // reached via its dispatch. Show it once.
            const seenJobIds = new Set<string>();

            /** Say WHICH number matched, so a hit on an unfamiliar code is explainable. */
            const matchedOn = (row: any): string | null => {
                const needle = safeQuery.toLowerCase();
                const hit = (v: unknown) => typeof v === 'string' && v.toLowerCase().includes(needle);
                if (hit(row.invoice_reference)) return `invoice ${row.invoice_reference}`;
                if (hit(row.eway_bill_number)) return `e-way bill ${row.eway_bill_number}`;
                if (hit(row.client_ref_no)) return `client ref ${row.client_ref_no}`;
                return null;
            };

            // Every result must land ON the record, not on the list that
            // contains it. Picking a job out of 200+ and then being dropped on
            // the jobs list to find it again is not a search result.
            //   jobs, clients  → their own detail page
            //   leads, invoices → list page, with ?open=<id> popping the record's
            //                     view modal (neither has a detail route)
            //   quotations      → list page; its highlight handler fills the
            //                     search box, so it needs the quote NUMBER.
            //                     Passing the uuid, as before, matched nothing.
            if (jobsRes.data) jobsRes.data.forEach(j => {
                if (seenJobIds.has(j.id)) return;
                seenJobIds.add(j.id);
                const via = matchedOn(j);
                dbResults.push({
                    id: j.id, type: 'job',
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: via
                        ? `${getStageName(j.current_stage) || 'New'} · matched ${via}`
                        : (getStageName(j.current_stage) || 'New'),
                    href: `/admin/jobs/${j.id}`,
                });
            });

            // LR / consignment number → the job it shipped under.
            if (dispatchRes.data) (dispatchRes.data as any[]).forEach(d => {
                const job = Array.isArray(d.job) ? d.job[0] : d.job;
                if (!job?.id || seenJobIds.has(job.id)) return;
                seenJobIds.add(job.id);
                const needle = safeQuery.toLowerCase();
                const label = d.consignment_no && d.consignment_no.toLowerCase().includes(needle)
                    ? `consignment ${d.consignment_no}`
                    : d.tracking_number
                        ? `LR / tracking ${d.tracking_number}`
                        : `dispatch ${d.dispatch_number}`;
                dbResults.push({
                    id: job.id, type: 'job',
                    title: `${job.job_number} — ${job.project_name || 'Untitled'}`,
                    subtitle: `${getStageName(job.current_stage) || 'New'} · matched ${label}`,
                    href: `/admin/jobs/${job.id}`,
                });
            });

            if (clientsRes.data) clientsRes.data.forEach(c => dbResults.push({
                id: c.id, type: 'client',
                title: c.company || c.name,
                subtitle: c.phone || '',
                href: `/admin/crm/clients/${c.id}`,
            }));

            if (leadsRes.data) leadsRes.data.forEach(l => dbResults.push({
                id: l.id, type: 'lead',
                title: `${l.lead_number} — ${l.name}`,
                subtitle: leadStatusLabel(l.status),
                href: `/admin/marketing/leads?open=${l.id}`,
            }));

            if (invoicesRes.data) invoicesRes.data.forEach(inv => dbResults.push({
                id: inv.id, type: 'invoice',
                title: `${inv.doc_number}${inv.customer_name ? ` — ${inv.customer_name}` : ''}`,
                // Balance, not total: what is still owed is the thing anyone
                // searching for an invoice actually wants to know.
                subtitle: `₹${(inv.total || 0).toLocaleString('en-IN')} · ${
                    Number(inv.balance) > 0
                        ? `₹${Number(inv.balance).toLocaleString('en-IN')} still owed`
                        : (inv.status || 'draft')
                }`,
                // The Zoho screen lists the newest 500 documents and has no
                // search, so an older invoice found here would not be on it.
                // An invoice with money still on it belongs to Money In, which
                // is grouped by customer — the name is in the title above, and
                // that is the screen someone chasing this payment needs.
                href: Number(inv.balance) > 0 ? '/admin/finance/money-in' : '/admin/finance/zoho',
            }));

            if (quotationsRes.data) quotationsRes.data.forEach(q => dbResults.push({
                id: q.id, type: 'quotation',
                title: q.quote_number,
                subtitle: `₹${(q.total_amount || 0).toLocaleString('en-IN')} · ${q.status || 'draft'}`,
                href: `/admin/sales/quotations?highlight=${encodeURIComponent(q.quote_number || '')}`,
            }));

            if (printRunsRes.data) printRunsRes.data.forEach((r: any) => dbResults.push({
                id: r.id, type: 'print_run',
                title: `${r.print_run_number}${r.title ? ` — ${r.title}` : ''}`,
                subtitle: String(r.status || 'planned').replace(/_/g, ' '),
                href: `/admin/print-planner/${r.id}`,
            }));

            setResults([...navResults, ...dbResults]);
            setSelectedIndex(0);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced search
    const handleQueryChange = (value: string) => {
        setQuery(value);
        collapse();   // the expanded record is about to stop being on screen
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => performSearch(value), 250);
    };

    // Navigate to result
    const navigateTo = (result: SearchResult) => {
        setOpen(false);
        router.push(result.href);
    };

    // Keyboard navigation. While a result is expanded the arrows drive the
    // location list instead of the results list, so ↑↓↵ mean the same thing
    // wherever the user's attention is. ← backs out, Esc closes as before.
    const handleKeyDown = (e: React.KeyboardEvent) => {
        const isExpanded = expandedId !== null && locations.length > 0;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (isExpanded) setLocationIndex(i => Math.min(i + 1, locations.length - 1));
            else setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (isExpanded) setLocationIndex(i => Math.max(i - 1, 0));
            else setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'ArrowRight' && !isExpanded && results[selectedIndex]) {
            // Only steal → when the caret is at the end of the query, otherwise
            // the user is editing their search text and expects it to move.
            const el = e.target as HTMLInputElement;
            if (el.selectionStart !== null && el.selectionStart < query.length) return;
            e.preventDefault();
            expandResult(results[selectedIndex]);
        } else if (e.key === 'ArrowLeft' && isExpanded) {
            e.preventDefault();
            collapse();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isExpanded && locations[locationIndex]) navigateToHref(locations[locationIndex].href);
            else if (results[selectedIndex]) navigateTo(results[selectedIndex]);
        }
    };

    // Group results by type
    const grouped = results.reduce((acc, r) => {
        if (!acc[r.type]) acc[r.type] = [];
        acc[r.type].push(r);
        return acc;
    }, {} as Record<string, SearchResult[]>);

    // Show nav group first, then db groups
    const groupOrder = ['nav', 'job', 'print_run', 'client', 'lead', 'invoice', 'quotation'];
    const sortedGroups = groupOrder.filter(t => grouped[t]?.length > 0);

    let flatIndex = 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center border-b px-4">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Job no, invoice no, e-way bill, LR no, client ref, name…"
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12 text-sm"
                    />
                    {loading && (
                        <div className="h-4 w-4 border-2 border-muted border-t-foreground rounded-full animate-spin shrink-0" />
                    )}
                </div>

                {/* Results */}
                <div className="max-h-[360px] overflow-y-auto">
                    {query.length >= 2 && !loading && results.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            No results found for &quot;{query}&quot;
                        </div>
                    )}

                    {query.length < 2 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Type at least 2 characters to search
                        </div>
                    )}

                    {sortedGroups.map((type) => {
                        const items = grouped[type];
                        const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
                        const Icon = config.icon;
                        return (
                            <div key={type}>
                                <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                                    {config.label}
                                </div>
                                {items.map((item) => {
                                    const currentIndex = flatIndex++;
                                    const isSelected = currentIndex === selectedIndex;
                                    const isExpanded = expandedId === item.id;
                                    const canExpand = item.type === 'job' || item.type === 'client';
                                    return (
                                        <div key={item.id}>
                                            <button
                                                onClick={() => navigateTo(item)}
                                                onMouseEnter={() => !isExpanded && setSelectedIndex(currentIndex)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected || isExpanded ? 'bg-accent' : 'hover:bg-accent/50'}`}
                                            >
                                                <div className={`h-7 w-7 rounded flex items-center justify-center shrink-0 ${config.color}`}>
                                                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{item.title}</p>
                                                    {item.subtitle && (
                                                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                                                    )}
                                                </div>
                                                {/* Expand is its own control: clicking the row still opens the
                                                    record, so the fast path is unchanged for anyone who
                                                    already knows where they're going. */}
                                                {canExpand && (
                                                    <span
                                                        role="button"
                                                        tabIndex={-1}
                                                        aria-label={isExpanded ? 'Hide where this appears' : 'Show where this appears'}
                                                        onClick={(ev) => {
                                                            ev.stopPropagation();
                                                            if (isExpanded) collapse();
                                                            else { setSelectedIndex(currentIndex); expandResult(item); }
                                                        }}
                                                        className={`shrink-0 text-[10px] font-medium px-1.5 py-1 rounded border transition-colors ${isExpanded ? 'bg-background border-border text-foreground' : 'border-transparent text-muted-foreground hover:bg-background hover:border-border'}`}
                                                    >
                                                        {isExpanded ? 'hide' : 'where?'}
                                                    </span>
                                                )}
                                                {isSelected && !isExpanded && (
                                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                )}
                                            </button>

                                            {isExpanded && (
                                                <div className="bg-muted/20 border-y">
                                                    {locationsLoading ? (
                                                        <div className="flex items-center gap-2 px-4 py-3 pl-14 text-xs text-muted-foreground">
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                            Checking where this appears…
                                                        </div>
                                                    ) : locations.map((loc, li) => (
                                                        <button
                                                            key={loc.key}
                                                            onClick={() => navigateToHref(loc.href)}
                                                            onMouseEnter={() => setLocationIndex(li)}
                                                            className={`w-full flex items-center gap-2 px-4 py-2 pl-11 text-left transition-colors ${li === locationIndex ? 'bg-accent' : 'hover:bg-accent/50'}`}
                                                        >
                                                            <CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
                                                            <span className="text-xs font-medium">{loc.label}</span>
                                                            {loc.detail && (
                                                                <span className="text-xs text-muted-foreground truncate">— {loc.detail}</span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="border-t px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground bg-muted/20">
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono">↑↓</kbd>
                        navigate
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono">↵</kbd>
                        select
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono">→</kbd>
                        where?
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono">esc</kbd>
                        close
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
