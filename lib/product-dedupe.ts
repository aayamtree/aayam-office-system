// Product de-duplication — decide whether a detected job is a NEW product or
// another version of one we already hold.
//
// The rule: the same design printed again is a new VERSION of an existing
// product, never a second product. Two products are "the same" when their
// brand, name, category and client all match after normalization.
//
// Keep this in sync with the DB trigger fn_product_dedupe_key() (migration
// product_library_dedupe) — the trigger is the safety net, this is the
// fast path the API uses to look a product up before inserting.

/** lower-case, strip everything that isn't a letter or digit. */
export function normalizeToken(s: string | null | undefined): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface DedupeInput {
  brand_name?: string | null;
  name?: string | null;
  category?: string | null;
  client_id?: string | null;
}

/** The fingerprint stored in products.dedupe_key. */
export function productDedupeKey(p: DedupeInput): string {
  return [
    normalizeToken(p.brand_name),
    normalizeToken(p.name),
    normalizeToken(p.category),
    p.client_id || 'noclient',
  ].join('|');
}

/**
 * A looser match used only for warnings in the UI: same brand + same name,
 * ignoring category and client. Useful for "you may already have this under
 * a different client".
 */
export function looseMatchKey(p: DedupeInput): string {
  return [normalizeToken(p.brand_name), normalizeToken(p.name)].join('|');
}
