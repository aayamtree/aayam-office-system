'use client';

import { useState, useEffect } from 'react';
import { Share2, X, Send, MessageCircle, Check, Lock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
}

interface ShareToChatProps {
  /** Job/order ID for deep link */
  jobId: string;
  /** e.g. "AY-0042" */
  jobNumber: string;
  /** e.g. "Visiting Cards — DL size" */
  projectName: string;
  /** Client company or name */
  clientName?: string;
  /** Extra CSS for the trigger button */
  className?: string;
}

/**
 * Share button — opens a mini modal to post a clickable job link
 * into the team General chat channel, optionally tagging a specific person.
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
  const [target, setTarget] = useState<string>('general');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Load team list when modal opens
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

  async function handleShare() {
    if (!profile) return;
    setSending(true);

    try {
      // Find General channel
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('name', 'general')
        .eq('type', 'group')
        .single();

      if (!channel) {
        alert('General channel not found. Please contact admin.');
        return;
      }

      // Build message
      const jobUrl = `${window.location.origin}/admin/jobs/${jobId}`;
      const targetPerson = team.find((t) => t.id === target);
      const atMention = targetPerson
        ? `@${targetPerson.full_name.split(' ')[0]} `
        : '';

      const lines = [
        `📎 *Job #${jobNumber}* — ${projectName}`,
        clientName ? `Client: ${clientName}` : '',
        note.trim() ? `Note: ${note.trim()}` : '',
        `🔗 ${jobUrl}`,
        `— Shared by ${profile.full_name || 'Team'}`,
      ].filter(Boolean);

      const content = atMention + lines.join('\n');
      const mentionedUserIds = targetPerson ? [targetPerson.id] : [];

      const { error } = await supabase.from('chat_messages').insert({
        channel_id: channel.id,
        sender_id: profile.id,
        content,
        mentioned_user_ids: mentionedUserIds,
      });

      if (error) throw error;

      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setNote('');
        setTarget('general');
        setConfirmed(false);
      }, 1600);
    } catch (err) {
      console.error('Share failed:', err);
      alert('Could not share. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        title="Share to Team Chat"
        className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors ${className}`}
      >
        <Share2 size={13} />
        <span className="hidden sm:inline">Share</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Share to Team Chat</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Security banner — always visible */}
            <div className="mx-5 mb-1 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
              <Lock size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">Internal Only — Aayam Team</p>
                <p className="text-xs text-amber-700 leading-snug mt-0.5">
                  This shares inside the Aayam chat only. Do <strong>not</strong> share client
                  details, invoices, or amounts outside this app.
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Job preview card */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-500 font-medium mb-0.5 uppercase tracking-wider">Job being shared</p>
                <p className="font-mono text-sm font-bold text-blue-800">#{jobNumber}</p>
                <p className="text-sm text-gray-800 font-medium leading-snug">{projectName}</p>
                {clientName && (
                  <p className="text-xs text-gray-500 mt-1">{clientName}</p>
                )}
              </div>

              {/* Who to share with */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Share to
                </label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="general">📢 General — everyone sees it</option>
                  <optgroup label="Tag a specific person">
                    {team
                      .filter((t) => t.id !== profile?.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          @{t.full_name} ({t.role})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {/* Optional note */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Add a note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Urgent — please check deadline, files in Drive..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Confirmation checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                />
                <span className="text-xs text-gray-600 leading-snug">
                  I confirm this is <strong>internal Aayam information only</strong> and I am
                  sharing it with the team for a work purpose.
                </span>
              </label>

              {/* Send button */}
              <button
                onClick={handleShare}
                disabled={sending || sent || !confirmed}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all"
                style={{
                  background: sent ? '#16a34a' : confirmed ? '#2563eb' : '#94a3b8',
                  color: '#fff',
                  opacity: sending ? 0.75 : 1,
                  cursor: confirmed ? 'pointer' : 'not-allowed',
                }}
              >
                {sent ? (
                  <>
                    <Check size={16} />
                    Shared to Chat!
                  </>
                ) : sending ? (
                  <>
                    <span className="animate-spin inline-block">↻</span>
                    Sharing…
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    Share to Chat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
