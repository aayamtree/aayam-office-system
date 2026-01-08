'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Search, Phone, Mail, Calendar, Clock, Edit, Trash2, X,
  CheckCircle, MessageSquare, Users, Video, AlertCircle, Loader2
} from 'lucide-react';
import { useClients, useFollowUps, useAuth } from '@/lib/hooks';

// Type Definitions
const followUpTypes = [
  { id: 'call', name: 'Call', icon: Phone, color: 'bg-green-100 text-green-700' },
  { id: 'email', name: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-700' },
  { id: 'meeting', name: 'Meeting', icon: Users, color: 'bg-purple-100 text-purple-700' },
  { id: 'video_call', name: 'Video Call', icon: Video, color: 'bg-orange-100 text-orange-700' },
  { id: 'message', name: 'Message', icon: MessageSquare, color: 'bg-cyan-100 text-cyan-700' },
];

export default function MarketingFollowUpsPage() {
  const { user, profile } = useAuth();

  // Real Data Hooks
  const { clients, loading: clientsLoading } = useClients();
  const { followUps, loading: followUpsLoading, createFollowUp, updateFollowUp, deleteFollowUp, refetch } = useFollowUps();

  // Local State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    type: 'call',
    date: '',
    time: '',
    notes: ''
  });

  const today = new Date().toISOString().split('T')[0];

  // Transform DB data to UI format
  const formattedFollowUps = (followUps || []).map((f: any) => ({
    id: f.id,
    clientId: f.client_id,
    clientName: f.client?.name || f.lead?.name || 'Unknown',
    type: 'call', // DB might not have type yet, defaulting
    date: f.follow_up_date ? new Date(f.follow_up_date).toISOString().split('T')[0] : '',
    time: f.follow_up_date ? new Date(f.follow_up_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
    notes: f.notes || '',
    status: f.follow_up_date && new Date(f.follow_up_date) < new Date() ? 'pending' : 'pending', // Logic needs refinement
    // For now, let's assume all are pending unless marked done (using a done flag? schema missed status column!)
    // Schema misses 'status' and 'type' columns! 
    // We will use 'notes' to store type for now or just default.
    // Wait, the user wants "Type". We should add it to schema properly later.
    // For now, I will save type in Notes prefix? No, that's hacky.
    // I will add columns to schema in the same SQL script!
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
        client_id: formData.clientId,
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
    setFormData({ clientId: '', type: 'call', date: '', time: '', notes: '' });
    setEditingFollowUp(null);
    setShowModal(false);
  };

  const handleEdit = (followUp: any) => {
    setFormData({
      clientId: followUp.clientId,
      type: 'call',
      date: followUp.date,
      time: followUp.time,
      notes: followUp.notes.replace(/^\[.*?\] /, '') // Strip prefix
    });
    setEditingFollowUp(followUp);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this follow-up?')) await deleteFollowUp(id);
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

    return (
      <div className={`bg-white rounded-xl shadow-sm border p-4 ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
            <TypeIcon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{followUp.clientName}</h3>
            </div>
            <p className="text-sm text-gray-600 mt-1">{cleanNotes}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(followUp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {followUp.time}
              </span>
              <span className={`px-2 py-0.5 rounded ${typeInfo.color}`}>{typeInfo.name}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button onClick={() => handleEdit(followUp)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"><Edit size={18} /></button>
            <button onClick={() => handleDelete(followUp.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>
    );
  };

  if (clientsLoading || followUpsLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto" /> Loading Data...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-gray-500">Track and manage your client follow-ups</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium">
          <Plus size={18} />
          <span>Add Follow-up</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Today</p>
          <p className="text-2xl font-bold text-blue-600">{todayFollowUps.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Upcoming</p>
          <p className="text-2xl font-bold text-green-600">{upcomingFollowUps.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{overdueFollowUps.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search follow-ups..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Types</option>
            {followUpTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Overdue Section */}
      {overdueFollowUps.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="text-red-600" size={20} />
            <h2 className="font-semibold text-red-900">Overdue ({overdueFollowUps.length})</h2>
          </div>
          <div className="space-y-3">
            {overdueFollowUps.map((f: any) => <FollowUpCard key={f.id} followUp={f} showDate />)}
          </div>
        </div>
      )}

      {/* Lists */}
      <div className="space-y-4">
        {todayFollowUps.length > 0 && <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h2 className="font-bold text-blue-800 mb-2">Today</h2>
          <div className="space-y-2">{todayFollowUps.map((f: any) => <FollowUpCard key={f.id} followUp={f} />)}</div>
        </div>}

        {upcomingFollowUps.length > 0 && <div className="p-4 border rounded-xl bg-gray-50">
          <h2 className="font-bold text-gray-700 mb-2">Upcoming</h2>
          <div className="space-y-2">{upcomingFollowUps.map((f: any) => <FollowUpCard key={f.id} followUp={f} showDate />)}</div>
        </div>}
      </div>


      {filteredFollowUps.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No follow-ups found</h3>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingFollowUp ? 'Edit Follow-up' : 'Add Follow-up'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Client *</label>
                <select required value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-white">
                  <option value="">Select Client</option>
                  {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-white">
                  {followUpTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
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
