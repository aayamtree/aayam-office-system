import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedBrand {
    name_en?: string;    name_hi?: string;    name_gu?: string;
    address_en?: string; address_hi?: string; address_gu?: string;
    phone?: string[];    website?: string;    email?: string;
    qr_data?: string;   barcode?: string;    regn_no?: string;
    mfg_lic_no?: string; mrp?: number;
}

interface ExtractedProduct {
    name_en?: string;   name_hi?: string;  name_gu?: string;
    category?: string;  composition_en?: string;
    active_ingredients?: { name: string; percentage: string; unit: string }[];
    directions_en?: string;  precautions_en?: string;
    first_aid_en?: string;   recommendations_en?: string;
    cir_regn_no?: string;    poison_category?: string;
}

// ─── Cached prompts ───────────────────────────────────────────────────────────
// OPTIMISATION 1: Prompt caching on both system + user prompt
// OPTIMISATION 2: Removed verbose field descriptions — Claude knows what name_en means
// OPTIMISATION 3: Concise rules only, no redundant examples

const SYSTEM_PROMPT = `You are a label reading expert for pesticide/agro-chemical packaging.
Extract information precisely from packaging images. Return only valid JSON — no markdown, no explanation.
Use null for any field not found. Extract MANUFACTURER details, not retailer.`;

// OPTIMISATION 4: Field list only — removed "brand or company name in English" style descriptions
// Saved ~140 input tokens per call on brand prompt, ~160 on product prompt
const BRAND_PROMPT = `Extract brand/company info from this packaging image.

Return JSON with these exact keys (null if not found):
name_en, name_hi, name_gu,
address_en, address_hi, address_gu,
phone (array, even if one number),
website, email, qr_data, barcode,
regn_no, mfg_lic_no, mrp (number, no ₹ symbol)`;

const PRODUCT_PROMPT = `Extract product info from this pesticide/agro-chemical packaging image.

Return JSON with these exact keys (null if not found):
name_en, name_hi, name_gu, category, composition_en,
active_ingredients (array of {name, percentage, unit}),
directions_en, precautions_en, first_aid_en, recommendations_en,
cir_regn_no, poison_category

Extract complete text for directions/precautions/first_aid — do not truncate.`;

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
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 500 });
    }

    const formData     = await request.formData();
    const file         = formData.get('file')         as File | null;
    const extract_type = formData.get('extract_type') as 'brand' | 'product' | null;

    if (!file)         return NextResponse.json({ error: 'No file uploaded' },                         { status: 400 });
    if (!extract_type) return NextResponse.json({ error: 'extract_type is required (brand|product)' }, { status: 400 });

    const fileBuffer = await file.arrayBuffer();
    const fileBase64 = Buffer.from(fileBuffer).toString('base64');
    const mediaType  = (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf') || 'image/jpeg';

    const contentPart = mediaType === 'application/pdf'
        ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 } }
        : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: fileBase64 } };

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    try {
        const response = await client.messages.create({
            // OPTIMISATION 5: Sonnet instead of Opus — 3x cheaper
            // Extraction is pattern matching, not complex reasoning — Sonnet handles it well
            model: 'claude-sonnet-4-5',
            // OPTIMISATION 6: 4096 → 2048
            // Product extraction with long directions text needs more room than label-check
            max_tokens: 2048,
            system: [
                {
                    type: 'text',
                    text: SYSTEM_PROMPT,
                    cache_control: { type: 'ephemeral' }, // system cached
                }
            ],
            messages: [{
                role: 'user',
                content: [
                    contentPart,
                    {
                        type: 'text',
                        text: extract_type === 'brand' ? BRAND_PROMPT : PRODUCT_PROMPT,
                        cache_control: { type: 'ephemeral' }, // extraction prompt cached too
                    },
                ],
            }],
        });

        // Log token usage
        const usage = response.usage as any;
        console.log('[label-extract] Tokens:', {
            extract_type,
            input:       usage?.input_tokens,
            cache_write: usage?.cache_creation_input_tokens || 0,
            cache_read:  usage?.cache_read_input_tokens     || 0,
            output:      usage?.output_tokens,
        });

        let rawJson = (response.content[0] as { type: string; text: string }).text.trim();
        rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
        const extracted: ExtractedBrand | ExtractedProduct = JSON.parse(rawJson);

        return NextResponse.json({ extracted, extract_type });

    } catch (err: any) {
        console.error('[label-extract] error:', err);
        return NextResponse.json({ error: 'AI extraction failed: ' + (err.message || 'Unknown error') }, { status: 500 });
    }
}
