'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

// ─────────────────────────────────────────────────────────────────────────────
// RBAC Route Map
// Define which roles are ALLOWED for each route prefix.
// Any role NOT listed will be redirected to /admin/dashboard.
// ─────────────────────────────────────────────────────────────────────────────
const ROUTE_PERMISSIONS: { prefix: string; allowed: string[] }[] = [
    // Finance — admin only
    { prefix: '/admin/finance', allowed: ['admin'] },
    // Settings Profile — all authenticated roles can view/edit their own profile
    { prefix: '/admin/settings/profile', allowed: ['admin', 'marketing', 'designer', 'dispatch', 'cmyk', 'finance', 'production', 'sales', 'manager'] },
    // Settings (other) — admin only
    { prefix: '/admin/settings', allowed: ['admin'] },
    // Marketing — admin + marketing only (SECURITY: non-marketing roles must not see leads/pipeline)
    { prefix: '/admin/marketing', allowed: ['admin', 'marketing'] },
    // Sales Orders & Quotations — admin + marketing
    { prefix: '/admin/sales', allowed: ['admin', 'marketing'] },
    // CRM — admin + marketing
    { prefix: '/admin/crm', allowed: ['admin', 'marketing'] },
    // Jobs / Dossier — admin + production roles
    { prefix: '/admin/jobs', allowed: ['admin', 'designer', 'production'] },
    // Dispatch — admin + dispatch roles
    { prefix: '/admin/dispatch', allowed: ['admin', 'dispatch', 'production'] },
    // Design Studio — admin + designers
    { prefix: '/admin/design-studio', allowed: ['admin', 'designer'] },
    // Print Planner — admin only (financial planning)
    { prefix: '/admin/print-planner', allowed: ['admin'] },
    // EOD Admin View — admin only
    { prefix: '/admin/eod-report/admin-view', allowed: ['admin'] },
];

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (loading || !profile) return; // Wait for auth to resolve

        const role = profile.role;

        // Check if current path matches any restricted route
        for (const { prefix, allowed } of ROUTE_PERMISSIONS) {
            if (pathname.startsWith(prefix)) {
                if (!allowed.includes(role)) {
                    // Redirect to dashboard with a clear message
                    console.warn(`[RouteGuard] Role "${role}" not allowed on "${pathname}". Redirecting.`);
                    router.replace('/admin/dashboard?access=denied');
                    return;
                }
                break; // First matching rule wins
            }
        }
    }, [pathname, profile, loading, router]);

    // While auth is still loading, show nothing (admin layout already handles spinner)
    if (loading) return null;

    // If profile is loaded and we're on a restricted route that we'll redirect away from,
    // show nothing to avoid flashing sensitive content
    if (profile) {
        const role = profile.role;
        for (const { prefix, allowed } of ROUTE_PERMISSIONS) {
            if (pathname.startsWith(prefix) && !allowed.includes(role)) {
                return (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                        <div className="text-6xl mb-4">🔒</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
                        <p className="text-gray-500 mb-6">
                            You don&apos;t have permission to view this page.
                        </p>
                        <button
                            onClick={() => router.push('/admin/dashboard')}
                            className="px-6 py-2.5 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                );
            }
        }
    }

    return <>{children}</>;
}
