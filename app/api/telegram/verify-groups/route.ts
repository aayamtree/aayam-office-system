// API Route: /api/telegram/verify-groups
//
// Read-only diagnostic. For every row in telegram_groups it asks Telegram for
// the chat's CURRENT real title (getChat) and compares it to the title we have
// stored. Sends no messages — nobody in any group sees anything.
//
// Why this exists: the stored titles drifted out of sync with the real chats,
// so `department` tags ended up pointing at the wrong groups (the EOD report,
// which targets department='admin', was arriving in DESIGN@AAYAM). Guessing at
// the mapping is what caused the problem, so this asks Telegram instead.
//
// Admin only.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;

export async function GET() {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    if (!BOT_TOKEN) {
        return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const { data: rows, error } = await supabase
        .from('telegram_groups')
        .select('id, chat_id, title, department, is_active, alerts_enabled, digest_enabled, created_at')
        .order('created_at');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = await Promise.all(
        (rows || []).map(async (row) => {
            let realTitle: string | null = null;
            let chatType: string | null = null;
            let memberCount: number | null = null;
            let reachable = false;
            let telegramError: string | null = null;

            try {
                const res = await fetch(
                    `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(row.chat_id)}`
                );
                const json = await res.json();
                if (json.ok) {
                    reachable = true;
                    realTitle = json.result?.title ?? null;
                    chatType = json.result?.type ?? null;
                } else {
                    telegramError = json.description || 'unknown error';
                }
            } catch (e: any) {
                telegramError = e.message;
            }

            if (reachable) {
                try {
                    const cRes = await fetch(
                        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=${encodeURIComponent(row.chat_id)}`
                    );
                    const cJson = await cRes.json();
                    if (cJson.ok) memberCount = cJson.result;
                } catch {
                    /* member count is a nice-to-have */
                }
            }

            return {
                stored_title: row.title,
                real_title: realTitle,
                title_matches: reachable ? row.title === realTitle : null,
                department: row.department,
                chat_id: row.chat_id,
                chat_type: chatType,
                members: memberCount,
                reachable,
                telegram_error: telegramError,
                is_active: row.is_active,
                added: row.created_at,
                row_id: row.id,
            };
        })
    );

    return NextResponse.json({
        checked: results.length,
        mismatches: results.filter((r) => r.title_matches === false).length,
        unreachable: results.filter((r) => !r.reachable).length,
        groups: results,
    });
}
