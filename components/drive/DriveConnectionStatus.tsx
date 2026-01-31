'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function DriveConnectionStatus() {
    const { profile } = useAuth();
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/drive/connect');
            const data = await res.json();
            setStatus(data);
        } catch (error) {
            console.error('Error fetching Drive status:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                <span className="text-xs text-gray-600">Checking Drive...</span>
            </div>
        );
    }

    // Not connected - show warning
    if (!status?.connected || status?.isExpired) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(255,102,0,0.1)] border border-[rgba(255,102,0,0.2)] rounded-lg">
                <XCircle className="w-4 h-4 text-oms-orange" />
                <span className="text-label text-oms-orange">
                    Drive: {status?.isExpired ? 'Expired' : 'Not Connected'}
                </span>
                {profile?.role === 'admin' && (
                    <Link
                        href="/admin/settings"
                        className="ml-auto px-3 py-1 bg-oms-orange text-white text-label rounded hover:opacity-90 transition-all"
                    >
                        Configure
                    </Link>
                )}
            </div>
        );
    }

    // Connected - show success
    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-label text-green-900">Drive: Connected</span>
        </div>
    );
}
