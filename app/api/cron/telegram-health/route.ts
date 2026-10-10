// /api/cron/telegram-health — the Telegram alert system's own health check.
// Runs every 30 minutes.
//
// WHY THIS EXISTS
// Job-stage alerts are automatic: a database trigger calls /api/telegram/notify-stage
// on every stage change. When that chain breaks, nobody sees an error — the group
// is just quiet, and a quiet group looks the same as a calm day. On 7 and 9 Oct
// 2026, 43 alerts were lost to Telegram's "Too Many Requests" and nothing noticed.
//
// WHAT IT DOES, EVERY RUN
//   1. Bot token: Telegram's getMe must accept it; getWebhookInfo must not show a
//      fresh delivery error or a pile-up of pending updates.
//   2. Routing: every department that stage alerts target has an active group.
//   3. Self-heal: alerts that failed in the last 24h while the job is still at
//      that stage are re-sent (the notify route dedupes and retries only failures).
//   4. Gaps: stage changes with NO alert record at all (trigger or network failed
//      before reaching us). Reported, never re-sent blindly — bulk "mark dispatched"
//      deliberately skips alerts and must not be announced late.
//   5. Silence: working hours, jobs moved in the last 3 hours, zero alerts sent.
//   6. Unrecovered: alerts still failing after an hour of retries.
//
// WHO HEARS ABOUT IT
// Only critical findings interrupt, through the existing watchman outbox
// (Telegram admin group) AND, on a different channel, the admin bell + phone push —
// because when Telegram itself is the thing that broke, a Telegram-only alarm
// would never arrive. Each run also leaves a heartbeat in cron_runs, which the
// daily /api/health audit checks, so this check going quiet is itself reported.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron } from '@/lib/api-auth';
import { logCronRun } from '@/lib/cron-log';
import { STAGE_DEPARTMENT, APP_URL } from '@/lib/telegram-groups';
import { pushToRole } from '@/lib/push-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

type Finding = { severity: 'critical' | 'warning'; check: string; summary: string };

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Stages that are announced individually. Bulk-dispatch skips these two on purpose. */
const GAP_CHECK_STAGES = Object.keys(STAGE_DEPARTMENT).filter(s => s !== 'dispatched' && s !== 'delivered');

function istHourAndDay() {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  return { hour: ist.getUTCHours(), day: ist.getUTCDay() }; // 0 = Sunday
}

export async function GET(request: NextRequest) {
  const gate = await authorizeCron(request);
  if (!gate.ok) return gate.response;

  const started = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });

  const findings: Finding[] = [];
  const report: Record<string, any> = {};

  try {
    // 1. Bot token + webhook ---------------------------------------------------
    if (!BOT_TOKEN) {
      findings.push({ severity: 'critical', check: 'bot-token', summary: 'TELEGRAM_BOT_TOKEN is not set — no Telegram alert can be sent.' });
    } else {
      try {
        const me = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)).json();
        report.bot = me?.ok ? me.result?.username : 'REJECTED';
        if (!me?.ok) {
          findings.push({ severity: 'critical', check: 'bot-token', summary: `Telegram rejected the bot token (${me?.description || 'unknown reason'}) — no alert can be sent.` });
        } else {
          const wh = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)).json();
          const info = wh?.result || {};
          report.webhook = { pending: info.pending_update_count, lastError: info.last_error_message || null };
          const errAgeMin = info.last_error_date ? (Date.now() / 1000 - info.last_error_date) / 60 : Infinity;
          if (info.last_error_message && errAgeMin < 60) {
            findings.push({ severity: 'warning', check: 'webhook', summary: `Telegram could not deliver to our webhook ${Math.round(errAgeMin)} min ago: ${info.last_error_message}` });
          }
          if ((info.pending_update_count || 0) > 50) {
            findings.push({ severity: 'warning', check: 'webhook', summary: `${info.pending_update_count} incoming Telegram updates are waiting unprocessed.` });
          }
        }
      } catch (e: any) {
        findings.push({ severity: 'warning', check: 'bot-token', summary: `Could not reach api.telegram.org: ${e?.message || e}` });
      }
    }

    // 2. Routing ---------------------------------------------------------------
    const needed = Array.from(new Set(Object.values(STAGE_DEPARTMENT)));
    const { data: groups } = await db.from('telegram_groups').select('department').eq('is_active', true).eq('alerts_enabled', true);
    const have = new Set((groups || []).map((g: any) => g.department));
    const missingDepts = needed.filter(d => !have.has(d));
    if (missingDepts.length) {
      findings.push({ severity: 'critical', check: 'routing', summary: `No active Telegram group for: ${missingDepts.join(', ')} — their job alerts go nowhere.` });
    }

    // 3 + 6. Failed alerts: re-send what can still be useful -------------------
    const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: recent } = await db
      .from('telegram_stage_alerts')
      .select('job_id, stage, sent_at, groups_targeted, telegram_sent, last_error')
      .gte('sent_at', since24)
      .order('sent_at', { ascending: false })
      .limit(1000);

    const latestPerJob = new Map<string, any>();
    for (const r of recent || []) if (!latestPerJob.has(r.job_id)) latestPerJob.set(r.job_id, r);
    const failing = Array.from(latestPerJob.values()).filter(r => (r.telegram_sent || 0) < (r.groups_targeted || 0));

    let recovered = 0;
    let stillFailing: any[] = [];
    if (failing.length) {
      const { data: jobs } = await db.from('jobs').select('id, current_stage').in('id', failing.map(f => f.job_id));
      const stageNow = new Map((jobs || []).map((j: any) => [j.id, j.current_stage]));
      // Only a job still sitting at the failed stage is worth re-announcing.
      const worth = failing.filter(f => stageNow.get(f.job_id) === f.stage && Date.now() - new Date(f.sent_at).getTime() > 90_000);
      for (const f of worth.slice(0, 8)) {
        try {
          const res = await fetch(`${APP_URL}/api/telegram/notify-stage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: f.job_id }),
          });
          const out = await res.json().catch(() => ({}));
          if ((out?.sent || 0) > 0) recovered++;
          else stillFailing.push(f);
        } catch {
          stillFailing.push(f);
        }
        await sleep(3000); // stay well inside Telegram's per-group send rate
      }
      stillFailing = stillFailing.concat(worth.slice(8)); // not attempted this run
    }
    report.failedAlerts24h = failing.length;
    report.recovered = recovered;

    const stuckOverAnHour = stillFailing.filter(f => Date.now() - new Date(f.sent_at).getTime() > 3600_000);
    if (stuckOverAnHour.length) {
      const why = stuckOverAnHour[0]?.last_error || 'unknown';
      findings.push({ severity: 'critical', check: 'unrecovered', summary: `${stuckOverAnHour.length} job alert(s) have been failing for over an hour and re-sending did not help. Telegram says: ${why}` });
    }

    // Delivery rate, last 2 hours
    const since2h = Date.now() - 2 * 3600_000;
    const last2h = (recent || []).filter((r: any) => new Date(r.sent_at).getTime() >= since2h);
    const failed2h = last2h.filter((r: any) => (r.telegram_sent || 0) < (r.groups_targeted || 0));
    report.last2h = { total: last2h.length, failed: failed2h.length };
    if (last2h.length >= 8 && failed2h.length / last2h.length > 0.25) {
      findings.push({ severity: 'warning', check: 'delivery-rate', summary: `${failed2h.length} of ${last2h.length} alerts in the last 2 hours failed to reach Telegram (they are being re-sent).` });
    }

    // 4. Gaps: stage change with no alert record -------------------------------
    const { data: hist } = await db
      .from('job_stage_history')
      .select('job_id, to_stage, created_at')
      .gte('created_at', since24)
      .lte('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
      .in('to_stage', GAP_CHECK_STAGES)
      .limit(1000);
    if (hist && hist.length) {
      const jobIds = Array.from(new Set(hist.map((h: any) => h.job_id)));
      const { data: sentRows } = await db.from('telegram_stage_alerts').select('job_id, stage').in('job_id', jobIds).gte('sent_at', since24);
      const sentSet = new Set((sentRows || []).map((r: any) => `${r.job_id}|${r.stage}`));
      const gaps = hist.filter((h: any) => !sentSet.has(`${h.job_id}|${h.to_stage}`));
      report.gaps24h = { changes: hist.length, noAlert: gaps.length };
      if (gaps.length >= 3 && gaps.length / hist.length > 0.2) {
        findings.push({ severity: 'warning', check: 'gaps', summary: `${gaps.length} of ${hist.length} stage changes in the last 24 hours have no Telegram alert record at all (the database trigger may not be reaching the app).` });
      }
    }

    // 5. Silence during working hours ------------------------------------------
    const { hour, day } = istHourAndDay();
    if (day !== 0 && hour >= 11 && hour < 20) {
      const since3h = new Date(Date.now() - 3 * 3600_000).toISOString();
      const { count: moved } = await db.from('job_stage_history').select('id', { count: 'exact', head: true }).gte('created_at', since3h).in('to_stage', GAP_CHECK_STAGES);
      const { count: announced } = await db.from('telegram_stage_alerts').select('id', { count: 'exact', head: true }).gte('sent_at', since3h);
      report.silence = { moved3h: moved, announced3h: announced };
      if ((moved || 0) >= 3 && (announced || 0) === 0) {
        findings.push({ severity: 'critical', check: 'silence', summary: `${moved} jobs changed stage in the last 3 hours but not one Telegram alert was recorded — the alert chain looks dead.` });
      }
    }

    // Tell someone — critical only, on two independent channels ---------------
    const critical = findings.filter(f => f.severity === 'critical');
    if (critical.length) {
      const names = critical.map(f => f.check).sort().join('+');
      const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
      const body = 'The Telegram alert system needs attention:\n' + critical.map(f => `• ${f.summary}`).join('\n');
      const { error } = await db.from('watchman_notices').insert({
        kind: 'alert',
        dedupe_key: `telegram-health:${names}:${today}`,
        title: 'Telegram job alerts are not working properly',
        body,
        app_path: '/admin/settings/telegram-groups',
      });
      if (!error) {
        // First time today for this problem: also use the channel that does not depend on Telegram.
        await db.from('broadcast_notifications').insert({ message: '🔴 ' + body, target_audience: 'admin', priority: 'urgent', link: '/admin/settings/telegram-groups' });
        await pushToRole('admin', { title: '🔴 Telegram alerts need attention', body: critical[0].summary, url: '/admin/settings/telegram-groups' });
      } else if (error.code !== '23505') {
        console.error('[telegram-health] could not queue notice:', error.message);
      }
    }

    await logCronRun('telegram-health', {
      ok: critical.length === 0,
      durationMs: Date.now() - started,
      message: findings.map(f => `${f.severity}:${f.check}`).join(', ') || undefined,
    });
    return NextResponse.json({ status: critical.length ? 'critical' : findings.length ? 'warning' : 'healthy', findings, report });
  } catch (e: any) {
    await logCronRun('telegram-health', { ok: false, durationMs: Date.now() - started, message: e?.message || String(e) });
    return NextResponse.json({ status: 'error', message: e?.message || String(e) }, { status: 500 });
  }
}
