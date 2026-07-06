'use client';

/**
 * Global right-click share menu (2026-07-06, Satish's request).
 *
 * Right-click (long-press on Android) anywhere in the app →
 *   📤 Share on Telegram  → pick a member → they get an "Open in app" button
 *   📋 Copy link
 *
 * Smart target: if you right-click on/inside a link (job row, client card…),
 * the menu shares THAT item's page; otherwise it shares the current page.
 *
 * Deliberately does NOT hijack right-click in text fields, editable areas,
 * or when text is selected (so copy/paste still works normally), and
 * Shift+right-click always opens the normal browser menu.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Send, Link as LinkIcon, Check, Loader2, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';

interface Member {
  id: string;
  full_name: string;
  role: string;
  telegram_chat_id: string | null;
}

export default function GlobalShareMenu() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [picking, setPicking] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setPos(null);
    setPicking(false);
    setSendingTo(null);
    setSentTo(null);
  }, []);

  // ── Open on right-click ────────────────────────────────────────────────
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (!profile) return;
      if (e.shiftKey) return; // power users: Shift+right-click = browser menu

      const target = e.target as HTMLElement;
      // Keep native menu where it matters (copy/paste, editing, selected text)
      if (target.closest('input, textarea, [contenteditable="true"]')) return;
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) return;

      // Smart target: nearest internal link wins, else current page
      const anchor = target.closest('a[href^="/"]') as HTMLAnchorElement | null;
      const url = anchor?.getAttribute('href') || pathname || '/admin/dashboard';

      e.preventDefault();
      setShareUrl(url);
      // Keep the menu inside the viewport
      const MENU_W = 240;
      const MENU_H = 300;
      setPos({
        x: Math.min(e.clientX, window.innerWidth - MENU_W - 8),
        y: Math.min(e.clientY, window.innerHeight - MENU_H - 8),
      });
      setPicking(false);
    };

    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, [profile, pathname]);

  // ── Close on outside click / Esc / scroll ─────────────────────────────
  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos, close]);

  const loadMembers = async () => {
    setPicking(true);
    if (members.length) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, telegram_chat_id')
      .eq('is_active', true)
      .neq('id', profile?.id || '')
      .order('full_name');
    setMembers(data || []);
  };

  const copyLink = async () => {
    const full = `${window.location.origin}${shareUrl}`;
    try {
      await navigator.clipboard.writeText(full);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy');
    }
    close();
  };

  const sendTo = async (m: Member) => {
    if (!m.telegram_chat_id) {
      toast.error(`${m.full_name} hasn't linked Telegram yet`);
      return;
    }
    setSendingTo(m.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ mode: 'share', targetProfileIds: [m.id], url: shareUrl }),
      });
      const json = await res.json();
      if (json.sent > 0) {
        setSentTo(m.id);
        toast.success(`Shared with ${m.full_name}`);
        setTimeout(close, 900);
      } else {
        toast.error(json.error || 'Could not send');
      }
    } catch {
      toast.error('Could not send');
    } finally {
      setSendingTo(null);
    }
  };

  if (!pos) return null;

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, width: 240 }}
      className="z-[9999] bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
    >
      {!picking ? (
        <>
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs text-muted-foreground truncate">{shareUrl}</p>
          </div>
          <button
            onClick={loadMembers}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted text-left text-sm"
          >
            <Send className="w-4 h-4 text-blue-500" /> Share on Telegram…
          </button>
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted text-left text-sm"
          >
            <LinkIcon className="w-4 h-4 text-muted-foreground" /> Copy link
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => setPicking(false)}
            className="w-full flex items-center gap-1.5 px-3 py-2 border-b border-border text-xs text-muted-foreground hover:bg-muted text-left"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Send to…
          </button>
          <div className="max-h-56 overflow-y-auto">
            {members.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted-foreground text-center">Loading…</p>
            )}
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => sendTo(m)}
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
          </div>
        </>
      )}
    </div>
  );
}
