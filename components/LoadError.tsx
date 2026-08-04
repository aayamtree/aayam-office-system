'use client';

// components/LoadError.tsx — say "this is broken" instead of "there is nothing here".
//
// WHY THIS COMPONENT EXISTS
// The two states below are completely different facts about the business:
//
//   "There are no dispatches today."        -> nothing to do, carry on.
//   "We could not load dispatches."         -> the board is lying to you.
//
// Before this, both rendered the same empty state, because the failing query's
// error went to console.error and the component fell through to "No records".
// A staff member cannot act on a difference they cannot see, and on 2026-08-01
// that indistinguishability is what let an emptied table look like a normal
// quiet screen for an unknown length of time.
//
// Deliberately loud: red, with the real database message and a retry. The
// instinct to "keep the UI clean" is exactly what produced the problem — a
// person needs to know at a glance that what they are looking at is not the
// truth, and that they should not make a decision from it.

import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface LoadErrorProps {
    /** What failed to load, in the user's words: "dispatches", "this month's payments". */
    what?: string;
    /** The underlying error. Accepts anything a catch block or Supabase hands over. */
    error?: unknown;
    /** Re-run the fetch. Omit if the caller has no way to retry. */
    onRetry?: () => void;
    /** `inline` for a panel inside a page; `block` for a full empty-area replacement. */
    variant?: 'block' | 'inline';
    className?: string;
}

/** Get a readable sentence out of whatever was thrown. */
export function errorMessage(error: unknown): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object') {
        const e = error as Record<string, any>;
        // Supabase/PostgREST shape: message is the headline, details and hint
        // usually contain the part that actually tells you what to fix.
        const parts = [e.message, e.details, e.hint].filter(Boolean);
        if (parts.length) return parts.join(' — ');
        if (e.code) return `Error ${e.code}`;
    }
    return 'Unknown error';
}

export default function LoadError({
    what = 'this data',
    error,
    onRetry,
    variant = 'block',
    className = '',
}: LoadErrorProps) {
    const message = errorMessage(error);

    if (variant === 'inline') {
        return (
            <div
                role="alert"
                className={`flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm ${className}`}
            >
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-red-800">Couldn&apos;t load {what}</p>
                    <p className="mt-0.5 break-words text-xs text-red-600">{message}</p>
                </div>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            role="alert"
            className={`rounded-md border border-red-200 bg-red-50 py-14 text-center ${className}`}
        >
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-400" />
            <h3 className="text-lg font-medium text-red-800">Couldn&apos;t load {what}</h3>
            {/* The raw message is shown on purpose. "Something went wrong" gives
                nobody anything to report; "column jobs.foo does not exist" gets
                the problem fixed in minutes. */}
            <p className="mx-auto mt-1 max-w-xl break-words px-6 text-sm text-red-600">{message}</p>
            <p className="mt-3 text-xs text-red-500">
                This screen is not showing complete information — please don&apos;t rely on it until it loads.
            </p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mx-auto mt-4 flex items-center gap-1.5 rounded-md border border-red-300 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                >
                    <RefreshCw size={14} /> Try again
                </button>
            )}
        </div>
    );
}
