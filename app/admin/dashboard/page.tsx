// Server Component — fetches all dashboard data on the server
// No 'use client' — this runs on the server, zero browser requests for data
import { fetchDashboardData } from '@/lib/dashboard-data';
import DashboardClient from './DashboardClient';

// Cache dashboard data for 30 seconds — repeat visits within 30s are instant
export const revalidate = 30;

export default async function DashboardPage() {
    const data = await fetchDashboardData();
    return <DashboardClient serverData={data} />;
}
