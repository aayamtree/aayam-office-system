# Product Library — duplicate file & duplicate product prevention

**Date:** 29 July 2026
**Problem:** uploading the same print sheet twice re-uploaded it to Drive, re-ran the
paid Claude scan, and created a second copy of every product on it.

## The three layers

| Layer | What it catches | Where |
|---|---|---|
| 1. File | The exact same file, even renamed | SHA-256 hash, checked **before** upload |
| 2. Product | The same design arriving on a different sheet | `products.dedupe_key` |
| 3. Version | The same file attached to a product twice | `product_versions.file_hash` |

### Layer 1 — file fingerprint

`lib/file-hash.ts` hashes the file in the browser (`crypto.subtle`, instant, free).
`POST /api/products/sheet-lookup` answers "seen this before?".

If it is known, the import modal stops and shows:

- when it was scanned, by whom, how many jobs it found
- the products it already created (clickable)
- **Re-use saved scan** — imports from the cached AI result, no Claude call
- **Scan again anyway** — only if the artwork inside the file actually changed

`library_sheets` stores the hash, the cached scan JSON, the product IDs it created,
and a `times_seen` counter.

### Layer 2 — product fingerprint

`products.dedupe_key` = `normalise(brand) | normalise(name) | normalise(category) | client_id`
(lower-cased, non-alphanumerics stripped). Maintained by the DB trigger
`fn_product_dedupe_key()` so it can never drift, and computed in the app by
`lib/product-dedupe.ts` for the lookup before insert.

`import-sheet` now looks the key up first:

- **found** → reuse that product, add the sheet as a new design version,
  log a `matched` activity event, report `matched: true`
- **not found** → create the product as before

So re-printing a design grows its version history instead of littering the library.

### Layer 3 — version fingerprint

`product_versions.file_hash`. `POST /api/products/:id/versions` returns the
existing version with `duplicate: true` rather than inserting a twin. The product
detail page checks the hash before it even uploads to Drive.

## Files changed

```
lib/file-hash.ts                        new — SHA-256 helpers
lib/product-dedupe.ts                   new — fingerprint helpers
app/api/products/sheet-lookup/route.ts  new — "have we seen this file?"
app/api/products/scan-sheet/route.ts    cache scan by hash, skip Claude on repeat
app/api/products/import-sheet/route.ts  reuse product instead of duplicating
app/api/products/[id]/versions/route.ts file_hash guard
app/admin/library/[id]/page.tsx         hash before uploading a new version
components/library/ImportSheetModal.tsx duplicate panel + result badges
```

Migration: `product_library_dedupe` (library_sheets, product_versions.file_hash,
products.dedupe_key + trigger + backfill).

## Known leftover

One genuine duplicate pair predates this fix — **SPEEDER / Mantra / Label** exists
twice. Merge or delete one by hand from `/admin/library`; the new code will not
create another.
