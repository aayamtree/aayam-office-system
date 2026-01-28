// API Route: /api/cron/refresh-drive-token
// Background job to refresh Google Drive token before it expires
// Runs every 50 minutes via Vercel Cron

import { NextResponse } from 'next/server';

export async function GET() {
    try {
        console.log('🔄 Cron: Starting scheduled token refresh...');

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

    } catch (error: any) {
        console.error('❌ Cron: Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
