import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

interface PendingJobInput {
    id: string;
    job_number: string;
    project_name: string;
    client_name: string;
    product_category?: string;
    quantity?: number;
}

interface SheetLabel {
    label_name: string;       // what AI read from the image
    ups_count: number;        // how many times it appears on the sheet
    matched_job_id: string | null;
    matched_job_number: string | null;
    match_confidence: 'high' | 'medium' | 'low' | 'none';
}

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

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const jobsRaw = formData.get('jobs') as string | null;

    if (!file) return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    if (!jobsRaw) return NextResponse.json({ error: 'No jobs list provided' }, { status: 400 });

    const pendingJobs: PendingJobInput[] = JSON.parse(jobsRaw);

    const fileBuffer = await file.arrayBuffer();
    const fileBase64 = Buffer.from(fileBuffer).toString('base64');
    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';

    // Build a compact job list for the prompt
    const jobList = pendingJobs.map(j =>
        `ID:${j.id} | Job:${j.job_number} | Product:"${j.project_name}" | Client:"${j.client_name}"`
    ).join('\n');

    const prompt = `You are analyzing a print production imposition sheet — a layout image showing multiple product labels/packaging designs arranged together for offset printing.

Your task:
1. Identify ALL distinct label/product designs visible in this sheet image
2. For each label, read the product name and brand/variant text visible on it
3. Count how many times each label appears on the sheet (this is the UPS count)
4. Match each label against the PENDING JOBS LIST below

PENDING JOBS LIST:
${jobList}

Matching rules:
- Match by product name similarity (e.g. "SURAKSA 600ml" matches job with project_name "Suraksa - Metallic Box - 600ml")
- Partial matches are OK — use confidence: "high" if clear match, "medium" if likely, "low" if unsure, "none" if no match
- If a label has no matching job, set matched_job_id and matched_job_number to null, confidence to "none"
- A single job can only match once

Return ONLY this JSON (no markdown, no explanation):
{
  "found_on_sheet": [
    {
      "label_name": "exact text you read from the label",
      "ups_count": 1,
      "matched_job_id": "the ID from the job list or null",
      "matched_job_number": "e.g. AAY-2105001 or null",
      "match_confidence": "high"
    }
  ]
}`;

    try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const response = await client.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: mediaType, data: fileBase64 }
                    },
                    { type: 'text', text: prompt }
                ]
            }]
        });

        let raw = (response.content[0] as { type: string; text: string }).text.trim();
        raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
        const result: { found_on_sheet: SheetLabel[] } = JSON.parse(raw);

        // Split into matched vs unmatched
        const matched = result.found_on_sheet.filter(l => l.matched_job_id && l.match_confidence !== 'none');
        const unmatched = result.found_on_sheet.filter(l => !l.matched_job_id || l.match_confidence === 'none');

        return NextResponse.json({ matched, unmatched, all: result.found_on_sheet });

    } catch (err: any) {
        console.error('[analyze-print-sheet] error:', err);
        return NextResponse.json({ error: 'AI analysis failed: ' + (err.message || 'Unknown error') }, { status: 500 });
    }
}
