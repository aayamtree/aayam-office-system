#!/usr/bin/env node
/**
 * audit-select-contracts.js — catch "fetched columns vs. used columns" mismatches.
 *
 * THE BUG THIS EXISTS FOR
 * 2026-07-31: /admin/reports/sales called useJobs() with no arguments. The default
 * select (JOB_SELECTS.LIST in lib/hooks.ts) does not fetch order_date, so
 * job.order_date was undefined and `job.order_date.split('T')[0]` threw
 * "Cannot read properties of undefined (reading 'split')" on every load.
 *
 * Nothing could catch this. The column exists in Postgres and is non-null, so a
 * schema audit passes. The DB is up, so the health check passes. The page only
 * breaks in the browser, at render time, and no cron opens a browser.
 * This script closes that gap statically: it compares what a page's query asked
 * for against what the page actually reads off the result.
 *
 * WHAT IT CHECKS
 * For each page that uses a jobs hook, work out the effective select list
 * (explicit `select:` if passed, otherwise the hook default from lib/hooks.ts),
 * then find every `job.<field>` / `j.<field>` dereference in the file and flag
 * any field that is a real jobs column but was never fetched.
 *
 * WHY IT ONLY COVERS JOBS
 * Jobs is where the narrow-select pattern (JOB_SELECTS) lives and where the bug
 * actually happened. Better a check that is exactly right about one table than a
 * clever one that cries wolf about five. Extend TABLES below if the pattern spreads.
 *
 * KNOWN LIMITS — read these before trusting a clean run:
 *  - Static text matching. A field accessed as job[key] with a computed key is invisible.
 *  - It cannot see through a variable holding a select string built elsewhere.
 *  - A clean result means "no mismatch of this shape found", not "the page works".
 *
 * Usage:  node scripts/audit-select-contracts.js
 * Exit:   0 = clean, 1 = problems found (so CI or a pre-deploy step can gate on it)
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Real columns of public.jobs — all 84 — generated from information_schema on
// 2026-07-31. Only these are flagged; anything else is treated as a computed or
// local property and ignored.
//
// This list was first written from memory and had 24 entries, which silently
// under-reported: any bug involving one of the other 60 columns was invisible to
// the check. Never hand-write this. Regenerate with:
//
//   select string_agg(quote_literal(column_name), ', ' order by ordinal_position)
//   from information_schema.columns
//   where table_schema='public' and table_name='jobs';
const JOBS_COLUMNS = new Set([
    'id', 'job_number', 'project_name', 'client_id', 'vendor_id', 'designer_id',
    'job_type', 'description', 'quantity', 'quote_per_piece', 'subtotal', 'gst_rate',
    'gst_amount', 'discount_amount', 'total_amount', 'payment_status', 'amount_received',
    'order_date', 'client_deadline', 'internal_deadline', 'completed_date',
    'current_stage', 'priority', 'files', 'notes', 'is_active', 'created_by',
    'created_at', 'updated_at', 'sales_person_id', 'sales_order_id', 'checklist_progress',
    'dispatch_checklist_progress', 'qc_status', 'drive_link', 'status', 'drive_file_id',
    'drive_file_name', 'drive_file_verified_at', 'drive_file_status', 'calendar_event_id',
    'calendar_event_link', 'calendar_reminder_sent', 'product_category',
    'product_category_id', 'client_approval', 'approval_date', 'print_ready',
    'file_version', 'gst_percentage', 'base_price', 'advance_required',
    'advance_collected', 'advance_amount', 'parent_job_id', 'project_origin',
    'is_on_hold', 'hold_reason', 'pre_hold_stage', 'revision_count', 'packing_info',
    'invoice_reference', 'eway_bill_number', 'design_charge', 'print_files',
    'advance_payment_mode', 'commission_user_id', 'commission_percentage',
    'commission_amount', 'commission_status', 'commission_paid_at', 'brand_id',
    'brand_name', 'designer_status', 'label_product_id', 'dispatch_mode',
    'dispatch_receipt_url', 'design_billing', 'design_billing_confirmed', 'product_id',
    'library_status', 'library_skip_reason', 'invoice_requested_at', 'invoice_requested_by',
]);

// Relations are fetched as embeds (client:clients(...)), not plain columns.
const RELATIONS = new Set(['client', 'vendor', 'designer']);

const TABLES = {
    // varNames stays deliberately narrow. An earlier version also matched `sale`
    // and `order`, which flagged POS sales rows (sale.total_amount) as missing job
    // columns. A check that cries wolf gets ignored, and an ignored check is worse
    // than no check — so this only follows variables that really do hold a job.
    jobs: { columns: JOBS_COLUMNS, hooks: ['useJobs'], varNames: ['job', 'j'] },
};

/** Walk a directory for .tsx/.ts files, skipping build output and worktrees. */
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
            // .claude/worktrees holds stale copies of the whole app — auditing them
            // produces duplicate findings against code that is not deployed.
            if (['node_modules', '.next', '.git', '.claude', 'graveyard'].includes(e.name)) continue;
            walk(full, out);
        } else if (/\.(tsx|ts)$/.test(e.name)) {
            out.push(full);
        }
    }
    return out;
}

/** Pull the JOB_SELECTS.* constants out of lib/hooks.ts so we track the real defaults. */
function readHookDefaults() {
    const hooksPath = path.join(ROOT, 'lib', 'hooks.ts');
    const defaults = {};
    if (!fs.existsSync(hooksPath)) return defaults;
    const src = fs.readFileSync(hooksPath, 'utf8');

    const block = src.match(/JOB_SELECTS\s*=\s*\{([\s\S]*?)\n\}/);
    if (block) {
        const re = /(\w+)\s*:\s*['"`]([^'"`]+)['"`]/g;
        let m;
        while ((m = re.exec(block[1]))) defaults[`JOB_SELECTS.${m[1]}`] = m[2];
    }

    // Which constant useJobs falls back to when called with no select.
    const fallback = src.match(/const\s+defaultSelect\s*=\s*options\?\.select\s*\|\|\s*(JOB_SELECTS\.\w+)/);
    defaults.__useJobsDefault = fallback ? fallback[1] : 'JOB_SELECTS.LIST';
    return defaults;
}

/** Turn a select string into the set of top-level column names it fetches. */
function parseSelect(selectStr) {
    const fetched = new Set();
    // Drop embedded relation bodies: client:clients(id, name) -> client:clients
    const flat = selectStr.replace(/\([^()]*\)/g, '');
    for (let part of flat.split(',')) {
        part = part.trim();
        if (!part) continue;
        if (part === '*') return null; // null = everything, nothing to flag
        // alias:table  ->  alias
        const name = part.includes(':') ? part.split(':')[0].trim() : part;
        if (name) fetched.add(name);
    }
    return fetched;
}

/**
 * Strip comments so a long explanatory comment inside a hook call can't be
 * mistaken for code — and, more importantly, can't push the real `select:` line
 * outside a fixed-size read window. That produced two false positives on the
 * first run (dispatch/page.tsx does fetch quantity; the comment above it hid that).
 */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Read a call's argument text by matching parentheses, not by guessing a length. */
function argsAt(src, openParenIdx) {
    let depth = 0;
    for (let i = openParenIdx; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') {
            depth--;
            if (depth === 0) return src.slice(openParenIdx + 1, i);
        }
    }
    return src.slice(openParenIdx + 1, openParenIdx + 800);
}

function auditFile(file, defaults) {
    const raw = fs.readFileSync(file, 'utf8');
    const src = stripComments(raw);
    const findings = [];

    for (const [table, cfg] of Object.entries(TABLES)) {
        for (const hook of cfg.hooks) {
            const callIdx = src.indexOf(`${hook}(`);
            if (callIdx === -1) continue;

            // Only audit when the call actually takes the rows. Plenty of files
            // call useJobs() purely for its mutators — components/design/ChecklistModal
            // destructures only updateJob and gets its `job` from props, so auditing
            // it compared a prop against a select it never used. A false positive.
            const destructure = src.slice(Math.max(0, callIdx - 200), callIdx);
            const lastAssign = destructure.lastIndexOf('=');
            const bindings = lastAssign === -1 ? destructure : destructure.slice(0, lastAssign);
            if (!/\bjobs\b/.test(bindings.slice(bindings.lastIndexOf('{')))) continue;

            let argText = argsAt(src, callIdx + hook.length);

            // useJobs(SOME_CONST) — resolve the object literal declared in this file,
            // otherwise we'd wrongly assume the bare default select.
            const identifier = argText.trim().match(/^([A-Za-z_$][\w$]*)$/);
            if (identifier) {
                const declIdx = src.search(new RegExp(`\\b(?:const|let|var)\\s+${identifier[1]}\\s*=\\s*\\{`));
                if (declIdx !== -1) argText = src.slice(declIdx, declIdx + 1500);
            }

            let selectStr = null;
            const explicit = argText.match(/select\s*:\s*['"`]([^'"`]+)['"`]/);
            const constRef = argText.match(/select\s*:\s*(JOB_SELECTS\.\w+)/);

            if (explicit) {
                selectStr = explicit[1];
            } else if (constRef) {
                selectStr = defaults[constRef[1]];
            } else {
                // Bare useJobs() — the dangerous case, and the one that bit us.
                selectStr = defaults[defaults.__useJobsDefault];
            }
            if (!selectStr) continue;

            const fetched = parseSelect(selectStr);
            if (!fetched) continue; // select('*')

            // Find every <var>.<field> dereference in the file.
            const used = new Map(); // field -> line number
            for (const varName of cfg.varNames) {
                const re = new RegExp(`\\b${varName}\\.(\\w+)`, 'g');
                let m;
                while ((m = re.exec(src))) {
                    const field = m[1];
                    if (used.has(field)) continue;
                    used.set(field, src.slice(0, m.index).split('\n').length);
                }
            }

            for (const [field, line] of used) {
                if (!cfg.columns.has(field)) continue;   // not a real column — computed/local
                if (RELATIONS.has(field)) continue;
                if (fetched.has(field)) continue;        // fetched, fine

                findings.push({
                    file: path.relative(ROOT, file),
                    line,
                    table,
                    hook,
                    field,
                    explicitSelect: !!(explicit || constRef),
                });
            }
        }
    }
    return findings;
}

function main() {
    const defaults = readHookDefaults();
    const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))];

    let findings = [];
    for (const f of files) {
        try {
            findings = findings.concat(auditFile(f, defaults));
        } catch (e) {
            console.error(`  ! could not parse ${path.relative(ROOT, f)}: ${e.message}`);
        }
    }

    console.log('\nSelect-contract audit — fields a page reads but never fetched\n');

    if (!findings.length) {
        console.log(`  Clean. Scanned ${files.length} files.`);
        console.log('  (Means: no mismatch of this shape found. Not a guarantee the pages work.)\n');
        process.exit(0);
    }

    const byFile = {};
    for (const f of findings) (byFile[f.file] ||= []).push(f);

    for (const [file, list] of Object.entries(byFile)) {
        console.log(`  ${file}`);
        for (const f of list) {
            const why = f.explicitSelect
                ? 'missing from its select'
                : `not in the ${f.hook}() default select`;
            console.log(`    line ${f.line}: reads .${f.field} — ${why}`);
        }
        console.log('');
    }

    console.log(`  ${findings.length} problem(s) across ${Object.keys(byFile).length} file(s).`);
    console.log('  Fix: add the field to that page\'s select, or stop reading it.\n');
    process.exit(1);
}

main();
