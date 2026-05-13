/**
 * INTEGRATION GUIDE FOR SESSION SECURITY & LIVE UPDATES
 * 
 * This file shows how to integrate the created hooks into your app.
 * Copy and adapt the code below as needed.
 */

// ==========================================
// 1. ADD IDLE TIMEOUT TO AUTH CONTEXT
// ==========================================

// In lib/auth-context.tsx, add this inside AuthProvider:

import { useState } from 'react';
import { useIdleTimeout } from './useIdleTimeout';
import { IdleWarningModal } from '@/components/IdleWarningModal';

// Add state for warning modal
const [showIdleWarning, setShowIdleWarning] = useState(false);

// Add idle timeout hook
useIdleTimeout({
    timeout: 3600000, // 1 hour
    warningTime: 3300000, // 55 minutes
    onWarning: () => setShowIdleWarning(true),
    onIdle: () => {
        setShowIdleWarning(false);
        signOut(); // Auto-logout
    },
});

// Add modal to JSX (before closing </AuthContext.Provider>):
<>
    {children}
    <IdleWarningModal
        show={showIdleWarning}
        onStayLoggedIn={() => setShowIdleWarning(false)}
        onLogout={() => signOut()}
    />
</>


// ==========================================
// 2. ADD REFRESH-ON-FOCUS TO DASHBOARD
// ==========================================

// In app/admin/dashboard/page.tsx, add:

import { usePageVisibility } from '@/lib/usePageVisibility';
import { useDashboardStats } from '@/lib/hooks';

const { stats, loading, mutate } = useDashboardStats();

// Auto-refresh when user returns to tab
usePageVisibility({
    onVisible: () => {
        console.log('Tab became visible - refreshing data...');
        mutate(); // SWR revalidate function
    },
});


// ==========================================
// 3. ADD REALTIME UPDATES TO DASHBOARD
// ==========================================

// In app/admin/dashboard/page.tsx, add:

import { useRealtime } from '@/lib/useRealtime';
import { Job } from '@/types/database';

// Listen for new jobs
useRealtime < Job > ({
    table: 'jobs',
    event: 'INSERT',
    onInsert: (newJob) => {
        console.log('New job added:', newJob);
        mutate(); // Refresh dashboard stats

        // Optional: Show toast notification
        toast.success(`New job: ${newJob.job_name}`);
    },
});

// Listen for job updates
useRealtime < Job > ({
    table: 'jobs',
    event: 'UPDATE',
    onUpdate: (updatedJob) => {
        console.log('Job updated:', updatedJob);
        mutate(); // Refresh to show latest data
    },
});


// ==========================================
// 4. ENABLE REALTIME IN SUPABASE
// ==========================================

// Go to Supabase Dashboard:
// 1. Database → Replication
// 2. Toggle ON Realtime for these tables:
//    - jobs
//    - invoices
//    - payments
//    - dispatches
//    - leads
// 3. Save changes

// That's it! No SQL needed - it's just a toggle.


// ==========================================
// 5. EXAMPLE: FULL DASHBOARD INTEGRATION
// ==========================================

'use client';

import { useEffect } from 'react';
import { useDashboardStats } from '@/lib/hooks';
import { usePageVisibility } from '@/lib/usePageVisibility';
import { useRealtime } from '@/lib/useRealtime';
import { Job, Invoice } from '@/types/database';

export default function Dashboard() {
    const { stats, loading, mutate } = useDashboardStats();

    // Refresh when user returns
    usePageVisibility({
        onVisible: () => mutate(),
    });

    // Listen for new jobs
    useRealtime < Job > ({
        table: 'jobs',
        onInsert: () => mutate(),
        onUpdate: () => mutate(),
    });

    // Listen for new invoices
    useRealtime < Invoice > ({
        table: 'invoices',
        onInsert: () => mutate(),
        onUpdate: () => mutate(),
    });

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <h1>Dashboard</h1>
            {/* Your dashboard content */}
            <div>Total Jobs: {stats.totalJobs}</div>
            <div className="text-xs text-green-600">● Live</div>
        </div>
    );
}


// ==========================================
// 6. TESTING
// ==========================================

// Test Idle Timeout:
// - Set timeout to 60000 (1 minute) for testing
// - Wait 55 seconds - warning should appear
// - Wait 5 more - auto logout
// - Reset to 3600000 (1 hour) for production

// Test Refresh on Focus:
// - Open dashboard
// - Switch to another tab
// - Add a job in database
// - Switch back - should refresh!

// Test Realtime:
// - Open dashboard in two browsers
// - Add job in one
// - See it appear in other instantly!


module.exports = {};
