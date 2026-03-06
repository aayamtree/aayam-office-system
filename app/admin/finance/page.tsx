// Server Component — fetches all finance overview data server-side
// No 'use client' — this runs on the server, renders instantly with real data
import { fetchFinanceOverview } from '@/lib/finance-overview-data';
import FinanceClient from './FinanceClient';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function FinancePage() {
  const data = await fetchFinanceOverview();
  return <FinanceClient data={data} />;
}
