'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Briefcase, Calendar,
  IndianRupee, Edit, Trash2, X,
  AlertCircle, ChevronDown, LayoutGrid,
  List, Building2, UserPlus, Loader2,
  Layers, Printer, ArrowRight
} from 'lucide-react';
import {
  useJobs, useClients, useVendors, useDesigners, usePaymentsReceived
} from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { Job, Client, Vendor, Designer, JobStatus, PaymentMode } from '@/types/database';
import { supabase } from '@/lib/supabase';
import ClientQuickAddModal from '@/components/shared/ClientQuickAddModal';
import VendorQuickAddModal from '@/components/shared/VendorQuickAddModal';
import ProductCategoryQuickAdd from '@/components/shared/ProductCategoryQuickAdd';

const stages = [
  { id: 'new', name: 'New', color: 'bg-gray-500', bgLight: 'bg-gray-50', border: 'border-gray-200' },
  { id: 'designing', name: 'Design', color: 'bg-purple-500', bgLight: 'bg-purple-50', border: 'border-purple-200' },
  { id: 'approval', name: 'Approval', color: 'bg-yellow-500', bgLight: 'bg-yellow-50', border: 'border-yellow-200' },
  { id: 'printing', name: 'Print', color: 'bg-blue-500', bgLight: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'finishing', name: 'Post Print', color: 'bg-cyan-500', bgLight: 'bg-cyan-50', border: 'border-cyan-200' },
  { id: 'quality_check', name: 'QC Check', color: 'bg-emerald-500', bgLight: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'ready', name: 'Ready', color: 'bg-indigo-500', bgLight: 'bg-indigo-50', border: 'border-indigo-200' },
  { id: 'dispatched', name: 'Dispatched', color: 'bg-orange-500', bgLight: 'bg-orange-50', border: 'border-orange-200' },
  { id: 'delivered', name: 'Delivered', color: 'bg-green-500', bgLight: 'bg-green-50', border: 'border-green-200' },
];

const priorities = [
  { id: 'low', name: 'Low', color: 'bg-gray-100 text-gray-600' },
  { id: 'normal', name: 'Normal', color: 'bg-blue-100 text-blue-600' },
  { id: 'high', name: 'High', color: 'bg-orange-100 text-orange-600' },
  { id: 'urgent', name: 'Urgent', color: 'bg-red-100 text-red-600' },
];

const jobTypes = ['Design Only', 'Print Only', 'Design + Print', 'Packaging', 'Branding', 'Other'];

// Product categories must match Settings > Production checklist types
const productCategories = ['Banner', 'Book', 'Box', 'Brochure', 'Label', 'Poster', 'Other'];

// Product types for print planning (job_type field)
const productTypes = ['STICKER', 'POUCH', 'BOX', 'BANNER', 'FLEX', 'VINYL', 'LABEL', 'BOOK', 'BROCHURE', 'OTHER'];


export default function JobsPage() {
  const { jobs, loading: jobsLoading, createJob, updateJob, deleteJob, updateJobStage } = useJobs();
  const { clients, createClient } = useClients();
  const { vendors, createVendor } = useVendors();
  const { designers } = useDesigners();
  const { createPaymentReceived } = usePaymentsReceived();

  const loading = jobsLoading; // Main loading state

  // Safety: Prevent infinite loading
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Load product categories from database
  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data) setProductCategories(data);
    };
    loadCategories();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [productCategories, setProductCategories] = useState<any[]>([]);

  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [expandedStages, setExpandedStages] = useState<string[]>(stages.map(s => s.id));
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    project_name: '', client_id: '', job_type: 'Design + Print', product_category: 'Other', product_type: 'STICKER', quantity: 1, vendor_id: '',
    designer_id: '', client_deadline: '', priority: 'normal', quote_per_piece: 0, gst_rate: 18, current_stage: 'new'
  });

  // Quick add forms
  const [newClient, setNewClient] = useState({ name: '', company: '', phone: '', city: '' });
  const [newVendor, setNewVendor] = useState({ name: '', company: '', phone: '', category: 'Paper' });

  // Quick Add Client
  const handleAddClient = async () => {
    if (!newClient.name || !newClient.phone) return alert('Name and Phone are required');

    const result = await createClient({
      ...newClient,
      is_active: true,
      email: '', // Required by Type but optional in form
      gstin: '',
      address: '',
      state: 'Gujarat',
      client_type: 'regular',
      credit_limit: 0
    });

    if (result.data) {
      setFormData({ ...formData, client_id: result.data.id });
      setShowAddClientModal(false);
      setNewClient({ name: '', company: '', phone: '', city: '' });
    }
  };

  // Quick Add Vendor
  const handleAddVendor = async () => {
    if (!newVendor.name || !newVendor.phone) return alert('Name and Phone are required');

    const result = await createVendor({
      ...newVendor,
      is_active: true,
      email: '',
      gstin: '',
      address: '',
      city: '',
      state: 'Gujarat',
      payment_terms: 0 // Default 0 days
    });

    if (result.data) {
      setFormData({ ...formData, vendor_id: result.data.id });
      setShowAddVendorModal(false);
      setNewVendor({ name: '', company: '', phone: '', category: 'Paper' });
    }
  };



  const totalJobs = jobs.length;
  const activeJobs = jobs.filter(j => !['delivered', 'cancelled'].includes(j.current_stage)).length;
  const totalRevenue = jobs.reduce((sum, j) => sum + (j.amount_received || 0), 0);
  const pendingPayments = jobs.reduce((sum, j) => sum + ((j.total_amount || 0) - (j.amount_received || 0)), 0);

  const filteredJobs = jobs.filter(job => {
    const clientName = job.client?.name || '';
    const matchesSearch = job.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.job_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'all' || job.current_stage === stageFilter;
    const matchesPriority = priorityFilter === 'all' || job.priority === priorityFilter;
    const matchesClient = clientFilter === 'all' || job.client_id === clientFilter;
    return matchesSearch && matchesStage && matchesPriority && matchesClient;
  });

  const jobsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = filteredJobs.filter(job => job.current_stage === stage.id);
    return acc;
  }, {} as Record<string, Job[]>);

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => prev.includes(stageId) ? prev.filter(s => s !== stageId) : [...prev, stageId]);
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  const getPriorityBadge = (priority: string) => priorities.find(p => p.id === priority)?.color || 'bg-gray-100 text-gray-600';
  const getPaymentBadge = (status: string) => status === 'paid' ? 'bg-green-100 text-green-700' : status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  const isOverdue = (deadline: string | undefined, stage: string) => deadline && stage !== 'delivered' && new Date(deadline) < new Date();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const subtotal = formData.quantity * formData.quote_per_piece;
      const gstAmount = subtotal * (formData.gst_rate / 100);
      const totalAmount = subtotal + gstAmount;

      const jobData = {
        project_name: formData.project_name,
        client_id: formData.client_id || undefined, // Types generally prefer undefined over null for optional
        vendor_id: formData.vendor_id || undefined,
        designer_id: formData.designer_id || undefined,
        job_type: formData.job_type as 'print_only' | 'design_only' | 'design_print' | undefined,
        product_category: formData.product_category,
        quantity: formData.quantity,
        quote_per_piece: formData.quote_per_piece,
        subtotal,
        gst_rate: formData.gst_rate,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        client_deadline: formData.client_deadline || undefined,
        current_stage: formData.current_stage as JobStatus,
        priority: formData.priority as any,
        payment_status: 'pending' as const,
        amount_received: 0,
        files: [],
        order_date: new Date().toISOString(), // Required by base entity? No, but useful
        discount_amount: 0, // Should be calculated if we add discount field
        is_active: true
      };



      let result;
      if (editingJob) {
        result = await updateJob(editingJob.id, jobData);
      } else {
        result = await createJob(jobData);
      }

      if (result.error) {
        alert('Failed to save job: ' + result.error);
        setSaving(false);
        return;
      }

      setShowModal(false);
      setEditingJob(null);
      resetForm();
    } catch (error) {
      console.error('Error saving job:', error);
      alert('Error saving job');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_name: '', client_id: '', job_type: 'Design + Print', product_category: 'Other', product_type: 'STICKER', quantity: 1, vendor_id: '',
      designer_id: '', client_deadline: '', priority: 'normal', quote_per_piece: 0, gst_rate: 18, current_stage: 'new'
    });
  };

  const handleEdit = (job: Job) => {
    setFormData({
      project_name: job.project_name,
      client_id: job.client_id || '',
      job_type: job.job_type || 'Design + Print',
      product_category: job.product_category || 'Other',
      product_type: job.job_type || 'STICKER',
      quantity: job.quantity,
      vendor_id: job.vendor_id || '',
      designer_id: job.designer_id || '',
      client_deadline: job.client_deadline || '',
      priority: job.priority || 'normal',
      quote_per_piece: job.quote_per_piece || 0,
      gst_rate: job.gst_rate || 18,
      current_stage: job.current_stage || 'new'
    });
    setEditingJob(job);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job?')) return;
    await deleteJob(id);
  };

  const handleStageChange = async (jobId: string, newStage: string) => {
    await updateJobStage(jobId, newStage as JobStatus);
  };

  const handleAddPayment = (job: Job) => {
    setSelectedJob(job);
    setPaymentAmount(0);
    setShowPaymentModal(true);
  };

  const submitPayment = async () => {
    if (!selectedJob || paymentAmount <= 0) return;

    try {
      // 1. Record detailed payment history
      await createPaymentReceived({
        job_id: selectedJob.id,
        client_id: selectedJob.client_id,
        amount: paymentAmount,
        payment_mode: paymentMode,
        payment_date: new Date().toISOString().split('T')[0] // today
      });

      // 2. Update job aggregate
      const newAmountReceived = (selectedJob.amount_received || 0) + paymentAmount;
      const newPaymentStatus = newAmountReceived >= (selectedJob.total_amount || 0) - 1 ? 'paid' : 'partial'; // Tolerance of 1 rupee

      await updateJob(selectedJob.id, {
        amount_received: newAmountReceived,
        payment_status: newPaymentStatus
      });

      setShowPaymentModal(false);
      setSelectedJob(null);
      setPaymentMode('cash');
    } catch (error) {
      console.error('Error:', error);
      alert('Error adding payment');
    }
  };

  const handleViewDetail = (job: Job) => {
    handleEdit(job);
  };

  const handleAddNew = () => {
    resetForm();
    setEditingJob(null);
    setShowModal(true);
  };

  if (loading && !forceShow) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-2">Loading jobs...</span>
      </div>
    );
  }

  // JobCard Component 
  const JobCard = ({ job }: { job: Job }) => (
    <div
      className={`group bg-white rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-transparent hover:border-gray-100 ring-1 ring-black/5 cursor-pointer relative overflow-hidden ${isOverdue(job.client_deadline, job.current_stage) ? 'ring-red-100 bg-red-50/30' : ''
        }`}
      onClick={() => handleViewDetail(job)}
    >
      {/* Overdue Indicator Strip */}
      {isOverdue(job.client_deadline, job.current_stage) && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
      )}

      <div className="flex items-start justify-between mb-3">
        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${getPriorityBadge(job.priority)}`}>
          {job.priority.toUpperCase()}
        </div>
        <span className="font-mono text-xs text-indigo-500 font-medium bg-indigo-50 px-2 py-1 rounded-md">
          {job.job_number}
        </span>
      </div>

      <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
        {job.project_name}
      </h4>

      <div className="flex items-center gap-2 mb-4">
        <Building2 size={14} className="text-gray-400" />
        <p className="text-sm text-gray-500 truncate">{job.client?.name || 'No client'}</p>
      </div>

      <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-100 text-gray-500">
        <span className={`px-2 py-1 rounded-md font-medium ${getPaymentBadge(job.payment_status)}`}>
          {formatCurrency(job.amount_received)} / {formatCurrency(job.total_amount)}
        </span>

        {job.client_deadline && (
          <span className={`flex items-center gap-1.5 font-medium ${isOverdue(job.client_deadline, job.current_stage) ? 'text-red-600' : 'text-gray-400'}`}>
            <Calendar size={14} />
            {formatDate(job.client_deadline)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-3 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); handleEdit(job); }}
          className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
          title="Edit"
        >
          <Edit size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleAddPayment(job); }}
          className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors"
          title="Add Payment"
        >
          <IndianRupee size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">{activeJobs} active of {totalJobs} total jobs</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white px-4 md:px-5 py-2.5 md:py-3 rounded-xl shadow-lg shadow-gray-900/20 transition-all hover:scale-105 active:scale-95 text-sm md:text-base"
        >
          <Plus size={18} className="md:hidden" />
          <Plus size={20} className="hidden md:block" />
          <span className="font-medium">New Job</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm">
          <p className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Total Jobs</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900">{totalJobs}</p>
        </div>
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm">
          <p className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Active</p>
          <p className="text-2xl md:text-3xl font-bold text-indigo-600">{activeJobs}</p>
        </div>
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm">
          <p className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Revenue</p>
          <p className="text-xl md:text-2xl font-bold text-green-600 truncate" title={formatCurrency(totalRevenue)}>
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm">
          <p className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Pending</p>
          <p className="text-xl md:text-2xl font-bold text-amber-600 truncate" title={formatCurrency(pendingPayments)}>
            {formatCurrency(pendingPayments)}
          </p>
        </div>
      </div>


      {/* Print Production Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/print-planner" className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
            <Layers size={24} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Print Planner</h3>
            <p className="text-sm text-gray-500">Create production batches</p>
          </div>
          <ArrowRight size={20} className="ml-auto text-gray-300 group-hover:text-indigo-600" />
        </Link>
        <Link href="/admin/production-queue" className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
            <Printer size={24} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Production Queue</h3>
            <p className="text-sm text-gray-500">Track job status</p>
          </div>
          <ArrowRight size={20} className="ml-auto text-gray-300 group-hover:text-amber-600" />
        </Link>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col xl:flex-row gap-3 md:gap-4 bg-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs, clients, or numbers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 bg-gray-50 border-0 rounded-lg md:rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-sm md:text-base text-gray-900 placeholder-gray-400 transition-all font-medium"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
          <div className="flex gap-2 min-w-max">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-0 rounded-lg md:rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium text-sm md:text-base text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <option value="all">All Stages</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border-0 rounded-lg md:rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium text-sm md:text-base text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <option value="all">All Priority</option>
              {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg md:rounded-xl sm:ml-auto">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 md:p-2.5 rounded-md md:rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Board View"
            >
              <LayoutGrid size={18} className="md:hidden" />
              <LayoutGrid size={20} className="hidden md:block" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 md:p-2.5 rounded-md md:rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="List View"
            >
              <List size={18} className="md:hidden" />
              <List size={20} className="hidden md:block" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {
        filteredJobs.length === 0 && (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {searchTerm ? 'Try adjusting your search terms or filters.' : 'Get started by creating your first job.'}
            </p>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-200"
            >
              <Plus size={20} />
              <span>Create New Job</span>
            </button>
          </div>
        )
      }

      {/* Kanban View */}
      {
        viewMode === 'kanban' && filteredJobs.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)] items-start">
            {stages.map(stage => {
              const stageJobs = jobsByStage[stage.id] || [];
              return (
                <div key={stage.id} className="min-w-[300px] w-80 flex-shrink-0 bg-gray-50/50 rounded-xl border border-gray-200 flex flex-col max-h-full shadow-sm">
                  {/* Column Header */}
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-xl sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                      <span className="font-bold text-gray-700 text-sm">{stage.name}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs text-gray-600 font-medium">{stageJobs.length}</span>
                    </div>
                  </div>

                  {/* Cards List */}
                  <div className="p-3 space-y-3 overflow-y-auto">
                    {stageJobs.length > 0 ? (
                      stageJobs.map(job => <JobCard key={job.id} job={job} />)
                    ) : (
                      <div className="text-center py-6 text-gray-300 text-xs italic">
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {/* List View */}
      {
        viewMode === 'list' && filteredJobs.length > 0 && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Job</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stage</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Deadline</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredJobs.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewDetail(job)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-indigo-600">{job.job_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadge(job.priority)}`}>{job.priority}</span>
                        </div>
                        <p className="text-sm font-medium">{job.project_name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">{job.client?.name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${stages.find(s => s.id === job.current_stage)?.color}`}>
                          {stages.find(s => s.id === job.current_stage)?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPaymentBadge(job.payment_status)}`}>
                          {formatCurrency(job.amount_received)} / {formatCurrency(job.total_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {job.client_deadline ? (
                          <span className={isOverdue(job.client_deadline, job.current_stage) ? 'text-red-600 font-medium' : ''}>
                            {formatDate(job.client_deadline)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEdit(job)} className="p-2 hover:bg-gray-100 rounded-lg"><Edit size={16} className="text-gray-500" /></button>
                          <button onClick={() => handleDelete(job.id)} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16} className="text-red-500" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {/* Add/Edit Job Modal */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-scale-in">
              <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                <h2 className="text-lg font-bold">{editingJob ? 'Edit Job' : 'New Job'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project Name *</label>
                  <input type="text" required value={formData.project_name} onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl" placeholder="e.g., Wedding Invitation Cards" />
                </div>

                {/* Client Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Client</label>
                  <div className="flex gap-2">
                    <select value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} className="flex-1 px-3 py-2 border rounded-xl">
                      <option value="">Select Client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company && `(${c.company})`}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowAddClientModal(true)}
                      className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 flex items-center gap-1">
                      <UserPlus size={16} /><span className="hidden sm:inline">Add</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Job Type</label>
                  <select value={formData.job_type} onChange={(e) => setFormData({ ...formData, job_type: e.target.value })} className="w-full px-3 py-2 border rounded-xl">
                    {jobTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Product Category *</label>
                  <div className="flex gap-2">
                    <select value={formData.product_category} onChange={(e) => setFormData({ ...formData, product_category: e.target.value })} className="flex-1 px-3 py-2 border rounded-xl bg-indigo-50">
                      {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowAddCategoryModal(true)}
                      className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 flex items-center gap-1">
                      <Plus size={16} /><span className="hidden sm:inline">Add</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Used for production checklists in EOD reports</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Product Type (for Print Planner) *</label>
                  <select value={formData.product_type} onChange={(e) => setFormData({ ...formData, product_type: e.target.value })} className="w-full px-3 py-2 border rounded-xl bg-purple-50">
                    {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <p className="text-xs text-purple-600 mt-1">⚡ Jobs with same type can be batched together in print runs</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rate/Pc (₹)</label>
                    <input type="number" min="0" step="0.01" value={formData.quote_per_piece} onChange={(e) => setFormData({ ...formData, quote_per_piece: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">GST %</label>
                    <select value={formData.gst_rate} onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-xl">
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>

                {/* Amount Preview */}
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-xs text-gray-500">Subtotal</p><p className="font-semibold">{formatCurrency(formData.quantity * formData.quote_per_piece)}</p></div>
                  <div><p className="text-xs text-gray-500">GST ({formData.gst_rate}%)</p><p className="font-semibold text-blue-600">{formatCurrency(formData.quantity * formData.quote_per_piece * formData.gst_rate / 100)}</p></div>
                  <div><p className="text-xs text-gray-500">Total</p><p className="font-bold text-indigo-600">{formatCurrency(formData.quantity * formData.quote_per_piece * (1 + formData.gst_rate / 100))}</p></div>
                </div>

                {/* Designer Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Designer</label>
                  <select value={formData.designer_id} onChange={(e) => setFormData({ ...formData, designer_id: e.target.value })} className="w-full px-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select Designer</option>
                    {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                {/* Vendor Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Vendor</label>
                  <div className="flex gap-2">
                    <select value={formData.vendor_id} onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })} className="flex-1 px-3 py-2 border rounded-xl">
                      <option value="">Select Vendor</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name} {v.category && `(${v.category})`}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowAddVendorModal(true)}
                      className="px-3 py-2 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 flex items-center gap-1">
                      <UserPlus size={16} /><span className="hidden sm:inline">Add</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-3 py-2 border rounded-xl">
                      {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Current Stage</label>
                    <select value={formData.current_stage} onChange={(e) => setFormData({ ...formData, current_stage: e.target.value })} className="w-full px-3 py-2 border rounded-xl">
                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Deadline</label>
                  <input type="date" value={formData.client_deadline} onChange={(e) => setFormData({ ...formData, client_deadline: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {editingJob ? 'Update Job' : 'Create Job'}
                  </button>
                </div>
              </form>
            </div>
          </div >
        )
      }

      {/* Payment Modal */}
      {
        showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm animate-scale-in">
              <div className="p-4 border-b">
                <h3 className="font-bold text-gray-900">Add Payment</h3>
                <p className="text-sm text-gray-500">{selectedJob?.project_name}</p>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount Received</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      autoFocus
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-4 py-3 text-xl font-bold border rounded-xl focus:ring-2 focus:ring-green-500"
                    />
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="w-1/3 px-3 py-3 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / GPay</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="card">Card</option>
                    </select>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Total: {formatCurrency(selectedJob?.total_amount || 0)} |
                    Pending: {formatCurrency((selectedJob?.total_amount || 0) - (selectedJob?.amount_received || 0))}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-2 text-gray-600 border rounded-xl">Cancel</button>
                  <button onClick={submitPayment} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl">Confirm</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Centralized Client/Vendor Quick Add Modals */}
      <ClientQuickAddModal
        isOpen={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
        onSuccess={(clientId) => {
          setFormData({ ...formData, client_id: clientId });
          setShowAddClientModal(false);
        }}
      />

      <VendorQuickAddModal
        isOpen={showAddVendorModal}
        onClose={() => setShowAddVendorModal(false)}
        onSuccess={(vendorId) => {
          setFormData({ ...formData, vendor_id: vendorId });
          setShowAddVendorModal(false);
        }}
      />

      <ProductCategoryQuickAdd
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onSuccess={async () => {
          // Reload categories from database
          const { data } = await supabase
            .from('product_categories')
            .select('*')
            .eq('is_active', true)
            .order('name');
          if (data) setProductCategories(data);
          setShowAddCategoryModal(false);
        }}
      />


    </div >
  );
}
