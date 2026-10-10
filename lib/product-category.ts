// Product category — the ONE place that decides what a job's product type is
// called and what colour it wears.
//
// Two different fields used to get confused on screen:
//   jobs.job_type          = the WORK type   (Design + Printing / Print Only)
//   jobs.product_category  = the PRODUCT type (Label / Pouch / Box / Sticker …)
// Only the second one answers "what is this?" for the floor, so that is the
// one every board, card and sheet should show. Import from here — never
// hand-roll another colour map.

/** Categories that ship with the system. Users can add more in Settings,
 *  so anything unknown still gets a stable colour (see fallbackStyle). */
export const CORE_PRODUCT_CATEGORIES = [
    'Box', 'Label', 'Pouch', 'Carton', 'Sticker', 'Bag', 'Other',
] as const;

/** Sentinel the "+ Add new category" dropdown row uses. It is a UI marker,
 *  never a real category — 16 jobs were once saved carrying it literally. */
export const ADD_NEW_SENTINEL = '__add_new__';

const STYLES: Record<string, string> = {
    box: 'bg-amber-100 text-amber-800 border-amber-200',
    label: 'bg-blue-100 text-blue-800 border-blue-200',
    pouch: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    carton: 'bg-orange-100 text-orange-800 border-orange-200',
    sticker: 'bg-purple-100 text-purple-800 border-purple-200',
    bag: 'bg-teal-100 text-teal-800 border-teal-200',
    'carry bag': 'bg-teal-100 text-teal-800 border-teal-200',
    brochure: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    poster: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    banner: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    menu: 'bg-red-100 text-red-800 border-red-200',
    pamphlet: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    flyer: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    envelope: 'bg-slate-100 text-slate-700 border-slate-200',
    'visiting card': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    letterhead: 'bg-sky-100 text-sky-800 border-sky-200',
    'logo design': 'bg-violet-100 text-violet-800 border-violet-200',
    other: 'bg-stone-100 text-stone-700 border-stone-200',
};

// Unknown categories get a colour from here, picked by name, so the same
// category always looks the same everywhere without anyone editing this file.
const FALLBACK = [
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-lime-100 text-lime-800 border-lime-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-pink-100 text-pink-800 border-pink-200',
];

/**
 * Clean a raw product_category value. Returns null when there is nothing real
 * to show — empty, whitespace, or the "+ Add new" sentinel that leaked into
 * the database. Every reader should go through this.
 */
export function normalizeProductCategory(raw?: string | null): string | null {
    const v = (raw || '').trim();
    if (!v) return null;
    if (v === ADD_NEW_SENTINEL) return null;
    return v;
}

/** What the chip reads: LABEL, POUCH, BOX. Uppercase so it scans on a card. */
export function productCategoryLabel(raw?: string | null): string | null {
    const v = normalizeProductCategory(raw);
    return v ? v.toUpperCase() : null;
}

/** Tailwind classes for a category chip. Stable for a given name. */
export function productCategoryStyle(raw?: string | null): string {
    // A mixed run reads "Letterhead + Pamphlet" — colour it by its first type.
    const v = normalizeProductCategory((raw || '').split(' + ')[0]);
    if (!v) return 'bg-stone-100 text-stone-600 border-stone-200';
    const known = STYLES[v.toLowerCase()];
    if (known) return known;
    let hash = 0;
    for (let i = 0; i < v.length; i++) hash = (hash + v.charCodeAt(i)) % FALLBACK.length;
    return FALLBACK[hash];
}

// ── Print families ───────────────────────────────────────────
// Which product types may share ONE printing sheet. Types in the same family
// use the same kind of paper / print set-up, so a Letterhead and a Pamphlet can
// go on one sheet — but a Box and a Pouch never can. Change the groups here
// and the Print Planner follows. A type that is not listed (or any new one
// added in Settings) is its own family, so it only ever matches itself.
export const PRINT_FAMILIES: Record<string, string[]> = {
    'Flexible packaging': ['pouch'],
    'Rigid packaging': ['box', 'carton'],
    'Labels': ['label', 'sticker'],
    'Commercial print': ['letterhead', 'pamphlet', 'brochure', 'poster', 'menu', 'visiting card', 'i card', 'flyer', 'post', 'banner', 'envelope'],
};

/** lower-cased product type → family name ('' = no family, matches only itself). */
export type PrintFamilyMap = Record<string, string>;

/** Family name for a product type, or null when the job has NO product type. */
export function printFamily(raw?: string | null, overrides?: PrintFamilyMap | null): string | null {
    const v = normalizeProductCategory(raw);
    if (!v) return null;
    const key = v.toLowerCase();
    // Settings > Product Categories wins. A type that is listed there with no
    // family is its own family; a type not listed there falls back to the
    // built-in groups below.
    if (overrides && key in overrides) return overrides[key] || v;
    for (const [family, types] of Object.entries(PRINT_FAMILIES)) {
        if (types.includes(key)) return family;
    }
    return v; // unlisted type = its own family
}

/**
 * May these two jobs share one sheet? Same family, yes. Two jobs with no
 * product type may sit together (as before), but a blank never mixes with a
 * real type — blank types are how mistakes get in.
 */
export function canShareSheet(a?: string | null, b?: string | null, overrides?: PrintFamilyMap | null): boolean {
    const fa = printFamily(a, overrides), fb = printFamily(b, overrides);
    if (!fa && !fb) return true;
    if (!fa || !fb) return false;
    return fa.toLowerCase() === fb.toLowerCase();
}

/**
 * The product type of a whole print run. One type → that type. A run that
 * mixes types of one family reads "Letterhead + Pamphlet" so nobody takes it
 * for a pamphlet-only sheet.
 */
export function runProductCategory(
    jobs: Array<{ product_category?: string | null }> | null | undefined
): string | null {
    const seen: string[] = [];
    for (const j of jobs || []) {
        const v = normalizeProductCategory(j?.product_category);
        if (v && !seen.some(x => x.toLowerCase() === v.toLowerCase())) seen.push(v);
    }
    return seen.length ? seen.join(' + ') : null;
}
