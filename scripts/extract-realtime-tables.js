#!/usr/bin/env node
/**
 * Extract every table the app subscribes to for live updates.
 *
 * WHY THIS EXISTS
 * On 2026-09-08 we found that `notifications` and `chat_messages` were being
 * subscribed to in code but had never been added to the `supabase_realtime`
 * publication. Postgres therefore published nothing for them, the subscription
 * received nothing, and NOTHING ERRORED. The Notification Bell appeared to work
 * only because a 60-second poll sat behind it; the in-app chat — 2,092 messages,
 * in daily use — had simply never updated live in its life.
 *
 * That is the same shape as the outages that made lib/health-checks.ts exist:
 * the database is up, health is green, and a feature is quietly dead. A
 * hand-kept list of "tables we subscribe to" would drift the same way. So the
 * list is generated from the source, and the nightly health check compares it
 * against the live publication.
 *
 * Output: lib/generated/realtime-tables.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const SKIP = new Set(['node_modules', '.next', 'generated']);

/** Files that reference postgres_changes at all — cheap pre-filter. */
function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

const found = new Map(); // table -> Set of files

for (const dir of SCAN_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
        const src = fs.readFileSync(file, 'utf8');
        if (!src.includes('postgres_changes')) continue;

        // A subscription is `.on('postgres_changes', { ... table: 'x' ... }, cb)`.
        // The options object may be inline or spread over many lines, so take
        // each postgres_changes occurrence and read the table name out of the
        // text that follows it, up to the next postgres_changes or 800 chars.
        let idx = src.indexOf('postgres_changes');
        while (idx !== -1) {
            const next = src.indexOf('postgres_changes', idx + 1);
            const end = next === -1 ? Math.min(src.length, idx + 800)
                                    : Math.min(next, idx + 800);
            const window = src.slice(idx, end);
            const m = window.match(/table:\s*['"`]([a-zA-Z0-9_]+)['"`]/);
            if (m) {
                const t = m[1];
                if (!found.has(t)) found.set(t, new Set());
                found.get(t).add(path.relative(ROOT, file));
            }
            idx = next;
        }
    }
}

const tables = [...found.keys()].sort();
const out = {
    generatedAt: new Date().toISOString(),
    note: 'Tables the app subscribes to via postgres_changes. Each MUST be in the supabase_realtime publication or its live updates are silently dead.',
    tables,
    sites: Object.fromEntries([...found].sort().map(([t, s]) => [t, [...s].sort()])),
};

const dest = path.join(ROOT, 'lib', 'generated', 'realtime-tables.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

console.log(`realtime tables: ${tables.length ? tables.join(', ') : '(none found)'}`);
if (!tables.length) {
    console.warn('WARNING: no subscriptions found. If the app still calls .on("postgres_changes"), this extractor has stopped matching and the health check is now blind.');
    process.exitCode = 1;
}
