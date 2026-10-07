'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AlertTriangle, CloudOff, X, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function DriveDisconnectBanner() {
    const { profile } = useAuth();
    const [status, setStatus] = useState<'connected' | 'expired' | 'disconnected' | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [checking, setChecking] = useState(false);

    const checkDriveStatus = useCallback(async () => {
        if (profile?.role !== 'admin') return;
        try {
            const res = await fetch('/api/drive/connect');
            const data = await res.json();
            if (data.connected && !data.isExpired) {
                setStatus('connected');
                setDismissed(false); // auto-reset dismissed if drive comes back
            } else if (data.connected && data.isExpired) {
                setStatus('expired');
            } else {
                setStatus('disconnected');
            }
        } catch {
            // silent — don't show banner on network errors
        }
    }, [profile?.role]);

    useEffect(() => {
        if (profile?.role !== 'admin') return;
        checkDriveStatus();
        // Re-check every 5 minutes
        const interval = setInterval(checkDriveStatus, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [profile?.role, checkDriveStatus]);

    // Only show to admins, only when disconnected/expired, only if not dismissed
    if (process.env.NEXT_PUBLIC_STORAGE_BACKEND === 'seafile') return null; // Pi mode: see PiStatusBanner
    if (profile?.role !== 'admin') return null;
    if (status === null || status === 'connected') return null;
    if (dismissed) return null;

    const isExpired = status === 'expired';

    return (
        <div className="w-full bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 shadow-sm">
            {/* Icon */}
            <div className="flex-shrink-0">
                <CloudOff className="w-5 h-5 animate-pulse" />
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                    {isExpired
                        ? '⚠️ Google Drive token expired — file uploads are disabled for all users!'
                        : '⚠️ Google Drive is not connected — file uploads are disabled for all users!'}
                </p>
                <p className="text-xs text-red-100 mt-0.5 hidden sm:block">
                    {isExpired
                        ? 'Your Drive connection expired. Reconnect immediately to restore file uploads.'
                        : 'Connect Google Drive in Settings to enable file uploads for your team.'}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={async () => {
                        setChecking(true);
                        await checkDriveStatus();
                        setChecking(false);
                    }}
                    disabled={checking}
                    className="p-1.5 hover:bg-red-700 rounded transition-colors"
                    title="Re-check Drive status"
                >
                    <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                </button>

                <Link
                    href="/admin/settings/drive"
                    className="px-3 py-1.5 bg-white text-red-600 text-sm font-bold rounded-md hover:bg-red-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                    Reconnect Now
                    <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <button
                    onClick={() => setDismissed(true)}
                    className="p-1.5 hover:bg-red-700 rounded transition-colors"
                    title="Dismiss (reappears in 5 minutes if still disconnected)"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
