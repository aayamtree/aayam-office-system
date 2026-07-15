'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/lib/toast';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, Briefcase, Calendar,
  IndianRupee, Edit, Trash2, X,
  AlertCircle, AlertTriangle, ChevronDown, LayoutGrid,
  List, Building2, UserPlus, Loader2,
  Layers, Printer, ArrowRight, Download, Clock, Copy, Send, Paperclip, Upload
} from 'lucide-react';
import {
  useJobs, useClients, useVendors, useDesigners, usePaymentsReceived, autoSetCommissionEligible,
  useBankAccounts, useCashAccounts
} from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { exportToCSV, JOB_COLUMNS } from '@/lib/csv-export';
import { Job, Client, Vendor, Designer, JobStatus, PaymentMode } from '@/types/database';
import { supabase } from '@/lib/supabase';
import ClientQuickAddModal from '@/components/shared/ClientQuickAddModal';
import VendorQuickAddModal from '@/components/shared/VendorQuickAddModal';
import ProductCategoryQuickAdd from '@/components/shared/ProductCategoryQuickAdd';
import JobTypeQuickAdd from '@/components/shared/JobTypeQuickAdd';
import { useConfirm } from '@/components/ConfirmModal';
import { getNextStage, getAdvanceLabel, getStageName, getStageColor, getStagesForJobType, normalizeJobType } from '@/lib/job-workflow';

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
import UnifiedJobForm from '@/components/jobs/UnifiedJobForm';

// ✅ ALL DROPDOWNS NOW DATABASE-DRIVEN - NO HARDCODED VALUES!

// PERF: Create formatter once — reused on every call instead of creating a new instance each time
const _currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const formatCurrency = (amount: number) => _currencyFormatter.format(amount || 0);
const getPaymentBadge = (status: string) => status === 'paid' ? 'bg-gray-100 text-gray-900' : status === 'partial' ? 'bg-gray-100 text-gray-700' : 'bg-destructive/10 text-destructive';
const isOverdue = (deadline: string | undefined, stage: string) => deadline && stage !== 'delivered' && new Date(deadline) < new Date();
// UI: strip leading emoji/symbols from advance-stage labels (keeps full wording, e.g. "Move to Brief & Assets")
const stripEmoji = (label: string) => label.replace(/^[^A-Za-z0-9]+/, '');

interface JobCardProps {
  job: Job;
  getPriorityBadge: (priority: string) => string;
  onViewDetail: (job: Job) => void;
  onEdit: (job: Job) => void;
  onRepeatOrder: (job: Job) => void;
  onApproveDesignerProject: (job: Job) => void;
  onOpenSendToPrinter: (job: Job) => void;
  onStageChange: (id: string, stage: string) => void;
  onAddPayment: (job: Job) => void;
  onDelete: (id: string) => void;
}

const JobCard = React.memo(function JobCard({ job, getPriorityBadge, onViewDetail, onEdit, onRepeatOrder, onApproveDesignerProject, onOpenSendToPrinter, onStageChange, onAddPayment, onDelete }: JobCardProps) {
  const overdue = useMemo(() => isOverdue(job.client_deadline, job.current_stage), [job.client_deadline, job.current_stage]);
  const headerBg = useMemo(() => overdue ? 'bg-red-600' : job.priority === 'urgent' ? 'bg-gray-900' : job.priority === 'high' ? 'bg-gray-800' : 'bg-gray-700', [overdue, job.priority]);
  return (
    <div
      className="bg-white rounded-md overflow-hidden border border-gray-200 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => onViewDetail(job)}
    >
      {/* Dark header */}
      <div className={`${headerBg} px-3 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-1.5">
          <Badge className={getPriorityBadge(job.priority || '')} style={{ fontSize: '9px', padding: '1px 5px' }}>
            {(job.priority || 'normal').toUpperCase()}
          </Badge>
          {overdue && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/25 text-white">OVERDUE</span>}
        </div>
        <Badge variant="default" className="font-mono text-[10px]">{job.job_number}</Badge>
      </div>

      {/* Body */}
      <div className="p-3">
        {job.advance_required !== false && !job.advance_collected && job.current_stage !== 'new' && (
          <div className="flex items-center gap-1 mb-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-700">No advance</span>
          </div>
        )}
        <h4 className="font-semibold text-gray-900 mb-0.5 line-clamp-2 leading-snug text-sm">{job.project_name}</h4>
        {(job as any).product_category && (
          <div className="flex items-center gap-1 mb-1.5 flex-wrap">
            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-900 text-white tracking-wide">
              {(job as any).product_category}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-2">
          <Building2 className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs text-gray-500 truncate">{(job.client as any)?.company || job.client?.name || 'No client'}</p>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-2">
          <Badge variant="outline" className={getPaymentBadge(job.payment_status)}>
            {formatCurrency(job.amount_received)} / {formatCurrency(job.total_amount)}
          </Badge>
          <div className="flex items-center gap-1.5">
            {job.files && job.files.length > 0 && (
              <span className="flex items-center gap-0.5 text-gray-500" title={`${job.files.length} file(s)`}>
                <Paperclip className="w-3 h-3" />
                <span className="text-xs font-bold">{job.files.length}</span>
              </span>
            )}
            {job.client_deadline && (
              <span className={`flex items-center gap-1 font-medium ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(job.client_deadline)}
              </span>
            )}
          </div>
        </div>
        {/* Stage Actions */}
        <div className="flex flex-wrap items-center justify-end gap-1 mt-2 pt-1.5 border-t border-gray-100">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(job); }} title="Edit"><Edit className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onRepeatOrder(job); }} title="Repeat"><Copy className="w-3.5 h-3.5" /></Button>
          {job.current_stage === 'awaiting_admin' && (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onApproveDesignerProject(job); }} className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1 h-6 px-2">✅ Approve</Button>
          )}
          {/* Smart next-stage advance button */}
          {!['awaiting_admin', 'delivered', 'cancelled'].includes(job.current_stage) && (() => {
            const next = getNextStage(normalizeJobType(job.job_type), job.current_stage);
            const label = getAdvanceLabel(normalizeJobType(job.job_type), job.current_stage);
            if (!next) return null;
            if (next === 'printing') {
              return (
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenSendToPrinter(job); }} title={label} className="text-orange-600 hover:text-orange-700"><Send className="w-3.5 h-3.5" /></Button>
              );
            }
            return (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); onStageChange(job.id, next); }} className="text-[10px] h-6 px-2 max-w-full bg-gray-800 text-white hover:bg-gray-700" title={label}>
                <ArrowRight className="w-3 h-3 mr-0.5 flex-shrink-0" /><span className="truncate">{stripEmoji(label)}</span>
              </Button>
            );
          })()}
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onAddPayment(job); }} title="Payment"><IndianRupee className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="destructive" onClick={(e) => { e.stopPropagation(); onDelete(job.id); }} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
    </div>
  );
});

export default function JobsPage() {
  const searchParams = useSearchParams();
  // PERF: Limit to 500 most recent jobs — prevents full table scan on large datasets.
  // Jobs page uses client-side filter/search on this set, which covers all practical needs.
  const { jobs, loading: jobsLoading, createJob, updateJob, deleteJob, updateJobStage, refetch: refetchJobs } = useJobs({ limit: 500 });
  const { clients, createClient } = useClients();
  const { vendors, createVendor } = useVendors();
  const { designers } = useDesigners();
  const { createPaymentReceived } = usePaymentsReceived();
  const { bankAccounts } = useBankAccounts();
  const { cashAccounts } = useCashAccounts();

  const loading = jobsLoading; // Main loading state
  const confirm = useConfirm();

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
    { id: 'file_check', name: 'File Check', color: 'bg-purple-500', bg_light: 'bg-purple-50', border: 'border-purple-200', order_index: 2, is_active: true },
    { id: 'designing', name: 'Design', color: 'bg-purple-500', bg_light: 'bg-purple-50', border: 'border-purple-200', order_index: 3, is_active: true },
    { id: 'approval', name: 'Awaiting Client Approval', color: 'bg-yellow-500', bg_light: 'bg-yellow-50', border: 'border-yellow-200', order_index: 4, is_active: true },
    { id: 'pre_print_qc', name: 'Pre Print QC', color: 'bg-cyan-500', bg_light: 'bg-cyan-50', border: 'border-cyan-200', order_index: 5, is_active: true },
    { id: 'printing', name: 'Print', color: 'bg-blue-500', bg_light: 'bg-blue-50', border: 'border-blue-200', order_index: 6, is_active: true },
    { id: 'finishing', name: 'Post Print', color: 'bg-cyan-500', bg_light: 'bg-cyan-50', border: 'border-cyan-200', order_index: 7, is_active: true },
    { id: 'quality_check', name: 'QC Check', color: 'bg-emerald-500', bg_light: 'bg-emerald-50', border: 'border-emerald-200', order_index: 8, is_active: true },
    { id: 'ready', name: 'Ready', color: 'bg-indigo-500', bg_light: 'bg-indigo-50', border: 'border-indigo-200', order_index: 9, is_active: true },
    { id: 'dispatched', name: 'Dispatched', color: 'bg-orange-500', bg_light: 'bg-orange-50', border: 'border-orange-200', order_index: 10, is_active: true },
    { id: 'delivered', name: 'Delivered', color: 'bg-green-500', bg_light: 'bg-green-50', border: 'border-green-200', order_index: 11, is_active: true },
    { id: 'cancelled', name: 'Cancelled', color: 'bg-red-500', bg_light: 'bg-red-50', border: 'border-red-200', order_index: 12, is_active: true },
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
    } catch (error: any) {
      toast.error('Failed to load job configuration. Using defaults.');
      // On error, still set fallback data so UI works
      setStages(DEFAULT_STAGES);
      setPriorities(DEFAULT_PRIORITIES);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState(searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || 'all');
  // Auto-default to list on mobile (< lg), kanban on desktop
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    if (searchParams.get('status') || searchParams.get('client')) return 'list';
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return 'list';
    return 'kanban';
  });

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
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendToPrinterData, setSendToPrinterData] = useState({ vendor_id: '', machine_id: '', notes: '' });
  const [sendingToPrinter, setSendingToPrinter] = useState(false);

  const [formData, setFormData] = useState({
    project_name: '', client_id: '', job_type: 'Design + Print', product_category: 'Other', quantity: 1, vendor_id: '',
    designer_id: '', client_deadline: '', priority: 'normal', quote_per_piece: 0, design_charge: 0, gst_rate: 18, current_stage: 'new',
    advance_required: true, advance_amount: 0, advance_payment_mode: 'cash', advance_receipt_url: ''
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Quick add forms
  const [newClient, setNewClient] = useState({ name: '', company: '', phone: '', city: '' });
  const [newVendor, setNewVendor] = useState({ name: '', company: '', phone: '', category: 'Paper' });

  // Quick Add Client
  const handleAddClient = async () => {
    if (!newClient.name || !newClient.phone) return toast.error('Name and Phone are required');

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
    if (!newVendor.name || !newVendor.phone) return toast.error('Name and Phone are required');

    const result = await createVendor({
      ...newVendor,
      is_active: true,
      email: '',
      gstin: '',
      address: '',
      city: '',
      state: 'Gujarat',
      payment_terms: 0, // Default 0 days
      outstanding_balance: 0
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
    const clientName = (job.client as any)?.company || job.client?.name || '';
    const matchesSearch = (job.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.job_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const getPriorityBadge = useCallback((priority: string) => priorities.find(p => p.id === priority)?.color || 'bg-gray-100 text-gray-600', [priorities]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const jobType = formData.job_type;
      const isDesign = jobType === 'Design Only' || jobType === 'Design + Print';
      const isPrint = jobType === 'Print Only' || jobType === 'Design + Print';

      const printSubtotal = isPrint ? formData.quantity * formData.quote_per_piece : 0;
      const designSubtotal = isDesign ? formData.design_charge : 0;
      const subtotal = printSubtotal + designSubtotal;
      const gstAmount = subtotal * (formData.gst_rate / 100);
      const totalAmount = subtotal + gstAmount;

      const jobData = {
        project_name: formData.project_name,
        client_id: formData.client_id || undefined,
        vendor_id: formData.vendor_id || undefined,
        designer_id: formData.designer_id || undefined,
        job_type: formData.job_type as 'Print Only' | 'Design Only' | 'Design + Print' | undefined,
        product_category: formData.product_category,
        quantity: formData.quantity,
        quote_per_piece: formData.quote_per_piece,
        design_charge: formData.design_charge,
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
        advance_payment_mode: formData.advance_amount > 0 ? formData.advance_payment_mode : undefined,
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
        toast.error(String('Failed to save job: ' + result.error));
        setSaving(false);
        return;
      }

      // If advance was collected, record it as a real payment in the financial system
      if (formData.advance_amount > 0 && result.data?.id) {
        const jobId = result.data.id;
        const clientId = formData.client_id || undefined;
        const paymentRecordResult = await createPaymentReceived({
          job_id: jobId,
          client_id: clientId,
          amount: formData.advance_amount,
          payment_mode: formData.advance_payment_mode as any,
          payment_date: new Date().toISOString().split('T')[0],
          notes: `Advance payment collected at job creation (${formData.advance_payment_mode.replace('_', ' ').toUpperCase()})`,
          attachment_url: formData.advance_receipt_url || undefined,
        });
        if (paymentRecordResult?.error) {
          toast.warning?.('Advance payment recorded but finance ledger entry may be missing.');
        }
        // Update job: set amount_received + payment_status
        const paymentStatus = formData.advance_amount >= totalAmount - 1 ? 'paid' : 'partial';
        await updateJob(jobId, {
          amount_received: formData.advance_amount,
          payment_status: paymentStatus as any,
          advance_collected: true,
        });
      }

      setShowModal(false);
      setEditingJob(null);
      resetForm();
    } catch (error: any) {
      toast.error('Error saving job: ' + (error.message || 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_name: '', client_id: '', job_type: 'Design + Print', product_category: 'Other', quantity: 1, vendor_id: '',
      designer_id: '', client_deadline: '', priority: 'normal', quote_per_piece: 0, design_charge: 0, gst_rate: 18, current_stage: 'new',
      advance_required: true, advance_amount: 0, advance_payment_mode: 'cash', advance_receipt_url: ''
    });
  };

  const handleEdit = useCallback(async (job: Job) => {
    // Fetch the FULL job record — the list view only loads lightweight fields
    // (no quantity, quote_per_piece, vendor_id, designer_id, gst_rate, etc.)
    const { data: fullJob } = await supabase
      .from('jobs')
      .select('*, client:clients(id, name, company), vendor:vendors(id, name)')
      .eq('id', job.id)
      .single();
    setEditingJob((fullJob as any) || job);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete Job', message: 'Are you sure you want to delete this job?', variant: 'danger', confirmLabel: 'Delete' });
    if (!confirmed) return;
    await deleteJob(id);
  }, [confirm, deleteJob]);

  const handleStageChange = useCallback(async (jobId: string, newStage: string) => {
    await updateJobStage(jobId, newStage as JobStatus);
  }, [updateJobStage]);

  const handleApproveDesignerProject = useCallback(async (job: Job) => {
    setApprovingJob(job);
    setShowApproveDialog(true);
  }, []);

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
      toast.error(String('Failed to approve: ' + error.message));
    } else {
      refetchJobs();
    }
  };

  const handleAddPayment = (job: Job) => {
    setSelectedJob(job);
    setPaymentAmount(0);
    setPaymentAccountId('');
    setPaymentMode('cash');
    setShowPaymentModal(true);
  };

  // Single "Pay To" dropdown: pick the cash/bank account the money actually
  // landed in; payment mode is derived automatically so the ledger stays in sync.
  const handlePaymentAccountChange = (id: string) => {
    const isCash = cashAccounts.some((a: any) => a.id === id);
    setPaymentAccountId(id);
    setPaymentMode(isCash ? 'cash' : 'bank_transfer');
  };

  const submitPayment = async () => {
    if (!selectedJob || paymentAmount <= 0) return;
    if (!paymentAccountId) {
      toast.error('Please select which account received the payment');
      return;
    }

    try {
      const isCash = cashAccounts.some((a: any) => a.id === paymentAccountId);
      // 1. Record detailed payment history — also posts to the cash/bank
      // ledger (balance update + transaction row) via record_payment_received.
      await createPaymentReceived({
        job_id: selectedJob.id,
        client_id: selectedJob.client_id,
        amount: paymentAmount,
        payment_mode: paymentMode,
        payment_date: new Date().toISOString().split('T')[0], // today
        cash_account_id: isCash ? paymentAccountId : undefined,
        bank_account_id: isCash ? undefined : paymentAccountId,
      } as any);

      // 2. Update job aggregate — atomic DB-side increment (prevents race condition on double-click / concurrent payments)
      await supabase.rpc('increment_job_amount_received', {
        job_id: selectedJob.id,
        increment_by: paymentAmount
      });

      // Re-fetch the job to get updated payment_status for commission check
      const { data: updatedJob } = await supabase
        .from('jobs')
        .select('payment_status')
        .eq('id', selectedJob.id)
        .single();

      if (updatedJob?.payment_status === 'paid') {
        await autoSetCommissionEligible(selectedJob.id);
      }

      setShowPaymentModal(false);
      setSelectedJob(null);
      setPaymentMode('cash');
      setPaymentAccountId('');
    } catch (error: any) {
      toast.error('Error adding payment: ' + (error.message || 'Please try again.'));
    }
  };

  const handleViewDetail = useCallback((job: Job) => {
    handleEdit(job);
  }, [handleEdit]);

  const handleAddNew = () => {
    resetForm();
    setEditingJob(null);
    setShowModal(true);
  };

  // Send to Printer — quick assign vendor + machine without creating a print run
  const handleOpenSendToPrinter = useCallback((job: Job) => {
    setSelectedJob(job);
    setSendToPrinterData({ vendor_id: job.vendor_id || '', machine_id: '', notes: '' });
    setShowSendToPrinterModal(true);
  }, []);

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
    } catch (error: any) {
      toast.error('Error sending to printer: ' + (error.message || 'Please try again.'));
    } finally {
      setSendingToPrinter(false);
    }
  };

  // Repeat Order — copies job data into a new job
  const handleRepeatOrder = useCallback((job: Job) => {
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
      design_charge: job.design_charge || 0,
      gst_rate: job.gst_rate || 18,
      current_stage: 'new',
      advance_required: true,
      advance_amount: 0,
      advance_payment_mode: 'cash',
      advance_receipt_url: ''
    });
    setEditingJob(null); // This is a NEW job, not editing
    setShowModal(true);
  }, []);

  if (loading && !forceShow) {
    return (
      <div className="space-y-4 px-2 pt-4">
        {/* Stats skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-md p-3 space-y-2 animate-pulse">
              <div className="flex items-center gap-2"><div className="h-4 w-4 bg-gray-200 rounded-sm" /><div className="h-3 w-16 bg-gray-200 rounded" /></div>
              <div className="h-7 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        {/* Mobile card skeletons */}
        <div className="sm:hidden space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="h-8 bg-gray-300" />
              <div className="px-3 py-2.5 space-y-2">
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="h-3 w-1/2 bg-gray-200 rounded" />
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <div className="h-5 w-28 bg-gray-200 rounded" />
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop table skeleton */}
        <div className="hidden sm:block bg-white rounded-md border overflow-hidden animate-pulse">
          <div className="h-10 bg-gray-50 border-b" />
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b">
              <div className="flex-1 space-y-1"><div className="h-3 w-24 bg-gray-200 rounded" /><div className="h-4 w-48 bg-gray-200 rounded" /></div>
              <div className="h-4 w-24 bg-gray-200 rounded self-center" />
              <div className="h-5 w-20 bg-gray-200 rounded self-center" />
              <div className="h-5 w-28 bg-gray-200 rounded self-center" />
              <div className="h-4 w-20 bg-gray-200 rounded self-center" />
              <div className="flex gap-1 self-center">{[1, 2, 3, 4].map(j => <div key={j} className="h-7 w-7 bg-gray-200 rounded" />)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

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

      {/* Stats Cards — Job Queue style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-white" />
            <span className="text-xs text-white font-medium">Total Jobs</span>
          </div>
          <p className="text-page-title text-white">{totalJobs}</p>
        </div>
        <div className="bg-muted border border-border rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <Layers className="w-4 h-4 text-foreground" />
            <span className="text-xs text-foreground font-medium">Active</span>
          </div>
          <p className="text-page-title text-foreground">{activeJobs}</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <IndianRupee className="w-4 h-4 text-gray-900" />
            <span className="text-xs text-gray-900 font-medium">Revenue</span>
          </div>
          <p className="text-page-title text-gray-900 truncate" title={formatCurrency(totalRevenue)}>{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-2 md:p-3">
          <div className="flex items-center gap-1 md:gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-red-600 font-medium">Pending</span>
          </div>
          <p className="text-page-title text-red-700 truncate" title={formatCurrency(pendingPayments)}>{formatCurrency(pendingPayments)}</p>
        </div>
      </div>


      {/* Print Production Links — compact dark header cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/admin/print-planner" className="bg-white rounded-md overflow-hidden border border-gray-200 hover:shadow-sm transition-all">
          <div className="bg-gray-900 px-3 py-2 flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <span className="text-white font-semibold text-sm">Print Planner</span>
            <ArrowRight className="w-4 h-4 text-white/60 ml-auto" />
          </div>
          <div className="p-3"><p className="text-gray-500 text-sm">Create production batches</p></div>
        </Link>
        <Link href="/admin/production-queue" className="bg-white rounded-md overflow-hidden border border-gray-200 hover:shadow-sm transition-all">
          <div className="bg-gray-700 px-3 py-2 flex items-center gap-2">
            <Printer className="w-4 h-4 text-white" />
            <span className="text-white font-semibold text-sm">Production Queue</span>
            <ArrowRight className="w-4 h-4 text-white/60 ml-auto" />
          </div>
          <div className="p-3"><p className="text-gray-500 text-sm">Track job status</p></div>
        </Link>
      </div>

      {/* Filters — inline, no white box */}
      <div className="flex flex-col xl:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search jobs, clients, or numbers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="text-center py-24 bg-white rounded-md border border-dashed border-gray-300">
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
                <div key={stage.id} className="min-w-[300px] w-80 flex-shrink-0 bg-white/50 rounded-md border border-gray-200 flex flex-col max-h-full ">
                  {/* Column Header */}
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-xl sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                      <span className="font-bold text-gray-700 text-sm">{stage.name}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded-md text-xs text-gray-600 font-medium">{stageJobs.length}</span>
                    </div>
                  </div>

                  {/* Cards List */}
                  <div className="p-3 space-y-3 overflow-y-auto">
                    {stageJobs.length > 0 ? (
                      stageJobs.map((job: Job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          getPriorityBadge={getPriorityBadge}
                          onViewDetail={handleViewDetail}
                          onEdit={handleEdit}
                          onRepeatOrder={handleRepeatOrder}
                          onApproveDesignerProject={handleApproveDesignerProject}
                          onOpenSendToPrinter={handleOpenSendToPrinter}
                          onStageChange={handleStageChange}
                          onAddPayment={handleAddPayment}
                          onDelete={handleDelete}
                        />
                      ))
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
          <div>
            {/* ── MOBILE: Card rows (< sm) ── */}
            <div className="sm:hidden space-y-2">
              {filteredJobs.map((job: Job) => {
                const overdue = isOverdue(job.client_deadline, job.current_stage);
                const stageMeta = stages.find(s => s.id === job.current_stage);
                const next = getNextStage(normalizeJobType(job.job_type), job.current_stage);
                const advLabel = getAdvanceLabel(normalizeJobType(job.job_type), job.current_stage);
                return (
                  <div
                    key={job.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                    onClick={() => handleViewDetail(job)}
                  >
                    {/* Top bar: priority colour + job number */}
                    <div className={`px-3 py-2 flex items-center justify-between ${overdue ? 'bg-red-600' : job.priority === 'urgent' ? 'bg-gray-900' : job.priority === 'high' ? 'bg-gray-800' : 'bg-gray-700'
                      }`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getPriorityBadge(job.priority || '')}`}>
                          {(job.priority || 'normal').toUpperCase()}
                        </span>
                        {overdue && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/25 text-white">OVERDUE</span>}
                      </div>
                      <span className="font-mono text-[11px] font-bold text-white/90">{job.job_number}</span>
                    </div>

                    {/* Body */}
                    <div className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{job.project_name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <p className="text-xs text-gray-500 truncate">{(job.client as any)?.company || job.client?.name || 'No client'}</p>
                          </div>
                        </div>
                        {stageMeta && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-md text-white flex-shrink-0 ${stageMeta.color}`}>
                            {stageMeta.name}
                          </span>
                        )}
                      </div>

                      {/* Payment + Deadline row */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                        <span className={`text-xs px-2 py-0.5 rounded-md ${getPaymentBadge(job.payment_status)}`}>
                          {formatCurrency(job.amount_received)} / {formatCurrency(job.total_amount)}
                        </span>
                        {job.client_deadline ? (
                          <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'
                            }`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(job.client_deadline)}
                          </span>
                        ) : null}
                      </div>

                      {/* Actions row */}
                      <div className="flex flex-wrap items-center justify-end gap-1 mt-2 pt-1.5 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(job)} title="Edit"><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRepeatOrder(job)} title="Repeat"><Copy className="w-3.5 h-3.5" /></Button>
                        {next === 'printing' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600" onClick={() => handleOpenSendToPrinter(job)} title="Send to Printer"><Send className="w-3.5 h-3.5" /></Button>
                        )}
                        {next && next !== 'printing' && !['awaiting_admin', 'delivered', 'cancelled'].includes(job.current_stage) && (
                          <Button size="sm" className="h-7 text-[10px] px-2 max-w-full bg-gray-800 text-white hover:bg-gray-700" onClick={() => handleStageChange(job.id, next)} title={advLabel}>
                            <ArrowRight className="w-3 h-3 mr-0.5 flex-shrink-0" /><span className="truncate">{stripEmoji(advLabel)}</span>
                          </Button>
                        )}
                        {job.current_stage === 'awaiting_admin' && (
                          <Button size="sm" className="h-7 text-[10px] px-2 bg-green-600 text-white hover:bg-green-700" onClick={() => handleApproveDesignerProject(job)}>✅ Approve</Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleAddPayment(job)} title="Payment"><IndianRupee className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleDelete(job.id)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP: Full table (sm+) ── */}
            <div className="hidden sm:block bg-white rounded-md border overflow-hidden">
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
                      <tr key={job.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => handleViewDetail(job)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-primary">{job.job_number}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-md ${getPriorityBadge(job.priority)}`}>{job.priority}</span>
                            {job.files && job.files.length > 0 && (
                              <span className="flex items-center gap-0.5 text-gray-600" title={`${job.files.length} file(s)`}>
                                <Paperclip className="w-3 h-3" />
                                <span className="text-xs font-bold">{job.files.length}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium">{job.project_name}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">{(job.client as any)?.company || job.client?.name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-md text-white ${stages.find(s => s.id === job.current_stage)?.color}`}>
                            {stages.find(s => s.id === job.current_stage)?.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-md ${getPaymentBadge(job.payment_status)}`}>
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
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(job)} title="Edit"><Edit /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleRepeatOrder(job)} title="Repeat Order"><Copy /></Button>
                            {!['printing', 'finishing', 'quality_check', 'ready', 'dispatched', 'delivered'].includes(job.current_stage) && (
                              <Button size="icon" variant="ghost" onClick={() => handleOpenSendToPrinter(job)} title="Send to Printer" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"><Send /></Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => handleAddPayment(job)} title="Add Payment"><IndianRupee /></Button>
                            <Button size="icon" variant="destructive" onClick={() => handleDelete(job.id)} title="Delete"><Trash2 /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }
      {/* Add/Edit Job Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-2xl shadow-xl">
            <UnifiedJobForm
              mode="modal"
              editingJob={editingJob}
              onSuccess={() => { setShowModal(false); setEditingJob(null); }}
              onCancel={() => { setShowModal(false); setEditingJob(null); }}
            />
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {
        showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-md w-full max-w-sm animate-scale-in">
              <div className="p-4 border-b">
                <h3 className="font-bold text-gray-900">Add Payment</h3>
                <p className="text-sm text-gray-500">{selectedJob?.project_name}</p>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount Received</label>
                  <input
                    type="number"
                    autoFocus
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 text-section border rounded-md focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Total: {formatCurrency(selectedJob?.total_amount || 0)} |
                    Pending: {formatCurrency((selectedJob?.total_amount || 0) - (selectedJob?.amount_received || 0))}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Received Into</label>
                  <select
                    value={paymentAccountId}
                    onChange={(e) => handlePaymentAccountChange(e.target.value)}
                    className="w-full px-3 py-3 border rounded-md bg-white focus:ring-2 focus:ring-gray-400"
                  >
                    <option value="">Select account...</option>
                    {cashAccounts.length > 0 && (
                      <optgroup label="Cash">
                        {cashAccounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} (₹{(acc.current_balance || 0).toLocaleString('en-IN')})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {bankAccounts.length > 0 && (
                      <optgroup label="Bank">
                        {bankAccounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} (₹{(acc.current_balance || 0).toLocaleString('en-IN')})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Pick the cash or bank account the money landed in — the payment method is set automatically.
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
          <div className="bg-white rounded-md w-full max-w-md animate-scale-in">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-md flex items-center justify-center">
                <Send className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Send to Printer</h3>
                <p className="text-sm text-gray-500">{selectedJob.job_number} — {selectedJob.project_name}</p>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* CMYK Quick Pick */}
              {(() => {
                const cmykVendor = (vendors as any[]).find(v => v.is_cmyk_station === true);
                if (!cmykVendor) return null;
                return (
                  <button
                    onClick={() => setSendToPrinterData({ ...sendToPrinterData, vendor_id: cmykVendor.id })}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-md border-2 transition-all text-left ${sendToPrinterData.vendor_id === cmykVendor.id ? 'border-blue-600 bg-blue-50' : 'border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'}`}
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center flex-shrink-0">
                      <Printer className="w-4 h-4 text-blue-700" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">⚡ Send to CMYK Station</p>
                      <p className="text-xs text-blue-600">In-house digital print — appears in CMYK queue immediately</p>
                    </div>
                    {sendToPrinterData.vendor_id === cmykVendor.id && (
                      <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">Selected</span>
                    )}
                  </button>
                );
              })()}

              {/* Vendor Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Or select other Vendor / Printer</label>
                <select
                  value={sendToPrinterData.vendor_id}
                  onChange={(e) => setSendToPrinterData({ ...sendToPrinterData, vendor_id: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-md bg-white focus:ring-2 focus:ring-orange-400"
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
                  className="w-full px-3 py-2.5 border rounded-md bg-white focus:ring-2 focus:ring-orange-400"
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
                  className="w-full px-3 py-2.5 border rounded-md h-20 focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Job Info */}
              <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-600">
                <div className="flex justify-between"><span>Client:</span><span className="font-medium text-gray-900">{(selectedJob.client as any)?.company || selectedJob.client?.name || 'N/A'}</span></div>
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
          <div className="bg-white rounded-md w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
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

