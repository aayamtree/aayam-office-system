// Daily Pulse — always-current operational snapshot.
// Same metrics the 7:30 PM Telegram EOD sends, but live and browsable.
import { createServerSupabase } from '@/lib/supabase-server';
import { getEodSnapshot, getWeeklyScorecard, getFinancialSnapshot } from '@/lib/eod-metrics';
import PulseClient from './PulseClient';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// This page is the destination for the "…and N more" links in the 7:30 PM
// Telegram EOD report, so it must show the COMPLETE lists — nothing truncated
// away with no way to reach it. Section ids here must match the anchors used in
// app/api/cron/eod-report/route.ts (stuck, overdue, done-today, inv-*).
export default async function PulsePage() {
  const supabase = createServerSupabase();
  const [snapshot, weekly, financial] = await Promise.all([
    getEodSnapshot(supabase),
    getWeeklyScorecard(supabase),
    getFinancialSnapshot(supabase),
  ]);
  return <PulseClient snapshot={snapshot} weekly={weekly} financial={financial} />;
}
