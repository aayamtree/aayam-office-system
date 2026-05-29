'use client';

import { useState, useEffect, useRef } from 'react';
import { Share2, Check, Loader2, Users, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
}

interface ShareToChatProps {
  jobId: string;
  jobNumber: string;
  projectName: string;
  clientName?: string;
  className?: string;
}

/**
 * Share button with quick-pick tag popup.
 * Click Share → pick "General" or a team member → instantly posts with @mention.
 * No modal, no form, no checkbox — just 2 taps.
 */
export function ShareToChat({
  jobId,
  jobNumber,
  projectName,
  clientName,
  className = '',
}: ShareToChatProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [sending, setSending] = useState<string | null>(null); // stores id being sent
  const [sent, setSent] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load team when picker opens
  useEffect(() => {
    if (!open || team.length > 0) return;
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .not('full_name', 'is', null)
      .order('full_name')
      .then(({ data }) => setTeam(data || []));
  }, [open, team.length]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleShare(targetMember?: TeamMember) {
    if (!profile || sending) return;
    setSending(targetMember?.id || 'general');
    setOpen(false);

    try {
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('name', 'general')
        .eq('type', 'group')
        .single();

      if (!channel) {
        toast.error('General channel not found.');
        setSending(null);
        return;
      }

      const jobUrl = `${window.location.origin}/admin/sales/orders?view=${jobId}`;
      const atMention = targetMember
        ? `@${targetMember.full_name.split(' ')[0]} `
        : '';

      const lines = [
        `📎 *#${jobNumber}* — ${projectName}`,
        clientName ? `Client: ${clientName}` : '',
        `🔗 ${jobUrl}`,
        `— ${profile.full_name || 'Team'}`,
      ].filter(Boolean);

      const { error } = await supabase.from('chat_messages').insert({
        channel_id: channel.id,
        sender_id: profile.id,
        content: atMention + lines.join('\n'),
        mentioned_user_ids: targetMember ? [targetMember.id] : [],
      });

      if (error) throw error;

      setSent(true);
      const who = targetMember
        ? `@${targetMember.full_name.split(' ')[0]}`
        : 'General chat';
      toast.success(`📎 #${jobNumber} shared to ${who}`);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error('Share failed:', err);
      toast.error('Could not share. Try again.');
    } finally {
      setSending(null);
    }
  }

  const isLoading = !!sending;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!isLoading) setOpen((o) => !o);
        }}
        disabled={isLoading}
        title="Share to Team Chat"
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
          ${sent
            ? 'bg-green-50 text-green-600 border border-green-200'
            : 'text-blue-600 border border-blue-200 hover:bg-blue-50'
          } ${className}`}
      >
        {isLoading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : sent ? (
          <Check size={13} />
        ) : (
          <Share2 size={13} />
        )}
        <span>{isLoading ? 'Sharing…' : sent ? 'Shared!' : 'Share'}</span>
        {!isLoading && !sent && <ChevronDown size={11} />}
      </button>

      {/* Quick-pick popover */}
      {open && (
        <div
          className="absolute z-[400] bottom-full mb-2 right-0 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Share to…</p>
          </div>

          {/* General option */}
          <button
            onClick={() => handleShare(undefined)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
          >
            <span className="text-base">📢</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">General</p>
              <p className="text-xs text-gray-400">Everyone sees it</p>
            </div>
          </button>

          {/* Divider */}
          <div className="border-t border-gray-100 mx-3" />

          {/* Team members */}
          <div className="max-h-48 overflow-y-auto">
            {team.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">Loading team…</div>
            ) : (
              team
                .filter((m) => m.id !== profile?.id)
                .map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleShare(member)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {member.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.full_name}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{member.role}</p>
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
