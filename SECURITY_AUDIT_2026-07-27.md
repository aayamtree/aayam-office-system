# Security audit — 27 July 2026

Audit of the Aayam Office System against the 11-point checklist Satish shared from X,
plus what that checklist misses for this specific app.

Scope: `app/` (76 API routes, all pages), `lib/`, `middleware.ts`, `next.config.js`,
and the live Supabase project `wrvbodgsykesbaphpbzs` (87 tables, 202 RLS policies).

---

## Correction to the first version of this report

The first draft of this document claimed the Telegram bot token was live in the production
JavaScript bundle. **That was wrong, and the retraction is written up in full below under
"Retracted finding".** The evidence was a stale local `.next` folder built months ago,
before commit `92505a0` moved all Telegram calls server-side. Nothing needs re-rotating.

## Headline

The X post's scariest item — "zero RLS policies means your app is naked" — does **not**
apply here. RLS is enabled on all 87 public tables and there are **zero** policies granting
the `anon` role anything. A stranger with DevTools cannot read the database.

The one genuinely new problem this audit found:

**Three login backdoors** that let any logged-in staff member become admin. These were not
covered by the 25–27 July security work. Now removed.

---

## FIXED in this session

### 1. Three admin backdoors — CRITICAL (genuinely new)

| Backdoor | What it did |
| --- | --- |
| `/emergency` page | Public URL. Wrote a fake `role: 'admin'` profile into localStorage. |
| `aayam_speed_role` | `lib/auth-context.tsx` read a role string straight from localStorage and handed back a matching profile — no server check. `localStorage.setItem('aayam_speed_role','admin')` in DevTools was enough. |
| `bypassLogin()` / `aayam_bypass_mode` | "Quick Login" button + Ctrl+Shift+L on the login page. The button was hidden on non-localhost, but the localStorage flag it set was honoured **everywhere, including production**. |

`middleware.ts` still required a real Supabase session for `/admin/*`, so a total stranger
could not walk in. The exposure was internal: any logged-in staff member — a designer, a
print operator — could flip themselves to admin. Combined with finding #4 below (finance
tables readable by any authenticated user), that meant staff could reach bank transactions,
vendor payments and invoices.

Removed: `app/emergency/`, `app/test/` (a public debug page), `bypassLogin` from
`lib/auth-context.tsx` and `app/login/page.tsx`, and both localStorage role paths. Stale
flags left in staff browsers are actively cleared on next load.

### 2. Slack webhook variable — HYGIENE ONLY, not a live leak

`lib/slack.ts` read `NEXT_PUBLIC_SLACK_WEBHOOK`. Changed to server-only `SLACK_WEBHOOK_URL`.

Being straight about the severity: **this was never leaking.** `lib/slack.ts` is imported by
nothing — it is dead code — and `NEXT_PUBLIC_SLACK_WEBHOOK` is not set in the environment at
all. The rename is correct hygiene so the trap can't spring later if someone wires it up.
No action needed in Vercel.

### 3. No rate limiting anywhere — MEDIUM (checklist item #9, genuinely new)

Nothing capped any endpoint, including three routes that call the paid Anthropic API.
One stuck retry loop in a browser could have run up a real bill.

Added `lib/rate-limit.ts` and applied it:

| Route | Limit |
| --- | --- |
| `/api/products/scan-sheet` | 10/min per IP |
| `/api/products/[id]/scan` | 10/min per IP |
| `/api/analyze-print-sheet` | 10/min per IP |
| `/api/telegram/send` | 30/min per IP |
| `/api/telegram/notify-stage` | 60/min per IP |

Honest limitation, documented in the file: counters live in one serverless instance's
memory, so the true ceiling is roughly (limit × running instances) and resets on cold
start. This turns "unlimited" into "bounded", which is the point. If you ever need hard
global limits, move the counter to Postgres or Upstash Redis — the call signature stays
the same.

---

## Retracted finding — Telegram bot token

**Claimed:** the bot token was inlined into the production browser bundle and had to be
regenerated again.

**Actual:** it is not, and it does not.

How the mistake happened, so it doesn't repeat:

- I grepped `.next/static/chunks/app/admin/layout-*.js` on this machine and found the token.
- That `.next` folder was a **stale local build**, produced before commit `92505a0`
  ("remove hardcoded Telegram bot token from client; all sends via server route with JWT
  verification"). That commit is exactly the fix for this problem, and it already shipped.
- I also read `.env.local` — but that file was pulled from Vercel on **27 May**, two months
  before the July rotation. It says nothing about what is in Vercel today.

The correct check is the import graph, not build artefacts. At `HEAD` (= what is deployed),
`NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` is referenced by exactly four modules:

- `app/api/telegram/webhook/route.ts` — API route, never client-bundled
- `app/api/telegram/setup/route.ts` — API route, never client-bundled
- `app/api/telegram/send/route.ts` — API route, never client-bundled
- `lib/telegram-groups.ts` — imported **only** by API routes and cron routes

No client component imports any of them. `lib/telegram-service.ts` already reads the
server-only `TELEGRAM_BOT_TOKEN`. Next.js only inlines a `NEXT_PUBLIC_` value into modules
that actually reach a client bundle, so the token cannot be in the browser JavaScript.

**What still stands:** removing the `|| process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` fallback
from those four files is worth keeping. It is defence in depth — while that fallback exists,
one careless `import` from a client component would put the token back in the bundle
silently. But it is cleanup, not an incident. **Do not re-rotate the token, and there is no
urgency to touch Vercel.** Deleting the now-unused `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` variable
is tidy-up to do whenever convenient.

---

## Already done on 25–27 July — no need to repeat

For the record, so this audit doesn't send you back over old ground:

| Work | Where | Status |
| --- | --- | --- |
| Credential rotation (Anthropic, Telegram, Google, VAPID, NextAuth, GitHub token) | `SECURITY_KEY_ROTATION_2026-07-26.md` | Done by Satish |
| Security headers + CSP baseline | commit `dab9c6c` | Done |
| `lib/api-auth.ts` guards on service-role routes | commit `dab9c6c` | Done |
| `/api/telegram/setup` gated on admin session | commit `65b0b35` | Done |
| Client finance moved behind a role-gated route | commit `bacc563` | Done |
| Browser-side Telegram token removed | commit `92505a0` | Done |
| NextAuth debug logging off in prod | commit `30f1995` | Done |
| RLS lockdown | `SECURITY_RLS_PLAN_2026-07-26.md` | Proposal only — still open |

**One live item from that work worth checking:** rotating the VAPID keys wiped all 145 push
subscriptions. The table currently holds **8**. So roughly 11 of your 19 staff still have no
phone notifications and probably haven't noticed. That is a working-system problem today,
independent of security.

---

## RLS Phase 1 — DONE (27 July, migration `rls_phase1_drop_redundant_open_policies`)

Dropped **19 redundant duplicate policies** across 9 tables. Policy count 202 → 183.

Every one was provably redundant because a broader open policy on the same table
remains, so **effective access is identical**. Verified by snapshotting open
SELECT/INSERT/UPDATE/DELETE per table before and after — all 9 tables came back
`access_unchanged = true`.

| Table | Dropped | Kept |
| --- | --- | --- |
| `clients` | 4 | `clients_all` (ALL, open) |
| `vendors` | 4 | `vendors_all` (ALL, open) |
| `jobs` | 3 | `Public jobs access` + strict admin/finance DELETE |
| `design_tasks` | 2 | `design_tasks_open_all` + 4 strict policies |
| `quotations` | 2 | `quotations_open_all` |
| `activity_logs` | 1 | duplicate INSERT policy removed |
| `calendar_event_mentions` | 1 | ALL policy already covered SELECT |
| `design_projects` | 1 | ALL policy already covered SELECT |
| `job_checklists` | 1 | ALL policy already covered SELECT |

Deliberately left alone: `product_categories`, `chat_channels`, `chat_channel_members`,
`job_stage_history`, `payments_received`, `pos_sales`, `pos_sale_items`, `purchase_bills`.
These *look* like they have stacked open policies, but each policy covers a **different
command** — none is redundant, and dropping any would have changed behaviour.

Strict/role-based policies were kept everywhere, even though the remaining open policy
still overrides them. They document the intent Phase 2 will switch on.

Still true after this: RLS on all 87 tables, **zero** anon policies, 64 open
`USING(true)` policies remaining (was 78).

---

## RLS Phase 2 — DONE (27 July, migration `rls_phase2_lock_bank_and_cash_reads`)

**The money tables are now admin-only.**

Phase 2 turned out to be far smaller than expected. Writes on `bank_accounts`,
`bank_transactions`, `cash_accounts`, `cash_transactions`, `vendor_payments`,
`journal_entries` and `direct_payees` were **already** restricted to
`fn_is_finance_staff()` by earlier work. Only four SELECT policies were still
`USING(true)` — and those four were what let any of the 19 staff accounts read every
bank and cash movement from the browser console.

Four policies replaced:

| Table | Before | After |
| --- | --- | --- |
| `bank_accounts` | `SELECT USING (true)` | `USING (fn_is_finance_staff())` |
| `bank_transactions` | `SELECT USING (true)` | `USING (fn_is_finance_staff())` |
| `cash_accounts` | `SELECT USING (true)` | `USING (fn_is_finance_staff())` |
| `cash_transactions` | `SELECT USING (true)` | `USING (fn_is_finance_staff())` |

All seven money tables now report **no open policy on any command**. Open policies
across the database: 78 → 64 (Phase 1) → 60.

### Why this was safe

Every screen reading these tables is already role-gated in the sidebar to
`admin` + `finance`: all of `/admin/finance/*`, all of `/admin/reports/*`, and
`/admin/jobs`. The one server route that touches them
(`/api/crm/clients/[id]/finance`) uses the **service role**, which bypasses RLS
entirely — unaffected.

The one borderline case was `/admin/jobs`, which pulls bank and cash accounts for a
payment-account dropdown. It is admin-gated anyway, and the dropdown is guarded by
`.length > 0`, so the worst case is "no options shown" rather than an error.

Worth knowing: **under RLS, a blocked SELECT returns zero rows — it does not raise an
error.** So the failure mode for a non-admin is always "sees nothing", never a crash.

### Two things this does NOT cover

1. **`fn_finance_overview_pnl` and `fn_finance_period_review` are `SECURITY DEFINER`**,
   which means they bypass RLS by design. A non-admin who called them directly would
   still get P&L totals. Closing this needs a role check inside the function body —
   a `GRANT` won't work, because every staff member is the same `authenticated` role.
2. **`invoices`, `payments_received` and `purchase_bills` are still readable by all
   staff.** I deliberately left them: unlike the money tables, these are read by
   components that run for every role — `Header.tsx` (overdue notifications),
   `CommandPalette`, `OverdueAlertsWidget`, and `CreatePrintRunForm`, which *inserts*
   a purchase bill when print staff record paper. Locking them without changing those
   components first would silently blank out notifications and break print-run
   creation. That is a code change, not a policy change.

---

## NOT fixed — needs your decision

This is the biggest remaining gap and it is a judgement call, not a quick fix.

Of 202 RLS policies, **93 are wide open** (`USING (true)`). None grant `anon` — they all
grant `authenticated`. So the boundary between "outsider" and "staff" is solid; the
boundary **between staff roles does not exist at the database level**.

Tables where any authenticated user can currently read:

`bank_accounts`, `bank_transactions`, `cash_accounts`, `cash_transactions`,
`invoices`, `payments_received`, `profiles`, `expense_categories`, `push_subscriptions`

And read *and write*: `vendors`, `vendor_categories`, `cmyk_expenses`, `cmyk_client_payments`

Right now a designer is stopped only by the UI not showing them the finance screens. That
is a locked door with the key hanging next to it.

The fix is role-scoped policies using the existing `fn_is_admin()` helper. I did not apply
it because tightening RLS can break working pages until each policy is tuned, and that
needs testing screen by screen rather than a blind migration. `SECURITY_RLS_PLAN_2026-07-26.md`
already sketches the approach.

### 6. Google OAuth callback uses `state` as a user ID — MEDIUM

`app/api/drive/callback/route.ts` line 74: `const userId = state || null;`

`state` exists to prevent CSRF and should be an unguessable nonce you generate and verify.
Using it to carry a user ID means someone could craft a callback URL with another user's
ID and attach their own Google account to that user's record. Fixing it properly needs a
short-lived nonce table, so it is a small project rather than a quick win. Lower urgency
because Drive uploads now go through the service account, not per-user OAuth.

### 7. `.env` and `vapid.env` are in git history — MEDIUM

Commit `6a39a46` ("stop tracking .env file") removed them from the working tree, but git
keeps history. Anyone who can clone the repo can read the old values. The current
`.gitignore` is good — it explicitly covers `aayam-office-*.json`, `*service-account*.json`,
`*.pem`, `*.key`, and the service-account key file is confirmed **not** tracked.

Options: rotate every secret that was ever in those files (simplest, recommended), or
rewrite history with `git filter-repo` (disruptive). `SECURITY_KEY_ROTATION_2026-07-26.md`
covers the rotation path.

### 8. 86 places return raw `error.message` to the browser — LOW (checklist item #11)

Postgres errors leak table and column names. Not exploitable on its own, but it hands an
attacker a free schema map. Worth a sweep, too broad to do safely in one pass.

---

## Checked and already fine

| Checklist item | Status |
| --- | --- |
| #2 RLS | Enabled on all 87 tables; **zero** anon policies. Public exposure is closed. |
| #4 Security headers | Strong. Full CSP, HSTS 2yr preload, `frame-ancestors 'none'`, `X-Content-Type-Options`, `Permissions-Policy`, `poweredByHeader` off. Better than most production apps. |
| #6 Server-side validation | API routes re-validate. `app/api/crm/clients/route.ts` uses an `ALLOWED_FIELDS` whitelist — good pattern, worth copying. |
| #5 SQL injection | Not reachable. Everything goes through the Supabase client, which parameterises. |
| #8 API keys in frontend | `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are all server-only. Only the two above were leaking. |
| Auth guards | 71 of 76 API routes guard properly. The 5 that looked unguarded were false positives except `notify-stage`, which is deliberately open (called by a Postgres trigger via pg_net) and defends itself by re-reading the real stage from the DB and deduping. Now rate-limited too. |
| #3 Auth failure paths | Supabase returns a generic "Invalid login credentials" — it does not reveal whether an email exists. Correct behaviour. |
| #10 CORS | Next.js API routes are same-origin by default; no permissive CORS headers found. |
| #10 CAPTCHA | Not needed — there are no public signup or contact forms. The only public page is `/track/[jobNumber]`, which reads 7 non-sensitive job fields. Login is Supabase-hosted with its own throttling. |
| #1 Privacy policy | This is an internal staff tool, not a consumer product — GDPR/CCPA exposure is minimal. Worth a short internal data-handling note eventually, not urgent. |

---

## Your actions

**Nothing urgent. Do not re-rotate anything.**

1. **Chase the push notifications.** 8 of ~19 staff have re-enabled. This is the only item
   with a real cost today.
2. **Decide on the finance RLS gap** (finding #5). That is the next real piece of work, and
   it is the same item as B1 in `NEXT_STEPS_2026-07-27.md`.
3. **Whenever convenient:** delete `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` from Vercel. The code no
   longer reads it. No redeploy urgency, no token change.

Rule of thumb worth keeping: **`NEXT_PUBLIC_` means "print this on a billboard".**
Only the Supabase URL, the anon key, and the VAPID *public* key belong there.

---

## Verification

- TypeScript type-check across the whole project: **passes clean** (`tsc --noEmit`, no errors).
- Confirmed no remaining references to `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`,
  `NEXT_PUBLIC_SLACK_WEBHOOK`, `bypassLogin`, `aayam_speed_role` or `aayam_bypass_mode`
  anywhere in `app/`, `components/`, `lib/`, `hooks/`.
- Full `next build` could **not** be run here — the sandbox container runs out of memory
  and dies with a bus error before the compile step. Vercel's build is the real gate.
  Nothing was deployed; the changes are local and uncommitted.
