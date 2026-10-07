// GET /api/storage/health — is the Pi file server reachable? (any logged-in staff)
// Used by the red "Office cloud is offline" banner. Cached for 20 seconds so many
// open browsers don't hammer the Pi.

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { checkSeafileHealth } from '@/lib/seafile-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let cache: { at: number; value: { ok: boolean; ms: number; detail: string } } | null = null;

export async function GET() {
    const gate = await requireUser();
    if (!gate.ok) return gate.response;
    if (!cache || Date.now() - cache.at > 20_000) {
        cache = { at: Date.now(), value: await checkSeafileHealth() };
    }
    return NextResponse.json({ mode: 'pi', checkedAt: new Date(cache.at).toISOString(), ...cache.value });
}
