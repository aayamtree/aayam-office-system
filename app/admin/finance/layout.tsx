'use client';

/**
 * Finance Section Layout — Prefetch shared data
 * Finance pages use: jobs, clients, vendors, invoices, bank accounts, expenses
 */

import { useJobs, useClients, useVendors } from '@/lib/hooks';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    useJobs();
    useClients();
    useVendors();
    return <>{children}</>;
}
