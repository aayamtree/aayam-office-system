// API Route: /api/storage/upload-link
// Gives a logged-in staff member a ONE-TIME link to upload straight to the Pi
// file server (Seafile). The Seafile secret key never leaves the server.

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { getUploadLink, seafileConfigured } from '@/lib/seafile-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    const gate = await requireUser();
    if (!gate.ok) return gate.response;
    if (!seafileConfigured()) {
        return NextResponse.json({ error: 'File server is not configured yet.' }, { status: 503 });
    }
    try {
        const uploadLink = await getUploadLink();
        return NextResponse.json({ uploadLink });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Could not reach the file server.' }, { status: 502 });
    }
}
