import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * FIX 2026-07-06: This route previously upserted with the USER's token.
 * On shared office computers the same browser push endpoint can belong to a
 * previously-logged-in user — the upsert then hits ANOTHER user's row and RLS
 * blocks it (42501, 294 failures in production). We now:
 *  1. Verify the caller's JWT (so nobody can subscribe as someone else)
 *  2. Upsert with the service-role client, reassigning the endpoint to the
 *     CURRENT verified user (correct behavior for shared devices).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription } = body;

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });
    }

    // 1. Verify the caller is a real logged-in user
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const anon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 2. Upsert with service role — endpoint is reassigned to the current user
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const db = createClient(supabaseUrl, serviceKey || supabaseAnonKey);

    const { endpoint, keys } = subscription;
    const { error } = await db
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userData.user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: request.headers.get('user-agent') || '',
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('Push subscribe error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Push subscribe error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
