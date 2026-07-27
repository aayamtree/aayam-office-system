# RLS Lockdown Plan — 26 July 2026

**Status: proposal only. No database changes have been made.**

---

## The situation today

Row Level Security is switched on for essentially every table, which looks reassuring in the Supabase dashboard. But the policies themselves are almost all `USING (true)` / `WITH CHECK (true)`, which means they permit everything. RLS is on, and it is letting everyone through.

The practical effect: **any of your 19 staff accounts can read and write every row in the database** — including tables they have no screen for. The app hides things in the UI, but the UI is not the security boundary. Anyone who opens the browser console on a page they *are* allowed to see can query anything.

Your current staff:

| Role | Users | Active |
|------|-------|--------|
| designer | 8 | 8 |
| admin | 4 | 4 |
| marketing | 3 | 2 |
| dispatch | 2 | 2 |
| cmyk | 2 | 2 |

So today, all 8 designers and both dispatch staff can read your full P&L, every client's rates, every vendor payment, and all salary-adjacent data — and could alter it.

### Worst offenders

`leads` has **9 policies, 8 of them wide open** — including duplicates named `Open Access`, `Super Open Access`, `allow_all_leads`, and `leads_open_all`. These accumulated over time as fixes were layered on. In Postgres, permissive policies are OR-ed together, so **one open policy defeats every strict policy on the same table.** Removing the duplicates is a prerequisite for anything else working.

Same pattern: `follow_ups` (7 of 7 open), `vendors` (5 of 5), `clients` (5 of 5), `jobs` (4 of 5), `quotations` (3 of 3).

One other item: `telegram_stage_alerts` has RLS enabled with **zero** policies, which means nobody can read it except the service role. That's not a hole, but it may be an accident worth confirming.

---

## What I propose

### Guiding principle

Keep it simple enough that you can reason about it a year from now. Four access tiers, not twenty-five bespoke policies:

| Tier | Who | Tables |
|------|-----|--------|
| **Shared operational** | any active staff | jobs, job_stages, clients, dispatches, print_runs, materials, machines, catalog_items, counters |
| **Finance** | admin + finance roles | invoices, payments_received, vendor_payments, bank_*, cash_*, expenses, purchase_bills, direct_payees |
| **CMYK** | admin + cmyk role | cmyk_* tables, pos_* tables |
| **Own-row only** | the owning user | notifications, push_subscriptions, user_calendar_events, designer_notes, work_logs |

### Helper functions

Two already exist and are correctly written (`STABLE SECURITY DEFINER` with a pinned `search_path`):

- `fn_is_admin()`
- `fn_is_finance_staff()` — checks for roles `admin`, `finance`, `account`

**Note:** `fn_is_finance_staff()` looks for roles `finance` and `account`, but **neither role exists in your profiles table.** Right now it resolves to "admin only". Before locking down finance tables we need to decide: does your accountant get a `finance` role, or do they keep using an admin login? This is the first thing to settle.

I'd add one more helper, `fn_is_staff()`, returning true for any active profile, so "logged in" and "active employee" stop being the same thing — that gives you a real off-switch when someone leaves.

### Order of work

**Phase 0 — clean up duplicates.** Drop the redundant open policies on `leads`, `follow_ups`, `vendors`, `clients`, `jobs`, `quotations`. No behaviour change (the remaining open policy still permits everything), but it makes the next phases meaningful. Low risk, do it first.

**Phase 1 — finance tables.** Highest value, smallest blast radius, because only admins use those screens. Replace `USING (true)` with `USING (fn_is_finance_staff())` on the finance tier.

**Phase 2 — own-row tables.** `notifications`, `push_subscriptions`, `user_calendar_events`. Straightforward `user_id = auth.uid()` policies.

**Phase 3 — CMYK tables.** Restrict to admin + cmyk.

**Phase 4 — shared operational tables.** Tighten writes to active staff; keep reads broad. This is the largest and riskiest phase and should come last.

---

## What could break, honestly

This is where I want your attention before we touch anything.

1. **Dashboards that quietly aggregate finance data.** If any designer- or dispatch-facing screen sums revenue or job values client-side, it will start showing zeros rather than an error. Silent wrong numbers are worse than a visible failure. Every finance-touching query needs auditing first — this is the bulk of the work, not the SQL.

2. **The `anon` write problem you've already hit.** Your notes record that browser writes fail as `anon` when the Supabase session lapses, and that the fix was to route privileged writes through service-role API routes. Tightening RLS will expose any remaining spot where that pattern wasn't applied. Those will surface as writes that silently do nothing.

3. **Database triggers.** Several tables are written by triggers (print-run→stage sync, Telegram stage alerts via `pg_net`). Triggers run as the invoking user unless the function is `SECURITY DEFINER`. If a trigger writes to a table the user can no longer write to, the *original* action fails too. Every trigger function needs checking before its target table is locked.

4. **Realtime subscriptions.** Supabase Realtime respects RLS. Anything a user can't select, they stop receiving live updates for.

### How to do this safely

Roll out **one phase at a time, on a normal working day, not a Friday**, and watch for an hour. Supabase branches let us test against a copy of real data first — I'd strongly recommend using one rather than editing production directly. Every phase should ship with the exact `DROP POLICY` statements needed to reverse it.

---

## What I need from you before Phase 1

1. **Does your accountant get a `finance` role, or stay on admin?** Everything downstream depends on this.
2. **Should designers see job values and client rates at all?** They currently can. If the answer is no, that changes the shared-operational tier.
3. **Are the 4 admin accounts all genuinely yours?** Four admins out of 19 staff is a lot of full access. Worth reviewing who they are.
4. **Green light to create a Supabase branch** for testing, so nothing is tried on live data first.

---

## Effort estimate

| Phase | Work | Risk |
|-------|------|------|
| 0 — drop duplicates | ~1 hour | Very low |
| 1 — finance | Half a day, mostly auditing queries | Medium |
| 2 — own-row | ~2 hours | Low |
| 3 — CMYK | ~2 hours | Low–medium |
| 4 — operational | A full day, needs the most testing | Highest |

Phases 0–2 give you most of the benefit. Phase 4 is optional and can wait indefinitely if the appetite for disruption is low.
