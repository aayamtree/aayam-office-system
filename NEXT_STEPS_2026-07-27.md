# What's Left — Step by Step
**27 July 2026**

Most of the remaining work is mine, not yours. This document is split so you don't spend time on things I can just do.

- **Part A** — only you can do these. Two items.
- **Part B** — say the word and I'll do these. Five items.

---

# PART A — Only you can do these

## A1. Tell staff to re-enable phone notifications

**Why:** rotating the VAPID keys invalidated every push subscription. All 145 are gone. Until each person re-enables, nobody gets phone alerts.

**When:** today. This is the only thing with a real deadline.

**Steps:**

1. Send your team a message. Something like:

   > We updated the app's security this weekend. Phone notifications have been reset — please open the office app on your phone, and when it asks about notifications, tap Allow. One time only. Tell me if you don't see the prompt.

2. Ask them to confirm once done.
3. Tell me when a few have done it, and I'll check the database to confirm subscriptions are coming back.

**How long:** 2 minutes for you, then it trickles in over the day.

---

## A2. The accountant's PC

**Why:** this is the loose end from the original leak. That committed file existed to move settings to another machine. The keys in it are all dead now, so there's no emergency — but if you set it up the same way again, you recreate the problem.

**Three options, best first:**

### Option 1 — Stop running a second copy (recommended)

Have the accountant use `aayam-office-system.vercel.app` in a browser, like everyone else. No keys on their machine, nothing to leak, no second version to keep in sync.

**Steps:** create them a login if they don't have one, send them the web address, delete the local copy from their PC.

**Worth asking:** why was a local copy set up originally? If it was speed or offline access, tell me — there may be a better fix.

### Option 2 — Keep the local copy, deliver settings by hand

**Steps:**

1. On the accountant's PC, open the project folder
2. Create a file called `.env.local` (note the leading dot)
3. You send them the values through a password manager or Signal — **never** email, WhatsApp, or the repo
4. They paste the values in and save

`.env*` is now in `.gitignore`, so this can't be committed by accident.

### Option 3 — Give them read-only database access instead

If they only need to *look* at figures, I can set up a Supabase account limited to what an accountant needs. Tell me if this sounds right and I'll scope it.

---

# PART B — Say the word and I'll do these

Listed by value. You don't need to do anything except tell me which.

## B1. Finish the finance lockdown (Phase 2)

**What:** the seven finance tables I couldn't lock this morning — `invoices`, `purchase_bills`, `payments_received`, `bank_accounts`, `bank_transactions`, `cash_accounts`, `cash_transactions`.

**Why it wasn't done:** each is read by a screen that non-finance staff use. Locking them today would have broken things silently.

**What I'd do:**

1. Change the dispatch board to use `jobs.invoice_reference` instead of reading the `invoices` table. It already has a fallback for this, so the change is small.
2. Move the job detail page's `purchase_bills` read to a server route, which bypasses RLS safely.
3. Work through the remaining five screens the same way.
4. Test each as a designer, dispatch user and admin before applying — same method as this morning.
5. Apply, verify, keep the rollback ready.

**Risk:** medium. This touches screens people use daily. I'd do it in three or four small deploys, not one.

**Time:** half a day of my work, spread over a few sessions. Best done outside working hours.

**If we skip it:** designers still can't see the P&L or vendor payments — that's the big one, already done. They *can* still see invoices, client payments and bank transactions.

---

## B2. Sort out the Telegram admin group

**What:** you have two chats both called ADMIN@AAYAM.

| Chat ID | Department | Added |
|---|---|---|
| `-5036223208` | `admin` | 14 July |
| `-1003944839914` | *(blank)* | 23 July |

The `-100...` prefix means a supergroup. Telegram changes a group's ID when it's upgraded to a supergroup, so this is almost certainly your admin group before and after an upgrade — with the department label stuck on the old, possibly dead, one.

**Why it matters:** your EOD report and weekly scorecard go to groups tagged `admin`. If that tag is on the dead chat, those reports are going nowhere.

**What I need from you first:** I'll send a test message to each chat, and you tell me which one arrives. Then I set the department on the live one and deactivate the other.

**Risk:** none. Two test messages to your own admin group.

**Time:** five minutes.

---

## B3. Clean up the duplicate open policies

**What:** `leads` has 9 database rules, 8 of them wide open, with names like `Open Access`, `Super Open Access`, `allow_all_leads` and `leads_open_all`. `follow_ups` has 7, all open. Same on `vendors`, `clients`, `jobs`, `quotations`.

**Why it matters:** these pile up when fixes get layered over time. One open rule cancels out every strict rule on the same table — so until they're gone, any future lockdown on those tables silently does nothing.

**What I'd do:** delete the redundant duplicates, keeping one. Access doesn't change at all — the remaining rule still allows everything.

**Risk:** very low. No behaviour change by design, and I'd verify by impersonating each role before and after.

**Time:** under an hour.

---

## B4. Turn off NextAuth debug logging

**What:** `debug: true` is hardcoded in your auth route. It's writing extra detail into your production logs — you can see the warning in Vercel.

**What I'd do:** change it to only run in development, then deploy.

**Risk:** none.

**Time:** five minutes including deploy.

---

## B5. Fix the Label Studio upload limit

**What:** Label Studio sends the whole file through the server, so Vercel rejects anything over about 4.5 MB — that's the error you hit this morning. Your Product Library doesn't have this problem because it reads files from Drive instead.

**What I'd do:** make Label Studio work the same way as the Library — upload to Drive first, then send the link. That removes the limit entirely.

**Worth asking first:** you were planning to retire Label Studio anyway. If the Library now covers everything you need, the better fix is to delete Label Studio rather than repair it. Tell me which.

**Risk:** low.

**Time:** an hour or two, or ten minutes if we remove it instead.

---

# Suggested order

1. **A1** — today, it has a deadline
2. **B4** and **B2** — quick wins, five minutes each
3. **A2** — decide the accountant approach, no rush
4. **B3** — clears the way for later work
5. **B5** — after you decide keep-or-remove
6. **B1** — the big one, plan it for an evening

Nothing here is urgent. The genuinely serious problems were fixed on 26–27 July: the exposed Google Drive tokens, the leaked credentials, the missing security headers, and the P&L that every employee could read.
