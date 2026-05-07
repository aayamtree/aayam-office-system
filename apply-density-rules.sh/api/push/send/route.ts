import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Configure web-push with VAPID keys
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    'mailto:admin@aayam.local',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { title, message, targetAudience, url } = body;

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    // Use the caller's auth token to query subscriptions
    const authHeader = request.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Get target user subscriptions based on audience
    let query = supabase.from('push_subscriptions').select('*');

    if (targetAudience && targetAudience !== 'all') {
      if (targetAudience.startsWith('user_')) {
        // Specific user target
        const userId = targetAudience.replace('user_', '');
        query = query.eq('user_id', userId);
      } else {
        // Role-based target — get user IDs with that role first
        const { data: roleUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', targetAudience);

        if (roleUsers && roleUsers.length > 0) {
          const userIds = roleUsers.map(u => u.id);
          query = query.in('user_id', userIds);
        } else {
          return NextResponse.json({ sent: 0, message: 'No users found for target audience' });
        }
      }
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title: title || 'Aayam Office',
      body: message,
      url: url || '/admin/dashboard',
      tag: 'aayam-' + Date.now(),
    });

    // Send to all subscribers, track failures
    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );
          sent++;
        } catch (err: any) {
          failed++;
          // If subscription has expired or is invalid, mark for cleanup
          if (err.statusCode === 410 || err.statusCode === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
          console.error(`Push failed for ${sub.endpoint.slice(0, 50)}...`, err.statusCode || err.message);
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return NextResponse.json({
      sent,
      failed,
      cleaned: expiredEndpoints.length,
      total: subscriptions.length,
    });
  } catch (err: any) {
    console.error('Push send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
