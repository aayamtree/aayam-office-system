'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchLeadHistory, LeadHistoryRow } from '@/lib/lead-actions';
import { leadStatusLabel } from '@/lib/lead-status';

interface Props {
    lead: { id: string; lead_number: string; company?: string | null; name: string } | null;
    onClose: () => void;
}

export default function LeadHistoryDialog({ lead, onClose }: Props) {
    const [rows, setRows] = useState<LeadHistoryRow[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!lead) return;
        setRows(null); setError('');
        let cancelled = false;
        fetchLeadHistory(lead.id).then(r => {
            if (cancelled) return;
            if (r.error) setError(r.error); else setRows(r.data || []);
        });
        return () => { cancelled = true; };
    }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const headline = (r: LeadHistoryRow) =>
        r.kind === 'status_change' ? `${leadStatusLabel(r.old_status)} → ${leadStatusLabel(r.new_status)}`
        : r.kind === 'follow_up' ? 'Follow-up added'
        : r.kind === 'converted_to_client' ? 'Converted to client'
        : r.kind;

    return (
        <Dialog open={!!lead} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>History</DialogTitle>
                    <DialogDescription>
                        <span className="font-mono font-bold text-gray-800">{lead?.lead_number}</span> · {lead?.company || lead?.name}
                    </DialogDescription>
                </DialogHeader>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {!rows && !error && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>}
                {rows && rows.length === 0 && <p className="py-4 text-center text-sm text-gray-400">No history yet.</p>}
                {rows && rows.length > 0 && (
                    <ul className="space-y-3">
                        {rows.map(r => (
                            <li key={r.id} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
                                <p className="font-semibold text-gray-900">{headline(r)}</p>
                                {r.note && <p className="mt-0.5 text-gray-700">{r.note}</p>}
                                <p className="mt-1 text-xs text-gray-400">
                                    {r.created_by_name || 'Someone'} · {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}
