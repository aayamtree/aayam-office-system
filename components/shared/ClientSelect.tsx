'use client';

/**
 * ClientSelect — the ONE client picker for the whole app.
 *
 * Why this exists: a plain <Select> of 76+ clients means scrolling to find a
 * name. When people cannot find a client by scrolling, they create a second
 * copy of it — and a duplicate client splits that client's job history,
 * invoices and payment ledger in two.
 *
 * So the design is deliberately "search first, add second":
 *   - type to filter (name, company, phone, city, GSTIN)
 *   - the "+ Add ... as new client" row only appears AFTER you have typed
 *     something, so nobody reaches the add path without searching first
 *   - only admins ever see the add row (business rule, Aug 2026)
 *
 * Use this instead of hand-rolling another client <Select>.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useClients } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import ClientQuickAddModal from './ClientQuickAddModal';

/** Company name is the identity of a client — the contact person is secondary. */
export function clientLabel(c: any): string {
    return (c?.company || '').trim() || c?.name || 'Unnamed client';
}

/** Loose key used for search + duplicate detection: letters and digits only. */
export function clientKey(s: string): string {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface ClientSelectProps {
    value: string;
    onChange: (clientId: string) => void;
    /** Fires with the full row when a brand-new client is created inline. */
    onClientCreated?: (client: any) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Set false to hide the inline add row even for admins. */
    allowAdd?: boolean;
    className?: string;
    /** Renders a hidden required input so native form validation still works. */
    required?: boolean;
    name?: string;
}

export default function ClientSelect({
    value,
    onChange,
    onClientCreated,
    placeholder = 'Select Client',
    disabled = false,
    allowAdd = true,
    className,
    required = false,
    name = 'client_id',
}: ClientSelectProps) {
    const { clients, refetch } = useClients();
    const { isAdmin } = useAuth();

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    // A client created in this session may not be in `clients` yet (the hook
    // refetches asynchronously) — keep it locally so the label never goes blank.
    const [justAdded, setJustAdded] = useState<any | null>(null);

    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const allClients = useMemo(() => {
        const rows: any[] = [...(clients || [])];
        if (justAdded && !rows.some(c => c.id === justAdded.id)) rows.unshift(justAdded);
        // Alphabetical — the hook returns newest-first, which is useless in a picker.
        return rows.sort((a, b) => clientLabel(a).localeCompare(clientLabel(b)));
    }, [clients, justAdded]);

    const selected = useMemo(
        () => allClients.find(c => c.id === value) || null,
        [allClients, value]
    );

    const filtered = useMemo(() => {
        const q = query.trim();
        if (!q) return allClients;
        const key = clientKey(q);
        return allClients.filter(c => {
            const haystack = clientKey(
                `${c.company || ''} ${c.name || ''} ${c.phone || ''} ${c.city || ''} ${c.gstin || ''}`
            );
            return haystack.includes(key);
        });
    }, [allClients, query]);

    const canAdd = isAdmin && allowAdd && query.trim().length > 0;
    // Index of the "add new" row when it is present.
    const addRowIndex = canAdd ? filtered.length : -1;

    useEffect(() => {
        setHighlight(0);
    }, [query, open]);

    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 0);
        else setQuery('');
    }, [open]);

    // Keep the highlighted row scrolled into view.
    useEffect(() => {
        const el = listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]');
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlight]);

    const choose = (client: any) => {
        onChange(client.id);
        setOpen(false);
    };

    const openQuickAdd = () => {
        setOpen(false);
        setShowQuickAdd(true);
    };

    const maxIndex = canAdd ? filtered.length : filtered.length - 1;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, Math.max(maxIndex, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlight === addRowIndex) openQuickAdd();
            else if (filtered[highlight]) choose(filtered[highlight]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
        }
    };

    // The query the modal should start from — treated as the company name.
    const [pendingName, setPendingName] = useState('');

    return (
        <>
            {required && (
                <input
                    tabIndex={-1}
                    aria-hidden
                    required
                    name={name}
                    value={value || ''}
                    onChange={() => { }}
                    className="sr-only absolute h-0 w-0 opacity-0"
                />
            )}

            <Popover open={open} onOpenChange={o => !disabled && setOpen(o)}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                            !selected && 'text-muted-foreground',
                            className
                        )}
                    >
                        <span className="truncate">{selected ? clientLabel(selected) : placeholder}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </button>
                </PopoverTrigger>

                <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                    onOpenAutoFocus={e => e.preventDefault()}
                >
                    <div className="flex items-center gap-2 border-b px-3">
                        <Search className="h-4 w-4 shrink-0 opacity-50" />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search client, phone, city…"
                            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>

                    <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
                        {filtered.length === 0 && !canAdd && (
                            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                                No client found.
                            </p>
                        )}

                        {filtered.map((c, i) => {
                            const isSel = c.id === value;
                            const secondary = [c.company ? c.name : null, c.phone, c.city]
                                .filter(Boolean)
                                .join(' · ');
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    data-highlighted={i === highlight}
                                    onMouseEnter={() => setHighlight(i)}
                                    onClick={() => choose(c)}
                                    className={cn(
                                        'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm',
                                        i === highlight && 'bg-accent text-accent-foreground'
                                    )}
                                >
                                    <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isSel ? 'opacity-100' : 'opacity-0')} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium">{clientLabel(c)}</span>
                                        {secondary && (
                                            <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}

                        {canAdd && (
                            <>
                                {filtered.length > 0 && <div className="my-1 h-px bg-border" />}
                                <button
                                    type="button"
                                    data-highlighted={highlight === addRowIndex}
                                    onMouseEnter={() => setHighlight(addRowIndex)}
                                    onClick={() => {
                                        setPendingName(query.trim());
                                        openQuickAdd();
                                    }}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium text-primary',
                                        highlight === addRowIndex && 'bg-accent'
                                    )}
                                >
                                    <UserPlus className="h-4 w-4 shrink-0" />
                                    <span className="truncate">Add &ldquo;{query.trim()}&rdquo; as new client</span>
                                </button>
                            </>
                        )}
                    </div>

                    {!isAdmin && filtered.length === 0 && (
                        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                            Client missing? Ask an admin to add it.
                        </p>
                    )}
                </PopoverContent>
            </Popover>

            <ClientQuickAddModal
                isOpen={showQuickAdd}
                initialName={pendingName}
                onClose={() => setShowQuickAdd(false)}
                onSuccess={(clientId, client) => {
                    if (client) setJustAdded(client);
                    onChange(clientId);
                    onClientCreated?.(client);
                    refetch();
                }}
            />
        </>
    );
}
