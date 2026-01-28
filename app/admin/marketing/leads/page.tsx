'use client';

import { useState, useEffect } from 'react';
import {
    Search, Plus, Phone, Mail, Calendar,
    Edit, Trash2, Eye, X, ArrowLeft, User,
    MessageSquare, IndianRupee, CheckCircle,
    Loader2, AlertCircle, Clock
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLeads, useFollowUps } from '@/lib/hooks';
import { Lead } from '@/types/database';
import { formatDate } from '@/lib/utils';

export default function LeadsPage() {
    const { user, profile } = useAuth();
    const { leads, loading: leadsLoading, createLead, updateLead, deleteLead, refetch, convertToClient } = useLeads();
    const { createFollowUp } = useFollowUps();

    // State Management
    const [searchQuery, setSearchQuery] = useState('');
    // ... (rest of state)

    const handleMoveToFollowUp = async (lead: Lead) => {
        if (!confirm(`Move "${lead.name}" to Follow-ups?`)) return;
        try {
            // 1. Create Follow-up Entry
            const { error } = await createFollowUp({
                lead_id: lead.id,
                follow_up_date: new Date().toISOString().split('T')[0],
                notes: `Moved from Leads list. Requirement: ${lead.requirement || 'N/A'}`,
                status: 'pending'
            });

            if (error) throw new Error(error);

            // 2. Update Status
            await updateLead(lead.id, { status: 'follow_up' });

            await refetch();
            alert('Moved to Follow-ups successfully');
        } catch (e: any) {
            console.error(e);
            alert('Operation failed: ' + e.message);
        }
    };

    const handleConvertToClient = async (lead: Lead) => {
        if (!confirm(`Convert "${lead.name}" to Client?`)) return;
        try {
            const currentUserId = profile?.id || user?.id;
            if (!currentUserId) { alert('User not authenticated'); return; }

            const res = await convertToClient(lead.id, currentUserId);
            if (res.error) throw new Error(res.error);

            await refetch();
            alert(`Converted ${lead.name} to Client! You can now manage them in CRM > Clients.`);
        } catch (e: any) {
            console.error(e);
            alert('Conversion failed: ' + e.message);
        }
    };

    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
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
        leadDate: '',
    });

    // --- ACTIONS ---

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
            nextFollowUp: '',
            notes: '',
            leadDate: new Date().toLocaleDateString('en-CA'), // Local YYYY-MM-DD
        });
        setIsEditing(false);
        setShowModal(true);
    };

    const handleEdit = (lead: Lead) => {
        setFormData({
            name: lead.name,
            company: lead.company || '',
            email: lead.email || '',
            phone: lead.phone || '',
            source: lead.source as any,
            status: lead.status as any,
            value: lead.expected_value?.toString() || '',
            leadType: (lead.lead_type as any) || 'printing_only',
            billingPreference: (lead.billing_preference as any) || 'gst',
            lostReason: lead.lost_reason || '',
            requirement: lead.requirement || '',
            nextFollowUp: lead.next_follow_up || '',
            notes: lead.notes || '',
            leadDate: lead.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : '',
        });
        setSelectedLead(lead);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete lead "${name}"?`)) return;
        try {
            await deleteLead(id);
            await refetch();
        } catch (e) {
            alert('Failed to delete lead');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // 1. Auth Check - ROBUST FALLBACK
            const currentUserId = profile?.id || user?.id;

            if (!currentUserId) {
                throw new Error('You appear to be logged out. Please refresh the page.');
            }

            console.log('Saving Lead for User:', currentUserId);

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
                next_follow_up:
                    ['follow_up', 'new', 'contacted'].includes(formData.status)
                        ? (formData.nextFollowUp || undefined)
                        : undefined,
                notes: formData.notes
            };

            // 2. Perform Save
            let result;
            if (isEditing && selectedLead) {
                result = await updateLead(selectedLead.id, payload);
            } else {
                // Determine Creation Date
                // If user selected TODAY, send undefined so DB uses NOW() (preserving time).
                // If user selected Backdate, send that date (Time will be 00:00).
                const todayStr = new Date().toLocaleDateString('en-CA');
                const isBackdated = formData.leadDate && formData.leadDate !== todayStr;
                const creationDate = isBackdated ? new Date(formData.leadDate).toISOString() : undefined;

                result = await createLead({
                    ...payload,
                    created_by: currentUserId,
                    assigned_to: currentUserId,
                    created_at: creationDate
                });
            }

            if (result.error) throw new Error(result.error);

            // 3. Success & Refresh
            alert(isEditing ? 'Lead updated successfully!' : 'Lead created successfully!');
            setShowModal(false);

            // FORCE REFRESH THE LIST
            await refetch();

        } catch (error: any) {
            console.error('Save Error:', error);
            alert(error.message || 'Failed to save lead. Please check your connection.');
        } finally {
            setSubmitting(false);
        }
    };



    // --- FILTERING ---

    const filteredLeads = leads.filter(lead => {
        const s = searchQuery.toLowerCase();
        const matchSearch =
            lead.name.toLowerCase().includes(s) ||
            (lead.company || '').toLowerCase().includes(s) ||
            lead.phone?.includes(s) ||
            (lead.lead_number || '').toLowerCase().includes(s);

        const matchStatus = statusFilter === 'all' || lead.status === statusFilter;
        return matchSearch && matchStatus;
    });

    // --- RENDER ---

    if (leadsLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
                <span className="ml-3 text-gray-500 font-medium">Loading leads...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 pb-12 md:pb-20 animate-fade-in text-sm lg:text-base px-3 md:px-0">

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">Leads & Enquiries (Marketing)</h1>
                    <p className="text-gray-500 text-xs md:text-sm">Manage potential clients and follow-ups</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 text-sm md:text-base"
                >
                    <Plus size={16} className="md:hidden" />
                    <Plus size={18} className="hidden md:block" />
                    <span>New Lead</span>
                </button>
            </div>

            {/* FILTERS */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 bg-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-sm border border-gray-100">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search name, phone, company..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 md:pl-11 pr-3 md:pr-4 py-2 md:py-2.5 bg-gray-50 border-0 rounded-lg md:rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-sm md:text-base text-gray-900 placeholder-gray-400"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 md:px-4 py-2 md:py-2.5 bg-gray-50 border-0 rounded-lg md:rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium text-sm md:text-base text-gray-700 cursor-pointer"
                >
                    <option value="all">All Status</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="quotation_shared">Quotation Sent</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                </select>
            </div>

            {/* LEAD LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {filteredLeads.length === 0 ? (
                    <div className="col-span-full py-8 md:py-12 text-center text-sm md:text-base text-gray-400 bg-gray-50 rounded-xl md:rounded-2xl border-2 border-dashed border-gray-200">
                        No leads found matching your search.
                        <br /><span className="text-xs text-gray-300">If you just added a lead, try refreshing the page manually.</span>
                    </div>
                ) : (
                    filteredLeads.map((lead) => (
                        <div key={lead.id} className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative overflow-hidden">
                            {/* Status Strip */}
                            <div className={`absolute top-0 left-0 w-1.5 h-full 
                 ${lead.status === 'new' ? 'bg-blue-500' :
                                    lead.status === 'converted' ? 'bg-green-500' :
                                        lead.status === 'lost' ? 'bg-red-400' : 'bg-indigo-500'}`}
                            />

                            <div className="pl-3">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-xs font-mono font-bold text-gray-600">
                                                {lead.lead_number}
                                            </span>
                                            {/* Owner Tag - visible for admin */}
                                            {profile?.role === 'admin' && lead.assigned_user && (
                                                <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">
                                                    👤 {lead.assigned_user.full_name || 'Unassigned'}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{lead.name}</h3>
                                        {lead.company && <p className="text-gray-500 text-sm font-medium">{lead.company}</p>}

                                        {/* Project Type Badge */}
                                        {lead.project_type && (
                                            <div className="mt-2">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${lead.project_type === 'print' ? 'bg-purple-100 text-purple-700' :
                                                    lead.project_type === 'design' ? 'bg-pink-100 text-pink-700' :
                                                        'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                    {lead.project_type === 'print' ? '🖨️ Print Only' :
                                                        lead.project_type === 'design' ? '🎨 Design Only' :
                                                            '✨ Design + Print'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setSelectedLead(lead); setShowViewModal(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                            <Eye size={18} />
                                        </button>
                                        <button onClick={() => handleEdit(lead)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(lead.id, lead.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Project Details Summary */}
                                {(lead.quantity || lead.estimated_amount || lead.deadline) && (
                                    <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                                        {lead.quantity && (
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500 font-medium">Qty</p>
                                                <p className="text-sm font-bold text-gray-900">{lead.quantity.toLocaleString()}</p>
                                            </div>
                                        )}
                                        {lead.estimated_amount && (
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500 font-medium">Amount</p>
                                                <p className="text-sm font-bold text-green-600">₹{lead.estimated_amount.toLocaleString()}</p>
                                            </div>
                                        )}
                                        {lead.deadline && (
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500 font-medium">Deadline</p>
                                                <p className="text-xs font-bold text-gray-900">{formatDate(lead.deadline)}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2 mt-4">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                                            <Phone size={14} />
                                        </div>
                                        <span className="font-medium">{lead.phone}</span>
                                    </div>

                                    {lead.next_follow_up && (
                                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                                            <Clock size={14} />
                                            <span className="text-xs font-bold">Follow up: {formatDate(lead.next_follow_up)}</span>
                                        </div>
                                    )}

                                    {lead.requirement && (
                                        <p className="text-sm text-gray-500 line-clamp-2 bg-gray-50 p-2 rounded-lg italic">
                                            &quot;{lead.requirement}&quot;
                                        </p>
                                    )}
                                </div>

                                {/* Action Footer */}
                                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${lead.status === 'converted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {lead.status.replace('_', ' ')}
                                    </span>

                                    {lead.status !== 'converted' && lead.status !== 'follow_up' && (
                                        <button
                                            onClick={() => handleMoveToFollowUp(lead)}
                                            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                        >
                                            <CheckCircle size={14} /> Move to Follow-up
                                        </button>
                                    )}

                                    {/* Convert button removed to enforce workflow hierarchy */}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* EDIT/CREATE MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="sticky top-0 bg-white p-5 border-b border-gray-100 flex justify-between items-center z-10">
                            <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit Lead' : 'New Lead Card'}</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Mandatory Section */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Lead Name *</label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Mobile Number *</label>
                                    <input required type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium font-mono" />
                                </div>
                            </div>

                            {/* Date & Source */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Entry Date</label>
                                    <input
                                        type="date"
                                        value={formData.leadDate}
                                        onChange={(e) => setFormData({ ...formData, leadDate: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    />
                                    <p className="text-xs text-gray-400 mt-1 ml-1">Example: &quot;When Lead Created&quot;</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Source</label>
                                    <select value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value as any })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
                                        <option value="website">Website</option>
                                        <option value="walk_in">Walk-in</option>
                                        <option value="referral">Referral</option>
                                        <option value="social_media">Social Media</option>
                                        <option value="cold_call">Cold Call</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Service Req.</label>
                                    <select value={formData.leadType} onChange={e => setFormData({ ...formData, leadType: e.target.value as any })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
                                        <option value="printing_only">Printing Only</option>
                                        <option value="designing_only">Designing Only</option>
                                        <option value="design_printing">Design + Printing</option>
                                    </select>
                                </div>
                            </div>

                            {/* Status Section */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Current Status</label>
                                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium">
                                        <option value="new">New Lead</option>
                                        <option value="contacted">Contacted</option>
                                        <option value="quotation_shared">Quotation Sent</option>
                                        <option value="follow_up">Needs Follow Up</option>
                                        <option value="converted">Converted (Won)</option>
                                        <option value="lost">Lost</option>
                                    </select>
                                </div>
                                {['new', 'contacted', 'follow_up'].includes(formData.status) && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Next Follow-up</label>
                                        <input type="date" value={formData.nextFollowUp} onChange={e => setFormData({ ...formData, nextFollowUp: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                    </div>
                                )}
                            </div>

                            {/* Optional Details */}
                            <div className="border-t border-gray-100 pt-4 space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Additional Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <input type="text" placeholder="Company Name (Optional)" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} className="border-b border-gray-200 py-2 focus:border-indigo-500 focus:outline-none bg-transparent placeholder-gray-400" />
                                    <input type="email" placeholder="Email Address (Optional)" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="border-b border-gray-200 py-2 focus:border-indigo-500 focus:outline-none bg-transparent placeholder-gray-400" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <select value={formData.billingPreference} onChange={e => setFormData({ ...formData, billingPreference: e.target.value as any })} className="border-b border-gray-200 py-2 focus:border-indigo-500 focus:outline-none bg-transparent text-gray-600">
                                        <option value="gst">GST Invoice</option>
                                        <option value="non_gst">Cash / Estimates</option>
                                        <option value="both">Both</option>
                                    </select>
                                    <input type="number" placeholder="Expected Value (₹)" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} className="border-b border-gray-200 py-2 focus:border-indigo-500 focus:outline-none bg-transparent placeholder-gray-400" />
                                </div>
                                <textarea placeholder="Requirement details / Notes..." rows={3} value={formData.requirement} onChange={e => setFormData({ ...formData, requirement: e.target.value })} className="w-full p-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none"></textarea>
                            </div>

                            <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-100 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {submitting && <Loader2 className="animate-spin" size={18} />}
                                    {submitting ? 'Saving...' : 'Save Lead'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VIEW MODAL - Simplified for read-only view */}
            {showViewModal && selectedLead && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative shadow-2xl">
                        <button onClick={() => setShowViewModal(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full"><X size={18} /></button>
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedLead.name}</h2>
                        <p className="text-gray-500 font-mono text-sm mb-6">{selectedLead.lead_number}</p>

                        <div className="space-y-4">
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Phone</span> <span className="font-medium font-mono">{selectedLead.phone}</span></div>
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Company</span> <span className="font-medium">{selectedLead.company || '-'}</span></div>
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Status</span> <span className="font-bold capitalize text-indigo-600">{selectedLead.status}</span></div>

                            <div className="bg-gray-50 p-4 rounded-xl mt-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Requirement</h4>
                                <p className="text-gray-700 italic">{selectedLead.requirement || 'No notes provided.'}</p>
                            </div>
                        </div>

                        <button onClick={() => { setShowViewModal(false); handleEdit(selectedLead); }} className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700">Edit Details</button>
                    </div>
                </div>
            )}
        </div>
    );
}
