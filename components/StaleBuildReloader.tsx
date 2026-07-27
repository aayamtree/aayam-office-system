'use client';

import { useEffect } from 'react';

/**
 * Recovers a browser tab that was left open across a deployment.
 *
 * Next.js loads a manifest of hashed JS filenames when a page first loads.
 * After a deploy those files are replaced, so client-side navigation in an
 * already-open tab requests chunks that no longer exist and React throws
 * ChunkLoadError → "Application error: a client-side exception has occurred".
 * Staff hit this every deploy and have to know to hard-refresh.
 *
 * This listens for that specific failure and reloads once. The sessionStorage
 * flag prevents a reload loop if something else is genuinely broken — a second
 * failure falls through to the normal error screen.
 */

const FLAG = 'aayam:stale-build-reloaded';

function isStaleBuildError(message: string): boolean {
    return (
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk') ||
        message.includes('Loading CSS chunk') ||
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('error loading dynamically imported module')
    );
}

function recover(message: string): boolean {
    if (!isStaleBuildError(message)) return false;

    try {
        if (sessionStorage.getItem(FLAG)) return false; // already tried once
        sessionStorage.setItem(FLAG, '1');
    } catch {
        return false; // storage blocked — don't risk a reload loop
    }

    // Cache-bust so the browser fetches a fresh document, not its cached copy.
    window.location.reload();
    return true;
}

export function StaleBuildReloader() {
    useEffect(() => {
        // Clear the guard once a page has loaded successfully.
        const settle = window.setTimeout(() => {
            try {
                sessionStorage.removeItem(FLAG);
            } catch {
                /* ignore */
            }
        }, 10_000);

        const onError = (e: ErrorEvent) => {
            if (recover(e.message || String(e.error?.message || ''))) {
                e.preventDefault();
            }
        };

        const onRejection = (e: PromiseRejectionEvent) => {
            const reason = e.reason;
            const msg =
                typeof reason === 'string' ? reason : String(reason?.message || reason?.name || '');
            if (recover(msg)) {
                e.preventDefault();
            }
        };

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);

        return () => {
            window.clearTimeout(settle);
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    }, []);

    return null;
}
