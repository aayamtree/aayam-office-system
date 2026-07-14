'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Loader2, Send, Bell, Newspaper, Users, RefreshCw } from 'lucide-react';

interface TelegramGroup {
  id: string;
  chat_id: string;
  title: string | null;
  department: string | null;
  alerts_enabled: boolean;
  digest_enabled: boolean;
  is_active: boolean;
  created_at: string;
}

const DEPARTMENTS = [
  { value: '', label: '— Not assigned —' },
  { value: 'design', label: '🎨 Design' },
  { value: 'print', label: '🖨️ Print' },
  { value: 'dispatch', label: '📦 Dispatch' },
  { value: 'admin', label: '👑 Admin' },
  { value: 'cmyk', label: '🖨️ CMYK' },
];

export default function TelegramGroupsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<TelegramGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.push('/admin/dashboard');
  }, [profile, router]);

  const authHeader = async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ''}` };
  };

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/groups', { headers: await authHeader() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setGroups(json.groups);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const updateGroup = async (id: string, updates: Partial<TelegramGroup>) => {
    setSavingId(id);
    try {
      const res = await fetch('/api/telegram/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setGroups((prev) => prev.map((g) => (g.id === id ? json.group : g)));
      toast.success('Saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-md border">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-500" /> Telegram Groups
          </h1>
          <button
            onClick={loadGroups}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Add the Aayam bot to a Telegram group and it appears here. Assign each group to a
          department — job stage updates and the daily 9 AM digest for that department will be
          sent there automatically.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading groups…
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No groups yet</p>
            <p className="text-sm mt-1">
              Create a Telegram group (e.g. &quot;Aayam Design&quot;), then add the Aayam bot to
              it. It will show up here within a few seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div
                key={g.id}
                className={`border rounded-md p-4 flex flex-col md:flex-row md:items-center gap-3 ${
                  g.is_active ? '' : 'opacity-50 bg-gray-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{g.title || 'Unnamed group'}</div>
                  <div className="text-xs text-gray-400">
                    {g.is_active ? 'Bot in group' : 'Bot removed from group'}
                  </div>
                </div>

                <select
                  value={g.department || ''}
                  disabled={savingId === g.id}
                  onChange={(e) => updateGroup(g.id, { department: (e.target.value || null) as any })}
                  className="border rounded-md px-3 py-2 text-sm bg-white"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={g.alerts_enabled}
                    disabled={savingId === g.id}
                    onChange={(e) => updateGroup(g.id, { alerts_enabled: e.target.checked })}
                  />
                  <Bell className="w-4 h-4" /> Job alerts
                </label>

                <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={g.digest_enabled}
                    disabled={savingId === g.id}
                    onChange={(e) => updateGroup(g.id, { digest_enabled: e.target.checked })}
                  />
                  <Newspaper className="w-4 h-4" /> Daily digest
                </label>

                {savingId === g.id && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t pt-4 text-xs text-gray-400 leading-relaxed">
          <b>How it works:</b> Design-stage changes go to the Design group, printing stages to the
          Print group, dispatch stages to the Dispatch group. Every alert has an &quot;Open in
          app&quot; button. Personal DMs (mentions, receipts, share links) are unchanged.
        </div>
      </div>
    </div>
  );
}
