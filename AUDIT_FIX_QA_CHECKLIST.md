# Aayam Office System — Audit Fix QA Checklist
**Fix Date:** 11 March 2026 | **Audited by:** Claude (Cowork) | **Fixed by:** Antigravity AI

---

## Test Accounts

| Role | Email | Password | Home Page |
|------|-------|----------|-----------|
| Marketing | marketing1@[your-domain] | Marke1ting | `/admin/marketing` |
| Dispatch | dispatch1@[your-domain] | Dispa1tch | `/admin/dispatch` |
| Designer | designer1@[your-domain] | Design1er | `/admin/designers/tasks` |
| CMYK | cmyk1@[your-domain] | C1MYK | `/admin/cmyk-print` |

---

## 🚨 GROUP A — RBAC: Marketing Routes (Bugs #1, #2, #3)

> Login as each non-marketing role and try to access marketing pages.

| # | Role | Navigate to | Expected | Pass? |
|---|------|-------------|----------|-------|
| A1 | **Dispatch** | `/admin/marketing` | 🔒 "Access Restricted" shown, NOT the marketing page | ☐ |
| A2 | **Dispatch** | `/admin/marketing/leads` | 🔒 "Access Restricted" shown | ☐ |
| A3 | **Designer** | `/admin/marketing` | 🔒 "Access Restricted" shown | ☐ |
| A4 | **Designer** | `/admin/marketing/leads` | 🔒 "Access Restricted" shown | ☐ |
| A5 | **CMYK** | `/admin/marketing` | 🔒 "Access Restricted" shown | ☐ |
| A6 | **CMYK** | `/admin/marketing/leads` | 🔒 "Access Restricted" shown | ☐ |
| A7 | **Marketing** | `/admin/marketing` | ✅ Marketing Dashboard loads normally | ☐ |

---

## 🔴 GROUP B — Marketing Data Fixes (Bugs #4, #5)

> Login as **Marketing** role.

| # | Where | Action | Expected | Pass? |
|---|-------|--------|----------|-------|
| B1 | Leads page | Select **"🟢 Active Leads"** filter | Lead **"Danush"** (Follow Up status) appears in the list | ☐ |
| B2 | Marketing Dashboard | Look at the **2nd stat card** | Card title says **"Follow-ups"** (not "Overdue Tasks") | ☐ |
| B3 | Compare | Check Dashboard "Follow-ups" count, then go to Follow-ups page | Both pages show the **same number** of follow-ups | ☐ |

---

## 🟡 GROUP C — CMYK UI Fixes (Bugs #6, #8)

> Login as **CMYK** role.

| # | Where | What to check | Expected | Pass? |
|---|-------|---------------|----------|-------|
| C1 | CMYK Dashboard header | Welcome message text | Shows **real username** (e.g. "Welcome, Bhavesh") — NOT "Operator" or "User" | ☐ |
| C2 | CMYK Dashboard → Pending Jobs card | Look for a "View All" button | **No "View All" button** linking to `/admin/jobs/queue` (only "In queue" label) | ☐ |

---

## 🟢 GROUP D — Profile Page & Avatar (Bugs #9, #10)

| # | Role | Action | Expected | Pass? |
|---|------|--------|----------|-------|
| D1 | **Designer** | Navigate to `/admin/settings/profile` | Profile settings page **loads** (no Access Restricted) | ☐ |
| D2 | **CMYK** | Navigate to `/admin/settings/profile` | Profile settings page **loads** (no Access Restricted) | ☐ |
| D3 | **CMYK** | Look at sidebar bottom avatar circle | Shows the **correct first letter** of their name or email — NOT the letter "A" | ☐ |

---

## ✅ Sign-off

| Section | Tester | Date | Result |
|---------|--------|------|--------|
| Group A — RBAC | | | ☐ Pass / ☐ Fail |
| Group B — Marketing Data | | | ☐ Pass / ☐ Fail |
| Group C — CMYK UI | | | ☐ Pass / ☐ Fail |
| Group D — Profile & Avatar | | | ☐ Pass / ☐ Fail |

**Overall Result:** ☐ All Pass — Audit Cleared &nbsp;&nbsp;&nbsp; ☐ Issues Found (describe below)

**Notes:**
```
_____________________________________________________________
_____________________________________________________________
```
