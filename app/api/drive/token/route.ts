// API Route: /api/drive/token
// Returns the current organization Drive access token for uploads

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        if (isExpired && credentials.refresh_token) {
            // TODO: Implement token refresh logic
            return NextResponse.json({ error: 'Token expired, please reconnect' }, { status: 401 });
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
