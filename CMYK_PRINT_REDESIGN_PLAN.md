# CMYK Print Station — Redesign Plan

_Prepared 21 Jun 2026. Goal: less clutter, and a layout that manages the **whole** CMYK print business — production, the retail counter, and the money — on one calm screen._

---

## 1. Why the current page feels cluttered

The hub today stacks **five competing sections** with no priority order:

1. 4 KPI cards
2. **7 equal-sized quick-link tiles** (POS, Paper Stock, Calculator, Purchases, Expenses, Job Log, Overview)
3. Pending Jobs
4. Printed Today + Recent Sales
5. Stock Alert

Everything shouts at the same volume. Seven identical tiles is the main offender — the eye has nowhere to land, and the actual daily work (printing jobs, billing walk-ins) is buried below a wall of navigation. It also doesn't *feel* like it runs the business because the real work is hidden behind tiles instead of being on the surface.

## 2. The core idea — three pillars

You said all three jobs matter equally: **Production**, **Counter (POS)**, **Money**. So the redesign is built around exactly those three, each as a clear "pillar" with one headline number and one primary action:

| Pillar | Headline number | Primary action | Replaces |
|--------|-----------------|----------------|----------|
| **Production** | jobs waiting to print | Open print queue | Pending Jobs + Printed Today |
| **Counter** | sales today (₹) | New bill | Retail POS tile |
| **Money** | net profit today (₹) | View P&L | Monthly Overview tile |

Below the three pillars sits the **Live Print Queue** (the single most-used action, on the surface — no clicking required). Everything else — Cost Calculator, Paper Stock, Purchases, Expenses, Job Log — collapses into **one small "Tools" strip** of text chips at the bottom. They're still one tap away, but they stop competing for attention. (See the mockup above.)

Result: from ~5 loud sections + 7 tiles down to **3 pillars + 1 working queue + 1 quiet tools row**.

## 3. What's new — closing the "whole business" gaps

You flagged all four areas as missing. Here's how each gets handled:

**a) Job production tracking** — the queue gets richer states (queued → printing → on-hold → finishing), shows who is printing what, and stamps turnaround time. A small "On hold" filter so stuck jobs don't vanish.

**b) Customer / order records** — the Counter pillar gains a lightweight customer memory: walk-in becomes a saved name, repeat customers show past orders, and pending pickups/deliveries get a status so nothing is forgotten at the counter.

**c) Better inventory** — paper stock auto-deducts when a job is marked printed (already partly wired through `completeJob`), low-stock chips surface inline, each paper links to its supplier, and stock-on-hand shows a rupee value so you see money sitting on the shelf.

**d) Financial reports** — the Money pillar rolls up daily and monthly P&L (sales − paper cost − expenses), with job-wise and counter-vs-jobwork profit split, and a GST-ready summary for your accountant.

## 4. Build order (phased, so nothing breaks)

This is staged so the app keeps working at every step and we deploy small, safe changes.

**Phase 1 — Declutter the hub (visual only, low risk).**
Rebuild `app/admin/cmyk-print/page.tsx` into the 3-pillar + queue + tools-strip layout. No database changes. This alone fixes the "cluttered" feeling. Quick to ship and reversible.

**Phase 2 — Production depth.**
Add job states (on-hold, turnaround timer) to the queue and the Start Print modal.

**Phase 3 — Counter / customer records.**
Add saved customers + pending pickup tracking to the POS.

**Phase 4 — Inventory + Money.**
Stock value, supplier links, and the daily/monthly P&L + GST summary in the Money pillar.

Each phase is independent — we can stop after Phase 1 if it already feels right, or keep going.

## 5. Design rules to keep it calm

- Stick to your existing system: Primary Blue `#0000FF`, Accent Orange `#FF6600` for urgent only, Dark Grey `#3A3F4F` text, 8px spacing grid.
- One headline number per pillar — details live one tap deeper, never on the hub.
- Urgent/low-stock are the *only* things allowed to use the orange/red attention colour, so warnings actually stand out.
- Mobile-first: the three pillars stack cleanly on a phone, since the counter is often run from one.

---

## Open questions before I build Phase 1

1. Should the **Live Print Queue** stay on the hub (my recommendation), or move fully behind the Production pillar to make the hub even sparser?
2. For **Money**, do you want net profit shown to all staff, or owner/admin only?
3. Anything in the current page you actually *like* and want kept as-is?
