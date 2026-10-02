'use client';

/**
 * Customer search box for the New Quotation form.
 *
 * Two groups: matching Customers (clients), then Open leads (not closed).
 * Picking a lead creates NOTHING here — the parent makes/links the customer
 * only when the quotation is saved.
 */

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { leadStatusLabel } from '@/lib/lead-status';
import { cn } from '@/lib/utils';

export interface PickableLead {
    id: string; lead_number: string; name: string; company?: string | null;
    phone?: string | null; status: string;
}

interface Props {
    clients: any[];
    /** Open leads only. Pass [] to hide the leads group (editing, or roles that cannot add customers). */
    leads: PickableLead[];
    clientId: string;
    lead: PickableLead | null;          // a lead picked but not yet turned into a customer
    onPickClient: (clientId: string) => void;
    onPickLead: (lead: PickableLead) => void;
    onClear: () => void;
    disabled?: boolean;
}

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const leadCompany = (l: PickableLead) => (l.company || '').trim() || l.name;

export default function CustomerOrLeadSelect({ clients, leads, clientId, lead, onPickClient, onPickLead, onClear, disabled }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    // Company names that already exist as customers (same rule the server uses).
    const existingByCompany = useMemo(() => {
        const m = new Map<string, any>();
        clients.forEach(c => { const k = norm(c.company); if (k && !m.has(k)) m.set(k, c); });
        return m;
    }, [clients]);

    const q = norm(query);
    const shownClients = clients.filter(c =>
        !q || [c.company, c.name, c.phone].some(v => norm(v).includes(q))
    ).slice(0, 50);
    const shownLeads = leads.filter(l =>
        !q || [l.company, l.name, l.phone, l.lead_number].some(v => norm(v).includes(q))
    ).slice(0, 30);

    const pickedClient = clientId ? clients.find(c => c.id === clientId) : null;
    const lineExisting = lead ? existingByCompany.get(norm(leadCompany(lead))) : null;

    const label = pickedClient
        ? `${pickedClient.company || pickedClient.name}${pickedClient.company && pickedClient.name ? ` (${pickedClient.name})` : ''}`
        : lead
            ? `${leadCompany(lead)} (${lead.lead_number} - ${lineExisting ? 'existing customer' : 'new customer'})`
            : clientId ? 'Selected customer' : '';

    const hasValue = !!(clientId || lead);

    return (
        <div>
            <div className="flex gap-2">
                <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
                    <PopoverTrigger asChild>
                        <button type="button" disabled={disabled}
                            className="flex min-h-[40px] flex-1 items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                            <span className={cn('truncate', !hasValue && 'text-gray-400')}>{label || 'Search customer or lead...'}</span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" collisionPadding={8}
                        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1rem)] p-0">
                        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                            <Search className="h-4 w-4 text-gray-400" />
                            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                                placeholder="Type company, name, mobile or lead number"
                                className="w-full bg-transparent text-sm outline-none" />
                        </div>
                        <div className="max-h-72 overflow-y-auto py-1">
                            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase text-gray-400">Customers</p>
                            {shownClients.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No matching customers</p>}
                            {shownClients.map(c => (
                                <button type="button" key={c.id}
                                    onClick={() => { onPickClient(c.id); setOpen(false); }}
                                    className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                                    <Check className={cn('h-4 w-4 shrink-0', clientId === c.id ? 'opacity-100' : 'opacity-0')} />
                                    <span className="min-w-0">
                                        <span className="block truncate font-medium text-gray-900">{c.company || c.name}</span>
                                        <span className="block truncate text-xs text-gray-500">{[c.company ? c.name : '', c.phone, c.city].filter(Boolean).join(' · ')}</span>
                                    </span>
                                </button>
                            ))}

                            {leads.length > 0 && (
                                <>
                                    <p className="border-t border-gray-100 px-3 pb-1 pt-3 text-[11px] font-bold uppercase text-gray-400">Open leads</p>
                                    {shownLeads.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No matching open leads</p>}
                                    {shownLeads.map(l => {
                                        const exists = existingByCompany.get(norm(leadCompany(l)));
                                        return (
                                            <button type="button" key={l.id}
                                                onClick={() => { onPickLead(l); setOpen(false); }}
                                                className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">
                                                <Check className={cn('h-4 w-4 shrink-0', lead?.id === l.id ? 'opacity-100' : 'opacity-0')} />
                                                <span className="min-w-0">
                                                    <span className="block truncate font-medium text-gray-900">
                                                        <span className="font-mono text-xs text-gray-500">{l.lead_number}</span> {leadCompany(l)}
                                                    </span>
                                                    <span className="block truncate text-xs text-gray-500">
                                                        {[l.company ? l.name : '', l.phone, leadStatusLabel(l.status)].filter(Boolean).join(' · ')}
                                                    </span>
                                                    {exists && <span className="block text-xs font-medium text-amber-700">links to the existing customer</span>}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
                {hasValue && !disabled && (
                    <button type="button" onClick={onClear} aria-label="Clear customer"
                        className="flex min-h-[40px] items-center rounded-md border border-gray-200 px-2 text-gray-500 hover:bg-gray-50">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
            {/* keeps the browser's "required" check working */}
            <input tabIndex={-1} aria-hidden required value={hasValue ? 'x' : ''} onChange={() => { }} className="pointer-events-none h-0 w-0 opacity-0" />
            {lead && !clientId && (
                <p className="mt-1 text-xs text-gray-500">
                    The customer is made when you press <strong>Save quotation</strong>.
                </p>
            )}
        </div>
    );
}
