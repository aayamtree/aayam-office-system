import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStageName } from '@/lib/job-workflow';
import { STAGE_DEPARTMENT, STAGE_EMOJI, escapeHtml, mentionStaff, sendToChatResult } from '@/lib/telegram-groups';
import { rateLimit } from '@/lib/rate-limit';

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
  // This route is intentionally unauthenticated (the Postgres trigger calls it
  // via pg_net and has no session). The payload is only a hint — the real stage
  // is re-read from the DB — but a cap stops anyone spamming the groups.
  const limited = rateLimit(req, { key: 'telegram-notify-stage', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

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
      .select('id, job_number, project_name, current_stage, quantity, designer_id, clients(name, company)')
      .eq('id', jobId)
      .single();
    if (!job?.current_stage) return NextResponse.json({ skipped: 'job not found' });

    const stage = job.current_stage as string;

    // 2. Dedupe — skip if we already announced this job at this stage.
    //    Exception: if that previous attempt targeted Telegram groups and NONE
    //    of them accepted it, the job was never actually announced. Retry once
    //    rather than treating a failed send as done.
    const { data: lastAlert } = await service
      .from('telegram_stage_alerts')
      .select('stage, groups_targeted, telegram_sent')
      .eq('job_id', jobId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastAlert?.stage === stage) {
      const previouslyFailed =
        (lastAlert.groups_targeted || 0) > 0 && (lastAlert.telegram_sent || 0) === 0;
      if (!previouslyFailed) return NextResponse.json({ skipped: 'duplicate' });
      console.warn(`[telegram] retrying stage alert for job ${jobId} at ${stage} — previous attempt reached no group`);
    }

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

    // Who is this for? A message to an 18-person group with no name on it is a
    // message everyone assumes is somebody else's. Design jobs carry a designer,
    // so address them by name; print/dispatch have no per-person assignment.
    let assigneeLine = '';
    let assigneePlain = '';
    if (department === 'design') {
      let designer: { full_name: string | null; telegram_chat_id: string | null; telegram_username: string | null } | null = null;
      if (job.designer_id) {
        const { data } = await service
          .from('profiles')
          .select('full_name, telegram_chat_id, telegram_username')
          .eq('id', job.designer_id)
          .maybeSingle();
        designer = data;
      }
      if (designer) {
        assigneeLine = `\n👉 For ${mentionStaff(designer)}`;
        assigneePlain = `\n👉 For ${designer.full_name?.trim() || 'Staff'}`;
      } else {
        assigneeLine = `\n⚠️ <b>Unassigned</b> — who can take this?`;
        assigneePlain = `\n⚠️ Unassigned — who can take this?`;
      }
    }

    const msg =
      `${emoji} <b>${escapeHtml(job.job_number || 'Job')}</b> → <b>${escapeHtml(getStageName(stage))}</b>\n` +
      `${escapeHtml(job.project_name || '')}\n` +
      `👤 ${escapeHtml(clientName)}${job.quantity ? ` · Qty ${job.quantity}` : ''}` +
      assigneeLine;

    // 5. Send to Telegram group(s), if any are mapped
    const targeted = (groups || []).length;
    const results = await Promise.all(
      (groups || []).map((g) => sendToChatResult(g.chat_id, msg, `/admin/jobs/${job.id}`))
    );
    const sent = results.filter((r) => r.ok).length;
    const firstError = results.find((r) => !r.ok)?.error || null;

    if (targeted === 0) {
      console.warn(`[telegram] no group mapped to department "${department}" — stage ${stage} announced nowhere on Telegram`);
    } else if (sent < targeted) {
      console.error(`[telegram] stage alert reached ${sent}/${targeted} groups for department "${department}": ${firstError}`);
    }

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
        `👤 ${clientName}${job.quantity ? ` · Qty ${job.quantity}` : ''}` +
        `${assigneePlain}\n` +
        `https://aayam-office-system.vercel.app/admin/jobs/${job.id}`;
      const { error: mirrorErr } = await service.from('chat_messages').insert({
        channel_id: channel.id,
        sender_id: null,
        content: plain,
      });
      mirrored = !mirrorErr;
    }

    // 7. Log what ACTUALLY happened.
    //
    // This row used to be written whenever Telegram OR the in-app mirror
    // succeeded, and recorded neither. Since the mirror nearly always succeeds,
    // a completely broken Telegram left behind a log identical to a healthy
    // one. Now the row carries the real numbers and Telegram's own error, so
    // "reached nobody" is a queryable fact rather than a guess.
    if (sent > 0 || mirrored) {
      await service.from('telegram_stage_alerts').insert({
        job_id: jobId,
        stage,
        groups_targeted: targeted,
        telegram_sent: sent,
        mirrored,
        last_error: firstError,
      });
    }

    return NextResponse.json({ sent, targeted, mirrored, error: firstError });
  } catch (err) {
    console.error('notify-stage error:', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
