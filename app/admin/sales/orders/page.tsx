'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
  Calendar, User, Package, IndianRupee, Truck, CheckCircle,
  AlertCircle, ChevronRight
} from 'lucide-react';
import { useJobs, useClients } from '@/lib/hooks';
import { Job, Client } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';

export default function OrdersPage() {
  const { user, profile } = useAuth();
  const { jobs: allJobs, loading: jobsLoading, createJob, updateJob, deleteJob } = useJobs();

  // Filter jobs for Marketing role
  const jobs = useMemo(() => {
    if (profile?.role === 'marketing') {
      return allJobs.filter(job =>
        job.sales_person_id === profile.id ||
        job.created_by === profile.id ||
        (job.client && job.client.created_by === profile.id)
      );
    }
    return allJobs;
  }, [allJobs, profile]);

  const { clients: allClients } = useClients();

  const clients = useMemo(() => {
    if (profile?.role === 'marketing') {
      return allClients.filter(c => c.created_by === profile.id);
    }
    return allClients;
  }, [allClients, profile]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    clientId: '',
    projectName: '',
    description: '',
    quantity: 1,
    ratePerPiece: 0,
    subtotal: 0,
    gstRate: 18,
    gstAmount: 0,
    totalAmount: 0,
    priority: 'normal' as Job['priority'],
    currentStage: 'new' as Job['current_stage'],
    clientDeadline: '',
    notes: ''
  });

  // Auto-open if ?new=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('new') === 'true') {
        window.history.replaceState({}, '', '/admin/sales/orders');
        setTimeout(() => setShowModal(true), 500);
      }
    }
  }, []);

  const calculateTotals = (qty: number, rate: number, taxRate: number) => {
    const sub = qty * rate;
    const gst = Math.round(sub * (taxRate / 100));
    const total = sub + gst;
    return { sub, gst, total };
  };

  const handleQuantityChange = (qty: number) => {
    const { sub, gst, total } = calculateTotals(qty, formData.ratePerPiece, formData.gstRate);
    setFormData(prev => ({ ...prev, quantity: qty, subtotal: sub, gstAmount: gst, totalAmount: total }));
  };

  const handleRateChange = (rate: number) => {
    const { sub, gst, total } = calculateTotals(formData.quantity, rate, formData.gstRate);
    setFormData(prev => ({ ...prev, ratePerPiece: rate, subtotal: sub, gstAmount: gst, totalAmount: total }));
  };

  const handleGstRateChange = (rate: number) => {
    const { sub, gst, total } = calculateTotals(formData.quantity, formData.ratePerPiece, rate);
    setFormData(prev => ({ ...prev, gstRate: rate, gstAmount: gst, totalAmount: total }));
  };

  const handleAddNew = () => {
    setFormData({
      clientId: '',
      projectName: '',
      description: '',
      quantity: 1,
      ratePerPiece: 0,
      subtotal: 0,
      gstRate: 18,
      gstAmount: 0,
      totalAmount: 0,
      priority: 'normal',
      currentStage: 'new',
      clientDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: ''
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (job: Job) => {
    setFormData({
      clientId: job.client_id || '',
      projectName: job.project_name,
      description: job.description || '',
      quantity: job.quantity,
      ratePerPiece: job.quote_per_piece || (job.quantity > 0 ? job.subtotal / job.quantity : 0),
      subtotal: job.subtotal,
      gstRate: job.gst_rate,
      gstAmount: job.gst_amount,
      totalAmount: job.total_amount,
      priority: job.priority,
      currentStage: job.current_stage,
      clientDeadline: job.client_deadline ? new Date(job.client_deadline).toISOString().split('T')[0] : '',
      notes: job.notes || ''
    });
    setSelectedJob(job);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this order?')) {
      await deleteJob(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing && selectedJob) {
        await updateJob(selectedJob.id, {
          client_id: formData.clientId,
          project_name: formData.projectName,
          description: formData.description,
          quantity: formData.quantity,
          quote_per_piece: formData.ratePerPiece,
          subtotal: formData.subtotal,
          gst_rate: formData.gstRate,
          gst_amount: formData.gstAmount,
          total_amount: formData.totalAmount,
          priority: formData.priority,
          current_stage: formData.currentStage,
          client_deadline: formData.clientDeadline,
          notes: formData.notes
        });
      } else {
        await createJob({
          client_id: formData.clientId,
          project_name: formData.projectName,
          description: formData.description,
          quantity: formData.quantity,
          quote_per_piece: formData.ratePerPiece,
          subtotal: formData.subtotal,
          gst_rate: formData.gstRate,
          gst_amount: formData.gstAmount,
          discount_amount: 0,
          total_amount: formData.totalAmount,
          payment_status: 'pending',
          amount_received: 0,
          order_date: new Date().toISOString(),
          priority: formData.priority,
          current_stage: formData.currentStage,
          files: [],
          client_deadline: formData.clientDeadline,
          notes: formData.notes,
          sales_person_id: profile?.id || user?.id,
        });
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Failed to save order');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-blue-100 text-blue-700',
      'designing': 'bg-purple-100 text-purple-700',
      'approval': 'bg-amber-100 text-amber-700',
      'printing': 'bg-indigo-100 text-indigo-700',
      'finishing': 'bg-pink-100 text-pink-700',
      'quality_check': 'bg-orange-100 text-orange-700',
      'ready': 'bg-green-100 text-green-700',
      'dispatched': 'bg-cyan-100 text-cyan-700',
      'delivered': 'bg-gray-100 text-gray-700',
      'cancelled': 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const s = searchQuery.toLowerCase();
      const matchSearch =
        job.job_number.toLowerCase().includes(s) ||
        job.project_name.toLowerCase().includes(s) ||
        (job.client?.company || '').toLowerCase().includes(s) ||
        (job.client?.name || '').toLowerCase().includes(s);
      const matchStatus = statusFilter === 'all' || job.current_stage === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [jobs, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 lg:space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/sales" className="p-2 hover:bg-white rounded-xl shadow-sm border border-gray-100 lg:hidden bg-gray-50 transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Orders</h1>
            <p className="text-sm text-gray-500 mt-1">{filteredJobs.length} orders found</p>
          </div>
        </div>
        <div className="hidden lg:block">
          {profile?.role !== 'marketing' && (
            <button
              onClick={handleAddNew}
              className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-3 rounded-xl shadow-lg shadow-gray-900/20 transition-all hover:scale-105 active:scale-95 font-medium"
            >
              <Plus size={20} />
              <span>New Order</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders, clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-gray-900 placeholder-gray-400 transition-all font-medium"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="designing">Designing</option>
          <option value="printing">Printing</option>
          <option value="ready">Ready</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>

      <div className="space-y-4">
        {jobsLoading ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">Loading orders...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
            No orders found matching your criteria.
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="lg:hidden space-y-4">
              {filteredJobs.map((job) => (
                <div key={job.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative">
                  {/* Row 1: ID & Status */}
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-md">
                      {job.job_number}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${getStatusColor(job.current_stage)}`}>
                      {job.current_stage.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Row 2: Main Details (Split Left/Right) */}
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 leading-tight mb-1">{job.project_name}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <User size={12} className="text-gray-400" />
                        <span className="truncate">{job.client?.company || job.client?.name || 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-gray-900">{formatCurrency(job.total_amount)}</div>
                      <div className="text-xs text-gray-500 font-medium">{job.quantity} pcs</div>
                    </div>
                  </div>

                  {/* Row 3: Footer (Date & Actions) */}
                  <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                      <Calendar size={12} />
                      <span>{job.client_deadline ? formatDate(job.client_deadline) : 'No Deadline'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setSelectedJob(job); setShowViewModal(true); }}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"
                      >
                        <Eye size={16} />
                      </button>
                      {profile?.role !== 'marketing' && (
                        <>
                          <button
                            onClick={() => handleEdit(job)}
                            className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg"
                          >
                            <Edit size={16} />
                          </button>
                          {/* Optional: Stick Delete in a menu or remove to save space if needed */}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Order Info</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Delivery</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900 font-mono text-sm bg-gray-100 px-2 py-1 rounded-md">{job.job_number}</span>
                          {job.priority === 'urgent' && <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Urgent</span>}
                        </div>
                        <div className="font-semibold text-gray-800">{job.project_name}</div>
                        <div className="text-xs text-gray-500 mt-1">{job.quantity} items</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-gray-900">{job.client?.company || '-'}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <User size={12} /> {job.client?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-bold text-gray-900">{formatCurrency(job.total_amount)}</div>
                        {job.payment_status !== 'paid' && (
                          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                            Due: {formatCurrency(job.total_amount - job.amount_received)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg w-fit">
                          <Calendar size={14} className="text-gray-400" />
                          {job.client_deadline ? formatDate(job.client_deadline) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.current_stage)}`}>
                          {job.current_stage.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2 text-gray-500">
                          <button onClick={() => { setSelectedJob(job); setShowViewModal(true); }} className="p-2 hover:bg-gray-100 rounded-lg hover:text-indigo-600 transition-colors">
                            <Eye size={18} />
                          </button>
                          {profile?.role !== 'marketing' && (
                            <>
                              <button onClick={() => handleEdit(job)} className="p-2 hover:bg-gray-100 rounded-lg hover:text-indigo-600 transition-colors">
                                <Edit size={18} />
                              </button>
                              <button onClick={(e) => handleDelete(job.id, e)} className="p-2 hover:bg-red-50 rounded-lg hover:text-red-500 transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Edit Order' : 'New Order'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Project / Order Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wedding Invitation Cards, Corporate Brochure"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Client *</label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.company} ({c.name})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Delivery Deadline</label>
                  <input
                    type="date"
                    value={formData.clientDeadline}
                    onChange={(e) => setFormData({ ...formData, clientDeadline: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description / Specifications</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Paper type, size, finishing details, etc."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm resize-none"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rate / Pc (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={formData.ratePerPiece}
                      onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">GST (%)</label>
                    <select
                      value={formData.gstRate}
                      onChange={(e) => handleGstRateChange(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Total (Inc. GST)</label>
                    <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-900">
                      {formatCurrency(formData.totalAmount)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Stage</label>
                  <select
                    value={formData.currentStage}
                    onChange={(e) => setFormData({ ...formData, currentStage: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                  >
                    <option value="new">New</option>
                    <option value="designing">Designing</option>
                    <option value="printing">Printing</option>
                    <option value="finishing">Finishing</option>
                    <option value="ready">Ready</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (isEditing ? 'Update Order' : 'Create Order')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">{selectedJob.project_name}</h2>
                  <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-0.5 rounded-md">{selectedJob.job_number}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Ordered on {formatDate(selectedJob.order_date)}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                  {selectedJob.client?.company?.charAt(0) || 'C'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedJob.client?.company}</h3>
                  <p className="text-sm text-gray-600">{selectedJob.client?.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-xl">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Status</p>
                  <p className="font-medium text-gray-900 capitalize mt-1">{selectedJob.current_stage.replace('_', ' ')}</p>
                </div>
                <div className="p-3 border rounded-xl">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Priority</p>
                  <p className={`font-medium capitalize mt-1 ${selectedJob.priority === 'urgent' ? 'text-red-600' : 'text-gray-900'}`}>{selectedJob.priority}</p>
                </div>
                <div className="p-3 border rounded-xl">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Deadline</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedJob.client_deadline ? formatDate(selectedJob.client_deadline) : '-'}</p>
                </div>
                <div className="p-3 border rounded-xl">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Quantity</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedJob.quantity}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Description / Specifications</h4>
                <p className="text-gray-600 text-sm leading-relaxed p-4 bg-gray-50 rounded-xl border border-gray-100 min-h-[80px]">
                  {selectedJob.description || 'No description provided.'}
                </p>
              </div>

              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(selectedJob.subtotal)}</span>
                </div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600">GST ({selectedJob.gst_rate}%)</span>
                  <span className="font-medium">{formatCurrency(selectedJob.gst_amount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-indigo-100 mt-2">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-indigo-700 text-lg">{formatCurrency(selectedJob.total_amount)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedJob); }} className="flex-1 py-3 border border-indigo-200 text-indigo-700 font-semibold rounded-xl hover:bg-indigo-50 transition-colors">
                  Edit Order
                </button>
                <button onClick={() => setShowViewModal(false)} className="flex-1 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-black transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
