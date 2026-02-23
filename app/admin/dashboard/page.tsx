// Server Component — fetches all dashboard data on the server
// No 'use client' — this runs on the server, zero browser requests for data
import { fetchDashboardData } from '@/lib/dashboard-data';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
    const data = await fetchDashboardData();
    return <DashboardClient serverData={data} />;
}
