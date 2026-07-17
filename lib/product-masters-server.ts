// Server-side master cross-check logic, shared by the single-file scan
// (/api/products/[id]/scan) and the job-sheet import
// (/api/products/import-sheet). Given a scan document, it maintains the
// BRAND master (brands.master_data) and PRODUCT master (product_masters)
// and returns a check_results object for the UI.

type SB = any;

export function flattenScan(scan: any): string {
  const parts: string[] = [];
  const push = (v: any) => {
    if (v == null) return;
    if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'object') Object.values(v).forEach(push);
    else parts.push(String(v));
  };
  push(scan);
  return parts.join(' ').slice(0, 20000);
}

function norm(v: any): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(norm).sort().join('|');
  return String(v).toLowerCase().replace(/[^a-z0-9ऀ-ॿ઀-૿]+/g, '');
}
function normPhone(v: any): string {
  if (v == null) return '';
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((p) => String(p).replace(/\D/g, '')).filter(Boolean).sort().join('|');
}

// HARD identity fields — short, structured, must be EXACT. A difference here
// is a real error worth stopping the press for (wrong contact, wrong licence).
// SOFT fields are long prose — the AI never transcribes them identically, so we
// only note them when they are DRASTICALLY different (fuzzy), and never as a
// red "mismatch". Registration/licence numbers live on the PRODUCT side
// (they are product-specific, e.g. each pesticide has its own CIR reg no),
// NOT on the brand — that was the cause of false brand mismatches.
const BRAND_HARD = ['email', 'website'] as const;      // + phone handled separately
const BRAND_SOFT = ['address', 'manufactured_by', 'marketed_by'] as const;
const PRODUCT_HARD = ['fssai_no', 'other_regn_nos', 'barcode'] as const;
const PRODUCT_SOFT = ['ingredients_or_composition'] as const;

interface Mismatch { field: string; master: any; found: any; level?: 'hard' | 'soft' }

/** Word-token Jaccard similarity 0..1 for prose. */
function similarity(a: any, b: any): number {
  const toks = (v: any) => new Set(norm(Array.isArray(v) ? v.join(' ') : v).match(/[a-z0-9ऀ-ॿ઀-૿]+/g) || (String(v).toLowerCase().match(/\S+/g) || []));
  const A = toks(a), B = toks(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  A.forEach((t) => { if (B.has(t)) inter++; });
  const uni = A.size + B.size - inter;
  return uni === 0 ? 1 : inter / uni;
}

function compareMaster(master: any, scan: any, hard: readonly string[], soft: readonly string[], withPhone: boolean): Mismatch[] {
  const out: Mismatch[] = [];
  for (const f of hard) {
    const m = master?.[f]; const sVal = scan?.[f];
    if (m == null || sVal == null) continue;
    if (norm(m) !== norm(sVal)) out.push({ field: f, master: m, found: sVal, level: 'hard' });
  }
  if (withPhone && master?.phone != null && scan?.phone != null && normPhone(master.phone) !== normPhone(scan.phone)) {
    out.push({ field: 'phone', master: master.phone, found: scan.phone, level: 'hard' });
  }
  // Soft prose: flag only when very different (similarity < 0.55)
  for (const f of soft) {
    const m = master?.[f]; const sVal = scan?.[f];
    if (m == null || sVal == null) continue;
    if (similarity(m, sVal) < 0.55) out.push({ field: f, master: m, found: sVal, level: 'soft' });
  }
  return out;
}

/** Map a list of field diffs to an overall status. */
function statusFromMismatches(mm: Mismatch[]): 'match' | 'review' | 'mismatch' {
  if (mm.some((m) => m.level === 'hard')) return 'mismatch';
  if (mm.length > 0) return 'review';
  return 'match';
}

function brandMasterFromScan(scan: any) {
  return {
    brand_name: scan.brand_name ?? null, manufactured_by: scan.manufactured_by ?? null,
    marketed_by: scan.marketed_by ?? null, address: scan.address ?? null,
    phone: scan.phone ?? null, email: scan.email ?? null, website: scan.website ?? null,
    fssai_no: scan.fssai_no ?? null, other_regn_nos: scan.other_regn_nos ?? null,
  };
}
function productMasterFromScan(scan: any) {
  return {
    product_name: scan.product_name ?? null, category: scan.category ?? null,
    ingredients_or_composition: scan.ingredients_or_composition ?? null,
    usage_instructions: scan.usage_instructions ?? null, warnings: scan.warnings ?? null,
    key_claims: scan.key_claims ?? null,
    fssai_no: scan.fssai_no ?? null, other_regn_nos: scan.other_regn_nos ?? null,
    barcode: scan.barcode ?? null,
  };
}

export interface MasterCheckInput {
  productId: string;
  clientId: string | null;
  brandId: string | null;
  productMasterId: string | null;
}

export async function runMasterChecks(supabase: SB, product: MasterCheckInput, scan: any) {
  // ── BRAND ──
  let brandCheck: any = { status: 'no_brand_on_design' };
  let resolvedBrandId: string | null = product.brandId;
  if (scan?.brand_name) {
    let brand: any = null;
    if (product.brandId) {
      const { data } = await supabase.from('brands').select('id, name, master_data').eq('id', product.brandId).single();
      brand = data;
    }
    if (!brand) {
      const { data } = await supabase.from('brands').select('id, name, master_data').ilike('name', scan.brand_name.trim()).limit(1);
      brand = data?.[0] || null;
    }
    if (!brand) {
      const { data: created } = await supabase.from('brands')
        .insert({ name: scan.brand_name.trim(), client_id: product.clientId, master_data: brandMasterFromScan(scan), master_text: flattenScan(brandMasterFromScan(scan)), master_updated_at: new Date().toISOString() })
        .select('id, name').single();
      resolvedBrandId = created?.id || null;
      brandCheck = { status: 'new_master_created', brand_id: resolvedBrandId, brand_name: scan.brand_name.trim() };
    } else if (!brand.master_data) {
      await supabase.from('brands').update({ master_data: brandMasterFromScan(scan), master_text: flattenScan(brandMasterFromScan(scan)), master_updated_at: new Date().toISOString() }).eq('id', brand.id);
      resolvedBrandId = brand.id;
      brandCheck = { status: 'master_filled', brand_id: brand.id, brand_name: brand.name };
    } else {
      const mismatches = compareMaster(brand.master_data, scan, BRAND_HARD, BRAND_SOFT, true);
      resolvedBrandId = brand.id;
      brandCheck = { status: statusFromMismatches(mismatches), brand_id: brand.id, brand_name: brand.name, mismatches };
    }
  }

  // ── PRODUCT ──
  let productCheck: any = { status: 'no_product_on_design' };
  let resolvedMasterId: string | null = product.productMasterId;
  if (scan?.product_name) {
    let master: any = null;
    if (product.productMasterId) {
      const { data } = await supabase.from('product_masters').select('id, name, master_data').eq('id', product.productMasterId).single();
      master = data;
    }
    if (!master) {
      const { data } = await supabase.from('product_masters').select('id, name, master_data').ilike('name', scan.product_name.trim()).limit(1);
      master = data?.[0] || null;
    }
    if (!master) {
      const { data: created } = await supabase.from('product_masters')
        .insert({ name: scan.product_name.trim(), category: scan.category || null, master_data: productMasterFromScan(scan), master_text: flattenScan(productMasterFromScan(scan)) })
        .select('id, name').single();
      resolvedMasterId = created?.id || null;
      productCheck = { status: 'new_master_created', master_id: resolvedMasterId, master_name: scan.product_name.trim() };
    } else if (!master.master_data) {
      await supabase.from('product_masters').update({ master_data: productMasterFromScan(scan), master_text: flattenScan(productMasterFromScan(scan)), updated_at: new Date().toISOString() }).eq('id', master.id);
      resolvedMasterId = master.id;
      productCheck = { status: 'master_filled', master_id: master.id, master_name: master.name };
    } else {
      const mismatches = compareMaster(master.master_data, scan, PRODUCT_HARD, PRODUCT_SOFT, false);
      resolvedMasterId = master.id;
      productCheck = { status: statusFromMismatches(mismatches), master_id: master.id, master_name: master.name, mismatches };
    }
  }

  return {
    checkResults: { brand: brandCheck, product: productCheck, checked_at: new Date().toISOString() },
    resolvedBrandId,
    resolvedMasterId,
  };
}
