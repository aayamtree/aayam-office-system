# 🔍 Weekly App Health Report — 2026-04-27

### TypeScript ✅
2 errors found and **auto-fixed**:
- `app/admin/jobs/page.tsx:204` — missing `outstanding_balance` in `createVendor()` call
- `components/shared/VendorQuickAddModal.tsx:63` — missing `outstanding_balance` in `createVendor()` call

After fix: `npx tsc --noEmit` returns clean (0 errors).

### Routes ✅
All 70 sidebar `/admin/...` href targets have a corresponding `app/.../page.tsx`. No broken sidebar links.

### Core Files ✅
All 6 critical files present:
- `components/shared/CommandPalette.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/Header.tsx`
- `lib/hooks.ts`
- `lib/auth-context.tsx`
- `lib/supabase.ts`

### Latest Production Commit
**Before audit:** `204a856` — fix: idempotent job approval — no more 'Cannot coerce' error on re-click (2026-04-21)
**After audit (auto-pushed):** `61deb09` — fix: weekly audit auto-fix — add outstanding_balance to createVendor calls

### Package Versions ✅
- Next.js: **14.0.4** (current major — OK)
- React: **^18** (current major — OK)

### 🚨 Action Needed
Nothing critical — app is healthy and the 2 TS errors were auto-fixed and pushed to `main` as commit `61deb09`.

Optional follow-ups for consideration:
- Next.js 14.0.4 is on the older end of the 14.x line; consider bumping to latest 14.x patch when convenient.
- The `Vendor` type has `outstanding_balance` as required while `lib/api.ts` (createVendor) treats it as optional — worth aligning the type so future quick-add forms can't drift.
