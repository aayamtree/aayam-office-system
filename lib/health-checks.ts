// lib/health-checks.ts — the checks that look at the APPLICATION, not the server.
//
// WHY THIS FILE EXISTS
// Three separate outages, three different weeks, one shape:
//
//   2026-07-06  Several pages selected a column that did not exist. PostgREST
//               returned an error, the caller did `if (error) console.error(...)`
//               and carried on, and the page rendered an empty list.
//   2026-07-31  Sales Reports read job.order_date without fetching it and threw
//               on every load. Finance Reports quietly showed a wrong total.
//   2026-08-01  public.job_checklists was empty. Production Settings showed
//               "No Checklists Found"; dispatch QC silently used a hardcoded
//               fallback instead of the configured checks.
//
// In all three the database was up, the env vars were set, Telegram delivered,
// and /api/health reported healthy. It reported healthy because it was measuring
// the infrastructure, and the infrastructure was fine. The failures were one
// layer up: the app asking the database for something it no longer has, or
// depending on configuration rows that are no longer there.
//
// None of them crashed. That matters, because the crash reporter added on
// 31 July only sees crashes — an empty page writes nothing to page_errors. So
// these checks do not wait for an error to be thrown. They assert, every night,
// that the contract between the code and the database still holds.
//
// WHAT IT DELIBERATELY DOES NOT DO
// It does not open a browser. Nothing here can catch a page that fetches the
// right data and then renders it wrongly. `npm run audit:selects` covers one
// slice of that statically at build time; the rest is still only caught by a
// human opening the page. Saying so plainly is better than implying coverage
// this does not have.

import manifest from './generated/query-manifest.json';

export type Finding = {
    severity: 'critical' | 'warning';
    check: string;
    summary: string;
    detail?: string[];
};

/**
 * Configuration tables — rows a human entered once so the app would work.
 *
 * THE LINE THIS DRAWS, AND WHY IT MATTERS MORE NOW THAN EVER
 * The business started using this app for real on 2026-08-01. On that day 22 of
 * 88 tables were empty, and most of them SHOULD be: dispatches, sales orders,
 * design projects, work logs and the rest fill up as jobs move through cycles
 * that run from one day to three weeks. Reporting those as faults would fire an
 * alert every morning about the system working exactly as expected, and within
 * a week nobody would read the 3:45 AM message at all.
 *
 * So this list contains only tables where empty is ALWAYS wrong, no matter how
 * new the app is. `jobs` being empty on a quiet day is normal and it is not
 * here. `job_stages` being empty means the pipeline has no stages and every
 * board renders blank, and no amount of waiting will fix it — that is here.
 *
 * Verified against the live database on 2026-08-01: none of the 22 empty tables
 * appear below. The check was silent on a legitimately young database, which is
 * the property that makes it trustworthy later.
 *
 * `min` is the smallest count that still means "configured" — 1 almost
 * everywhere, because the question is whether someone emptied the table, not
 * whether they filled it completely.
 *
 * > Adding a table here is a promise that an empty result is ALWAYS a fault,
 * > including on day one. If a table merely *should* fill up over time, leave it
 * > out — fn_row_count_regressions() covers it far better, by comparing the
 * > table against its own history instead of against an opinion.
 */
export const CONFIG_TABLES: { table: string; min: number; why: string }[] = [
    { table: 'job_stages', min: 5, why: 'the job pipeline has no stages — every board renders empty' },
    { table: 'job_types', min: 1, why: 'new jobs cannot be classified' },
    { table: 'priorities', min: 1, why: 'priority pickers are empty' },
    { table: 'product_categories', min: 1, why: 'quotations and jobs cannot be categorised, so item routing breaks' },
    { table: 'job_checklists', min: 1, why: 'production QC falls back to a hardcoded list; configured checks are lost' },
    { table: 'counters', min: 1, why: 'job / quote / invoice numbering has no sequence to draw from' },
    { table: 'chart_of_accounts', min: 10, why: 'journal entries have no accounts to post against' },
    { table: 'expense_categories', min: 1, why: 'expenses cannot be categorised' },
    { table: 'income_categories', min: 1, why: 'receipts cannot be categorised' },
    { table: 'bank_accounts', min: 1, why: 'payments have no account to land in' },
    { table: 'cash_accounts', min: 1, why: 'cash receipts have no account to land in' },
    { table: 'cmyk_accounts', min: 1, why: 'CMYK POS has no account to record money into' },
    { table: 'telegram_groups', min: 1, why: 'stage alerts have nowhere to route' },
    { table: 'machines', min: 1, why: 'print runs cannot be assigned to a machine' },
    { table: 'materials', min: 1, why: 'print runs have no material list' },
    { table: 'sheet_sizes', min: 1, why: 'print runs have no sheet sizes' },
    { table: 'paper_stock', min: 1, why: 'POS and print runs have no paper to draw from' },
    { table: 'profiles', min: 1, why: 'nobody can sign in' },
];

/**
 * Every column the app selects must exist in the database.
 *
 * The manifest is generated from source at build time (scripts/extract-query-manifest.js)
 * and the schema is read live, because those two things drift at different times:
 * code changes only on deploy, the schema changes whenever a migration is run by
 * hand. Comparing a live schema against a checked-in schema snapshot would just
 * move the staleness somewhere else.
 */
export async function checkSchemaDrift(db: any): Promise<Finding[]> {
    const { data, error } = await db.rpc('fn_public_columns');
    if (error) {
        return [{
            severity: 'warning',
            check: 'schema-drift',
            summary: 'Could not read the live schema, so column drift was not checked',
            detail: [error.message],
        }];
    }

    const live = new Map<string, Set<string>>();
    for (const row of data || []) {
        const t = row.table_name;
        if (!live.has(t)) live.set(t, new Set());
        live.get(t)!.add(row.column_name);
    }

    const missingTables: string[] = [];
    const missingColumns: string[] = [];

    for (const [table, spec] of Object.entries(manifest.tables as Record<string, any>)) {
        const cols = live.get(table);
        if (!cols) {
            missingTables.push(`${table} (first used in ${spec.sites?.[0]?.file || 'unknown'})`);
            continue;
        }
        for (const col of spec.columns as string[]) {
            if (!cols.has(col)) {
                missingColumns.push(`${table}.${col} — used in ${spec.sites?.[0]?.file || 'unknown'}`);
            }
        }
    }

    const findings: Finding[] = [];
    if (missingTables.length) {
        findings.push({
            severity: 'critical',
            check: 'schema-drift',
            summary: `${missingTables.length} table(s) the app queries no longer exist`,
            detail: missingTables,
        });
    }
    if (missingColumns.length) {
        findings.push({
            severity: 'critical',
            check: 'schema-drift',
            summary: `${missingColumns.length} column(s) the app selects no longer exist`,
            detail: missingColumns.slice(0, 25),
        });
    }
    return findings;
}

/**
 * Every column the app WRITES must exist — and every unverifiable write is named.
 *
 * THE BUG THIS EXISTS FOR
 * 2026-08-04: Create Dispatch had never once succeeded. 232 jobs, zero rows in
 * `dispatches`. The modal spread its form state into the insert, the form
 * carried a `dispatch_mode` field, `dispatches` had no such column, and
 * PostgREST rejected every row. Months of it. Every audit passed the whole time,
 * because every audit checked what the app READS.
 *
 * A failed write is worse than a failed read and much quieter. A failed read
 * shows an empty list, and eventually somebody says "where did my data go?" A
 * failed write shows a success toast and an empty table, and the only symptom is
 * that a feature nobody is watching closely quietly does nothing forever.
 *
 * TWO CLASSES OF FINDING, AND WHY BOTH ARE REPORTED
 *  - `critical`: the app writes a column that does not exist. That row can never
 *    be saved. This is today's bug, and it is now impossible to keep hidden.
 *  - `warning`: the write spreads an object (`.insert({ ...form })`). The field
 *    names only exist at runtime, so NOTHING can check them — not this, not
 *    TypeScript, not a review. Reporting these as "fine" would be a lie, so they
 *    are reported as "not checkable", with the file and line, so the pattern can
 *    be removed one site at a time.
 */
export async function checkWriteDrift(db: any): Promise<Finding[]> {
    const { data, error } = await db.rpc('fn_public_columns');
    if (error) {
        return [{
            severity: 'warning',
            check: 'write-drift',
            summary: 'Could not read the live schema, so write columns were not checked',
            detail: [error.message],
        }];
    }

    const live = new Map<string, Set<string>>();
    for (const row of data || []) {
        const t = row.table_name;
        if (!live.has(t)) live.set(t, new Set());
        live.get(t)!.add(row.column_name);
    }

    const phantom: string[] = [];
    const unverifiable: string[] = [];

    for (const [table, spec] of Object.entries(manifest.tables as Record<string, any>)) {
        const writes = spec.writes;
        if (!writes) continue;                       // read-only table

        const cols = live.get(table);
        if (!cols) continue;                         // checkSchemaDrift already reports a missing table

        // `writes.columns` is { column: {file,line,verb} } — attribution is per
        // COLUMN, so the alert points at the file that writes THAT column rather
        // than at whichever file happened to be scanned first.
        for (const [col, site] of Object.entries((writes.columns || {}) as Record<string, any>)) {
            if (!cols.has(col)) {
                phantom.push(`${table}.${col} — ${site?.verb || 'written'} at ${site ? `${site.file}:${site.line}` : 'unknown'}`);
            }
        }

        for (const s of (writes.spreads || []) as any[]) {
            unverifiable.push(`${table} — ${s.verb}({ ...object }) at ${s.file}:${s.line}`);
        }
    }

    const findings: Finding[] = [];
    if (phantom.length) {
        findings.push({
            severity: 'critical',
            check: 'write-drift',
            summary: `${phantom.length} column(s) the app writes do not exist — those saves fail every time`,
            detail: phantom.slice(0, 25),
        });
    }
    if (unverifiable.length) {
        findings.push({
            severity: 'warning',
            check: 'write-drift',
            summary: `${unverifiable.length} write(s) spread an object, so their columns cannot be checked by anything`,
            detail: unverifiable.slice(0, 25),
        });
    }
    return findings;
}

/**
 * Money that was recorded but never reached the books.
 *
 * THE BUG THIS EXISTS FOR
 * 2026-08-04: expenses stopped appearing in the P&L on 14 July and nobody
 * noticed for three weeks. `fn_record_expense` posts to the ledger only inside
 * `IF v_exp IS NOT NULL AND v_src IS NOT NULL THEN`, where v_src is the
 * chart_of_accounts row linked to the bank or cash account the money moved
 * through. Two of six money accounts had no such link, so every payment through
 * them skipped the ledger — no journal entry, no error, and the function still
 * returned success.
 *
 * A trigger now links every new money account, so the state cannot be reached
 * by adding an account. This check exists for the two ways it still could be:
 * someone unlinks an account by hand, or a row predates the trigger.
 *
 * It counts UNPOSTED MONEY rather than missing links, because that is the thing
 * that actually hurts: a link is only interesting once a payment has fallen
 * through it.
 */
export async function checkLedgerPosting(db: any): Promise<Finding[]> {
    const findings: Finding[] = [];

    // 1. Money accounts with no ledger account behind them.
    const unlinked: string[] = [];
    for (const [table, column, label] of [
        ['bank_accounts', 'linked_bank_account_id', 'bank'],
        ['cash_accounts', 'linked_cash_account_id', 'cash'],
    ] as const) {
        const { data: accounts, error: accErr } = await db.from(table).select('id, name');
        const { data: coa, error: coaErr } = await db.from('chart_of_accounts').select(column);
        if (accErr || coaErr) {
            return [{
                severity: 'warning',
                check: 'ledger-posting',
                summary: 'Could not read the chart of accounts, so ledger links were NOT checked',
                detail: [accErr?.message || coaErr?.message].filter(Boolean) as string[],
            }];
        }
        const linked = new Set((coa || []).map((r: any) => r[column]).filter(Boolean));
        for (const a of accounts || []) {
            if (!linked.has(a.id)) unlinked.push(`${label} account "${a.name}" has no ledger account`);
        }
    }

    if (unlinked.length) {
        findings.push({
            severity: 'critical',
            check: 'ledger-posting',
            summary: `${unlinked.length} money account(s) are not linked to the ledger — payments through them skip the P&L silently`,
            detail: unlinked,
        });
    }

    // 2. Payments recorded recently that never got a journal entry.
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    for (const [table, label] of [
        ['vendor_payments', 'vendor payments'],
        ['payments_received', 'receipts'],
    ] as const) {
        const { data, error } = await db
            .from(table)
            .select('amount')
            .is('journal_entry_id', null)
            .gte('created_at', since);
        if (error) {
            findings.push({
                severity: 'warning',
                check: 'ledger-posting',
                summary: `Could not check ${label} for missing ledger entries`,
                detail: [error.message],
            });
            continue;
        }
        const rows = data || [];
        if (rows.length) {
            const total = rows.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
            findings.push({
                severity: 'critical',
                check: 'ledger-posting',
                summary: `${rows.length} ${label} in the last 30 days have no ledger entry — ₹${Math.round(total).toLocaleString('en-IN')} is missing from the P&L`,
                detail: ['Recorded in the payments table but never posted to journal_entries, so no report that reads the ledger can see it.'],
            });
        }
    }

    return findings;
}

/** Every Postgres function the app calls via .rpc() must still exist. */
export async function checkRpcs(db: any): Promise<Finding[]> {
    const { data, error } = await db.rpc('fn_public_functions');
    if (error) {
        return [{
            severity: 'warning',
            check: 'rpc-drift',
            summary: 'Could not list database functions, so RPC drift was not checked',
            detail: [error.message],
        }];
    }
    const live = new Set((data || []).map((r: any) => r.function_name));
    const missing = Object.entries(manifest.rpcs as Record<string, any>)
        .filter(([name]) => !live.has(name))
        .map(([name, site]) => `${name}() — called from ${site.file}:${site.line}`);

    if (!missing.length) return [];
    return [{
        severity: 'critical',
        check: 'rpc-drift',
        summary: `${missing.length} database function(s) the app calls are missing`,
        detail: missing,
    }];
}

/** Configuration tables must not be empty. */
export async function checkConfigTables(db: any): Promise<Finding[]> {
    const { data, error } = await db.rpc('fn_table_row_counts', {
        p_tables: CONFIG_TABLES.map(c => c.table),
    });
    if (error) {
        return [{
            severity: 'warning',
            check: 'config-tables',
            summary: 'Could not count configuration tables',
            detail: [error.message],
        }];
    }

    const counts = new Map<string, number>();
    for (const r of data || []) counts.set(r.table_name, Number(r.row_count));

    const empty: string[] = [];
    const absent: string[] = [];
    for (const spec of CONFIG_TABLES) {
        const n = counts.get(spec.table);
        if (n === undefined) continue;
        if (n === -1) { absent.push(`${spec.table} — table does not exist`); continue; }
        if (n < spec.min) empty.push(`${spec.table}: ${n} row(s), expected at least ${spec.min} — ${spec.why}`);
    }

    const findings: Finding[] = [];
    if (absent.length) {
        findings.push({
            severity: 'critical',
            check: 'config-tables',
            summary: `${absent.length} configuration table(s) missing`,
            detail: absent,
        });
    }
    if (empty.length) {
        findings.push({
            severity: 'critical',
            check: 'config-tables',
            summary: `${empty.length} configuration table(s) empty or below minimum`,
            detail: empty,
        });
    }
    return findings;
}

/**
 * Has any table LOST data since yesterday?
 *
 * This is the check built for a young, filling-up application, and it is the
 * one to trust as the business grows into the app.
 *
 * Everything else here compares the database against an opinion someone wrote
 * down — a list of tables, a minimum row count. Opinions go stale, and on an app
 * where new processes are still being added weekly they go stale fast. This
 * compares each table against ITS OWN numbers from the previous snapshot, so it
 * needs no maintenance and gets sharper the more history there is.
 *
 * Growth is never reported. Only loss. That is what makes it safe to run while
 * jobs, dispatches and invoices are still working through their first cycles:
 * an empty table might simply be new, but a table that had rows yesterday and
 * has none today has lost something, and that is never innocent.
 *
 * Thresholds live in fn_row_count_regressions(): a drop to zero always reports;
 * a partial drop only when it is both >=20% and >=5 rows, so deleting a
 * cancelled job or a duplicate client stays quiet.
 */
export async function checkDataLoss(db: any): Promise<Finding[]> {
    const { data, error } = await db.rpc('fn_row_count_regressions');
    if (error) {
        return [{
            severity: 'warning',
            check: 'data-loss',
            summary: 'Could not compare row counts against yesterday',
            detail: [error.message],
        }];
    }

    const rows = data || [];
    if (!rows.length) return [];

    // Emptied entirely is its own headline. "clients lost 12%" is worth knowing;
    // "clients is now empty" is worth being woken up for, and burying the second
    // among the first is how a real emergency gets skimmed past.
    const emptied = rows.filter((r: any) => Number(r.current_val) === 0);
    const reduced = rows.filter((r: any) => Number(r.current_val) > 0);

    const findings: Finding[] = [];
    if (emptied.length) {
        findings.push({
            severity: 'critical',
            check: 'data-loss',
            summary: `${emptied.length} table(s) had data yesterday and are empty today`,
            detail: emptied.map((r: any) =>
                `${r.table_name}: ${r.previous} row(s) on ${String(r.since).slice(0, 10)} → 0 now`),
        });
    }
    if (reduced.length) {
        findings.push({
            severity: 'critical',
            check: 'data-loss',
            summary: `${reduced.length} table(s) lost a significant number of rows`,
            detail: reduced.map((r: any) =>
                `${r.table_name}: ${r.previous} → ${r.current_val} (−${r.lost}, ${r.pct_lost}%)`),
        });
    }
    return findings;
}

/**
 * Record today's row counts, so tomorrow has something to compare against.
 *
 * Called at the END of the audit, and its failure is deliberately reported as a
 * warning rather than swallowed: if snapshots stop being written, the check
 * above goes quiet and looks exactly like "nothing was lost". A monitor that
 * fails silent is worse than no monitor, and this whole file exists because of
 * that lesson.
 */
export async function captureRowSnapshot(db: any): Promise<Finding[]> {
    const { error } = await db.rpc('fn_capture_row_snapshot');
    if (error) {
        return [{
            severity: 'warning',
            check: 'data-loss',
            summary: 'Could not record today row counts — tomorrow data-loss check will not run',
            detail: [error.message],
        }];
    }
    return [];
}

/**
 * Did the scheduled jobs actually run?
 *
 * A cron that stops firing is invisible: nothing errors, a report simply never
 * arrives, and by the time somebody notices the absence it has been missing for
 * days. cron_runs is written by lib/cron-log.ts at the end of every scheduled
 * route, so "no row since yesterday" is itself the alarm.
 */
export async function checkCrons(db: any, expected: { job: string; maxAgeHours: number }[]): Promise<Finding[]> {
    const { data, error } = await db
        .from('cron_runs')
        .select('job, ran_at, ok, message')
        .order('ran_at', { ascending: false })
        .limit(500);

    // Table not migrated yet — say so rather than reporting a clean run.
    if (error) {
        return [{
            severity: 'warning',
            check: 'cron-freshness',
            summary: 'cron_runs not readable, so scheduled jobs were not verified',
            detail: [error.message],
        }];
    }

    const rows = data || [];

    // Nothing logged at all means this feature has only just shipped and no
    // cron has fired since — not that every cron is dead. Alerting on the first
    // night would fire five false criticals and teach everyone to ignore the
    // 3:45 AM message, which would cost more than the check is worth. Once any
    // job has logged once, the per-job windows below take over.
    if (!rows.length) return [];

    const latest = new Map<string, any>();
    for (const r of rows) if (!latest.has(r.job)) latest.set(r.job, r);

    const stale: string[] = [];
    const failing: string[] = [];
    const now = Date.now();

    // How long logging has been in place. A job cannot be judged missing until
    // its own window has elapsed since we started watching — otherwise `backup`,
    // which runs on Saturdays, would be reported missing every day of its first
    // week purely because the log is younger than its schedule.
    const oldest = rows.reduce(
        (min: number, r: any) => Math.min(min, new Date(r.ran_at).getTime()),
        now,
    );
    const watchedHours = (now - oldest) / 3_600_000;

    for (const e of expected) {
        const row = latest.get(e.job);
        if (!row) {
            if (watchedHours >= e.maxAgeHours) stale.push(`${e.job} — has never recorded a run`);
            continue;
        }
        const ageH = (now - new Date(row.ran_at).getTime()) / 3_600_000;
        if (ageH > e.maxAgeHours) {
            stale.push(`${e.job} — last ran ${ageH.toFixed(1)}h ago (expected within ${e.maxAgeHours}h)`);
        }
        if (row.ok === false) {
            failing.push(`${e.job} — last run failed: ${row.message || 'no detail'}`);
        }
    }

    const findings: Finding[] = [];
    if (stale.length) {
        findings.push({
            severity: 'critical',
            check: 'cron-freshness',
            summary: `${stale.length} scheduled job(s) have not run when expected`,
            detail: stale,
        });
    }
    if (failing.length) {
        findings.push({
            severity: 'critical',
            check: 'cron-freshness',
            summary: `${failing.length} scheduled job(s) failed on their last run`,
            detail: failing,
        });
    }
    return findings;
}

/**
 * Jobs whose absence is a real problem, and how long is too long.
 *
 * The windows are deliberately loose — roughly double the schedule — so a single
 * late or retried run does not cry wolf. Sunday matters: several crons run
 * Mon–Sat only (`* * * 1-6`), so their windows must clear a whole idle Sunday
 * or the audit would alert every Monday morning for no reason.
 */
export const EXPECTED_CRONS = [
    { job: 'health', maxAgeHours: 26 },
    { job: 'telegram-digest', maxAgeHours: 50 },
    { job: 'eod-report', maxAgeHours: 50 },
    { job: 'backup', maxAgeHours: 8 * 24 },
    { job: 'refresh-drive-token', maxAgeHours: 3 },
];
