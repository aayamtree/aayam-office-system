'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string; role: string };
}

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  telegram_chat_id?: string;
}

const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '8352518034:AAHsiUcPAu3XEAF72bupxjpO1wCk0F9oHns';

function timeLabel(ts: string) {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Generates a consistent colour per person initial
function avatarColor(name: string) {
  const palette = ['#5b8dee', '#4caf7d', '#9c6fe4', '#f5a623', '#e45c5c', '#26a5a5'];
  return palette[name.charCodeAt(0) % palette.length];
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, background: avatarColor(name), borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontWeight: 700, fontSize: size * 0.38 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// Render message content: images inline, files as link, text with @mention highlight
function MessageContent({ content }: { content: string }) {
  if (content.startsWith('[img]')) {
    const url = content.slice(5);
    return (
      <img
        src={url}
        alt="attachment"
        style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
        onClick={() => window.open(url, '_blank')}
      />
    );
  }
  if (content.startsWith('[file:')) {
    const match = content.match(/\[file:(.+?)\](.+)/);
    if (!match) return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
    const [, fname, url] = match;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.9 }}>
        <Paperclip size={13} style={{ flexShrink: 0 }} />
        <span style={{ textDecoration: 'underline' }}>{fname}</span>
      </a>
    );
  }
  // Highlight @mentions
  const parts = content.split(/(@\S+)/g);
  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} style={{ color: '#5b8dee', fontWeight: 600 }}>{part}</span>
        ) : part
      )}
    </span>
  );
}

export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [mentionMatches, setMentionMatches] = useState<TeamMember[]>([]);
  const [showMentions, setShowMentions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !profile?.id) return;
    loadEverything();
    return () => { realtimeRef.current?.unsubscribe(); };
  }, [open, profile?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── @mention detection ─────────────────────────────────────────────────
  useEffect(() => {
    const m = input.match(/@(\w*)$/);
    if (m) {
      const q = m[1].toLowerCase();
      setMentionMatches(team.filter(t => t.full_name.toLowerCase().includes(q)));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }, [input, team]);

  // ── load channel + team ────────────────────────────────────────────────
  const loadEverything = async () => {
    // Team members
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, role, telegram_chat_id')
      .eq('is_active', true)
      .order('full_name');
    if (members) setTeam(members.filter((m) => m.id !== profile?.id));

    // General channel
    const { data: ch } = await supabase
      .from('chat_channels')
      .select('id')
      .eq('type', 'group')
      .ilike('name', 'general')
      .maybeSingle();

    if (!ch) return;
    const cid = ch.id;
    setChannelId(cid);

    // Messages
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, sender_id, content, created_at, sender:profiles!chat_messages_sender_id_fkey(full_name, role)')
      .eq('channel_id', cid)
      .order('created_at', { ascending: true })
      .limit(100);
    if (msgs) setMessages(msgs as Message[]);

    // Realtime
    realtimeRef.current = supabase
      .channel(`team-chat-${cid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${cid}` },
        async (payload) => {
          const { data: msg } = await supabase
            .from('chat_messages')
            .select('id, sender_id, content, created_at, sender:profiles!chat_messages_sender_id_fkey(full_name, role)')
            .eq('id', payload.new.id)
            .maybeSingle();
          if (msg) setMessages((prev) => [...prev, msg as Message]);
        }
      )
      .subscribe();
  };

  // ── Telegram relay ─────────────────────────────────────────────────────
  const relayText = async (text: string) => {
    const targets = team.filter((t) => t.telegram_chat_id);
    if (!targets.length) return;
    const senderName = profile?.full_name || 'Team Member';
    const roleLabel = (profile?.role || '').charAt(0).toUpperCase() + (profile?.role || '').slice(1);
    const msg = `💬 <b>${senderName}</b> <i>(${roleLabel})</i>:\n${text}`;
    await Promise.all(
      targets.map((t) =>
        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: t.telegram_chat_id, text: msg, parse_mode: 'HTML' }),
        })
      )
    );
  };

  const relayFile = async (file: File, publicUrl: string) => {
    const targets = team.filter((t) => t.telegram_chat_id);
    if (!targets.length) return;
    const senderName = profile?.full_name || 'Team Member';
    const roleLabel = (profile?.role || '').charAt(0).toUpperCase() + (profile?.role || '').slice(1);
    const isImage = file.type.startsWith('image/');
    await Promise.all(
      targets.map((t) =>
        isImage
          ? fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: t.telegram_chat_id,
                photo: publicUrl,
                caption: `📷 <b>${senderName}</b> <i>(${roleLabel})</i>`,
                parse_mode: 'HTML',
              }),
            })
          : fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: t.telegram_chat_id,
                text: `📎 <b>${senderName}</b>: <a href="${publicUrl}">${file.name}</a>`,
                parse_mode: 'HTML',
              }),
            })
      )
    );
  };

  // ── send text ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !channelId || !profile?.id || sending) return;
    setSending(true);
    const content = input.trim();
    setInput('');

    const { error } = await supabase.from('chat_messages').insert({
      channel_id: channelId,
      sender_id: profile.id,
      content,
    });

    if (!error) {
      try { await relayText(content); } catch {}
    } else {
      setInput(content);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  // ── upload file ────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    if (!channelId || !profile?.id) return;
    setUploading(true);
    try {
      const path = `${channelId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('chat-files').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path);
      const isImage = file.type.startsWith('image/');
      const content = isImage ? `[img]${publicUrl}` : `[file:${file.name}]${publicUrl}`;

      const { error } = await supabase.from('chat_messages').insert({
        channel_id: channelId,
        sender_id: profile.id,
        content,
      });
      if (!error) {
        try { await relayFile(file, publicUrl); } catch {}
      }
    } catch (e) {
      console.error('Upload error:', e);
    } finally {
      setUploading(false);
    }
  };

  // ── insert @mention ────────────────────────────────────────────────────
  const insertMention = (member: TeamMember) => {
    const firstName = member.full_name.split(' ')[0];
    setInput((prev) => prev.replace(/@\w*$/, `@${firstName} `));
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && (e.key === 'Escape')) { setShowMentions(false); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!open) return null;

  // ── UI ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 16, right: 16,
        width: 'min(420px, 95vw)',
        height: 'min(620px, 85vh)',
        background: '#0e1621',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}>

        {/* ── Header ── */}
        <div style={{ background: '#17212b', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#5b8dee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
            A
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Aayam Team</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{team.length + 1} members · General</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Messages ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 40 }}>
              No messages yet. Say hi! 👋
            </div>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === profile?.id;
            const prev = messages[i - 1];
            const showSender = !isMe && msg.sender_id !== prev?.sender_id;
            const senderName = msg.sender?.full_name || '?';

            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: showSender && !isMe ? 10 : 2 }}>
                {/* Avatar (others only) */}
                {!isMe && (
                  <div style={{ width: 32, flexShrink: 0 }}>
                    {showSender ? <Avatar name={senderName} size={32} /> : null}
                  </div>
                )}

                <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {showSender && !isMe && (
                    <div style={{ color: avatarColor(senderName), fontSize: 12, fontWeight: 600, marginBottom: 3, paddingLeft: 4 }}>
                      {senderName}
                    </div>
                  )}
                  <div style={{
                    background: isMe ? '#2b5278' : '#182533',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: 14,
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}>
                    <MessageContent content={msg.content} />
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                    {timeLabel(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* ── @mention dropdown ── */}
        {showMentions && mentionMatches.length > 0 && (
          <div style={{ background: '#17212b', borderTop: '1px solid rgba(255,255,255,0.07)', maxHeight: 140, overflowY: 'auto' }}>
            {mentionMatches.map((m) => (
              <button
                key={m.id}
                onClick={() => insertMention(m)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Avatar name={m.full_name} size={28} />
                <div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{m.full_name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'capitalize' }}>{m.role}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{ background: '#17212b', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ background: 'none', border: 'none', cursor: uploading ? 'default' : 'pointer', padding: 6, borderRadius: '50%', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: uploading ? 0.5 : 1 }}
            title="Attach file"
          >
            {uploading
              ? <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <Paperclip size={20} />
            }
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message… type @ to mention someone"
            rows={1}
            style={{
              flex: 1,
              background: '#0e1621',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 14,
              padding: '9px 12px',
              borderRadius: 20,
              resize: 'none',
              minHeight: 38,
              maxHeight: 110,
              overflowY: 'auto',
              lineHeight: 1.4,
              fontFamily: 'inherit',
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 110) + 'px';
            }}
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              background: input.trim() ? '#5b8dee' : '#2b3d52',
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'default',
              width: 38, height: 38,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
