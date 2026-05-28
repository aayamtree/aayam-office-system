'use client';

import { useState, useEffect } from 'react';
import { Send, X, Search, MessageSquare, Zap, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StaffContact {
  id: string;
  full_name: string;
  role: string;
  telegram_chat_id?: string;
  telegram_username?: string;
}

const MESSAGE_TEMPLATES = [
  {
    id: 'urgent',
    label: '🚨 Urgent',
    template: '🚨 URGENT: Please respond ASAP.\n\n'
  },
  {
    id: 'order_update',
    label: '📦 Order Update',
    template: '📦 Order Update:\n\n'
  },
  {
    id: 'dispatch',
    label: '🚚 Dispatch',
    template: '🚚 Dispatch update:\n\n'
  },
  {
    id: 'custom',
    label: '✏️ Custom',
    template: ''
  }
];

export default function TelegramFloatButton() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<StaffContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<StaffContact | null>(null);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) loadContacts();
  }, [isOpen]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredContacts(contacts);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredContacts(
      contacts.filter(c =>
        c.full_name?.toLowerCase().includes(query) ||
        c.role?.toLowerCase().includes(query) ||
        c.telegram_username?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, contacts]);

  useEffect(() => {
    const template = MESSAGE_TEMPLATES.find(t => t.id === selectedTemplate);
    if (template) setMessage(template.template);
  }, [selectedTemplate]);

  const loadContacts = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, telegram_chat_id, telegram_username')
        .eq('is_active', true)
        .not('id', 'eq', profile?.id) // exclude self
        .order('full_name');

      if (data) {
        setContacts(data);
        setFilteredContacts(data);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load team members');
    }
  };

  // Show for all logged-in users
  if (!profile) return null;

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!broadcastMode && !selectedContact) {
      toast.error('Please select a team member or use Broadcast');
      return;
    }

    if (!broadcastMode && !selectedContact?.telegram_chat_id) {
      toast.error(`${selectedContact?.full_name} hasn't linked Telegram yet`);
      return;
    }

    setSending(true);
    try {
      const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '8352518034:AAHsiUcPAu3XEAF72bupxjpO1wCk0F9oHns';
      const senderName = profile?.full_name || 'Team Member';
      const senderRole = profile?.role || '';
      const roleLabel = senderRole.charAt(0).toUpperCase() + senderRole.slice(1);
      const formattedMsg = `💬 <b>${senderName}</b> <i>(${roleLabel})</i>:\n${message.trim()}`;

      if (broadcastMode) {
        // Send to all staff with Telegram linked
        const targets = contacts.filter(c => c.telegram_chat_id);
        if (targets.length === 0) {
          toast.error('No team members have Telegram linked yet');
          setSending(false);
          return;
        }

        await Promise.all(
          targets.map(staff =>
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: staff.telegram_chat_id,
                text: formattedMsg,
                parse_mode: 'HTML'
              })
            })
          )
        );

        setShowSuccess(true);
        toast.success(`Broadcast sent to ${targets.length} team member${targets.length !== 1 ? 's' : ''}!`);
      } else {
        // Send to specific person
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: selectedContact!.telegram_chat_id,
            text: formattedMsg,
            parse_mode: 'HTML'
          })
        });

        const result = await response.json();
        if (!result.ok) throw new Error(result.description || 'Failed to send');

        setShowSuccess(true);
        toast.success(`Message sent to ${selectedContact!.full_name}!`);
      }

      setTimeout(() => {
        setMessage('');
        setSelectedContact(null);
        setSelectedTemplate('custom');
        setSearchQuery('');
        setShowSuccess(false);
        setBroadcastMode(false);
        setIsOpen(false);
      }, 2000);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send: ' + (error.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200"
        title="Message Team"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <>
            <Send className="w-5 h-5" />
            <span className="font-semibold hidden sm:inline">Team</span>
          </>
        )}
      </button>

      {/* Modal/Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed bottom-4 right-4 w-[95vw] sm:w-[420px] bg-white rounded-2xl shadow-2xl z-50 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-bold text-white text-base">Message Team</h3>
                  <p className="text-blue-100 text-xs">Send via Telegram bot</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {showSuccess && (
                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-bold text-green-900">Message Sent!</p>
                </div>
              )}

              {!showSuccess && (
                <>
                  {/* Broadcast toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setBroadcastMode(false); setSelectedContact(null); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border transition-colors ${
                        !broadcastMode
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      👤 One Person
                    </button>
                    <button
                      onClick={() => { setBroadcastMode(true); setSelectedContact(null); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border transition-colors ${
                        broadcastMode
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      📢 Broadcast All
                    </button>
                  </div>

                  {/* Contact picker — only for "One Person" mode */}
                  {!broadcastMode && (
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        Select Team Member
                      </Label>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search by name or role..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                        {filteredContacts.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p>No team members found</p>
                          </div>
                        ) : (
                          filteredContacts.map(contact => (
                            <button
                              key={contact.id}
                              onClick={() => setSelectedContact(contact)}
                              className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                                selectedContact?.id === contact.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-sm text-gray-900">{contact.full_name}</p>
                                  <p className="text-xs text-gray-500 capitalize">{contact.role}</p>
                                </div>
                                {contact.telegram_chat_id ? (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Linked</span>
                                ) : (
                                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Not linked</span>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {broadcastMode && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                      📢 Message will be sent to <b>all team members</b> who have Telegram linked.
                    </div>
                  )}

                  {/* Selected contact display */}
                  {!broadcastMode && selectedContact && (
                    <div className={`rounded-lg p-3 border ${
                      selectedContact.telegram_chat_id
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-orange-50 border-orange-200'
                    }`}>
                      <p className="font-bold text-sm text-gray-900">{selectedContact.full_name}</p>
                      <p className="text-xs capitalize text-gray-500">{selectedContact.role}</p>
                      {!selectedContact.telegram_chat_id && (
                        <p className="text-xs text-orange-600 mt-1">⚠️ This person hasn't linked Telegram yet</p>
                      )}
                    </div>
                  )}

                  {/* Quick Templates */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Quick Templates
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {MESSAGE_TEMPLATES.map(template => (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template.id)}
                          className={`p-2 text-xs border rounded-lg transition-colors ${
                            selectedTemplate === template.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          {template.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Message
                    </Label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="w-full h-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!showSuccess && (
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleSend}
                  disabled={sending || !message.trim() || (!broadcastMode && !selectedContact)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {broadcastMode ? 'Broadcast' : 'Send'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
