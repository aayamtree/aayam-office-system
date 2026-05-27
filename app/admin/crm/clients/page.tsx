'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import {
  Search, Plus, Phone, Mail, MapPin, Hash,
  Edit, Trash2, Eye, X, ArrowLeft, Building2, Loader2,
  Briefcase, IndianRupee, ExternalLink, UserCheck, FileBarChart,
  Send, Link2, CheckCircle2, Copy
} from 'lucide-react';
import { useClients, useJobs } from '@/lib/hooks';
import { Client } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';
import WhatsAppButton from '@/components/shared/WhatsAppButton';
import { logActivity } from '@/lib/logActivity';
import { supabase } from '@/lib/supabase';

// Sub-component: Telegram Linking for a client
function TelegramClientSection({ client, onUpdated }: { client: any; onUpdated: (chatId: string, username: string) => void }) {
  const [manualChatId, setManualChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const inviteLink = `https://t.me/aayam_notify_bot?start=client_${client.id}`;

  const handleManualSave = async () => {
    if (!manualChatId.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('clients').update({
      telegram_chat_id: manualChatId.trim(),
      telegram_linked_at: new Date().toISOString(),
    }).eq('id', client.id);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Telegram linked!');
    onUpdated(manualChatId.trim(), '');
    setManualChatId('');
  };

  const handleUnlink = async () => {
    const { error } = await supabase.from('clients').update({
      telegram_chat_id: null, telegram_username: null, telegram_linked_at: null,
    }).eq('id', client.id);
    if (error) { toast.error('Failed to unlink'); return; }
    toast.success('Telegram unlinked');
    onUpdated('', '');
  };

  return (
    <div className="p-3 bg-green-50 border border-green-200 rounded-md space-y-2">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-green-600" />
        <span className="text-sm font-semibold text-green-800">Telegram</span>
        {client.telegram_chat_id ? (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Linked{client.telegram_username ? ` @${client.telegram_username}` : ''}
          </span>
        ) : (
          <span className="ml-auto text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Not linked</span>
        )}
      </div>

      {client.telegram_chat_id ? (
        <button onClick={handleUnlink} className="text-xs text-red-500 hover:underline">Unlink Telegram</button>
      ) : (
        <>
          {/* Option 1: Share invite link */}
          <div>
            <p className="text-xs text-green-700 font-medium mb-1 flex items-center gap-1"><Link2 className="w-3 h-3" /> Share this link with client:</p>
            <div className="flex items-center gap-1">
              <input readOnly value={inviteLink} className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1 text-gray-600 truncate" />
              <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Link copied!'); }}
                className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Client opens link → messages the bot → auto-linked ✅</p>
          </div>

          {/* Option 2: Manual entry */}
          <div>
            <p className="text-xs text-green-700 font-medium mb-1">Or enter Chat ID manually:</p>
            <div className="flex items-center gap-1">
              <input value={manualChatId} onChange={e => setManualChatId(e.target.value)}
                placeholder="e.g. 123456789" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" />
              <button onClick={handleManualSave} disabled={saving || !manualChatId.trim()}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                {saving ? '...' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Sub-component: Client Jobs & Financial Summary
function ClientJobsSection({ clientId }: { clientId: string }) {
  const { jobs } = useJobs();
  const clientJobs = (jobs || []).filter(j => j.client_id === clientId);
  const totalBilled = clientJobs.reduce((s, j) => s + (j.total_amount || 0), 0);

  // Fetch real payment totals (bank + cash) instead of jobs.amount_received
  const [totalReceived, setTotalReceived] = useState(0);
  useEffect(() => {
    const fetchPayments = async () => {
      const [{ data: bankData }, { data: cashData }] = await Promise.all([
        supabase.from('bank_transactions').select('amount').eq('client_id', clientId).eq('is_verified', true),
        supabase.from('cash_transactions').select('amount').eq('client_id', clientId).eq('transaction_type', 'in'),
      ]);
      const bankTotal = (bankData || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const cashTotal = (cashData || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      setTotalReceived(bankTotal + cashTotal);
    };
    fetchPayments();
  }, [clientId]);

  const outstanding = totalBilled - totalReceived;

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-blue-100 text-blue-700', 'designing': 'bg-purple-100 text-purple-700',
      'approval': 'bg-amber-100 text-amber-700', 'printing': 'bg-cyan-100 text-cyan-700',
      'dispatched': 'bg-green-100 text-green-700', 'delivered': 'bg-gray-100 text-gray-700',
      'cancelled': 'bg-red-100 text-red-700',
    };
    return colors[stage] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-3">
      {/* Financial Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-xs text-gray-500">Total Billed</p>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-xs text-gray-500">Received</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className={`text-sm font-bold ${outstanding > 0 ? 'text-red-600' : outstanding < 0 ? 'text-green-700' : 'text-gray-900'}`}>
            {formatCurrency(Math.abs(outstanding))}{outstanding < 0 ? ' CR' : ''}
          </p>
        </div>
      </div>

      {/* Recent Jobs */}
      {clientJobs.length > 0 ? (
        <div className="border border-gray-100 rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase">Recent Jobs</span>
            <span className="text-xs text-gray-400">{clientJobs.length} total</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
            {clientJobs.slice(0, 5).map(job => (
              <div key={job.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.project_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{job.job_number}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-700">{formatCurrency(job.total_amount)}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded-md font-medium ${getStageColor(job.current_stage)}`}>
                    {job.current_stage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-gray-400 bg-gray-50 rounded-md">No jobs yet</div>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const { profile } = useAuth();
  const { clients, loading, createClient, updateClient, deleteClient } = useClients();
  const confirm = useConfirm();

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [marketingStaff, setMarketingStaff] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string; role: string }[]>([]);

  // Brand chip manager state
  const [editingClientBrands, setEditingClientBrands] = useState<{ id: string; name: string }[]>([]);
  const [newBrandInput, setNewBrandInput] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);

  // Load all profiles for 'Added by' + marketing staff for assignment (always fetch)
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name')
      .then(({ data }) => {
        const profiles = data || [];
        setAllProfiles(profiles);
        setMarketingStaff(profiles.filter(p => p.role === 'marketing'));
      });
  }, []);

  const [formData, setFormData] = useState({
    name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat',
    is_active: true, brand_name: '',
    // Marketing ownership fields (admin only)
    source: 'direct' as string,
    assigned_marketing_user_id: '' as string,
    // Opening balance (brought forward from previous FY)
    opening_balance: '' as string,
    opening_balance_date: '' as string,
    opening_balance_type: 'debit' as 'debit' | 'credit',
  });

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone?.includes(searchQuery) ||
      client.brand_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? client.is_active : !client.is_active);

    // RBAC: Marketers only see their own clients (by assignment or creation)
    if (profile?.role === 'marketing') {
      const isAssigned = (client as any).assigned_marketing_user_id === profile.id;
      const isCreated = client.created_by === profile.id;
      if (!isAssigned && !isCreated) return false;
    }

    return matchesSearch && matchesStatus;
  });

  const handleAddNew = () => {
    setFormData({ name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', is_active: true, brand_name: '', source: 'direct', assigned_marketing_user_id: '', opening_balance: '', opening_balance_date: '', opening_balance_type: 'debit' });
    setIsEditing(false);
    setSelectedClient(null);
    setEditingClientBrands([]);
    setNewBrandInput('');
    setShowModal(true);
  };

  const handleEdit = (client: Client) => {
    setFormData({
      name: client.name || '',
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      gstin: client.gstin || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || 'Gujarat',
      is_active: client.is_active,
      brand_name: client.brand_name || '',
      source: (client as any).source || 'direct',
      assigned_marketing_user_id: (client as any).assigned_marketing_user_id || '',
      opening_balance: (client as any).opening_balance != null ? String((client as any).opening_balance) : '',
      opening_balance_date: (client as any).opening_balance_date || '',
      opening_balance_type: (client as any).opening_balance_type || 'debit',
    });
    setSelectedClient(client);
    setIsEditing(true);
    setNewBrandInput('');
    // Load brands for this client from the brands table
    fetch(`/api/clients/${client.id}/brands`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => setEditingClientBrands(j.data || []))
      .catch(() => setEditingClientBrands([]));
    setShowModal(true);
  };

  const handleView = (client: Client) => {
    setSelectedClient(client);
    setShowViewModal(true);
  };

  const handleDelete = async (id: string) => {
    const clientName = clients.find(c => c.id === id)?.name || 'Unknown';
    const { confirmed } = await confirm({ title: 'Delete Client', message: 'Delete this client?', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) {
      try {
        await deleteClient(id);
        logActivity({ userId: profile?.id || '', userName: profile?.full_name || 'Unknown', action: 'DELETE', module: 'CRM', entityId: id, entityName: clientName, description: `Deleted Client: ${clientName}` });
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error deleting');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.phone && formData.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    setSaving(true);
    try {
      if (isEditing && selectedClient) {
        const updatePayload: any = { ...formData };
        // Admin can change source + marketing person
        if (profile?.role === 'admin') {
          updatePayload.source = formData.source;
          updatePayload.assigned_marketing_user_id = formData.assigned_marketing_user_id || null;
        }
        // Convert opening balance to numeric (or null if empty)
        const obRaw = formData.opening_balance;
        updatePayload.opening_balance = obRaw === '' || obRaw === null ? 0 : Number(obRaw);
        updatePayload.opening_balance_date = formData.opening_balance_date || null;
        updatePayload.opening_balance_type = formData.opening_balance_type || 'debit';
        await updateClient(selectedClient.id, updatePayload);
        logActivity({ userId: profile?.id || '', userName: profile?.full_name || 'Unknown', action: 'UPDATE', module: 'CRM', entityId: selectedClient.id, entityName: formData.name, description: `Updated Client: ${formData.name} (${formData.company || formData.phone})` });
      } else {
        // IMP-5: Duplicate phone detection — warn before creating
        if (formData.phone) {
          const duplicate = clients.find(c =>
            c.phone === formData.phone && c.id !== selectedClient?.id
          );
          if (duplicate) {
            const { confirmed } = await confirm({
              title: 'Duplicate Phone Detected',
              message: `Phone ${formData.phone} already belongs to "${duplicate.name}${duplicate.company ? ` (${duplicate.company})` : ''}". Do you still want to create this client?`,
              variant: 'danger',
              confirmLabel: 'Create Anyway',
            });
            if (!confirmed) { setSaving(false); return; }
          }
        }

        // Source is set explicitly by admin via the form, or defaults to 'direct'.
        // Marketing-sourced clients should ONLY come through lead→client conversion.
        const newClient: any = await createClient({
          ...formData,
          client_type: 'regular',
          credit_limit: 0,
          created_by: profile?.id,
          source: formData.source || 'direct',
          assigned_marketing_user_id: formData.assigned_marketing_user_id || null,
          opening_balance: formData.opening_balance === '' ? 0 : Number(formData.opening_balance),
          opening_balance_date: formData.opening_balance_date || null,
          opening_balance_type: formData.opening_balance_type || 'debit',
        } as any);

        // If brands were added inline for new client, seed them
        if (newClient?.id && editingClientBrands.length > 0) {
          for (const b of editingClientBrands) {
            try {
              await fetch(`/api/clients/${newClient.id}/brands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: b.name }),
              });
            } catch { /* non-fatal */ }
          }
        }
        logActivity({ userId: profile?.id || '', userName: profile?.full_name || 'Unknown', action: 'CREATE', module: 'CRM', entityName: formData.name, description: `Added Client: ${formData.name} — ${formData.phone}${formData.company ? ` (${formData.company})` : ''}` });
      }
      setShowModal(false);
      setIsEditing(false);
      setSelectedClient(null);
      setEditingClientBrands([]);
      setNewBrandInput('');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="space-y-3 px-2">
      {/* Mobile card skeletons */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card rounded-md border border-border border-l-4 border-l-stone-300 animate-pulse">
            <div className="h-8 bg-muted rounded-t-md" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-1/3 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="flex gap-2 pt-2">
                <div className="flex-1 h-7 bg-muted rounded" />
                <div className="h-7 w-7 bg-muted rounded" />
                <div className="h-7 w-7 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Desktop table skeleton */}
      <div className="hidden lg:block bg-white rounded-md border overflow-hidden animate-pulse">
        <div className="h-12 bg-gray-50 border-b" />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex gap-6 px-6 py-4 border-b items-center">
            <div className="flex items-center gap-3 flex-1"><div className="h-10 w-10 bg-gray-200 rounded-full" /><div className="space-y-1"><div className="h-4 w-28 bg-gray-200 rounded" /><div className="h-3 w-20 bg-gray-200 rounded" /></div></div>
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-5 w-14 bg-gray-200 rounded" />
            <div className="flex gap-1 ml-auto">{[1, 2, 3].map(j => <div key={j} className="h-8 w-8 bg-gray-200 rounded" />)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6 px-2 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm" className="p-2 hover:bg-gray-100 rounded-md lg:hidden"><ArrowLeft className="w-5 h-5" /></Link>
          <div><h1 className="text-lg md:text-xl lg:text-page-title text-gray-900">Clients</h1><p className="text-xs md:text-sm text-gray-500">{filteredClients.length} clients</p></div>
        </div>
        {profile?.role !== 'marketing' && (
          <button onClick={handleAddNew} className="flex items-center justify-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-md hover:bg-gray-800 transition-colors shadow-sm font-semibold text-sm md:text-base"><Plus className="w-4 h-4 md:hidden" /><Plus className="w-4 h-4 hidden md:block" /><span>Add Client</span></button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="text" placeholder="Search name, company, brand..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
          <SelectTrigger className="w-auto min-w-[100px] h-9 text-sm">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <>
          {/* Mobile/Tablet View: Queue-style cards */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {filteredClients.map((client) => (
              <div key={client.id} className="bg-white rounded-md border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                {/* ── Header Bar ── */}
                <div className={`px-3 py-2 flex items-center justify-between gap-2 ${client.is_active ? 'bg-gray-900' : 'bg-gray-500'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-white/10 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                      {(client.company || client.name)?.charAt(0)?.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{client.company || client.name}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 border ${client.is_active ? 'bg-green-900/60 text-green-300 border-green-700' : 'bg-gray-600 text-gray-300 border-gray-500'}`}>
                    {client.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* ── Body ── */}
                <div className="p-3 space-y-2">
                  {client.company && (
                    <p className="text-[11px] text-gray-400 font-medium">{client.name}</p>
                  )}
                  {/* Brand Tags */}
                  {client.brand_name && (
                    <div className="flex flex-wrap gap-1">
                      {client.brand_name.split(/\s+/).filter(Boolean).map((tag, i) => (
                        <span key={i} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-gray-600">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span className="font-semibold text-gray-900">{client.phone}</span>
                    </span>
                    {client.city && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span>{client.city}</span>
                      </span>
                    )}
                  </div>
                  {profile?.role === 'admin' && (
                    <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                      (client as any).source === 'marketing' ? 'bg-violet-100 text-violet-700' :
                      (client as any).source === 'referral' ? 'bg-emerald-100 text-emerald-700' :
                      (client as any).source === 'walk_in' ? 'bg-amber-100 text-amber-700' :
                      (client as any).source === 'online' ? 'bg-sky-100 text-sky-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {(client as any).source === 'marketing' ? '📣 Marketing' :
                       (client as any).source === 'referral' ? '🤝 Referral' :
                       (client as any).source === 'walk_in' ? '🚶 Walk-in' :
                       (client as any).source === 'online' ? '🌐 Online' : '📋 Direct'}
                    </span>
                  )}
                </div>

                {/* ── Action Footer ── */}
                <div className="flex items-center border-t border-gray-100">
                  <button onClick={() => handleView(client)} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <div className="w-px h-5 bg-gray-100" />
                  <button onClick={() => handleEdit(client)} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <div className="w-px h-5 bg-gray-100" />
                  <button onClick={() => handleDelete(client.id)} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {filteredClients.length === 0 && (
              <div className="col-span-full text-center py-12 bg-card rounded-md border border-border">
                <Building2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="text-sm font-medium text-foreground mb-1">No clients found</h3>
                <p className="text-xs text-muted-foreground mb-3">Try adjusting your filters</p>
                {profile?.role !== 'marketing' && (
                  <button onClick={handleAddNew} className="inline-flex items-center gap-2 bg-foreground text-background px-3 py-2 rounded-md text-xs font-semibold hover:opacity-90">
                    <Plus className="w-3.5 h-3.5" /> Add Client
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden lg:block bg-white rounded-md border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                  {profile?.role === 'admin' && <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Source</th>}
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Brands</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">City</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">
                          {(client.company || client.name)?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{client.company || client.name}</p>
                          {client.company && <p className="text-sm text-gray-500">{client.name}</p>}
                        </div>
                      </div>
                    </td>
                    {profile?.role === 'admin' && (
                      <td className="px-4 py-4">
                        <div className="space-y-0.5">
                          {/* Source badge — uses the actual stored source, no auto-correction */}
                          {(() => {
                            const storedSource = (client as any).source || 'direct';
                            const badgeClass = storedSource === 'marketing' ? 'bg-gray-900 text-white' :
                              storedSource === 'referral' ? 'bg-emerald-100 text-emerald-800' :
                                storedSource === 'walk_in' ? 'bg-amber-100 text-amber-800' :
                                  storedSource === 'online' ? 'bg-sky-100 text-sky-800' :
                                    'bg-gray-100 text-gray-600';
                            const badgeLabel = storedSource === 'marketing' ? 'Marketing' :
                              storedSource === 'referral' ? 'Referral' :
                                storedSource === 'walk_in' ? 'Walk-in' :
                                  storedSource === 'online' ? 'Online' : 'Direct';
                            return (
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>
                                {badgeLabel}
                              </span>
                            );
                          })()}
                          {/* Marketing person — show only if source is actually marketing */}
                          {(() => {
                            if ((client as any).source === 'marketing') {
                              const marketingPerson = (client as any).assigned_marketing_user_id
                                ? allProfiles.find(s => s.id === (client as any).assigned_marketing_user_id)?.full_name
                                : null;
                              return marketingPerson ? (
                                <p className="text-[11px] text-gray-800 font-semibold">👤 {marketingPerson}</p>
                              ) : null;
                            }
                            return null;
                          })()}
                          {/* Added by */}
                          {(client as any).created_by && (
                            <p className="text-[10px] text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">
                              Added by: {allProfiles.find(s => s.id === (client as any).created_by)?.full_name || 'Unknown'}
                            </p>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {client.brand_name ? (
                        <div className="flex flex-wrap gap-1">
                          {client.brand_name.split(/\s+/).filter(Boolean).map((tag, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md font-medium">
                              {tag.startsWith('#') ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 font-medium">{client.phone}</p>
                      <p className="text-sm text-gray-500">{client.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{client.city || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide ${client.is_active ? 'bg-gray-100 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleView(client)} className="p-2 hover:bg-gray-100 rounded-md text-gray-500 transition-colors" aria-label="View client details">
                          <Eye className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </button>
                        <button onClick={() => handleEdit(client)} className="p-2 hover:bg-gray-100 rounded-md text-gray-500 transition-colors" aria-label="Edit client">
                          <Edit className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </button>
                        <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-red-50 rounded-md text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No clients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section text-gray-900">{isEditing ? 'Edit Client' : 'Add Client'}</h2><button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {/* Marketing Ownership — Admin only. Marketing users can never change source. */}
              {profile?.role === 'admin' && (
                <div className="border border-gray-800 rounded-md p-3 bg-gray-900 space-y-2">
                  <p className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" /> Marketing Ownership
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-400">Source</label>
                      <select
                        value={formData.source}
                        onChange={(e) => {
                          const s = e.target.value;
                          setFormData({ ...formData, source: s, assigned_marketing_user_id: s === 'direct' ? '' : formData.assigned_marketing_user_id });
                        }}
                        className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-800 text-white focus:outline-none"
                      >
                        <option value="direct">Direct / Admin</option>
                        <option value="marketing">Marketing</option>
                        <option value="referral">Referral</option>
                        <option value="walk_in">Walk-in</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-400">Marketing Person</label>
                      <select
                        value={formData.assigned_marketing_user_id}
                        onChange={(e) => setFormData({ ...formData, assigned_marketing_user_id: e.target.value, source: e.target.value ? 'marketing' : formData.source })}
                        className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-800 text-white focus:outline-none"
                      >
                        <option value="">None</option>
                        {marketingStaff.map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">Name *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Company</label><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">Phone *</label><input type="tel" required minLength={10} maxLength={10} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div></div>
              <div><label className="block text-sm font-medium mb-1 text-gray-700">GSTIN</label><input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" maxLength={15} /></div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Brands <span className="text-gray-400 font-normal">(optional)</span></label>
                {/* Chip display */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editingClientBrands.map(b => (
                    <span key={b.id} className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-md font-medium">
                      #{b.name}
                      {isEditing && selectedClient && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await fetch(`/api/clients/${selectedClient.id}/brands`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ brandId: b.id, name: b.name }),
                              });
                              setEditingClientBrands(prev => prev.filter(x => x.id !== b.id));
                            } catch { /* non-fatal */ }
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
                          aria-label={`Remove brand ${b.name}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {/* Inline add brand */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={newBrandInput}
                      onChange={e => setNewBrandInput(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const name = newBrandInput.trim();
                          if (!name) return;
                          if (isEditing && selectedClient) {
                            setSavingBrand(true);
                            try {
                              const res = await fetch(`/api/clients/${selectedClient.id}/brands`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name }),
                              });
                              const j = await res.json();
                              if (j.data) setEditingClientBrands(prev => [...prev.filter(b => b.id !== j.data.id), j.data]);
                            } catch { } finally { setSavingBrand(false); }
                          } else {
                            // New client: stage it locally
                            const tempId = name.toLowerCase().replace(/\s+/g, '_');
                            if (!editingClientBrands.find(b => b.id === tempId)) {
                              setEditingClientBrands(prev => [...prev, { id: tempId, name }]);
                            }
                          }
                          setNewBrandInput('');
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm"
                      placeholder="Type brand name + Enter"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingBrand || !newBrandInput.trim()}
                    onClick={async () => {
                      const name = newBrandInput.trim();
                      if (!name) return;
                      if (isEditing && selectedClient) {
                        setSavingBrand(true);
                        try {
                          const res = await fetch(`/api/clients/${selectedClient.id}/brands`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name }),
                          });
                          const j = await res.json();
                          if (j.data) setEditingClientBrands(prev => [...prev.filter(b => b.id !== j.data.id), j.data]);
                        } catch { } finally { setSavingBrand(false); }
                      } else {
                        const tempId = name.toLowerCase().replace(/\s+/g, '_');
                        if (!editingClientBrands.find(b => b.id === tempId)) {
                          setEditingClientBrands(prev => [...prev, { id: tempId, name }]);
                        }
                      }
                      setNewBrandInput('');
                    }}
                    className="px-3 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-40"
                  >
                    {savingBrand ? '...' : 'Add'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Type brand name and press Enter or click Add</p>
              </div>
              <div><label className="block text-sm font-medium mb-1 text-gray-700">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" rows={2} /></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Status</label><select value={formData.is_active ? 'active' : 'inactive'} onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>

              {/* Opening Balance Section */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">Opening Balance</span>
                  <span className="text-xs text-gray-400">(Brought forward from previous FY)</span>
                </div>
                {/* Debit / Credit toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, opening_balance_type: 'debit' })}
                    className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                      formData.opening_balance_type === 'debit'
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Receivable (client owes us)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, opening_balance_type: 'credit' })}
                    className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                      formData.opening_balance_type === 'credit'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Credit (we owe client)
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.opening_balance}
                      onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">As of Date</label>
                    <input
                      type="date"
                      value={formData.opening_balance_date}
                      onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    />
                  </div>
                </div>
                {formData.opening_balance && Number(formData.opening_balance) > 0 && (
                  <p className="text-xs text-gray-500">
                    {formData.opening_balance_type === 'debit'
                      ? `₹${Number(formData.opening_balance).toLocaleString('en-IN')} receivable — client owes this from last year`
                      : `₹${Number(formData.opening_balance).toLocaleString('en-IN')} credit — client paid in advance or overpaid last year`}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-gray-700 font-semibold">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 font-semibold shadow-sm">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{isEditing ? 'Update' : 'Add'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-section text-gray-900">Client Profile</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Client Identity */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-2xl">{selectedClient.name?.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-section text-gray-900">{selectedClient.name}</h3>
                  <p className="text-gray-500">{selectedClient.company}</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-md ${selectedClient.client_type === 'premium' ? 'bg-amber-100 text-amber-700' :
                    selectedClient.client_type === 'corporate' ? 'bg-gray-900 text-white' :
                      'bg-gray-100 text-gray-700'
                    }`}>{selectedClient.client_type}</span>
                </div>
              </div>

              {/* Brands */}
              {selectedClient.brand_name && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedClient.brand_name.split(/\s+/).filter(Boolean).map((tag, i) => (
                    <span key={i} className="text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-2 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{selectedClient.phone}</span><WhatsAppButton phone={selectedClient.phone} /></div>
                {selectedClient.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{selectedClient.email}</span></div>}
                {selectedClient.address && <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{selectedClient.address}, {selectedClient.city}</span></div>}
                {selectedClient.gstin && <div className="flex items-center gap-3"><Building2 className="w-4 h-4 text-gray-400" /><span className="text-gray-700">GSTIN: {selectedClient.gstin}</span></div>}
              </div>

              {/* Telegram Section */}
              <TelegramClientSection client={selectedClient} onUpdated={(chatId, username) => {
                setSelectedClient({ ...selectedClient, telegram_chat_id: chatId, telegram_username: username });
              }} />

              {/* Client Jobs */}
              <ClientJobsSection clientId={selectedClient.id} />

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedClient); }} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-gray-700 font-semibold text-sm">Edit</button>
                <Link href={`/admin/jobs?client=${selectedClient.id}`} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors font-semibold shadow-sm text-center flex items-center justify-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4" /> Jobs
                </Link>
                <Link
                  href={`/admin/reports/client/${selectedClient.id}`}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-bold shadow-sm text-center flex items-center justify-center gap-2 text-sm border-2 border-red-700"
                  onClick={() => setShowViewModal(false)}
                >
                  <FileBarChart className="w-4 h-4" /> REPORT
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
