// API Route: /api/drive/connect
// Handles admin connecting Google Drive for organization-wide use

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { accessToken, refreshToken, expiresIn, scopes, userId } = body;

        // Use service role key for server-side operations (bypasses RLS)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        console.log('Checking user:', userId);

        // Verify user exists and is admin
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error('Profile error:', profileError);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (profile.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        console.log('User verified as admin, saving credentials...');

        // Deactivate any existing credentials
        await supabase
            .from('google_drive_credentials')
            .update({ is_active: false })
            .eq('is_active', true);

        // Store new credentials
        const expiryDate = new Date(Date.now() + (expiresIn * 1000));

        const { data, error } = await supabase
            .from('google_drive_credentials')
            .insert({
                access_token: accessToken,
                refresh_token: refreshToken || null, // Allow null
                token_expiry: expiryDate.toISOString(),
                scopes,
                connected_by: userId,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('Error storing credentials:', error);
            return NextResponse.json({ error: 'Failed to store credentials: ' + error.message }, { status: 500 });
        }

        console.log('Credentials saved successfully!');
        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('Drive connect error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Get current Drive connection status
export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: credentials, error } = await supabase
            .from('google_drive_credentials')
            .select('*')
            .eq('is_active', true)
            .single();

        if (error || !credentials) {
            return NextResponse.json({ connected: false });
        }

        // Check if token is expired
        const isExpired = new Date(credentials.token_expiry) < new Date();

        return NextResponse.json({
            connected: true,
            isExpired,
            hasRefreshToken: !!credentials.refresh_token,
            connectedAt: credentials.connected_at,
            scopes: credentials.scopes
        });

    } catch (error) {
        return NextResponse.json({ connected: false });
    }
}

// Disconnect Google Drive
export async function DELETE() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Deactivate all active credentials
        const { error } = await supabase
            .from('google_drive_credentials')
            .update({ is_active: false })
            .eq('is_active', true);

        if (error) {
            console.error('Error disconnecting:', error);
            return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
        }

        console.log('✅ Google Drive disconnected successfully');
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Disconnect error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
