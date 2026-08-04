'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
    Search, Package, Users, FileText, IndianRupee,
    UserPlus, ArrowRight, LayoutDashboard, Navigation
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getStageName } from '@/lib/job-workflow';

interface SearchResult {
    id: string;
    type: 'nav' | 'job' | 'client' | 'lead' | 'invoice' | 'quotation';
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
    { title: 'Invoices',              subtitle: 'All invoices',                     href: '/admin/finance/invoices' },
    { title: 'Payments',              subtitle: 'Payment records',                  href: '/admin/finance/payments' },
    { title: 'Banking',               subtitle: 'Bank reconciliation',              href: '/admin/finance/banking' },
    { title: 'Bank Accounts',         subtitle: 'Manage bank accounts',             href: '/admin/finance/banks' },
    { title: 'Daily Summary',         subtitle: 'Daily finance summary',            href: '/admin/finance/daily' },
    { title: 'Accounts',              subtitle: 'Chart of accounts',                href: '/admin/finance/accounts' },
    { title: 'Journal',               subtitle: 'Journal entries',                  href: '/admin/finance/journal' },
    { title: 'Purchase Bills',        subtitle: 'Vendor purchase bills',            href: '/admin/finance/vendors/purchases' },
    { title: 'Vendors',               subtitle: 'Vendor directory',                 href: '/admin/finance/vendors' },
    { title: 'Finance Guide',         subtitle: 'Finance reference guide',          href: '/admin/finance/guide' },
    // Dispatch
    { title: 'Dispatch Command Center', subtitle: 'Dispatch overview',              href: '/admin/dispatch' },
    { title: 'QC & Packing',          subtitle: 'Quality check & packing',          href: '/admin/dispatch/qc-check' },
    { title: 'Delivery History',      subtitle: 'Past deliveries',                  href: '/admin/dispatch/history' },
    { title: 'Transporters',          subtitle: 'Transporter list',                 href: '/admin/dispatch/transporters' },
    { title: 'Dispatch Guide',        subtitle: 'Dispatch reference guide',         href: '/admin/dispatch/guide' },
    // CMYK Print
    { title: 'CMYK Print Station',    subtitle: 'CMYK station overview',            href: '/admin/cmyk-print' },
    { title: 'Paper Stock',           subtitle: 'Paper stock levels',               href: '/admin/cmyk-print/paper-stock' },
    { title: 'Retail POS',            subtitle: 'Point of sale',                    href: '/admin/cmyk-print/retail-pos' },
    // Reports
    { title: 'Reports Overview',      subtitle: 'All reports',                      href: '/admin/reports' },
    { title: 'Finance Reports',       subtitle: 'Financial reports',                href: '/admin/reports/finance' },
    { title: 'Sales Reports',         subtitle: 'Sales reports',                    href: '/admin/reports/sales' },
    { title: 'Vendor Reports',        subtitle: 'Vendor reports',                   href: '/admin/finance/reports/vendor-reports' },
    { title: 'Dispatch Reports',      subtitle: 'Dispatch reports',                 href: '/admin/reports/dispatch' },
    // Other
    { title: 'Activity Log',          subtitle: 'System activity',                  href: '/admin/activity' },
    { title: 'Calendar',              subtitle: 'Team calendar',                    href: '/admin/calendar' },
    { title: 'EOD Report',            subtitle: 'End of day report',                href: '/admin/eod-report' },
    { title: 'Broadcast',             subtitle: 'Send team announcements',          href: '/admin/broadcast' },
    { title: 'Team Files',            subtitle: 'Shared team files',                href: '/admin/team/files' },
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

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

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
        const dbQ = `%${searchQuery}%`;

        try {
            const [jobsRes, clientsRes, leadsRes, invoicesRes, quotationsRes] = await Promise.all([
                supabase.from('jobs').select('id, job_number, project_name, current_stage')
                    .or(`job_number.ilike.${dbQ},project_name.ilike.${dbQ}`).limit(5),
                supabase.from('clients').select('id, name, company, phone')
                    .or(`name.ilike.${dbQ},company.ilike.${dbQ},phone.ilike.${dbQ}`).limit(5),
                supabase.from('leads').select('id, lead_number, name, company, status')
                    .or(`lead_number.ilike.${dbQ},name.ilike.${dbQ},company.ilike.${dbQ}`).limit(5),
                supabase.from('invoices').select('id, invoice_number, total_amount, payment_status')
                    .or(`invoice_number.ilike.${dbQ}`).limit(5),
                supabase.from('quotations').select('id, quote_number, total_amount, status')
                    .or(`quote_number.ilike.${dbQ}`).limit(5),
            ]);

            const dbResults: SearchResult[] = [];

            // Every result must land ON the record, not on the list that
            // contains it. Picking a job out of 200+ and then being dropped on
            // the jobs list to find it again is not a search result.
            //   jobs, clients  → their own detail page
            //   leads, invoices → list page, with ?open=<id> popping the record's
            //                     view modal (neither has a detail route)
            //   quotations      → list page; its highlight handler fills the
            //                     search box, so it needs the quote NUMBER.
            //                     Passing the uuid, as before, matched nothing.
            if (jobsRes.data) jobsRes.data.forEach(j => dbResults.push({
                id: j.id, type: 'job',
                title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                subtitle: getStageName(j.current_stage) || 'New',
                href: `/admin/jobs/${j.id}`,
            }));

            if (clientsRes.data) clientsRes.data.forEach(c => dbResults.push({
                id: c.id, type: 'client',
                title: c.company || c.name,
                subtitle: c.phone || '',
                href: `/admin/crm/clients/${c.id}`,
            }));

            if (leadsRes.data) leadsRes.data.forEach(l => dbResults.push({
                id: l.id, type: 'lead',
                title: `${l.lead_number} — ${l.name}`,
                subtitle: l.status || '',
                href: `/admin/marketing/leads?open=${l.id}`,
            }));

            if (invoicesRes.data) invoicesRes.data.forEach(inv => dbResults.push({
                id: inv.id, type: 'invoice',
                title: inv.invoice_number,
                subtitle: `₹${(inv.total_amount || 0).toLocaleString('en-IN')} · ${inv.payment_status || 'draft'}`,
                href: `/admin/finance/invoices?open=${inv.id}`,
            }));

            if (quotationsRes.data) quotationsRes.data.forEach(q => dbResults.push({
                id: q.id, type: 'quotation',
                title: q.quote_number,
                subtitle: `₹${(q.total_amount || 0).toLocaleString('en-IN')} · ${q.status || 'draft'}`,
                href: `/admin/sales/quotations?highlight=${encodeURIComponent(q.quote_number || '')}`,
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
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => performSearch(value), 250);
    };

    // Navigate to result
    const navigateTo = (result: SearchResult) => {
        setOpen(false);
        router.push(result.href);
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            e.preventDefault();
            navigateTo(results[selectedIndex]);
        }
    };

    // Group results by type
    const grouped = results.reduce((acc, r) => {
        if (!acc[r.type]) acc[r.type] = [];
        acc[r.type].push(r);
        return acc;
    }, {} as Record<string, SearchResult[]>);

    // Show nav group first, then db groups
    const groupOrder = ['nav', 'job', 'client', 'lead', 'invoice', 'quotation'];
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
                        placeholder="Search pages, jobs, clients, leads..."
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
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => navigateTo(item)}
                                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'}`}
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
                                            {isSelected && (
                                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            )}
                                        </button>
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
                        <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono">esc</kbd>
                        close
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
