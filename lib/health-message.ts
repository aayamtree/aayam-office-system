// lib/health-message.ts — turns the nightly health audit into a message a
// non-programmer can act on.
//
// WHY THIS FILE EXISTS
// The audit in lib/health-checks.ts is written for whoever has to FIX the
// problem, so it speaks in columns, RPCs and ledger postings. The person who
// actually reads the 9 AM Telegram is Satish, who runs a printing business and
// is not a developer. On 2026-08-05 the alert opened with "99 column(s) the app
// selects no longer exist" — factually correct, and completely unactionable to
// the only human receiving it.
//
// So this file does one job: for every technical check, say what it means for
// the BUSINESS, and give the whole app one verdict at the top. The technical
// detail is not deleted — it still lives in /api/health and on the System Health
// page, one tap away via the button on the message. It just stops being the
// first thing a business owner has to read at 9 in the morning.
//
// RULE FOR ANYONE EDITING THIS FILE
// A line belongs here only if it answers "so what happens to my business?".
// Column names, table names and function names do not belong in this message.

import { escapeHtml } from './telegram-groups';
import type { Finding } from './health-checks';

/* ------------------------------------------------------------------ */
/* Plain-language dictionary                                           */
/* ------------------------------------------------------------------ */

type Plain = {
    /** What broke, in business terms. No table or column names. */
    title: string;
    /** What it costs you if it stays broken. One sentence. */
    effect: (n: number, money: number) => string;
};

/**
 * One entry per check id in lib/health-checks.ts + lib/activity-expectations.ts.
 * `critical` and `warning` get separate wording where the consequence differs —
 * "the save is failing" and "the save cannot be verified" are not the same news.
 */
const DICTIONARY: Record<string, { critical?: Plain; warning?: Plain }> = {
    'ledger-posting': {
        critical: {
            title: 'Money is not reaching your accounts',
            effect: (_n, money) =>
                money > 0
                    ? `About ${money2str(money)} of payments in the last 30 days never reached your Profit & Loss. Any profit or expense figure you look at today is wrong by roughly that much.`
                    : 'Some payments are recorded but never reach your Profit & Loss, so profit and expense figures are understated.',
        },
        warning: {
            title: 'Account books could not be verified',
            effect: () => 'The check that confirms money reaches your books could not run, so today it is unknown whether your P&L is complete.',
        },
    },
    'expected-activity': {
        critical: {
            title: 'Work is happening but nothing is being recorded',
            effect: () => 'Jobs are being delivered, but no matching money entries are showing up. Your reports will show less business than you actually did.',
        },
        warning: {
            title: 'Could not confirm that work is being recorded',
            effect: () => 'This check did not run today, so it is unknown whether entries are being made.',
        },
    },
    'write-drift': {
        critical: {
            title: 'Some Save buttons do not actually save',
            effect: (n) =>
                `Staff fill a form, click Save, the screen says it worked — and nothing is stored. ${n} field${n === 1 ? '' : 's'} affected. This is how Create Dispatch was dead for months without anyone noticing.`,
        },
        warning: {
            title: 'Some Save buttons cannot be checked automatically',
            effect: (n) => `${n} form${n === 1 ? '' : 's'} could silently stop saving without any alert. Nothing is broken today — it just would not be caught if it broke.`,
        },
    },
    'schema-drift': {
        critical: {
            title: 'Some screens may show blank instead of your data',
            effect: (n) =>
                `The app is asking for ${n} piece${n === 1 ? '' : 's'} of information that ${n === 1 ? 'is' : 'are'} no longer stored. Those screens can come up empty rather than showing an error, so it looks like you have no data when you do.`,
        },
        warning: {
            title: 'Screen data could not be verified',
            effect: () => 'The check that confirms every screen can load its data did not run today.',
        },
    },
    'rpc-drift': {
        critical: {
            title: 'Some reports cannot be calculated',
            effect: (n) => `${n} calculation${n === 1 ? '' : 's'} the reports depend on is missing, so those report pages will show zero or fail to load.`,
        },
        warning: {
            title: 'Report calculations could not be verified',
            effect: () => 'The check on report calculations did not run today.',
        },
    },
    'config-tables': {
        critical: {
            title: 'A setup list has gone empty',
            effect: (n) =>
                `${n} setting list${n === 1 ? ' is' : 's are'} empty — dropdowns, stage boards or QC checklists that depend on them will come up blank for staff.`,
        },
        warning: {
            title: 'Setup lists could not be checked',
            effect: () => 'The check on your settings lists did not run today.',
        },
    },
    'data-loss': {
        critical: {
            title: 'Data that existed yesterday is gone today',
            effect: (n) => `${n} table${n === 1 ? '' : 's'} lost records overnight. This one is worth checking before anything else.`,
        },
        warning: {
            title: 'Could not compare today against yesterday',
            effect: () => 'The check that spots deleted data did not run, so a loss today would not be noticed.',
        },
    },
    'cron-freshness': {
        critical: {
            title: 'An automatic background task stopped running',
            effect: (n) =>
                `${n} scheduled task${n === 1 ? ' is' : 's are'} not running. These do things you never see — backups, Google Drive access, daily reminders — and they fail quietly.`,
        },
        warning: {
            title: 'Background tasks could not be verified',
            effect: () => 'The record of scheduled tasks could not be read, so it is unknown whether they ran.',
        },
    },
};

/** Anything the audit produces that this file has no wording for yet. */
const FALLBACK: Plain = {
    title: 'Something needs a technical look',
    effect: () => 'This one has no plain-English explanation yet — tap the button below or send this message to Claude.',
};

/* ------------------------------------------------------------------ */
/* Number helpers                                                      */
/* ------------------------------------------------------------------ */

/** Leading count out of a summary like "149 column(s) …". 0 if there is none. */
function leadingCount(summary: string): number {
    const m = summary.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

/** Rupee figure out of a summary like "… ₹8,53,287 is missing …". */
function rupees(summary: string): number {
    const m = summary.match(/₹\s?([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
}

/** Indian money the way Satish reads it: lakh and crore, not 8 digits. */
function money2str(n: number): string {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} crore`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} lakh`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function todayInIndia(): string {
    return new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long',
        timeZone: 'Asia/Kolkata',
    });
}

/* ------------------------------------------------------------------ */
/* Message builder                                                     */
/* ------------------------------------------------------------------ */

type Item = { severity: 'critical' | 'warning'; title: string; effect: string; rank: number };

/**
 * Reading order, worst business consequence first — NOT the order the checks
 * happen to run in. Money that is missing from the books outranks a column name
 * that changed, however many columns there are. Anything unlisted sorts last.
 */
const RANK: Record<string, number> = {
    'data-loss': 0,          // records gone — nothing else matters until this is answered
    'ledger-posting': 1,     // your P&L is wrong by a number you can name
    'expected-activity': 2,  // work is happening and going unrecorded
    'write-drift': 3,        // staff are losing work they think they saved
    'page-crashes': 4,       // staff blocked, but loudly — they will tell you
    'schema-drift': 5,       // screens look empty
    'config-tables': 6,
    'rpc-drift': 7,
    'cron-freshness': 8,     // invisible, but nothing in front of a customer
    'telegram': 9,
};
const rankOf = (check: string) => RANK[check] ?? 50;

export type HealthMessageInput = {
    findings?: Finding[];
    pageErrors?: { distinct?: number; affectedPages?: string[] } | null;
    telegram?: { failed?: number } | null;
    config?: Record<string, boolean>;
    database?: { responseTime?: string } | null;
    tables?: Record<string, { count: number }>;
};

/**
 * Collapse the raw findings into one line per PROBLEM, not one per finding.
 * Three separate ledger findings are one problem to a business owner: money is
 * not reaching the books. Listing them three times is how a message stops being
 * read.
 */
function toItems(payload: HealthMessageInput): Item[] {
    const findings = payload.findings || [];
    const items: Item[] = [];

    // Group by check id + severity, keeping the largest count and total money.
    const groups = new Map<string, { check: string; severity: 'critical' | 'warning'; count: number; money: number }>();
    for (const f of findings) {
        const key = `${f.check}::${f.severity}`;
        const g = groups.get(key) || { check: f.check, severity: f.severity, count: 0, money: 0 };
        g.count = Math.max(g.count, leadingCount(f.summary));
        g.money += rupees(f.summary);
        groups.set(key, g);
    }

    for (const g of Array.from(groups.values())) {
        const plain = DICTIONARY[g.check]?.[g.severity] || FALLBACK;
        items.push({
            severity: g.severity,
            title: plain.title,
            effect: plain.effect(g.count, g.money),
            rank: rankOf(g.check),
        });
    }

    // Not a "finding" — page crashes come from the error boundary, not the audit.
    const crashes = payload.pageErrors?.distinct || 0;
    if (crashes > 0) {
        const where = (payload.pageErrors?.affectedPages || []).slice(0, 3).join(', ');
        items.push({
            severity: 'critical',
            title: `${crashes} screen${crashes === 1 ? '' : 's'} crashed for staff in the last 24 hours`,
            effect: where
                ? `Someone opened a page and got an error screen instead of their work. Affected: ${where}.`
                : 'Someone opened a page and got an error screen instead of their work.',
            rank: rankOf('page-crashes'),
        });
    }

    if (!payload.config?.telegramBotToken) {
        items.push({
            severity: 'critical',
            title: 'Telegram alerts are switched off',
            effect: 'The app cannot send any Telegram message right now — including this one tomorrow.',
            rank: rankOf('telegram'),
        });
    }
    if (payload.config && payload.config.supabaseServiceRole === false) {
        items.push({
            severity: 'critical',
            title: 'The app is missing a key it needs for background work',
            effect: 'Automatic tasks and admin-only reports will not work until it is set.',
            rank: rankOf('cron-freshness'),
        });
    }

    const failedAlerts = payload.telegram?.failed || 0;
    if (failedAlerts > 0) {
        items.push({
            severity: 'warning',
            title: `${failedAlerts} Telegram alert${failedAlerts === 1 ? '' : 's'} did not reach the team`,
            effect: 'Someone was supposed to be told about a job and was not.',
            rank: rankOf('telegram'),
        });
    }

    // Worst news first — a business owner reads the top of a message, not all of it.
    return items.sort((a, b) =>
        a.severity !== b.severity ? (a.severity === 'critical' ? -1 : 1) : a.rank - b.rank);
}

/**
 * The whole message. Deliberately short: verdict, what is broken and what that
 * costs, what is fine, one instruction. No column names, no table names, no
 * check ids — those are on the System Health page behind the button.
 */
export function buildHealthMessage(payload: HealthMessageInput): string {
    const items = toItems(payload);
    const bad = items.filter(i => i.severity === 'critical');
    const watch = items.filter(i => i.severity === 'warning');

    const light = bad.length ? '🔴' : watch.length ? '🟠' : '🟢';
    const verdict = bad.length
        ? 'Needs your attention'
        : watch.length
            ? 'Working, with a few things to watch'
            : 'All good';

    const lines: string[] = [
        `${light} <b>Aayam System — Daily Check</b>`,
        escapeHtml(todayInIndia()),
        '',
        `<b>${escapeHtml(verdict)}</b>`,
    ];

    // One honest sentence about scale, so the verdict is not just a colour.
    if (bad.length || watch.length) {
        const parts: string[] = [];
        if (bad.length) parts.push(`${bad.length} thing${bad.length === 1 ? '' : 's'} to fix`);
        if (watch.length) parts.push(`${watch.length} to keep an eye on`);
        lines.push(escapeHtml(parts.join(', ') + '.'));
    } else {
        lines.push('Nothing broken. Money, saves, screens and background tasks all checked out.');
    }

    if (bad.length) {
        lines.push('', '<b>🔴 Fix these</b>');
        for (const i of bad) {
            lines.push('', `<b>${escapeHtml(i.title)}</b>`, escapeHtml(i.effect));
        }
    }

    if (watch.length) {
        lines.push('', '<b>🟠 Keep an eye on</b>');
        for (const i of watch) {
            lines.push('', `<b>${escapeHtml(i.title)}</b>`, escapeHtml(i.effect));
        }
    }

    // Saying what IS working is not padding. Without it "3 things to fix" reads
    // like the app is falling apart, when the app is up and holding your data.
    const fine: string[] = ['App is online'];
    const db = payload.database?.responseTime;
    if (db) fine.push(`database responding in ${db}`);
    if (!payload.pageErrors?.distinct) fine.push('no screen crashed today');
    if (!(payload.findings || []).some(f => f.check === 'data-loss' && f.severity === 'critical')) {
        fine.push('nothing was deleted');
    }
    const jobs = payload.tables?.jobs?.count;
    const clients = payload.tables?.clients?.count;
    if (jobs != null && clients != null) fine.push(`${jobs} jobs and ${clients} clients safe`);

    lines.push('', '<b>🟢 Working fine</b>', escapeHtml(fine.join(' · ') + '.'));

    if (bad.length || watch.length) {
        lines.push(
            '',
            '<i>You do not need to understand the technical side. Forward this to Claude and say "fix the red items", or tap below for the full list.</i>',
        );
    }

    return lines.join('\n');
}
