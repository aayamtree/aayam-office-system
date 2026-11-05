/**
 * Pure helpers for reading a bank statement (checklist 4.1). No database.
 * Fixes the Puter bug where "1.234" was read as 1234: here a dot is ALWAYS the decimal point
 * (Indian statements write 1,234.00) and a comma is ALWAYS a thousands mark.
 */

export type DateStyle = 'dmy' | 'mdy';

/** "1,23,456.78", "(500.00)", "500 Cr", "Rs. 1,000", "1.234" -> number | null */
export function parseAmount(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    let s = String(raw).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/\bdr\.?$/i.test(s)) { neg = true; s = s.replace(/\bdr\.?$/i, ''); }
    s = s.replace(/\bcr\.?$/i, '');
    s = s.replace(/(rs\.?|inr|₹)/gi, '').replace(/[\s,]/g, '');
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    if (s.startsWith('+')) s = s.slice(1);
    if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return neg ? -n : n;
}

const pad = (n: number) => String(n).padStart(2, '0');
const validYmd = (y: number, m: number, d: number) => {
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

/** A cell (text, Date, or Excel serial number) -> 'YYYY-MM-DD' | null */
export function parseDate(raw: unknown, style: DateStyle = 'dmy'): string | null {
    if (raw === null || raw === undefined || raw === '') return null;
    if (raw instanceof Date) {
        if (Number.isNaN(raw.getTime())) return null;
        return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`;
    }
    if (typeof raw === 'number') {
        if (raw < 20000 || raw > 80000) return null; // not an Excel date serial
        const d = new Date(Math.round((raw - 25569) * 86400000));
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    const s = String(raw).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) { const [y, mo, d] = [+m[1], +m[2], +m[3]]; return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null; }
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
        let a = +m[1], b = +m[2]; let y = +m[3]; if (y < 100) y += 2000;
        const [d, mo] = style === 'dmy' ? [a, b] : [b, a];
        return validYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
    m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]*(\d{2,4})/);
    if (m) {
        const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].toLowerCase()) + 1;
        let y = +m[3]; if (y < 100) y += 2000;
        return mo && validYmd(y, mo, +m[1]) ? `${y}-${pad(mo)}-${pad(+m[1])}` : null;
    }
    return null;
}

/** Split pasted text (tab or comma, with "quoted, fields") into rows of cells. */
export function parseText(text: string): string[][] {
    const rows: string[][] = [];
    for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
        if (!line.trim()) continue;
        const delim = line.includes('\t') ? '\t' : ',';
        const cells: string[] = []; let cur = ''; let q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
            else if (ch === delim && !q) { cells.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        cells.push(cur.trim());
        rows.push(cells);
    }
    return rows;
}

export interface Mapping { date: number; desc: number; ref: number; debit: number; credit: number; amount: number; invert: boolean; style: DateStyle; hasHeader: boolean }
export interface ParsedLine { row: number; date: string | null; type: 'inflow' | 'outflow' | null; amount: number; description: string; reference: string; error?: string }

/** Turn raw rows + a column mapping into statement lines. Use -1 for "no such column". */
export function mapRows(rows: (string | number | Date | null)[][], m: Mapping): ParsedLine[] {
    const out: ParsedLine[] = [];
    rows.forEach((r, i) => {
        if (m.hasHeader && i === 0) return;
        const get = (c: number) => (c >= 0 ? r[c] : undefined);
        const date = parseDate(get(m.date), m.style);
        const desc = String(get(m.desc) ?? '').trim();
        const ref = String(get(m.ref) ?? '').trim();
        let type: 'inflow' | 'outflow' | null = null; let amt = 0;
        if (m.amount >= 0) {
            const a = parseAmount(get(m.amount));
            if (a !== null && a !== 0) { type = (a > 0) !== m.invert ? 'inflow' : 'outflow'; amt = Math.abs(a); }
        } else {
            const d = parseAmount(get(m.debit)) || 0; const c = parseAmount(get(m.credit)) || 0;
            if (d > 0 && !c) { type = m.invert ? 'inflow' : 'outflow'; amt = d; }
            else if (c > 0 && !d) { type = m.invert ? 'outflow' : 'inflow'; amt = c; }
        }
        const blank = !date && !desc && !type;
        if (blank) return;
        out.push({ row: i + 1, date, type, amount: Math.round(amt * 100) / 100, description: desc, reference: ref,
            error: !date ? 'No valid date' : !type ? 'No amount' : undefined });
    });
    return out;
}

/** Fingerprint used to skip a line that is already in the books. */
export function lineKey(accountId: string, date: string, type: string, amount: number, description: string, reference: string): string {
    return [accountId, date, type, amount.toFixed(2), description.toLowerCase().replace(/\s+/g, ' ').trim(), (reference || '').trim().toLowerCase()].join('|');
}

/** First two words of a description, for "suggested from history". */
export function firstTwoWords(desc: string | null | undefined): string {
    return (desc || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
}
