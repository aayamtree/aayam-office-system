// Diagnostic endpoint to verify NextAuth environment variables
// DELETE THIS AFTER DEBUGGING

import { NextResponse } from 'next/server';

export async function GET() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const nextAuthSecret = process.env.NEXTAUTH_SECRET || '';
    const nextAuthUrl = process.env.NEXTAUTH_URL || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    return NextResponse.json({
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: clientId ? `${clientId.slice(0, 10)}...${clientId.slice(-10)}` : 'NOT SET',
        GOOGLE_CLIENT_SECRET: clientSecret ? `${clientSecret.slice(0, 8)}...${clientSecret.slice(-4)} (length: ${clientSecret.length})` : 'NOT SET',
        NEXTAUTH_SECRET: nextAuthSecret ? `${nextAuthSecret.slice(0, 6)}... (length: ${nextAuthSecret.length})` : 'NOT SET',
        NEXTAUTH_URL: nextAuthUrl || 'NOT SET',
        NEXT_PUBLIC_APP_URL: appUrl || 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
    });
}
