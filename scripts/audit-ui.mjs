// npm run audit:ui                 -> whole app: totals per rule + worst files
// npm run audit:ui -- --changed    -> only files changed since the last commit (git); FAILS on any problem
// npm run audit:ui -- a.tsx b.tsx  -> only these files; FAILS on any problem
//
// Checks every screen against the Aayam design guide (CLAUDE.md "UI changes" rules 1-10,
// DESIGN_SYSTEM.md, DASHBOARD_GUIDE.md sections 9-10). A rule can be skipped on ONE line
// only with the comment  /* ui-ok: reason */  on that line, and the reason is listed in the report.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const PALETTE = 'gray|slate|zinc|neutral|stone|red|green|blue|indigo|purple|yellow|orange|emerald|teal|cyan|sky|violet|pink|rose|lime|fuchsia';
const RULES = [
  { id: 'R1-palette', why: 'Colour must be a token (bg-primary, text-muted-foreground, border, bg-card...). Raw palette class found',
    re: new RegExp(`\\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|placeholder|accent)-(?:${PALETTE})-\\d{2,3}\\b`, 'g') },
  { id: 'R1-amber', why: 'Amber is allowed only as amber-600 "due soon" state', re: /\b(?:bg|text|border)-amber-(?!600\b)\d{2,3}\b/g },
  { id: 'R1-hex', why: 'No hex colours in screens; use tokens', re: /(?:\[#[0-9a-fA-F]{3,8}\]|(?:color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*['"]#[0-9a-fA-F]{3,8})/g },
  { id: 'R5-bigtype', why: 'No text-2xl / 3xl / 4xl (page title is text-xl font-semibold)', re: /\btext-(?:2xl|3xl|4xl|5xl|6xl)\b/g },
  { id: 'R6-shadow', why: 'Flat cards: no shadows', re: /\bshadow(?:-(?:sm|md|lg|xl|2xl|inner))?\b(?!-none)/g },
  { id: 'R6-hoverlift', why: 'No hover lift / zoom', re: /\bhover:(?:-?translate-[xy]|scale-|shadow)/g },
  { id: 'R6-radius', why: 'Cards rounded-lg, buttons/inputs rounded-md (rounded-full only for badges/avatars)', re: /\brounded-(?:xl|2xl|3xl)\b/g },
  { id: 'R7-rawcontrol', why: 'Use shared components from components/ui (Button, Input, Select, Textarea, Dialog...)', re: /<(?:button|input|select|textarea)\b/g },
  { id: 'R7-nativedialog', why: 'No browser alert/confirm/prompt; use Dialog', re: /\b(?:window\.)?(?:alert|confirm|prompt)\(/g },
  { id: 'R10-emoji', why: 'No emoji in labels or text', re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}]/gu },
  { id: 'R5-tinytype', why: 'Smallest text is text-xs (12px); no text-[10px]/[11px]', re: /\btext-\[(?:[0-9]|1[01])px\]/g },
  { id: 'R-inlinestyle', why: 'No inline style={{...}} for look; use Tailwind tokens', re: /style=\{\{/g },
];
const SKIP_DIRS = ['node_modules', '.next', 'components/ui', 'app/admin/demo', 'app/admin/cmyk-print', 'components/cmyk'];
const isSkipped = f => SKIP_DIRS.some(d => f.startsWith(d + '/') || f.includes('/' + d + '/')) || /old|backup|\.test\./i.test(f);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.includes(p)) walk(p, out); }
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const args = process.argv.slice(2);
let files, strict = false;
if (args.includes('--changed')) {
  strict = true;
  const out = execSync('git diff --name-only HEAD; git ls-files --others --exclude-standard', { encoding: 'utf8' });
  files = [...new Set(out.split('\n').filter(f => f.endsWith('.tsx') && existsSync(f)))];
} else if (args.length) { strict = true; files = args.filter(f => f.endsWith('.tsx')); }
else files = [...walk('app'), ...walk('components')];
files = files.filter(f => !isSkipped(f));

const perRule = Object.fromEntries(RULES.map(r => [r.id, 0]));
const perFile = [];
const allowed = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  let count = 0; const hits = [];
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;               // comments
    const ok = line.match(/\/\*\s*ui-ok:\s*([^*]+)\*\//);
    for (const r of RULES) {
      const m = line.match(r.re);
      if (!m) continue;
      if (r.id === 'R7-rawcontrol' && /type=["']file["']|\bhidden\b|sr-only/.test(line)) continue;   // hidden file pickers are fine
      if (ok) { allowed.push(`${f}:${i + 1} ${r.id} — ${ok[1].trim()}`); continue; }
      perRule[r.id] += m.length; count += m.length;
      if (hits.length < 50) hits.push(`  ${f}:${i + 1}  ${r.id}  ${m[0]}`);
    }
  });
  if (count) perFile.push({ f, count, hits });
}
perFile.sort((a, b) => b.count - a.count);
const total = perFile.reduce((s, x) => s + x.count, 0);

console.log(`\nAayam design guide check — ${files.length} screen files\n`);
for (const r of RULES) console.log(`${perRule[r.id] ? '✗' : '✓'} ${r.id.padEnd(16)} ${String(perRule[r.id]).padStart(5)}   ${r.why}`);
console.log(`\nTotal problems: ${total} in ${perFile.length} of ${files.length} files`);
if (strict) { perFile.forEach(x => x.hits.forEach(h => console.log(h))); }
else { console.log('\nWorst 15 files:'); perFile.slice(0, 15).forEach(x => console.log(`  ${String(x.count).padStart(4)}  ${x.f}`)); }
if (allowed.length) { console.log(`\nAllowed by /* ui-ok */ (${allowed.length}):`); allowed.forEach(a => console.log('  ' + a)); }
if (strict && total) { console.log('\n✗ FAIL — fix these before saying "done".'); process.exit(1); }
if (strict) console.log('\n✓ PASS — these files follow the design guide.');
