import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedBrand {
  name_en?: string;
  name_hi?: string;
  name_gu?: string;
  address_en?: string;
  address_hi?: string;
  address_gu?: string;
  phone?: string[];
  website?: string;
  email?: string;
  qr_data?: string;
  barcode?: string;
  regn_no?: string;
  mfg_lic_no?: string;
  mrp?: number;
}

interface ExtractedProduct {
  name_en?: string;
  name_hi?: string;
  name_gu?: string;
  category?: string;
  composition_en?: string;
  active_ingredients?: { name: string; percentage: string; unit: string }[];
  directions_en?: string;
  precautions_en?: string;
  first_aid_en?: string;
  recommendations_en?: string;
  cir_regn_no?: string;
  poison_category?: string;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured. Please add it to .env.local.' }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const extract_type = formData.get('extract_type') as 'brand' | 'product' | null;

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!extract_type) return NextResponse.json({ error: 'extract_type is required (brand or product)' }, { status: 400 });

  const fileBuffer = await file.arrayBuffer();
  const fileBase64 = Buffer.from(fileBuffer).toString('base64');
  const mediaType = (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf') || 'image/jpeg';

  const contentPart = mediaType === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: fileBase64 } };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const brandPrompt = `You are an expert at reading pesticide / agro-chemical packaging labels.
Read ALL text visible in this packaging image and extract the brand/company information.

Return ONLY a JSON object (no markdown, no explanation):
{
  "name_en": "brand or company name in English",
  "name_hi": "brand or company name in Hindi (if visible)",
  "name_gu": "brand or company name in Gujarati (if visible)",
  "address_en": "full address in English",
  "address_hi": "full address in Hindi (if visible)",
  "address_gu": "full address in Gujarati (if visible)",
  "phone": ["phone number 1", "phone number 2"],
  "website": "website url if visible",
  "email": "email if visible",
  "qr_data": "url or data encoded in QR code if visible",
  "barcode": "barcode number if visible",
  "regn_no": "company registration number if visible",
  "mfg_lic_no": "manufacturing licence number if visible",
  "mrp": 0
}

Rules:
- Only include fields that are actually visible. Use null for fields not found.
- phone must be an array even if only one number.
- mrp must be a number (no ₹ symbol), or null if not found.
- Extract the MANUFACTURER/BRAND company details, not the retailer.`;

  const productPrompt = `You are an expert at reading pesticide / agro-chemical packaging labels.
Read ALL text visible in this packaging image and extract the product information.

Return ONLY a JSON object (no markdown, no explanation):
{
  "name_en": "product name in English",
  "name_hi": "product name in Hindi (if visible)",
  "name_gu": "product name in Gujarati (if visible)",
  "category": "product category/type e.g. Insecticide, Fungicide, Herbicide, etc.",
  "composition_en": "full chemical composition string e.g. 'Emamectin Benzoate 5% SG'",
  "active_ingredients": [
    { "name": "ingredient name", "percentage": "5", "unit": "%" }
  ],
  "directions_en": "directions of use / how to use (full text)",
  "precautions_en": "safety precautions / warnings (full text)",
  "first_aid_en": "first aid instructions (full text)",
  "recommendations_en": "crop recommendations / target crops (full text)",
  "cir_regn_no": "CIR registration number or pesticide registration number",
  "poison_category": "poison class e.g. Class III, Caution, etc."
}

Rules:
- Only include fields that are actually visible. Use null for fields not found.
- active_ingredients must be an array of objects.
- Extract complete text for directions, precautions, first_aid — do not truncate.`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: 'You are a label reading expert. Extract information precisely from packaging images and return only valid JSON.',
      messages: [{
        role: 'user',
        content: [
          contentPart,
          { type: 'text', text: extract_type === 'brand' ? brandPrompt : productPrompt },
        ],
      }],
    });

    let rawJson = (response.content[0] as { type: string; text: string }).text.trim();
    // Strip markdown code fences if Claude wrapped the JSON in ```json ... ```
    rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const extracted = JSON.parse(rawJson);

    return NextResponse.json({ extracted, extract_type });
  } catch (err: any) {
    console.error('[label-extract] error:', err);
    return NextResponse.json({ error: 'AI extraction failed: ' + (err.message || 'Unknown error') }, { status: 500 });
  }
}
