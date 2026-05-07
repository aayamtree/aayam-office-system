'use client';

/**
 * Dispatch Section Layout — Prefetch shared data
 * Dispatch pages use: jobs, dispatches, vendors
 */

import { useJobs, useVendors } from '@/lib/hooks';

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
    useJobs();
    useVendors();
    return <>{children}</>;
}
