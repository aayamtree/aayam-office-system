import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckItem {
  field: string;
  label: string;
  expected: string;
  found: string | null;
  status: 'pass' | 'fail' | 'missing' | 'warning';
  note?: string;
}

interface Discovery {
  field_name: string;
  field_label: string;
  found_value: string;
  db_table: 'label_brands' | 'label_products';
}

interface CheckReport {
  summary: { pass: number; fail: number; missing: number; warning: number };
  brand_checks: CheckItem[];
  product_checks: CheckItem[];
  discoveries: Discovery[];
  raw_text_extracted: string;
}

// ─── Helper: build brand field list ──────────────────────────────────────────

function buildBrandFields(brand: Record<string, any>): { field: string; label: string; value: string }[] {
  const fields = [];
  if (brand.name_en)   fields.push({ field: 'name_en',   label: 'Brand Name (English)', value: brand.name_en });
  if (brand.name_hi)   fields.push({ field: 'name_hi',   label: 'Brand Name (Hindi)',   value: brand.name_hi });
  if (brand.name_gu)   fields.push({ field: 'name_gu',   label: 'Brand Name (Gujarati)',value: brand.name_gu });
  if (brand.address_en) fields.push({ field: 'address_en', label: 'Address (English)', value: brand.address_en });
  if (brand.address_hi) fields.push({ field: 'address_hi', label: 'Address (Hindi)',   value: brand.address_hi });
  if (brand.address_gu) fields.push({ field: 'address_gu', label: 'Address (Gujarati)',value: brand.address_gu });
  if (brand.phone?.length) fields.push({ field: 'phone', label: 'Phone Number(s)', value: brand.phone.join(', ') });
  if (brand.website)   fields.push({ field: 'website',   label: 'Website',             value: brand.website });
  if (brand.email)     fields.push({ field: 'email',     label: 'Email',               value: brand.email });
  if (brand.qr_data)   fields.push({ field: 'qr_data',   label: 'QR Code Data',        value: brand.qr_data });
  if (brand.barcode)   fields.push({ field: 'barcode',   label: 'Barcode',             value: brand.barcode });
  if (brand.regn_no)   fields.push({ field: 'regn_no',   label: 'Registration No.',    value: brand.regn_no });
  if (brand.mfg_lic_no) fields.push({ field: 'mfg_lic_no', label: 'Mfg. Licence No.', value: brand.mfg_lic_no });
  if (brand.mrp)       fields.push({ field: 'mrp',       label: 'MRP (₹)',             value: String(brand.mrp) });
  return fields;
}

function buildProductFields(product: Record<string, any>): { field: string; label: string; value: string }[] {
  const fields = [];
  if (product.name_en) fields.push({ field: 'name_en', label: 'Product Name (English)', value: product.name_en });
  if (product.name_hi) fields.push({ field: 'name_hi', label: 'Product Name (Hindi)',   value: product.name_hi });
  if (product.name_gu) fields.push({ field: 'name_gu', label: 'Product Name (Gujarati)',value: product.name_gu });
  if (product.category) fields.push({ field: 'category', label: 'Category / Type',      value: product.category });
  if (product.composition_en) fields.push({ field: 'composition_en', label: 'Chemical Composition', value: product.composition_en });
  if (product.active_ingredients?.length) {
    const ai = product.active_ingredients.map((i: any) => `${i.name} ${i.percentage} ${i.unit}`).join(', ');
    fields.push({ field: 'active_ingredients', label: 'Active Ingredients', value: ai });
  }
  if (product.directions_en) fields.push({ field: 'directions_en', label: 'Directions of Use (English)', value: product.directions_en.substring(0, 300) });
  if (product.precautions_en) fields.push({ field: 'precautions_en', label: 'Precautions (English)', value: product.precautions_en.substring(0, 200) });
  if (product.first_aid_en) fields.push({ field: 'first_aid_en', label: 'First Aid (English)', value: product.first_aid_en.substring(0, 200) });
  if (product.recommendations_en) fields.push({ field: 'recommendations_en', label: 'Crop Recommendations', value: product.recommendations_en.substring(0, 200) });
  if (product.cir_regn_no) fields.push({ field: 'cir_regn_no', label: 'CIR / Regn. No.', value: product.cir_regn_no });
  if (product.poison_category) fields.push({ field: 'poison_category', label: 'Poison Category', value: product.poison_category });
  return fields;
}

// ✅ PROMPT CACHING: Static system prompt moved outside handler
// This gets cached after first call — every subsequent label check saves ~90% on system tokens
const SYSTEM_PROMPT = `You are a label verification expert for a printing company. Your job is to carefully read label designs and verify their content against a master database. You must be precise, thorough, and return only valid JSON.

Status rules for checks:
- "pass": field is present and matches exactly (or very closely) what's in DB
- "fail": field is present but has WRONG content (e.g. different address, different phone — possibly from another brand)
- "missing": field is completely absent from the label (blank, not found anywhere)
- "warning": field is present but there's a minor formatting difference or partial match

discoveries: List only genuinely NEW information found in the label that is NOT currently stored in our database for this brand/product. Do NOT list fields that already exist in DB — only truly new data.

Return ONLY a JSON object in this exact format (no markdown, no explanation, just pure JSON):
{
  "raw_text_extracted": "all visible text from the label, concatenated",
  "brand_checks": [
    {
      "field": "field_key",
      "label": "Human readable field name",
      "expected": "what our DB says it should be",
      "found": "what you actually see in the label (null if not found at all)",
      "status": "pass|fail|missing|warning",
      "note": "optional explanation of the issue"
    }
  ],
  "product_checks": [
    {
      "field": "field_key",
      "label": "Human readable field name",
      "expected": "what our DB says it should be",
      "found": "what you actually see in the label (null if not found at all)",
      "status": "pass|fail|missing|warning",
      "note": "optional explanation"
    }
  ],
  "discoveries": [
    {
      "field_name": "snake_case_field_name",
      "field_label": "Human readable name",
      "found_value": "the value found in the label",
      "db_table": "label_brands or label_products"
    }
  ]
}`;

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured. Please add it to .env.local.' }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const brand_id = formData.get('brand_id') as string | null;
  const product_id = formData.get('product_id') as string | null;
  const job_id = formData.get('job_id') as string | null;

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!brand_id) return NextResponse.json({ error: 'Brand is required' }, { status: 400 });
  if (!product_id) return NextResponse.json({ error: 'Product is required' }, { status: 400 });

  const [{ data: brand }, { data: product }] = await Promise.all([
    supabase.from('label_brands').select('*').eq('id', brand_id).single(),
    supabase.from('label_products').select('*').eq('id', product_id).single(),
  ]);
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const storagePath = `label-checks/${user.id}/${Date.now()}.${ext}`;
  const fileBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from('uploads')
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

  let file_url: string | null = null;
  if (!uploadErr) {
    const { data } = supabase.storage.from('uploads').getPublicUrl(storagePath);
    file_url = data.publicUrl;
  }

  const brandFields = buildBrandFields(brand);
  const productFields = buildProductFields(product);

  // Dynamic part: brand/product data changes per check — NOT cached
  const brandFieldList = brandFields.map(f => `  - ${f.label}: "${f.value}"`).join('\n');
  const productFieldList = productFields.map(f => `  - ${f.label}: "${f.value}"`).join('\n');

  const userPrompt = `Please carefully read this label design image and verify its content against our master database records.

BRAND DATABASE RECORD (what SHOULD appear on this label for brand: ${brand.name_en}):
${brandFieldList}

PRODUCT DATABASE RECORD (what SHOULD appear on this label for product: ${product.name_en}):
${productFieldList}

Your task:
1. Read ALL text visible in the label design
2. For each brand field listed above: check if the correct value appears in the label
3. For each product field listed above: check if the correct value appears in the label
4. Note any brand/company details found in the label that are NOT in our brand database
5. Note any product details found that differ from our database`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let report: CheckReport;

  try {
    const fileBase64 = Buffer.from(fileBuffer).toString('base64');
    const mediaType = (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf') || 'image/jpeg';

    const contentPart = mediaType === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: fileBase64 } };

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      // ✅ CACHING ACTIVATED: system is now an array with cache_control
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }, // ← THE ONLY NEW LINE
        }
      ],
      messages: [
        {
          role: 'user',
          content: [
            contentPart,
            { type: 'text', text: userPrompt }, // dynamic — NOT cached
          ],
        },
      ],
    });

    // ✅ Log cache stats (visible in Vercel function logs)
    const usage = response.usage as any;
    console.log('[label-check] Cache stats:', {
      input_tokens: usage?.input_tokens,
      cache_write: usage?.cache_creation_input_tokens || 0,
      cache_read: usage?.cache_read_input_tokens || 0,
      output_tokens: usage?.output_tokens,
    });

    const rawJson = (response.content[0] as { type: string; text: string }).text.trim();
    const parsed = JSON.parse(rawJson);

    const allChecks = [...(parsed.brand_checks || []), ...(parsed.product_checks || [])];
    const summary = {
      pass:    allChecks.filter((c: CheckItem) => c.status === 'pass').length,
      fail:    allChecks.filter((c: CheckItem) => c.status === 'fail').length,
      missing: allChecks.filter((c: CheckItem) => c.status === 'missing').length,
      warning: allChecks.filter((c: CheckItem) => c.status === 'warning').length,
    };

    report = { ...parsed, summary };

  } catch (err: any) {
    console.error('[label-check] Claude error:', err);
    return NextResponse.json({ error: 'AI scan failed: ' + (err.message || 'Unknown error') }, { status: 500 });
  }

  const { count } = await supabase
    .from('label_checks')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brand_id)
    .eq('product_id', product_id);

  const attempt_number = (count || 0) + 1;
  const allChecks = [...report.brand_checks, ...report.product_checks];
  const status = allChecks.some(c => c.status === 'fail' || c.status === 'missing') ? 'failed' : 'passed';

  const { data: checkRecord } = await supabase
    .from('label_checks')
    .insert({
      brand_id,
      product_id,
      job_id: job_id || null,
      file_url,
      file_name: file.name,
      file_size_kb: Math.round(file.size / 1024),
      check_type: 'content',
      attempt_number,
      status,
      check_results: report,
      submitted_by: user.id,
    })
    .select('id')
    .single();

  if (report.discoveries?.length && checkRecord?.id) {
    const discoveryRows = report.discoveries.map((d: Discovery) => ({
      check_id: checkRecord.id,
      db_table: d.db_table,
      record_id: d.db_table === 'label_brands' ? brand_id : product_id,
      field_name: d.field_name,
      found_value: d.found_value,
      current_value: null,
      action: null,
    }));
    await supabase.from('label_discoveries').insert(discoveryRows);
  }

  return NextResponse.json({ report, check_id: checkRecord?.id, status });
}
