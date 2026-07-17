// API Route: /api/products/[id]/scan — AI design scan.
// Reads the design file with Claude vision and stores a structured
// document (brand, product, net qty, MRP, full text transcript…) on the
// version + product, so designs can be matched product-wise / brand-wise.
//
// Accepts multipart form-data: file (preferred, at upload time) + version_id.
// Or JSON { version_id } — then the file is downloaded from Drive via the
// service account.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceAccountToken } from '@/lib/google-service-account';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 18 * 1024 * 1024; // Claude request limit headroom (base64 inflates ~1.33x)

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

/** Normalize a mime type — handles image/jpg, missing types, octet-stream. */
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

/** Extract a Drive file id from a webViewLink / share URL. */
function driveFileId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/d\/([\w-]{20,})/) || url.match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : null;
}

/** Flatten scan JSON into one searchable text blob. */
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

  // ── Get the file bytes (multipart upload OR Drive download) ─────────────
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

  // Fallback: download the version's file from Drive
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

  // ── Ask Claude to read the design ───────────────────────────────────────
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

  // ── Store the scan document ─────────────────────────────────────────────
  const scannedAt = new Date().toISOString();
  if (versionId) {
    await supabase.from('product_versions').update({ scan_data: scan, scanned_at: scannedAt }).eq('id', versionId);
  }
  await supabase
    .from('products')
    .update({ scan_data: scan, scan_text: flattenScan(scan) })
    .eq('id', productId);

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  await supabase.from('product_activity').insert({
    product_id: productId,
    version_id: versionId,
    event_type: 'scanned',
    detail: `Design scanned: ${[scan?.brand_name, scan?.product_name, scan?.net_qty].filter(Boolean).join(' · ') || 'contents extracted'}`,
    actor_id: user.id,
    actor_name: profile?.full_name || null,
  });

  return NextResponse.json({ ok: true, scan });
}
