// API Route: /api/drive/token
// Returns the current organization Drive access token for uploads

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Use service role to access org-wide credentials (app auth is via NextAuth, not Supabase auth)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Get active Drive credentials
        const { data: credentials, error } = await supabase
            .from('google_drive_credentials')
            .select('access_token, token_expiry, refresh_token')
            .eq('is_active', true)
            .single();

        if (error || !credentials) {
            return NextResponse.json({ error: 'No Drive connection found' }, { status: 404 });
        }

        // Check if token is expired
        const isExpired = new Date(credentials.token_expiry) < new Date();

        if (isExpired) {
            if (!credentials.refresh_token) {
                return NextResponse.json({
                    error: 'Token expired and no refresh token available. Admin must reconnect Google Drive.'
                }, { status: 401 });
            }

            // Auto-refresh the token
            console.log('Token expired, auto-refreshing...');
            const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/drive/refresh`, {
                method: 'POST'
            });

            if (!refreshResponse.ok) {
                const errorData = await refreshResponse.json();
                return NextResponse.json({
                    error: 'Failed to refresh token: ' + (errorData.error || 'Unknown error')
                }, { status: 500 });
            }

            const refreshData = await refreshResponse.json();

            // Update last_used_at with the new token
            await supabase
                .from('google_drive_credentials')
                .update({ last_used_at: new Date().toISOString() })
                .eq('is_active', true);

            console.log('✅ Token auto-refreshed successfully');
            return NextResponse.json({ accessToken: refreshData.access_token });
        }

        // Update last_used_at
        await supabase
            .from('google_drive_credentials')
            .update({ last_used_at: new Date().toISOString() })
            .eq('is_active', true);

        return NextResponse.json({ accessToken: credentials.access_token });

    } catch (error: any) {
        console.error('Token fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
