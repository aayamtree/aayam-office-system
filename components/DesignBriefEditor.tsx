'use client';

/**
 * Design Brief & Instructions — editable, because a brief is never finished
 * at the moment the order is created.
 * ─────────────────────────────────────────────────────────────────────────
 * Two panels, two different jobs, and the app only ever had one of them:
 *
 *   THE BRIEF (this)  the current spec — what the designer builds RIGHT NOW.
 *                     One block, always correct, no history.
 *   THE NOTES         the conversation — who asked for what, when, and why.
 *
 * If notes are the only place a spec can live, the designer has to read
 * twelve notes and reconstruct the spec himself, and note 3 may contradict
 * note 11. That is how a wrong card gets printed. So the brief is editable
 * here — and every edit writes a note recording it, so making the spec
 * correctable costs no history.
 *
 * THE FIELD IS COMPOSED, NOT RAW
 * The panel above used to render `"Job Type: X\nDetails: Y"`, assembled in
 * the page from two columns. Editing that string and saving it back would
 * push the whole composed line into `jobs.description`, and the next render
 * would compose ANOTHER "Job Type:" on top of it. So this component takes
 * jobType and description separately, shows the header as read-only chrome,
 * and only ever writes `description`.
 */

import { useState, useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { FileText, Pencil, Loader2, Lock, X, Check } from 'lucide-react';

/** Past these stages the brief is what was approved — admin only. */
const LOCKED_STAGES = ['printing', 'finishing', 'quality_check', 'ready', 'delivered'];

interface DesignBriefEditorProps {
    jobId: string;
    jobType: string;
    /** RAW jobs.description — never the composed "Job Type: …" string. */
    description: string;
    currentStage: string;
    isAdmin: boolean;
    /** Is the viewer the designer this job is assigned to? */
    isAssignedDesigner: boolean;
    onSaved?: () => void;
}

export default function DesignBriefEditor({
    jobId, jobType, description, currentStage,
    isAdmin, isAssignedDesigner, onSaved,
}: DesignBriefEditorProps) {
    const { profile } = useAuth();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(description || '');
    const [saving, setSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Keep the draft in step when the user switches to a different job.
    useEffect(() => {
        setDraft(description || '');
        setEditing(false);
    }, [jobId, description]);

    useEffect(() => {
        if (editing) textareaRef.current?.focus();
    }, [editing]);

    const isLocked = LOCKED_STAGES.includes(currentStage);
    // Admin, or the designer actually holding the job. A locked job is the
    // approved spec, so past print only an admin may still correct it.
    const canEdit = isLocked ? isAdmin : (isAdmin || isAssignedDesigner);

    const handleSave = async () => {
        const next = draft.trim();
        const prev = (description || '').trim();
        if (next === prev) { setEditing(false); return; }

        setSaving(true);
        try {
            // 1. The spec itself. ONLY the description column.
            const { error } = await supabase
                .from('jobs')
                .update({ description: next })
                .eq('id', jobId);
            // No optimistic success. If the database refused it, say so —
            // this is the same failure that hid the notes bug for two months.
            if (error) throw error;

            // 2. The history. An edited brief with no record of the edit is
            //    how "who asked for this?" becomes unanswerable at billing time.
            const who = profile?.full_name || profile?.email || 'Someone';
            const trail = prev
                ? `📝 Brief updated by ${who}.\n\nBEFORE:\n${prev}\n\nAFTER:\n${next}`
                : `📝 Brief filled in by ${who}.\n\n${next}`;
            const { error: noteError } = await supabase.from('job_notes').insert([{
                job_id: jobId,
                user_id: profile?.id,
                content: trail,
                tag: 'update',
                source: 'self',
            }]);
            if (noteError) {
                // The spec saved; only the trail failed. Say which, precisely —
                // "something went wrong" would leave the user unsure whether to retype.
                console.error('[brief] history note failed:', noteError.message);
                toast.error(`Brief saved, but the change was not logged to notes: ${noteError.message}`);
            } else {
                toast.success('Brief updated');
            }

            setEditing(false);
            onSaved?.();
        } catch (e: any) {
            console.error('[brief] save failed:', e);
            toast.error(`Brief NOT saved — ${e?.message || 'Unknown error'}. Your text is still here, try again.`);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setDraft(description || '');
        setEditing(false);
    };

    return (
        <section className="bg-white p-4 rounded-md border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} className="text-primary" /> Design Brief &amp; Instructions
                </h4>
                <div className="flex items-center gap-2">
                    {isLocked && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded-md">
                            <Lock size={10} /> Sent to Print
                        </span>
                    )}
                    {!editing && canEdit && (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
                        >
                            <Pencil size={11} /> {description?.trim() ? 'Edit' : 'Add brief'}
                        </button>
                    )}
                </div>
            </div>

            {/* Job Type is derived from the job record, not free text — it stays
                read-only chrome so it can never be typed into the description. */}
            <p className="text-xs text-gray-400 mb-2">
                Job Type: <span className="font-bold text-gray-600">{jobType || '-'}</span>
            </p>

            {editing ? (
                <div className="space-y-2">
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') handleCancel();
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
                        }}
                        rows={8}
                        placeholder="What has to be designed? Sizes, sides, colours, what the client said, what is still unknown…"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm leading-relaxed focus:ring-2 ring-primary/20 outline-none resize-y"
                    />
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-bold rounded-md px-3 py-2 hover:bg-gray-800 disabled:opacity-40 transition-colors"
                        >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            {saving ? 'Saving…' : 'Save brief'}
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={saving}
                            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-md px-3 py-2 transition-colors"
                        >
                            <X size={13} /> Cancel
                        </button>
                        <span className="text-[10px] text-gray-400 ml-1">
                            Saved as a note too, so the change is on record. ⌘↵ to save, Esc to cancel.
                        </span>
                    </div>
                </div>
            ) : description?.trim() ? (
                <div className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap font-sans">
                    {description}
                </div>
            ) : (
                <div className="text-sm text-gray-400 italic">
                    No brief yet.{' '}
                    {canEdit
                        ? 'Details often arrive after the order is opened — add them here as they come in.'
                        : isLocked
                            ? 'This job is sent to print; only an admin can change the brief.'
                            : 'Only an admin or the assigned designer can write the brief.'}
                </div>
            )}
        </section>
    );
}
