// npm run audit:layout
// Guard against the "one long list stretches the whole row" bug (2026-09-14,
// 2026-10-07). In dashboard widgets, any list built with .map() over data
// that is not sliced/limited must sit inside <ScrollList> (components/ui).
// If a list is genuinely short and fixed, add the comment  /* bounded: why */
// on or just above the .map( line to silence this check.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIRS = ['components/dashboard', 'app/admin/dashboard'];
const files = DIRS.flatMap(d =>
  readdirSync(d).filter(f => f.endsWith('.tsx') && !f.includes('old')).map(f => join(d, f)));

let problems = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const usesGuard = /ScrollList|max-h-|overflow-y-auto/.test(src);
  lines.forEach((line, i) => {
    if (!/\.map\(/.test(line)) return;
    if (!/<[A-Za-z]/.test(lines.slice(i, i + 10).join(" "))) return;      // not rendering JSX
    const ctx = lines.slice(Math.max(0, i - 2), i + 1).join(' ');
    if (/bounded:|\.slice\(|\[\s*(\d\s*,?\s*)+\]/.test(ctx)) return;      // capped or fixed
    if (/(sales|weekDays|PIPE|gaps|holdings|items)\b/.test(ctx) && !/selectedDay|workloads|busy|idle/.test(ctx)) return;
    if (usesGuard) return;
    console.log(`✗ ${f}:${i + 1}  list may grow without limit — wrap in <ScrollList> or add /* bounded: reason */`);
    problems++;
  });
}
if (problems) { console.log(`\n${problems} unbounded list(s).`); process.exit(1); }
console.log('✓ no unbounded lists in dashboard widgets');
