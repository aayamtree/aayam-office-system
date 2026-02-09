'use client';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-center">
                    <div className="text-red-600 text-5xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Something went wrong!
                    </h2>
                    <p className="text-gray-600 mb-4 text-sm">
                        {error.message || 'An unexpected error occurred'}
                    </p>
                    <button
                        onClick={reset}
                        className="w-full px-4 py-2 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 transition-colors"
                    >
                        Try again
                    </button>
                </div>
            </div>
        </div>
    );
}
