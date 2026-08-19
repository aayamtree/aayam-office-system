# Turning on vendor bills (three steps, ~5 minutes)

The code is deployed. Bills will **not** appear until you do these three things,
because a new Zoho permission needs your consent and a webhook rule needs to be
created inside Zoho.

Why this matters: before this, the Finance page reported **₹32,209** owed to
vendors — from 5 rows in the app's own table — while Zoho held the real figure,
much of it 50 to 110 days past due.

---

## Step 1 — Re-approve Zoho (30 seconds)

Reading bills is a new permission. The token we already hold was granted before
that permission existed, so it cannot read bills, and it will not fail loudly —
it will simply return nothing.

1. Sign in to the app as admin
2. Visit **https://aayam-office-system.vercel.app/api/zoho/oauth/start**
3. The consent screen now lists **bills** alongside banking, invoices, estimates
   and settings. All still **read-only** — the app cannot change your books.
4. Click **Accept**

---

## Step 2 — Create the Bills workflow rule in Zoho

Webhooks in Zoho are per-module. The existing rules cover Invoices and Quotes;
Bills needs its own. Copy the invoice rule exactly:

1. Zoho Books → **Settings** (gear) → **Automation** → **Workflow Rules**
2. Open **"Sync invoice to office app"** and note its webhook URL
3. **+ New Workflow Rule**
   - Name: `Sync bill to office app`
   - Module: **Bill**
   - Execute when: **Created or Edited**, **Any field**, edited **every time**
   - Filter/criteria: **none** (all bills)
   - Action: **Webhook** → same URL as the invoice rule (it already carries the
     `?key=` secret) → Method **POST** → **Default payload (JSON)**
4. **Save** and make sure the rule is **active**

---

## Step 3 — Pull the bills already in Zoho

Workflow rules only fire on the *next* create or edit, so on day one the app
would hold only whatever bill you happened to touch. Same trap as invoices.

1. Open **Finance → Zoho Books** in the app
2. Press **Fetch this FY from Zoho**
3. It reports how many bills came in. Press it again if it says anything remains.

---

## What changes after this

- A **Bills** tab on the Zoho Books page: every vendor bill, what is still owed,
  what is already overdue, line items on click.
- The **Purchases** card on Finance stops reading the app's `purchase_bills`
  table and reports the real Zoho figure.
- The twice-daily cron (`/api/cron/zoho-invoice-sync`, 08:30 and 18:30 IST)
  refreshes bills as well as invoices — because paying a bill in Zoho changes
  its status *without* anyone editing the document, so the webhook alone would
  leave a paid bill showing as overdue forever.

## The rule that has not changed

**Bills are created in Zoho only.** The app mirrors them, read-only, and never
writes back. Do not start entering bills in both places — a bill entered twice
is a payable counted twice, and the app's old `purchase_bills` table (5 rows)
is deliberately no longer part of the payables figure.
