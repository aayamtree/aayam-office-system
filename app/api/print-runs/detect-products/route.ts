// API Route: /api/print-runs/detect-products
// Looks at ONE print-run sheet picture and, for each job on that run, draws a
// box around one complete copy of that job's label / box / pouch. DETECTION
// ONLY — nothing is saved; the person reviews and confirms in the browser,
// which then crops and stores the pictures.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You are a prepress expert looking at a printing gang sheet that carries several different customer jobs (labels, pouches, box dielines).
Read all languages. Return ONLY valid JSON, no markdown.`;

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { key: 'ai-detect-run-products', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const image: string = String(body.image_base64 || '');
  const jobs: { id: string; client: string; name: string; qty?: number | null }[] = Array.isArray(body.jobs) ? body.jobs.slice(0, 40) : [];
  if (!image || jobs.length === 0) return NextResponse.json({ error: 'image_base64 and jobs are required' }, { status: 400 });
  if (image.length > 7_000_000) return NextResponse.json({ error: 'Image too large' }, { status: 413 });

  const list = jobs.map((j, i) => `${i + 1}. id=${j.id} | client: ${j.client || '—'} | item: ${j.name || '—'}${j.qty ? ` | qty: ${j.qty}` : ''}`).join('\n');
  const prompt = `This print sheet is for these jobs:\n${list}\n
For EACH job above, find it on the sheet and give a bounding box around ONE COMPLETE copy of that job's label/dieline (include all its text, slightly generous so nothing is cut off). If the same design repeats, box only one copy (the clearest one).
Match by the printed brand/product name and the client name. If you are not sure a job is on the sheet, leave it out — never guess.
Return JSON: { "matches": [ { "job_id": "<id from the list>", "x": left, "y": top, "w": width, "h": height, "confidence": "high"|"medium"|"low" } ] }
x, y, w, h are FRACTIONS 0.0-1.0 of the image width/height.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: prompt },
        ],
      }],
    });
    const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const parsed = JSON.parse(text.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''));
    const valid = new Set(jobs.map(j => j.id));
    const clamp = (n: any) => Math.min(1, Math.max(0, Number(n) || 0));
    const matches = (Array.isArray(parsed?.matches) ? parsed.matches : [])
      .filter((m: any) => valid.has(m?.job_id) && Number(m.w) > 0.02 && Number(m.h) > 0.02)
      .map((m: any) => {
        const x = clamp(m.x), y = clamp(m.y);
        return { job_id: m.job_id, x, y, w: Math.min(clamp(m.w), 1 - x), h: Math.min(clamp(m.h), 1 - y), confidence: m.confidence || 'medium' };
      });
    return NextResponse.json({ ok: true, matches });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not read the sheet: ${e.message}` }, { status: 500 });
  }
}
