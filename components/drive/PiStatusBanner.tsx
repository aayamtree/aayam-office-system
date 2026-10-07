'use client';

import { useState, useEffect, useCallback } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';

/**
 * Red banner for EVERY logged-in user when the office cloud (Raspberry Pi) cannot be
 * reached. Only active when the app is switched to Pi storage. Checks every 2 minutes
 * and whenever the user comes back to the tab. Shows nothing while everything is fine.
 */
const PI_MODE = process.env.NEXT_PUBLIC_STORAGE_BACKEND === 'seafile';

export default function PiStatusBanner() {
    const [down, setDown] = useState(false);
    const [detail, setDetail] = useState('');
    const [checking, setChecking] = useState(false);

    const check = useCallback(async () => {
        try {
            const res = await fetch('/api/storage/health', { cache: 'no-store' });
            if (res.status === 401) return; // not logged in yet
            const data = await res.json();
            setDown(!data.ok);
            setDetail(data.detail || '');
        } catch {
            // The user's own internet may be the problem — don't blame the Pi for it.
        }
    }, []);

    useEffect(() => {
        if (!PI_MODE) return;
        check();
        const id = setInterval(check, 2 * 60 * 1000);
        const onFocus = () => check();
        window.addEventListener('focus', onFocus);
        return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
    }, [check]);

    if (!PI_MODE || !down) return null;

    return (
        <div className="w-full bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 shadow-sm">
            <CloudOff className="w-5 h-5 animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                    ⚠️ Office Cloud is offline — file uploads and downloads are not working right now
                </p>
                <p className="text-xs text-red-100 mt-0.5 hidden sm:block">
                    {detail ? `${detail}. ` : ''}The admin has been informed. Your other work is not affected.
                </p>
            </div>
            <button
                onClick={async () => { setChecking(true); await check(); setChecking(false); }}
                disabled={checking}
                className="p-1.5 hover:bg-red-700 rounded transition-colors flex-shrink-0"
                title="Check again"
            >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            </button>
        </div>
    );
}
