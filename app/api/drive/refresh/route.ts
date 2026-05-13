// API Route: /api/drive/refresh
// Refreshes expired Google Drive access token using refresh token

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Get current active credentials
        const { data: credentials, error: fetchError } = await supabase
            .from('google_drive_credentials')
            .select('*')
            .eq('is_active', true)
            .single();

        if (fetchError || !credentials) {
            return NextResponse.json({ error: 'No active credentials found' }, { status: 404 });
        }

        // Check if we have refresh token
        if (!credentials.refresh_token) {
            return NextResponse.json({
                error: 'No refresh token available. Admin must reconnect Google Drive.'
            }, { status: 400 });
        }

        console.log('Refreshing Google Drive token...');

        // Call Google OAuth token refresh endpoint
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: credentials.refresh_token,
                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('Google token refresh failed:', errorData);
            return NextResponse.json({
                error: 'Failed to refresh token: ' + (errorData.error_description || errorData.error)
            }, { status: 500 });
        }

        const tokenData = await tokenResponse.json();
        const newExpiryDate = new Date(Date.now() + (tokenData.expires_in * 1000));

        // Update database with new access token
        const { error: updateError } = await supabase
            .from('google_drive_credentials')
            .update({
                access_token: tokenData.access_token,
                token_expiry: newExpiryDate.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', credentials.id);

        if (updateError) {
            console.error('Failed to update token:', updateError);
            return NextResponse.json({ error: 'Failed to update token' }, { status: 500 });
        }

        console.log('✅ Token refreshed successfully, expires at:', newExpiryDate);

        return NextResponse.json({
            success: true,
            access_token: tokenData.access_token,
            expires_at: newExpiryDate.toISOString()
        });

    } catch (error: any) {
        console.error('Token refresh error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
