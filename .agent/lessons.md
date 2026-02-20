# Self-Improvement Lessons — Aayam Office System

> Review this file at the START of every session. Update after EVERY user correction.

---

## 🔴 Layout & Grid Rules

### Card List Grid Standard
**Mistake:** Used `grid-cols-1 md:grid-cols-2` for follow-up cards — inconsistent with rest of app.
**Rule:** ALL card-list pages MUST use `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`.
**Exception:** Form field grids and link button pairs (2-col) are fine.
**Prevention:** Before touching any card grid, grep the app for the standard pattern and match it.

### Sidebar Content Overlap
**Mistake:** Pages had their own `min-h-screen` wrappers conflicting with admin layout.
**Rule:** Never add `min-h-screen` or internal headers to pages inside the admin layout. The layout handles spacing.

---

## 🔴 Database & Query Rules

### Supabase Foreign Key Joins
**Mistake:** Used FK join patterns (`profiles!assigned_to`) on columns that have NO foreign key constraint in the DB.
**Root Cause:** The `leads` table was created from `CREATE_MARKETING_TABLES_SIMPLE.sql` which defines `assigned_to UUID` and `created_by UUID` WITHOUT `REFERENCES profiles(id)`. Without the FK constraint, ALL join patterns fail silently.
**Rule:** BEFORE using FK joins in Supabase select:
1. Check the actual table creation SQL to verify FK constraints exist
2. If no FK constraint → use `select: '*'` and look up related data client-side
3. If FK exists → use `profiles!column_name(fields)` pattern
**Fallback:** Fetch profiles separately and look up names via `.find()` on the client.

### SQL Index Scripts Must Be Error-Proof
**Mistake:** Bare `CREATE INDEX` statements fail if table/column doesn't exist.
**Rule:** Wrap ALL index creation in `DO $$ BEGIN ... EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;`

---

## 🔴 Feature Design Rules

### Admin-Created Resources Must Stay Visible to Admin
**Mistake:** Admin-assigned leads disappeared from admin's view because query joined incorrectly.
**Rule:** When admin assigns something to another user, admin MUST still see it. Always verify visibility after assignment features.

### Origin/Source Indicator Required
**Mistake:** Created lead assignment without showing marketing staff WHERE the lead came from.
**Rule:** Whenever a resource is assigned from one user to another, add a visible origin badge (e.g., "📌 Assigned by [name]").

---

## 🔴 Process Rules

### Always Audit Before Fixing
**Mistake:** Fixed follow-up cards layout to 2-col without checking what the app standard was (3-col).
**Rule:** Before fixing any UI inconsistency, ALWAYS:
1. Grep the entire app for the pattern
2. Count how many pages use which pattern
3. Identify the majority/standard
4. Fix ALL non-compliant pages in one pass

### Don't Make Ad-Hoc Fixes
**Mistake:** Fixed one page's layout without checking others.
**Rule:** Any fix that touches a pattern used across multiple pages → audit ALL pages first, fix ALL at once.

### Collect ALL Feedback First
**Mistake:** Jumped into fixing after first feedback, didn't wait for all issues.
**Rule:** When user says "this is 1/3" or indicates multiple items, WAIT for ALL items before implementing. Batch fixes together.

### Sidebar Data Must Be Lightweight
**Rule:** Sidebar runs on EVERY page. Never add heavy hooks like `useLeads()` to sidebar. Use `select('id', { count: 'exact', head: true })` count queries instead.

### When FK Joins Fail, Use Client-Side Lookups
**Rule:** If a table was created without FK constraints, use `profilesMap` or `staffList.find()` patterns to resolve UUIDs to names on the client side. Don't try to fix it by guessing FK syntax.

---

## 🟡 Checklist Before Any Change

- [ ] Is this pattern used elsewhere? → Grep first
- [ ] Does admin still see the resource after assignment?
- [ ] Are FK joins using column names (not constraint names)?
- [ ] Does the card grid match the 3-col standard?
- [ ] Will the user know WHO created/assigned this item?
- [ ] Am I making an ad-hoc fix? → Audit system-wide instead

---

*Last updated: 2026-02-20*
*Corrections captured: 10*
