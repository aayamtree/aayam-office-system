import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './auth-context';

interface UseIdleTimeoutOptions {
    timeout?: number; // milliseconds
    warningTime?: number; // milliseconds before timeout to show warning
    onIdle?: () => void;
    onWarning?: () => void;
}

/**
 * Hook to track user idle time and auto-logout after specified duration
 * Default: 1 hour (3,600,000 ms) with warning at 55 minutes
 */
export function useIdleTimeout({
    timeout = 3600000, // 1 hour
    warningTime = 3300000, // 55 minutes
    onIdle,
    onWarning,
}: UseIdleTimeoutOptions = {}) {
    const { signOut } = useAuth();
    const timeoutRef = useRef<NodeJS.Timeout>();
    const warningRef = useRef<NodeJS.Timeout>();

    const resetTimer = useCallback(() => {
        // Clear existing timers
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);

        // Set warning timer
        warningRef.current = setTimeout(() => {
            onWarning?.();
        }, warningTime);

        // Set idle timeout
        timeoutRef.current = setTimeout(() => {
            onIdle?.();
            signOut(); // Auto logout
        }, timeout);
    }, [timeout, warningTime, onIdle, onWarning, signOut]);

    useEffect(() => {
        // Events that indicate user activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        // Reset timer on any activity
        const handleActivity = () => resetTimer();

        // Add event listeners
        events.forEach(event => {
            document.addEventListener(event, handleActivity);
        });

        // Start initial timer
        resetTimer();

        // Cleanup
        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningRef.current) clearTimeout(warningRef.current);
        };
    }, [resetTimer]);

    return { resetTimer };
}
