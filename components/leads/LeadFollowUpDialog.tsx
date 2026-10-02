'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { addLeadFollowUp } from '@/lib/lead-actions';
import { toast } from '@/lib/toast';

interface Props {
    lead: { id: string; lead_number: string; company?: string | null; name: string } | null;
    onClose: () => void;
    onSaved: (updated: any) => void;
}

/** "Add follow-up": opens with the note box focused and ready to type. */
export default function LeadFollowUpDialog({ lead, onClose, onSaved }: Props) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [note, setNote] = useState('');
    const [date, setDate] = useState(today);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { setNote(''); setDate(today); setError(''); setSaving(false); }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lead || saving) return;
        if (!note.trim()) { setError('Please write a note.'); return; }
        setSaving(true); setError('');
        const res = await addLeadFollowUp(lead.id, note.trim(), date || null);
        setSaving(false);
        if (res.error) { setError(res.error); return; }
        toast.success('Follow-up added');
        onSaved(res.data);
        onClose();
    };

    return (
        <Dialog open={!!lead} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add follow-up</DialogTitle>
                    <DialogDescription>
                        <span className="font-mono font-bold text-gray-800">{lead?.lead_number}</span> · {lead?.company || lead?.name}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={save} className="space-y-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Note *</label>
                        <textarea autoFocus required rows={3} value={note} onChange={e => setNote(e.target.value)}
                            placeholder="What was said? What next?"
                            className="w-full rounded-md border border-gray-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Next follow-up date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="w-full rounded-md border border-gray-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} disabled={saving}
                            className="min-h-[44px] flex-1 rounded-md border border-gray-200 font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={saving}
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-gray-900 font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving...' : 'Save follow-up'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
