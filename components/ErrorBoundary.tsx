'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * GlobalErrorBoundary
 * 
 * Wraps any subtree and catches all runtime errors (including null crashes,
 * type errors, and missing field access). Instead of a blank white page,
 * it shows a clean recovery UI with a "Try Again" button.
 * 
 * Usage:
 *   <GlobalErrorBoundary>
 *     <YourComponent />
 *   </GlobalErrorBoundary>
 */
export class GlobalErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[GlobalErrorBoundary] Caught error:', error, info);

        // Chunk loading error = new Vercel deploy went live while user had app open.
        // Auto-reload silently — user just sees fresh page, no scary screen.
        const isChunkError =
            error.name === 'ChunkLoadError' ||
            error.message?.includes('Loading chunk') ||
            error.message?.includes('Failed to fetch dynamically imported module') ||
            error.message?.includes('Importing a module script failed');

        if (isChunkError) {
            window.location.reload();
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            const isChunkError =
                this.state.error?.name === 'ChunkLoadError' ||
                this.state.error?.message?.includes('Loading chunk') ||
                this.state.error?.message?.includes('Failed to fetch dynamically imported module');

            // Chunk error — show "updating" screen briefly before auto-reload kicks in
            if (isChunkError) {
                return (
                    <div className="min-h-[60vh] flex items-center justify-center p-8">
                        <div className="bg-white border border-blue-100 rounded-lg shadow-sm max-w-md w-full p-8 text-center">
                            <div className="flex items-center justify-center w-14 h-14 bg-blue-50 rounded-full mx-auto mb-4">
                                <RefreshCw size={28} className="text-blue-500 animate-spin" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 mb-2">
                                New version available
                            </h2>
                            <p className="text-sm text-gray-500">
                                Reloading to get the latest update…
                            </p>
                        </div>
                    </div>
                );
            }

            return (
                <div className="min-h-[60vh] flex items-center justify-center p-8">
                    <div className="bg-white border border-red-100 rounded-lg shadow-sm max-w-md w-full p-8 text-center">
                        <div className="flex items-center justify-center w-14 h-14 bg-red-50 rounded-full mx-auto mb-4">
                            <AlertTriangle size={28} className="text-red-500" />
                        </div>

                        <h2 className="text-lg font-bold text-gray-900 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-gray-500 mb-1">
                            An unexpected error occurred on this page.
                        </p>
                        {this.state.error?.message && (
                            <p className="text-xs text-red-400 bg-red-50 rounded-md px-3 py-2 mt-3 mb-5 font-mono text-left break-all">
                                {this.state.error.message}
                            </p>
                        )}

                        <div className="flex gap-3 justify-center mt-6">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                            >
                                <RefreshCw size={14} />
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
