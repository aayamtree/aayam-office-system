'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Phone, Mail, Calendar, Clock, Edit, Trash2, X,
  CheckCircle, MessageSquare, Users, Video, AlertCircle, Loader2, FileText
} from 'lucide-react';
import { useLeads, useFollowUps, useAuth } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';

// Type Definitions
const followUpTypes = [
  { id: 'call', name: 'Call', icon: Phone, color: 'bg-gray-100 text-gray-900' },
  { id: 'email', name: 'Email', icon: Mail, color: 'bg-muted text-foreground' },
  { id: 'meeting', name: 'Meeting', icon: Users, color: 'bg-gray-900 text-white' },
  { id: 'video_call', name: 'Video Call', icon: Video, color: 'bg-orange-100 text-orange-700' },
  { id: 'message', name: 'Message', icon: MessageSquare, color: 'bg-cyan-100 text-cyan-700' },
];

export default function MarketingFollowUpsPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  // Real Data Hooks
  const { leads, loading: leadsLoading } = useLeads();
  const { followUps, loading: followUpsLoading, createFollowUp, updateFollowUp, deleteFollowUp, refetch } = useFollowUps();

  // Local State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();

  const [formData, setFormData] = useState({
    leadId: '',
    type: 'call',
    date: '',
    time: '',
    notes: ''
  });

  const today = new Date().toLocaleDateString('en-CA');

  // Transform DB data to UI format
  const formattedFollowUps = (followUps || []).map((f: any) => ({
    id: f.id,
    leadId: f.lead_id,
    clientName: f.lead?.name || f.client?.name || 'Unknown',
    companyName: f.lead?.company || f.client?.company,
    type: 'call', // DB might not have type yet, defaulting
    date: f.follow_up_date ? new Date(f.follow_up_date).toLocaleDateString('en-CA') : '',
    time: f.follow_up_date ? new Date(f.follow_up_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
    notes: f.notes || '',
    status: 'pending',
    quotation: f.quotation, // Include quotation data
    quotationNumber: f.quotation?.quote_number,
  }));

  // Filtering
  const filteredFollowUps = formattedFollowUps.filter((f: any) => {
    const matchesSearch = (f.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    // const matchesType = typeFilter === 'all' || f.type === typeFilter; 
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const todayFollowUps = filteredFollowUps.filter((f: any) => f.date === today);
  const upcomingFollowUps = filteredFollowUps.filter((f: any) => f.date > today);
  const overdueFollowUps = filteredFollowUps.filter((f: any) => f.date < today);
  // const completedFollowUps = filteredFollowUps.filter(f => f.status === 'completed');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`).toISOString();
      const payload = {
        lead_id: formData.leadId,
        follow_up_date: dateTime,
        notes: `[${formData.type}] ${formData.notes}`, // Storing type in notes for now as temporary fix
        done_by: profile?.id || user?.id
      };

      if (editingFollowUp) {
        await updateFollowUp(editingFollowUp.id, payload);
      } else {
        await createFollowUp(payload);
      }
      setShowModal(false);
      resetForm();
      refetch();
    } catch (e) {
      alert('Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ leadId: '', type: 'call', date: '', time: '', notes: '' });
    setEditingFollowUp(null);
    setShowModal(false);
  };

  const handleEdit = (followUp: any) => {
    setFormData({
      leadId: followUp.leadId || '',
      type: 'call',
      date: followUp.date,
      time: followUp.time,
      notes: followUp.notes.replace(/^\[.*?\] /, '') // Strip prefix
    });
    setEditingFollowUp(followUp);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete Follow-up', message: 'Are you sure you want to delete this follow-up?', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) await deleteFollowUp(id);
  };

  const handleCreateQuote = (followUp: any) => {
    console.log('Creating quote for follow-up:', followUp);

    if (followUp.leadId) {
      router.push(`/admin/marketing/quotations?new=true&leadId=${followUp.leadId}&followUpId=${followUp.id}`);
    } else {
      alert('Error: No Lead linked to this follow-up.');
    }
  };

  const handleViewQuote = (followUp: any) => {
    // Navigate to quotations page (could add highlight or filter)
    router.push(`/admin/marketing/quotations`);
  };

  const getTypeInfo = (type: string) => followUpTypes.find(t => t.id === type) || followUpTypes[0];

  const FollowUpCard = ({ followUp, showDate = false }: { followUp: any, showDate?: boolean }) => {
    // Extract type from notes hack
    const typeMatch = followUp.notes.match(/^\[(.*?)\]/);
    const type = typeMatch ? typeMatch[1] : 'call';
    const cleanNotes = followUp.notes.replace(/^\[.*?\] /, '');

    const typeInfo = getTypeInfo(type);
    const TypeIcon = typeInfo.icon;
    const isOverdue = followUp.date < today;
    const isToday = followUp.date === today;

    // Determine header color based on date status
    const headerColors = {
      overdue: 'bg-gradient-to-r from-red-500 to-red-600',
      today: 'bg-gradient-to-r from-gray-700 to-gray-800',
      upcoming: 'bg-gradient-to-r from-gray-800 to-gray-900',
    };
    const headerBg = isOverdue ? headerColors.overdue : isToday ? headerColors.today : headerColors.upcoming;

    return (
      <div className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100">
        {/* Colored Header */}
        <div className={`${headerBg} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <TypeIcon className="w-4 h-4 md:w-4.5 md:h-4.5 text-white" />
            </div>
            <span className="text-white font-semibold text-sm md:text-base">
              {followUp.clientName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {followUp.companyName && (
              <span className="text-white/90 text-xs px-3 py-1 bg-white/20 rounded-full font-medium hidden sm:inline-block">
                {followUp.companyName}
              </span>
            )}
            <span className="text-white/90 text-xs px-3 py-1 bg-white/20 rounded-full font-medium capitalize">
              {typeInfo.name}
            </span>
          </div>
        </div>

        {/* White Card Body */}
        <div className="p-5">
          <p className="text-sm text-gray-600 mb-3">{cleanNotes}</p>

          <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(followUp.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {followUp.time ? new Date(`2000-01-01T${followUp.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            {followUp.quotation ? (
              <button
                onClick={() => handleViewQuote(followUp)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> View Quote {followUp.quotationNumber}
              </button>
            ) : (
              <button
                onClick={() => handleCreateQuote(followUp)}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
              >
                <FileText className="w-4 h-4" /> Create Quote
              </button>
            )}

            <div className="p-4 flex gap-1">
              <button onClick={() => handleEdit(followUp)} className="p-2 text-gray-400 hover:text-foreground hover:bg-muted rounded-lg transition-colors" aria-label="Edit follow-up">
                <Edit className="w-4 h-4 md:w-4.5 md:h-4.5" />
              </button>
              <button onClick={() => handleDelete(followUp.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" aria-label="Delete follow-up">
                <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (leadsLoading || followUpsLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto" /> Loading Data...</div>;

  return (
    <div className="space-y-2 md:space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-page-title text-gray-900">Follow-ups</h1>
          <p className="text-sm md:text-base text-gray-500">Track and manage your client follow-ups</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-lg hover:bg-gray-800 font-semibold shadow-sm text-sm md:text-base w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4 md:hidden" />
          <Plus className="w-4 h-4 hidden md:block" />
          <span>Add Follow-up</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-lg md:rounded-lg border p-3 md:p-4">
          <p className="text-xs md:text-sm text-gray-500">Today</p>
          <p className="text-page-title text-foreground">{todayFollowUps.length}</p>
        </div>
        <div className="bg-white rounded-lg md:rounded-lg border p-3 md:p-4">
          <p className="text-xs md:text-sm text-gray-500">Upcoming</p>
          <p className="text-page-title text-gray-900">{upcomingFollowUps.length}</p>
        </div>
        <div className="bg-white rounded-lg md:rounded-lg border p-3 md:p-4">
          <p className="text-xs md:text-sm text-gray-500">Overdue</p>
          <p className="text-page-title text-red-600">{overdueFollowUps.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search follow-ups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {followUpTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overdue Section */}
      {overdueFollowUps.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="text-red-600 w-5 h-5" />
            <h2 className="font-semibold text-red-900">Overdue ({overdueFollowUps.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {overdueFollowUps.map((f: any) => <FollowUpCard key={f.id} followUp={f} showDate />)}
          </div>
        </div>
      )}

      {/* Lists */}
      <div className="space-y-4">
        {todayFollowUps.length > 0 && <div className="bg-muted p-4 rounded-lg border border-border">
          <h2 className="font-bold text-gray-900 mb-2">Today</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{todayFollowUps.map((f: any) => <FollowUpCard key={f.id} followUp={f} />)}</div>
        </div>}

        {upcomingFollowUps.length > 0 && <div className="p-4 border rounded-lg bg-gray-50">
          <h2 className="font-bold text-gray-700 mb-2">Upcoming</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{upcomingFollowUps.map((f: any) => <FollowUpCard key={f.id} followUp={f} showDate />)}</div>
        </div>}
      </div>


      {filteredFollowUps.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No follow-ups found</h3>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-page-title">{editingFollowUp ? 'Edit Follow-up' : 'Add Follow-up'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Lead / Potential Client *</label>
                <select required value={formData.leadId} onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-white">
                  <option value="">Select Lead</option>
                  {(leads || []).map(l => <option key={l.id} value={l.id}>{l.name} {l.company ? `(${l.company})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-white">
                  {followUpTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date *</label>
                  <input type="date" required value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Time *</label>
                  <input type="time" required value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Notes</label>
                <textarea value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" rows={3} placeholder="What to discuss..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-md font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md font-semibold hover:bg-gray-800 shadow-sm">
                  {submitting ? 'Saving...' : (editingFollowUp ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
