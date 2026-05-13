'use client';

/**
 * Sales Section Layout
 * 
 * Prefetch shared sales data (quotations, clients, jobs, categories)
 * when user enters the sales section. Child pages get instant cached data.
 */

import { useQuotations, useClients, useJobs, useProductCategories } from '@/lib/hooks';

export default function SalesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    useQuotations();
    useClients();
    useJobs();
    useProductCategories();

    return <>{children}</>;
}
