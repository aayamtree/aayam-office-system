'use client';

/**
 * Marketing Section Layout
 * 
 * PURPOSE: Prefetch all shared marketing data ONCE when the user enters
 * the marketing section. SWR caches these globally, so child pages
 * (dashboard, leads, follow-ups, quotations) get instant data from cache
 * instead of each page firing its own queries.
 * 
 * This is the #1 performance win for marketing — all 5-6 queries fire
 * ONCE on section entry, then every child page is instant.
 */

import { useLeads, useFollowUps, useQuotations, useClients, useProductCategories } from '@/lib/hooks';

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Prefetch all marketing data at layout level.
    // SWR dedup ensures these don't fire again in child pages within 30s.
    useLeads();
    useFollowUps();
    useQuotations();
    useClients();
    useProductCategories();

    return <>{children}</>;
}
