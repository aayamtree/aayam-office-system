# Aayam Office — Role-Specific Dashboard Designs

Each role gets a focused dashboard that helps them: **monitor → plan → act → forward work**.

---

## 1. 🔑 Admin Dashboard (Bird's Eye View)

> The boss sees everything at a glance. Spot bottlenecks, track performance, make decisions.

### Top Row — Today's Pulse (4 cards)
| Card | Shows |
|---|---|
| 📊 Active Jobs | Total active jobs, split by stage (designing: 8, printing: 5, ready: 3) |
| 💰 Today's Collection | ₹X collected today, ₹Y pending this week |
| ⚠️ Overdue | Jobs past deadline count (click to expand) |
| 📋 Today's Dispatches | X dispatched, Y scheduled today |

### Section Performance Row (4 mini-dashboards)
| Section | Widget |
|---|---|
| **Marketing** | Leads this month: X → Converted: Y (Z%) · This month vs last |
| **Design** | Tasks done: X · Avg turnaround: Y days · Pending: Z |
| **Print** | Runs today: X · Jobs in queue: Y · Machine utilization |
| **Dispatch** | Dispatched: X · On-time: Y% · Pending QC: Z |

### Bottom Row
| Widget | Purpose |
|---|---|
| **Revenue Chart** | Monthly revenue trend (line chart) with cash/bank split |
| **Job Pipeline** | Funnel: New → Designing → Printing → Ready → Dispatched |
| **Recent Activity** | Timeline: "Designer X completed task", "₹10K received from Client Y" |
| **Outstanding Clients** | Top 5 clients with highest pending payments |

### Quick Actions
- View all overdue jobs
- View today's dispatch schedule
- Export monthly report

---

## 2. 📢 Marketing Dashboard

> Focus: Lead pipeline, follow-up reminders, conversion tracking, targets.

### Top Row — My Numbers (4 cards)
| Card | Shows |
|---|---|
| 🎯 Leads This Month | X new leads added this month |
| 🔄 Conversion Rate | Y% leads converted to clients |
| 💰 Revenue Generated | ₹Z from converted leads (commission base) |
| 📞 Follow-ups Due | X follow-ups due today/overdue |

### Main Area
| Widget | Purpose |
|---|---|
| **Today's Follow-ups** | List of calls/visits due today, with one-click "Done" button and "Reschedule" |
| **Lead Pipeline** | Kanban: New → Contacted → Interested → Quotation Sent → Won / Lost |
| **My Clients** | Recent clients added, with last interaction date |
| **Quotation Status** | Pending quotes, approved, rejected — with quick action to convert to Job |

### Quick Actions
- ➕ Add new lead
- 📞 Log a follow-up
- 📄 Create quotation
- 💬 WhatsApp client (opens `wa.me/91{phone}`)
- ➡️ **Forward to Admin**: "Convert to Job" (sends job request to admin for creation)

### Smart Alerts
- "5 leads have no follow-up scheduled"
- "Quote #Q-045 pending for 7 days — follow up?"
- "Client XYZ hasn't ordered in 3 months — re-engage?"

---

## 3. 🎨 Designer Dashboard

> Focus: My tasks, deadlines, file management, approval status.

### Top Row — My Workload (4 cards)
| Card | Shows |
|---|---|
| 📋 My Active Tasks | X tasks in progress |
| ⏰ Due Today | Y tasks due today |
| ✅ Completed This Week | Z tasks finished this week |
| 🔄 In Rework | Tasks sent back for revision |

### Main Area
| Widget | Purpose |
|---|---|
| **Today's Tasks** | Priority-sorted list of tasks due today with job number, client, deadline |
| **Task Board** | Kanban: Pending → In Progress → Review → Rework → Completed |
| **Upcoming Deadlines** | Next 7 days calendar view of task deadlines |
| **Recent Files** | Last uploaded/modified files with Google Drive links |

### Quick Actions
- 📤 Upload design file (to job's Drive folder)
- ✅ Mark task complete
- 📩 Send for client approval
- 💬 Add remark/note on task
- ➡️ **Forward to Print**: "Design Approved — Ready for Print" (moves job to printing stage)

### Smart Alerts
- "Task for Job #AAY-26-1234 is due in 2 hours"
- "Client rejected design — rework needed"
- "3 tasks have no file uploaded yet"

---

## 4. 🖨️ CMYK Dashboard (Dual Role: Internal Vendor + Retail Counter)

> CMYK = Aayam's in-house digital print unit. Prints small-qty jobs (labels, brochures, leaflets) on **12x18 / 13x19 sheets**. Also runs a **retail POS counter** for walk-in customers. **Not every job goes through CMYK** — only jobs where CMYK is selected as the vendor.

### Tab 1: 📋 Job Queue (Internal Vendor Mode)

> Shows only jobs where CMYK is the vendor (`job.vendor_id = CMYK_VENDOR_ID`)

#### Top Row (4 cards)
| Card | Shows |
|---|---|
| 🖨️ Jobs Assigned | X jobs assigned to CMYK |
| ⏳ Pending Print | Y jobs waiting to be printed |
| ✅ Printed Today | Z jobs completed today |
| 📄 Sheets Used Today | Total 12x18 + 13x19 sheets consumed |

#### Main Area
| Widget | Purpose |
|---|---|
| **Today's Print Queue** | Jobs assigned to CMYK, sorted by priority & deadline. Shows: job#, client, product type, qty, sheet size |
| **Sheet Planning** | How many sheets needed: "Job #1234: 500 labels → 25 sheets of 12x18" |
| **Paper Stock** | Current stock of 12x18 and 13x19 by paper type (Art Card, Chromo, Sticker) |
| **Recently Completed** | Jobs printed today with actual qty logged |

#### Quick Actions
- ✅ Mark job printed (log actual qty + sheets used)
- 📝 Auto-deduct sheets from paper stock
- ➡️ **Forward**: "Print Complete" → moves job to QC/Dispatch

---

### Tab 2: 🛒 Retail Counter (POS Mode)

> Walk-in customers, quick billing, daily sales tracking.

#### Top Row (4 cards)
| Card | Shows |
|---|---|
| 💰 Today's Sales | ₹X total retail sales today |
| 🧾 Bills Today | X bills generated |
| 📄 Sheets Used (Retail) | Sheets consumed for retail orders |
| 👤 Walk-in Customers | Y customers today |

#### Main Area
| Widget | Purpose |
|---|---|
| **Quick POS** | One-click billing: product, qty, customer (optional), amount |
| **Today's Sales** | Scrollable list of today's transactions |
| **Popular Products** | Frequently ordered items (quick selection) |
| **Daily Summary** | Revenue, paper cost, profit margin |

---

### Tab 3: 📦 Paper Stock

| Widget | Purpose |
|---|---|
| **Stock Levels** | All paper types with current qty, reorder level |
| **Usage Log** | Daily consumption: retail vs job breakdown |
| **Low Stock Alerts** | Papers below reorder level |
| **Purchase History** | Recent paper purchases with vendor and cost |

---

### 💡 Suggestions to Make CMYK Better:

| Suggestion | Why It Helps |
|---|---|
| **Auto cost calculation** | When CMYK prints a job, auto-calculate: (sheets × cost/sheet) + ink estimate → feeds into job profit |
| **Sheet optimization** | "You have 3 label jobs on 12x18 — combine to save paper" |
| **Retail vs Job stock split** | Track paper consumed for retail (revenue) vs jobs (internal cost) separately |
| **Daily P&L for CMYK** | End of day: Retail revenue + job billing vs paper/ink cost = CMYK profit |
| **Auto paper deduction** | When completing a job/sale, auto-deduct from stock |
| **Reorder alerts** | WhatsApp alert when paper hits reorder level |

### Smart Alerts
- "12x18 Art Card 300gsm — only 50 sheets left (reorder: 100)"
- "3 urgent jobs waiting — oldest is 2 days old"
- "Today's retail: ₹4,500 — higher than average!"
- "Job #AAY-26-1234 needs Sticker paper — check stock first"

---

## 5. 🚚 Dispatch Dashboard

> Focus: Ready jobs, today's deliveries, QC status, transporter management.

### Top Row — Dispatch Status (4 cards)
| Card | Shows |
|---|---|
| ✅ Ready for Dispatch | X jobs passed QC, waiting to ship |
| 🚚 Dispatched Today | Y dispatches sent today |
| 📋 QC Pending | Z jobs awaiting quality check |
| 📦 In Transit | Jobs dispatched but not yet delivered |

### Main Area
| Widget | Purpose |
|---|---|
| **Today's Dispatch Plan** | Jobs scheduled to dispatch today with client, address, transporter |
| **QC Queue** | Jobs waiting for quality check, with quick "Start QC" button |
| **Ready to Ship** | Jobs that passed QC, with "Create Dispatch" button |
| **Delivery Tracking** | Recent dispatches with delivery status (in transit / delivered) |

### Quick Actions
- 🔍 Start QC check (opens checklist)
- 📦 Create dispatch entry
- 📞 Call transporter / driver
- 📸 Upload proof of delivery
- ➡️ **Forward to Finance**: "Dispatched — Generate Invoice"

### Smart Alerts
- "3 jobs ready for dispatch for 2+ days — urgent!"
- "Dispatch #D-045 — delivery overdue"
- "QC failed for Job #AAY-26-1240 — rework needed"

---

## 6. 💰 Finance Dashboard

> Focus: Daily collections, outstanding, invoice management, cash flow.

### Top Row — Today's Money (4 cards)
| Card | Shows |
|---|---|
| 💵 Collected Today | ₹X received today (cash: ₹A, bank: ₹B) |
| 📄 Invoices Pending | X unpaid invoices worth ₹Y |
| ⚠️ Overdue Payments | X invoices past due date |
| 📊 Monthly Revenue | ₹Z total this month vs last month |

### Main Area
| Widget | Purpose |
|---|---|
| **Today's Payments** | All payments received today with mode, client, job, amount |
| **Outstanding by Client** | Top clients with highest pending — quick "Send Reminder" action |
| **Invoice Queue** | Recently dispatched jobs needing invoices |
| **Cash vs Bank Chart** | Monthly split of cash vs bank/UPI collections |

### Quick Actions
- 📄 Create invoice
- 💰 Record payment (with split mode support)
- 📊 Generate monthly report
- 📧 Send payment reminder to client
- 💬 WhatsApp payment reminder

### Smart Alerts
- "Invoice #INV-089 overdue by 15 days — ₹45,000"
- "Client XYZ has ₹2L outstanding"
- "₹30,000 cash collected today — deposit to bank?"
- "GST filing due — ₹X bank payments this quarter"

---

## Common Features Across All Dashboards

| Feature | Description |
|---|---|
| **Date selector** | Today / This Week / This Month / Custom range |
| **Refresh button** | Real-time data reload |
| **Quick search** | Search by job number across the system |
| **Notification bell** | Alerts for items needing attention |
| **Forward work** | Each section can push jobs to the next stage |
| **My performance** | Personal stats card (tasks done, targets met) |

---

## How Work Flows Between Dashboards

```
Marketing Dashboard                        Admin Dashboard
"Convert Quote → Job" ─────────────────→  "New Job Created"
                                               │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                      Designer Dashboard   (Skip design     (External
                      "New Task Assigned"    if print-only)   vendor)
                              │                │                │
                       "Design Complete"       │                │
                              ▼                ▼                │
                    ┌─────────┴─────────┐                      │
                    ▼                   ▼                      │
             CMYK Dashboard      Print Planner                 │
             (Small qty,         (Large qty,                   │
              12x18/13x19)        external vendor)             │
                    │                   │                      │
                    └─────────┬─────────┘                      │
                              ▼                                ▼
                      Dispatch Dashboard  ◄────────────────────┘
                      "QC → Dispatch"
                              │
                       "Dispatched"
                              ▼
                      Finance Dashboard
                      "Generate Invoice → Collect Payment"
```

> **Key:** CMYK is involved ONLY for small-qty in-house jobs. Large qty goes to external vendors via Print Planner. Some jobs skip design (print-only). External vendor jobs come back and go directly to Dispatch.

Each dashboard has a **"Forward"** button that pushes the job to the next section's queue automatically.
