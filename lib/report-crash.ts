'use client';

/**
 * reportCrash — send a client-side crash to /api/errors/report.
 *
 * WHY: before this, a crashed page called console.error and that was the end of
 * it. The log lived in one browser tab and vanished with it, so the daily health
 * audit had nothing to audit and a broken page could only be found by a human
 * noticing it. Writing crashes down is what makes them auditable.
 *
 * Rules this follows, all learned the hard way:
 *  - Never throw. This runs inside an error handler; a failure here would stack
 *    a second crash on top of the first one.
 *  - Never block rendering. Fire and forget, keepalive so it still lands if the
 *    user immediately navigates away or reloads.
 *  - De-duplicate. A crash inside a render loop can fire hundreds of times a
 *    second; the same message on the same path is reported once per session.
 */

const reported = new Set<string>();

export interface CrashReport {
    path: string;
    message: string;
    stack?: string;
    component?: string;
    source?: 'boundary' | 'route-error';
}

export function reportCrash(report: CrashReport): void {
    try {
        if (typeof window === 'undefined') return;

        const fingerprint = `${report.path}::${report.message}`;
        if (reported.has(fingerprint)) return;
        reported.add(fingerprint);

        void fetch('/api/errors/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report),
            keepalive: true,
        }).catch(() => {
            // Offline, or the endpoint is down. Nothing useful to do — the
            // console.error at the call site is still there for a live debug.
        });
    } catch {
        // Deliberately silent, see above.
    }
}

export default reportCrash;
