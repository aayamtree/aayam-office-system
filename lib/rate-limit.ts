/**
 * Lightweight in-memory rate limiter for API routes.
 *
 * WHY: several routes call paid third-party APIs (Anthropic for label/sheet
 * scanning, Telegram for notifications). Without a cap, one stuck loop in the
 * browser — or one staff member holding down a button — can run up a real bill
 * or get the Telegram bot throttled. This is the cheap 80% fix.
 *
 * LIMITS OF THIS APPROACH (be honest about them):
 *  - Counters live in the memory of a single serverless instance. Vercel may
 *    run several instances, so the real ceiling is roughly (limit x instances).
 *    That still turns "unlimited" into "bounded", which is the point.
 *  - Memory resets on cold start. Again: bounded, not perfect.
 *  - If we ever need hard global limits, move the counter to Postgres or
 *    Upstash Redis; the call signature below stays the same.
 *
 * Usage inside a route handler:
 *
 *   const limited = rateLimit(request, { key: 'ai-scan', limit: 10, windowMs: 60_000 });
 *   if (limited) return limited;
 */

import { NextResponse } from 'next/server';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Stop the map growing forever on a long-lived instance.
function sweep(now: number) {
    if (buckets.size < 5000) return;
    buckets.forEach((b, k) => {
        if (b.resetAt <= now) buckets.delete(k);
    });
}

/** Best-effort caller identity: Vercel's forwarded client IP, else the socket IP. */
function callerId(request: Request): string {
    const h = request.headers;
    const fwd = h.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return h.get('x-real-ip') || 'unknown';
}

export interface RateLimitOptions {
    /** Namespace so different routes don't share a bucket. */
    key: string;
    /** Max requests allowed per caller per window. */
    limit: number;
    /** Window length in milliseconds. */
    windowMs: number;
}

/**
 * Returns a 429 NextResponse if the caller is over the limit, otherwise null.
 * Null means "carry on".
 */
export function rateLimit(
    request: Request,
    { key, limit, windowMs }: RateLimitOptions
): NextResponse | null {
    const now = Date.now();
    sweep(now);

    const id = `${key}:${callerId(request)}`;
    const bucket = buckets.get(id);

    if (!bucket || bucket.resetAt <= now) {
        buckets.set(id, { count: 1, resetAt: now + windowMs });
        return null;
    }

    bucket.count += 1;

    if (bucket.count > limit) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        return NextResponse.json(
            { error: 'Too many requests. Please wait a moment and try again.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(retryAfter),
                    'X-RateLimit-Limit': String(limit),
                    'X-RateLimit-Remaining': '0',
                },
            }
        );
    }

    return null;
}
