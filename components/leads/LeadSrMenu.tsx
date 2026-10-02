'use client';

import { MoreVertical } from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { canMakeQuotationFor } from '@/lib/lead-status';

interface Props {
    lead: { lead_number: string; status: string };
    canEdit: boolean;
    onOpen: () => void;
    onHistory: () => void;
    onAddFollowUp: () => void;
    onEdit: () => void;
    onMakeQuotation: () => void;
}

/**
 * The lead number as a small button with a menu icon.
 * Read-only roles: Open lead + History only.
 * No Delete here — we never delete; use Cancelled or Inactive.
 */
export default function LeadSrMenu({ lead, canEdit, onOpen, onHistory, onAddFollowUp, onEdit, onMakeQuotation }: Props) {
    const item = 'min-h-[44px] md:min-h-0';
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`Menu for lead ${lead.lead_number}`}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-xs font-bold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400">
                    {lead.lead_number}
                    <MoreVertical className="h-3.5 w-3.5 text-gray-500" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" collisionPadding={8} className="w-52 max-w-[calc(100vw-1rem)]">
                <DropdownMenuItem className={item} onSelect={onOpen}>Open lead</DropdownMenuItem>
                <DropdownMenuItem className={item} onSelect={onHistory}>History</DropdownMenuItem>
                {canEdit && <DropdownMenuItem className={item} onSelect={onAddFollowUp}>Add follow-up</DropdownMenuItem>}
                {canEdit && <DropdownMenuItem className={item} onSelect={onEdit}>Edit</DropdownMenuItem>}
                {canEdit && canMakeQuotationFor(lead.status) && (
                    <DropdownMenuItem className={item} onSelect={onMakeQuotation}>Make quotation</DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
