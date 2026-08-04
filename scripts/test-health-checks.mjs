#!/usr/bin/env node
/**
 * test-health-checks.mjs — exercise the audit's own logic against fake data.
 *
 * WHY THIS EXISTS
 * These checks only ever run at 3:45 AM against a healthy database, so the
 * interesting branches — the ones that fire an alert — would otherwise never
 * execute until the night something is genuinely broken. That is the worst
 * possible time to find out the alerting logic is wrong.
 *
 * It also pins the two false-alarm guards that were added after review:
 * an empty cron_runs table on the first night, and a weekly job during its
 * first week. Both would have fired criticals for no reason, and an alert
 * people learn to ignore is worse than no alert at all.
 *
 * Run:  node scripts/test-health-checks.mjs
 * Exit: 0 all passed, 1 otherwise.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import ts from 'typescript';
import Module from 'module';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Compile lib/health-checks.ts on the fly. It imports the generated manifest as
// JSON, which plain node cannot resolve from a .ts file, so both are handled here.
function loadHealthChecks() {
    const src = readFileSync(path.join(ROOT, 'lib', 'health-checks.ts'), 'utf8');
    const js = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;

    const manifest = JSON.parse(
        readFileSync(path.join(ROOT, 'lib', 'generated', 'query-manifest.json'), 'utf8'),
    );

    const m = new Module('health-checks');
    m.require = (id) => {
        // `import manifest from './generated/query-manifest.json'` compiles to a
        // require() whose value TypeScript reads via `.default` (esModuleInterop),
        // so the stub has to look like an ES module, not a bare object.
        if (id.includes('query-manifest')) return { ...manifest, default: manifest, __esModule: true };
        return Module.createRequire(import.meta.url)(id);
    };
    m._compile(js, path.join(ROOT, 'lib', 'health-checks.ts'));
    return m.exports;
}

const HC = loadHealthChecks();

/** Same trick for the activity monitor. It imports only a type from health-checks. */
function loadActivityExpectations() {
    const src = readFileSync(path.join(ROOT, 'lib', 'activity-expectations.ts'), 'utf8');
    const js = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const m = new Module('activity-expectations');
    m.require = (id) => Module.createRequire(import.meta.url)(id);
    m._compile(js, path.join(ROOT, 'lib', 'activity-expectations.ts'));
    return m.exports;
}

const AE = loadActivityExpectations();

let passed = 0;
let failed = 0;
function check(name, condition, detail = '') {
    if (condition) { passed++; console.log(`  ok   ${name}`); }
    else { failed++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

/** Minimal stand-in for the supabase client, with only what the checks touch. */
function fakeDb({ rpc = {}, cronRows = [], cronError = null }) {
    return {
        rpc: async (name, args) => {
            const handler = rpc[name];
            if (!handler) return { data: null, error: { message: `no stub for ${name}` } };
            return { data: handler(args), error: null };
        },
        from: () => ({
            select: () => ({
                order: () => ({
                    limit: async () => (cronError
                        ? { data: null, error: { message: cronError } }
                        : { data: cronRows, error: null }),
                }),
            }),
        }),
    };
}

console.log('\nhealth-checks logic\n');

// ── schema drift ──────────────────────────────────────────────────────────
{
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'lib/generated/query-manifest.json'), 'utf8'));
    // "Every column" must include WRITE columns too. Since 2026-08-04 the
    // manifest also records what the app inserts and updates, and 16 tables are
    // written to but never selected from. Building the fake schema from selects
    // alone left those tables absent, and the drift check correctly reported
    // them missing — a failing test caused by an incomplete fixture, not by a
    // broken check.
    const everyColumn = () =>
        Object.entries(manifest.tables).flatMap(([t, s]) => {
            const cols = new Set([...(s.columns || []), ...Object.keys(s.writes?.columns || {})]);
            return Array.from(cols).map((c) => ({ table_name: t, column_name: c }));
        });

    const clean = await HC.checkSchemaDrift(fakeDb({ rpc: { fn_public_columns: everyColumn } }));
    check('schema drift: silent when the database has every column', clean.length === 0,
        JSON.stringify(clean));

    const missingOne = await HC.checkSchemaDrift(fakeDb({
        rpc: { fn_public_columns: () => everyColumn().filter(r => !(r.table_name === 'jobs' && r.column_name === 'order_date')) },
    }));
    check('schema drift: flags a dropped column',
        missingOne.some(f => f.severity === 'critical' && f.detail?.some(d => d.includes('jobs.order_date'))),
        JSON.stringify(missingOne));

    const missingTable = await HC.checkSchemaDrift(fakeDb({
        rpc: { fn_public_columns: () => everyColumn().filter(r => r.table_name !== 'job_checklists') },
    }));
    check('schema drift: flags a dropped table',
        missingTable.some(f => f.detail?.some(d => d.startsWith('job_checklists'))),
        JSON.stringify(missingTable));

    const unreadable = await HC.checkSchemaDrift(fakeDb({ rpc: {} }));
    check('schema drift: warns (not silent) when the schema cannot be read',
        unreadable.length === 1 && unreadable[0].severity === 'warning');
}

// ── config tables ─────────────────────────────────────────────────────────
{
    const full = (args) => args.p_tables.map(t => ({ table_name: t, row_count: 99 }));

    const clean = await HC.checkConfigTables(fakeDb({ rpc: { fn_table_row_counts: full } }));
    check('config tables: silent when all are populated', clean.length === 0, JSON.stringify(clean));

    const emptied = await HC.checkConfigTables(fakeDb({
        rpc: { fn_table_row_counts: (a) => a.p_tables.map(t => ({ table_name: t, row_count: t === 'job_checklists' ? 0 : 99 })) },
    }));
    check('config tables: flags the exact fault seen on 2026-08-01',
        emptied.some(f => f.severity === 'critical' && f.detail?.some(d => d.startsWith('job_checklists: 0'))),
        JSON.stringify(emptied));

    const belowMin = await HC.checkConfigTables(fakeDb({
        rpc: { fn_table_row_counts: (a) => a.p_tables.map(t => ({ table_name: t, row_count: t === 'job_stages' ? 2 : 99 })) },
    }));
    check('config tables: flags a table below its minimum, not just empty',
        belowMin.some(f => f.detail?.some(d => d.startsWith('job_stages: 2'))),
        JSON.stringify(belowMin));

    const gone = await HC.checkConfigTables(fakeDb({
        rpc: { fn_table_row_counts: (a) => a.p_tables.map(t => ({ table_name: t, row_count: t === 'counters' ? -1 : 99 })) },
    }));
    check('config tables: -1 sentinel is reported as a missing table',
        gone.some(f => f.detail?.some(d => d.includes('counters') && d.includes('does not exist'))),
        JSON.stringify(gone));
}

// ── rpc drift ─────────────────────────────────────────────────────────────
{
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'lib/generated/query-manifest.json'), 'utf8'));
    const all = () => Object.keys(manifest.rpcs).map(n => ({ function_name: n }));

    const clean = await HC.checkRpcs(fakeDb({ rpc: { fn_public_functions: all } }));
    check('rpc drift: silent when every function exists', clean.length === 0, JSON.stringify(clean));

    const dropped = await HC.checkRpcs(fakeDb({
        rpc: { fn_public_functions: () => all().filter(r => r.function_name !== 'fn_finance_overview_pnl') },
    }));
    check('rpc drift: flags a dropped function',
        dropped.some(f => f.detail?.some(d => d.startsWith('fn_finance_overview_pnl'))),
        JSON.stringify(dropped));
}

// ── cron freshness, including the two false-alarm guards ──────────────────
{
    const expected = HC.EXPECTED_CRONS;

    const dayOne = await HC.checkCrons(fakeDb({ cronRows: [] }), expected);
    check('cron: an empty log on the first night is silent, not five criticals',
        dayOne.length === 0, JSON.stringify(dayOne));

    // Logging started 2h ago; only refresh-drive-token (3h window) has had a
    // fair chance, and it has run. Nothing else should be reported yet.
    const firstWeek = await HC.checkCrons(fakeDb({
        cronRows: [{ job: 'refresh-drive-token', ran_at: hoursAgo(2), ok: true }],
    }), expected);
    check('cron: a weekly job is not reported missing during its first week',
        firstWeek.length === 0, JSON.stringify(firstWeek));

    const allFresh = await HC.checkCrons(fakeDb({
        cronRows: expected.map(e => ({ job: e.job, ran_at: hoursAgo(1), ok: true })),
    }), expected);
    check('cron: silent when every job ran recently', allFresh.length === 0, JSON.stringify(allFresh));

    // Watched for 40 days, so every window has elapsed and eod-report is overdue.
    const rows = expected.map(e => ({ job: e.job, ran_at: hoursAgo(1), ok: true }));
    rows.push({ job: 'health', ran_at: hoursAgo(24 * 40), ok: true });
    const stale = rows.map(r => r.job === 'eod-report' ? { ...r, ran_at: hoursAgo(100) } : r);
    const staleResult = await HC.checkCrons(fakeDb({ cronRows: stale }), expected);
    check('cron: flags a job that stopped firing',
        staleResult.some(f => f.detail?.some(d => d.startsWith('eod-report'))),
        JSON.stringify(staleResult));

    const failingRows = expected.map(e => ({
        job: e.job, ran_at: hoursAgo(1), ok: e.job !== 'backup', message: 'drive quota exceeded',
    }));
    const failingResult = await HC.checkCrons(fakeDb({ cronRows: failingRows }), expected);
    check('cron: a job that runs but fails is reported separately from one that stops',
        failingResult.some(f => f.summary.includes('failed on their last run')
            && f.detail?.some(d => d.includes('drive quota exceeded'))),
        JSON.stringify(failingResult));

    const unreadable = await HC.checkCrons(fakeDb({ cronError: 'relation does not exist' }), expected);
    check('cron: an unreadable log warns rather than reporting a clean run',
        unreadable.length === 1 && unreadable[0].severity === 'warning');
}

// ── data loss, and the false alarms a young app would otherwise generate ────
//
// These matter more than the rest. The business began using this app for real
// on 2026-08-01 with 22 of 88 tables legitimately empty, filling over cycles
// that run from a day to three weeks. If this check mistakes normal ramp-up for
// data loss, it fires every morning about the system working correctly, and the
// 3:45 AM message stops being read within a week.
{
    const rows = (list) => ({
        rpc: { fn_row_count_regressions: () => list, fn_capture_row_snapshot: () => 88 },
    });

    const quiet = await HC.checkDataLoss(fakeDb(rows([])));
    check('data loss: silent when nothing was lost', quiet.length === 0, JSON.stringify(quiet));

    // The function itself filters growth out, so an empty result is what the
    // database returns for a growing app. This pins the contract at this end.
    const growing = await HC.checkDataLoss(fakeDb(rows([])));
    check('data loss: a table that only grew is not reported', growing.length === 0);

    const emptied = await HC.checkDataLoss(fakeDb(rows([
        { table_name: 'job_checklists', previous: 13, current_val: 0, lost: 13, pct_lost: 100, since: '2026-07-31' },
    ])));
    check('data loss: a table emptied overnight is critical — the 2026-08-01 shape',
        emptied.length === 1 && emptied[0].severity === 'critical'
        && emptied[0].summary.includes('empty today'),
        JSON.stringify(emptied));
    check('data loss: the alert says how many rows were there before',
        emptied[0].detail?.[0].includes('13 row(s)'), JSON.stringify(emptied[0].detail));

    const both = await HC.checkDataLoss(fakeDb(rows([
        { table_name: 'design_tasks', previous: 4, current_val: 0, lost: 4, pct_lost: 100, since: '2026-07-31' },
        { table_name: 'quotations', previous: 60, current_val: 12, lost: 48, pct_lost: 80, since: '2026-07-31' },
    ])));
    check('data loss: "emptied" is reported separately from "shrank", not buried together',
        both.length === 2
        && both.some(f => f.summary.includes('empty today'))
        && both.some(f => f.summary.includes('significant number')),
        JSON.stringify(both.map(f => f.summary)));

    const unreadable = await HC.checkDataLoss(fakeDb({ rpc: {} }));
    check('data loss: warns when the comparison cannot run, rather than reporting clean',
        unreadable.length === 1 && unreadable[0].severity === 'warning');

    const snapOk = await HC.captureRowSnapshot(fakeDb(rows([])));
    check('snapshot: silent on success', snapOk.length === 0);

    const snapFail = await HC.captureRowSnapshot(fakeDb({ rpc: {} }));
    check('snapshot: a failure to record is reported — a silent monitor is worse than none',
        snapFail.length === 1 && snapFail[0].severity === 'warning');
}

// ── the config list must not fire on a legitimately young database ──────────
{
    // The 22 tables that were genuinely empty on 2026-08-01, the day the
    // business started using the app. None may appear in CONFIG_TABLES, or the
    // very first nightly run would have alerted about normal ramp-up.
    const emptyOnDayOne = [
        'job_notes', 'design_tasks', 'page_errors', 'dispatches', 'reminders',
        'job_subtasks', 'notifications', 'pos_categories', 'pos_products',
        'cmyk_expenses', 'cmyk_job_logs', 'cmyk_paper_purchases',
        'client_shipping_addresses', 'work_logs', 'eod_edit_log', 'task_remarks',
        'library_sheets', 'cron_runs', 'expenses', 'design_projects',
        'sales_orders', 'calendar_event_mentions',
    ];
    const configured = new Set(HC.CONFIG_TABLES.map(c => c.table));
    const clash = emptyOnDayOne.filter(t => configured.has(t));
    check('config list: contains none of the tables that are legitimately empty at go-live',
        clash.length === 0, clash.join(', '));

    check('config list: every entry explains what breaks, so nobody adds one on a hunch',
        HC.CONFIG_TABLES.every(c => typeof c.why === 'string' && c.why.length > 15));
}

// ── write drift ───────────────────────────────────────────────────────────
// The check that would have caught Create Dispatch being dead for months.
{
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'lib/generated/query-manifest.json'), 'utf8'));
    const everyColumn = () =>
        Object.entries(manifest.tables).flatMap(([t, s]) => {
            const cols = new Set([...(s.columns || []), ...Object.keys(s.writes?.columns || {})]);
            return Array.from(cols).map((c) => ({ table_name: t, column_name: c }));
        });

    const clean = await HC.checkWriteDrift(fakeDb({ rpc: { fn_public_columns: everyColumn } }));
    check('write drift: no phantom columns when the database has every written column',
        !clean.some(f => f.severity === 'critical'),
        JSON.stringify(clean.filter(f => f.severity === 'critical')));

    // Drop one written column from the fake schema — the 2026-08-04 shape.
    const withoutOne = () => everyColumn().filter(r => !(r.table_name === 'jobs' && r.column_name === 'current_stage'));
    const drifted = await HC.checkWriteDrift(fakeDb({ rpc: { fn_public_columns: withoutOne } }));
    const crit = drifted.find(f => f.severity === 'critical');
    check('write drift: a column the app writes but the database lacks is CRITICAL',
        !!crit && crit.detail.some(d => d.includes('jobs.current_stage')),
        JSON.stringify(drifted));

    check('write drift: the alert names the file and line that writes it',
        !!crit && crit.detail.some(d => /\.tsx?:\d+/.test(d)), JSON.stringify(crit?.detail?.slice(0, 2)));

    check('write drift: a spread payload is reported as unverifiable, never as clean',
        clean.some(f => f.severity === 'warning' && /cannot be checked/.test(f.summary)),
        JSON.stringify(clean.map(f => f.summary)));

    const blind = await HC.checkWriteDrift(fakeDb({ rpc: {} }));
    check('write drift: an unreadable schema warns rather than reporting a clean run',
        blind.length === 1 && blind[0].severity === 'warning');
}

// ── expected activity ─────────────────────────────────────────────────────
// The only check that asks whether anyone is getting work done.
{
    /**
     * Stand-in supabase whose counts come from a { table: n } map.
     * The builder methods must return the SAME awaitable object, or a chained
     * `.gte(...)` hands back a plain object and every count silently reads as
     * zero — which would make these tests pass for the wrong reason.
     */
    const countDb = (counts) => ({
        from: (table) => ({
            select: () => {
                const value = counts[table];
                const p = Promise.resolve(
                    value === 'error'
                        ? { count: null, error: { message: 'boom' } }
                        : { count: value ?? 0, error: null },
                );
                for (const method of ['eq', 'not', 'in', 'gt', 'gte', 'lte', 'order', 'limit']) p[method] = () => p;
                return p;
            },
        }),
    });

    const busy = await AE.checkExpectedActivity(countDb({
        jobs: 5, clients: 5, dispatches: 3, job_stage_history: 9,
        journal_entries: 2, pos_sales: 4, cmyk_clients: 6,
    }));
    check('activity: silent while work is flowing', busy.length === 0, JSON.stringify(busy.map(f => f.summary)));

    // Nothing waiting anywhere -> nothing to complain about, even with zero activity.
    const idle = await AE.checkExpectedActivity(countDb({}));
    check('activity: a genuinely quiet business raises NOTHING (no crying wolf)',
        idle.length === 0, JSON.stringify(idle.map(f => f.summary)));

    // 3 jobs sat at Ready for Dispatch and nothing dispatched — the real 2026-08-04 state.
    const stuck = await AE.checkExpectedActivity(countDb({
        jobs: 3, clients: 5, dispatches: 0, job_stage_history: 9,
        journal_entries: 2, pos_sales: 4, cmyk_clients: 6,
    }));
    const dispatchAlert = stuck.find(f => f.summary.includes('dispatches'));
    check('activity: work waiting + nothing happening is CRITICAL — the bug that hid for months',
        !!dispatchAlert && dispatchAlert.severity === 'critical', JSON.stringify(stuck.map(f => f.summary)));

    check('activity: the alert says what was waiting, not just that a table is empty',
        !!dispatchAlert && /job\(s\) sitting at Ready for Dispatch|jobs? /.test(dispatchAlert.summary),
        dispatchAlert?.summary);

    check('activity: every expectation has a precondition, so none can fire on an idle day',
        AE.ACTIVITY_EXPECTATIONS.every(e => typeof e.precondition === 'function' && e.windowDays >= 3));

    check('activity: every expectation explains what it means, so nobody guesses',
        AE.ACTIVITY_EXPECTATIONS.every(e => typeof e.meaning === 'string' && e.meaning.length > 30));
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
