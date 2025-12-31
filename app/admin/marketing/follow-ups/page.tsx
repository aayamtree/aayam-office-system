'use client';

import { useState } from 'react';
import {
  Plus, Search, Phone, Mail, Calendar, Clock, Edit, Trash2, X,
  CheckCircle, MessageSquare, Users, Video, AlertCircle
} from 'lucide-react';

const currentUser = { id: 1, name: 'Marketing User' };

const followUpTypes = [
  { id: 'call', name: 'Call', icon: Phone, color: 'bg-green-100 text-green-700' },
  { id: 'email', name: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-700' },
  { id: 'meeting', name: 'Meeting', icon: Users, color: 'bg-purple-100 text-purple-700' },
  { id: 'video_call', name: 'Video Call', icon: Video, color: 'bg-orange-100 text-orange-700' },
  { id: 'message', name: 'Message', icon: MessageSquare, color: 'bg-cyan-100 text-cyan-700' },
];

const clients = [
  { id: 1, name: 'Sharma Industries' },
  { id: 2, name: 'Patel Enterprises' },
  { id: 3, name: 'Gujarat Textiles' },
  { id: 4, name: 'Royal Prints' },
];

const initialFollowUps = [
  {
    id: 1, clientId: 1, clientName: 'Sharma Industries', type: 'call', date: '2025-12-26', time: '10:00',
    notes: 'Discuss quotation for wedding cards', status: 'pending', ownerId: 1
  },
  {
    id: 2, clientId: 4, clientName: 'Royal Prints', type: 'meeting', date: '2025-12-26', time: '14:00',
    notes: 'Product demo for brochures', status: 'pending', ownerId: 1
  },
  {
    id: 3, clientId: 2, clientName: 'Patel Enterprises', type: 'email', date: '2025-12-26', time: '16:00',
    notes: 'Send revised quotation', status: 'pending', ownerId: 1
  },
  {
    id: 4, clientId: 3, clientName: 'Gujarat Textiles', type: 'call', date: '2025-12-27', time: '11:00',
    notes: 'Follow up on packaging inquiry', status: 'pending', ownerId: 1
  },
  {
    id: 5, clientId: 1, clientName: 'Sharma Industries', type: 'call', date: '2025-12-25', time: '15:00',
    notes: 'Initial discussion about requirements', status: 'completed', outcome: 'Interested, need quotation', ownerId: 1
  },
  {
    id: 6, clientId: 2, clientName: 'Patel Enterprises', type: 'meeting', date: '2025-12-24', time: '10:00',
    notes: 'First meeting', status: 'completed', outcome: 'Very interested, will send samples', ownerId: 1
  },
];

export default function MarketingFollowUpsPage() {
  const [followUps, setFollowUps] = useState(initialFollowUps.filter(f => f.ownerId === currentUser.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any>(null);

  const [formData, setFormData] = useState({
    clientId: '', type: 'call', date: '', time: '', notes: ''
  });

  const today = new Date().toISOString().split('T')[0];

  const filteredFollowUps = followUps.filter(f => {
    const matchesSearch = f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.notes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || f.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const todayFollowUps = filteredFollowUps.filter(f => f.date === today && f.status === 'pending');
  const upcomingFollowUps = filteredFollowUps.filter(f => f.date > today && f.status === 'pending');
  const overdueFollowUps = filteredFollowUps.filter(f => f.date < today && f.status === 'pending');
  const completedFollowUps = filteredFollowUps.filter(f => f.status === 'completed');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id.toString() === formData.clientId);
    if (editingFollowUp) {
      setFollowUps(followUps.map(f => f.id === editingFollowUp.id ?
        { ...f, ...formData, clientId: parseInt(formData.clientId), clientName: client?.name || '' } : f));
    } else {
      const newFollowUp = {
        id: Date.now(), ...formData, clientId: parseInt(formData.clientId),
        clientName: client?.name || '', status: 'pending', ownerId: currentUser.id
      };
      setFollowUps([newFollowUp, ...followUps]);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ clientId: '', type: 'call', date: '', time: '', notes: '' });
    setEditingFollowUp(null);
    setShowModal(false);
  };

  const handleEdit = (followUp: any) => {
    setFormData({
      clientId: followUp.clientId.toString(), type: followUp.type,
      date: followUp.date, time: followUp.time, notes: followUp.notes
    });
    setEditingFollowUp(followUp);
    setShowModal(true);
  };

  const handleComplete = (id: number) => {
    const outcome = prompt('Enter outcome of this follow-up:');
    if (outcome !== null) {
      setFollowUps(followUps.map(f => f.id === id ? { ...f, status: 'completed', outcome } : f));
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this follow-up?')) setFollowUps(followUps.filter(f => f.id !== id));
  };

  const getTypeInfo = (type: string) => followUpTypes.find(t => t.id === type) || followUpTypes[0];

  const FollowUpCard = ({ followUp, showDate = false }: { followUp: any, showDate?: boolean }) => {
    const typeInfo = getTypeInfo(followUp.type);
    const TypeIcon = typeInfo.icon;
    const isOverdue = followUp.date < today && followUp.status === 'pending';

    return (
      <div className={`bg-white rounded-xl shadow-sm border p-4 ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
            <TypeIcon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{followUp.clientName}</h3>
              {followUp.status === 'completed' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Completed</span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{followUp.notes}</p>
            {followUp.outcome && (
              <p className="text-sm text-green-600 mt-1 italic">Outcome: {followUp.outcome}</p>
            )}
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
          {followUp.status === 'pending' && (
            <div className="flex flex-col gap-1">
              <button onClick={() => handleComplete(followUp.id)}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Mark Complete">
                <CheckCircle size={18} />
              </button>
              <button onClick={() => handleEdit(followUp)}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="Edit">
                <Edit size={18} />
              </button>
              <button onClick={() => handleDelete(followUp.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-gray-600">{completedFollowUps.length}</p>
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
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
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
            {overdueFollowUps.map(f => <FollowUpCard key={f.id} followUp={f} showDate />)}
          </div>
        </div>
      )}

      {/* Today Section */}
      {todayFollowUps.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <h2 className="font-semibold text-blue-900 mb-3">Today ({todayFollowUps.length})</h2>
          <div className="space-y-3">
            {todayFollowUps.map(f => <FollowUpCard key={f.id} followUp={f} />)}
          </div>
        </div>
      )}

      {/* Upcoming Section */}
      {upcomingFollowUps.length > 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <h2 className="font-semibold text-green-900 mb-3">Upcoming ({upcomingFollowUps.length})</h2>
          <div className="space-y-3">
            {upcomingFollowUps.map(f => <FollowUpCard key={f.id} followUp={f} showDate />)}
          </div>
        </div>
      )}

      {/* Completed Section */}
      {statusFilter !== 'pending' && completedFollowUps.length > 0 && (
        <div className="bg-gray-50 rounded-xl border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Completed ({completedFollowUps.length})</h2>
          <div className="space-y-3">
            {completedFollowUps.slice(0, 5).map(f => <FollowUpCard key={f.id} followUp={f} showDate />)}
          </div>
        </div>
      )}

      {filteredFollowUps.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No follow-ups found</h3>
          <p className="mt-1 text-gray-500">Schedule follow-ups to stay connected with clients</p>
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
                  className="w-full px-3 py-2.5 border rounded-lg">
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg">
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
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  {editingFollowUp ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
