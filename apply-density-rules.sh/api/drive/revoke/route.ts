// API Route: /api/drive/revoke
// Revokes the current Google Drive token so the next OAuth consent gives a fresh refresh_token

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Get current active credentials
        const { data: credentials } = await supabase
            .from('google_drive_credentials')
            .select('access_token, refresh_token')
            .eq('is_active', true)
            .single();

        if (credentials?.access_token) {
            // Revoke at Google - this ensures next consent gives a fresh refresh_token
            const tokenToRevoke = credentials.refresh_token || credentials.access_token;
            try {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                });
                console.log('✅ Token revoked at Google');
            } catch (e) {
                console.log('Revoke at Google failed (might already be expired):', e);
            }
        }

        // Delete ALL old credentials (clean slate)
        await supabase
            .from('google_drive_credentials')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

        console.log('✅ Old credentials cleaned up');

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Revoke error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
