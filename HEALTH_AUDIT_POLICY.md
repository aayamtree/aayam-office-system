# Health Audit Policy

Last updated: 2026-08-01

## Why this document exists

On 31 July 2026 the Sales Reports page crashed on every load with
`Cannot read properties of undefined (reading 'split')`. Finance Reports had a
quieter version of the same bug and had been showing a wrong **Total Billed**
figure. Neither was caught by the daily health audit, and the reasonable
question was asked: *why not?*

The honest answer: the audit was never designed to catch it. It checked the
infrastructure, and the infrastructure was fine. This document records what the
audit covers now, what it deliberately still does not, and the coding rules that
prevent the specific bug that started this.

## What the daily audit checks

`/api/health`, run by Vercel cron at **3:45 AM daily** (`vercel.json`).

| Layer | Checks | Since |
|---|---|---|
| Public | App responds; database reachable; response time | original |
| Privileged | Row counts for jobs / leads / invoices / clients | original |
| Privileged | Which env vars are set (booleans only, never values) | original |
| Privileged | Telegram delivery over last 7 days: sent, failed, unrouted | 2026-07-29 |
| Privileged | Page crashes in last 24h, grouped by page + message | 2026-07-31 |
| Privileged | **Schema drift** — every column the code selects still exists | **2026-08-01** |
| Privileged | **Function drift** — every `.rpc()` the code calls still exists | **2026-08-01** |
| Privileged | **Configuration tables not empty** (18 tables) | **2026-08-01** |
| Privileged | **Cron freshness** — each scheduled job ran, and succeeded | **2026-08-01** |
| Privileged | **Data loss** — any table that lost rows since yesterday | **2026-08-01** |
| Privileged | **Write drift** — every column the code INSERTs/UPDATEs still exists | **2026-08-04** |
| Privileged | **Expected activity** — work waiting, but nothing happening | **2026-08-04** |

"Privileged" means an admin session or the cron secret. Row counts tell a
passer-by how many clients the business has, so they are gated.

### The status rule

`status` is now `degraded`, not `healthy`, if any of these are true:

- One or more unresolved page crashes in the last 24 hours
- `TELEGRAM_BOT_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY` missing
- Any Telegram alert failed to deliver
- Any application-layer check returned a finding (schema drift, function drift,
  empty configuration table, stale or failing cron)

Reasons are listed in `degradedReasons`. **A crashing page is not a healthy
system**, whatever the database says — that judgement is the change that would
have turned 31 July into an alert rather than a discovery.

### The reporting rule

When the **cron** run finds problems, it sends a Telegram message to the admin
group and linked admin DMs, with a deep link to `/admin/system-health`.

An admin opening `/api/health` in a browser does **not** trigger an alert.

Rationale: the audit already ran every night before this and found real things.
Its output went to a Vercel log nobody opens. **An audit nobody reads is not an
audit.** If a check is worth running, it must report to a human.

## How page crashes get recorded

Before 31 July, `components/ErrorBoundary.tsx` and `app/error.tsx` called
`console.error` and nothing else. That log lives in one browser tab and dies with
it. There was nothing written down, so there was nothing to audit — no cron could
have answered "did any page crash yesterday?"

The chain now:

```
page throws
  → error boundary catches it
  → lib/report-crash.ts POSTs to /api/errors/report
  → service-role insert into page_errors
  → /api/health reads it at 3:45 AM
  → Telegram to admin group
```

Deliberate choices:

- **No INSERT policy on `page_errors`.** Writes go only through the API route
  using the service role. If the browser could write directly, anyone could
  flood the table.
- **Chunk-load errors are dropped.** They mean a tab was open across a deploy;
  the app already auto-reloads. Logging them would bury real crashes.
- **Crashes are de-duplicated per session** and rate-limited to 30/min. A crash
  inside a render loop can fire hundreds of times a second, and the crash log
  must not become the outage.
- **Reporting never throws.** It runs inside an error handler; a failure there
  would stack a second crash on the first.

Mark a crash handled by setting `resolved_at` — the audit reports only
unresolved ones, so a fixed bug stops nagging.

## The application-layer checks (added 2026-08-01)

`lib/health-checks.ts`. Everything listed above them is infrastructure, and on
2026-08-01 every infrastructure check passed while `public.job_checklists` sat
empty — the Production Settings page showed "No Checklists Found" and dispatch QC
silently substituted a hardcoded fallback for the configured checks. Nothing
crashed, so `page_errors` stayed empty, so the crash check added the previous day
found nothing either.

The lesson: **the crash check only sees crashes.** A page can be completely
broken and perfectly quiet. These four checks assert what must be true instead of
waiting to be told.

### Schema drift and function drift

`scripts/extract-query-manifest.js` runs during `prebuild` and writes down every
column and every `.rpc()` name the source asks Postgres for, into
`lib/generated/query-manifest.json`. The audit reads the schema **live** at
3:45 AM (via `fn_public_columns()` / `fn_public_functions()`) and reports the
difference.

The split is deliberate. Code changes only on deploy; the schema changes whenever
a migration is run by hand. Comparing the live schema against a snapshot
committed to the repo would just move the staleness somewhere else — which is the
exact failure mode being fixed. **The manifest describes the code; the database
describes itself.**

This catches the 2026-07-06 phantom-column class before anyone opens the page.

### Configuration tables

`CONFIG_TABLES` in `lib/health-checks.ts` — 18 tables where an empty result is
*always* a fault, each with a minimum count and a plain-English consequence.

The distinction from transactional tables is the whole point. `jobs` being empty
on a quiet day is normal. `job_stages` being empty means the pipeline has no
stages and every board in the app renders blank, and waiting will not fix it.

> **Adding a table here is a promise that empty always means broken, including on
> day one.** If a table merely *should* fill up over time, leave it out — the
> data-loss check below covers it far better, by comparing the table against its
> own history instead of against an opinion. A check that fires under normal
> conditions gets muted, and a muted check is worse than no check.

`pos_categories` and `pos_products` are empty and deliberately excluded: the
Retail POS was redesigned to use `paper_stock` and free-text items, so those are
dead tables, not a fault.

Verified on 2026-08-01, the day the business went live: **22 of 88 tables were
legitimately empty and none of them is in this list**, so the check was silent on
a genuinely young database. A test in `scripts/test-health-checks.mjs` names all
22 and **fails the build if any is ever added here** — the safeguard is enforced,
not remembered.

### Data loss — the check built for a growing app (added 2026-08-01)

`public.table_row_snapshots` + `fn_capture_row_snapshot()` + `fn_row_count_regressions()`.

Every night the audit counts all 88 public tables, compares against the previous
snapshot, then records today's numbers. **Growth is never reported. Only loss.**

This exists because `CONFIG_TABLES` is somebody's opinion written down, and
opinions go stale — fast, on an app where processes are still being added weekly.
The business went live on 2026-08-01 with **22 of 88 tables legitimately empty**,
filling over cycles that run from a day to three weeks. A rule that treated empty
as broken would have fired every morning about the system working correctly, and
within a week the 3:45 AM message would have gone unread.

Comparing a table against *its own* history needs no maintenance and gets sharper
the more data exists.

Thresholds, tuned so ordinary work stays quiet:

| Change | Reported |
|---|---|
| any increase | no |
| 240 → 228 (5%) | no |
| 15 → 14 (one row) | no |
| 12 → 10 (17%) | no |
| 60 → 12 (80%) | **yes** |
| anything → 0 | **yes**, however small |

A drop to zero always reports — that is the job_checklists shape and it is never
innocent. A partial drop needs to be both >=20% and >=5 rows, so deleting a
cancelled job or a duplicate client stays silent.

Two implementation details that matter:

- **The snapshot is taken after the comparison**, or the audit would compare
  today against itself and never see anything.
- **Snapshotting is cron-only.** An admin refreshing `/api/health` must not
  overwrite the day's baseline and erase evidence of a loss that happened that
  morning.
- **A failed snapshot is reported as a warning, not swallowed.** If snapshots
  stop being written the check goes quiet, which looks exactly like "nothing was
  lost" — the precise failure mode this whole document exists to prevent.

`fn_row_count_regressions()` compares against the most recent snapshot *before*
the latest, not literally yesterday, so a missed day (paused project, failed
cron) does not silently disable the check.

### Cron freshness

`public.cron_runs`, written by `lib/cron-log.ts`, one row per scheduled-job run.

A cron that stops firing is the quietest failure there is: nothing errors, the
EOD report simply never arrives, and an absence is far harder to notice than a
wrong number. Vercel knows, but that lives in a dashboard nobody opens and
`/api/health` could not reach it.

Windows (`EXPECTED_CRONS`) are roughly double each schedule so one late or
retried run does not cry wolf, and wide enough to clear an idle Sunday — several
crons run Mon–Sat only (`* * * 1-6`), and a tighter window would alert every
Monday morning for nothing.

The health check logs its own run too, so **"the audit is clean" can be told
apart from "the audit stopped running"** — from the outside those are identical
and mean opposite things.

### Two rules these follow

- **Every check is isolated.** One failing check must not take down the others,
  or a single bad query blinds the entire audit.
- **Alerts name the detail.** `job_checklists: 0 rows, expected at least 1` is
  something you can act on before opening a laptop; "something is wrong" is not.

## No query fails silently (added 2026-08-01)

`lib/query-failure.ts` installs a custom `fetch` into the Supabase browser
client, so any PostgREST error is caught **whether or not the calling code
destructured `error`**. The user gets a toast naming the table, and the failure
is written to `page_errors` with `source: 'query'` — the same table the daily
audit already reads.

This exists because a scan found **92** call sites (not the ten first estimated)
whose failure the user would never see, in this shape:

```ts
const { data } = await supabase.from('jobs').select(...);
setJobs(data || []);          // a failure renders as "no records"
```

The deepest instance was one line in `useSupabaseQuery`, used by 35 call sites:
it caught the error, logged it, and `return []`. SWR's `error` was therefore
never set, so **no page using the hook could tell broken from empty even if it
checked**. It now throws; `fallbackData: []` means pages that ignore `error` are
unaffected.

> **Always use `createAuditedBrowserClient()` from `lib/supabase.ts`.** A client
> built by calling `createBrowserClient` directly skips the net and its page goes
> back to failing quietly.

Normal conditions stay silent — `PGRST116` (`.single()` with no row), 401 during
session refresh, 416 empty range. Identical failures de-duplicate over 30s with
a 20-per-session cap, because a toast people learn to dismiss is no better than
no toast.

`scripts/test-query-failure.mjs` (18 tests, in `prebuild`) covers this. It has
the widest blast radius of anything in the codebase — it wraps every request in
the app — so the tests check what it must *not* do (alter the response, swallow
a network rejection, fire on a normal empty result) as much as what it must.

### Empty vs. broken, on screen

`components/LoadError.tsx` — use it wherever an empty list could be mistaken for
a working one. It is deliberately loud and prints the real database message:
"Something went wrong" gives nobody anything to report, "column jobs.foo does not
exist" gets it fixed in minutes.

### The ratchet

`scripts/audit-error-handling.js` counts remaining sites; `error-handling-baseline.json`
holds the ceiling (84 at time of writing). **The build fails if the count rises.**
Beating it also fails, with an instruction to lower the baseline — otherwise the
number drifts back up behind a stale threshold. Lower it with:

```bash
node scripts/audit-error-handling.js --update-baseline
```

Converting all 92 in one sitting was rejected on purpose: 60 files with 60
different render structures is exactly the kind of sweeping change that breaks
working screens, which is the problem, not an acceptable cost of the cure.

## Pre-deploy check: `npm run audit:selects`

The runtime chain above catches a crash *after* a staff member hits it. This
catches this particular bug class *before* it ships.

`scripts/audit-select-contracts.js` compares what a page's query fetched against
what the page actually reads off the result, and fails (exit 1) on a mismatch.

```bash
npm run audit:selects
```

**It now runs automatically on every deploy**, via `prebuild` in `package.json`.

> Corrected 2026-08-01. It was originally wired as `predeploy`, which **never
> ran once**: npm only fires a `pre<x>` hook for `npm run <x>`, there is no
> `deploy` script, and Vercel runs `npm run build`. The check written
> specifically to stop this bug class recurring was dead code for the whole time
> it was supposed to be protecting us. If a check is worth writing, verify it
> actually executes — a hook that never fires is indistinguishable from a check
> that always passes.

### The rule it enforces

> A page may only read a column its query actually fetched.

`useJobs()` with no arguments uses `JOB_SELECTS.LIST`, which fetches a narrow
column set and **caps results at 50 rows**. It does not include `order_date`,
`quantity`, or `created_at`.

**Any report, export, or aggregate page must pass its own `select` and `limit`.**
Relying on the default gives you a crash if you dereference a missing field
directly, or silently wrong numbers if you guard it with `|| ''`. The Finance
Reports case is the instructive one: it never crashed, it just quietly reported a
wrong billed total, and only 50 jobs.

### Known limits — read before trusting a clean run

- Static text matching. `job[key]` with a computed key is invisible to it.
- It cannot follow a select string built in another file.
- It covers the `jobs` table only — that is where `JOB_SELECTS` is used and where
  the bug happened. Extend `TABLES` in the script if the pattern spreads.
- A clean result means "no mismatch of this shape found", **not** "the pages work".

### Never hand-write the column list

`JOBS_COLUMNS` in the script was first written from memory with 24 entries. The
real table has **84**. Everything involving the other 60 columns was invisible,
and the check reported clean on bugs it should have caught — the first corrected
run went from 14 findings to 26. Regenerate it, never retype it:

```sql
select string_agg(quote_literal(column_name), ', ' order by ordinal_position)
from information_schema.columns
where table_schema='public' and table_name='jobs';
```

A check that is quietly incomplete is more dangerous than no check, because it
buys false confidence. Re-run this query after any migration that touches `jobs`.

## Writes and outcomes (added 2026-08-04)

Everything above this section, for its first three days of life, shared one
blind spot: it checked what the app **reads**, and it checked **structure**
rather than **outcome**. A structure audit passes on a completely dead system.

That is not hypothetical. On 2026-08-04 it turned out **Create Dispatch had
never once succeeded** — 232 jobs, zero rows in `dispatches`, zero jobs ever
reaching the `dispatched` stage. The modal spread its form state into the
insert, the form carried a `dispatch_mode` field, the table had no such column,
and PostgREST rejected every row. Months of it, with a green audit every
morning.

### Write drift

`checkWriteDrift()` in `lib/health-checks.ts`. The query manifest now records
`.insert` / `.update` / `.upsert` payload keys per column, with the file and
line that writes each one, and the check compares them against the live schema.

A failed write is quieter than a failed read. A failed read shows an empty list,
and eventually somebody asks where their data went. A failed write shows a
success toast and an empty table.

**Spreads are reported as UNVERIFIABLE, never as clean.** `.insert({ ...form })`
hides its field names from every static reader — that is precisely how dispatch
broke — and "I could not check this" must not be recorded as "this is fine".
26 such sites exist today. Removing them one at a time is real work with a real
payoff.

> Getting this **precise** mattered more than getting it working. The first
> version read values as column names — `.update({ status: newStatus })`
> reported a phantom `newStatus` — and produced about 80 false positives. A
> noisy check is a muted check, and a muted check is worth nothing on the day it
> is right. It is now a key/value state machine: 452 columns tracked, zero false
> positives.

Its first run found three more silently broken features, none of which anyone
had reported:

- `jobs.approval_status` / `approval_by` / `approval_remark` did not exist, so
  **no job approval had ever been recorded** — not even `approval_date`, since a
  rejected update saves none of its columns.
- `vendor_categories.checklist_type` did not exist: every vendor category added
  through the quick-add dialog failed. The dialog was a copy of the *product*
  category form and had kept a field that makes no sense for a supplier.
- `user_calendar_events.event_date` did not exist (the column is `start_date`),
  on both the insert and the update path — so **no auto calendar event had ever
  been saved**.

### Expected activity

`lib/activity-expectations.ts`. The only check that asks whether anyone is
getting any work done.

**Every expectation is conditional, by design.** Nothing is ever expected
outright. The check asks "are N jobs sitting at Ready for Dispatch?" and only
then "has anything dispatched in a week?" No work waiting, no alert, ever —
because the alternative is an alert every quiet Tuesday and a muted channel by
Friday. Windows are set to the longest plausible quiet period, not the average
one: a late alert is useful, a false one is worse than none.

On its first live run, three of five checks were silent on healthy data and two
were true positives — 3 jobs waiting with zero dispatches in 7 days (the
original bug, caught in a single query), and no ledger entry in 14 days despite
8 delivered jobs carrying a value.

> **Adding an expectation is a promise that its precondition is the only reason
> the work could be absent.** If silence could ever be legitimate while the
> precondition holds, widen the window or leave the check out.

## Why these do NOT gate the build

There is deliberately **no `prebuild` hook**. The checks run nightly and alert
on Telegram, where a human reads and judges them; they do not stop a release.

For a one-person business a site that refuses to deploy is worse than one that
ships with a known warning. This is not theoretical either: `npm run audit`
exited **1 when the code got better** — `audit-error-handling.js` treated
"below the baseline" as a failure. Had the prebuild hook shipped, every Vercel
deploy would have been blocked from the moment anyone improved an error-handling
site. Fixed 2026-08-04.

Run the checks by hand before pushing anything uncertain:

```
npm run audit
```

If a check ever becomes trustworthy enough to gate on, move it into the build
**on purpose** — not by default.

## What is still NOT covered

Stating this plainly so nobody assumes more protection than exists:

1. **No page is ever rendered by any automated check.** These are `'use client'`
   pages; fetching the HTML server-side returns a shell without executing React.
   A true smoke test needs a headless browser (Playwright), which does not run on
   Vercel cron. Until then, a crash is detected when a human hits it — the
   difference is that now it gets recorded and reported instead of vanishing.

   **A hidden or background tab cannot be used to verify these pages.** SWR does
   not revalidate while `document.visibilityState === 'hidden'`, and
   `useSupabaseQuery` passes `fallbackData: []`, so a backgrounded tab renders a
   fully-populated page showing zero rows and never issues the request at all.
   During the 2026-07-31 verification this looked exactly like a catastrophic
   "no data anywhere" bug — no network request, no console error — and was purely
   an artefact of the tab not being visible. The same page in a real focused
   window showed ₹745.0K across 227 orders, correctly.

   Consequences: any future automated smoke test must force the page visible, and
   data-loading needs a few seconds plus sometimes a refresh after a cold start
   before the numbers settle. Do not conclude a page is broken from a background
   check.
2. **Wrong numbers are not detectable.** Nothing knows what Total Billed *should*
   be. If a figure looks wrong, it must still be reported by a person.
3. **RLS remains wide open** (`USING true`) on several tables — a known,
   separate gap.
4. Crashes are only recorded for signed-in users.
5. **A write whose payload is spread cannot be checked** — see write drift
   above. 26 sites. These are the ones that can still break the way dispatch
   did.

## Open issue found during the 2026-07-31 post-deploy audit

Sales Reports now renders correctly (₹745.0K, 227 orders, 35 clients — all
matching the database), but the collection figures are nonsense:

> RECEIVED ₹2476.5K · **332% collected** · PENDING **−232% outstanding**

This is not a crash and not caused by the select fix. It is a date-window
mismatch created by the 2026-06-19 fresh-start wipe:

| | |
|---|---|
| Earliest **job** in the database | 2026-06-19 |
| Earliest **payment** in the database | 2026-03-30 |
| Received in FY-to-date | ₹24,76,519 |
| Of which received **before** the wipe | ₹17,86,921 (72%) |

The page compares FY-to-date *payments* against *jobs that exist*, and 72% of
those payments belong to jobs that were deleted. Hence >100% collected.

Three possible fixes — this needs a business decision, not a code guess:

1. Only count payments linked to a job still present (most accurate, hides
   genuine pre-wipe cash).
2. Default the date range to 2026-06-19 rather than the FY start, so both sides
   cover the same period.
3. Show billed and received as independent figures and drop the collection %
   entirely.

Until one is chosen, treat the collection rate and Pending on this page as
meaningless. Total Billed and the order list are correct.

## Checklist after any deploy

1. `npm run audit:selects` — must exit clean
2. Build succeeds
3. Open the pages you touched and confirm they render
4. Next morning: no `⚠️ Daily health audit` message in Telegram

## Fixed on 2026-07-31

`npm run audit:selects` **exits clean across 368 files**. All findings from the
first run were fixed by giving each page an explicit `select` and a `limit` above
the 50-row default. Every column added was verified to exist in `information_schema`,
so this did not trade one bug class for the phantom-column one.

The ones that were doing real damage:

| Page | Was |
|---|---|
| `jobs/page.tsx` | Edit form pre-filled from `quote_per_piece`, `design_charge`, `gst_rate`, `quantity`, `vendor_id`, `designer_id` — none fetched. **Opening a job and saving it wrote those back blank.** |
| `sales/orders/page.tsx` | Same shape: `description` and `notes` not fetched, so editing an order wiped them. |
| `designers/team-queue`, `designers/timeline` | `designer_id` not fetched — every job showed as "Unassigned" regardless of assignment. |
| `finance/invoices/page.tsx` | Invoice line items built from unfetched `quantity` / `quote_per_piece` / `gst_rate`; picker also capped at 50 jobs. |
| `finance/reports/vendor-reports` | `vendor_id` not fetched, so grouping by vendor matched nothing; `order_date` exported blank; capped at 50. |
| `reports/page.tsx` | No `created_at` / `order_date` and capped at 50 — every total understated. |
| `design-tasks`, `dispatch/qc-check`, `jobs/planner`, `marketing/dispatch` | Brief, checklist, quantity, notes and ownership fields rendering empty. |

Because the audit is clean, it is now safe to treat as a **hard deploy gate**.

Worth knowing: most of these never crashed. They showed a plausible-looking wrong
value, which is the harder failure to notice. Two of them silently destroyed data
on save. None would have been caught by any check that existed before today.
