'use client';

/**
 * Designers Section Layout — Prefetch shared data
 * Designer pages use: jobs, clients, designers
 */

import { useJobs, useClients, useDesigners } from '@/lib/hooks';

export default function DesignersLayout({ children }: { children: React.ReactNode }) {
    // PERF: Only prefetch small, stable datasets. useJobs() removed — it fetched ALL jobs
    // with no filter/limit, causing re-render storms every 30s (sidebar freeze bug).
    // Each designer page fetches its own filtered job query via useJobs(options).
    useClients();
    useDesigners();
    return <>{children}</>;
}
