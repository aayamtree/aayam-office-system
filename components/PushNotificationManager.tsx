'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Bell, X } from 'lucide-react';

import { getFreshPushSubscription } from '@/lib/push-subscription';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushNotificationManager() {
  const { profile } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Check if push notifications are supported and permission status
  const checkAndSubscribe = useCallback(async () => {
    if (!profile?.id || !VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // An existing subscription is only useful if it was created with the VAPID
      // key we still use — otherwise it can never receive a notification, and it
      // looks healthy in the database while being dead. See lib/push-subscription.ts.
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription && Notification.permission === 'granted') {
        const fresh = await getFreshPushSubscription(registration, VAPID_PUBLIC_KEY!);
        if (fresh) await saveSubscription(fresh);
        return;
      }

      // Check permission state
      const permission = Notification.permission;

      if (permission === 'granted') {
        // Permission already granted, subscribe silently
        await subscribeToPush(registration);
      } else if (permission === 'default') {
        // Show the prompt banner (only if not previously dismissed this session)
        const dismissed = sessionStorage.getItem('push-prompt-dismissed');
        if (!dismissed) {
          setShowPrompt(true);
        }
      }
      // If 'denied', don't show anything
    } catch (err) {
      console.error('Push notification setup error:', err);
    }
  }, [profile?.id]);

  useEffect(() => {
    // Small delay to avoid blocking initial render
    const timer = setTimeout(checkAndSubscribe, 2000);
    return () => clearTimeout(timer);
  }, [checkAndSubscribe]);

  const subscribeToPush = async (registration: ServiceWorkerRegistration) => {
    try {
      setIsSubscribing(true);
      const subscription = await getFreshPushSubscription(registration, VAPID_PUBLIC_KEY!);
      if (!subscription) return;

      await saveSubscription(subscription);
      setShowPrompt(false);
    } catch (err) {
      console.error('Push subscription failed:', err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const saveSubscription = async (subscription: PushSubscription) => {
    if (!profile?.id) return;

    const subJson = subscription.toJSON();
    const { data: { session } } = await supabase.auth.getSession();

    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          subscription: {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          },
          userId: profile.id,
        }),
      });
    } catch (err) {
      console.error('Failed to save push subscription:', err);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        await subscribeToPush(registration);
      } else {
        setShowPrompt(false);
        sessionStorage.setItem('push-prompt-dismissed', '1');
      }
    } catch (err) {
      console.error('Notification permission error:', err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('push-prompt-dismissed', '1');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[60] animate-slide-in-right">
      <div className="bg-gray-900 text-white rounded-xl p-4 shadow-2xl border border-gray-700">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Enable Notifications</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Get alerts for new tasks, mentions, and updates — even when the app is in the background.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnableNotifications}
                disabled={isSubscribing}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubscribing ? 'Enabling...' : 'Allow'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold rounded-lg transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
