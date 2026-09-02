// REPORTS — the numbers, from Zoho only.
//
// The screen that used to live at this address read the app's own ledger, which
// stopped moving on 5 August 2026. It is kept at /admin/finance/reports/payments-old
// so July stays readable, and this door replaced it.

import { fetchFinanceOverview } from '@/lib/finance-overview-data';
import ReportsClient from './ReportsClient';

export const revalidate = 0;

export default async function FinanceReportsPage() {
    const data = await fetchFinanceOverview();
    return <ReportsClient data={data} />;
}
