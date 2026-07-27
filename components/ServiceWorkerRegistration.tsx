'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { getFreshPushSubscription } from '@/lib/push-subscription';

export function ServiceWorkerRegistration() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !profile) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then(async (reg) => {
        console.log('SW registered:', reg.scope);

        // Poll for updates every 30 min
        setInterval(() => reg.update(), 30 * 60 * 1000);

        // Subscribe to push (asks for permission first)
        await subscribeToPush(reg);
      })
      .catch((err) => {
        console.log('SW registration failed:', err);
      });

    async function subscribeToPush(reg: ServiceWorkerRegistration) {
      if (!('PushManager' in window)) return;

      // Ask for notification permission (no-op if already granted/denied)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;

      try {
        // Re-use the existing subscription ONLY if it was created with the VAPID
        // key we still use. Blindly reusing it is what left staff with silently
        // dead notifications after the 26 July key rotation — see
        // lib/push-subscription.ts for the full explanation.
        const sub = await getFreshPushSubscription(reg, vapidKey);
        if (!sub) return;

        // Save to DB (upserts by endpoint)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        if (!profile) return;

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subscription: sub.toJSON(),
            userId: profile.id,
          }),
        });

        console.log('Push subscription saved ✅');
      } catch (err) {
        console.log('Push subscription failed:', err);
      }
    }
  }, [profile]);

  return null;
}
