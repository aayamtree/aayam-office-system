'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
  Calendar, User, FileText, IndianRupee, CheckCircle, XCircle, Clock, Loader2, Download
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useQuotations, useClients, useJobs, useLeads } from '@/lib/hooks';
import { Quotation, Client, QuotationItem, JobStatus } from '@/types/database';
import { downloadQuotationPDF, defaultCompanyData } from '@/components/quotation/QuotationPDF';
import { formatDate } from '@/lib/utils';

export default function QuotationsPage() {
  const { user, profile } = useAuth();
  const { quotations: allQuotations, loading: quotationsLoading, createQuotation, updateQuotation, saveQuotationItems, deleteQuotation } = useQuotations();

  // Show all quotations
  const quotations = allQuotations;
  const { clients: allClients } = useClients();
  const { leads: allLeads, convertToClient } = useLeads();

  const clients = useMemo(() => {
    if (profile?.role === 'marketing') {
      return allClients.filter(c => c.created_by === profile.id);
    }
    return allClients;
  }, [allClients, profile]);

  const leads = useMemo(() => {
    if (profile?.role === 'marketing') {
      return allLeads.filter(l => l.assigned_to === profile.id || l.created_by === profile.id);
    }
    return allLeads;
  }, [allLeads, profile]);
  const { createJob } = useJobs();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    clientId: '',
    leadId: '',
    quoteNumber: '', // Auto-generated
    validUntil: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 }] as QuotationItem[],
    subtotal: 0,
    gstRate: 18,
    totalTax: 0,
    totalAmount: 0,
    status: 'draft' as Quotation['status'],
    notes: '',
    terms: '',
  });

  // Handle URL Params for quick actions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      console.log('URL Params:', {
        new: params.get('new'),
        clientId: params.get('clientId'),
        leadId: params.get('leadId')
      });

      if (params.get('new') === 'true') {
        const clientIdParam = params.get('clientId');
        const leadIdParam = params.get('leadId');

        console.log('Setting form data:', { clientIdParam, leadIdParam });

        if (clientIdParam) {
          setFormData(prev => ({ ...prev, clientId: clientIdParam, leadId: '' }));
        } else if (leadIdParam) {
          setFormData(prev => ({ ...prev, leadId: leadIdParam, clientId: '' }));
        }

        // Clear URL to prevent reopen
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => setShowModal(true), 500);
      }
    }
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'draft': 'bg-gray-100 text-gray-700',
      'sent': 'bg-blue-100 text-blue-700',
      'viewed': 'bg-indigo-100 text-indigo-700',
      'accepted': 'bg-green-100 text-green-700',
      'rejected': 'bg-red-100 text-red-700',
      'expired': 'bg-amber-100 text-amber-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <CheckCircle size={14} className="text-green-600" />;
      case 'rejected': return <XCircle size={14} className="text-red-600" />;
      case 'expired': return <Clock size={14} className="text-amber-600" />;
      default: return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }

    setFormData(prev => {
      const updatedItems = newItems;
      const sub = updatedItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = Math.round(sub * (prev.gstRate / 100)); // Simplified GST calc
      return {
        ...prev,
        items: updatedItems,
        subtotal: sub,
        totalTax: tax,
        totalAmount: sub + tax
      };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, rate: 0, amount: 0, gst_rate: prev.gstRate } as QuotationItem]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      const sub = newItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = Math.round(sub * (prev.gstRate / 100));
      return {
        ...prev,
        items: newItems,
        subtotal: sub,
        totalTax: tax,
        totalAmount: sub + tax
      };
    });
  };

  const handleAddNew = () => {
    setFormData({
      clientId: '',
      leadId: '',
      quoteNumber: '',
      items: [{ description: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 } as QuotationItem],
      subtotal: 0,
      gstRate: 18,
      totalTax: 0,
      totalAmount: 0,
      status: 'draft',
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
      terms: '',
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (q: Quotation) => {
    const items = q.items || [];
    const gstRate = items.length > 0 ? items[0].gst_rate : 18;

    setFormData({
      clientId: q.client_id || '',
      leadId: q.lead_id || '',
      quoteNumber: q.quote_number,
      validUntil: q.valid_until ? new Date(q.valid_until).toISOString().split('T')[0] : '',
      items: items.length > 0 ? items : [{ description: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 } as QuotationItem],
      subtotal: q.subtotal,
      gstRate: gstRate,
      totalTax: q.gst_amount, // Historically we called it total_tax but here it maps to gst_amount
      totalAmount: q.total_amount,
      status: q.status,
      notes: q.notes || '',
      terms: q.terms || '',
    });
    setSelectedQuotation(q);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string, quoteNumber: string) => {
    if (confirm(`Are you sure you want to delete Quotation ${quoteNumber}? This action cannot be undone.`)) {
      await deleteQuotation(id);
    }
  };

  // Implement Convert Logic
  const handleConvertToOrder = async (q: Quotation) => {
    if (!confirm(`Create a new Job Order from Quotation "${q.quote_number}"? This will mark the quote as Accepted.`)) return;

    try {
      let finalClientId = q.client_id;

      // 1. Auto-Convert Lead to Client if needed
      if ((!finalClientId || finalClientId === '') && q.lead_id) {
        const confirmConvert = confirm('This quotation is for a Lead. To create an order, the Lead must be converted to a Client. Proceed with conversion?');
        if (!confirmConvert) return;

        // Use the hook function we exposed
        const { data: newClient, error: convertError } = await convertToClient(q.lead_id, user?.id || '');

        if (convertError) {
          throw new Error('Failed to convert Lead to Client: ' + convertError);
        }

        if (newClient) {
          finalClientId = newClient.id;
          alert(`Lead converted to Client: ${newClient.company || newClient.name}`);
        }
      }

      if (!finalClientId) {
        throw new Error('Cannot create an order without a valid Client. Please ensure the lead is converted properly.');
      }

      // 2. Create Job Payload
      // Use the current logged-in user as the creator/salesperson to ensure visibility
      const ownerId = user?.id || profile?.id || q.created_by;

      const jobPayload = {
        project_name: q.items?.[0]?.description || `Order from ${q.quote_number}`,
        client_id: finalClientId,
        sales_person_id: ownerId,
        created_by: ownerId,
        // No vendor or designer initially
        job_type: 'print', // Default
        quantity: q.items?.[0]?.quantity || 1,

        quote_per_piece: q.items?.[0]?.rate || 0,
        subtotal: q.subtotal,
        gst_rate: q.items?.[0]?.gst_rate || 18,
        gst_amount: q.gst_amount,
        discount_amount: q.discount_amount,
        total_amount: q.total_amount,

        payment_status: 'pending' as const,
        amount_received: 0,

        order_date: new Date().toISOString(),
        client_deadline: q.valid_until || undefined,

        current_stage: 'new' as JobStatus,
        priority: 'normal' as const,

        files: [],
        notes: `Converted from Quotation ${q.quote_number}. ${q.notes || ''}`
      };

      // 3. Create Job
      const { data: job, error: jobError } = await createJob(jobPayload);

      if (jobError) throw new Error(jobError);

      // 4. Update Quotation Status
      await updateQuotation(q.id, {
        status: 'accepted',
        converted_to_job_id: job?.id,
        client_id: finalClientId // Ensure the quotation is now linked to the real client
      });

      alert(`Order created successfully! Job #${job?.job_number}`);
      // Refresh logic handled by hooks automatically


    } catch (err: any) {
      console.error('Error converting to order:', err);
      alert('Failed to convert quotation to order: ' + err.message);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { items, ...quoteFields } = {
        client_id: formData.clientId || null,
        lead_id: formData.leadId || null,
        created_by: profile?.id || user?.id,
        valid_until: formData.validUntil || null,
        subtotal: formData.subtotal,
        gst_amount: formData.totalTax,
        discount_amount: 0,
        total_amount: formData.totalAmount,
        status: formData.status,
        notes: formData.notes,
        terms: formData.terms,
        items: formData.items
      };

      let quoteId = selectedQuotation?.id;

      if (isEditing && quoteId) {
        await updateQuotation(quoteId, quoteFields);
      } else {
        const { data, error } = await createQuotation(quoteFields);
        if (error) throw new Error(error);
        if (data) quoteId = data.id;
      }

      if (quoteId) {
        await saveQuotationItems(quoteId, items);
      }

      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving quotation:', error);
      alert('Failed to save quotation: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = async (q: Quotation) => {
    const pdfData = {
      ...defaultCompanyData,
      quoteNumber: q.quote_number,
      date: formatDate(new Date(q.created_at)),
      validUntil: q.valid_until ? formatDate(new Date(q.valid_until)) : '-',
      clientName: q.client?.name || 'Unknown',
      clientCompany: q.client?.company,
      clientAddress: q.client?.address,
      clientPhone: q.client?.phone,
      clientEmail: q.client?.email,
      items: q.items?.map(i => ({
        description: i.description,
        quantity: i.quantity,
        rate: i.rate,
        amount: i.amount
      })) || [],
      subtotal: q.subtotal,
      taxAmount: q.gst_amount,
      totalAmount: q.total_amount,
      terms: q.terms,
      notes: q.notes
    };

    await downloadQuotationPDF(pdfData as any);
  };



  const filteredQuotations = quotations.filter(q => {
    const matchesSearch =
      q.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.client?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.client?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/sales" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Quotations</h1>
            <p className="text-sm text-gray-500">{filteredQuotations.length} quotations found</p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { status: 'draft', bg: 'bg-gray-200 border-gray-300', text: 'text-gray-700' },
          { status: 'sent', bg: 'bg-blue-100 border-blue-200', text: 'text-blue-700' },
          { status: 'accepted', bg: 'bg-green-100 border-green-200', text: 'text-green-700' },
          { status: 'rejected', bg: 'bg-red-100 border-red-200', text: 'text-red-700' },
          { status: 'expired', bg: 'bg-amber-100 border-amber-200', text: 'text-amber-700' },
        ].map((item) => (
          <div key={item.status} className={`rounded-xl p-3 text-center border ${item.bg}`}>
            <p className={`text-2xl font-bold ${item.text}`}>{quotations.filter(q => q.status === item.status).length}</p>
            <p className={`text-xs capitalize font-medium ${item.text}`}>{item.status}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search quotations by number, client..."
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
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-4">
        {quotationsLoading ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">Loading quotations...</div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
            No quotations found matching your criteria.
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="lg:hidden space-y-4">
              {filteredQuotations.map((q) => (
                <div key={q.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative ${q.status === 'accepted' || q.status === 'rejected' ? 'bg-gray-50/50' : ''}`}>
                  {/* Row 1: ID & Status */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-gray-900 font-mono text-sm bg-gray-100 px-2 py-1 rounded-md">{q.quote_number}</span>
                      <p className="text-[10px] text-gray-400 mt-1">{formatDate(q.created_at)}</p>
                    </div>
                    <span className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${getStatusColor(q.status)}`}>
                      {getStatusIcon(q.status)}
                      {q.status}
                    </span>
                  </div>

                  {/* Row 2: Client & Amount */}
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 leading-tight mb-0.5">{q.client?.company || 'Unknown Client'}</h3>
                      <div className="text-sm text-gray-600">{q.client?.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-gray-900 text-lg">{formatCurrency(q.total_amount)}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>

                  {/* Row 3: Items Preview */}
                  <div className="mb-4 bg-gray-50 p-2.5 rounded-xl border border-gray-100/50">
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {q.items?.map(i => `${i.description} (${i.quantity})`).join(', ')}
                    </p>
                  </div>

                  {/* Row 4: Footer (Validation & Actions) */}
                  <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                      <Clock size={12} />
                      <span>Valid: {q.valid_until ? formatDate(q.valid_until) : 'N/A'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {q.status === 'accepted' && (
                        <button
                          onClick={() => handleConvertToOrder(q)}
                          className="px-2 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wide"
                        >
                          → Order
                        </button>
                      )}
                      {(q.status === 'sent' || q.status === 'viewed' || q.status === 'draft') && (
                        <button
                          onClick={() => handleConvertToOrder(q)}
                          className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button onClick={() => handleEdit(q)} className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDownloadPDF(q)} className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg">
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Quotation</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Valid Until</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredQuotations.map((q) => (
                    <tr key={q.id} className={`hover:bg-gray-50 transition-colors ${q.status === 'accepted' || q.status === 'rejected' ? 'bg-gray-50/50 opacity-60' : ''}`}>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{q.quote_number}</span>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(q.created_at)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{q.client?.company || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{q.client?.name}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{q.items?.map(i => i.description).join(', ')}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(q.total_amount)}</td>
                      <td className="px-6 py-4 text-gray-600">{q.valid_until ? formatDate(q.valid_until) : '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1 w-fit px-3 py-1 text-xs rounded-full ${getStatusColor(q.status)}`}>
                          {getStatusIcon(q.status)}
                          {q.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {q.status === 'accepted' && (
                            <button
                              onClick={() => handleConvertToOrder(q)}
                              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                            >
                              → Order
                            </button>
                          )}
                          {(q.status === 'sent' || q.status === 'viewed' || q.status === 'draft') && (
                            <button
                              onClick={() => handleConvertToOrder(q)}
                              className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg"
                              title="Convert to Order"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                          <button onClick={() => handleEdit(q)} className="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                            <Edit size={18} className="text-gray-500" />
                          </button>
                          <button onClick={() => handleDownloadPDF(q)} className="p-2 hover:bg-gray-100 rounded-lg" title="Download PDF">
                            <Download size={18} className="text-gray-500" />
                          </button>
                          <button onClick={() => handleDelete(q.id, q.quote_number)} className="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={18} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Quotation' : 'New Quotation'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client / Lead *</label>
                  <select
                    required
                    value={formData.clientId ? `client_${formData.clientId}` : formData.leadId ? `lead_${formData.leadId}` : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setFormData({ ...formData, clientId: '', leadId: '' });
                        return;
                      }
                      if (val.startsWith('client_')) {
                        setFormData({ ...formData, clientId: val.replace('client_', ''), leadId: '' });
                      } else if (val.startsWith('lead_')) {
                        setFormData({ ...formData, leadId: val.replace('lead_', ''), clientId: '' });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select Client or Lead</option>
                    <optgroup label="Leads (Potential)">
                      {leads?.map(l => (
                        <option key={`lead_${l.id}`} value={`lead_${l.id}`}>LEAD: {l.name} {l.company ? `(${l.company})` : ''}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Clients (Existing)">
                      {clients?.map(c => (
                        <option key={`client_${c.id}`} value={`client_${c.id}`}>{c.company} ({c.name})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Items</label>
                  <button type="button" onClick={addItem} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">+ Add Item</button>
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="col-span-12 sm:col-span-5">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Rate"
                          min="0"
                          step="any"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-2 flex items-center justify-between">
                        <span className="font-medium text-gray-700 text-sm">{formatCurrency(item.amount)}</span>
                        {formData.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 p-1">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subtotal</label>
                    <div className="font-bold text-gray-900 text-lg">{formatCurrency(formData.subtotal)}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">GST (%)</label>
                    <select
                      value={formData.gstRate}
                      onChange={(e) => {
                        const newRate = parseInt(e.target.value);
                        const tax = Math.round(formData.subtotal * (newRate / 100));
                        setFormData(prev => ({ ...prev, gstRate: newRate, totalTax: tax, totalAmount: prev.subtotal + tax }));
                      }}
                      className="w-full px-2 py-1 border border-gray-200 rounded-lg bg-white text-sm"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">GST Amount</label>
                    <div className="font-bold text-gray-700">{formatCurrency(formData.totalTax)}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total</label>
                    <div className="font-bold text-indigo-700 text-lg">{formatCurrency(formData.totalAmount)}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                  <textarea
                    rows={2}
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Payment terms, delivery timeline..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Internal)</label>
                  <textarea
                    rows={1}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
