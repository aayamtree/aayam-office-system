'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Phone, Mail, Calendar,
  Edit, Trash2, Eye, X, ArrowLeft, User, MessageSquare, IndianRupee,
  CheckCircle, Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLeads } from '@/lib/hooks';
import { Lead } from '@/types/database';

export default function LeadsPage() {
  const { user, profile } = useAuth();
  const { leads, loading: leadsLoading, createLead, updateLead, convertToClient, deleteLead } = useLeads();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    source: 'website',
    status: 'new' as Lead['status'],
    value: '',
    requirement: '',
    nextFollowUp: '',
    notes: '',
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete lead "${name}"? This cannot be undone.`)) {
      await deleteLead(id);
    }
  };

  const sources = [
    { value: 'website', label: 'Website' },
    { value: 'indiamart', label: 'IndiaMart' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'referral', label: 'Referral' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'social_media', label: 'Other Social Media' },
    { value: 'advertisement', label: 'Advertisement' },
    { value: 'cold_call', label: 'Cold Call' },
    { value: 'other', label: 'Other' }
  ];

  const statuses = [
    { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
    { value: 'contacted', label: 'Contacted', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-700' },
    { value: 'proposal', label: 'Proposal Sent', color: 'bg-amber-100 text-amber-700' },
    { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
    { value: 'won', label: 'Won', color: 'bg-green-100 text-green-700' },
    { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const filteredLeads = leads.filter(lead => {
    // Permission Filter: Marketing users see only their own leads
    if (profile?.role === 'marketing') {
      const isOwner = lead.created_by === profile.id || lead.assigned_to === profile.id;
      if (!isOwner) return false;
    }

    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddNew = () => {
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      source: 'website',
      status: 'new',
      value: '', // Input as string for easier editing, convert to number on submit
      requirement: '',
      nextFollowUp: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (lead: Lead) => {
    setFormData({
      name: lead.name,
      company: lead.company || '',
      email: lead.email || '',
      phone: lead.phone,
      source: lead.source,
      status: lead.status,
      value: lead.expected_value?.toString() || '',
      requirement: lead.requirement || '',
      nextFollowUp: lead.next_follow_up ? new Date(lead.next_follow_up).toISOString().split('T')[0] : '',
      notes: lead.notes || '',
    });
    setSelectedLead(lead);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        source: formData.source as any,
        status: formData.status as any,
        expected_value: parseFloat(formData.value) || 0,
        requirement: formData.requirement,
        next_follow_up: formData.nextFollowUp || undefined,
        notes: formData.notes
      };

      if (isEditing && selectedLead) {
        await updateLead(selectedLead.id, payload);
      } else {
        await createLead(payload);
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to save lead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertToClient = async (lead: Lead) => {
    if (!confirm(`Are you sure you want to convert "${lead.name}" to a Client? This will mark the lead as Won.`)) return;

    try {
      const { error } = await convertToClient(lead.id);
      if (error) throw new Error(error);
      alert('Lead converted to Client successfully!');
      setShowViewModal(false);
    } catch (error) {
      console.error('Error converting lead:', error);
      alert('Failed to convert lead');
    }
  };

  const getStatusColor = (status: string) => {
    const s = statuses.find(s => s.value === status);
    return s ? s.color : 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/sales" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500">{filteredLeads.length} leads found</p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'New', value: 'new', color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Qualified', value: 'qualified', color: 'text-purple-700 bg-purple-50 border-purple-200' },
          { label: 'In Negotiation', value: 'negotiation', color: 'text-orange-700 bg-orange-50 border-orange-200' },
          { label: 'Won', value: 'won', color: 'text-green-700 bg-green-50 border-green-200' },
        ].map((stat) => (
          <div key={stat.value} className={`border rounded-xl p-3 text-center ${stat.color}`}>
            <p className="text-2xl font-bold">{leads.filter(l => l.status === stat.value).length}</p>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads by name, company, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Status</option>
          {statuses.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Leads List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {leadsLoading ? (
          <div className="p-12 text-center text-gray-500">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No leads found.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Lead</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Requirement</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Follow-up</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {lead.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{lead.name}</p>
                        <p className="text-sm text-gray-500">{lead.company}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900 max-w-xs truncate">{lead.requirement || '-'}</p>
                    <p className="text-xs text-gray-400 capitalize">{lead.source.replace('_', ' ')}</p>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">{formatCurrency(lead.expected_value)}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(lead.status)}`}>
                      {statuses.find(s => s.value === lead.status)?.label || lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleConvertToClient(lead)} className="p-2 hover:bg-green-50 rounded-lg text-green-600" title="Convert to Client">
                        <CheckCircle size={18} />
                      </button>
                      <button onClick={() => { setSelectedLead(lead); setShowViewModal(true); }} className="p-2 hover:bg-gray-100 rounded-lg" title="View">
                        <Eye size={18} className="text-gray-500" />
                      </button>
                      <button onClick={() => handleEdit(lead)} className="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                        <Edit size={18} className="text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(lead.id, lead.name)} className="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 size={18} className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Edit Lead' : 'Add New Lead'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {sources.map(src => (
                      <option key={src.value} value={src.value}>{src.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {statuses.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expected Value (₹)</label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Next Follow-up</label>
                  <input
                    type="date"
                    value={formData.nextFollowUp}
                    onChange={(e) => setFormData({ ...formData, nextFollowUp: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Requirement</label>
                <textarea
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="What does the client need?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Additional conversation notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (isEditing ? 'Update Lead' : 'Add Lead')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Lead Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User size={32} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedLead.name}</h3>
                  <p className="text-gray-500 font-medium">{selectedLead.company}</p>
                  <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedLead.status)}`}>
                    {statuses.find(s => s.value === selectedLead.status)?.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Expected Value</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedLead.expected_value)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Source</p>
                  <p className="text-lg font-bold text-gray-900 capitalize">{selectedLead.source.replace('_', ' ')}</p>
                </div>
              </div>

              {(selectedLead.next_follow_up) && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3">
                  <Calendar className="text-amber-600" />
                  <div>
                    <p className="text-xs text-amber-600 font-bold uppercase">Next Follow-up</p>
                    <p className="font-bold text-amber-900">{new Date(selectedLead.next_follow_up).toLocaleDateString()}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Requirement</p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700">
                  {selectedLead.requirement || 'No requirements specified.'}
                </div>
              </div>

              {(selectedLead.phone || selectedLead.email) && (
                <div className="space-y-3">
                  {selectedLead.phone && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
                      <Phone size={18} className="text-gray-400" />
                      <a href={`tel:${selectedLead.phone}`} className="text-indigo-600 font-medium hover:text-indigo-800">{selectedLead.phone}</a>
                    </div>
                  )}
                  {selectedLead.email && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors">
                      <Mail size={18} className="text-gray-400" />
                      <a href={`mailto:${selectedLead.email}`} className="text-indigo-600 font-medium hover:text-indigo-800">{selectedLead.email}</a>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(selectedLead);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Edit Details
                </button>
                {selectedLead.status !== 'won' && (
                  <button
                    onClick={() => handleConvertToClient(selectedLead)}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                  >
                    Convert to Client
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
