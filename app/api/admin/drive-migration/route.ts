// GET /api/admin/drive-migration — progress of the Google Drive -> Pi move (admins only).
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { migrationStatus } from '@/lib/migrate-drive-to-pi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;
    return NextResponse.json({ running: process.env.DRIVE_MIGRATION === 'on', ...(await migrationStatus()) });
}
