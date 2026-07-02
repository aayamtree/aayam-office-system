// Direct Google OAuth callback handler - bypasses NextAuth entirely
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const host = request.headers.get('host') || '';
    const baseUrl = host
        ? (host.includes('localhost') ? `http://${host}` : `https://${host}`)
        : (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const redirectUrl = `${baseUrl}/admin/settings/drive`;

    // Handle errors from Google
    if (error) {
        console.error('Google OAuth error:', error);
        return NextResponse.redirect(`${redirectUrl}?drive_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
        return NextResponse.redirect(`${redirectUrl}?drive_error=no_code`);
    }

    try {
        // Exchange authorization code for tokens
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
        const callbackUrl = `${baseUrl}/api/drive/callback`;

        console.log('Exchanging code for tokens...', {
            clientId: clientId.slice(0, 10) + '...',
            callbackUrl,
            codeLength: code.length,
        });

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: callbackUrl,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('Token exchange failed:', tokenData);
            return NextResponse.redirect(
                `${redirectUrl}?drive_error=${encodeURIComponent(tokenData.error_description || tokenData.error || 'token_exchange_failed')}`
            );
        }

        console.log('Token exchange successful:', {
            hasAccessToken: !!tokenData.access_token,
            hasRefreshToken: !!tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            scope: tokenData.scope,
        });

        // Save tokens to Supabase
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Get the user ID from the state parameter
        const userId = state || null;

        // Deactivate existing credentials
        await supabase
            .from('google_drive_credentials')
            .update({ is_active: false })
            .eq('is_active', true);

        // Calculate expiry
        const expiryDate = new Date(Date.now() + (tokenData.expires_in * 1000));

        // Insert new credentials
        const { data, error: dbError } = await supabase
            .from('google_drive_credentials')
            .insert({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || null,
                token_expiry: expiryDate.toISOString(),
                scopes: tokenData.scope || '',
                connected_by: userId,
                is_active: true,
            })
            .select()
            .single();

        if (dbError) {
            console.error('Failed to save credentials:', dbError);
            return NextResponse.redirect(
                `${redirectUrl}?drive_error=${encodeURIComponent('Failed to save credentials: ' + dbError.message)}`
            );
        }

        console.log('Credentials saved successfully:', data.id);

        // Redirect back to settings with success
        return NextResponse.redirect(`${redirectUrl}?drive_connected=true`);

    } catch (err: any) {
        console.error('OAuth callback error:', err);
        return NextResponse.redirect(
            `${redirectUrl}?drive_error=${encodeURIComponent(err.message || 'Unknown error')}`
        );
    }
}
