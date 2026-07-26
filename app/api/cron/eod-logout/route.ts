import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * EOD Auto-Logout Cron
 * Schedule this to run at 19:30 IST (14:00 UTC) every day.
 * It auto-closes any designer attendance records still marked as 'active'
 * at end-of-day (covers PC shutdowns where sendBeacon didn't fire).
 *
 * Vercel cron config (vercel.json):
 * { "path": "/api/cron/eod-logout", "schedule": "0 14 * * 1-6" }
 * (Runs at 14:00 UTC = 19:30 IST, Mon–Sat)
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Protect with a secret header so only Vercel cron can call this
  const authHeader = request.headers.get('authorization');
  // Fail closed: if CRON_SECRET is unset, reject rather than run unauthenticated.
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role key so we can write attendance for all users
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // IST date — India office hours
  const nowUtc = new Date();
  const nowIST = new Date(nowUtc.getTime() + (5.5 * 60 * 60 * 1000));
  const todayIST = nowIST.toISOString().split('T')[0];

  // Office closes at 19:30 IST — use that as the logout time
  const eodIST = new Date(`${todayIST}T19:30:00+05:30`);
  const eodIso = eodIST.toISOString();

  // Find all records still 'active' for today
  const { data: activeRecords, error: fetchError } = await supabase
    .from('designer_attendance')
    .select('id, designer_id, first_login_time, total_minutes_worked')
    .eq('date', todayIST)
    .eq('status', 'active');

  if (fetchError) {
    console.error('[EOD Cron] Error fetching active records:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!activeRecords || activeRecords.length === 0) {
    return NextResponse.json({ ok: true, closed: 0, message: 'No active records to close' });
  }

  // Update each record with EOD logout time and calculated minutes
  let closed = 0;
  for (const record of activeRecords) {
    let totalMinutes = record.total_minutes_worked || 0;
    if (record.first_login_time) {
      const loginTime = new Date(record.first_login_time).getTime();
      const eodMs = eodIST.getTime();
      totalMinutes = Math.max(totalMinutes, Math.round((eodMs - loginTime) / 60000));
    }

    const { error: updateError } = await supabase
      .from('designer_attendance')
      .update({
        last_logout_time: eodIso,
        status: 'logged_out',
        total_minutes_worked: totalMinutes,
      })
      .eq('id', record.id);

    if (!updateError) closed++;
  }

  console.info(`[EOD Cron] Auto-closed ${closed}/${activeRecords.length} attendance records for ${todayIST}`);

  return NextResponse.json({
    ok: true,
    date: todayIST,
    closed,
    total: activeRecords.length,
    eod_time: eodIso,
  });
}
