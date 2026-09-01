# 📸 Payment Captures — setup & how it works

**Built 1 Sep 2026.** Payments posted in a Telegram group — screenshots of what
we paid, screenshots of what clients paid us, and cash typed as plain text —
are read automatically, parked for accounts, and matched against the HDFC feed.

---

## The one idea behind the whole thing

**A screenshot is not proof that money moved.**

Look at a real HDFC receipt: it says **"Request Accepted"**, not "Transaction
Successful". An accepted request can still fail or reverse. So a screenshot
never writes to the ledger. It goes into an **inbox** (`payment_captures`), and
it is only marked **verified** when a matching line appears in
`zoho_bank_transactions` — the HDFC feed that `zoho-bank-sync` already pulls
out of Zoho Books twice a day.

> ⚠️ Two things about that feed are worth knowing, because both would have been
> silent bugs. It is **`zoho_bank_transactions`**, not `bank_transactions` —
> the latter is the old manually-imported table and has not moved since
> **14 July 2026**. And its direction flag reads backwards: in Zoho,
> `debit` = money **in**, `credit` = money **out**. A vendor payment is a
> *credit* row.

Zoho stays the book of record. Nothing here writes to Zoho, to the bank
tables, to `vendor_payments`, or to any journal.

What you gain is two things nobody was watching before:

| Exception | What it means |
|---|---|
| Screenshot, but **no bank line after 3 days** | The payment may have failed. "Request Accepted" was never a promise. |
| Bank **outflow with no screenshot** | Money left the account and nobody announced it in the group. |

---

## Setup — 10 minutes, one time

### 1. Create the Telegram group

1. Telegram → **New Group** → name it e.g. **"Aayam Payments"**.
2. Add **@aayam_notify_bot** and the admin + accounts people.
3. Make the bot an **admin** of the group.
   *(Or: message @BotFather → `/setprivacy` → choose the bot → **Disable**.
   Without one of these two, Telegram only shows the bot `/commands` — it will
   never see your photos, and nothing will happen.)*

### 2. Point the app at it

Open the app → **Settings → Telegram Groups**. The new group appears there once
any message is posted in it. Set its department to **💸 Payments (screenshot
inbox)**.

Leave **Job alerts** and **Digest** unchecked — this group is not a job
department, and it should stay quiet apart from payment replies.

### 3. Check the API key on Vercel

The screenshot is read by Claude, so `ANTHROPIC_API_KEY` must be set in the
Vercel project (Settings → Environment Variables). It is already used by the
print-sheet scanner, so it is probably there — worth confirming.

---

## What it handles

| You post… | What happens |
|---|---|
| Screenshot of a payment **we made** | Read, then matched against the money-out side of the bank feed. Bot asks which vendor. |
| Screenshot of a payment **a client made to us** | Read, then matched against the money-in side. Bot asks which client, then which invoice if it can tell. |
| Any bank's layout — HDFC, Kotak, ICICI, PhonePe, GPay | Fine. Nothing is template-matched; the picture is read. Each bank's own status wording is kept as printed. |
| A UPI screenshot | Same as any screenshot. It verifies if the money moved through the HDFC account the feed covers. |
| **Cash**, typed: *"paid 5000 cash to Ramesh for auto"* | Captured, marked as cash, and **excluded** from bank matching — so it never sits in the "unconfirmed" list it could never leave. |
| Ordinary chat in the group | Ignored. The bot only speaks when it is confident a payment is being recorded. |
| A screenshot sent **as a file** | The bot asks you to send it as a photo instead. |

Direction is worked out from the receipt itself: whichever side carries
*Aayam Communication* (or the HDFC account ending 3911) is us.

## Daily use

1. Someone pays a vendor and posts the screenshot in the payments group —
   exactly what everyone does today, just in a different group.
2. Within a few seconds the bot replies under it (this is a payment we made;
   for money received it says *Received … from …* and offers clients):

   > 💸 **₹22,700** → **Onyx print**
   > 📅 2026-09-01 · HDFC Bank
   > 🔖 Ref 5514703362026090100061531 0830
   > 🏦 Bank says: *Request Accepted*
   >
   > **Which vendor is this against?**
   > [ ✅ Onyx Print ] [ 🔎 Other vendor — pick in app ] [ 🚫 Not a payment ]

3. Whoever posted taps the vendor. One tap, done.
4. Overnight, the bank feed arrives and the capture flips to **Verified**.
   Matching tries four things in order: the reference number, the transfer
   handle on the receipt (`aayam2onyxprint` shows up in the bank line as
   `TPT-AAYAM2ONYXPRINT-…`, and for within-HDFC transfers this is usually the
   only link), the payee, and finally amount + date.
5. Accounts works from **Finance → 📸 Payment Captures**.

Post the same screenshot three times and it is still **one** payment — matching
is on the bank reference number, not on the picture.

---

## What is deliberately careful

- **The bank's own wording is never rewritten.** "Request Accepted" is shown as
  "Request Accepted". It is never upgraded to "Successful".
- **Vendors are suggested, never assigned.** A near-miss would silently post to
  the wrong vendor's ledger, so a person always taps.
- **Two identical bank lines match neither capture.** If the system cannot tell
  two payments apart, it says so instead of guessing.
- **The strength of each match is shown.** "by reference number" is proof;
  "by amount and date alone — worth an eye" is an inference, and says so.
- **An inflow can never prove a payment out.**
- **Low-confidence reads are labelled**, not hidden.
- **Nothing is auto-posted to the books.** Naming a vendor means "this is the
  context", not "the money moved".

---

## Who can answer the buttons

Only people whose Telegram is linked to an Aayam account. Anyone can be added
to a group chat, and deciding which vendor a payment belongs to is a finance
decision — so an unlinked person tapping a button is told to link first
(Settings → Team Management → Get Link).

## Files

| File | What it does |
|---|---|
| `supabase/SCHEMA_PAYMENT_CAPTURES.sql` | The `payment_captures` inbox table (already applied) |
| `lib/payment-capture.ts` | Reads the screenshot; vendor guessing; bank matching; duplicate detection |
| `lib/telegram-payment-capture.ts` | The Telegram side — photo in, buttons, replies |
| `app/api/telegram/webhook/route.ts` | Two small branches added: photo, and button taps |
| `app/api/cron/reconcile-payment-captures/route.ts` | Runs 05:00 and 13:00 UTC, after each `zoho-bank-sync` |
| `app/api/finance/payment-captures/route.ts` | Accounts' decisions (service-role, per the project rule) |
| `app/admin/finance/payment-captures/page.tsx` | The review screen |
| `scripts/test-payment-matching.mjs` | 41 tests on the matching rules — no API key needed |
| `scripts/test-payment-capture.mjs` | Tests the screenshot reading against a real receipt (needs the API key) |

## Testing

```bash
node scripts/test-payment-matching.mjs   # 41 rules — should print "all passed"
node scripts/test-payment-capture.mjs    # reads scripts/fixtures/payment-onyx-print.jpg
```

Most of the 41 are NEGATIVE cases, because that is where money is lost: two
identical bank lines match *neither*; an incoming client payment can never prove
a payment we made; cash is never matched at all; a part payment spread across
several open invoices proposes *nothing* rather than guessing.

The second one asserts the most important behaviour in the system: that a
receipt saying **"Request Accepted"** is never reported as **"Successful"**.

## Not built (on purpose)

Creating the `vendor_payments` row automatically. That was the explicit choice:
prove the reading is accurate on real screenshots first. When you want it, the
hook is `payment_captures.vendor_payment_id`, which is already there and unused.
