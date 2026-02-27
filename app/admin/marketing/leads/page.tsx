'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import {
    Search, Plus, Phone, Mail, Calendar,
    Edit, Trash2, Eye, X, ArrowLeft, User,
    MessageSquare, IndianRupee, CheckCircle,
    Loader2, AlertCircle, Clock
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLeads, useFollowUps } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Lead } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';

export default function LeadsPage() {
    const { user, profile } = useAuth();
    const { leads, loading: leadsLoading, createLead, updateLead, deleteLead, refetch, convertToClient } = useLeads();
    const { createFollowUp } = useFollowUps();
    const confirm = useConfirm();

    // State Management
    const [searchQuery, setSearchQuery] = useState('');
    // ... (rest of state)

    const handleMoveToFollowUp = async (lead: Lead) => {
        const { confirmed } = await confirm({ title: 'Move to Follow-ups', message: `Move "${lead.name}" to Follow-ups?`, confirmLabel: 'Move' });
        if (!confirmed) return;
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
            toast.success('Moved to Follow-ups successfully');
        } catch (e: any) {
            console.error(e);
            toast.error(String('Operation failed: ' + e.message));
        }
    };

    const handleConvertToClient = async (lead: Lead) => {
        const { confirmed: convertConfirmed } = await confirm({ title: 'Convert to Client', message: `Convert "${lead.name}" to Client?`, confirmLabel: 'Convert' });
        if (!convertConfirmed) return;
        try {
            const currentUserId = profile?.id || user?.id;
            if (!currentUserId) { toast.info('User not authenticated'); return; }

            const res = await convertToClient(lead.id, currentUserId);
            if (res.error) throw new Error(res.error);

            await refetch();
            toast.info(`Converted ${lead.name} to Client! You can now manage them in CRM > Clients.`);
        } catch (e: any) {
            console.error(e);
            toast.error(String('Conversion failed: ' + e.message));
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
        assignedTo: '',
    });

    // Fetch staff list for assignment dropdown (admin) and origin badges (all users)
    const [staffList, setStaffList] = useState<{ id: string, full_name: string, role: string }[]>([]);
    useEffect(() => {
        supabase.from('profiles')
            .select('id, full_name, role')
            .in('role', ['marketing', 'admin'])
            .eq('is_active', true)
            .then(({ data }) => {
                if (data) setStaffList(data);
            });
    }, []);

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
            assignedTo: user?.id || '',
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
            assignedTo: lead.assigned_to || user?.id || '',
        });
        setSelectedLead(lead);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id: string, name: string) => {
        const { confirmed: deleteConfirmed } = await confirm({ title: 'Delete Lead', message: `Delete lead "${name}"?`, variant: 'danger', confirmLabel: 'Delete' });
        if (!deleteConfirmed) return;
        try {
            await deleteLead(id);
            await refetch();
        } catch (e) {
            toast.error('Failed to delete lead');
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

            const rawPayload: Record<string, any> = {
                name: formData.name,
                company: formData.company || undefined,
                email: formData.email || undefined,
                phone: formData.phone,
                source: formData.source,
                status: formData.status,
                lead_type: formData.leadType || undefined,
                billing_preference: formData.billingPreference || undefined,
                lost_reason: formData.status === 'lost' ? formData.lostReason : undefined,
                expected_value: parseFloat(formData.value) || 0,
                requirement: formData.requirement || undefined,
                next_follow_up:
                    ['follow_up', 'new', 'contacted'].includes(formData.status)
                        ? (formData.nextFollowUp || undefined)
                        : undefined,
                notes: formData.notes || undefined
            };

            // Remove undefined values to avoid sending non-existent columns
            const payload = Object.fromEntries(
                Object.entries(rawPayload).filter(([, v]) => v !== undefined)
            );

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
                    assigned_to: (profile?.role === 'admin' && formData.assignedTo) ? formData.assignedTo : currentUserId,
                    created_at: creationDate
                } as any);
            }

            // If editing and admin changed assignment, update assigned_to
            if (isEditing && profile?.role === 'admin' && formData.assignedTo) {
                await updateLead(selectedLead!.id, { assigned_to: formData.assignedTo });
            }

            if (result.error) throw new Error(result.error);

            // 3. Success & Refresh
            toast.error(String(isEditing ? 'Lead updated successfully!' : 'Lead created successfully!'));
            setShowModal(false);

            // FORCE REFRESH THE LIST
            await refetch();

        } catch (error: any) {
            console.error('Save Error:', error);
            toast.error(String(error.message || 'Failed to save lead. Please check your connection.'));
        } finally {
            setSubmitting(false);
        }
    };



    // --- FILTERING ---

    const filteredLeads = leads.filter(lead => {
        const s = searchQuery.toLowerCase();
        const matchSearch =
            (lead.name || '').toLowerCase().includes(s) ||
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
                <Loader2 className="animate-spin text-gray-900 w-6 h-6" />
                <span className="ml-3 text-gray-500 font-medium">Loading leads...</span>
            </div>
        );
    }

    // Stat counts
    const totalLeads = leads.length;
    const followUpCount = leads.filter(l => l.status === 'follow_up').length;
    const convertedCount = leads.filter(l => l.status === 'converted').length;
    const lostCount = leads.filter(l => l.status === 'lost').length;

    return (
        <div className="space-y-2 md:space-y-4 lg:space-y-3 px-2 pb-12 md:pb-20 animate-fade-in">

            {/* HEADER */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-page-title text-gray-900">Leads</h1>
                    <p className="text-gray-500 text-xs md:text-sm">{filteredLeads.length} leads in system</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md font-semibold transition-all text-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Lead</span>
                </button>
            </div>

            {/* STAT CARDS — Job Queue style */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                <div className="bg-gray-900 border border-gray-800 rounded-md p-2 md:p-3">
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <User className="w-4 h-4 text-white" />
                        <span className="text-xs text-white font-medium">Total Leads</span>
                    </div>
                    <p className="text-page-title text-white">{totalLeads}</p>
                </div>
                <div className="bg-muted border border-border rounded-md p-2 md:p-3">
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <Clock className="w-4 h-4 text-foreground" />
                        <span className="text-xs text-foreground font-medium">Follow-ups</span>
                    </div>
                    <p className="text-page-title text-foreground">{followUpCount}</p>
                </div>
                <div className="bg-white border border-gray-300 rounded-md p-2 md:p-3">
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-gray-900" />
                        <span className="text-xs text-gray-900 font-medium">Converted</span>
                    </div>
                    <p className="text-page-title text-gray-900">{convertedCount}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-md p-2 md:p-3">
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-xs text-red-600 font-medium">Lost</span>
                    </div>
                    <p className="text-page-title text-red-700">{lostCount}</p>
                </div>
            </div>

            {/* FILTERS — inline like Job Queue */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Search name, phone, company..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-auto min-w-[130px] h-9 text-sm">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="quotation_shared">Quotation Sent</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* LEAD LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredLeads.length === 0 ? (
                    <div className="col-span-full py-8 md:py-12 text-center text-sm text-gray-400 bg-gray-50 rounded-md border border-dashed border-gray-200">
                        No leads found matching your search.
                        <br /><span className="text-xs text-gray-300">If you just added a lead, try refreshing the page manually.</span>
                    </div>
                ) : (
                    filteredLeads.map((lead) => {
                        // All headers use neutral Shadcn background
                        const headerBg = 'bg-muted border-b border-border';
                        const headerTextColor = 'text-foreground';

                        return (
                            <div key={lead.id} className="bg-white rounded-md overflow-hidden hover:shadow-sm transition-all border border-gray-200">
                                {/* Colored Header */}
                                <div className={`${headerBg} px-3 py-2.5 flex items-center justify-between`}>
                                    <span className={`${headerTextColor} font-mono text-sm font-bold`}>
                                        {lead.lead_number}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {/* Assigned To — visible for admin */}
                                        {profile?.role === 'admin' && lead.assigned_to && (
                                            <span className="text-white/90 text-xs px-3 py-1 bg-white/20 rounded-md font-medium">
                                                👤 {staffList.find(s => s.id === lead.assigned_to)?.full_name || 'Unassigned'}
                                            </span>
                                        )}
                                        <span className={`${headerTextColor}/90 text-xs px-3 py-1 bg-white/20 rounded-md font-medium capitalize`}>
                                            {lead.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>

                                {/* White Card Body */}
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{lead.name}</h3>
                                            {lead.company && <p className="text-gray-500 text-sm font-medium">{lead.company}</p>}

                                            {/* Origin Badge — shows when lead was assigned by someone else */}
                                            {lead.created_by && lead.assigned_to && lead.created_by !== lead.assigned_to && (
                                                <div className="mt-1.5">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                                        📌 Assigned by {staffList.find(s => s.id === lead.created_by)?.full_name || 'Admin'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Project Type Badge */}
                                            {lead.project_type && (
                                                <div className="mt-2">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${lead.project_type === 'print' ? 'bg-gray-900 text-white' :
                                                        lead.project_type === 'design' ? 'bg-pink-100 text-pink-700' :
                                                            'bg-gray-900 text-white'
                                                        }`}>
                                                        {lead.project_type === 'print' ? '🖨️ Print Only' :
                                                            lead.project_type === 'design' ? '🎨 Design Only' :
                                                                '✨ Design + Print'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setSelectedLead(lead); setShowViewModal(true); }} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" aria-label="View lead details">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleEdit(lead)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" aria-label="Edit lead">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(lead.id, lead.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" aria-label="Delete lead">
                                                <Trash2 className="w-4 h-4" />
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
                                                    <p className="text-sm font-bold text-gray-900">₹{lead.estimated_amount.toLocaleString()}</p>
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
                                            <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center text-gray-900 shrink-0">
                                                <Phone className="w-4 h-4" />
                                            </div>
                                            <span className="font-medium">{lead.phone}</span>
                                        </div>

                                        {lead.next_follow_up && (
                                            <div className="flex items-center gap-2 text-gray-600 bg-white p-2 rounded-lg border border-gray-200">
                                                <Clock className="w-4 h-4" />
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
                                        {lead.status !== 'converted' && lead.status !== 'follow_up' && (
                                            <button
                                                onClick={() => handleMoveToFollowUp(lead)}
                                                className="px-4 py-2 bg-gray-900 text-white rounded-md font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Move to Follow-up
                                            </button>
                                        )}
                                        {(lead.status === 'converted' || lead.status === 'follow_up') && (
                                            <span className="text-sm text-gray-500">—</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* EDIT/CREATE MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white p-5 border-b border-gray-100 flex justify-between items-center z-10">
                            <h2 className="text-page-title text-gray-900">{isEditing ? 'Edit Lead' : 'New Lead Card'}</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-6">
                            {/* Mandatory Section */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Lead Name *</label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all font-medium" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Mobile Number *</label>
                                    <input required type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 transition-all font-medium font-mono" />
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
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 transition-all font-medium"
                                    />
                                    <p className="text-xs text-gray-400 mt-1 ml-1">Example: &quot;When Lead Created&quot;</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Source</label>
                                    <select value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value as any })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400">
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
                                    <select value={formData.leadType} onChange={e => setFormData({ ...formData, leadType: e.target.value as any })} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400">
                                        <option value="printing_only">Printing Only</option>
                                        <option value="designing_only">Designing Only</option>
                                        <option value="design_printing">Design + Printing</option>
                                    </select>
                                </div>
                            </div>

                            {/* Assign To (Admin only) */}
                            {profile?.role === 'admin' && staffList.length > 0 && (
                                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                    <label className="block text-xs font-bold text-amber-700 uppercase mb-1.5">👤 Assign To Staff</label>
                                    <select
                                        value={formData.assignedTo}
                                        onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 text-sm font-medium"
                                    >
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.full_name} ({s.role})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-amber-600 mt-1">This lead will appear on their dashboard for follow-up</p>
                                </div>
                            )}

                            {/* Status Section */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                                    <input type="text" placeholder="Company Name (Optional)" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} className="border-b border-gray-200 py-2 focus:border-gray-400 focus:outline-none bg-transparent placeholder-gray-400" />
                                    <input type="email" placeholder="Email Address (Optional)" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="border-b border-gray-200 py-2 focus:border-gray-400 focus:outline-none bg-transparent placeholder-gray-400" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                                    <select value={formData.billingPreference} onChange={e => setFormData({ ...formData, billingPreference: e.target.value as any })} className="border-b border-gray-200 py-2 focus:border-gray-400 focus:outline-none bg-transparent text-gray-600">
                                        <option value="gst">GST Invoice</option>
                                        <option value="non_gst">Cash / Estimates</option>
                                        <option value="both">Both</option>
                                    </select>
                                    <input type="number" placeholder="Expected Value (₹)" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} className="border-b border-gray-200 py-2 focus:border-gray-400 focus:outline-none bg-transparent placeholder-gray-400" />
                                </div>
                                <textarea placeholder="Requirement details / Notes..." rows={3} value={formData.requirement} onChange={e => setFormData({ ...formData, requirement: e.target.value })} className="w-full p-3 bg-gray-50 rounded-lg border-0 focus:ring-2 focus:ring-gray-400/20 text-sm resize-none"></textarea>
                            </div>

                            <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-100 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-white border-2 border-gray-200 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-gray-900 text-white rounded-md font-semibold hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                    {submitting && <Loader2 className="animate-spin w-4 h-4" />}
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
                    <div className="bg-white rounded-md w-full max-w-lg p-4 relative">
                        <button onClick={() => setShowViewModal(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
                        <h2 className="text-page-title text-gray-900 mb-1">{selectedLead.name}</h2>
                        <p className="text-gray-500 font-mono text-sm mb-3 md:mb-1.5">{selectedLead.lead_number}</p>

                        <div className="space-y-4">
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Phone</span> <span className="font-medium font-mono">{selectedLead.phone}</span></div>
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Company</span> <span className="font-medium">{selectedLead.company || '-'}</span></div>
                            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Status</span> <span className="font-bold capitalize text-primary">{selectedLead.status}</span></div>

                            <div className="bg-gray-50 p-4 rounded-lg mt-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Requirement</h4>
                                <p className="text-gray-700 italic">{selectedLead.requirement || 'No notes provided.'}</p>
                            </div>
                        </div>

                        <button onClick={() => { setShowViewModal(false); handleEdit(selectedLead); }} className="w-full mt-3 md:mt-6 bg-gray-900 text-white py-2 rounded-md font-semibold hover:bg-gray-800 shadow-sm">Edit Details</button>
                    </div>
                </div>
            )}
        </div>
    );
}
