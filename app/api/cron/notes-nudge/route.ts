// /api/cron/notes-nudge — chase the Notes board so a tagged note is never ignored.
//
// Satish, 2026-10-13: when he tags someone on the Notes board, that person
// should answer Done / Not done — and if they do not, the board should chase
// them instead of waiting for him to remember.
//
// Once a day (10:00 IST, Mon–Sat) this does two things:
//   1. For every tagged person who has not answered a note for NUDGE_DAYS —
//      no reply at all, or "Working on it" that has gone stale — it sends ONE
//      Telegram message listing everything they owe.
//   2. For every author, it sends ONE summary of what is still waiting on
//      other people.
// A note is nudged at most once per NUDGE_DAYS (notes.last_nudged_at), so a
// person is never messaged about the same note two days running.
// "Not done" replies are not chased: the reason is already on the board and
// the next move belongs to the author.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron } from '@/lib/api-auth';
import { sendToChatResult, escapeHtml } from '@/lib/telegram-groups';
import { withCronLog } from '@/lib/cron-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Days a tagged note may sit unanswered before the first nudge, and between nudges. */
const NUDGE_DAYS = 2;
const DAY_MS = 86_400_000;
const MAX_LINES = 8;

function serviceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

const snip = (t: string, n = 80) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

export async function GET(request: NextRequest) {
    const gate = await authorizeCron(request);
    if (!gate.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const db = serviceClient();
    if (!db) return NextResponse.json({ error: 'service role not configured' }, { status: 503 });

    return withCronLog('notes-nudge', async () => {
        const now = Date.now();

        const { data: notes, error } = await db
            .from('notes')
            .select('id, content, user_id, tagged_users, created_at, last_nudged_at')
            .neq('tagged_users', '{}');
        if (error) throw new Error(`could not read notes: ${error.message}`);

        const tagged = (notes || []).filter((n: any) => Array.isArray(n.tagged_users) && n.tagged_users.length);
        if (!tagged.length) return NextResponse.json({ nudged: 0, note: 'no tagged notes' });

        const { data: replies } = await db
            .from('note_replies')
            .select('note_id, user_id, status, updated_at')
            .in('note_id', tagged.map((n: any) => n.id));

        const { data: people } = await db
            .from('profiles')
            .select('id, full_name, telegram_chat_id');
        const person = (id: string) => (people || []).find((p: any) => p.id === id);

        // person id -> lines they owe;  author id -> lines waiting on others
        const owed = new Map<string, string[]>();
        const waiting = new Map<string, string[]>();
        const nudgedNotes = new Set<string>();

        for (const n of tagged as any[]) {
            const ageDays = (now - new Date(n.created_at).getTime()) / DAY_MS;
            if (ageDays < NUDGE_DAYS) continue;
            const sinceNudge = n.last_nudged_at ? (now - new Date(n.last_nudged_at).getTime()) / DAY_MS : Infinity;
            if (sinceNudge < NUDGE_DAYS) continue;

            const slow: string[] = [];
            for (const uid of n.tagged_users as string[]) {
                if (uid === n.user_id) continue;
                const r = (replies || []).find((x: any) => x.note_id === n.id && x.user_id === uid);
                const stale = !r || (r.status === 'working'
                    && (now - new Date(r.updated_at).getTime()) / DAY_MS >= NUDGE_DAYS);
                if (!stale) continue;
                const line = `• ${escapeHtml(snip(n.content))} <i>(${Math.floor(ageDays)}d)</i>`;
                owed.set(uid, [...(owed.get(uid) || []), line]);
                slow.push(person(uid)?.full_name || 'someone');
                nudgedNotes.add(n.id);
            }
            if (slow.length && n.user_id) {
                const line = `• ${escapeHtml(snip(n.content))} — waiting on <b>${escapeHtml(slow.join(', '))}</b> (${Math.floor(ageDays)}d)`;
                waiting.set(n.user_id, [...(waiting.get(n.user_id) || []), line]);
            }
        }

        const body = (lines: string[]) =>
            lines.slice(0, MAX_LINES).join('\n') +
            (lines.length > MAX_LINES ? `\n…and ${lines.length - MAX_LINES} more` : '');

        let sent = 0;
        let failed = 0;
        const send = async (uid: string, html: string) => {
            const chat = person(uid)?.telegram_chat_id;
            if (!chat) { failed++; return; }
            const r = await sendToChatResult(chat, html, '/admin/dashboard');
            if (r.ok) sent++; else failed++;
        };

        for (const [uid, lines] of Array.from(owed.entries())) {
            await send(uid, `⏰ <b>Notes board — waiting for your reply</b>\n\n${body(lines)}\n\n<i>Open the dashboard and press Done, Not done or Working on it.</i>`);
        }
        for (const [uid, lines] of Array.from(waiting.entries())) {
            await send(uid, `📋 <b>Notes board — still waiting on others</b>\n\n${body(lines)}`);
        }

        if (nudgedNotes.size && sent > 0) {
            // Count the nudge only if at least one message actually went out.
            for (const id of Array.from(nudgedNotes)) {
                const n = tagged.find((x: any) => x.id === id) as any;
                await db.from('notes')
                    .update({ last_nudged_at: new Date().toISOString(), nudge_count: (n?.nudge_count || 0) + 1 })
                    .eq('id', id);
            }
        }

        return NextResponse.json({ notesChased: nudgedNotes.size, sent, failed });
    });
}
