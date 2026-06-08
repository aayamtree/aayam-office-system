import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingJobInput {
    id: string;
    job_number: string;
    project_name: string;
    client_name: string;
    product_category?: string;
    quantity?: number;
}

// What Claude returns — compact keys to save output tokens
interface CompactLabel {
    n: string;              // label name (what Claude reads from image — NEW info)
    u: number;              // ups_count (NEW info)
    id: string | null;      // matched job id (short — we sent this, just echoed back)
    c: 'h' | 'm' | 'l' | 'n'; // confidence: high/medium/low/none
}

// What we return to frontend — full shape (reconstructed from pendingJobs)
interface SheetLabel {
    label_name: string;
    ups_count: number;
    matched_job_id: string | null;
    matched_job_number: string | null;
    match_confidence: 'high' | 'medium' | 'low' | 'none';
}

// ─── Confidence code expander ─────────────────────────────────────────────────

const CONF_MAP = { h: 'high', m: 'medium', l: 'low', n: 'none' } as const;

// ─── Cached system prompt ─────────────────────────────────────────────────────
// OPTIMISATION 1: Prompt cached — 90% cheaper after first call
// OPTIMISATION 2: Compact output schema — saves ~60% output tokens
// OPTIMISATION 3: Removed verbose matching rule explanations

const SYSTEM_PROMPT = `You analyze print production imposition sheets — layout images with multiple product labels arranged for offset printing.

Tasks:
1. Identify ALL distinct label designs visible in the sheet
2. Read the product name/brand text on each label
3. Count how many times each label appears (UPS count)
4. Match each label to the PENDING JOBS LIST in the user message

Match by product name similarity. Confidence: h=clear match, m=likely, l=unsure, n=no match. One job matches once only.

Return ONLY compact JSON (no markdown):
{ "s": [ { "n": "label name", "u": 4, "id": "job-id-or-null", "c": "h" } ] }

Keys: n=label_name, u=ups_count, id=matched_job_id (null if none), c=confidence code`;

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
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const formData  = await request.formData();
    const file      = formData.get('image') as File | null;
    const jobsRaw   = formData.get('jobs')  as string | null;

    if (!file)    return NextResponse.json({ error: 'No image uploaded' },    { status: 400 });
    if (!jobsRaw) return NextResponse.json({ error: 'No jobs list provided' }, { status: 400 });

    const pendingJobs: PendingJobInput[] = JSON.parse(jobsRaw);

    const fileBuffer = await file.arrayBuffer();
    const fileBase64 = Buffer.from(fileBuffer).toString('base64');
    const mediaType  = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';

    // Compact job list — only ID + product name needed for matching
    // OPTIMISATION 4: removed client_name and job_number from prompt (not needed for matching)
    const jobList = pendingJobs
        .map(j => `${j.id}|"${j.project_name}"`)
        .join('\n');

    try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const response = await client.messages.create({
            // OPTIMISATION 5: Sonnet instead of Opus — 3x cheaper, sufficient for image+text matching
            model: 'claude-sonnet-4-5',
            // OPTIMISATION 6: 4096 → 1024 — compact output needs far less room
            // Max ~20 labels × ~25 tokens each = 500 tokens worst case
            max_tokens: 1024,
            system: [
                {
                    type: 'text',
                    text: SYSTEM_PROMPT,
                    cache_control: { type: 'ephemeral' }, // cached after first call
                }
            ],
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: mediaType, data: fileBase64 }
                    },
                    {
                        type: 'text',
                        text: `PENDING JOBS (id|"product_name"):\n${jobList}`,
                    }
                ]
            }]
        });

        // Log token usage — watch savings vs old version
        const usage = response.usage as any;
        console.log('[analyze-print-sheet] Tokens:', {
            input:       usage?.input_tokens,
            cache_write: usage?.cache_creation_input_tokens || 0,
            cache_read:  usage?.cache_read_input_tokens     || 0,
            output:      usage?.output_tokens,
        });

        let raw = (response.content[0] as { type: string; text: string }).text.trim();
        raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

        const compact: { s: CompactLabel[] } = JSON.parse(raw);

        // Build a quick lookup: job id → job_number (from data we already have)
        const jobMap = Object.fromEntries(pendingJobs.map(j => [j.id, j.job_number]));

        // Reconstruct full SheetLabel shape — frontend gets same structure as before
        const allLabels: SheetLabel[] = compact.s.map(l => ({
            label_name:        l.n,
            ups_count:         l.u,
            matched_job_id:    l.id,
            matched_job_number: l.id ? (jobMap[l.id] ?? null) : null, // mapped in code, not from Claude
            match_confidence:  CONF_MAP[l.c],
        }));

        const matched   = allLabels.filter(l => l.matched_job_id && l.match_confidence !== 'none');
        const unmatched = allLabels.filter(l => !l.matched_job_id || l.match_confidence === 'none');

        return NextResponse.json({ matched, unmatched, all: allLabels });

    } catch (err: any) {
        console.error('[analyze-print-sheet] error:', err);
        return NextResponse.json({ error: 'AI analysis failed: ' + (err.message || 'Unknown error') }, { status: 500 });
    }
}
