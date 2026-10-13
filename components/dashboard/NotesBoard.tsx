// ═══════════════════════════════════════════════════════════════════════════
// THE NOTES BOARD — above the fold, and it nags
// ═══════════════════════════════════════════════════════════════════════════
//
// Satish, 2026-09-14: "quick notes must not be seen only after scrolling down.
// Lots of notes are exchanged between admins and the team but they are all
// verbal — now this tool keeps hammering on the dashboard so it gets attention
// ASAP, and clears it out."
//
// That sentence sets every rule in this file.
//
//   · It sits DIRECTLY under the headline bar, above Money & records, above
//     everything. A note below the fold is a note nobody reads, which is the
//     same as the verbal note it was meant to replace. It is not in the
//     Widgets show/hide menu — a channel you can switch off is not a channel.
//
//   · Notes are ROWS, not cards. With one note the board is two lines tall;
//     with nine it grows downward. It can never be the reason this page is
//     long, so it never needs to be moved back down.
//
//   · The age is the nag. A note's age badge turns solid red once it has sat
//     for a fortnight, and the header says how long it has been since anything
//     was cleared. Age is the only thing on this board that shouts.
//
//   · Clearing is ONE tap, on the row. If clearing is a trip to another
//     screen, the board fills up and stops being read — which is how the old
//     widget ended up holding a single note from April.
//
// All the data lives in useDashboardNotes() — this file only draws and calls.
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDashboardNotes } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ConfirmModal';
import { StickyNote, Plus, X, Check, Users, Loader2, Clock } from 'lucide-react';

interface TeamMember { id: string; full_name: string; role: string }

type ReplyStatus = 'done' | 'not_done' | 'working';
interface NoteReply {
    id: string; note_id: string; user_id: string;
    status: ReplyStatus; reason: string | null; updated_at: string;
}

const STATUS_LABEL: Record<ReplyStatus, string> = {
    done: 'Done', not_done: 'Not done', working: 'Working on it',
};

/** Telegram a few people through the app's one server route (token stays server-side). */
async function tellOnTelegram(targetIds: string[], text: string, mode: 'mention' | 'direct') {
    if (!targetIds.length) return;
    try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        await fetch('/api/telegram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ mode, targetProfileIds: targetIds, text, url: '/admin/dashboard' }),
        });
    } catch {
        // A failed Telegram message must never block saving a note or a reply.
    }
}

const snippet = (t: string, n = 90) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

/** A note is stale at a fortnight. Before that the badge is quiet. */
const STALE_DAYS = 14;

function daysOpen(note: any): number | null {
    const raw = note.created_at || note.updated_at;
    if (!raw) return null;
    // The DB stores UTC in a column with no zone marker, so say so explicitly
    // — the same normalisation RecentActivityWidget does.
    const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
    const t = new Date(hasTz ? raw : String(raw).replace(' ', 'T') + 'Z').getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function ageLabel(d: number | null): string {
    if (d === null) return 'open';
    if (d === 0) return 'today';
    if (d === 1) return '1 day open';
    return `${d} days open`;
}

export default function NotesBoard() {
    const { profile } = useAuth();
    const { notes, loading, createNote, deleteNote, refetch } = useDashboardNotes();
    const confirm = useConfirm();

    const [adding, setAdding] = useState(false);
    const [content, setContent] = useState('');
    const [taggedIds, setTaggedIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [clearingId, setClearingId] = useState<string | null>(null);

    // Replies from tagged people (Done / Not done / Working on it)
    const [replies, setReplies] = useState<NoteReply[]>([]);
    const [replyError, setReplyError] = useState('');
    const [savingReplyId, setSavingReplyId] = useState<string | null>(null);
    const [reasonFor, setReasonFor] = useState<string | null>(null);
    const [reasonText, setReasonText] = useState('');

    const [team, setTeam] = useState<TeamMember[]>([]);
    const [showTags, setShowTags] = useState(false);
    const tagRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (tagRef.current && !tagRef.current.contains(e.target as Node)) setShowTags(false);
        };
        if (showTags) document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [showTags]);

    useEffect(() => {
        if (!profile?.id) return;
        (async () => {
            const { data } = await supabase.from('profiles').select('id, full_name, role').order('full_name');
            if (data) setTeam(data.filter((m: any) => m.id !== profile.id));
        })();
    }, [profile?.id]);

    const nameOf = (id: string) => team.find(m => m.id === id)?.full_name || 'someone';
    const personName = (id: string) => (id === profile?.id ? (profile?.full_name || 'you') : nameOf(id));

    const noteIdsKey = notes.map((n: any) => n.id).join(',');
    const reloadReplies = useCallback(async () => {
        if (!noteIdsKey) { setReplies([]); return; }
        const { data } = await supabase.from('note_replies').select('*').in('note_id', noteIdsKey.split(','));
        if (data) setReplies(data as NoteReply[]);
    }, [noteIdsKey]);

    useEffect(() => { reloadReplies(); }, [reloadReplies]);

    // A reply from Meet should show up without a page refresh.
    useEffect(() => {
        const t = setInterval(() => { refetch(); reloadReplies(); }, 60_000);
        return () => clearInterval(t);
    }, [refetch, reloadReplies]);

    /** "@meet" typed inside the note counts as tagging him — no button needed. */
    const typedTagIds = (text: string): string[] => {
        const typed = Array.from(text.matchAll(/@([A-Za-z0-9_\u00C0-\u024F]+)/g)).map(m => m[1].toLowerCase());
        if (!typed.length) return [];
        return team.filter(m => {
            const n = (m.full_name || '').toLowerCase();
            if (!n) return false; // a profile with no name saved cannot be @-tagged
            return typed.includes(n.split(/\s+/)[0]) || typed.includes(n.replace(/\s+/g, ''));
        }).map(m => m.id);
    };
    const effectiveTagIds = (text: string) => Array.from(new Set([...taggedIds, ...typedTagIds(text)]));

    const handleAdd = async () => {
        if (!content.trim()) return;
        setSaving(true); setError('');
        try {
            const allTagged = effectiveTagIds(content);
            const res = await createNote({
                content: content.trim(),
                color: 'yellow',
                tagged_users: allTagged.length ? allTagged : undefined,
            });
            if (res?.error) { setError(res.error); setSaving(false); return; }
            // Tell them straight away — a note nobody knows about is a verbal note again.
            tellOnTelegram(allTagged, `New note for you — please reply Done or Not done on the dashboard:\n“${snippet(content.trim(), 300)}”`, 'mention');
            setContent(''); setTaggedIds([]); setAdding(false);
        } catch (e: any) {
            setError(e?.message || 'Could not save the note');
        }
        setSaving(false);
    };

    const handleClear = async (note: any) => {
        const { confirmed } = await confirm({
            title: 'Clear this note',
            message: 'This removes it from the board. A copy, with every reply, is kept in the note history.',
            variant: 'danger',
            confirmLabel: 'Clear it',
        });
        if (!confirmed) return;
        setClearingId(note.id);
        setReplyError('');
        const noteReplies = replies.filter(r => r.note_id === note.id);
        const { error: archiveError } = await supabase.from('note_history').insert({
            note_id: note.id,
            content: note.content,
            created_by: note.user_id,
            note_created_at: note.created_at,
            tagged_users: Array.isArray(note.tagged_users) ? note.tagged_users : [],
            replies: noteReplies.map(r => ({
                user_id: r.user_id, name: personName(r.user_id),
                status: r.status, reason: r.reason, at: r.updated_at,
            })),
            cleared_by: profile?.id,
        });
        if (archiveError) {
            // Never delete a note we could not keep a copy of.
            setReplyError('Could not clear the note: ' + archiveError.message);
            setClearingId(null);
            return;
        }
        await deleteNote(note.id);
        setClearingId(null);
    };

    const saveReply = async (note: any, status: ReplyStatus, reason?: string) => {
        if (!profile?.id) return;
        setSavingReplyId(note.id);
        setReplyError('');
        const { error: saveError } = await supabase.from('note_replies').upsert({
            note_id: note.id,
            user_id: profile.id,
            status,
            reason: reason?.trim() || null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'note_id,user_id' });
        if (saveError) {
            setReplyError('Could not save your reply: ' + saveError.message);
            setSavingReplyId(null);
            return;
        }
        setReasonFor(null); setReasonText('');
        await reloadReplies();
        setSavingReplyId(null);
        // Tell the person who wrote the note.
        if (note.user_id && note.user_id !== profile.id) {
            const icon = status === 'done' ? '✅' : status === 'not_done' ? '❌' : '⏳';
            tellOnTelegram(
                [note.user_id],
                `${icon} ${STATUS_LABEL[status]}${reason?.trim() ? ` — ${reason.trim()}` : ''}\nabout: “${snippet(note.content)}”`,
                'direct',
            );
        }
    };

    // Oldest-first: the point of the board is that the thing nobody has dealt
    // with is the thing you see first. (The hook sorts pinned-first by date;
    // this re-sort is what makes the board a queue rather than a feed.)
    const ordered = [...notes].sort((a, b) => (daysOpen(b) ?? 0) - (daysOpen(a) ?? 0));
    const oldest = ordered.length ? daysOpen(ordered[0]) : null;

    return (
        <section
            aria-label="Notes board"
            className="rounded-xl border border-oms-orange/30 bg-oms-orange/[0.07] px-5 pb-4 pt-4"
        >
            {/* ── header ── */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <StickyNote className="h-4 w-4 shrink-0 text-board-ink" strokeWidth={2} />
                <span className="text-[13px] font-bold tracking-tight text-board-ink">Notes board</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-board-ink/70">
                    {loading && notes.length === 0
                        ? 'loading…'
                        : ordered.length === 0
                            ? 'nothing open — the board is clear'
                            : `${ordered.length} open${oldest !== null && oldest >= STALE_DAYS
                                ? ` · nothing cleared in ${oldest} days` : ''}`}
                </span>
                {!adding && (
                    <button
                        onClick={() => { setAdding(true); setError(''); }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-3.5 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Plus className="h-3 w-3" /> Add note
                    </button>
                )}
            </div>

            {/* ── the notes ── */}
            {ordered.map(note => {
                const d = daysOpen(note);
                const stale = d !== null && d >= STALE_DAYS;
                const tagged = Array.isArray(note.tagged_users) ? note.tagged_users : [];
                const mine = note.user_id === profile?.id;
                const noteReplies = replies.filter(r => r.note_id === note.id);
                const replyOf = (uid: string) => noteReplies.find(r => r.user_id === uid);
                const iAmTagged = !!profile?.id && tagged.includes(profile.id);
                const myReply = profile?.id ? replyOf(profile.id) : undefined;
                const allDone = tagged.length > 0 && tagged.every((uid: string) => replyOf(uid)?.status === 'done');
                return (
                    <div
                        key={note.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-oms-orange/25 py-3 first:mt-1"
                    >
                        <p className="min-w-[12rem] flex-1 text-[13.5px] font-medium leading-snug text-foreground">
                            {note.content}
                        </p>


                        <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${stale
                                ? 'bg-destructive text-destructive-foreground'
                                : 'bg-background text-board-ink'
                                }`}
                        >
                            {ageLabel(d)}
                        </span>

                        {mine && (
                            <button
                                onClick={() => handleClear(note)}
                                disabled={clearingId === note.id}
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${allDone
                                    ? 'bg-green-600 text-white'
                                    : 'bg-foreground text-background'
                                    }`}
                            >
                                {clearingId === note.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Check className="h-3 w-3" />}
                                {allDone ? 'All done · Clear' : 'Clear'}
                            </button>
                        )}

                        {/* ── who was asked, and what they said ── */}
                        {tagged.length > 0 && (
                            <div className="flex basis-full flex-wrap items-center gap-x-2 gap-y-1.5">
                                <span className="text-[11px] font-medium text-board-ink/70">
                                    {mine ? 'you' : personName(note.user_id || '')} →
                                </span>
                                {tagged.map((uid: string) => {
                                    const r = replyOf(uid);
                                    const tone = !r
                                        ? 'bg-background text-board-ink/70'
                                        : r.status === 'done'
                                            ? 'bg-green-100 text-green-800'
                                            : r.status === 'not_done'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-amber-100 text-amber-800';
                                    return (
                                        <span
                                            key={uid}
                                            title={r?.reason || undefined}
                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
                                        >
                                            {r?.status === 'done' && <Check className="h-3 w-3" />}
                                            {r?.status === 'not_done' && <X className="h-3 w-3" />}
                                            {r?.status === 'working' && <Clock className="h-3 w-3" />}
                                            {personName(uid)}
                                            {' · '}
                                            {r ? STATUS_LABEL[r.status] : 'no reply yet'}
                                        </span>
                                    );
                                })}
                                {tagged.map((uid: string) => {
                                    const r = replyOf(uid);
                                    return r?.status === 'not_done' && r.reason ? (
                                        <span key={uid + 'reason'} className="text-[11.5px] italic text-board-ink/75">
                                            {personName(uid)}: “{r.reason}”
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        )}

                        {/* ── reply buttons, only for the person who was tagged ── */}
                        {iAmTagged && !mine && (
                            <div className="flex basis-full flex-wrap items-center gap-2">
                                {reasonFor === note.id ? (
                                    <>
                                        <input
                                            autoFocus
                                            value={reasonText}
                                            onChange={e => setReasonText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && reasonText.trim()) saveReply(note, 'not_done', reasonText);
                                                if (e.key === 'Escape') { setReasonFor(null); setReasonText(''); }
                                            }}
                                            placeholder="Why not done? One line…"
                                            className="min-w-[14rem] flex-1 rounded-lg border border-oms-orange/30 bg-background px-3 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-oms-orange/40"
                                        />
                                        <button
                                            onClick={() => saveReply(note, 'not_done', reasonText)}
                                            disabled={!reasonText.trim() || savingReplyId === note.id}
                                            className="rounded-full bg-foreground px-3.5 py-1.5 text-[11px] font-semibold text-background disabled:opacity-40"
                                        >
                                            Send
                                        </button>
                                        <button
                                            onClick={() => { setReasonFor(null); setReasonText(''); }}
                                            className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => saveReply(note, 'done')}
                                            disabled={savingReplyId === note.id}
                                            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${myReply?.status === 'done' ? 'bg-green-600 text-white' : 'bg-background text-green-800 hover:bg-green-100'}`}
                                        >
                                            <Check className="h-3 w-3" /> Done
                                        </button>
                                        <button
                                            onClick={() => { setReasonFor(note.id); setReasonText(myReply?.status === 'not_done' ? (myReply.reason || '') : ''); }}
                                            disabled={savingReplyId === note.id}
                                            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${myReply?.status === 'not_done' ? 'bg-red-600 text-white' : 'bg-background text-red-800 hover:bg-red-100'}`}
                                        >
                                            <X className="h-3 w-3" /> Not done
                                        </button>
                                        <button
                                            onClick={() => saveReply(note, 'working')}
                                            disabled={savingReplyId === note.id}
                                            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${myReply?.status === 'working' ? 'bg-amber-500 text-white' : 'bg-background text-amber-800 hover:bg-amber-100'}`}
                                        >
                                            <Clock className="h-3 w-3" /> Working on it
                                        </button>
                                        {savingReplyId === note.id && <Loader2 className="h-3 w-3 animate-spin" />}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {replyError && (
                <p className="border-t border-oms-orange/25 py-2 text-[11px] font-medium text-destructive">{replyError}</p>
            )}

            {/* ── add a note ── */}
            <div className="border-t border-oms-orange/25 pt-3">
                {!adding ? (
                    <button
                        onClick={() => { setAdding(true); setError(''); }}
                        className="w-full text-left text-[12.5px] text-board-ink/50 transition-colors hover:text-board-ink/80"
                    >
                        Write a note for the team…
                    </button>
                ) : (
                    <div className="space-y-2.5">
                        <textarea
                            autoFocus
                            rows={2}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
                                if (e.key === 'Escape') { setAdding(false); setContent(''); setTaggedIds([]); }
                            }}
                            placeholder="Write a note for the team…"
                            className="w-full resize-none rounded-lg border border-oms-orange/30 bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-oms-orange/40"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative" ref={tagRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowTags(v => !v)}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-[11px] font-semibold text-board-ink"
                                >
                                    <Users className="h-3 w-3" />
                                    {effectiveTagIds(content).length ? `${effectiveTagIds(content).length} tagged` : 'Tag a person'}
                                </button>
                                {showTags && (
                                    <div className="absolute bottom-full left-0 z-20 mb-1 max-h-56 w-56 overflow-y-auto rounded-lg border bg-popover py-1 shadow-md">
                                        {team.length === 0 && (
                                            <p className="px-3 py-2 text-[11px] text-muted-foreground">No one else to tag</p>
                                        )}
                                        {team.map(m => {
                                            const on = taggedIds.includes(m.id);
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setTaggedIds(prev =>
                                                        on ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted"
                                                >
                                                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${on ? 'border-foreground bg-foreground text-background' : 'border-border'}`}>
                                                        {on && <Check className="h-2.5 w-2.5" />}
                                                    </span>
                                                    <span className="truncate">{m.full_name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1" />

                            <button
                                type="button"
                                onClick={() => { setAdding(false); setContent(''); setTaggedIds([]); setError(''); }}
                                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" /> Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAdd}
                                disabled={saving || !content.trim()}
                                className="inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 disabled:opacity-40"
                            >
                                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                                Add
                            </button>
                        </div>
                        {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}
                    </div>
                )}
            </div>
        </section>
    );
}
