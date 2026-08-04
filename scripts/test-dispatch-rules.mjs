#!/usr/bin/env node
/**
 * test-dispatch-rules.mjs — lock the dispatch form to what was actually agreed.
 *
 * WHY THIS EXISTS
 * On 2026-08-04 Satish marked up three screenshots of the Create Dispatch
 * modal, striking out every field that did not belong to each mode. The
 * implementation was written from that, agreed in writing as a table — and
 * then shipped with Vehicle No still showing on Transport and Local
 * Transport. Nothing caught it. Satish did, in the browser, after it was live.
 *
 * A spec agreed in a conversation is not enforceable; a spec written as a test
 * is. THE TABLE BELOW IS THE AGREEMENT. If a change makes one of these fail,
 * the question is whether the agreement changed — not whether the test is
 * inconvenient.
 *
 * Usage: node scripts/test-dispatch-rules.mjs
 * Exit:  0 = matches what was agreed, 1 = drifted
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Module from 'module';
import ts from 'typescript';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadTs(relPath, name) {
    const src = readFileSync(path.join(ROOT, relPath), 'utf8');
    const js = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const m = new Module(name);
    m.require = (id) => Module.createRequire(import.meta.url)(id);
    m._compile(js, path.join(ROOT, relPath));
    return m.exports;
}

const { DISPATCH_MODE_FIELDS } = loadTs('types/database.ts', 'database');
const { getJobDocs } = loadTs('lib/job-documents.ts', 'job-documents');

let passed = 0, failed = 0;
const check = (name, ok, detail = '') => {
    if (ok) { passed++; console.log(`  ok   ${name}`); }
    else { failed++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

console.log('\ndispatch form rules\n');

// ── THE AGREEMENT ─────────────────────────────────────────────────────────
// Taken from Satish's marked-up screenshots, 2026-08-04.
//   Client Collect  — who collected, nothing else
//   Courier         — receipt + transporter + LR;  no vehicle, no driver
//   Transport       — receipt + transporter + LR;  no vehicle, no driver
//   Local Transport — driver name + phone only;    no LR, no receipt, no vehicle
const AGREED = {
    collect:         { receipt: false, transporter: false, tracking: false, vehicle: false, driver: false, receivedBy: true  },
    courier:         { receipt: true,  transporter: true,  tracking: true,  vehicle: false, driver: false, receivedBy: false },
    transport:       { receipt: true,  transporter: true,  tracking: true,  vehicle: false, driver: false, receivedBy: false },
    local_transport: { receipt: false, transporter: false, tracking: false, vehicle: false, driver: true,  receivedBy: false },
};

check('all four modes exist, and only those four',
    JSON.stringify(Object.keys(DISPATCH_MODE_FIELDS).sort()) === JSON.stringify(Object.keys(AGREED).sort()),
    Object.keys(DISPATCH_MODE_FIELDS).join(', '));

for (const [mode, agreed] of Object.entries(AGREED)) {
    const actual = DISPATCH_MODE_FIELDS[mode];
    if (!actual) { check(`${mode}: present`, false); continue; }
    for (const [field, want] of Object.entries(agreed)) {
        check(`${mode}: ${field} ${want ? 'shown' : 'hidden'}`,
            actual[field] === want,
            `expected ${want}, got ${actual[field]}`);
    }
}

// The two that were actually wrong when this file was written. Named
// explicitly so the regression is impossible to miss in the output.
check('REGRESSION: Transport does not ask for a vehicle number',
    DISPATCH_MODE_FIELDS.transport.vehicle === false);
check('REGRESSION: Local Transport asks for the driver, not the vehicle',
    DISPATCH_MODE_FIELDS.local_transport.driver === true &&
    DISPATCH_MODE_FIELDS.local_transport.vehicle === false);

check('every mode has a human label',
    Object.values(DISPATCH_MODE_FIELDS).every((m) => typeof m.label === 'string' && m.label.length > 2));

// ── Paperwork de-duplication ──────────────────────────────────────────────
console.log('\npaperwork list\n');

const sameFileTwice = {
    files: [
        { name: 'Invoice: INVOICE_20250618.pdf',   url: 'https://x/a/1690000000-INVOICE.pdf', size: 46000, uploaded_at: '2026-07-25T10:00:00Z' },
        { name: 'Invoice: INVOICE_20250618.pdf',   url: 'https://x/b/1690000999-INVOICE.pdf', size: 46000, uploaded_at: '2026-07-25T10:05:00Z' },
        { name: 'E-Way Bill: INVOICE_20250618.pdf', url: 'https://x/c/1690000111-EWAY.pdf',   size: 46000, uploaded_at: '2026-07-25T10:01:00Z' },
        { name: 'E-Way Bill: INVOICE_20250618.pdf', url: 'https://x/d/1690000222-EWAY.pdf',   size: 46000, uploaded_at: '2026-07-25T10:06:00Z' },
    ],
};

// Each upload gets its own timestamped path, so the same file uploaded twice
// has two different URLs — de-duping on URL alone left both on screen, which
// is what PO-2407001 actually showed.
check('the same document uploaded twice is listed once',
    getJobDocs(sameFileTwice, 'invoice').length === 1,
    `got ${getJobDocs(sameFileTwice, 'invoice').length}`);

check('an e-way bill whose filename says "invoice" is not filed as an invoice',
    getJobDocs(sameFileTwice, 'eway').length === 1 &&
    getJobDocs(sameFileTwice, 'invoice').length === 1);

check('the newest copy is the one kept',
    getJobDocs(sameFileTwice, 'invoice')[0].url.includes('1690000999'));

const realRevisions = {
    files: [
        { name: 'Invoice: INV-1.pdf', url: 'https://x/1.pdf', size: 46000, uploaded_at: '2026-07-25T10:00:00Z' },
        { name: 'Invoice: INV-1.pdf', url: 'https://x/2.pdf', size: 51000, uploaded_at: '2026-07-26T10:00:00Z' },
    ],
};
check('a genuine revision of the same name is NOT hidden',
    getJobDocs(realRevisions, 'invoice').length === 2,
    'a corrected invoice must never be silently dropped');

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
