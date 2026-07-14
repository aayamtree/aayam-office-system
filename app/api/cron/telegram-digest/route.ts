import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStageName } from '@/lib/job-workflow';
import { sendToChat, escapeHtml, TelegramDepartment } from '@/lib/telegram-groups';

/**
 * Daily Telegram Digest Cron — 9:00 AM IST, Mon–Sat.
 * Each department group gets a short morning summary of ITS OWN queue.
 *
 * Vercel cron config (vercel.json):
 * { "path": "/api/cron/telegram-digest", "schedule": "30 3 * * 1-6" }
 * (03:30 UTC = 09:00 IST)
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

const DEPT_STAGES: Record<string, string[]> = {
  design: ['new', 'designing', 'approval', 'pre_print_qc', 'print_file_ready'],
  print: ['file_received', 'file_check', 'ready_to_print', 'printing', 'material_received', 'quality_check'],
  dispatch: ['ready', 'dispatched'],
};

interface DigestJob {
  id: string;
  job_number: string | null;
  project_name: string | null;
  current_stage: string;
  total_amount: number | null;
  amount_received: number | null;
}

function jobLine(j: DigestJob): string {
  return `• <b>${escapeHtml(j.job_number || '?')}</b> ${escapeHtml(j.project_name || '')} — <i>${escapeHtml(getStageName(j.current_stage))}</i>`;
}

function buildDigest(department: TelegramDepartment, jobs: DigestJob[]): string | null {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
  });

  if (department === 'admin') {
    const counts: Record<string, number> = {};
    for (const dept of ['design', 'print', 'dispatch'] as const) {
      counts[dept] = jobs.filter((j) => DEPT_STAGES[dept].includes(j.current_stage)).length;
    }
    const pending = jobs.reduce(
      (sum, j) => sum + Math.max(0, (j.total_amount || 0) - (j.amount_received || 0)),
      0
    );
    return (
      `👑 <b>Aayam Morning Digest</b> — ${today}\n\n` +
      `🎨 Design queue: <b>${counts.design}</b>\n` +
      `🖨️ Print queue: <b>${counts.print}</b>\n` +
      `📦 Dispatch queue: <b>${counts.dispatch}</b>\n` +
      `💰 Pending on active jobs: <b>₹${pending.toLocaleString('en-IN')}</b>`
    );
  }

  const stages = DEPT_STAGES[department];
  if (!stages) return null; // e.g. cmyk — no jobs-pipeline digest
  const mine = jobs.filter((j) => stages.includes(j.current_stage));
  if (!mine.length) {
    return `☀️ <b>Good morning!</b> — ${today}\n\nYour queue is empty. Enjoy the calm! 🎉`;
  }
  const listed = mine.slice(0, 10).map(jobLine).join('\n');
  const more = mine.length > 10 ? `\n…and ${mine.length - 10} more` : '';
  return (
    `☀️ <b>Good morning!</b> — ${today}\n` +
    `You have <b>${mine.length}</b> job${mine.length !== 1 ? 's' : ''} in your queue:\n\n` +
    `${listed}${more}`
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: groups } = await service
    .from('telegram_groups')
    .select('chat_id, department')
    .eq('is_active', true)
    .eq('digest_enabled', true)
    .not('department', 'is', null);
  if (!groups?.length) return NextResponse.json({ sent: 0, reason: 'no groups' });

  const { data: jobs } = await service
    .from('jobs')
    .select('id, job_number, project_name, current_stage, total_amount, amount_received')
    .eq('is_active', true)
    .not('current_stage', 'in', '(delivered,cancelled,file_sent_client)');

  let sent = 0;
  for (const g of groups) {
    const text = buildDigest(g.department as TelegramDepartment, (jobs || []) as DigestJob[]);
    if (!text) continue;
    const appPath = g.department === 'admin' ? '/admin/dashboard' : '/admin/jobs/queue';
    if (await sendToChat(g.chat_id, text, appPath)) sent++;
  }

  return NextResponse.json({ sent, groups: groups.length });
}
