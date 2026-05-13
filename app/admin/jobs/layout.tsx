'use client';

/**
 * Jobs Section Layout — Prefetch shared data
 * Jobs pages use: jobs, clients, vendors, designers, payments, product categories
 */

import { useJobs, useClients, useVendors, useDesigners, useProductCategories } from '@/lib/hooks';

export default function JobsLayout({ children }: { children: React.ReactNode }) {
    useJobs();
    useClients();
    useVendors();
    useDesigners();
    useProductCategories();
    return <>{children}</>;
}
