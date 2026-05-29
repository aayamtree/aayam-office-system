'use client';

import { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';

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
 * One-click Share button — instantly posts a clickable job link into the
 * team General chat. No modal, no form, no checkbox. Fast.
 *
 * The shared link uses ?view=jobId so the receiver can open the job
 * as an overlay on top of whatever page they're on.
 */
export function ShareToChat({
  jobId,
  jobNumber,
  projectName,
  clientName,
  className = '',
}: ShareToChatProps) {
  const { profile } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!profile || state !== 'idle') return;

    setState('sending');

    try {
      // Find (or verify) General channel
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('name', 'general')
        .eq('type', 'group')
        .single();

      if (!channel) {
        toast.error('General channel not found.');
        setState('idle');
        return;
      }

      // Deep-link URL — opens as overlay on orders page
      const jobUrl = `${window.location.origin}/admin/sales/orders?view=${jobId}`;

      const lines = [
        `📎 *#${jobNumber}* — ${projectName}`,
        clientName ? `Client: ${clientName}` : '',
        `🔗 ${jobUrl}`,
        `— ${profile.full_name || 'Team'}`,
      ].filter(Boolean);

      const { error } = await supabase.from('chat_messages').insert({
        channel_id: channel.id,
        sender_id: profile.id,
        content: lines.join('\n'),
        mentioned_user_ids: [],
      });

      if (error) throw error;

      setState('sent');
      toast.success(`📎 #${jobNumber} shared to General chat`);

      // Reset back to idle after 2s
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      console.error('Share failed:', err);
      toast.error('Could not share. Try again.');
      setState('idle');
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={state !== 'idle'}
      title={state === 'sent' ? 'Shared!' : 'Share to Team Chat'}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
        ${state === 'sent'
          ? 'bg-green-50 text-green-600 border border-green-200'
          : 'text-blue-600 border border-blue-200 hover:bg-blue-50'
        } ${className}`}
    >
      {state === 'sending' ? (
        <Loader2 size={13} className="animate-spin" />
      ) : state === 'sent' ? (
        <Check size={13} />
      ) : (
        <Share2 size={13} />
      )}
      <span>
        {state === 'sending' ? 'Sharing…' : state === 'sent' ? 'Shared!' : 'Share'}
      </span>
    </button>
  );
}
