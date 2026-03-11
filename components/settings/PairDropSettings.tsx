'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { CheckCircle, XCircle, Loader2, Link as LinkIcon } from 'lucide-react';

/*
  SQL to create the app_settings table (run once in Supabase SQL editor):

  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

  -- Allow admins to read and write
  CREATE POLICY "admins_all" ON app_settings
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    );

  -- Allow anyone authenticated to read
  CREATE POLICY "authenticated_read" ON app_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);
*/

type ConnectionStatus = 'idle' | 'checking' | 'ok' | 'error';

export default function PairDropSettings() {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';

    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [connStatus, setConnStatus] = useState<ConnectionStatus>('idle');

    // Load current setting
    useEffect(() => {
        supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'pairdrop_url')
            .maybeSingle()
            .then(({ data }) => {
                setUrl(data?.value || '');
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        if (!isAdmin) return;
        setSaving(true);
        const { error } = await supabase.from('app_settings').upsert(
            { key: 'pairdrop_url', value: url.trim(), updated_at: new Date().toISOString() },
            { onConflict: 'key' }
        );
        setSaving(false);
        if (error) {
            toast.error('Failed to save: ' + error.message);
        } else {
            toast.success('File Transfer URL saved!');
            setConnStatus('idle');
        }
    };

    const handleTest = async () => {
        const testUrl = url.trim();
        if (!testUrl) { toast.error('Enter a URL first'); return; }
        setConnStatus('checking');
        try {
            // Use no-cors mode — we just want to know if the server responds at all.
            // A successful opaque response means the server is reachable.
            await fetch(testUrl, { method: 'GET', mode: 'no-cors', signal: AbortSignal.timeout(5000) });
            setConnStatus('ok');
        } catch {
            setConnStatus('error');
        }
    };

    if (loading) {
        return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading settings...</div>;
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    File Transfer Server (PairDrop)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Self-hosted PairDrop URL on your office network. Used by the{' '}
                    <span className="font-medium">Team → Files</span> page.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    type="url"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setConnStatus('idle'); }}
                    placeholder="http://192.168.1.100:3000"
                    disabled={!isAdmin}
                    className="flex-1 min-w-0 border border-gray-200 rounded-md px-3 py-2.5 text-sm font-mono outline-none focus:border-[#B8860B] transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                    onClick={handleTest}
                    disabled={connStatus === 'checking' || !url.trim()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                    {connStatus === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {connStatus === 'ok' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    {connStatus === 'error' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                    {connStatus === 'idle' && <LinkIcon className="w-3.5 h-3.5" />}
                    {connStatus === 'checking' ? 'Testing…' : connStatus === 'ok' ? 'Reachable' : connStatus === 'error' ? 'Unreachable' : 'Test'}
                </button>
                {isAdmin && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#B8860B] text-white rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap"
                    >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {saving ? 'Saving…' : 'Save URL'}
                    </button>
                )}
            </div>

            {connStatus === 'ok' && (
                <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Server is reachable on your network.</p>
            )}
            {connStatus === 'error' && (
                <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Cannot reach the server. Check the IP/ port and make sure PairDrop is running.</p>
            )}

            <div className="text-xs text-muted-foreground bg-gray-50 border border-gray-100 rounded-md p-3 space-y-1 font-mono">
                <p className="font-sans font-medium text-gray-700 mb-1.5">PairDrop Setup (office machine):</p>
                <p># Docker (recommended):</p>
                <p className="pl-2">docker run -d --restart=always --name pairdrop \</p>
                <p className="pl-8">-p 3000:3000 lscr.io/linuxserver/pairdrop</p>
                <br />
                <p className="font-sans text-gray-500">Then enter: http://[machine&apos;s local IP]:3000</p>
            </div>
        </div>
    );
}
