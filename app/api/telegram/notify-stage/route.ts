import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStageName } from '@/lib/job-workflow';
import { STAGE_DEPARTMENT, STAGE_EMOJI, escapeHtml, sendToChat } from '@/lib/telegram-groups';

/**
 * POST /api/telegram/notify-stage — auto-alert the right department group
 * when a job changes stage.
 *
 * Called by the DB trigger `trg_notify_telegram_stage_change` (pg_net) on
 * every jobs.current_stage change, so it fires no matter which code path
 * moved the job.
 *
 * SECURITY-BY-DESIGN (no shared secret needed): the payload is treated as a
 * hint only. We re-read the job's REAL current_stage from the DB with the
 * service role and dedupe against telegram_stage_alerts — so a forged call
 * can, at worst, re-announce the true current state once.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobId: string | undefined = body?.job_id;
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 1. DB truth — never trust the payload's stage
    const { data: job } = await service
      .from('jobs')
      .select('id, job_number, project_name, current_stage, quantity, clients(name, company)')
      .eq('id', jobId)
      .single();
    if (!job?.current_stage) return NextResponse.json({ skipped: 'job not found' });

    const stage = job.current_stage as string;

    // 2. Dedupe — skip if we already announced this job at this stage
    const { data: lastAlert } = await service
      .from('telegram_stage_alerts')
      .select('stage')
      .eq('job_id', jobId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastAlert?.stage === stage) return NextResponse.json({ skipped: 'duplicate' });

    // 3. Which department group gets it?
    const department = STAGE_DEPARTMENT[stage];
    if (!department) return NextResponse.json({ skipped: 'no department for stage' });

    const { data: groups } = await service
      .from('telegram_groups')
      .select('chat_id')
      .eq('department', department)
      .eq('is_active', true)
      .eq('alerts_enabled', true);

    // 4. Compose
    const client = Array.isArray(job.clients) ? job.clients[0] : job.clients;
    const clientName = client?.company || client?.name || '—';
    const emoji = STAGE_EMOJI[stage] || '🔔';
    const msg =
      `${emoji} <b>${escapeHtml(job.job_number || 'Job')}</b> → <b>${escapeHtml(getStageName(stage))}</b>\n` +
      `${escapeHtml(job.project_name || '')}\n` +
      `👤 ${escapeHtml(clientName)}${job.quantity ? ` · Qty ${job.quantity}` : ''}`;

    // 5. Send to Telegram group(s), if any are mapped
    const results = await Promise.all(
      (groups || []).map((g) => sendToChat(g.chat_id, msg, `/admin/jobs/${job.id}`))
    );
    const sent = results.filter(Boolean).length;

    // 6. Mirror the alert into the app's department chat room (for PC staff)
    let mirrored = false;
    const { data: channel } = await service
      .from('chat_channels')
      .select('id')
      .eq('type', 'department')
      .eq('name', department)
      .maybeSingle();
    if (channel) {
      const plain =
        `${emoji} ${job.job_number || 'Job'} → ${getStageName(stage)}\n` +
        `${job.project_name || ''}\n` +
        `👤 ${clientName}${job.quantity ? ` · Qty ${job.quantity}` : ''}\n` +
        `https://aayam-office-system.vercel.app/admin/jobs/${job.id}`;
      const { error: mirrorErr } = await service.from('chat_messages').insert({
        channel_id: channel.id,
        sender_id: null,
        content: plain,
      });
      mirrored = !mirrorErr;
    }

    // 7. Log for dedupe/audit (if the alert went anywhere)
    if (sent > 0 || mirrored) {
      await service.from('telegram_stage_alerts').insert({ job_id: jobId, stage });
    }

    return NextResponse.json({ sent, mirrored });
  } catch (err) {
    console.error('notify-stage error:', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
