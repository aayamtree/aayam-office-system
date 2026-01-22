import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOptions<T> {
    table: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    onInsert?: (payload: T) => void;
    onUpdate?: (payload: T) => void;
    onDelete?: (payload: { old: T }) => void;
    filter?: string;
}

/**
 * Hook for Supabase Realtime subscriptions
 * Provides instant updates when data changes
 */
export function useRealtime<T = any>({
    table,
    event = '*',
    onInsert,
    onUpdate,
    onDelete,
    filter,
}: UseRealtimeOptions<T>) {
    const channelRef = useRef<RealtimeChannel>();

    useEffect(() => {
        // Create channel
        const channel = supabase.channel(`${table}-changes`);

        // Subscribe to table changes
        let subscription = channel.on(
            'postgres_changes',
            {
                event,
                schema: 'public',
                table,
                filter,
            },
            (payload) => {
                switch (payload.eventType) {
                    case 'INSERT':
                        onInsert?.(payload.new as T);
                        break;
                    case 'UPDATE':
                        onUpdate?.(payload.new as T);
                        break;
                    case 'DELETE':
                        onDelete?.({ old: payload.old as T });
                        break;
                }
            }
        );

        // Subscribe
        subscription.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`✅ Subscribed to ${table} changes`);
            }
        });

        channelRef.current = channel;

        // Cleanup
        return () => {
            channel.unsubscribe();
            console.log(`❌ Unsubscribed from ${table} changes`);
        };
    }, [table, event, filter, onInsert, onUpdate, onDelete]);

    return channelRef.current;
}
