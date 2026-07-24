// Daily Pulse — always-current operational snapshot.
// Same metrics the 7:30 PM Telegram EOD sends, but live and browsable.
import { createServerSupabase } from '@/lib/supabase-server';
import { getEodSnapshot, getWeeklyScorecard } from '@/lib/eod-metrics';
import PulseClient from './PulseClient';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function PulsePage() {
  const supabase = createServerSupabase();
  const [snapshot, weekly] = await Promise.all([
    getEodSnapshot(supabase),
    getWeeklyScorecard(supabase),
  ]);
  return <PulseClient snapshot={snapshot} weekly={weekly} />;
}
