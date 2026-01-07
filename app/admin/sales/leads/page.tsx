'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Phone, Mail, Calendar,
  Edit, Trash2, Eye, X, ArrowLeft, User, MessageSquare, IndianRupee,
  CheckCircle, Loader2, AlertCircle, Clock
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLeads } from '@/lib/hooks';
import { Lead } from '@/types/database';

export default function LeadsPage() {
  const { user, profile } = useAuth();
  const { leads: allLeads, loading: leadsLoading, createLead, updateLead, convertToClient, deleteLead } = useLeads();

  const leads = allLeads.filter(lead => {
    // Permission Filter: Marketing users see only their own leads
    if (profile?.role === 'marketing') {
      return lead.created_by === profile.id || lead.assigned_to === profile.id;
    }
    return true;
  });

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
    source: 'website' as Lead['source'],
    status: 'new' as Lead['status'],
    value: '',
    leadType: 'printing_only' as Lead['lead_type'],
    billingPreference: 'gst' as Lead['billing_preference'],
    lostReason: '',
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
    { value: 'new', label: 'New Lead', color: 'bg-blue-100 text-blue-700' },
    { value: 'contacted', label: 'Contacted', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'quotation_shared', label: 'Quotation Shared', color: 'bg-purple-100 text-purple-700' },
    { value: 'follow_up', label: 'Follow-Up Required', color: 'bg-amber-100 text-amber-700' },
    { value: 'converted', label: 'Converted', color: 'bg-green-100 text-green-700' },
    { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
  ];

  const leadTypes = [
    { value: 'printing_only', label: 'Printing Only' },
    { value: 'designing_only', label: 'Designing Only' },
    { value: 'design_printing', label: 'Design + Printing' },
  ];

  const billingPreferences = [
    { value: 'gst', label: 'GST' },
    { value: 'non_gst', label: 'Cash' },
    { value: 'both', label: 'Both' },
  ];

  const lostReasons = [
    'Service not offered',
    'Price not acceptable',
    'Timeline not possible',
    'Client not interested',
    'Wrong / Junk lead',
    'Other'
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const filteredLeads = leads.filter(lead => {
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
      value: '',
      leadType: 'printing_only',
      billingPreference: 'gst',
      lostReason: '',
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
      leadType: lead.lead_type || 'printing_only',
      billingPreference: lead.billing_preference || 'gst',
      lostReason: lead.lost_reason || '',
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
      // Validations
      if (formData.status === 'lost' && !formData.lostReason) {
        alert('Please specify a Reason for marking this lead as Lost.');
        setSubmitting(false);
        return;
      }

      if (formData.status === 'follow_up' && !formData.nextFollowUp) {
        alert('Next Follow-up date is mandatory when status is Follow-Up Required.');
        setSubmitting(false);
        return;
      }

      const payload = {
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        source: formData.source,
        status: formData.status,
        lead_type: formData.leadType,
        billing_preference: formData.billingPreference,
        lost_reason: formData.status === 'lost' ? formData.lostReason : undefined,
        expected_value: parseFloat(formData.value) || 0,
        requirement: formData.requirement,
        next_follow_up: formData.status === 'follow_up' || formData.status === 'new' || formData.status === 'contacted' ? (formData.nextFollowUp || undefined) : undefined,
        notes: formData.notes
      };

      if (isEditing && selectedLead) {
        await updateLead(selectedLead.id, payload);
      } else {
        // Fallback to user.id if profile.id is missing
        const userId = profile?.id || user?.id;

        if (!userId) {
          alert('Authentication Error: You appear to be logged out. Please refresh the page or login again.');
          setSubmitting(false);
          return;
        }

        console.log('Creating Lead with User:', userId); // Debug

        await createLead({
          ...payload,
          created_by: userId,
          assigned_to: userId
        });
      }
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving lead:', error);
      alert(`Failed to save lead: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertToClient = async (lead: Lead) => {
    if (!confirm(`Are you sure you want to convert "${lead.name}" to a Client? This will mark the lead as Converted.`)) return;

    try {
      // First convert to client
      const { error } = await convertToClient(lead.id);
      if (error) throw new Error(error);

      // Update status to 'converted' specifically (convertToClient might set it to 'won', we align it)
      await updateLead(lead.id, { status: 'converted' });

      alert('Lead converted successfully!');
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
          { label: 'Follow-Ups', value: 'follow_up', color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { label: 'Lost', value: 'lost', color: 'text-red-700 bg-red-50 border-red-200' },
          { label: 'Converted', value: 'converted', color: 'text-green-700 bg-green-50 border-green-200' },
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
                    <p className="text-sm text-gray-900 max-w-xs truncate">{lead.lead_type ? leadTypes.find(t => t.value === lead.lead_type)?.label : (lead.requirement || '-')}</p>
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
                      {lead.status !== 'converted' && lead.status !== 'lost' && (
                        <button onClick={() => handleConvertToClient(lead)} className="p-2 hover:bg-green-50 rounded-lg text-green-600" title="Convert to Client">
                          <CheckCircle size={18} />
                        </button>
                      )}
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

      {/* Add/Edit Modal (Lead Card) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Edit Lead Card' : 'New Lead Card'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Mandatory Information */}
              <div className="bg-indigo-50 p-4 rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Mandatory Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lead Name *</label>
                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mobile Number *</label>
                    <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lead Source *</label>
                    <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value as any })} className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      {sources.map(src => <option key={src.value} value={src.value}>{src.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Req. *</label>
                    <select value={formData.leadType || 'printing_only'} onChange={(e) => setFormData({ ...formData, leadType: e.target.value as any })} className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      {leadTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Status and Follow-up */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                {/* Conditional Lost Reason */}
                {formData.status === 'lost' && (
                  <div>
                    <label className="block text-sm font-bold text-red-600 mb-1.5">Lost Reason *</label>
                    <select
                      value={formData.lostReason}
                      onChange={(e) => setFormData({ ...formData, lostReason: e.target.value })}
                      className="w-full px-4 py-2.5 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50"
                      required
                    >
                      <option value="">Select Reason</option>
                      {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
                {/* Conditional Follow Up Date */}
                {(formData.status !== 'lost' && formData.status !== 'converted') && (
                  <div className={formData.status === 'follow_up' ? 'ring-2 ring-amber-400 rounded-xl' : ''}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 px-1">{formData.status === 'follow_up' ? 'Next Follow-up Date *' : 'Next Follow-up Date'}</label>
                    <input
                      type="date"
                      value={formData.nextFollowUp}
                      onChange={(e) => setFormData({ ...formData, nextFollowUp: e.target.value })}
                      required={formData.status === 'follow_up'}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Other Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Billing Pref.</label>
                  <select value={formData.billingPreference || 'gst'} onChange={(e) => setFormData({ ...formData, billingPreference: e.target.value as any })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    {billingPreferences.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expected Value (₹)</label>
                  <input type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company / Email (Optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Company Name" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg" />
                  <input type="email" placeholder="Email Address" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Requirement / Notes</label>
                <textarea
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Details about client needs..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50">
                  {submitting ? 'Saving...' : (isEditing ? 'Update Card' : 'Save Card')}
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
              <h2 className="text-xl font-bold text-gray-900">Lead Card</h2>
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
                  <div className="flex gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border bg-gray-50 text-gray-600`}>
                      {leadTypes.find(t => t.value === selectedLead.lead_type)?.label || 'Unspecified'}
                    </span>
                    <span className={`px-3 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(selectedLead.status)}`}>
                      {statuses.find(s => s.value === selectedLead.status)?.label}
                    </span>
                  </div>
                </div>
              </div>

              {selectedLead.status === 'lost' && selectedLead.lost_reason && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs font-bold text-red-600 uppercase">Lost Reason</p>
                  <p className="text-red-900 font-medium">{selectedLead.lost_reason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Value</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedLead.expected_value)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Billing</p>
                  <p className="text-lg font-bold text-gray-900 capitalize">{selectedLead.billing_preference?.replace('_', ' ') || '-'}</p>
                </div>
              </div>

              {(selectedLead.next_follow_up) && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3">
                  <Calendar className="text-amber-600" />
                  <div>
                    <p className="text-xs text-amber-600 font-bold uppercase">Next Follow-up</p>
                    <p className="font-bold text-amber-900">{new Date(selectedLead.next_follow_up).toLocaleDateString()}</p>
                  </div>
                  {/* Logic for Overdue could go here */}
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Requirement / Notes</p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 whitespace-pre-wrap">
                  {selectedLead.requirement || 'No notes.'}
                </div>
              </div>

              <div className="flex gap-2">
                {selectedLead.phone && (
                  <a href={`tel:${selectedLead.phone}`} className="flex-1 py-2 text-center border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 font-medium">
                    <Phone size={16} /> Call
                  </a>
                )}
                {selectedLead.phone && (
                  <a href={`https://wa.me/91${selectedLead.phone.replace(/\D/g, '')}`} target="_blank" className="flex-1 py-2 text-center border rounded-lg hover:bg-green-50 text-green-700 border-green-200 flex items-center justify-center gap-2 font-medium">
                    <MessageSquare size={16} /> WhatsApp
                  </a>
                )}
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedLead); }} className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  Edit Card
                </button>
                {selectedLead.status !== 'converted' && selectedLead.status !== 'lost' && (
                  <button onClick={() => handleConvertToClient(selectedLead)} className="flex-1 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
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
