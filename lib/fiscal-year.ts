/**
 * Financial-year helper. Pure date maths, no database, so it works anywhere
 * (server pages, client pages, reports). Start month comes from Finance Settings
 * (4 = April for India). All dates are plain 'YYYY-MM-DD' strings.
 *
 * NEW in Step 1.9. Old screens still do their own April maths and are switched
 * to this helper one by one when each is rebuilt in later steps.
 */

export const INDIA_FY_START_MONTH = 4;

export interface DateRange { start: string; end: string }

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate(); // m is 1-12

/** Calendar year in which the financial year containing `today` started. */
export function fiscalStartYear(today: Date = new Date(), startMonth = INDIA_FY_START_MONTH): number {
    const m = today.getMonth() + 1;
    return m >= startMonth ? today.getFullYear() : today.getFullYear() - 1;
}

/** Full range of the financial year that begins in `startYear`. */
export function fiscalYearRangeFor(startYear: number, startMonth = INDIA_FY_START_MONTH): DateRange {
    const endMonth = startMonth === 1 ? 12 : startMonth - 1;
    const endYear = startMonth === 1 ? startYear : startYear + 1;
    return { start: iso(startYear, startMonth, 1), end: iso(endYear, endMonth, lastDay(endYear, endMonth)) };
}

/** "This financial year" for a given day. */
export function fiscalYearRange(today: Date = new Date(), startMonth = INDIA_FY_START_MONTH): DateRange {
    return fiscalYearRangeFor(fiscalStartYear(today, startMonth), startMonth);
}

/** "Last financial year" for a given day. */
export function previousFiscalYearRange(today: Date = new Date(), startMonth = INDIA_FY_START_MONTH): DateRange {
    return fiscalYearRangeFor(fiscalStartYear(today, startMonth) - 1, startMonth);
}

/** First day of the financial year containing `today`, e.g. '2026-04-01'. */
export function fiscalYearStart(today: Date = new Date(), startMonth = INDIA_FY_START_MONTH): string {
    return fiscalYearRange(today, startMonth).start;
}

/** Label like '2026-27' (or '2026' when the year starts in January). */
export function fiscalYearLabel(startYear: number, startMonth = INDIA_FY_START_MONTH): string {
    return startMonth === 1 ? String(startYear) : `${startYear}-${String(startYear + 1).slice(2)}`;
}
