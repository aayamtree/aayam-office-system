'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
    Search, Package, Users, FileText, IndianRupee,
    UserPlus, ArrowRight, Command, CornerDownLeft
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface SearchResult {
    id: string;
    type: 'job' | 'client' | 'lead' | 'invoice' | 'quotation';
    title: string;
    subtitle: string;
    href: string;
}

const TYPE_CONFIG = {
    job: { icon: Package, label: 'Jobs', color: 'text-blue-600 bg-blue-50' },
    client: { icon: Users, label: 'Clients', color: 'text-green-600 bg-green-50' },
    lead: { icon: UserPlus, label: 'Leads', color: 'text-purple-600 bg-purple-50' },
    invoice: { icon: FileText, label: 'Invoices', color: 'text-amber-600 bg-amber-50' },
    quotation: { icon: IndianRupee, label: 'Quotations', color: 'text-cyan-600 bg-cyan-50' },
};

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Cmd+K / Ctrl+K shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
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

    // Search function
    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }

        if (!isSupabaseConfigured()) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = `%${searchQuery}%`;

        try {
            const [jobsRes, clientsRes, leadsRes, invoicesRes, quotationsRes] = await Promise.all([
                supabase
                    .from('jobs')
                    .select('id, job_number, project_name, current_stage')
                    .or(`job_number.ilike.${q},project_name.ilike.${q}`)
                    .limit(5),
                supabase
                    .from('clients')
                    .select('id, name, company, phone')
                    .or(`name.ilike.${q},company.ilike.${q},phone.ilike.${q}`)
                    .limit(5),
                supabase
                    .from('leads')
                    .select('id, lead_number, name, company, status')
                    .or(`lead_number.ilike.${q},name.ilike.${q},company.ilike.${q}`)
                    .limit(5),
                supabase
                    .from('invoices')
                    .select('id, invoice_number, total_amount, status')
                    .or(`invoice_number.ilike.${q}`)
                    .limit(5),
                supabase
                    .from('quotations')
                    .select('id, quote_number, total_amount, status')
                    .or(`quote_number.ilike.${q}`)
                    .limit(5),
            ]);

            const allResults: SearchResult[] = [];

            // Jobs
            if (jobsRes.data) {
                jobsRes.data.forEach(j => allResults.push({
                    id: j.id,
                    type: 'job',
                    title: `${j.job_number} — ${j.project_name || 'Untitled'}`,
                    subtitle: j.current_stage?.replace('_', ' ') || 'new',
                    href: `/admin/jobs?highlight=${j.id}`,
                }));
            }

            // Clients
            if (clientsRes.data) {
                clientsRes.data.forEach(c => allResults.push({
                    id: c.id,
                    type: 'client',
                    title: c.company || c.name,
                    subtitle: c.phone || '',
                    href: `/admin/crm/clients?highlight=${c.id}`,
                }));
            }

            // Leads
            if (leadsRes.data) {
                leadsRes.data.forEach(l => allResults.push({
                    id: l.id,
                    type: 'lead',
                    title: `${l.lead_number} — ${l.name}`,
                    subtitle: l.status || '',
                    href: `/admin/marketing/leads?highlight=${l.id}`,
                }));
            }

            // Invoices
            if (invoicesRes.data) {
                invoicesRes.data.forEach(inv => allResults.push({
                    id: inv.id,
                    type: 'invoice',
                    title: inv.invoice_number,
                    subtitle: `₹${(inv.total_amount || 0).toLocaleString('en-IN')} · ${inv.status || 'draft'}`,
                    href: `/admin/finance/invoices?highlight=${inv.id}`,
                }));
            }

            // Quotations
            if (quotationsRes.data) {
                quotationsRes.data.forEach(q => allResults.push({
                    id: q.id,
                    type: 'quotation',
                    title: q.quote_number,
                    subtitle: `₹${(q.total_amount || 0).toLocaleString('en-IN')} · ${q.status || 'draft'}`,
                    href: `/admin/sales/quotations?highlight=${q.id}`,
                }));
            }

            setResults(allResults);
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
                        placeholder="Search jobs, clients, leads, invoices..."
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12 text-sm"
                    />
                    {loading && (
                        <div className="h-4 w-4 border-2 border-muted border-t-foreground rounded-full animate-spin shrink-0" />
                    )}
                </div>

                {/* Results */}
                <div className="max-h-[320px] overflow-y-auto">
                    {query.length >= 2 && !loading && results.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            No results found for &quot;{query}&quot;
                        </div>
                    )}

                    {query.length < 2 && !loading && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Type at least 2 characters to search
                        </div>
                    )}

                    {Object.entries(grouped).map(([type, items]) => {
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
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                                                }`}
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
                <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                    <div className="flex items-center gap-3">
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
