// API Route: /api/products/[id]/scan — AI design scan + master cross-check.
//
// 1. Claude vision reads the design file → structured scan document
// 2. BRAND MASTER: the scanned brand details are matched against the brands
//    table (master_data). New brand → master auto-created. Empty master →
//    auto-filled. Existing master → field-by-field check, mismatches reported.
// 3. PRODUCT MASTER: same for generic product details (product_masters table,
//    shared across brands — e.g. PACLOBUTRAZOL 23% SC).
// Results stored on version + product (check_results) and shown in the UI,
// with an "update master" action when the design carries new correct details.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceAccountToken } from '@/lib/google-service-account';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 18 * 1024 * 1024;

async function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
  const { data: { user } } = await auth.auth.getUser();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : auth;
  return { user, supabase: service };
}

const SYSTEM_PROMPT = `You are a packaging design reading expert for a printing company.
You read final packaging design files (boxes, labels, pouches, cartons, stickers) in any language (English, Hindi, Gujarati and others).
Extract information precisely. Return ONLY valid JSON — no markdown, no explanation. Use null for fields not found.`;

const SCAN_PROMPT = `Read this packaging design file completely and return JSON with these exact keys (null if not found):

brand_name, product_name, variant,
net_qty (e.g. "500 ml", "100 g"), mrp (number only, no currency symbol),
category (best guess: Box | Label | Pouch | Carton | Sticker | Bag | Other),
languages (array of languages used on the design),
barcode, fssai_no, other_regn_nos (array),
manufactured_by, marketed_by, address,
phone (array), email, website,
ingredients_or_composition, usage_instructions, warnings,
key_claims (array of marketing claims, e.g. "100% natural"),
dimensions_text (any size/dimension printed on the design),
full_text (COMPLETE transcript of ALL text on the design, preserving original languages — do not truncate)`;

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeMediaType(type: string | null, fileName: string | null): string {
  let t = (type || '').toLowerCase().trim();
  if (t === 'image/jpg') t = 'image/jpeg';
  if (!t || t === 'application/octet-stream' || t === 'binary/octet-stream') {
    const ext = (fileName || '').toLowerCase().split('.').pop() || '';
    const byExt: Record<string, string> = {
      pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg',
      png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    };
    t = byExt[ext] || t;
  }
  return t || 'application/pdf';
}

function driveFileId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/d\/([\w-]{20,})/) || url.match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : null;
}

function flattenScan(scan: any): string {
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

/** Normalize a value for comparison (case/space/punctuation-insensitive). */
function norm(v: any): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(norm).sort().join('|');
  return String(v).toLowerCase().replace(/[^a-z0-9ऀ-ॿ઀-૿]+/g, '');
}

/** Phones compare by digits only. */
function normPhone(v: any): string {
  if (v == null) return '';
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((p) => String(p).replace(/\D/g, '')).filter(Boolean).sort().join('|');
}

const BRAND_FIELDS = ['manufactured_by', 'marketed_by', 'address', 'email', 'website', 'fssai_no', 'other_regn_nos'] as const;
const PRODUCT_FIELDS = ['category', 'ingredients_or_composition', 'usage_instructions', 'warnings'] as const;

interface Mismatch { field: string; master: any; found: any }

function compareFields(master: any, scan: any, fields: readonly string[], withPhone: boolean): Mismatch[] {
  const mismatches: Mismatch[] = [];
  for (const f of fields) {
    const m = master?.[f];
    const s = scan?.[f];
    if (m == null || s == null) continue; // only compare when both sides have data
    if (norm(m) !== norm(s)) mismatches.push({ field: f, master: m, found: s });
  }
  if (withPhone && master?.phone != null && scan?.phone != null && normPhone(master.phone) !== normPhone(scan.phone)) {
    mismatches.push({ field: 'phone', master: master.phone, found: scan.phone });
  }
  return mismatches;
}

function brandMasterFromScan(scan: any) {
  return {
    brand_name: scan.brand_name ?? null,
    manufactured_by: scan.manufactured_by ?? null,
    marketed_by: scan.marketed_by ?? null,
    address: scan.address ?? null,
    phone: scan.phone ?? null,
    email: scan.email ?? null,
    website: scan.website ?? null,
    fssai_no: scan.fssai_no ?? null,
    other_regn_nos: scan.other_regn_nos ?? null,
  };
}

function productMasterFromScan(scan: any) {
  return {
    product_name: scan.product_name ?? null,
    category: scan.category ?? null,
    ingredients_or_composition: scan.ingredients_or_composition ?? null,
    usage_instructions: scan.usage_instructions ?? null,
    warnings: scan.warnings ?? null,
    key_claims: scan.key_claims ?? null,
  };
}

// ─── main handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const cookieStore = await cookies();
  const { user, supabase } = await getSupabase(cookieStore);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // ── file bytes (multipart or Drive) ─────────────────────────────────────
  let fileBuffer: ArrayBuffer | null = null;
  let mediaType = 'application/pdf';
  let versionId: string | null = null;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    versionId = (form.get('version_id') as string) || null;
    if (file) {
      if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large to scan (max 18 MB). Upload a smaller PDF/JPG preview.' }, { status: 413 });
      fileBuffer = await file.arrayBuffer();
      mediaType = normalizeMediaType(file.type, file.name);
    }
  } else {
    const body = await request.json().catch(() => ({}));
    versionId = body.version_id || null;
  }

  if (!fileBuffer) {
    if (!versionId) return NextResponse.json({ error: 'file or version_id is required' }, { status: 400 });
    const { data: version } = await supabase
      .from('product_versions')
      .select('file_url, file_name')
      .eq('id', versionId)
      .single();
    const fileId = driveFileId(version?.file_url || null);
    if (!fileId) return NextResponse.json({ error: 'No Drive file found on this version' }, { status: 400 });

    const sa = await getServiceAccountToken();
    if (!sa.success || !sa.accessToken) return NextResponse.json({ error: sa.error || 'Drive token failed' }, { status: 503 });

    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size,mimeType&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${sa.accessToken}` } }
    );
    if (!metaRes.ok) return NextResponse.json({ error: `Drive metadata failed (${metaRes.status})` }, { status: 502 });
    const meta = await metaRes.json();
    if (meta.size && parseInt(meta.size) > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large to scan (max 18 MB). Re-upload a smaller PDF/JPG preview version.' }, { status: 413 });
    }
    mediaType = normalizeMediaType(meta.mimeType, version?.file_name || null);

    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${sa.accessToken}` } }
    );
    if (!dlRes.ok) return NextResponse.json({ error: `Drive download failed (${dlRes.status})` }, { status: 502 });
    fileBuffer = await dlRes.arrayBuffer();
  }

  const supported = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!supported.includes(mediaType)) {
    return NextResponse.json({ error: `Cannot scan ${mediaType} files — scanning works for PDF and image files. (AI/CDR files: export a PDF.)` }, { status: 415 });
  }

  // ── Claude reads the design ─────────────────────────────────────────────
  const fileBase64 = Buffer.from(fileBuffer).toString('base64');
  const contentBlock = mediaType === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: fileBase64 } };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let scan: any;
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: SCAN_PROMPT }] }],
    });
    const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    scan = JSON.parse(text.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''));
  } catch (e: any) {
    return NextResponse.json({ error: `Scan failed: ${e.message}` }, { status: 500 });
  }

  const { data: product } = await supabase
    .from('products')
    .select('id, client_id, brand_id, product_master_id')
    .eq('id', productId)
    .single();

  // ── BRAND MASTER check ──────────────────────────────────────────────────
  let brandCheck: any = { status: 'no_brand_on_design' };
  let resolvedBrandId: string | null = product?.brand_id || null;
  if (scan?.brand_name) {
    let brand: any = null;
    if (product?.brand_id) {
      const { data } = await supabase.from('brands').select('id, name, master_data').eq('id', product.brand_id).single();
      brand = data;
    }
    if (!brand) {
      const { data } = await supabase.from('brands').select('id, name, master_data').ilike('name', scan.brand_name.trim()).limit(1);
      brand = data?.[0] || null;
    }
    if (!brand) {
      const { data: created } = await supabase
        .from('brands')
        .insert({ name: scan.brand_name.trim(), client_id: product?.client_id || null, master_data: brandMasterFromScan(scan), master_text: flattenScan(brandMasterFromScan(scan)), master_updated_at: new Date().toISOString() })
        .select('id, name')
        .single();
      resolvedBrandId = created?.id || null;
      brandCheck = { status: 'new_master_created', brand_id: resolvedBrandId, brand_name: scan.brand_name.trim() };
    } else if (!brand.master_data) {
      await supabase
        .from('brands')
        .update({ master_data: brandMasterFromScan(scan), master_text: flattenScan(brandMasterFromScan(scan)), master_updated_at: new Date().toISOString() })
        .eq('id', brand.id);
      resolvedBrandId = brand.id;
      brandCheck = { status: 'master_filled', brand_id: brand.id, brand_name: brand.name };
    } else {
      const mismatches = compareFields(brand.master_data, scan, BRAND_FIELDS, true);
      resolvedBrandId = brand.id;
      brandCheck = {
        status: mismatches.length === 0 ? 'match' : 'mismatch',
        brand_id: brand.id,
        brand_name: brand.name,
        mismatches,
      };
    }
  }

  // ── PRODUCT MASTER check (generic product, shared across brands) ────────
  let productCheck: any = { status: 'no_product_on_design' };
  let resolvedMasterId: string | null = product?.product_master_id || null;
  if (scan?.product_name) {
    let master: any = null;
    if (product?.product_master_id) {
      const { data } = await supabase.from('product_masters').select('id, name, master_data').eq('id', product.product_master_id).single();
      master = data;
    }
    if (!master) {
      const { data } = await supabase.from('product_masters').select('id, name, master_data').ilike('name', scan.product_name.trim()).limit(1);
      master = data?.[0] || null;
    }
    if (!master) {
      const { data: created } = await supabase
        .from('product_masters')
        .insert({ name: scan.product_name.trim(), category: scan.category || null, master_data: productMasterFromScan(scan), master_text: flattenScan(productMasterFromScan(scan)), created_by: user.id })
        .select('id, name')
        .single();
      resolvedMasterId = created?.id || null;
      productCheck = { status: 'new_master_created', master_id: resolvedMasterId, master_name: scan.product_name.trim() };
    } else if (!master.master_data) {
      await supabase
        .from('product_masters')
        .update({ master_data: productMasterFromScan(scan), master_text: flattenScan(productMasterFromScan(scan)), updated_at: new Date().toISOString() })
        .eq('id', master.id);
      resolvedMasterId = master.id;
      productCheck = { status: 'master_filled', master_id: master.id, master_name: master.name };
    } else {
      const mismatches = compareFields(master.master_data, scan, PRODUCT_FIELDS, false);
      resolvedMasterId = master.id;
      productCheck = {
        status: mismatches.length === 0 ? 'match' : 'mismatch',
        master_id: master.id,
        master_name: master.name,
        mismatches,
      };
    }
  }

  const checkResults = { brand: brandCheck, product: productCheck, checked_at: new Date().toISOString() };

  // ── store everything ────────────────────────────────────────────────────
  const scannedAt = new Date().toISOString();
  if (versionId) {
    await supabase.from('product_versions').update({ scan_data: scan, scanned_at: scannedAt, check_results: checkResults }).eq('id', versionId);
  }
  await supabase
    .from('products')
    .update({
      scan_data: scan,
      scan_text: flattenScan(scan),
      check_results: checkResults,
      ...(resolvedBrandId && !product?.brand_id ? { brand_id: resolvedBrandId, brand_name: scan.brand_name?.trim() || null } : {}),
      ...(resolvedMasterId && !product?.product_master_id ? { product_master_id: resolvedMasterId } : {}),
    })
    .eq('id', productId);

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const brandNote = brandCheck.status === 'mismatch' ? ` ⚠ brand mismatch (${brandCheck.mismatches.length} fields)` : '';
  const prodNote = productCheck.status === 'mismatch' ? ` ⚠ product mismatch (${productCheck.mismatches.length} fields)` : '';
  await supabase.from('product_activity').insert({
    product_id: productId,
    version_id: versionId,
    event_type: 'scanned',
    detail: `Design scanned: ${[scan?.brand_name, scan?.product_name, scan?.net_qty].filter(Boolean).join(' · ') || 'contents extracted'}${brandNote}${prodNote}`,
    meta: { brand_check: brandCheck.status, product_check: productCheck.status },
    actor_id: user.id,
    actor_name: profile?.full_name || null,
  });

  return NextResponse.json({ ok: true, scan, check_results: checkResults });
}
