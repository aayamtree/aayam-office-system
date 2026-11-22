# Aayam OMS - Design System Reference

> **Read with `CLAUDE.md`.** Where the two differ, CLAUDE.md wins. Every screen change must pass `npm run audit:ui`.

**Quick reference for developers** — style refresh 2026-08-31, tokens rebased on the Notion design language (via Refero Styles), applied at the token layer only (`app/globals.css` + `tailwind.config.js`). Components that use these tokens (`bg-primary`, `text-muted-foreground`, `bg-background`, `bg-oms-*`, etc.) picked it up automatically — nothing was hand-edited page by page.

## Color Palette

```tsx
Primary Blue:    #0075DE  // Actions, links, active states (was #0000FF)
Accent Orange:   #E89D01  // Urgent, attention, alerts (was #FF6600)
Dark Grey:       #111111  // Structure, primary text (was #3A3F4F)
Light Grey:      #EBE9E6  // Secondary areas, disabled (was #D5D5D6)
White:           #FFFFFF  // Card / panel surfaces
Page background: #F6F5F4  // App background behind cards (Notion "Paper Warmth")
```

These are the `oms.*` colors in `tailwind.config.js`, plus the shadcn `--primary` / `--background` / `--card` etc. CSS variables in `app/globals.css`, which now carry the same Notion-derived hues (`--primary: 208 100% 44%` = #0075DE, `--background: 30 10% 96%` = #F6F5F4, `--destructive: 7 92% 58%` = Notion Coral #F64932).

## Typography

Font stays **Inter** (Notion's own UI font, "NotionInter", is an Inter derivative — no change needed).

```tsx
Page Title:      text-xl font-semibold      // 20px, 600
Section Heading: text-base font-semibold    // 16px, 600
Body Text:       text-sm                    // 14px, 400
Small Labels:    text-xs                    // 12px, 400
Buttons:         text-sm font-medium        // 14px, 500
```

## Buttons

Always the shared `Button` from `components/ui` — never a hand-made `<button>`.

```tsx
import { Button } from '@/components/ui/Button';
<Button>Save</Button>                        // primary
<Button variant="outline">Cancel</Button>    // secondary
<Button variant="destructive">Delete</Button> // attention
```

## Status Badges

Always the shared `Badge` from `components/ui` (status colours come from `lib/lead-status.ts` and the stage helpers), never a hand-made `<span>` with colour classes.

## Spacing (4px grid — matches Notion)

```tsx
p-1  = 4px
p-2  = 8px
p-3  = 12px
p-4  = 16px
p-6  = 24px   // Notion card padding
p-8  = 32px
```

## Border Radius

```tsx
--radius: 0.75rem   // 12px, drives rounded-lg (cards) — was 0.5rem
rounded-md → ~10px  // buttons
rounded-sm → ~8px
```

Notion's own scale is 4px (small) / 8px (buttons) / 12px (cards) / pill (badges) — close enough to the shadcn `lg/md/sm` derivation above that no per-component radius classes needed changing.

## Text Colors

```tsx
text-oms-text-primary    // #111111 — primary text
text-oms-text-secondary  // #615D59 — secondary text
text-oms-text-disabled   // #9C9792 — disabled
text-white               // On dark surfaces
```

## Shadows

None. Cards and panels are flat: a 1px `border`, no `shadow-*`, no hover lift or zoom.

## What did NOT change

Component-level hardcoded hex (not routed through tokens) was left alone in this pass — mainly `#B8860B` (gold accent on a few Team Files / QuickAdd / PairDrop components) and a handful of `#0000FF`/`#FF6600` literals in `app/admin/demo/*` and `components/list/*` (Badges, TableView, CompactListItem, ResponsiveListView, page-old.tsx). Those read the old brand colors as literal arbitrary Tailwind values (`bg-[#0000FF]`) rather than `bg-oms-blue`/`bg-primary`, so the token refresh doesn't reach them. Worth a follow-up pass if a fully consistent look matters there too.

---

**Source:** Notion style guide via Refero Styles (styles.refero.design) — colors, spacing (4px base), and radii adapted; typography and layout density kept as-is (this is a dense ops tool, not a marketing site, so Notion's large display type scale wasn't imported).


## Cards never grow with their data (added 2026-10-07)

A grid row is as tall as its tallest card, so one long list stretches every
neighbour (the calendar with ~100 dispatches did exactly this). Rule: any list
whose length depends on data goes inside `<ScrollList size="sm|md|lg">`
(`components/ui/ScrollList.tsx`). A list that is capped by its query or is a
fixed set may instead carry `/* bounded: reason */` on its `.map(` line.
`npm run audit:layout` checks the dashboard widgets and fails otherwise.
