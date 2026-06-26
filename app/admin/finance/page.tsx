// Server Component — fetches all finance overview data server-side
// No 'use client' — this runs on the server, renders instantly with real data
import { fetchFinanceOverview } from '@/lib/finance-overview-data';
import FinanceClient from './FinanceClient';

// Always render fresh: finance figures must reflect a just-logged expense/payment
// immediately, not a cached copy up to a minute old.
export const revalidate = 0;

export default async function FinancePage() {
  const data = await fetchFinanceOverview();
  return <FinanceClient data={data} />;
}
