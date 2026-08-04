// lib/query-failure.ts — make a failed database query impossible to miss.
//
// THE PROBLEM THIS SOLVES
// 92 call sites in this app do some version of:
//
//     const { data } = await supabase.from('jobs').select(...);
//     setJobs(data || []);
//
// When that query fails, `data` is null, the page renders its empty state, and
// nobody is told anything. A failed query and an empty table produce a
// pixel-identical screen. That is how the 2026-07-06 phantom-column bug and the
// 2026-08-01 emptied-checklists fault both stayed invisible for days.
//
// Converting 92 call sites by hand is a lot of edits against a lot of different
// render structures, and each one is a chance to break a working page. So the
// failure is caught one level lower instead: the Supabase client is built with a
// custom `fetch`, and anything that comes back as a PostgREST error lands here —
// whether or not the calling code bothered to destructure `error`.
//
// Two things then happen, and both matter:
//   1. The user is told, once, with a toast. They stop trusting an empty screen.
//   2. It is written to page_errors, so the 3:45 AM audit reports it and the
//      problem reaches someone even if the staff member shrugs and moves on.
//
// This is a safety net, not a substitute for handling errors properly. Pages
// that show a real <LoadError/> are still better, because a toast over a blank
// list is less clear than a blank list that explains itself. But the net means
// no query in the app can fail in total silence, which is the property that
// actually matters from today.

import { toast } from '@/lib/toast';

/** Failures that are normal operation and must not be reported. */
function isExpected(status: number, body: string): boolean {
    // .single() / .maybeSingle() with no matching row. Routine.
    if (body.includes('PGRST116')) return true;
    // Not signed in yet, or the session is being refreshed. The auth layer
    // handles this; surfacing it would fire on every cold load.
    if (status === 401) return true;
    // Range Not Satisfiable — an empty page of a paginated result.
    if (status === 416) return true;
    return false;
}

/**
 * Pull the table or function name out of a PostgREST URL, for a message a
 * human can act on. `/rest/v1/jobs?select=...` -> `jobs`.
 */
function resourceFromUrl(url: string): string {
    try {
        const p = new URL(url, 'http://x').pathname;
        const m = p.match(/\/rest\/v1\/(?:rpc\/)?([^/?]+)/);
        return m ? m[1] : 'data';
    } catch {
        return 'data';
    }
}

// De-duplication. A page with six queries against a dropped column would
// otherwise fire six identical toasts, and a polling widget would fire one
// every few seconds until the tab is closed. Both would train people to dismiss
// the toast without reading it, which is worse than not showing one.
const recent = new Map<string, number>();
const DEDUPE_MS = 30_000;
let reportedThisSession = 0;
const SESSION_CAP = 20;

function shouldReport(key: string): boolean {
    if (reportedThisSession >= SESSION_CAP) return false;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_MS) return false;
    recent.set(key, now);
    if (recent.size > 100) {
        // Array.from rather than iterating the Map directly: this project's
        // tsconfig target predates downlevelIteration for Map entries.
        for (const [k, t] of Array.from(recent.entries())) {
            if (now - t > DEDUPE_MS) recent.delete(k);
        }
    }
    reportedThisSession++;
    return true;
}

/**
 * Record a failed query. Never throws — a failure to report a failure must not
 * become a second, louder failure on top of the first.
 */
export function reportQueryFailure(url: string, status: number, body: string): void {
    try {
        if (typeof window === 'undefined') return;
        if (isExpected(status, body)) return;

        const resource = resourceFromUrl(url);
        let message = body.slice(0, 300);
        try {
            const parsed = JSON.parse(body);
            message = [parsed.message, parsed.details, parsed.hint].filter(Boolean).join(' — ') || message;
        } catch {
            // Body was not JSON — the raw text is still the best thing we have.
        }

        // Keyed on resource + message, not the full URL: the same broken column
        // queried with ten different filters is one problem, not ten.
        if (!shouldReport(`${resource}::${message}`)) return;

        toast.error(`Couldn't load ${resource} — the page may be incomplete`);

        // Written to page_errors so /api/health reports it at 3:45 AM. Without
        // this the fault dies with the browser tab, which is exactly how the
        // previous incidents escaped notice.
        void fetch('/api/errors/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Query failed (${status}) on ${resource}: ${message}`,
                path: window.location.pathname,
                source: 'query',
                component: url.slice(0, 500),
            }),
            keepalive: true,
        }).catch(() => { /* offline, or the reporter itself is down */ });
    } catch {
        // See above.
    }
}

/**
 * A `fetch` that watches PostgREST responses on the way past.
 *
 * Deliberately transparent: it returns the original response untouched, so
 * supabase-js behaves exactly as before and no calling code changes meaning.
 * It only reads a clone of the body, and only when the status is already a
 * failure — a successful query pays nothing but one integer comparison.
 */
export function auditedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return fetch(input, init).then((response) => {
        try {
            if (!response.ok) {
                const url = typeof input === 'string' ? input
                    : input instanceof URL ? input.toString()
                        : (input as Request).url;
                if (url.includes('/rest/v1/')) {
                    response.clone().text()
                        .then(body => reportQueryFailure(url, response.status, body))
                        .catch(() => { /* body already consumed or unreadable */ });
                }
            }
        } catch {
            // Never let instrumentation break the request itself.
        }
        return response;
    });
}
