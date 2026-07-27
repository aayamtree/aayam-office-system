# Aayam Office System — Full App Audit
**Date:** 25 June 2026
**Method:** Static code analysis (every page, API route, component) + database cross-check (live Supabase schema) + TypeScript build + live click-through of the deployed app.
**Scope:** Entire app — 121 pages, 51 API routes, 124 components, ~80 DB tables, 21 RPCs.

---

## Summary

The app is structurally healthy. The build is clean, navigation almost entirely resolves, and the core revenue flow (Jobs → Print Planner → Print Runs → Finance) works end to end. The print-planner fix from earlier today is confirmed working — the 10 ready-to-print jobs flowed through and are now in print run **PP-00001**.

The "loops and holes" you've been hitting trace to **10 concrete issues**, almost all of the same kind: code that references a database table, function, or storage bucket that no longer exists after the revamp. These fail silently (data isn't saved, a list shows empty) rather than crashing, which is exactly why they're hard to spot.

| Severity | Count |
|---|---|
| 🔴 High — data silently lost or feature broken | 6 |
| 🟠 Medium — feature broken, no data loss | 3 |
| 🟡 Low — cosmetic / dead link | 1 |

---

## 🔴 High severity

### 1. `qc_records` table missing — QC checks are not saved
The QC check screen, dispatch receipt flow, and print-runs all insert into a `qc_records` table that does not exist in the database. Every QC record entered is silently lost.
- **Used in:** `app/admin/dispatch/qc-check/page.tsx`, `app/admin/dispatch/page.tsx`, `app/admin/dispatch/history/page.tsx`, `app/admin/print-runs/page.tsx`, `app/admin/jobs/[id]/page.tsx`
- **Fix:** Create the `qc_records` table (needs column definitions matching the insert payloads).

### 2. `work_logs` table missing — work logging fails
Designer/work activity logging writes to `work_logs`, which doesn't exist.
- **Used in:** `components/eod/EODNudge.tsx`, `lib/work-logger.ts`, `lib/hooks.ts`
- **Fix:** Create the `work_logs` table, or remove the logging calls if the feature was retired.

### 3. `designers` table missing — Designers page fully broken (live-confirmed)
`/admin/designers` reads and writes a `designers` table that doesn't exist. The page shows "No designers found", and the dashboard "Team Workload" widget is empty for the same reason. Adding/editing a designer fails.
- **Used in:** `app/admin/designers/page.tsx`
- **Likely cause:** The revamp moved designers into the newer **designer-module** (and/or `profiles`). This legacy page was left pointing at the old table.
- **Fix:** Either point this page at the current source (`profiles` / designer-module), or remove it if it's superseded.

### 4. Storage bucket `documents` missing — designer ID uploads fail
Uploading a designer's identity document targets a `documents` storage bucket that doesn't exist (buckets present: `attachments`, `chat-files`, `files`, `payment-proofs`).
- **Used in:** `app/admin/designers/page.tsx`, `components/settings/DesignersManager.tsx`
- **Fix:** Create the `documents` bucket, or repoint to an existing bucket.

### 5. Storage bucket `uploads` missing — Label Studio & label-check uploads fail
Brand logo uploads and label-check image uploads target an `uploads` bucket that doesn't exist.
- **Used in:** `components/label-studio/BrandsManager.tsx`, `app/api/label-check/route.ts`
- **Fix:** Create the `uploads` bucket, or repoint to an existing bucket.

### 6. RPC `update_bank_balance_delta` missing — bank balance may not update
A finance categorization hook calls `update_bank_balance_delta`, which doesn't exist. Bank balance adjustments through that path fail silently — a real risk for finance accuracy.
- **Used in:** `lib/categorization-hooks.ts`
- **Fix:** Create the function, or replace the call with the existing balance logic (`update_bank_account_balance` / `recalculate_account_balances` both exist).

---

## 🟠 Medium severity

### 7. RPCs `mark_notification_read` / `mark_all_notifications_read` missing
Clicking a notification (or "mark all read") in the notification bell calls these two functions, which don't exist — notifications can't be marked read.
- **Used in:** `components/NotificationBell.tsx`
- **Fix:** Create the two functions, or switch to a direct `update` on the `notifications` table.

### 8. `eod_edit_log` table missing — EOD edit audit not recorded
Editing an EOD report tries to log the change to `eod_edit_log`, which doesn't exist.
- **Used in:** `lib/hooks.ts`
- **Fix:** Create the table, or remove the audit-log insert.

### 9. `task_remarks` table missing — task remarks fail
A task remarks feature writes to `task_remarks`, which doesn't exist.
- **Used in:** `lib/hooks.ts`
- **Fix:** Create the table, or remove the feature if retired.

---

## 🟡 Low severity

### 10. Dead link in notification bell
`components/NotificationBell.tsx` links to `/admin/notifications`, which has no page. The real page is `/admin/settings/notifications`.
- **Fix:** Update the link target (one-line change).

---

## Workflow note (not a code bug — confirm intent)
The 10 jobs in print run **PP-00001** (status "at printer") still have job stage `ready_to_print`, not `printing`. Creating/sending a print run does not advance the job stage. If you intend a job to flip to "Printing" when its run goes to the printer, that automation is currently missing. If stage is meant to advance only when the run is marked received/printed, this is working as designed.

---

## What's healthy (verified)
- **TypeScript build:** 0 errors across the whole project.
- **Navigation:** all 60 internal link targets resolve to real pages except issue #10.
- **API routes:** all 51 routes exist; every `fetch('/api/...')` call resolves to a real route.
- **Buttons:** no empty/no-op `onClick` handlers, no `#` dead anchors, no "coming soon" placeholders across 1,054 handlers.
- **Database:** ~70 of ~80 referenced tables and 18 of 21 RPCs resolve correctly. Only the items above are broken.
- **Live pages load clean:** dashboard, jobs, print planner, finance/invoices, marketing dashboard, CMYK overview — no console errors.
- **Print planner fix:** confirmed working (jobs flowed through into PP-00001).

---

## Recommended next step
Issues #1–#5 and #7–#9 are all "missing database object" problems. For each, the decision is the same: **recreate the object** (if the feature is still wanted) **or remove the calling code** (if the revamp retired it). The fastest safe path is to recreate the missing tables/functions/buckets so nothing silently fails, then retire genuinely dead features later. Issues #6 and #10 have direct one-step fixes.
