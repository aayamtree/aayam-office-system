'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong!</h2>
                <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 max-w-md mx-auto text-sm">
                    {error.message || 'Unknown application error'}
                </div>
                <button
                    onClick={
                        // Attempt to recover by trying to re-render the segment
                        () => reset()
                    }
                    className="px-4 py-2 bg-[rgba(0,0,255,0.1)] text-white rounded-lg hover:bg-[rgba(0,0,255,0.1)]"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
