// API Route: /api/drive/connect
// Handles admin connecting Google Drive for organization-wide use

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Check if user is admin
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { accessToken, refreshToken, expiresIn, scopes } = body;

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
                refresh_token: refreshToken,
                token_expiry: expiryDate.toISOString(),
                scopes,
                connected_by: user.id,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('Error storing credentials:', error);
            return NextResponse.json({ error: 'Failed to store credentials' }, { status: 500 });
        }

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
            connectedAt: credentials.connected_at,
            scopes: credentials.scopes
        });

    } catch (error) {
        return NextResponse.json({ connected: false });
    }
}
