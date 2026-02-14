'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, Briefcase, Calendar,
  IndianRupee, Edit, Trash2, X,
  AlertCircle, AlertTriangle, ChevronDown, LayoutGrid,
  List, Building2, UserPlus, Loader2,
  Layers, Printer, ArrowRight, Download, Clock, Copy, Send
} from 'lucide-react';
import {
  useJobs, useClients, useVendors, useDesigners, usePaymentsReceived
} from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { exportToCSV, JOB_COLUMNS } from '@/lib/csv-export';
import { Job, Client, Vendor, Designer, JobStatus, PaymentMode } from '@/types/database';
import { supabase } from '@/lib/supabase';
import ClientQuickAddModal from '@/components/shared/ClientQuickAddModal';
import VendorQuickAddModal from '@/components/shared/VendorQuickAddModal';
import ProductCategoryQuickAdd from '@/components/shared/ProductCategoryQuickAdd';
import JobTypeQuickAdd from '@/components/shared/JobTypeQuickAdd';

import PriorityQuickAdd from '@/components/shared/PriorityQuickAdd';
import JobStageQuickAdd from '@/components/shared/JobStageQuickAdd';
import JobTimeline from '@/components/shared/JobTimeline';
import JobFileAttachments from '@/components/shared/JobFileAttachments';
import JobProfitabilityCard from '@/components/shared/JobProfitabilityCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ✅ ALL DROPDOWNS NOW DATABASE-DRIVEN - NO HARDCODED VALUES!


export default function JobsPage() {
  const searchParams = useSearchParams();
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

  // Fallback defaults when database tables are empty
  const DEFAULT_STAGES = [
    { id: 'awaiting_admin', name: '⏳ Awaiting Approval', color: 'bg-amber-500', bg_light: 'bg-amber-50', border: 'border-amber-300', order_index: 0, is_active: true },
    { id: 'new', name: 'New', color: 'bg-gray-500', bg_light: 'bg-gray-50', border: 'border-gray-200', order_index: 1, is_active: true },
    { id: 'designing', name: 'Design', color: 'bg-purple-500', bg_light: 'bg-purple-50', border: 'border-purple-200', order_index: 2, is_active: true },
    { id: 'approval', name: 'Awaiting Client Approval', color: 'bg-yellow-500', bg_light: 'bg-yellow-50', border: 'border-yellow-200', order_index: 3, is_active: true },
    { id: 'printing', name: 'Print', color: 'bg-blue-500', bg_light: 'bg-blue-50', border: 'border-blue-200', order_index: 4, is_active: true },
    { id: 'finishing', name: 'Post Print', color: 'bg-cyan-500', bg_light: 'bg-cyan-50', border: 'border-cyan-200', order_index: 5, is_active: true },
    { id: 'quality_check', name: 'QC Check', color: 'bg-emerald-500', bg_light: 'bg-emerald-50', border: 'border-emerald-200', order_index: 6, is_active: true },
    { id: 'ready', name: 'Ready', color: 'bg-indigo-500', bg_light: 'bg-indigo-50', border: 'border-indigo-200', order_index: 7, is_active: true },
    { id: 'dispatched', name: 'Dispatched', color: 'bg-orange-500', bg_light: 'bg-orange-50', border: 'border-orange-200', order_index: 8, is_active: true },
    { id: 'delivered', name: 'Delivered', color: 'bg-green-500', bg_light: 'bg-green-50', border: 'border-green-200', order_index: 9, is_active: true },
  ];

  const DEFAULT_PRIORITIES = [
    { id: 'low', name: 'Low', color: 'bg-gray-100 text-gray-600', order_index: 1, is_active: true },
    { id: 'normal', name: 'Normal', color: 'bg-blue-100 text-blue-600', order_index: 2, is_active: true },
    { id: 'high', name: 'High', color: 'bg-orange-100 text-orange-600', order_index: 3, is_active: true },
    { id: 'urgent', name: 'Urgent', color: 'bg-red-100 text-red-600', order_index: 4, is_active: true },
  ];

  // Load ALL configuration tables from database
  useEffect(() => {
    loadAllConfig();
  }, []);

  const loadAllConfig = async () => {
    try {
      const [categoriesRes, jobTypesRes, prioritiesRes, stagesRes, machinesRes] = await Promise.all([
        supabase.from('product_categories').select('*').eq('is_active', true).order('name'),
        supabase.from('job_types').select('*').eq('is_active', true).order('name'),
        supabase.from('priorities').select('*').eq('is_active', true).order('order_index'),
        supabase.from('job_stages').select('*').eq('is_active', true).order('order_index'),
        supabase.from('machines').select('*').eq('is_active', true).order('name'),
      ]);

      if (categoriesRes.data) setProductCategories(categoriesRes.data);
      if (jobTypesRes.data) setJobTypes(jobTypesRes.data);
      if (machinesRes.data) setMachines(machinesRes.data);

      // Use DB data if available, otherwise use hardcoded fallbacks
      setPriorities(prioritiesRes.data?.length ? prioritiesRes.data : DEFAULT_PRIORITIES);
      // Ensure awaiting_admin is always in the stages list
      const dbStages = stagesRes.data?.length ? stagesRes.data : DEFAULT_STAGES;
      const hasAwaitingAdmin = dbStages.some((s: any) => s.id === 'awaiting_admin');
      if (!hasAwaitingAdmin) {
        dbStages.unshift({ id: 'awaiting_admin', name: '⏳ Awaiting Approval', color: 'bg-amber-500', bg_light: 'bg-amber-50', border: 'border-amber-300', order_index: 0, is_active: true });
      }
      setStages(dbStages);

      // Set initial form defaults
      if (jobTypesRes.data?.[0]) setFormData(prev => ({ ...prev, job_type: jobTypesRes.data[0].name }));
    } catch (error) {
      console.error('Error loading configuration:', error);
      // On error, still set fallback data so UI works
      setStages(DEFAULT_STAGES);
      setPriorities(DEFAULT_PRIORITIES);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState(searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(searchParams.get('status') ? 'list' : 'kanban');

  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddJobTypeModal, setShowAddJobTypeModal] = useState(false);

  const [showAddPriorityModal, setShowAddPriorityModal] = useState(false);
  const [showAddStageModal, setShowAddStageModal] = useState(false);
  const [showSendToPrinterModal, setShowSendToPrinterModal] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvingJob, setApprovingJob] = useState<Job | null>(null);
  const [approving, setApproving] = useState(false);

  // Database-driven configuration state
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const [jobTypes, setJobTypes] = useState<any[]>([]);

  const [priorities, setPriorities] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);

  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [expandedStages, setExpandedStages] = useState<string[]>(stages.map(s => s.id));
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [saving, setSaving] = useState(false);
  const [sendToPrinterData, setSendToPrinterData] = useState({ vendor_id: '', machine_id: '', notes: '' });
  const [sendingToPrinter, setSendingToPrinter] = useState(false);

  const [formData, setFormData] = useState({
    project_name: '', client_id: '', job_type: 'Design + Print', product_category: 'Other', quantity: 1, vendor_id: '',
    designer_id: '', client_deadline: '', priority: 'normal', quote_per_piece: 0, gst_rate: 18, current_stage: 'new',
    advance_required: true, advance_amount: 0
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
  const getPaymentBadge = (status: string) => status === 'paid' ? 'bg-gray-100 text-gray-900' : status === 'partial' ? 'bg-gray-100 text-gray-700' : 'bg-destructive/10 text-destructive';
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
        advance_required: formData.advance_required,
        advance_collected: formData.advance_amount > 0,
        advance_amount: formData.advance_amount,
        files: [],
        order_date: new Date().toISOString(),
        discount_amount: 0,
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
      project_name: '', client_id: '', job_type: 'Design + Print', product_category: 'Other', quantity: 1, vendor_id: '',
      designer_id: '', client_deadline: '', priority: 'normal', quote_per_piece: 0, gst_rate: 18, current_stage: 'new',
      advance_required: true, advance_amount: 0
    });
  };

  const handleEdit = (job: Job) => {
    setFormData({
      project_name: job.project_name,
      client_id: job.client_id || '',
      job_type: job.job_type || 'Design + Print',
      product_category: job.product_category || 'Other',
      quantity: job.quantity,
      vendor_id: job.vendor_id || '',
      designer_id: job.designer_id || '',
      client_deadline: job.client_deadline || '',
      priority: job.priority || 'normal',
      quote_per_piece: job.quote_per_piece || 0,
      gst_rate: job.gst_rate || 18,
      current_stage: job.current_stage || 'new',
      advance_required: job.advance_required !== false,
      advance_amount: job.advance_amount || 0
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

  const handleApproveDesignerProject = async (job: Job) => {
    setApprovingJob(job);
    setShowApproveDialog(true);
  };

  const confirmApproval = async () => {
    if (!approvingJob) return;
    setApproving(true);
    const { error } = await supabase
      .from('jobs')
      .update({ current_stage: 'new', updated_at: new Date().toISOString() })
      .eq('id', approvingJob.id);
    setApproving(false);
    setShowApproveDialog(false);
    setApprovingJob(null);
    if (error) {
      alert('Failed to approve: ' + error.message);
    } else {
      window.location.reload();
    }
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

  // Send to Printer — quick assign vendor + machine without creating a print run
  const handleOpenSendToPrinter = (job: Job) => {
    setSelectedJob(job);
    setSendToPrinterData({ vendor_id: job.vendor_id || '', machine_id: '', notes: '' });
    setShowSendToPrinterModal(true);
  };

  const handleSendToPrinter = async () => {
    if (!selectedJob || !sendToPrinterData.vendor_id) return;
    setSendingToPrinter(true);
    try {
      // Update job with vendor, and move to printing stage
      await updateJob(selectedJob.id, {
        vendor_id: sendToPrinterData.vendor_id,
      });
      // Move to printing stage with note
      const machineName = machines.find(m => m.id === sendToPrinterData.machine_id)?.name || '';
      const vendorName = vendors.find(v => v.id === sendToPrinterData.vendor_id)?.name || '';
      const note = `Sent to printer: ${vendorName}${machineName ? ` (Machine: ${machineName})` : ''}${sendToPrinterData.notes ? `. Note: ${sendToPrinterData.notes}` : ''}`;
      await updateJobStage(selectedJob.id, 'printing' as JobStatus, note);
      setShowSendToPrinterModal(false);
    } catch (error) {
      console.error('Error sending to printer:', error);
      alert('Error sending to printer');
    } finally {
      setSendingToPrinter(false);
    }
  };

  // Repeat Order — copies job data into a new job
  const handleRepeatOrder = (job: Job) => {
    setFormData({
      project_name: `${job.project_name} (Repeat)`,
      client_id: job.client_id || '',
      job_type: job.job_type || 'Design + Print',
      product_category: job.product_category || 'Other',
      quantity: job.quantity,
      vendor_id: job.vendor_id || '',
      designer_id: job.designer_id || '',
      client_deadline: '',
      priority: job.priority || 'normal',
      quote_per_piece: job.quote_per_piece || 0,
      gst_rate: job.gst_rate || 18,
      current_stage: 'new',
      advance_required: true,
      advance_amount: 0
    });
    setEditingJob(null); // This is a NEW job, not editing
    setShowModal(true);
  };

  if (loading && !forceShow) {
    return (
      <div className="flex items-center justify-center p-44">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading jobs...</span>
      </div>
    );
  }

  // JobCard Component 
  const JobCard = ({ job }: { job: Job }) => (
    <div
      className={`group bg-white rounded-lg md:rounded-lg p-3 md:p-4   transition-all duration-300 hover:-translate-y-1 border border-transparent hover:border-gray-100 ring-1 ring-black/5 cursor-pointer relative overflow-hidden ${isOverdue(job.client_deadline, job.current_stage) ? 'ring-red-100 bg-red-50/30' : ''
        }`}
      onClick={() => handleViewDetail(job)}
    >
      {/* Overdue Indicator Strip */}
      {isOverdue(job.client_deadline, job.current_stage) && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
      )}

      <div className="flex items-start justify-between mb-3">
        <Badge className={getPriorityBadge(job.priority)}>
          {job.priority.toUpperCase()}
        </Badge>
        <Badge variant="default" className="font-mono">
          {job.job_number}
        </Badge>
      </div>

      <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
        {job.project_name}
      </h4>

      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-4 h-4 text-gray-400" />
        <p className="text-sm text-gray-500 truncate">{job.client?.name || 'No client'}</p>
      </div>

      {/* Advance Warning Badge */}
      {job.advance_required !== false && !job.advance_collected && job.current_stage !== 'new' && (
        <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700">No advance collected</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-100 text-gray-500">
        <Badge variant="outline" className={getPaymentBadge(job.payment_status)}>
          {formatCurrency(job.amount_received)} / {formatCurrency(job.total_amount)}
        </Badge>

        {job.client_deadline && (
          <span className={`flex items-center gap-1.5 font-medium ${isOverdue(job.client_deadline, job.current_stage) ? 'text-red-600' : 'text-gray-400'}`}>
            <Calendar className="w-4 h-4" />
            {formatDate(job.client_deadline)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-3 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); handleEdit(job); }}
          title="Edit"
        >
          <Edit />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); handleRepeatOrder(job); }}
          title="Repeat Order"
        >
          <Copy />
        </Button>
        {job.current_stage === 'awaiting_admin' && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleApproveDesignerProject(job); }}
            title="Approve & Activate"
            className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1"
          >
            ✅ Approve
          </Button>
        )}
        {!['printing', 'finishing', 'quality_check', 'ready', 'dispatched', 'delivered'].includes(job.current_stage) && (
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); handleOpenSendToPrinter(job); }}
            title="Send to Printer"
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          >
            <Send />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); handleAddPayment(job); }}
          title="Add Payment"
        >
          <IndianRupee />
        </Button>
        <Button
          size="icon"
          variant="destructive"
          onClick={(e) => { e.stopPropagation(); handleDelete(job.id); }}
          title="Delete"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 md:space-y-6 lg:space-y-8 animate-fade-in px-2 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h1 className="text-page-title text-gray-900 tracking-tight">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">{activeJobs} active of {totalJobs} total jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filteredJobs, JOB_COLUMNS, 'jobs_export')} title="Export as CSV">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button onClick={handleAddNew}>
            <Plus />
            New Job
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-lg p-3 md:p-5 border border-gray-100 ">
          <p className="text-xs md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Total Jobs</p>
          <p className="text-page-title text-gray-900">{totalJobs}</p>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-5 border border-gray-100 ">
          <p className="text-xs md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Active</p>
          <p className="text-page-title text-primary">{activeJobs}</p>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-5 border border-gray-100 ">
          <p className="text-xs md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Revenue</p>
          <p className="text-page-title text-gray-900 truncate" title={formatCurrency(totalRevenue)}>
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-5 border border-gray-100 ">
          <p className="text-xs md:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 md:mb-2">Pending</p>
          <p className="text-page-title text-destructive truncate" title={formatCurrency(pendingPayments)}>
            {formatCurrency(pendingPayments)}
          </p>
        </div>
      </div>


      {/* Print Production Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
        <Link href="/admin/print-planner" className="flex items-center gap-2 md:gap-4 bg-white p-5 rounded-lg border border-gray-100 hover:border-primary/20 transition-all group">
          <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center transition-colors">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Print Planner</h3>
            <p className="text-sm text-gray-500">Create production batches</p>
          </div>
          <ArrowRight className="w-5 h-5 ml-auto text-gray-300 group-hover:text-primary" />
        </Link>
        <Link href="/admin/production-queue" className="flex items-center gap-2 md:gap-4 bg-white p-5 rounded-lg border border-gray-100 hover:border-primary/20 transition-all group">
          <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center transition-colors">
            <Printer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Production Queue</h3>
            <p className="text-sm text-gray-500">Track job status</p>
          </div>
          <ArrowRight className="w-5 h-5 ml-auto text-gray-300 group-hover:text-primary" />
        </Link>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col xl:flex-row gap-3 md:gap-4 bg-white p-3 md:p-4 rounded-lg border border-gray-100">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search jobs, clients, or numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {priorities.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as 'kanban' | 'list')}
            size="sm"
            className="gap-0"
          >
            <ToggleGroupItem value="kanban" aria-label="Grid view" className="h-9 w-9 p-0">
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="h-9 w-9 p-0">
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Empty State */}
      {
        filteredJobs.length === 0 && (
          <div className="text-center py-24 bg-white rounded-lg border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-section text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-500 mb-3 md:mb-1.5 max-w-sm mx-auto">
              {searchTerm ? 'Try adjusting your search terms or filters.' : 'Get started by creating your first job.'}
            </p>
            <Button onClick={handleAddNew}>
              <Plus />
              Create New Job
            </Button>
          </div>
        )
      }

      {/* Kanban View */}
      {
        viewMode === 'kanban' && filteredJobs.length > 0 && (
          <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)] items-start">
            {stages.map(stage => {
              const stageJobs = jobsByStage[stage.id] || [];
              return (
                <div key={stage.id} className="min-w-[300px] w-80 flex-shrink-0 bg-white/50 rounded-lg border border-gray-200 flex flex-col max-h-full ">
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
                      stageJobs.map((job: Job) => <JobCard key={job.id} job={job} />)
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
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-white border-b">
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
                  {filteredJobs.map((job: Job) => (
                    <tr key={job.id} className="hover:bg-white cursor-pointer" onClick={() => handleViewDetail(job)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-primary">{job.job_number}</span>
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
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(job)} title="Edit">
                            <Edit />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleRepeatOrder(job)} title="Repeat Order">
                            <Copy />
                          </Button>
                          {!['printing', 'finishing', 'quality_check', 'ready', 'dispatched', 'delivered'].includes(job.current_stage) && (
                            <Button size="icon" variant="ghost" onClick={() => handleOpenSendToPrinter(job)} title="Send to Printer" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                              <Send />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => handleAddPayment(job)} title="Add Payment">
                            <IndianRupee />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => handleDelete(job.id)} title="Delete">
                            <Trash2 />
                          </Button>
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
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingJob ? 'Edit Job' : 'New Job'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project_name">Project Name *</Label>
                <Input
                  id="project_name"
                  type="text"
                  required
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="e.g., Wedding Invitation Cards"
                />
              </div>

              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Client</label>
                <div className="flex gap-2">
                  <select value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} className="flex-1 px-3 py-2 border rounded-md">
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company && `(${c.company})`}</option>)}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddClientModal(true)}
                  >
                    <Plus />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Job Type</label>
                <div className="flex gap-2">
                  <select value={formData.job_type} onChange={(e) => setFormData({ ...formData, job_type: e.target.value })} className="flex-1 px-3 py-2 border rounded-md">
                    {jobTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddJobTypeModal(true)}
                  >
                    <Plus />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Product Category *</label>
                <div className="flex gap-2">
                  <select value={formData.product_category} onChange={(e) => setFormData({ ...formData, product_category: e.target.value })} className="flex-1 px-3 py-2 border rounded-md">
                    {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddCategoryModal(true)}
                  >
                    <Plus />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Used for production checklists, QC, and card tags</p>
              </div>

              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rate/Pc (₹)</label>
                  <input type="number" min="0" step="0.01" value={formData.quote_per_piece} onChange={(e) => setFormData({ ...formData, quote_per_piece: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">GST %</label>
                  <select value={formData.gst_rate} onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-md">
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              {/* Amount Preview */}
              <div className="bg-white rounded-lg p-4 grid grid-cols-3 gap-2 md:gap-4 text-center">
                <div><p className="text-xs text-gray-500">Subtotal</p><p className="font-semibold">{formatCurrency(formData.quantity * formData.quote_per_piece)}</p></div>
                <div><p className="text-xs text-gray-500">GST ({formData.gst_rate}%)</p><p className="font-semibold text-foreground">{formatCurrency(formData.quantity * formData.quote_per_piece * formData.gst_rate / 100)}</p></div>
                <div><p className="text-xs text-gray-500">Total</p><p className="font-bold text-primary">{formatCurrency(formData.quantity * formData.quote_per_piece * (1 + formData.gst_rate / 100))}</p></div>
              </div>

              {/* Designer Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Designer</label>
                <select value={formData.designer_id} onChange={(e) => setFormData({ ...formData, designer_id: e.target.value })} className="w-full px-3 py-2 border rounded-md bg-white focus:ring-2 focus:ring-gray-400">
                  <option value="">Select Designer</option>
                  {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Vendor Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Vendor</label>
                <div className="flex gap-2">
                  <select value={formData.vendor_id} onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })} className="flex-1 px-3 py-2 border rounded-md">
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name} {v.category && `(${v.category})`}</option>)}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowAddVendorModal(true)}
                  >
                    <Plus />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <div className="flex gap-2">
                    <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="flex-1 px-3 py-2 border rounded-md">
                      {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={() => setShowAddPriorityModal(true)}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Current Stage</label>
                  <div className="flex gap-2">
                    <select value={formData.current_stage} onChange={(e) => setFormData({ ...formData, current_stage: e.target.value })} className="flex-1 px-3 py-2 border rounded-md">
                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={() => setShowAddStageModal(true)}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Deadline</label>
                <input type="date" value={formData.client_deadline} onChange={(e) => setFormData({ ...formData, client_deadline: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
              </div>

              {/* Advance Payment Section */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-amber-600" />
                    Advance Payment Required
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, advance_required: !formData.advance_required })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${formData.advance_required ? 'bg-amber-500' : 'bg-gray-300'
                      }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.advance_required ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                  </button>
                </div>
                {formData.advance_required && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Advance Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.advance_amount}
                      onChange={(e) => setFormData({ ...formData, advance_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="Enter advance amount collected"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    {formData.quantity > 0 && formData.quote_per_piece > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        50% of total = {formatCurrency(formData.quantity * formData.quote_per_piece * (1 + formData.gst_rate / 100) * 0.5)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1"
                >
                  {saving && <Loader2 className="animate-spin" />}
                  {editingJob ? 'Update Job' : 'Create Job'}
                </Button>
              </div>
            </form>

            {/* File Attachments - only when editing */}
            {editingJob && (
              <div className="mt-6 pt-4 border-t">
                <JobFileAttachments
                  jobId={editingJob.id}
                  files={editingJob.files || []}
                  onFilesUpdated={(updatedFiles) => {
                    setEditingJob({ ...editingJob, files: updatedFiles });
                  }}
                />
              </div>
            )}

            {/* Job Profitability - only when editing */}
            {editingJob && (
              <div className="mt-6 pt-4 border-t">
                <JobProfitabilityCard
                  jobId={editingJob.id}
                  totalAmount={editingJob.total_amount || 0}
                  amountReceived={editingJob.amount_received || 0}
                />
              </div>
            )}

            {/* Timeline - only show when editing */}
            {editingJob && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Stage History
                </h3>
                <JobTimeline jobId={editingJob.id} stages={stages} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      }

      {/* Payment Modal */}
      {
        showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-sm animate-scale-in">
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
                      className="flex-1 px-4 py-3 text-section border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="w-1/3 px-3 py-3 border rounded-lg bg-white focus:ring-2 focus:ring-gray-400"
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
                  <Button variant="outline" onClick={() => setShowPaymentModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={submitPayment} className="flex-1">
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Send to Printer Modal */}
      {showSendToPrinterModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md animate-scale-in">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Send className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Send to Printer</h3>
                <p className="text-sm text-gray-500">{selectedJob.job_number} — {selectedJob.project_name}</p>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Vendor Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Vendor / Printer *</label>
                <select
                  value={sendToPrinterData.vendor_id}
                  onChange={(e) => setSendToPrinterData({ ...sendToPrinterData, vendor_id: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name} {v.category && `(${v.category})`}</option>)}
                </select>
              </div>

              {/* Machine Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Machine (optional)</label>
                <select
                  value={sendToPrinterData.machine_id}
                  onChange={(e) => setSendToPrinterData({ ...sendToPrinterData, machine_id: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select Machine</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  value={sendToPrinterData.notes}
                  onChange={(e) => setSendToPrinterData({ ...sendToPrinterData, notes: e.target.value })}
                  placeholder="Any special instructions..."
                  className="w-full px-3 py-2.5 border rounded-lg h-20 focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Job Info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <div className="flex justify-between"><span>Client:</span><span className="font-medium text-gray-900">{selectedJob.client?.name || 'N/A'}</span></div>
                <div className="flex justify-between mt-1"><span>Quantity:</span><span className="font-medium text-gray-900">{selectedJob.quantity}</span></div>
                <div className="flex justify-between mt-1"><span>Current Stage:</span><span className="font-medium text-gray-900">{stages.find(s => s.id === selectedJob.current_stage)?.name || selectedJob.current_stage}</span></div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowSendToPrinterModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSendToPrinter}
                  disabled={!sendToPrinterData.vendor_id || sendingToPrinter}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {sendingToPrinter && <Loader2 className="animate-spin" />}
                  <Send className="w-4 h-4" />
                  Send to Print
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Designer Project Dialog */}
      {showApproveDialog && approvingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !approving && setShowApproveDialog(false)}>
          <div className="bg-white rounded-lg w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✅</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Approve Project?</h3>
              <p className="text-sm text-gray-600 mb-1">
                <strong>{approvingJob.job_number}</strong> — {approvingJob.project_name}
              </p>
              <p className="text-xs text-gray-400">This will activate the project for the designer to start work.</p>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowApproveDialog(false); setApprovingJob(null); }}
                disabled={approving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={confirmApproval}
                disabled={approving}
              >
                {approving ? 'Approving...' : 'Approve & Activate'}
              </Button>
            </div>
          </div>
        </div>
      )}

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


      {/* Job Type Quick Add */}
      <JobTypeQuickAdd
        isOpen={showAddJobTypeModal}
        onClose={() => setShowAddJobTypeModal(false)}
        onSuccess={loadAllConfig}
      />



      {/* Priority Quick Add */}
      <PriorityQuickAdd
        isOpen={showAddPriorityModal}
        onClose={() => setShowAddPriorityModal(false)}
        onSuccess={loadAllConfig}
      />

      {/* Job Stage Quick Add */}
      <JobStageQuickAdd
        isOpen={showAddStageModal}
        onClose={() => setShowAddStageModal(false)}
        onSuccess={loadAllConfig}
      />

    </div >
  );
}

