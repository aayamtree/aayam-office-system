// API Route: /api/cron/refresh-drive-token
// Background job to refresh Google Drive token before it expires
// Runs every 50 minutes via Vercel Cron

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    // Protect with CRON_SECRET so only Vercel cron (or authorized callers) can trigger
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Call the refresh endpoint
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/drive/refresh`, {
            method: 'POST'
        });

        if (!refreshResponse.ok) {
            const errorData = await refreshResponse.json();
            console.error('❌ Cron: Token refresh failed:', errorData);
            return NextResponse.json({
                success: false,
                error: errorData.error
            }, { status: 500 });
        }

        const data = await refreshResponse.json();
        console.log('✅ Cron: Token refreshed successfully');

        return NextResponse.json({
            success: true,
            refreshed_at: new Date().toISOString(),
            expires_at: data.expires_at
        });

    } catch (error: unknown) {
        console.error('❌ Cron: Error:', error);
        return NextResponse.json({
            success: false,
            error: (error as Error).message
        }, { status: 500 });
    }
}
