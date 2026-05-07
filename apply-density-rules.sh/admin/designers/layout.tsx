'use client';

/**
 * Designers Section Layout — Prefetch shared data
 * Designer pages use: jobs, clients, designers
 */

import { useJobs, useClients, useDesigners } from '@/lib/hooks';

export default function DesignersLayout({ children }: { children: React.ReactNode }) {
    useJobs();
    useClients();
    useDesigners();
    return <>{children}</>;
}
