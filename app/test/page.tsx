'use client';

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function TestConnectionPage() {
    const [status, setStatus] = useState('Testing...');
    const [error, setError] = useState('');
    const [config, setConfig] = useState<any>({});

    useEffect(() => {
        async function check() {
            // Check config
            const configured = isSupabaseConfigured();
            setConfig({
                isConfigured: configured,
                url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set (Hidden)' : 'Missing',
                key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (Hidden)' : 'Missing'
            });

            if (!configured) {
                setStatus('Configuration Missing');
                setError('Environment variables are missing.');
                return;
            }

            try {
                const start = Date.now();
                const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
                const time = Date.now() - start;

                if (error) {
                    setStatus('Connection Failed (Supabase Error)');
                    setError(error.message);
                } else {
                    setStatus(`Connected! (${time}ms)`);
                }
            } catch (err: any) {
                setStatus('Connection Failed (Network/Client Error)');
                setError(err.message || String(err));
            }
        }

        check();
    }, []);

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-page-title mb-3 md:mb-6">Database Connection Test</h1>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
                <div>
                    <h3 className="font-semibold text-gray-700">Configuration</h3>
                    <p className="text-sm">Configured: {config.isConfigured ? '✅ Yes' : '❌ No'}</p>
                    <p className="text-sm">URL: {config.url}</p>
                    <p className="text-sm">Key: {config.key}</p>
                </div>

                <div className={`p-4 rounded-lg ${status.includes('Connected!') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <h3 className="font-bold">Status: {status}</h3>
                    {error && <p className="mt-2 font-mono text-sm">{error}</p>}
                </div>

                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                    Test Again
                </button>
            </div>
        </div>
    );
}
