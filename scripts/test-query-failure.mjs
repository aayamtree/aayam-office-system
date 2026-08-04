#!/usr/bin/env node
/**
 * test-query-failure.mjs — tests for the code that now wraps EVERY query.
 *
 * WHY THIS MATTERS MORE THAN MOST TESTS
 * lib/query-failure.ts installs a custom `fetch` into the Supabase browser
 * client. That puts it in the path of every single database request the app
 * makes. If it drops a response, mutates one, or throws, it does not break one
 * screen — it breaks all of them at once. Nothing else in this codebase has
 * that blast radius, so it gets tested before it ships.
 *
 * The tests below therefore care as much about what the wrapper must NOT do
 * (change the response, swallow a network error, fire on a normal empty result)
 * as about what it must do.
 *
 * Run:  node scripts/test-query-failure.mjs
 * Exit: 0 all passed, 1 otherwise.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import ts from 'typescript';
import Module from 'module';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let passed = 0, failed = 0;
function check(name, ok, detail = '') {
    if (ok) { passed++; console.log(`  ok   ${name}`); }
    else { failed++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── Environment: this module is browser-only, so stub what it reaches for ────
const toasts = [];
const reports = [];
let nextFetchResult = null;

globalThis.window = { location: { pathname: '/admin/jobs' } };

function fakeResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        clone() { return this; },
        text: async () => body,
    };
}

globalThis.fetch = async (url, init) => {
    // Calls to the crash reporter are recorded, not performed.
    if (typeof url === 'string' && url.includes('/api/errors/report')) {
        reports.push(JSON.parse(init.body));
        return fakeResponse(200, '{}');
    }
    if (nextFetchResult instanceof Error) throw nextFetchResult;
    return nextFetchResult;
};

function load() {
    const src = readFileSync(path.join(ROOT, 'lib', 'query-failure.ts'), 'utf8');
    const js = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
    }).outputText;
    const m = new Module('query-failure');
    m.require = (id) => {
        if (id.includes('toast')) {
            const rec = { __esModule: true };
            rec.toast = new Proxy({}, { get: () => (msg) => toasts.push(msg) });
            rec.default = rec.toast;
            return rec;
        }
        return Module.createRequire(import.meta.url)(id);
    };
    m._compile(js, path.join(ROOT, 'lib', 'query-failure.ts'));
    return m.exports;
}

const QF = load();
const REST = 'https://x.supabase.co/rest/v1/';
const settle = () => new Promise(r => setTimeout(r, 10));

console.log('\nquery-failure — the wrapper around every query\n');

// ── Transparency: the wrapper must not change what supabase-js receives ──────
{
    const original = fakeResponse(200, '[{"id":1}]');
    nextFetchResult = original;
    const returned = await QF.auditedFetch(REST + 'jobs?select=*');
    check('a successful response is passed through as the very same object',
        returned === original);
    check('a successful response body is still readable by the caller',
        (await returned.text()) === '[{"id":1}]');
    await settle();
    check('a successful response reports nothing', reports.length === 0 && toasts.length === 0);
}

{
    // supabase-js relies on fetch rejecting when the network is down. If the
    // wrapper caught that, every offline query would hang instead of erroring.
    nextFetchResult = new Error('network down');
    let threw = false;
    try { await QF.auditedFetch(REST + 'jobs'); } catch { threw = true; }
    check('a network failure still rejects, it is not swallowed', threw);
}

// ── Reporting a real failure ────────────────────────────────────────────────
{
    toasts.length = 0; reports.length = 0;
    nextFetchResult = fakeResponse(400, JSON.stringify({
        message: 'column jobs.order_dat does not exist', code: '42703',
    }));
    const res = await QF.auditedFetch(REST + 'jobs?select=order_dat');
    await settle();
    check('a failed response is still returned to the caller unchanged', res.status === 400);
    check('a failed query toasts the user once', toasts.length === 1, JSON.stringify(toasts));
    check('the toast names the table, so it means something',
        toasts[0].includes('jobs'), toasts[0]);
    check('the failure is written to page_errors for the daily audit',
        reports.length === 1 && reports[0].source === 'query', JSON.stringify(reports));
    check('the report carries the real database message, not a generic one',
        reports[0].message.includes('column jobs.order_dat does not exist'), reports[0]?.message);
    check('the report records which page the user was on',
        reports[0].path === '/admin/jobs');
}

// ── Noise control ───────────────────────────────────────────────────────────
{
    toasts.length = 0; reports.length = 0;
    // Same fault, five times — a polling widget, or six queries on one page.
    for (let i = 0; i < 5; i++) {
        nextFetchResult = fakeResponse(400, JSON.stringify({ message: 'boom' }));
        await QF.auditedFetch(REST + `jobs?select=x&attempt=${i}`);
        await settle();
    }
    check('the same failure repeated is reported once, not five times',
        toasts.length === 1, `${toasts.length} toasts`);
}

{
    toasts.length = 0; reports.length = 0;
    // A different table is a different problem and must not be de-duplicated away.
    nextFetchResult = fakeResponse(400, JSON.stringify({ message: 'boom' }));
    await QF.auditedFetch(REST + 'clients?select=x');
    await settle();
    check('a different table is reported separately', toasts.length === 1);
}

// ── Things that are normal and must stay silent ─────────────────────────────
{
    const quiet = async (label, status, body, url = REST + 'jobs') => {
        toasts.length = 0; reports.length = 0;
        nextFetchResult = fakeResponse(status, body);
        await QF.auditedFetch(url);
        await settle();
        check(label, toasts.length === 0 && reports.length === 0,
            `${toasts.length} toasts, ${reports.length} reports`);
    };

    await quiet('.single() with no matching row is normal, not an error',
        406, JSON.stringify({ code: 'PGRST116', message: 'no rows returned' }));
    await quiet('a 401 during session refresh is left to the auth layer', 401, 'unauthorized');
    await quiet('an empty page of a paginated result is not an error', 416, 'range not satisfiable');
    await quiet('a non-PostgREST request is ignored entirely',
        500, 'server error', 'https://api.telegram.org/bot/send');
}

// ── Robustness: instrumentation must never be the thing that breaks ─────────
{
    toasts.length = 0; reports.length = 0;
    nextFetchResult = fakeResponse(400, 'this is not json at all');
    const res = await QF.auditedFetch(REST + 'jobs');
    await settle();
    check('a non-JSON error body is handled without throwing', res.status === 400 && toasts.length === 1);
}

{
    toasts.length = 0; reports.length = 0;
    const broken = { ok: false, status: 500, clone() { throw new Error('cannot clone'); } };
    nextFetchResult = broken;
    let ok = true;
    try { await QF.auditedFetch(REST + 'jobs'); } catch { ok = false; }
    check('a response that cannot be read does not break the request', ok);
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
