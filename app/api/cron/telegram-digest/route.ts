import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStageName } from '@/lib/job-workflow';
import { sendToChat, escapeHtml, TelegramDepartment } from '@/lib/telegram-groups';

/**
 * Telegram Digest Cron — runs twice daily, Mon–Sat:
 *   Morning  09:00 IST ("30 3 * * 1-6")  → full brief
 *   Evening  17:30 IST ("0 12 * * 1-6")  → "still pending today" recap
 *
 * Hybrid personal briefs (2026-07-18):
 *  - Department GROUPS get per-person sections (@mention per staff).
 *  - Staff who linked Telegram (profiles.telegram_chat_id) ALSO get a
 *    private DM with only THEIR pendings.
 *  - Slot (morning/evening) auto-detected from IST time; override with
 *    ?slot=morning|evening for testing.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

const DEPT_STAGES: Record<string, string[]> = {
  design: ['new', 'designing', 'approval', 'pre_print_qc', 'print_file_ready'],
  print: ['file_received', 'file_check', 'ready_to_print', 'printing', 'material_received', 'quality_check'],
  dispatch: ['ready', 'dispatched'],
};

type Slot = 'morning' | 'evening';

interface DigestJob {
  id: string;
  job_number: string | null;
  project_name: string | null;
  current_stage: string;
  total_amount: number | null;
  amount_received: number | null;
  designer_id: string | null;
}

interface Staff {
  id: string;
  full_name: string | null;
  role: string | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
}

interface DigestLead {
  id: string;
  name: string | null;
  company: string | null;
  next_follow_up: string | null;
  assigned_to: string | null;
}

function istNow(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
  });
}

/**
 * @mention for a staff member inside a group message.
 * Linked staff → real Telegram mention (notifies them).
 * Username known → @username. Otherwise bold name.
 */
function mention(p: Staff): string {
  const name = p.full_name || 'Staff';
  if (p.telegram_chat_id) {
    return `<a href="tg://user?id=${p.telegram_chat_id}">${escapeHtml(name)}</a>`;
  }
  if (p.telegram_username) return `@${escapeHtml(p.telegram_username)}`;
  return `<b>${escapeHtml(name)}</b>`;
}

function jobLine(j: DigestJob): string {
  return `  • <b>${escapeHtml(j.job_number || '?')}</b> ${escapeHtml(j.project_name || '')} — <i>${escapeHtml(getStageName(j.current_stage))}</i>`;
}

function leadLine(l: DigestLead): string {
  const who = l.company || l.name || '?';
  const due = l.next_follow_up
    ? new Date(l.next_follow_up).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    : '';
  return `  • <b>${escapeHtml(who)}</b>${due ? ` — follow-up ${escapeHtml(due)}` : ''}`;
}

function header(slot: Slot, forWhom: string): string {
  return slot === 'morning'
    ? `☀️ <b>Good morning ${forWhom}!</b> — ${todayLabel()}`
    : `🌆 <b>Evening recap ${forWhom}</b> — still pending today:`;
}

/* ------------------------------------------------------------------ */
/* Group digests                                                       */
/* ------------------------------------------------------------------ */

function buildDesignGroupDigest(slot: Slot, jobs: DigestJob[], staff: Staff[]): string | null {
  const mine = jobs.filter((j) => DEPT_STAGES.design.includes(j.current_stage));
  if (!mine.length) {
    return slot === 'morning'
      ? `${header(slot, 'Design')}\n\nQueue is empty. Enjoy the calm! 🎉`
      : null; // no evening message when nothing is pending
  }

  const byDesigner = new Map<string, DigestJob[]>();
  for (const j of mine) {
    const key = j.designer_id || 'unassigned';
    if (!byDesigner.has(key)) byDesigner.set(key, []);
    byDesigner.get(key)!.push(j);
  }

  const sections: string[] = [];
  for (const [designerId, list] of Array.from(byDesigner.entries())) {
    const person = staff.find((s) => s.id === designerId);
    const title = designerId === 'unassigned'
      ? '⚠️ <b>Unassigned</b>'
      : `👤 ${person ? mention(person) : '<b>Unknown</b>'}`;
    const listed = list.slice(0, 8).map(jobLine).join('\n');
    const more = list.length > 8 ? `\n  …and ${list.length - 8} more` : '';
    sections.push(`${title} — ${list.length} job${list.length !== 1 ? 's' : ''}\n${listed}${more}`);
  }

  return `${header(slot, 'Design')}\n\n${sections.join('\n\n')}`;
}

function buildQueueGroupDigest(slot: Slot, department: 'print' | 'dispatch', jobs: DigestJob[]): string | null {
  const label = department === 'print' ? 'Print' : 'Dispatch';
  const mine = jobs.filter((j) => DEPT_STAGES[department].includes(j.current_stage));
  if (!mine.length) {
    return slot === 'morning'
      ? `${header(slot, label)}\n\nQueue is empty. Enjoy the calm! 🎉`
      : null;
  }
  const listed = mine.slice(0, 10).map(jobLine).join('\n');
  const more = mine.length > 10 ? `\n  …and ${mine.length - 10} more` : '';
  return `${header(slot, label)}\n<b>${mine.length}</b> job${mine.length !== 1 ? 's' : ''} in the queue:\n\n${listed}${more}`;
}

function buildAdminGroupDigest(slot: Slot, jobs: DigestJob[], leadsDue: DigestLead[]): string {
  const counts: Record<string, number> = {};
  for (const dept of ['design', 'print', 'dispatch'] as const) {
    counts[dept] = jobs.filter((j) => DEPT_STAGES[dept].includes(j.current_stage)).length;
  }
  const pending = jobs.reduce(
    (sum, j) => sum + Math.max(0, (j.total_amount || 0) - (j.amount_received || 0)),
    0
  );
  const title = slot === 'morning'
    ? `👑 <b>Aayam Morning Digest</b> — ${todayLabel()}`
    : `👑 <b>Aayam Evening Recap</b> — ${todayLabel()}`;
  return (
    `${title}\n\n` +
    `🎨 Design queue: <b>${counts.design}</b>\n` +
    `🖨️ Print queue: <b>${counts.print}</b>\n` +
    `📦 Dispatch queue: <b>${counts.dispatch}</b>\n` +
    `📞 Lead follow-ups due: <b>${leadsDue.length}</b>\n` +
    `💰 Pending on active jobs: <b>₹${pending.toLocaleString('en-IN')}</b>`
  );
}

/* ------------------------------------------------------------------ */
/* Personal DM briefs (linked staff only)                              */
/* ------------------------------------------------------------------ */

function buildPersonalBrief(
  slot: Slot,
  p: Staff,
  jobs: DigestJob[],
  leadsDue: DigestLead[]
): { text: string; appPath: string } | null {
  const name = (p.full_name || '').split(' ')[0] || 'there';
  const head = slot === 'morning'
    ? `☀️ <b>Good morning ${escapeHtml(name)}!</b> Your brief — ${todayLabel()}`
    : `🌆 <b>Evening recap, ${escapeHtml(name)}</b> — still pending:`;

  if (p.role === 'designer') {
    const mine = jobs.filter((j) => j.designer_id === p.id && DEPT_STAGES.design.includes(j.current_stage));
    if (!mine.length) {
      return slot === 'morning'
        ? { text: `${head}\n\nNo jobs assigned to you. Enjoy the calm! 🎉`, appPath: '/admin/jobs/queue' }
        : null;
    }
    const listed = mine.slice(0, 10).map(jobLine).join('\n');
    const more = mine.length > 10 ? `\n  …and ${mine.length - 10} more` : '';
    return {
      text: `${head}\n<b>${mine.length}</b> job${mine.length !== 1 ? 's' : ''} assigned to you:\n\n${listed}${more}`,
      appPath: '/admin/jobs/queue',
    };
  }

  if (p.role === 'marketing') {
    const mine = leadsDue.filter((l) => l.assigned_to === p.id);
    if (!mine.length) {
      return slot === 'morning'
        ? { text: `${head}\n\nNo follow-ups due today. 🎉`, appPath: '/admin/leads' }
        : null;
    }
    const listed = mine.slice(0, 10).map(leadLine).join('\n');
    const more = mine.length > 10 ? `\n  …and ${mine.length - 10} more` : '';
    return {
      text: `${head}\n<b>${mine.length}</b> follow-up${mine.length !== 1 ? 's' : ''} due:\n\n${listed}${more}`,
      appPath: '/admin/leads',
    };
  }

  if (p.role === 'dispatch') {
    const mine = jobs.filter((j) => DEPT_STAGES.dispatch.includes(j.current_stage));
    if (!mine.length) {
      return slot === 'morning'
        ? { text: `${head}\n\nDispatch queue is empty. 🎉`, appPath: '/admin/jobs/queue' }
        : null;
    }
    const listed = mine.slice(0, 10).map(jobLine).join('\n');
    const more = mine.length > 10 ? `\n  …and ${mine.length - 10} more` : '';
    return {
      text: `${head}\n<b>${mine.length}</b> job${mine.length !== 1 ? 's' : ''} to dispatch:\n\n${listed}${more}`,
      appPath: '/admin/jobs/queue',
    };
  }

  if (p.role === 'admin') {
    return {
      text: buildAdminGroupDigest(slot, jobs, leadsDue),
      appPath: '/admin/dashboard',
    };
  }

  return null; // cmyk & others — no personal brief yet
}

/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Slot: morning before 13:00 IST, evening after — overridable for testing.
  const slotParam = request.nextUrl.searchParams.get('slot');
  const slot: Slot =
    slotParam === 'morning' || slotParam === 'evening'
      ? slotParam
      : istNow().getUTCHours() >= 13 ? 'evening' : 'morning';

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const [{ data: groups }, { data: jobs }, { data: staff }, { data: leads }] = await Promise.all([
    service
      .from('telegram_groups')
      .select('chat_id, department')
      .eq('is_active', true)
      .eq('digest_enabled', true)
      .not('department', 'is', null),
    service
      .from('jobs')
      .select('id, job_number, project_name, current_stage, total_amount, amount_received, designer_id')
      .eq('is_active', true)
      .not('current_stage', 'in', '(delivered,cancelled,file_sent_client)'),
    service
      .from('profiles')
      .select('id, full_name, role, telegram_chat_id, telegram_username')
      .eq('is_active', true),
    service
      .from('leads')
      .select('id, name, company, next_follow_up, assigned_to')
      .neq('status', 'converted')
      .not('next_follow_up', 'is', null)
      .lte('next_follow_up', new Date().toISOString()),
  ]);

  const allJobs = (jobs || []) as DigestJob[];
  const allStaff = (staff || []) as Staff[];
  const leadsDue = (leads || []) as DigestLead[];

  // 1) Department group digests (per-person sections for design)
  let groupsSent = 0;
  for (const g of groups || []) {
    const dept = g.department as TelegramDepartment;
    let text: string | null = null;
    if (dept === 'design') text = buildDesignGroupDigest(slot, allJobs, allStaff);
    else if (dept === 'print' || dept === 'dispatch') text = buildQueueGroupDigest(slot, dept, allJobs);
    else if (dept === 'admin') text = buildAdminGroupDigest(slot, allJobs, leadsDue);
    if (!text) continue;
    const appPath = dept === 'admin' ? '/admin/dashboard' : '/admin/jobs/queue';
    if (await sendToChat(g.chat_id, text, appPath)) groupsSent++;
  }

  // 2) Personal DM briefs for linked staff
  let dmsSent = 0;
  for (const p of allStaff) {
    if (!p.telegram_chat_id) continue;
    const brief = buildPersonalBrief(slot, p, allJobs, leadsDue);
    if (!brief) continue;
    if (await sendToChat(p.telegram_chat_id, brief.text, brief.appPath)) dmsSent++;
  }

  return NextResponse.json({
    slot,
    groupsSent,
    dmsSent,
    linkedStaff: allStaff.filter((p) => p.telegram_chat_id).length,
  });
}
