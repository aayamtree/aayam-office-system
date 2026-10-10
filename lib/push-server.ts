// lib/push-server.ts — phone/browser push to every device of a role, sent by the
// SERVER with the service key. For system messages ("a job passed QC") that no
// person is composing: they must not depend on whose browser happened to be open
// or what that login is allowed to write.
//
// Never throws — a failed push must not fail the job-stage alert around it.

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails('mailto:admin@aayam.local', pub, priv);
  configured = true;
  return true;
}

export async function pushToRole(
  role: string,
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: number; failed: number; error?: string }> {
  try {
    if (!configure()) return { sent: 0, failed: 0, error: 'VAPID keys not configured' };
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { sent: 0, failed: 0, error: 'Supabase service key not configured' };
    const db = createClient(url, key, { auth: { persistSession: false } });

    const { data: users } = await db.from('profiles').select('id').eq('role', role);
    const ids = (users || []).map((u: any) => u.id as string);
    if (ids.length === 0) return { sent: 0, failed: 0 };

    const { data: subs } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', ids);
    if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/admin/dashboard',
      tag: 'aayam-' + Date.now(),
    });

    let sent = 0;
    let failed = 0;
    const dead: string[] = [];
    await Promise.allSettled(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
          sent++;
        } catch (err: any) {
          failed++;
          if ([410, 404, 403, 400].includes(err?.statusCode)) dead.push(s.endpoint);
        }
      })
    );
    if (dead.length > 0) await db.from('push_subscriptions').delete().in('endpoint', dead);
    return { sent, failed };
  } catch (e: any) {
    return { sent: 0, failed: 0, error: e?.message || String(e) };
  }
}
