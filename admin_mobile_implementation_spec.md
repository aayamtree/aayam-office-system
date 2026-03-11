# Admin Mobile UX — Implementation Spec
**Aayam Office System · React + Tailwind CSS · Vercel**

> Paste this entire file into your Claude Sonnet 4.6 session as the starting prompt.
> Claude will have full context to implement each phase correctly.

---

## Context

This is a React + Tailwind CSS app (aayam-office-system.vercel.app).
The admin role needs a proper mobile experience. The app currently has a sidebar that doesn't collapse on mobile, stat cards in a single row that truncate, and no bottom navigation.

**Goal:** Implement admin-only mobile UI with a bottom navigation bar, collapsible sidebar, responsive cards, and a Quick Add sheet. Keep desktop layout exactly as-is.

**Style:** Minimal and clear. White background. Aayam gold (`#B8860B`) as the only accent. No unnecessary decorations.

---

## Phase 1 — Foundation (do this first, ~4–5 hrs)

### 1A · Hide sidebar on mobile, add hamburger

Find the sidebar component (likely `Sidebar.jsx` or `Layout.jsx`).

```jsx
// On the sidebar wrapper element, add:
className="... hidden lg:flex lg:flex-col ..."

// Add a hamburger button visible only on mobile — top-left of the main content area:
<button
  className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-full shadow-md"
  onClick={() => setSidebarOpen(true)}
>
  <MenuIcon className="w-5 h-5" />
</button>

// Make sidebar an overlay on mobile when open:
<div className={`
  fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl
  transform transition-transform duration-300 ease-in-out
  lg:relative lg:translate-x-0 lg:shadow-none
  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
`}>
  {/* existing sidebar content */}
</div>

// Backdrop to close sidebar on mobile:
{sidebarOpen && (
  <div
    className="lg:hidden fixed inset-0 z-30 bg-black/40"
    onClick={() => setSidebarOpen(false)}
  />
)}
```

---

### 1B · Bottom Navigation Bar

Create a new file: `components/BottomNav.jsx`

```jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Plus, Printer, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import QuickAddSheet from './QuickAddSheet'; // Phase 3

const tabs = [
  { icon: Home,           label: 'Home',   path: '/admin/marketing' },
  { icon: Users,          label: 'Leads',  path: '/admin/leads' },
  { icon: Plus,           label: '',       path: null, isQuickAdd: true },
  { icon: Printer,        label: 'Print',  path: '/admin/cmyk-print' },
  { icon: MoreHorizontal, label: 'More',   path: null, isMore: true },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-center h-16">
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = tab.path && location.pathname === tab.path;

          if (tab.isQuickAdd) return (
            <button
              key={i}
              onClick={() => setQuickAddOpen(true)}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-[#B8860B] flex items-center justify-center shadow-lg -mt-4">
                <Icon className="w-6 h-6 text-white" />
              </div>
            </button>
          );

          return (
            <button
              key={i}
              onClick={() => tab.isMore ? setMoreOpen(true) : navigate(tab.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 ${
                isActive ? 'text-[#B8860B]' : 'text-gray-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Add bottom padding to main content so it clears the nav */}
      {/* Add pb-16 lg:pb-0 to your main content wrapper */}

      {/* Sheets — build in Phase 3 */}
      {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} />}
      {moreOpen && <MoreDrawer onClose={() => setMoreOpen(false)} />}
    </>
  );
}
```

Add `<BottomNav />` inside your main `Layout.jsx`, outside the sidebar, at the bottom of the layout.

Also add `pb-16 lg:pb-0` to your main scrollable content wrapper so content isn't hidden behind the nav bar.

---

### 1C · Fix stat cards — 2×2 grid on mobile

Find every place that renders stat cards (dashboard, leads page, follow-ups page, CMYK page).
They likely look like `<div className="flex gap-4">` or `<div className="grid grid-cols-4 gap-4">`.

Change to:
```jsx
// Before:
<div className="grid grid-cols-4 gap-4">
// or
<div className="flex gap-3">

// After:
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
```

That single change fixes stat card truncation on ALL pages at once.

---

### 1D · Remove EOD floating bar on mobile

Find the EOD notification bar component. Add `hidden lg:flex` or `hidden lg:block` to it:

```jsx
// Before:
<div className="fixed bottom-0 left-0 right-0 bg-yellow-100 ...">

// After:
<div className="hidden lg:flex fixed bottom-0 left-0 right-0 bg-yellow-100 ...">
```

The EOD submit action will move to the Quick Add sheet in Phase 3.

---

## Phase 2 — Cards & Lists (~4–5 hrs)

### 2A · Lead card — stacked layout on mobile

Find the lead card component (likely `LeadCard.jsx` or inside `Leads.jsx`).

```jsx
// Wrap the card content in a flex-col on mobile, flex-row on desktop:
<div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-white rounded-lg border border-gray-100">

  {/* Row 1: Name + Status badge — always visible */}
  <div className="flex items-center justify-between sm:flex-1">
    <span className="font-semibold text-gray-900">{lead.name}</span>
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
      {lead.status}
    </span>
  </div>

  {/* Row 2: Company + Phone — always visible on mobile */}
  <div className="flex items-center gap-3 text-sm text-gray-500">
    <span>{lead.company}</span>
    <span>·</span>
    <span>{lead.phone}</span>
  </div>

  {/* Row 3: Date (relative) + Quick actions */}
  <div className="flex items-center justify-between">
    <span className="text-xs text-gray-400">{relativeDate(lead.lastContact)}</span>
    <div className="flex gap-2">
      <button className="min-h-[44px] min-w-[44px] flex items-center justify-center text-green-600 bg-green-50 rounded-lg text-sm font-medium px-3">
        📞 Call
      </button>
      <button className="min-h-[44px] min-w-[44px] flex items-center justify-center text-blue-600 bg-blue-50 rounded-lg text-sm font-medium px-3">
        ✏️ Edit
      </button>
      <button className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 rounded-lg px-2">
        ⋯
      </button>
    </div>
  </div>

</div>
```

**Relative date helper:**
```js
function relativeDate(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
```

---

### 2B · Follow-up card — stacked with full-width CTA

```jsx
<div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-gray-100">
  <div className="flex items-center justify-between">
    <span className="font-semibold text-gray-900">{followUp.leadName}</span>
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor}`}>
      {followUp.status}
    </span>
  </div>
  <span className="text-sm text-gray-500">{followUp.company}</span>
  <span className="text-xs text-gray-400">{relativeDate(followUp.dueDate)}</span>
  {/* Full-width CTA on mobile */}
  <button className="w-full sm:w-auto min-h-[44px] bg-[#B8860B] text-white rounded-lg font-medium text-sm">
    Create Quote
  </button>
</div>
```

---

### 2C · Fix buttons and dropdowns

```jsx
// Action buttons — no wrapping:
<button className="whitespace-nowrap min-w-fit min-h-[44px] px-3 py-2 ...">
  + Add Follow-up
</button>

// Filter dropdowns:
<select className="min-w-[110px] ...">

// Search input — full width, never truncates:
<div className="flex items-center gap-2 w-full">
  <SearchIcon className="w-4 h-4 flex-shrink-0 text-gray-400" />
  <input className="flex-1 min-w-0 bg-transparent outline-none" placeholder="Search leads..." />
</div>
```

---

### 2D · Drive badge + title — stack on mobile

```jsx
// Before (breaks on mobile):
<div className="flex items-center gap-2">
  <h1>CMYK Print Station</h1>
  <span className="badge">Drive: Not Connected</span>
</div>

// After (stacks on mobile, row on desktop):
<div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
  <h1 className="text-lg font-bold">CMYK Print Station</h1>
  <span className="badge w-fit">Drive: Not Connected</span>
</div>
```

---

## Phase 3 — Quick Add Sheet & More Drawer (~5–6 hrs)

### 3A · QuickAddSheet component

Create `components/QuickAddSheet.jsx`:

```jsx
export default function QuickAddSheet({ onClose }) {
  const [activeForm, setActiveForm] = useState(null); // 'lead' | 'followup' | 'eod'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-4 pb-8">

        {!activeForm && (
          <>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Add</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '👤', label: 'New Lead',      form: 'lead' },
                { icon: '📋', label: 'Follow-up Note', form: 'followup' },
                { icon: '✅', label: 'Submit EOD',     form: 'eod' },
              ].map(item => (
                <button
                  key={item.form}
                  onClick={() => setActiveForm(item.form)}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl min-h-[80px]"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs font-medium text-gray-700 text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {activeForm === 'lead' && <AddLeadForm onBack={() => setActiveForm(null)} onClose={onClose} />}
        {activeForm === 'followup' && <AddFollowUpForm onBack={() => setActiveForm(null)} onClose={onClose} />}
        {activeForm === 'eod' && <EODSubmitForm onBack={() => setActiveForm(null)} onClose={onClose} />}

      </div>
    </>
  );
}
```

**AddLeadForm — 4 fields only (minimal):**
```jsx
function AddLeadForm({ onBack, onClose }) {
  return (
    <form className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={onBack} className="text-gray-400">←</button>
        <h3 className="font-semibold">New Lead</h3>
      </div>
      {['Name', 'Phone', 'Company', 'Source'].map(field => (
        <input
          key={field}
          placeholder={field}
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-[#B8860B]"
        />
      ))}
      <button
        type="submit"
        className="w-full bg-[#B8860B] text-white rounded-lg py-3 font-medium mt-2"
      >
        Add Lead
      </button>
    </form>
  );
}
```

---

### 3B · MoreDrawer component

Create `components/MoreDrawer.jsx`:

```jsx
import { useNavigate } from 'react-router-dom';

const sections = [
  {
    title: 'Finance',
    items: [
      { icon: '💰', label: 'Payments',  path: '/admin/finance/payments' },
      { icon: '📄', label: 'Invoices',  path: '/admin/finance/invoices' },
      { icon: '📦', label: 'Orders',    path: '/admin/sales/orders' },
    ]
  },
  {
    title: 'Team',
    items: [
      { icon: '👥', label: 'Users',     path: '/admin/settings/users' },
      { icon: '📊', label: 'EOD Reports', path: '/admin/eod-reports' },
    ]
  },
  {
    title: 'Account',
    items: [
      { icon: '👤', label: 'My Profile', path: '/admin/settings/profile' },
      { icon: '⚙️', label: 'Settings',   path: '/admin/settings' },
      { icon: '🔴', label: 'Sign Out',   path: null, action: 'signout', danger: true },
    ]
  },
];

export default function MoreDrawer({ onClose }) {
  const navigate = useNavigate();

  const handleItem = (item) => {
    if (item.action === 'signout') { /* call your signout fn */ return; }
    navigate(item.path);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl pb-8 max-h-[80vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-2" />
        {sections.map(section => (
          <div key={section.title}>
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {section.title}
            </p>
            {section.items.map(item => (
              <button
                key={item.label}
                onClick={() => handleItem(item)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium border-b border-gray-50 ${
                  item.danger ? 'text-red-500' : 'text-gray-800'
                }`}
              >
                <span className="text-base w-6">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {!item.danger && <span className="text-gray-300">›</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
```

---

## Checklist — tell Claude to verify each item

```
Phase 1:
[ ] Sidebar hidden on mobile (hidden lg:flex on sidebar wrapper)
[ ] Hamburger button visible only on mobile (top-left, fixed)
[ ] Tap outside sidebar closes it (backdrop overlay)
[ ] BottomNav component added to Layout.jsx
[ ] Main content has pb-16 lg:pb-0 so nothing hides behind bottom nav
[ ] All stat card containers use grid-cols-2 lg:grid-cols-4
[ ] EOD floating bar hidden on mobile (hidden lg:flex)

Phase 2:
[ ] Lead cards stack vertically on mobile
[ ] Follow-up cards stack vertically, CTA button full-width on mobile
[ ] "+ Add Follow-up" button has whitespace-nowrap
[ ] Filter dropdowns have min-w-[110px]
[ ] Search input uses flex-1 min-w-0
[ ] Title + Drive badge uses flex-col sm:flex-row
[ ] All action buttons have min-h-[44px]

Phase 3:
[ ] ➕ tab opens QuickAddSheet bottom sheet
[ ] QuickAddSheet has 3 options: New Lead, Follow-up Note, EOD Submit
[ ] New Lead form has exactly 4 fields: Name, Phone, Company, Source
[ ] ⋯ tab opens MoreDrawer slide-up
[ ] MoreDrawer has all navigation links grouped by section
[ ] Sign Out is red, at the bottom of MoreDrawer
```

---

## Notes for Claude in your session

- Do NOT change any desktop styles — only add mobile overrides using Tailwind's `sm:`, `lg:` prefixes
- All new mobile styles should use the `lg:` breakpoint as the cutoff (sidebar appears at lg, bottom nav disappears at lg)
- Keep existing routing and authentication logic exactly as-is
- Aayam brand gold = `#B8860B` — use only for active tab indicator, primary buttons, and the ➕ FAB
- Background = white (`#FFFFFF`), labels = gray-500, headings = gray-900
- No new npm packages needed — use lucide-react (already installed) for icons
