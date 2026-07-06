'use client';

/**
 * Share-this-page button (Header) — sends the current app page to a team
 * member on Telegram. The recipient gets a message with an "🚀 Open in app"
 * button that lands them on the exact page. Built for staff who are out of
 * office (dispatch etc.) — no need to explain where to look, just share.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Share2, Send, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';

interface Member {
  id: string;
  full_name: string;
  role: string;
  telegram_chat_id: string | null;
}

export default function SharePageButton() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [note, setNote] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, telegram_chat_id')
        .eq('is_active', true)
        .neq('id', profile?.id || '')
        .order('full_name');
      setMembers(data || []);
    })();
  }, [open, profile?.id]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const share = async (member: Member) => {
    if (!member.telegram_chat_id) {
      toast.error(`${member.full_name} hasn't linked Telegram yet (Profile Settings → Link Telegram)`);
      return;
    }
    setSendingTo(member.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          mode: 'share',
          targetProfileIds: [member.id],
          text: note.trim(),
          url: pathname,
        }),
      });
      const json = await res.json();
      if (json.sent > 0) {
        setSentTo(member.id);
        toast.success(`Shared with ${member.full_name}`);
        setTimeout(() => { setSentTo(null); setOpen(false); setNote(''); }, 1200);
      } else {
        toast.error(json.error || 'Could not send');
      }
    } catch {
      toast.error('Could not send — check your connection');
    } finally {
      setSendingTo(null);
    }
  };

  if (!profile) return null;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-muted transition-colors"
        title="Share this page with a team member (Telegram)"
      >
        <Share2 className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-semibold">Share this page</p>
            <p className="text-xs text-muted-foreground truncate">{pathname}</p>
          </div>
          <div className="p-2 border-b border-border">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)…"
              className="w-full text-sm px-2.5 py-1.5 rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary"
              maxLength={200}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => share(m)}
                disabled={sendingTo !== null}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted text-left disabled:opacity-60"
              >
                <span>
                  <span className="text-sm block">{m.full_name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {m.role}{!m.telegram_chat_id && ' · no Telegram'}
                  </span>
                </span>
                {sentTo === m.id ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : sendingTo === m.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className={`w-4 h-4 ${m.telegram_chat_id ? 'text-blue-500' : 'text-muted-foreground/40'}`} />
                )}
              </button>
            ))}
            {members.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">Loading team…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
