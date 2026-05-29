'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

/** Convert base64url VAPID key → ArrayBuffer for pushManager.subscribe() */
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

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
        // Re-use existing subscription or create a new one
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
        }));

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
