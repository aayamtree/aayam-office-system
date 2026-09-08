'use client';

/**
 * Shared realtime provider.
 *
 * PERF: Previously every notification component opened its OWN Supabase realtime
 * channel (NotificationBell → 'notifications', NotificationPopup → 'broadcast-notifications').
 * Each subscribe/teardown writes a row to Realtime's internal `subscription` table and
 * adds to the WAL-polling load. Over months this produced 100k+ channel create/destroy
 * cycles and dominated database CPU.
 *
 * This provider opens ONE channel for the whole app, keyed by the (stable) user id so it
 * survives route navigation and auth-object reference churn. Consumers read the results
 * from context instead of subscribing themselves.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface RealtimeContextValue {
  /** Increments each time a new personal notification arrives for this user. */
  notifPing: number;
  /** Latest broadcast_notifications row inserted (null until one arrives). */
  lastBroadcast: any | null;
  /**
   * Increments on any INSERT or UPDATE to payment_captures. Screens that show
   * the capture inbox watch this number and refetch when it moves, instead of
   * each opening a channel of its own — see the PERF note at the top of this
   * file. RLS still applies to realtime, so only finance staff receive these.
   */
  capturePing: number;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  notifPing: 0,
  lastBroadcast: null,
  capturePing: 0,
});

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [notifPing, setNotifPing] = useState(0);
  const [lastBroadcast, setLastBroadcast] = useState<any | null>(null);
  const [capturePing, setCapturePing] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured() || !userId) return;

    // ONE channel, keyed by the stable user id string. Because the dependency is a
    // primitive (not the user object), this effect does NOT tear down and rebuild on
    // every navigation or auth refresh — the channel stays alive for the session.
    const channel = supabase
      .channel(`app-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => setNotifPing((n) => n + 1)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'broadcast_notifications',
        },
        (payload) => setLastBroadcast(payload.new)
      )
      // '*' rather than INSERT: a capture arriving is news, and so is one being
      // verified or rejected by someone else while you have the inbox open.
      // No filter — capture rows are not per-user, and the RLS read policy
      // (fn_is_finance_staff) already decides who may see them.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_captures',
        },
        () => setCapturePing((n) => n + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <RealtimeContext.Provider value={{ notifPing, lastBroadcast, capturePing }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/** Read the shared realtime state (notification ping, latest broadcast, capture ping). */
export function useRealtime() {
  return useContext(RealtimeContext);
}
