# Delivered until paid — 10 September 2026

## The complaint

"Dispatched means the goods left our godown, delivered means the client confirmed
they got the goods. But we click Mark Delivered and it won't go to the Delivered
section."

## What was actually wrong

The button worked. 275 jobs were already sitting at the Delivered stage. The column
was hiding them.

**No delivery date existed.** `dispatched_at` was in the table but nothing ever wrote
to it, and there was no `delivered_at` at all. The board's "finished work stays 7
days" rule therefore aged jobs by `updated_at` — the last time anything on the row was
edited. A job delivered at 5pm today but last edited on 1 September looked nine days
old the instant it was marked delivered, so it fell past the 7-day window and dropped
into Closed in the same second the button was clicked.

**Zero was being read as paid.** `isMoneySettled` returned true whenever the balance
was ≤ 0. 348 finished jobs had no amount entered at all, so the board called them
settled and archived them. That is why Awaiting Payment showed 77 while 275 delivered
jobs sat in Closed.

## The new rule

**Payment empties the Delivered column, not a clock.**

| Job state | Where it sits |
|---|---|
| Still in production | its production column |
| Delivered, money outstanding | **Delivered — indefinitely**, showing days since delivery and the balance |
| Delivered, fully paid | Delivered for 7 days, then Closed |
| Closed by hand (free job, write-off, rework) | leaves at once |
| Delivered, no amount entered | Delivered, flagged amber "Amount not entered" |

A zero total is no longer "paid" — it is "nobody has said what this costs", and it is
flagged so somebody fixes it instead of it quietly archiving itself.

## What changed

- `jobs.delivered_at`, `jobs.closed_manually_at`, `jobs.close_reason` added.
- `trg_stamp_job_milestones` stamps the dispatch and delivery moment on stage change,
  and clears a manual close if the job is pulled back into production.
- Real dates recovered for 226 of 275 delivered jobs from `job_stage_history`. The
  other 49 have no history row and read "date not recorded" rather than showing an
  invented number.
- One-time clean slate: 348 legacy zero-amount finished jobs closed with a reason.
- `lib/job-workflow.ts` — `isMoneySettled`, `isOnActiveBoard`, `finishedAt` rewritten;
  `hasAmountEntered`, `isAmountMissing`, `isManuallyClosed`, `outstandingBalance`,
  `daysSinceDelivered`, `getPaymentWatchLabel` added.
- Job card shows the money-watch strip; an Archive button closes a job that will never
  be paid.

## Board after the change

| | before | after |
|---|---|---|
| Active | 60 | 137 |
| Delivered column | 0 | 75 |
| Awaiting Payment | 77 | 77 |
| Closed | 348 | 348 |

The 75 in Delivered are every delivered job with money still outstanding — the oldest
first. That column is now the receivables reminder it was meant to be.
