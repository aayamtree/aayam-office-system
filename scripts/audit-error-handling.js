#!/usr/bin/env node
/**
 * audit-error-handling.js — find queries whose failure the user never sees.
 *
 * THE BUG CLASS THIS EXISTS FOR
 * On 2026-08-01 /admin/settings/production looked broken. It wasn't: the
 * job_checklists table had been emptied. The page could not tell the difference,
 * because its fetch did this —
 *
 *     const { data, error } = await supabase.from('job_checklists').select('*');
 *     if (error) console.error('Error fetching checklists:', error);
 *     if (data) setChecklists(data);
 *
 * — and console.error writes to a browser console nobody has open. The page then
 * falls through to its empty state. A FAILED QUERY AND AN EMPTY TABLE PRODUCE A
 * PIXEL-IDENTICAL SCREEN. That is the single reason this class of fault stays
 * invisible: not to the audit, not to staff, not to anyone.
 *
 * The same shape explains the 2026-07-06 phantom-column incident, where several
 * pages rendered empty lists for days while PostgREST was returning an error on
 * every request.
 *
 * WHAT IT CLASSIFIES
 *   swallowed  `error` is destructured but only ever reaches console.*
 *              The user is shown a confident empty state over a failure.
 *   unchecked  `error` is not destructured at all. Strictly worse — the failure
 *              is not even written down, and `data` is null, so the page renders
 *              empty with no trace anywhere.
 *
 * SEVERITY DEPENDS ON WHAT THE CALL FEEDS
 * A failed lookup behind a dropdown is a nuisance; a failed fetch behind the
 * list a page exists to show is an outage that looks like "no records". So a
 * call whose result reaches component state (setX / useState setter) is an
 * error, and everything else is a warning. Without that split the report is 200
 * lines long, nobody reads it, and it may as well not run.
 *
 * A RATCHET, NOT A CLIFF
 * There were 92 error-level findings when this was written, across 60 files with
 * 60 different render structures. Converting them all in one sitting is exactly
 * the kind of sweeping change that breaks working screens — which is the problem
 * we are trying to solve, not a price worth paying to solve it.
 *
 * So the build gates on the baseline in error-handling-baseline.json: the count
 * may fall, never rise. New code has to handle its errors; old code gets fixed
 * deliberately, a few screens at a time, and the baseline is lowered as it goes.
 * Beating the baseline fails the build too, with an instruction to lower it —
 * otherwise the number silently drifts up again behind a stale threshold.
 *
 * Usage:  node scripts/audit-error-handling.js [--all] [--json] [--update-baseline]
 * Exit:   0 = at or below baseline, 1 = above it (or baseline needs lowering)
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude', 'graveyard', 'supabase']);

const showAll = process.argv.includes('--all');
const asJson = process.argv.includes('--json');

/**
 * Files that are allowed to swallow, with the reason.
 *
 * An allowlist is only honest if every entry says why. "It's fine" is not a
 * reason — if the justification cannot be written in one line, the call should
 * be fixed instead of listed here.
 */
const ALLOWED = {
    'lib/cron-log.ts': 'logging a cron run must never fail the cron itself',
    'lib/report-crash.ts': 'reporting a crash must not throw a second crash',
    'app/api/errors/report/route.ts': 'the crash logger cannot depend on itself',
};

function walk(dir, out = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (SKIP_DIRS.has(e.name)) continue;
            walk(full, out);
        } else if (/\.(tsx|ts)$/.test(e.name)) {
            out.push(full);
        }
    }
    return out;
}

/** Blank out comments while preserving offsets, so reported line numbers stay true. */
function blankComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

const lineAt = (src, idx) => src.slice(0, idx).split('\n').length;

/**
 * Where the destructuring statement itself ends.
 *
 * Needed because the query's own `.from(...)` sits immediately after the
 * `await supabase` token. An earlier version started the scope there, so the
 * "next query" boundary below matched the statement's own `.from(` and every
 * scope collapsed to nothing — which made `feedsState` false everywhere and
 * demoted 464 real findings to warnings. Walk to the terminating semicolon at
 * bracket depth zero instead.
 */
function endOfStatement(src, fromIdx) {
    let depth = 0;
    for (let i = fromIdx; i < src.length; i++) {
        const ch = src[i];
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === ';' && depth <= 0) return i + 1;
        else if (ch === '\n' && depth <= 0 && /^\s*$/.test(src.slice(i + 1, i + 2))) continue;
    }
    return src.length;
}

/**
 * The window in which to judge how `error` was handled.
 *
 * Bounded by the next query — a later query's error handling must not be
 * credited to this one — and by a closing brace at or below the destructuring's
 * own indentation, which is where the enclosing block ends. Both matter: too
 * wide and every finding disappears behind some unrelated `if (err)` further
 * down the file.
 */
function scopeAfter(src, startIdx) {
    const rest = src.slice(startIdx);
    let end = rest.length;

    const nextQuery = rest.search(/await\s+(?:[\w.]*supabase\w*|db)\b/);
    if (nextQuery !== -1) end = Math.min(end, nextQuery);

    const lines = rest.split('\n');
    const baseIndent = (lines[0].match(/^\s*/) || [''])[0].length;
    let consumed = 0;
    for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
            const indent = (lines[i].match(/^\s*/) || [''])[0].length;
            if (/^\s*\}/.test(lines[i]) && indent <= baseIndent) {
                end = Math.min(end, consumed);
                break;
            }
        }
        consumed += lines[i].length + 1;
    }
    return rest.slice(0, end);
}

/** Does this call's result end up in component state? */
function feedsState(scope) {
    return /\bset[A-Z]\w*\s*\(/.test(scope);
}

function auditFile(file) {
    const raw = fs.readFileSync(file, 'utf8');
    const src = blankComments(raw);
    const rel = path.relative(ROOT, file);
    if (ALLOWED[rel]) return [];

    const findings = [];

    // const { data, error } = await supabase...   /   const { data } = await supabase...
    // Also catches renamed bindings: { data: rows, error: err }
    const re = /(?:const|let)\s*\{([^}]*)\}\s*=\s*await\s+([\w.]*supabase\w*|db)\b/g;
    let m;
    while ((m = re.exec(src))) {
        const bindings = m[1];
        const idx = m.index;
        const line = lineAt(src, idx);
        const scope = scopeAfter(src, endOfStatement(src, idx + m[0].length));

        // What is `error` called here? `error` or `error: err`.
        const errBind = bindings.match(/\berror\s*:\s*(\w+)/) || (/\berror\b/.test(bindings) ? [null, 'error'] : null);

        if (!errBind) {
            // Not destructured at all. `count`-only calls are exempt: a head
            // request has no rows to render, so a failure shows as a blank
            // number rather than a confident empty list.
            if (!/\bdata\b/.test(bindings)) continue;
            findings.push({ file: rel, line, kind: 'unchecked', state: feedsState(scope) });
            continue;
        }

        const name = errBind[1];
        const uses = [...scope.matchAll(new RegExp(`\\b${name}\\b`, 'g'))];
        if (!uses.length) {
            findings.push({ file: rel, line, kind: 'unchecked', state: feedsState(scope) });
            continue;
        }

        // Handled if the error reaches anything the user or the server can see:
        // state, a toast, a throw, a return, or an HTTP response.
        const handled = new RegExp(
            [
                `set\\w*Error\\s*\\(`,           // setLoadError(...)
                `toast\\.\\w+\\([^)]*${name}`,   // toast.error(... error ...)
                `throw\\b[^\\n]*${name}`,
                `return[^\\n]*${name}`,
                `NextResponse\\.json\\([^\\n]*${name}`,
                `captureError|reportCrash|setErr\\b`,
            ].join('|'),
        ).test(scope);

        if (handled) continue;

        // Only console.* saw it.
        if (new RegExp(`console\\.\\w+\\([^)]*${name}`).test(scope)) {
            findings.push({ file: rel, line, kind: 'swallowed', state: feedsState(scope) });
        }
    }
    return findings;
}

function main() {
    const files = [
        ...walk(path.join(ROOT, 'app')),
        ...walk(path.join(ROOT, 'components')),
        ...walk(path.join(ROOT, 'lib')),
        ...walk(path.join(ROOT, 'hooks')),
    ];

    let findings = [];
    for (const f of files) {
        try {
            findings = findings.concat(auditFile(f));
        } catch (e) {
            console.error(`  ! could not parse ${path.relative(ROOT, f)}: ${e.message}`);
        }
    }

    const errors = findings.filter(f => f.state);
    const warnings = findings.filter(f => !f.state);

    if (asJson) {
        console.log(JSON.stringify({ errors, warnings }, null, 2));
        process.exit(errors.length ? 1 : 0);
    }

    console.log('\nError-handling audit — query failures the user would never see\n');

    const print = (list, label) => {
        if (!list.length) return;
        console.log(`  ${label}`);
        const byFile = {};
        for (const f of list) (byFile[f.file] ||= []).push(f);
        for (const [file, items] of Object.entries(byFile)) {
            console.log(`    ${file}`);
            for (const i of items) {
                const what = i.kind === 'swallowed'
                    ? 'error logged to console only — page renders its empty state over a failure'
                    : 'error never checked — page renders empty with no trace at all';
                console.log(`      line ${i.line}: ${what}`);
            }
        }
        console.log('');
    };

    print(errors, `ERRORS (${errors.length}) — result reaches component state, so a failure looks like "no records"`);
    if (showAll) {
        print(warnings, `WARNINGS (${warnings.length}) — result does not reach rendered state`);
    } else if (warnings.length) {
        console.log(`  ${warnings.length} warning(s) hidden — re-run with --all to see them.\n`);
    }

    // ── Ratchet ───────────────────────────────────────────────────────────────
    const baselinePath = path.join(ROOT, 'scripts', 'error-handling-baseline.json');
    let baseline = { errors: Infinity };
    try {
        baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    } catch {
        console.log('  No baseline file — treating this run as the baseline.\n');
    }

    if (process.argv.includes('--update-baseline')) {
        fs.writeFileSync(baselinePath, JSON.stringify({
            errors: errors.length,
            recordedAt: new Date().toISOString(),
            note: 'Upper bound on swallowed/unchecked query errors that reach rendered state. '
                + 'May only be lowered. Every query failure is still surfaced at the transport '
                + 'layer by lib/query-failure.ts; this counts the ones that do not yet show a '
                + 'proper <LoadError/> in place.',
        }, null, 2) + '\n');
        console.log(`  Baseline updated to ${errors.length}.\n`);
        process.exit(0);
    }

    if (!errors.length) {
        console.log(`  No error-level findings. Scanned ${files.length} files.`);
        console.log('  (Means: every query whose result is rendered reports its own failure.)\n');
        process.exit(0);
    }

    if (errors.length > baseline.errors) {
        console.log(`  ${errors.length} error(s) — ABOVE the baseline of ${baseline.errors}.`);
        console.log('  A new query was added whose failure the user would never see.');
        console.log('  Fix: keep the error in state and render <LoadError/>, so a broken query');
        console.log('  cannot be mistaken for an empty table. See components/LoadError.tsx.\n');
        process.exit(1);
    }

    if (errors.length < baseline.errors) {
        console.log(`  ${errors.length} error(s) — below the baseline of ${baseline.errors}. Good.`);
        console.log('  Lower the baseline to lock the improvement in:');
        console.log('    node scripts/audit-error-handling.js --update-baseline\n');
        // Exit 0. This used to exit 1 — a FAILURE for the code having got
        // BETTER. `npm run audit` therefore went red on a good day, and had the
        // prebuild hook shipped it would have blocked every Vercel deploy from
        // the moment anyone fixed an error-handling site. A check that punishes
        // improvement is a check people learn to ignore.
        process.exit(0);
    }

    console.log(`  ${errors.length} error(s) — at the baseline. No new ones introduced.`);
    console.log('  These are pre-existing. Every one still surfaces a toast and a page_errors');
    console.log('  row via lib/query-failure.ts; what they lack is an in-place <LoadError/>.\n');
    process.exit(0);
}

main();
