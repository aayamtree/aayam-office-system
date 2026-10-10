// GET /api/admin/telegram-health — numbers for the Telegram card on System Health.
// Admin only. Reads with the service key because cron_runs and
// telegram_stage_alerts are not readable from a browser session.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/api-auth';
import { STAGE_DEPARTMENT } from '@/lib/telegram-groups';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });

  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [runsRes, alertsRes, groupsRes] = await Promise.all([
    db.from('cron_runs').select('ran_at, ok, message, duration_ms').eq('job', 'telegram-health').order('ran_at', { ascending: false }).limit(1),
    db.from('telegram_stage_alerts').select('job_id, stage, sent_at, groups_targeted, telegram_sent, last_error').gte('sent_at', since7d).order('sent_at', { ascending: false }).limit(2000),
    db.from('telegram_groups').select('department, is_active, alerts_enabled'),
  ]);

  const alerts = alertsRes.data || [];
  const isFailed = (a: any) => (a.telegram_sent || 0) < (a.groups_targeted || 0);

  // Per-day totals (India time), newest first.
  const perDay = new Map<string, { total: number; failed: number }>();
  for (const a of alerts) {
    const d = new Date(new Date(a.sent_at).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const row = perDay.get(d) || { total: 0, failed: 0 };
    row.total++;
    if (isFailed(a)) row.failed++;
    perDay.set(d, row);
  }

  // Failures that are still unresolved: the job's LATEST alert row is a failed one.
  const latestPerJob = new Map<string, any>();
  for (const a of alerts) if (!latestPerJob.has(a.job_id)) latestPerJob.set(a.job_id, a);
  const unresolved = Array.from(latestPerJob.values()).filter(isFailed);
  let unresolvedList: any[] = [];
  if (unresolved.length) {
    const { data: jobs } = await db.from('jobs').select('id, job_number, current_stage').in('id', unresolved.slice(0, 20).map(u => u.job_id));
    const byId = new Map((jobs || []).map((j: any) => [j.id, j]));
    unresolvedList = unresolved.slice(0, 20).map(u => ({
      job_number: byId.get(u.job_id)?.job_number || '—',
      stage: u.stage,
      sent_at: u.sent_at,
      error: u.last_error,
      stillAtThatStage: byId.get(u.job_id)?.current_stage === u.stage,
    }));
  }

  const needed = Array.from(new Set(Object.values(STAGE_DEPARTMENT)));
  const have = new Set((groupsRes.data || []).filter((g: any) => g.is_active && g.alerts_enabled).map((g: any) => g.department));

  const lastRun = runsRes.data?.[0] || null;
  return NextResponse.json({
    lastRun,
    lastRunAgeMin: lastRun ? Math.round((Date.now() - new Date(lastRun.ran_at).getTime()) / 60000) : null,
    last24h: {
      total: alerts.filter(a => Date.now() - new Date(a.sent_at).getTime() < 86400_000).length,
      failed: alerts.filter(a => Date.now() - new Date(a.sent_at).getTime() < 86400_000 && isFailed(a)).length,
    },
    perDay: Array.from(perDay.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7).map(([day, v]) => ({ day, ...v })),
    unresolved: unresolvedList,
    unresolvedCount: unresolved.length,
    departments: needed.map(d => ({ department: d, ok: have.has(d) })),
  });
}
