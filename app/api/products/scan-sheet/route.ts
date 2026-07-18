// API Route: /api/products/scan-sheet — detect every UNIQUE job on a
// multi-job print sheet. Claude reads the whole sheet and returns one entry
// per distinct design (ignoring repeated copies of the same label), each
// with brand/product details for the master cross-check. DETECTION ONLY —
// no DB writes; the user reviews and then imports.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceAccountToken } from '@/lib/google-service-account';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_BYTES = 22 * 1024 * 1024; // base64 ~29MB, under Claude's 32MB request limit

function normalizeMediaType(type: string | null, fileName: string | null): string {
  let t = (type || '').toLowerCase().trim();
  if (t === 'image/jpg') t = 'image/jpeg';
  if (!t || t.includes('octet-stream')) {
    const ext = (fileName || '').toLowerCase().split('.').pop() || '';
    const byExt: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
    t = byExt[ext] || t;
  }
  return t || 'application/pdf';
}
function driveFileId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/d\/([\w-]{20,})/) || url.match(/[?&]id=([\w-]{20,})/);
  return m ? m[1] : null;
}

const SYSTEM_PROMPT = `You are a prepress expert reading a printing job/gang sheet for a printing company.
A single sheet often carries MULTIPLE different products/jobs laid out together (different brands, different SKUs, box dielines and labels mixed).
Read all languages (English, Hindi, Gujarati, etc). Return ONLY valid JSON — no markdown.`;

const SHEET_PROMPT = `This is a print sheet that may contain several DIFFERENT jobs.
Identify each UNIQUE job/product on the sheet. Treat repeated copies of the same design as ONE job (note how many copies in "copies_on_sheet"). Do NOT list the same product twice.

Return JSON: { "jobs": [ { ...one object per unique job... } ] }

Each job object keys (null if not found):
brand_name, product_name, variant,
net_qty, mrp (number only),
category (Box | Label | Pouch | Carton | Sticker | Bag | Other),
copies_on_sheet (integer, best estimate),
bbox (bounding box around ONE COMPLETE copy of this job — include the WHOLE label/dieline with ALL its text, especially the small manufacturer / marketed-by / address / customer-care block usually at the BOTTOM. Format { "page": 1-based page number, "x": left, "y": top, "w": width, "h": height } as FRACTIONS 0.0-1.0 of the page. Prefer a slightly generous box over a tight one so no text is cut off.),
languages (array),
barcode, fssai_no, other_regn_nos (array),
manufactured_by, marketed_by, address,
phone (array), email, website,
ingredients_or_composition, usage_instructions, warnings,
key_claims (array),
summary_text (short transcript of the key text for THIS job only)

Be precise: FIPROX and CULTEX are different jobs even if same manufacturer. A label repeated 12 times is ONE job with copies_on_sheet 12.`;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  let fileBuffer: ArrayBuffer | null = null;
  let mediaType = 'application/pdf';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Sheet too large (over 22 MB). Export a compressed PDF and try again.' }, { status: 413 });
    fileBuffer = await file.arrayBuffer();
    mediaType = normalizeMediaType(file.type, file.name);
  } else {
    const body = await request.json().catch(() => ({}));
    const fileId = driveFileId(body.file_url || null);
    if (!fileId) return NextResponse.json({ error: 'file or file_url is required' }, { status: 400 });
    const sa = await getServiceAccountToken();
    if (!sa.success || !sa.accessToken) return NextResponse.json({ error: sa.error || 'Drive token failed' }, { status: 503 });
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=size,mimeType&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${sa.accessToken}` } });
    const meta = await metaRes.json().catch(() => ({}));
    if (meta.size && parseInt(meta.size) > MAX_BYTES) return NextResponse.json({ error: 'Sheet too large (over 22 MB). Export a compressed PDF.' }, { status: 413 });
    mediaType = normalizeMediaType(meta.mimeType, body.file_name || null);
    const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${sa.accessToken}` } });
    if (!dlRes.ok) return NextResponse.json({ error: `Drive download failed (${dlRes.status})` }, { status: 502 });
    fileBuffer = await dlRes.arrayBuffer();
  }

  const supported = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!supported.includes(mediaType)) return NextResponse.json({ error: `Cannot read ${mediaType}. Export a PDF or image of the sheet.` }, { status: 415 });

  const fileBase64 = Buffer.from(fileBuffer).toString('base64');
  const contentBlock = mediaType === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as any, data: fileBase64 } };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: SHEET_PROMPT }] }],
    });
    const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const parsed = JSON.parse(text.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''));
    const jobs = Array.isArray(parsed) ? parsed : (parsed.jobs || []);
    return NextResponse.json({ ok: true, jobs, count: jobs.length });
  } catch (e: any) {
    return NextResponse.json({ error: `Sheet scan failed: ${e.message}` }, { status: 500 });
  }
}
