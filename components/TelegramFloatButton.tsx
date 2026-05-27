'use client';

import { useState, useEffect } from 'react';
import { Send, X, Search, User, Building2, MessageSquare, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Contact {
  id: string;
  name: string;
  company?: string;
  type: 'client' | 'vendor';
  telegram_chat_id?: string;
  telegram_username?: string;
  phone?: string;
}

const MESSAGE_TEMPLATES = [
  {
    id: 'order_ready',
    label: '📦 Order Ready',
    template: '✅ Your order is ready for pickup!\n\nOrder: {order_number}\nAmount: ₹{amount}\n\nPlease contact us to arrange delivery.'
  },
  {
    id: 'payment_received',
    label: '💰 Payment Received',
    template: '✅ Payment received! Thank you.\n\nAmount: ₹{amount}\nMode: {payment_mode}\nInvoice: {invoice_number}\n\nReceipt will be sent shortly.'
  },
  {
    id: 'payment_reminder',
    label: '⚠️ Payment Reminder',
    template: '📢 Payment Reminder\n\nInvoice: {invoice_number}\nAmount Due: ₹{amount}\nDue Date: {due_date}\n\nPlease arrange payment at your earliest convenience.'
  },
  {
    id: 'delivery_update',
    label: '🚚 Delivery Update',
    template: '🚚 Your order is out for delivery!\n\nOrder: {order_number}\nExpected: {delivery_date}\nTracking: {tracking_number}\n\nOur delivery team will contact you shortly.'
  },
  {
    id: 'custom',
    label: '✏️ Custom Message',
    template: ''
  }
];

export default function TelegramFloatButton() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load contacts
  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Filter contacts based on search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredContacts(
      contacts.filter(c =>
        c.name?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query) ||
        c.phone?.includes(query) ||
        c.telegram_username?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, contacts]);

  // Update message when template changes
  useEffect(() => {
    const template = MESSAGE_TEMPLATES.find(t => t.id === selectedTemplate);
    if (template) {
      setMessage(template.template);
    }
  }, [selectedTemplate]);

  // Only show for admin and finance
  if (!profile || !['admin', 'finance'].includes(profile.role)) {
    return null;
  }

  const loadContacts = async () => {
    try {
      // Load clients with Telegram
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, company, phone, telegram_chat_id, telegram_username')
        .not('telegram_chat_id', 'is', null)
        .eq('is_active', true);

      // Load vendors with Telegram
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id, name, company, phone, telegram_chat_id, telegram_username')
        .not('telegram_chat_id', 'is', null)
        .eq('is_active', true);

      const allContacts: Contact[] = [
        ...(clients || []).map(c => ({ ...c, type: 'client' as const })),
        ...(vendors || []).map(v => ({ ...v, type: 'vendor' as const }))
      ];

      setContacts(allContacts);
      setFilteredContacts(allContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Failed to load contacts');
    }
  };

  const handleSend = async () => {
    if (!selectedContact || !message.trim()) {
      toast.error('Please select contact and enter message');
      return;
    }

    if (!selectedContact.telegram_chat_id) {
      toast.error('Contact has no Telegram linked');
      return;
    }

    setSending(true);
    try {
      // Send via Telegram API
      const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '8352518034:AAHsiUcPAu3XEAF72bupxjpO1wCk0F9oHns';
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: selectedContact.telegram_chat_id,
          text: message,
          parse_mode: 'HTML'
        })
      });

      const result = await response.json();

      if (result.ok) {
        setShowSuccess(true);
        toast.success(`Message sent to ${selectedContact.name}!`);
        
        // Reset form
        setTimeout(() => {
          setMessage('');
          setSelectedContact(null);
          setSelectedTemplate('custom');
          setSearchQuery('');
          setShowSuccess(false);
          setIsOpen(false);
        }, 2000);
      } else {
        throw new Error(result.description || 'Failed to send');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message: ' + (error.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-full shadow-2xl hover:shadow-green-500/50 hover:scale-105 transition-all duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
        title="Send Telegram Message"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <>
            <Send className="w-5 h-5" />
            <span className="font-semibold hidden sm:inline">Telegram</span>
          </>
        )}
      </button>

      {/* Modal/Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed bottom-4 right-4 w-[95vw] sm:w-[450px] bg-white rounded-2xl shadow-2xl z-50 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send className="w-6 h-6 text-white" />
                <div>
                  <h3 className="font-bold text-white text-lg">Send Telegram Message</h3>
                  <p className="text-green-100 text-xs">Quick message to clients/vendors</p>
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Success Animation */}
              {showSuccess && (
                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center animate-bounce">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-bold text-green-900">Message Sent!</p>
                </div>
              )}

              {!showSuccess && (
                <>
                  {/* Search Contacts */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Select Contact
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search by name, company, phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Contact List */}
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                      {filteredContacts.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          {contacts.length === 0 ? (
                            <>
                              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                              <p>No contacts with Telegram linked</p>
                              <p className="text-xs mt-1">Link Telegram in client/vendor settings</p>
                            </>
                          ) : (
                            'No contacts found'
                          )}
                        </div>
                      ) : (
                        filteredContacts.map(contact => (
                          <button
                            key={contact.id}
                            onClick={() => setSelectedContact(contact)}
                            className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                              selectedContact?.id === contact.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {contact.type === 'client' ? (
                                <User className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Building2 className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900 truncate">
                                  {contact.name}
                                </p>
                                {contact.company && (
                                  <p className="text-xs text-gray-500 truncate">{contact.company}</p>
                                )}
                                {contact.telegram_username && (
                                  <p className="text-xs text-green-600">@{contact.telegram_username}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Selected Contact Display */}
                  {selectedContact && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs text-green-700 font-semibold mb-1">Sending to:</p>
                      <p className="font-bold text-green-900">{selectedContact.name}</p>
                      {selectedContact.company && (
                        <p className="text-sm text-green-700">{selectedContact.company}</p>
                      )}
                    </div>
                  )}

                  {/* Message Templates */}
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
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {template.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message Textarea */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Message
                    </Label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message here..."
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Tip: Use {'{order_number}'}, {'{amount}'}, {'{invoice_number}'} as placeholders
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!showSuccess && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleSend}
                  disabled={!selectedContact || !message.trim() || sending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
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
