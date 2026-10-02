'use client';

import { ChevronDown } from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LEAD_STATUS_LIST, leadStatusBadge, leadStatusLabel } from '@/lib/lead-status';
import { cn } from '@/lib/utils';

interface Props {
    lead: { status: string };
    /** Only roles that can edit leads get the button; everyone else sees plain text. */
    canEdit: boolean;
    onAddFollowUp: () => void;
    onSwitch: (newStatus: string) => void;
    className?: string;
}

export default function LeadStatusButton({ lead, canEdit, onAddFollowUp, onSwitch, className }: Props) {
    const pill = cn(
        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold',
        leadStatusBadge(lead.status),
        className
    );

    if (!canEdit) return <span className={pill}>{leadStatusLabel(lead.status)}</span>;

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button type="button" className={cn(pill, 'min-h-[32px] cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-gray-400')} aria-label={`Status: ${leadStatusLabel(lead.status)}. Change status`}>
                    {leadStatusLabel(lead.status)}
                    <ChevronDown className="h-3.5 w-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" collisionPadding={8} className="w-56 max-w-[calc(100vw-1rem)]">
                <DropdownMenuItem className="min-h-[44px] md:min-h-0" onSelect={onAddFollowUp}>
                    Add follow-up
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase text-gray-400">Switch to</DropdownMenuLabel>
                {LEAD_STATUS_LIST.filter(s => s.key !== lead.status).map(s => (
                    <DropdownMenuItem key={s.key} className="min-h-[44px] md:min-h-0" onSelect={() => onSwitch(s.key)}>
                        <span className={cn('mr-2 inline-block h-2.5 w-2.5 rounded-full border', s.badge)} />
                        {s.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
