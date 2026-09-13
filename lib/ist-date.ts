// ═══════════════════════════════════════════════════════════════════════════
// TODAY, IN THE OFFICE'S OWN DAY
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ THE BUG THIS FILE EXISTS TO KILL (found 2026-09-13)
//
// Two copies of this were written by hand, both like so:
//
//     new Date(now.getTime() + (5.5 * 60 - now.getTimezoneOffset()) * 60_000)
//
// getTimezoneOffset() is -330 in IST, so that adds 330 - (-330) = 660 minutes.
// ELEVEN hours, not five and a half. On a UTC server it happened to give the
// right answer; in a browser in Rajkot it gave TOMORROW from 6:30pm onwards —
// exactly when a print shop cashes up. The form pre-filled tomorrow's date, the
// server rejected it as "That date is in the future", and the feature was dead
// for five and a half hours every evening.
//
// The offset arithmetic is not worth repeating anywhere. Intl knows the zone,
// including the fact that India has no daylight saving, and 'en-CA' formats as
// YYYY-MM-DD. One function, both sides, no arithmetic.
// ═══════════════════════════════════════════════════════════════════════════

export const OFFICE_TZ = 'Asia/Kolkata';

/** Today in the office's timezone as YYYY-MM-DD, whatever the server's clock. */
export function todayIST(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: OFFICE_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
}

/**
 * Is this a real calendar date in YYYY-MM-DD form?
 *
 * The regex alone is not enough: "2026-13-45" matches it and only fails later,
 * as a raw Postgres driver error in front of whoever typed it.
 */
export function isRealDate(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** The earliest date a hand-entered payment may carry — a year back. */
export function earliestEntryDate(): string {
    const t = todayIST();
    const [y, m, d] = t.split('-').map(Number);
    const back = new Date(Date.UTC(y - 1, m - 1, d));
    return back.toISOString().slice(0, 10);
}
