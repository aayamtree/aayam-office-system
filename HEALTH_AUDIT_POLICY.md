# Health Audit Policy

Last updated: 2026-07-31

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
| Privileged | **Page crashes in last 24h, grouped by page + message** | **2026-07-31** |

"Privileged" means an admin session or the cron secret. Row counts tell a
passer-by how many clients the business has, so they are gated.

### The status rule

`status` is now `degraded`, not `healthy`, if any of these are true:

- One or more unresolved page crashes in the last 24 hours
- `TELEGRAM_BOT_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY` missing
- Any Telegram alert failed to deliver

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

## Pre-deploy check: `npm run audit:selects`

The runtime chain above catches a crash *after* a staff member hits it. This
catches this particular bug class *before* it ships.

`scripts/audit-select-contracts.js` compares what a page's query fetched against
what the page actually reads off the result, and fails (exit 1) on a mismatch.

```bash
npm run audit:selects
```

**Run before every deploy.** It is also wired as `predeploy` in `package.json`.

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

## What is still NOT covered

Stating this plainly so nobody assumes more protection than exists:

1. **No page is ever rendered by any automated check.** These are `'use client'`
   pages; fetching the HTML server-side returns a shell without executing React.
   A true smoke test needs a headless browser (Playwright), which does not run on
   Vercel cron. Until then, a crash is detected when a human hits it — the
   difference is that now it gets recorded and reported instead of vanishing.
2. **Wrong numbers are not detectable.** Nothing knows what Total Billed *should*
   be. If a figure looks wrong, it must still be reported by a person.
3. **RLS remains wide open** (`USING true`) on several tables — a known,
   separate gap.
4. Crashes are only recorded for signed-in users.

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
