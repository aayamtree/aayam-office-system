/**
 * Pure helpers for the Trial invoice list (checklist 2.1): date presets, paise maths,
 * Indian money format, CSV. No database, so they can be tested on their own.
 * Money is added up in integer paise to avoid floating-point drift.
 */
import { fiscalYearRange, previousFiscalYearRange } from '@/lib/fiscal-year';

export type DatePreset =
    | 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter'
    | 'this_fy' | 'last_fy' | 'custom';

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
    all: 'All dates',
    this_month: 'This month',
    last_month: 'Last month',
    this_quarter: 'This quarter',
    last_quarter: 'Last quarter',
    this_fy: 'This financial year',
    last_fy: 'Last financial year',
    custom: 'Custom range',
};

const pad2 = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export interface Range { from: string; to: string }

/** Date range for a preset, as 'YYYY-MM-DD' strings. null = no date filter. Quarters follow the financial year. */
export function presetRange(
    preset: DatePreset, today: Date, fiscalStartMonth = 4, customFrom = '', customTo = '',
): Range | null {
    const y = today.getFullYear(), m = today.getMonth();
    const monthsIn = ((m - (fiscalStartMonth - 1)) + 12) % 12;
    const qStart = new Date(y, m - (monthsIn - Math.floor(monthsIn / 3) * 3), 1);
    switch (preset) {
        case 'this_month': return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
        case 'last_month': return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
        case 'this_quarter': return { from: ymd(qStart), to: ymd(new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0)) };
        case 'last_quarter': {
            const s = new Date(qStart.getFullYear(), qStart.getMonth() - 3, 1);
            return { from: ymd(s), to: ymd(new Date(s.getFullYear(), s.getMonth() + 3, 0)) };
        }
        case 'this_fy': { const r = fiscalYearRange(today, fiscalStartMonth); return { from: r.start, to: r.end }; }
        case 'last_fy': { const r = previousFiscalYearRange(today, fiscalStartMonth); return { from: r.start, to: r.end }; }
        case 'custom': return { from: customFrom || '0000-01-01', to: customTo || '9999-12-31' };
        default: return null;
    }
}

/** Rupees (number or string) to whole paise. */
export const paise = (x: unknown): number => Math.round((Number(x) || 0) * 100);

/** Paise to Indian format with 2 decimals, e.g. 48915417 -> ₹4,89,154.17 */
export const formatInr = (p: number): string =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p / 100);

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** CSV text (with a BOM so Excel opens it correctly). */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
    return '﻿' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}
