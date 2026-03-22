import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

export async function GET(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  // ── Fetch everything in parallel ─────────────────────────────────────────
  const [
    designersRes,
    attendanceRes,
    tasksRes,
    recentDossierRes,
    timeSessionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('role', 'designer').eq('is_active', true).not('full_name', 'ilike', 'Designer _'),
    supabase.from('designer_attendance').select('*').eq('date', today),
    supabase.from('design_tasks').select('id, task_code, current_status, priority, deadline, assigned_to, rework_count, client_id, created_at, updated_at').neq('is_draft', true),
    supabase.from('dossier_entries').select('id, entry_type, task_id, actor_id, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('task_time_sessions').select('*').order('session_start', { ascending: false }),
  ]);

  const designers = designersRes.data || [];
  const attendance = attendanceRes.data || [];
  const tasks = tasksRes.data || [];
  const recentDossier = recentDossierRes.data || [];
  const timeSessions = timeSessionsRes.data || [];

  // ── Fetch client names for tasks ─────────────────────────────────────────
  const clientIds = Array.from(new Set(tasks.map((t: any) => t.client_id).filter(Boolean)));
  let clientMap: Record<string, string> = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabase.from('clients').select('id, name, company').in('id', clientIds);
    (clients || []).forEach((c: any) => { clientMap[c.id] = c.company || c.name; });
  }

  const designerMap: Record<string, string> = {};
  designers.forEach((d: any) => { designerMap[d.id] = d.full_name; });

  const attendanceMap: Record<string, any> = {};
  attendance.forEach((a: any) => { attendanceMap[a.designer_id] = a; });

  // ── Panel 1: Designer Status Board ───────────────────────────────────────
  const activeTaskByDesigner: Record<string, any> = {};
  tasks.filter((t: any) => ['live', 'hold', 'review', 'rework'].includes(t.current_status))
    .forEach((t: any) => { activeTaskByDesigner[t.assigned_to] = t; });

  const designerBoard = designers.map((d: any) => {
    const att = attendanceMap[d.id];
    const activeTask = activeTaskByDesigner[d.id];
    let status = 'absent';
    if (att) {
      const lastHB = att.last_heartbeat_time ? new Date(att.last_heartbeat_time) : null;
      const minutesSinceHB = lastHB ? (now.getTime() - lastHB.getTime()) / 60000 : Infinity;
      if (activeTask?.current_status === 'live') status = 'active';
      else if (minutesSinceHB < 30) status = 'idle';
      else if (att.last_logout_time) status = 'offline';
      else status = 'idle';
    }
    return {
      id: d.id, full_name: d.full_name, email: d.email,
      status,
      login_time: att?.first_login_time || null,
      logout_time: att?.last_logout_time || null,
      current_task: activeTask ? { id: activeTask.id, code: activeTask.task_code, status: activeTask.current_status } : null,
      hours_worked: att ? Math.round((att.total_minutes_worked || 0) / 6) / 10 : 0,
    };
  });

  const statusCounts = { active: 0, idle: 0, offline: 0, absent: 0 };
  designerBoard.forEach((d: any) => { if (d.status in statusCounts) (statusCounts as any)[d.status]++; });

  // ── Panel 2: Task Pipeline Kanban ────────────────────────────────────────
  const pipeline: Record<string, any[]> = { live: [], hold: [], review: [], rework: [], end: [] };
  tasks.forEach((t: any) => {
    if (t.current_status in pipeline) {
      const startTime = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
      const hoursInStatus = Math.round((now.getTime() - startTime.getTime()) / 3600000);
      pipeline[t.current_status].push({
        id: t.id, code: t.task_code, client: clientMap[t.client_id] || 'Unknown',
        designer: designerMap[t.assigned_to] || 'Unassigned',
        hours_in_status: hoursInStatus, rework_count: t.rework_count, priority: t.priority,
      });
    }
  });

  // ── Panel 3: Alerts ──────────────────────────────────────────────────────
  const alerts: any[] = [];
  tasks.forEach((t: any) => {
    const startTime = new Date(t.updated_at || t.created_at);
    const hours = (now.getTime() - startTime.getTime()) / 3600000;
    if (t.current_status === 'review' && hours > 24)
      alerts.push({ type: 'long_review', task_id: t.id, code: t.task_code, label: `Long Review: ${t.task_code}`, hours: Math.round(hours) });
    if (t.rework_count >= 2)
      alerts.push({ type: 'high_rework', task_id: t.id, code: t.task_code, label: `High Rework: ${t.task_code}`, rework_count: t.rework_count });
    if (t.current_status === 'hold' && hours > 2)
      alerts.push({ type: 'stale_hold', task_id: t.id, code: t.task_code, label: `Stale Hold: ${t.task_code}`, hours: Math.round(hours) });
    if (t.deadline && new Date(t.deadline) < now && t.current_status !== 'end')
      alerts.push({ type: 'overdue', task_id: t.id, code: t.task_code, label: `Overdue: ${t.task_code}`, deadline: t.deadline });
  });
  designerBoard.forEach((d: any) => {
    if (d.status === 'idle') {
      const att = attendanceMap[d.id];
      if (att?.last_heartbeat_time) {
        const idleMin = (now.getTime() - new Date(att.last_heartbeat_time).getTime()) / 60000;
        if (idleMin > 30) alerts.push({ type: 'idle_designer', designer_id: d.id, label: `Idle: ${d.full_name}`, minutes: Math.round(idleMin) });
      }
    }
    if (d.status === 'absent' && activeTaskByDesigner[d.id])
      alerts.push({ type: 'absent_with_tasks', designer_id: d.id, label: `Absent with tasks: ${d.full_name}` });
  });

  // ── Panel 4: Work Time Summary ───────────────────────────────────────────
  const sessionsByTask: Record<string, number> = {};
  const sessionsByDesigner: Record<string, number> = {};
  timeSessions.forEach((s: any) => {
    const mins = s.duration_minutes || 0;
    sessionsByTask[s.task_id] = (sessionsByTask[s.task_id] || 0) + mins;
    sessionsByDesigner[s.designer_id] = (sessionsByDesigner[s.designer_id] || 0) + mins;
  });

  const topTasks = tasks
    .filter((t: any) => sessionsByTask[t.id])
    .sort((a: any, b: any) => (sessionsByTask[b.id] || 0) - (sessionsByTask[a.id] || 0))
    .slice(0, 10)
    .map((t: any) => ({
      id: t.id, code: t.task_code, client: clientMap[t.client_id] || '—',
      designer: designerMap[t.assigned_to] || '—',
      total_hours: Math.round((sessionsByTask[t.id] || 0) / 6) / 10,
      rework_count: t.rework_count,
    }));

  const designerProductivity = designers.map((d: any) => {
    const completedTasks = tasks.filter((t: any) => t.assigned_to === d.id && t.current_status === 'end');
    const totalMins = sessionsByDesigner[d.id] || 0;
    const totalHours = Math.round(totalMins / 6) / 10;
    const avgPerTask = completedTasks.length > 0 ? Math.round(totalMins / completedTasks.length / 6) / 10 : 0;
    const reworkRate = tasks.filter((t: any) => t.assigned_to === d.id && t.rework_count > 0).length;
    return { id: d.id, full_name: d.full_name, tasks_done: completedTasks.length, total_hours: totalHours, avg_per_task: avgPerTask, rework_count: reworkRate };
  }).filter((d: any) => d.tasks_done > 0 || (sessionsByDesigner as any)[d.id]);

  // ── Panel 5: Attendance Log ──────────────────────────────────────────────
  const attendanceLog = designerBoard.map((d: any) => ({
    id: d.id, full_name: d.full_name,
    login_time: d.login_time, logout_time: d.logout_time,
    hours_worked: d.hours_worked, status: d.status,
  }));

  // ── Panel 6: Recent Dossier Activity ─────────────────────────────────────
  const actorIds = Array.from(new Set(recentDossier.map((e: any) => e.actor_id).filter(Boolean)));
  let actorMap: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: actors } = await supabase.from('profiles').select('id, full_name').in('id', actorIds);
    (actors || []).forEach((a: any) => { actorMap[a.id] = a.full_name; });
  }
  const taskCodeMap: Record<string, string> = {};
  tasks.forEach((t: any) => { taskCodeMap[t.id] = t.task_code; });

  const recentActivity = recentDossier.map((e: any) => ({
    id: e.id, entry_type: e.entry_type, created_at: e.created_at,
    task_id: e.task_id, task_code: taskCodeMap[e.task_id] || '—',
    actor: actorMap[e.actor_id] || 'Unknown',
  }));

  return NextResponse.json({
    data: {
      summary: { ...statusCounts, total_tasks: tasks.length, active_tasks: tasks.filter((t: any) => t.current_status !== 'end').length },
      designer_board: designerBoard,
      pipeline,
      alerts,
      top_tasks: topTasks,
      designer_productivity: designerProductivity,
      attendance_log: attendanceLog,
      recent_activity: recentActivity,
      generated_at: now.toISOString(),
    }
  });
}
