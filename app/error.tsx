'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // A tab left open across a deploy fails on chunks that no longer exist.
    // Reload once rather than showing the user a dead end. The guard stops a
    // reload loop if the error is something genuinely broken.
    const staleBuild = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module/i
        .test(error.message || '');

    useEffect(() => {
        console.error(error);
        if (!staleBuild) return;
        try {
            if (sessionStorage.getItem('aayam:stale-build-reloaded')) return;
            sessionStorage.setItem('aayam:stale-build-reloaded', '1');
        } catch {
            return;
        }
        window.location.reload();
    }, [error, staleBuild]);

    if (staleBuild) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="text-center text-sm text-gray-600">Updating to the latest version…</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="text-center">
                <h2 className="text-page-title text-gray-900 mb-4">Something went wrong!</h2>
                <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 max-w-md mx-auto text-sm">
                    {error.message || 'Unknown application error'}
                </div>
                <button
                    onClick={
                        // Attempt to recover by trying to re-render the segment
                        () => reset()
                    }
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
