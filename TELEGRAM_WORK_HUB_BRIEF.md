# Telegram Work Hub — Implementation Brief
### Aayam Creative Internal Communication System

---

## The Problem

Shop floor team (CMYK + Dispatch) works on mobile phones only.
Admin office (Design, Marketing, Sales) works on the web app.
There is no fast, reliable channel between them — leading to calls, WhatsApp confusion, and missed updates.

**Goal:** Make Telegram the shop floor's "app" — they never need to open the admin panel.

---

## What Gets Built (5 Phases)

---

### Phase 1 — Staff Account Linking
**Time to build: ~3–4 hours**

Each staff member links their personal Telegram account to their profile in the system — once, forever.

**How it works:**
- Admin opens the Users / Staff page in the admin panel
- Clicks "Generate Telegram Link" for any staff member
- Copies the link (looks like: `t.me/aayam_notify_bot?start=staff_UUID`)
- Sends it to the staff member on WhatsApp
- Staff member taps the link → opens Telegram → presses Start
- Bot replies: "✅ Linked! You are now connected as [Name]"
- Done — their Telegram is now linked to their account

**What changes in the app:**
- Add `telegram_chat_id` column to the `profiles` table in Supabase (DB migration)
- Update the Telegram webhook to handle `/start staff_UUID` (similar to client linking)
- Add "Telegram Link" section to the Staff / Users settings page
- Show green checkmark if linked, yellow warning if not

**Who needs to link:**
- All CMYK workers (priority)
- All Dispatch staff (priority)
- Designers (for job assignment notifications)
- Managers / Admin (for alerts)

---

### Phase 2 — Automated Job Status Notifications
**Time to build: ~4–6 hours | Highest daily value**

When a job moves to a specific status in the app, the right person gets a Telegram message automatically. Zero manual communication needed.

**The notification map:**

| Job Status Change | Who Gets Notified | Message Contains |
|---|---|---|
| New job created | Assigned designer | Job name, client, due date, brief |
| Job → `designing` | Designer (if assigned) | Job details, notes |
| Job → `pre_print_qc` | QC person / Manager | Job ready for QC check |
| Job → `printing` | CMYK worker | Job name, paper size, qty, special notes |
| Job → `quality_check` | QC team | Print done, needs check |
| Job → `ready` | Dispatch person | Client name, delivery address, items |
| Job → `dispatched` | Manager + Sales | Delivery confirmed |
| Payment received | Sales person | Client name, amount, job reference |

**How it works technically:**
- The job status update functions already exist in the app
- We add a `sendJobNotification(jobId, newStatus)` call at each status change point
- The function looks up who to notify based on job assignment + the status map
- Calls the existing `sendTelegramNotification()` in `lib/telegram-service.ts`
- If the person has no Telegram linked → falls back to in-app notification only

**Message format example (job → printing):**
```
🖨️ NEW PRINT JOB

Job #1042 — Tiger Packaging
Client: ABC Foods
Qty: 500 sheets | A3 | 300gsm Art Card
Special: Spot UV on logo area

→ Mark done: reply "done 1042"
```

---

### Phase 3 — Bot Commands from the Floor
**Time to build: ~3–4 hours**

Floor workers reply to the bot from their phone to update job status. No login, no app, no laptop needed.

**Commands CMYK worker can send:**

| What they type | What happens |
|---|---|
| `done 1042` | Job 1042 status → quality_check, QC person notified |
| `queue` | Bot replies with their pending print jobs list |
| `status 1042` | Bot replies with current status of job 1042 |
| `issue 1042 paper torn` | Adds a note to job 1042, notifies manager |

**Commands Dispatch worker can send:**

| What they type | What happens |
|---|---|
| `delivered 1042` | Job 1042 status → dispatched, logged with timestamp |
| `deliveries` | Bot replies with today's pending delivery list |
| `address 1042` | Bot replies with client delivery address |

**How it works technically:**
- Update the Telegram webhook route (`app/api/telegram/webhook/route.ts`)
- When a message comes in, look up who the sender is from `telegram_chat_id` in `profiles`
- Parse the command text with simple string matching
- Run the appropriate Supabase update
- Send a confirmation reply

---

### Phase 4 — Share Button in the App
**Time to build: ~4–5 hours**

A share icon on any page in the admin app. Admin or manager taps it, picks a person, and sends a link or PDF directly to their Telegram.

**Where the share button appears:**
- Job detail page → share job brief with any team member
- Invoice page → share invoice PDF with anyone
- Delivery note / dispatch page → share delivery details with dispatch
- Any admin page → share the page URL (admin-only feature)

**What it can send:**
- **Page link** — sends the URL with a short description: "Satish shared Job #1042 with you → [link]"
- **PDF** — generates the PDF on the fly and sends it as a file in Telegram
- **Quick message** — type a custom note + attach the link

**How the UI works:**
- Share icon (↗) in the top-right corner of relevant pages
- Click opens a small panel: "Send to..."
- Search and pick any staff member or send to Floor Group
- Toggle: Link / PDF
- Hit Send → done

**How it works technically:**
- New component: `ShareToTelegramButton.tsx`
- Fetches list of staff with linked Telegram accounts
- For PDF: calls existing PDF generation API endpoints
- For links: constructs the full app URL and sends via `sendTelegramNotification()`
- Admin-role only (check session role before rendering the button)

---

### Phase 5 — Morning Briefing (Scheduled)
**Time to build: ~3 hours**

Every morning at 8:30 AM, each person gets their day's work sent to their Telegram. No "what do I do today?" calls.

**What each role receives:**

**Designer gets:**
```
🌅 Good morning Rahul! Here's your work for today.

Active Jobs (3):
• #1038 — Raj Enterprises (designing) — Due TODAY
• #1041 — Blue Star Co (revision pending)
• #1044 — New job from Satish

Have a productive day! 💪
```

**CMYK gets:**
```
🖨️ Print Queue — Wednesday 28 May

Jobs ready to print (2):
• #1035 — Tiger Packaging | 500 sheets | A3
• #1039 — Flora Gifts | 200 pcs | visiting card

Pending QC (1):
• #1040 — ABC Foods (waiting for approval)
```

**Dispatch gets:**
```
🚚 Deliveries for today — Wednesday 28 May

Ready to dispatch (2):
• #1033 — Ramesh Traders | Sector 4, Gandhinagar
• #1036 — City Mart | Ring Road, Ahmedabad

Pending (1):
• #1029 — Sun Industries (not yet ready)
```

**How it works technically:**
- Vercel Cron Job: add a cron route in `app/api/cron/morning-briefing/route.ts`
- Set cron schedule in `vercel.json`: `"0 3 * * *"` (8:30am IST = 3:00am UTC)
- Route queries Supabase for jobs grouped by assigned user
- Sends formatted message to each person's `telegram_chat_id`
- Only runs for people who have Telegram linked

---

## Build Order Recommendation

```
Week 1:  Phase 1 (Staff Linking) + Phase 2 (Auto Notifications)
         → Floor gets job alerts immediately. Biggest visible change.

Week 2:  Phase 3 (Bot Commands)
         → Floor can update status from phone. Office sees real-time updates.

Week 3:  Phase 5 (Morning Briefing)
         → Everyone starts the day informed. No morning coordination calls.

Later:   Phase 4 (Share Button)
         → Nice to have. Build after the core workflow is running smoothly.
```

---

## What Already Exists (No Rebuild Needed)

- ✅ `@aayam_notify_bot` — bot is live and webhook is registered
- ✅ `lib/telegram-service.ts` — send message function already works
- ✅ Client Telegram linking — same pattern, just replicated for staff
- ✅ DB columns on clients table — just need same on `profiles` table
- ✅ `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` — env var is live on Vercel

---

## DB Changes Needed (Supabase Migrations)

```sql
-- Phase 1: Staff linking
ALTER TABLE profiles ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE profiles ADD COLUMN telegram_linked_at TIMESTAMPTZ;

-- Phase 3: Command audit log (optional but useful)
CREATE TABLE telegram_commands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  command TEXT,
  job_id UUID REFERENCES jobs(id),
  executed_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Cost / Effort Summary

| Phase | Build Time | Value |
|---|---|---|
| 1 — Staff Linking | 3–4 hrs | Foundation — enables everything |
| 2 — Auto Notifications | 4–6 hrs | ⭐⭐⭐ Highest daily impact |
| 3 — Bot Commands | 3–4 hrs | ⭐⭐⭐ Floor independence |
| 5 — Morning Briefing | 3 hrs | ⭐⭐ Daily rhythm |
| 4 — Share Button | 4–5 hrs | ⭐ Nice to have |
| **Total** | **~17–22 hrs** | |

---

*Brief prepared by Claude for Aayam Creative — May 2026*
