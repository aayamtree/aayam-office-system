# Aayam Office — rules for any change (read first)

The owner is not a developer. Show him the shape of a big change and get approval before writing it. Do git / Vercel / Supabase steps yourself.

## UI changes: the design guide is law, everywhere, every time

Before touching ANY screen, popup, button or list, read `DESIGN_SYSTEM.md` and `DASHBOARD_GUIDE.md` (sections 9 and 10 are the rules). Then follow these:

1. **Colour = tokens only.** `bg-primary`, `text-muted-foreground`, `border`, `bg-card`, `bg-muted`, `text-destructive`. No hard-coded `gray-/red-/green-/blue-/indigo-` palette classes and no hex values in new code. Amber (`amber-600`) is allowed only as a "due soon" state colour, as the existing dashboard does.
2. **Colour means one thing.** On a heading it names the zone (use `components/dashboard/SectionHeading`). On a number it means good / warning / critical. Never both. Never decorate.
3. **A failed reading never looks like good news.** Loading or unreadable = a dash (—), never a calm 0 or a green tick. Do not show green ticks that were not earned.
4. **Every number opens the list behind it** (side panel or page). A number that cannot be opened does not belong on a dashboard.
5. **Type:** page title `text-xl font-semibold`; section / card title `text-base font-semibold`; body `text-sm`; labels and hints `text-xs`. No `text-2xl`/`text-3xl` numbers.
6. **Shape:** cards `rounded-lg`, buttons/inputs `rounded-md`, flat with a 1px border, no shadows, no hover lift. Spacing on the 4px grid (`gap-4`, `p-4`, `p-6`).
7. **Use the shared components** from `components/ui/`: `Button`, `Badge`, `Card`, `Input`, `Label`, `Textarea`, `Select`, `Dialog`, `Sheet`, `Tabs`. No hand-built buttons, modals or inputs.
8. **A list that can grow goes in `<ScrollList>`** (or carries a `/* bounded: reason */` comment). A card never grows with its data.
9. **A number we cannot trust is removed, not restyled.** One definition per number; do not recompute it in a second place.
10. **Wording:** plain English, short, no emoji in labels, same word for the same thing everywhere.

## Design gate — no screen change is "done" without it (added 22 Nov 2026)

Satish should never have to remind anyone about the design guide. This gate makes it automatic.

1. Before changing any screen: read this file, `DESIGN_SYSTEM.md` and `DASHBOARD_GUIDE.md` (sections 9 and 10).
2. Build with the shared pieces in `components/ui/` and the shared dashboard pieces. Never hand-make a button, input, checkbox, dialog, badge or card.
3. **Touched = cleaned.** Every `.tsx` file you change must pass the design check IN FULL, not only the lines you added.
4. Run `npm run audit:ui -- <every .tsx file you changed>` (or `npm run audit:ui -- --changed`). It must say **PASS**. A true exception needs `/* ui-ok: reason */` on that one line, and the reason is shown to Satish.
5. Look at every changed screen in the browser (light theme, laptop width and phone width) and take a screenshot.
6. Every update message to Satish ends with: **"Design check: PASS — N screens"** and the screenshots. No line = the work is not done.
7. Whole-app progress: `npm run audit:ui` (no files) gives the total. Report the total in the weekly update; it must only go down.
8. Blue and Red always use the one shared Blue/Red chip and column style (checklist D.6). Red is never shown to Marketing, Designer or Dispatch.

The update checklist lives in `docs/ONE_MONEY_BOOK_CHECKLIST.md`. Work one item at a time; tick only after Satish confirms.

## Before saying "done"
- `npx tsc --noEmit -p tsconfig.json` has no errors.
- `npm run audit:layout` shows no NEW unbounded lists from your files.
- `npm run audit:ui -- <changed files>` says PASS (see Design gate).
- Count hard-coded palette classes in the files you touched; it should be zero (status badges from `lib/lead-status.ts` excepted).
- Look at the page in the browser and compare it with the guide. Report what you checked.
