// API Route: /api/storage/file?p=/Aayam%20Projects/JOB-1/design.pdf
// Staff-only. Looks up a fresh short-lived download link on the Pi file server
// and redirects to it. Stored file URLs in the app point here, so links never
// go stale and are useless to anyone who is not logged in.

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { cleanSeafilePath, getDownloadLink, seafileConfigured } from '@/lib/seafile-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const gate = await requireUser();
    if (!gate.ok) return gate.response;
    if (!seafileConfigured()) {
        return NextResponse.json({ error: 'File server is not configured yet.' }, { status: 503 });
    }
    const path = cleanSeafilePath(request.nextUrl.searchParams.get('p'));
    if (!path) return NextResponse.json({ error: 'A valid file path is required.' }, { status: 400 });
    try {
        const link = await getDownloadLink(path);
        return NextResponse.redirect(link, 302);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'File not found.' }, { status: 404 });
    }
}
