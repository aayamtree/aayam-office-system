'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { X, Send, Hash, MessageCircle, Users, ChevronLeft } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: 'group' | 'direct';
  description?: string;
  other_user?: { id: string; full_name: string; role: string };
  unread?: number;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string; role: string };
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

function timeLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-${size} h-${size} ${color} rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [view, setView] = useState<'channels' | 'chat'>('channels');
  const [showDMPicker, setShowDMPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load all staff profiles for DM
  useEffect(() => {
    if (!open) return;
    supabase.from('profiles').select('id, full_name, role').eq('is_active', true).then(({ data }) => {
      if (data) setProfiles(data.filter(p => p.id !== profile?.id && p.full_name));
    });
  }, [open, profile?.id]);

  // Load channels
  const loadChannels = useCallback(async () => {
    if (!profile?.id) return;

    // Group channels
    const { data: groupChannels } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('type', 'group')
      .order('name');

    // Direct message channels this user is part of
    const { data: myDMChannelIds } = await supabase
      .from('chat_channel_members')
      .select('channel_id')
      .eq('user_id', profile.id);

    let dmChannels: Channel[] = [];
    if (myDMChannelIds?.length) {
      const channelIds = myDMChannelIds.map(r => r.channel_id);
      const { data: dmChans } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('type', 'direct')
        .in('id', channelIds);

      if (dmChans?.length) {
        // For each DM channel, find the other participant
        for (const chan of dmChans) {
          const { data: members } = await supabase
            .from('chat_channel_members')
            .select('user_id')
            .eq('channel_id', chan.id)
            .neq('user_id', profile.id);

          if (members?.[0]) {
            const { data: otherProfile } = await supabase
              .from('profiles')
              .select('id, full_name, role')
              .eq('id', members[0].user_id)
              .single();

            if (otherProfile) {
              dmChannels.push({
                ...chan,
                other_user: otherProfile,
              });
            }
          }
        }
      }
    }

    const all: Channel[] = [
      ...(groupChannels || []),
      ...dmChannels,
    ];
    setChannels(all);
  }, [profile?.id]);

  useEffect(() => {
    if (open) loadChannels();
  }, [open, loadChannels]);

  // Load messages for active channel
  useEffect(() => {
    if (!activeChannel) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, sender:profiles!sender_id(full_name, role)')
        .eq('channel_id', activeChannel.id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) setMessages(data as Message[]);
      setTimeout(scrollToBottom, 50);
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`chat:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        // Fetch sender info
        const { data: sender } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', newMsg.sender_id)
          .single();

        setMessages(prev => [...prev, { ...newMsg, sender: sender || undefined }]);
        setTimeout(scrollToBottom, 50);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel]);

  // Mark as read when channel opened
  useEffect(() => {
    if (!activeChannel || !profile?.id) return;
    supabase
      .from('chat_channel_members')
      .upsert({ channel_id: activeChannel.id, user_id: profile.id, last_read_at: new Date().toISOString() })
      .then(() => {});
  }, [activeChannel, profile?.id]);

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel || !profile?.id || sending) return;
    setSending(true);
    const content = input.trim();
    setInput('');

    const { error } = await supabase.from('chat_messages').insert({
      channel_id: activeChannel.id,
      sender_id: profile.id,
      content,
    });

    if (error) {
      setInput(content); // restore on error
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openChannel = (ch: Channel) => {
    setActiveChannel(ch);
    setMessages([]);
    setView('chat');
    setShowDMPicker(false);
  };

  const startDM = async (targetUser: Profile) => {
    if (!profile?.id) return;

    // Check if DM channel already exists between these two users
    const { data: myChannels } = await supabase
      .from('chat_channel_members')
      .select('channel_id')
      .eq('user_id', profile.id);

    if (myChannels?.length) {
      const { data: theirChannels } = await supabase
        .from('chat_channel_members')
        .select('channel_id')
        .eq('user_id', targetUser.id)
        .in('channel_id', myChannels.map(r => r.channel_id));

      if (theirChannels?.length) {
        // DM channel exists — find it
        const { data: existingChan } = await supabase
          .from('chat_channels')
          .select('*')
          .eq('type', 'direct')
          .in('id', theirChannels.map(r => r.channel_id))
          .single();

        if (existingChan) {
          openChannel({ ...existingChan, other_user: targetUser });
          return;
        }
      }
    }

    // Create new DM channel
    const { data: newChan } = await supabase
      .from('chat_channels')
      .insert({ name: `dm-${profile.id}-${targetUser.id}`, type: 'direct' })
      .select()
      .single();

    if (newChan) {
      await supabase.from('chat_channel_members').insert([
        { channel_id: newChan.id, user_id: profile.id },
        { channel_id: newChan.id, user_id: targetUser.id },
      ]);

      openChannel({ ...newChan, other_user: targetUser });
      await loadChannels();
    }
  };

  const channelDisplayName = (ch: Channel) => {
    if (ch.type === 'direct') return ch.other_user?.full_name || 'Direct Message';
    return ch.name.charAt(0).toUpperCase() + ch.name.slice(1);
  };

  const groupChannels = channels.filter(c => c.type === 'group');
  const dmChannels = channels.filter(c => c.type === 'direct');

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-96 bg-white shadow-2xl flex flex-col">

        {/* ── CHANNEL LIST ── */}
        {view === 'channels' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                <span className="font-bold text-base">Team Chat</span>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Group Channels */}
              <div className="px-3 pt-4 pb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Channels</p>
                {groupChannels.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => openChannel(ch)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Hash className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{channelDisplayName(ch)}</p>
                      {ch.description && <p className="text-xs text-gray-500">{ch.description}</p>}
                    </div>
                  </button>
                ))}
              </div>

              {/* Direct Messages */}
              <div className="px-3 pt-4 pb-2">
                <div className="flex items-center justify-between px-2 mb-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Direct Messages</p>
                  <button
                    onClick={() => setShowDMPicker(!showDMPicker)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + New
                  </button>
                </div>

                {showDMPicker && (
                  <div className="mb-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="text-xs text-blue-700 font-medium mb-2 px-1">Start a chat with:</p>
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => startDM(p)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-blue-100 transition-colors text-left"
                      >
                        <Avatar name={p.full_name} size={7} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.full_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{p.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {dmChannels.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => openChannel(ch)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <Avatar name={ch.other_user?.full_name || '?'} size={9} />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{channelDisplayName(ch)}</p>
                      <p className="text-xs text-gray-500 capitalize">{ch.other_user?.role}</p>
                    </div>
                  </button>
                ))}

                {dmChannels.length === 0 && !showDMPicker && (
                  <p className="text-xs text-gray-400 px-2 py-1">No DMs yet. Click + New to start one.</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── CHAT VIEW ── */}
        {view === 'chat' && activeChannel && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-3 bg-gray-900 text-white flex-shrink-0">
              <button onClick={() => setView('channels')} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              {activeChannel.type === 'group' ? (
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                  <Hash className="w-4 h-4" />
                </div>
              ) : (
                <Avatar name={activeChannel.other_user?.full_name || '?'} size={9} />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{channelDisplayName(activeChannel)}</p>
                {activeChannel.type === 'group' && (
                  <p className="text-xs text-white/60">Group channel</p>
                )}
                {activeChannel.type === 'direct' && (
                  <p className="text-xs text-white/60 capitalize">{activeChannel.other_user?.role}</p>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-8">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No messages yet. Say hello! 👋</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === profile?.id;
                const showAvatar = !isMe && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
                const showName = showAvatar;

                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && (
                      <div className="w-8 flex-shrink-0 flex items-end">
                        {showAvatar && <Avatar name={msg.sender?.full_name || '?'} size={8} />}
                      </div>
                    )}
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {showName && (
                        <p className="text-xs text-gray-500 mb-1 px-1">{msg.sender?.full_name}</p>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words
                        ${isMe
                          ? 'bg-gray-900 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-sm'
                        }`}>
                        {msg.content}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 px-1">{timeLabel(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 bg-white border-t border-gray-200 flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${activeChannel.type === 'group' ? '#' + activeChannel.name : channelDisplayName(activeChannel)}...`}
                rows={1}
                className="flex-1 resize-none px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm max-h-32 overflow-y-auto"
                style={{ minHeight: '42px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-gray-700 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
