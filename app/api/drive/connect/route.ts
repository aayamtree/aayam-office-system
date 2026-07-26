// API Route: /api/drive/connect
// GET    -> connection status (self-healing: refreshes silently if possible)
// POST   -> store credentials (legacy direct-token path; admin only)
// DELETE -> disconnect

import { NextRequest, NextResponse } from 'next/server';
import {
    getServiceClient,
    getActiveCredential,
    refreshDriveToken,
} from '@/lib/google-drive-server';
import { requireUser, requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    // Identity comes from the verified cookie session, never from the request
    // body — a caller-supplied userId can be forged.
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;
    const userId = gate.user.id;

    try {
        const body = await request.json();
        const { accessToken, refreshToken, expiresIn, scopes } = body;

        if (!accessToken) {
            return NextResponse.json({ error: 'accessToken is required' }, { status: 400 });
        }

        const supabase = getServiceClient();

        // Deactivate any existing credentials, then store the new one.
        await supabase
            .from('google_drive_credentials')
            .update({ is_active: false })
            .eq('is_active', true);

        const expiryDate = new Date(Date.now() + expiresIn * 1000);

        const { data, error } = await supabase
            .from('google_drive_credentials')
            .insert({
                access_token: accessToken,
                refresh_token: refreshToken || null,
                token_expiry: expiryDate.toISOString(),
                scopes,
                connected_by: userId,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: 'Failed to store credentials: ' + error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Drive connect error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Get current Drive connection status — defensively (never throws on row count),
// and self-heals an expired access token when a refresh token is present so the
// UI doesn't falsely show "expired / reconnect".
export async function GET() {
    const gate = await requireUser();
    if (!gate.ok) return gate.response;

    try {
        const supabase = getServiceClient();
        const credential = await getActiveCredential(supabase);

        if (!credential) {
            return NextResponse.json({ connected: false });
        }

        let isExpired = new Date(credential.token_expiry) < new Date();

        if (isExpired && credential.refresh_token) {
            const refreshed = await refreshDriveToken(supabase, credential);
            if (refreshed.success) {
                isExpired = false;
            } else if (refreshed.needsReconnect) {
                // Refresh token is dead — genuine reconnect needed.
                return NextResponse.json({
                    connected: false,
                    needsReconnect: true,
                });
            }
        }

        return NextResponse.json({
            connected: true,
            isExpired,
            hasRefreshToken: !!credential.refresh_token,
            connectedAt: credential.connected_at,
            scopes: credential.scopes,
        });
    } catch (error) {
        return NextResponse.json({ connected: false });
    }
}

// Disconnect Google Drive
export async function DELETE() {
    // Disconnects Drive for the whole organisation. Admin only.
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    try {
        const supabase = getServiceClient();

        const { error } = await supabase
            .from('google_drive_credentials')
            .update({ is_active: false })
            .eq('is_active', true);

        if (error) {
            return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Disconnect error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
