'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, CloudOff, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';

/** Settings card: live status of the office cloud (Raspberry Pi). */
export default function PiStatusCard() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ ok: boolean; ms: number; detail: string; checkedAt?: string } | null>(null);

    const check = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/storage/health', { cache: 'no-store' });
            setData(await res.json());
        } catch {
            setData({ ok: false, ms: 0, detail: 'Could not check — is your own internet working?' });
        }
        setLoading(false);
    }, []);

    useEffect(() => { check(); }, [check]);

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        : data?.ok ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                            : <CloudOff className="w-6 h-6 text-red-600" />}
                    <div>
                        <p className="font-semibold text-gray-900">
                            {loading ? 'Checking…' : data?.ok ? 'Office Cloud is online' : 'Office Cloud is OFFLINE'}
                        </p>
                        {!loading && data && (
                            <p className="text-xs text-gray-500">
                                {data.ok ? `Answered in ${data.ms} ms` : data.detail}
                            </p>
                        )}
                    </div>
                </div>
                <button onClick={check} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100" title="Check again">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            <p className="text-xs text-gray-500">
                Files are stored on the office Raspberry Pi (4 TB disk). The app checks it every 5 minutes and sends
                a Telegram message to the admin group if it stays offline for about 10 minutes, and again when it is back.
            </p>
            <a href="https://files.aayamfiles.com" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                Open the file website <ExternalLink className="w-3.5 h-3.5" />
            </a>
        </div>
    );
}
