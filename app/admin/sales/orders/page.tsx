'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
  Calendar, User, Package, IndianRupee, Truck, CheckCircle,
  AlertCircle, ChevronRight, Briefcase, ExternalLink,
  Upload, CreditCard, Banknote, Smartphone, ChevronDown, Tag
} from 'lucide-react';
import { useJobs, useClients, useProductCategories } from '@/lib/hooks';
import { Job, Client } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useConfirm } from '@/components/ConfirmModal';
import UnifiedJobForm from '@/components/jobs/UnifiedJobForm';
import { ShareToChat } from '@/components/ShareToChat';

export default function OrdersPage() {
  const { user, profile } = useAuth();
  const { jobs: allJobs, loading: jobsLoading, createJob, updateJob, deleteJob } = useJobs();
  const { categories, createCategory } = useProductCategories();
  const router = useRouter();
  const pathname = usePathname();
  const confirm = useConfirm();

  // Marketing > Orders: show only orders where client came through marketing (source = 'marketing')
  // Sales > Orders: admins see all; marketing staff see only their own
  const isMarketingView = pathname?.includes('/marketing/');

  const jobs = useMemo(() => {
    // ROLE FIRST: a marketing user only ever sees their own orders, on any page.
    if (profile?.role === 'marketing' && profile?.id) {
      return allJobs.filter(job =>
        job.sales_person_id === profile.id ||
        job.created_by === profile.id ||
        (job.client && job.client.created_by === profile.id)
      );
    }
    // Admin/other roles: all orders, on every page (Sales and Marketing alike).
    return allJobs;
  }, [allJobs, profile]);

  const { clients: allClients } = useClients();

  // Clients already on this marketing user's orders stay selectable
  // even if created/owned by someone else.
  const linkedClientIds = useMemo(() => {
    const s = new Set<string>();
    if (profile?.role === 'marketing' && profile?.id) {
      allJobs.forEach(job => {
        const ownedByMe = job.sales_person_id === profile.id || job.created_by === profile.id;
        if (ownedByMe && job.client_id) s.add(job.client_id);
      });
    }
    return s;
  }, [allJobs, profile]);

  const clients = useMemo(() => {
    // ROLE FIRST: a marketing user only ever sees their own clients, on any page.
    if (profile?.role === 'marketing') {
      return allClients.filter(c =>
        c.created_by === profile.id ||
        (c as any).assigned_to === profile.id ||
        linkedClientIds.has(c.id)
      );
    }
    // Admin/other roles: all clients.
    return allClients;
  }, [allClients, profile, linkedClientIds]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Track if view modal was opened via a shared link — so closing goes back
  const [openedViaLink, setOpenedViaLink] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    clientId: '',
    projectName: '',
    productCategory: '',
    description: '',
    quantity: 1,
    ratePerPiece: 0,
    subtotal: 0,
    gstRate: 18,
    gstAmount: 0,
    totalAmount: 0,
    priority: 'normal' as Job['priority'],
    currentStage: 'new' as Job['current_stage'],
    jobType: 'Design + Print' as string,
    clientDeadline: '',
    assignedTo: '',  // IMP-4: Assigned To field
    notes: ''
  });

  // Product Category search
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  // Advance Payment
  const [showAdvance, setShowAdvance] = useState(false);
  const [advanceData, setAdvanceData] = useState({
    amount: 0,
    paymentMode: 'cash' as 'cash' | 'upi' | 'bank_transfer',
    referenceNumber: '',
    receivedBy: '',
    proofFile: null as File | null,
  });
  const [uploadingProof, setUploadingProof] = useState(false);

  // Team members for "received by" dropdown
  const [teamMembers, setTeamMembers] = useState<{ id: string, full_name: string }[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('id, full_name').eq('is_active', true).eq('role', 'admin')
      .then(({ data }) => { if (data) setTeamMembers((data as any).filter((m: any) => (m.full_name || '').trim() !== '')); });
  }, []);

  // Close category dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filtered categories for search
  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    if (!categorySearch.trim()) return categories;
    return categories.filter((c: any) => (c.name || '').toLowerCase().includes(categorySearch.toLowerCase()));
  }, [categories, categorySearch]);

  const selectedCategoryName = useMemo(() => {
    return formData.productCategory || '';
  }, [formData.productCategory]);

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

  // Auto-open view modal if ?view=JOB_ID is in the URL (shared link from chat)
  useEffect(() => {
    if (typeof window === 'undefined' || jobsLoading || allJobs.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    if (!viewId) return;
    const job = allJobs.find((j) => j.id === viewId);
    if (job) {
      // Clean URL so sharing again doesn't loop
      window.history.replaceState({}, '', '/admin/sales/orders');
      setSelectedJob(job);
      setOpenedViaLink(true);
      setShowViewModal(true);
    }
  }, [jobsLoading, allJobs]);

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
      productCategory: '',
      description: '',
      quantity: 1,
      ratePerPiece: 0,
      subtotal: 0,
      gstRate: 18,
      gstAmount: 0,
      totalAmount: 0,
      priority: 'normal',
      currentStage: 'new',
      jobType: 'Design + Print',
      clientDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      assignedTo: profile?.id || user?.id || '',  // IMP-4: default to current user
      notes: ''
    });
    setShowAdvance(false);
    setAdvanceData({ amount: 0, paymentMode: 'cash', referenceNumber: '', receivedBy: '', proofFile: null });
    setCategorySearch('');
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = async (job: Job) => {
    // Fetch the FULL job record — the list view only loads lightweight fields
    const { data: fullJob } = await supabase
      .from('jobs')
      .select('*, client:clients(id, name, company), vendor:vendors(id, name)')
      .eq('id', job.id)
      .single();
    const j: any = fullJob || job;
    setFormData({
      clientId: j.client_id || '',
      projectName: j.project_name,
      productCategory: j.product_category || '',
      description: j.description || '',
      quantity: j.quantity ?? 0,
      ratePerPiece: j.quote_per_piece || (j.quantity > 0 ? j.subtotal / j.quantity : 0),
      subtotal: j.subtotal,
      gstRate: j.gst_rate,
      gstAmount: j.gst_amount,
      totalAmount: j.total_amount,
      priority: j.priority,
      currentStage: j.current_stage,
      jobType: j.job_type || 'Design + Print',
      clientDeadline: j.client_deadline ? new Date(j.client_deadline).toISOString().split('T')[0] : '',
      assignedTo: j.sales_person_id || '',
      notes: j.notes || ''
    });
    setCategorySearch('');
    setShowAdvance((j.amount_received || 0) > 0);
    setAdvanceData({ amount: j.amount_received || 0, paymentMode: 'cash', referenceNumber: '', receivedBy: '', proofFile: null });
    setSelectedJob(j);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { confirmed } = await confirm({ title: 'Delete Order', message: 'Are you sure you want to delete this order?', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) {
      const result = await deleteJob(id);
      if (result?.error) {
        const msg = 'Cannot delete order: ' + result.error;
        toast.error(msg);
      } else {
        toast.success('Order deleted successfully.');
      }
    }
  };

  // Upload proof file to Supabase storage
  const uploadProofFile = async (file: File, jobId: string): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop();
      const path = `payment-proofs/${jobId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, file);
      if (error) {
        console.error('Upload error:', error);
        return null;
      }
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      return urlData?.publicUrl || null;
    } catch (err) {
      console.error('File upload failed:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const advanceAmount = showAdvance ? advanceData.amount : 0;
      const paymentStatus = advanceAmount > 0
        ? (advanceAmount >= formData.totalAmount ? 'paid' : 'partial')
        : 'pending';

      if (isEditing && selectedJob) {
        const result = await updateJob(selectedJob.id, {
          client_id: formData.clientId,
          project_name: formData.projectName,
          product_category: formData.productCategory || null,
          job_type: formData.jobType,
          description: formData.description,
          quantity: formData.quantity,
          quote_per_piece: formData.ratePerPiece,
          subtotal: formData.subtotal,
          gst_rate: formData.gstRate,
          gst_amount: formData.gstAmount,
          total_amount: formData.totalAmount,
          amount_received: advanceAmount,
          payment_status: paymentStatus,
          priority: formData.priority,
          current_stage: formData.currentStage,
          client_deadline: formData.clientDeadline,
          sales_person_id: formData.assignedTo || (profile?.id || user?.id),  // IMP-4
          notes: formData.notes
        } as any);
        if (result?.error) {
          toast.error(String('Failed to update: ' + result.error));
          return;
        }
      } else {
        const result = await createJob({
          client_id: formData.clientId,
          project_name: formData.projectName,
          product_category: formData.productCategory || null,
          job_type: formData.jobType as any,
          description: formData.description,
          quantity: formData.quantity,
          quote_per_piece: formData.ratePerPiece,
          subtotal: formData.subtotal,
          gst_rate: formData.gstRate,
          gst_amount: formData.gstAmount,
          discount_amount: 0,
          total_amount: formData.totalAmount,
          payment_status: paymentStatus,
          amount_received: advanceAmount,
          order_date: new Date().toISOString(),
          priority: formData.priority,
          current_stage: formData.currentStage,
          files: [],
          client_deadline: formData.clientDeadline,
          notes: formData.notes,
          sales_person_id: formData.assignedTo || (profile?.id || user?.id),  // IMP-4
        } as any);
        if (result?.error) {
          toast.error(String('Failed to create: ' + result.error));
          return;
        }

        // Record advance payment if provided
        if (advanceAmount > 0 && result?.data?.id) {
          let proofUrl: string | null = null;
          if (advanceData.proofFile) {
            setUploadingProof(true);
            proofUrl = await uploadProofFile(advanceData.proofFile, result.data.id);
            setUploadingProof(false);
          }

          // Create payment record via direct insert
          await supabase.from('payments_received').insert([{
            job_id: result.data.id,
            client_id: formData.clientId || null,
            amount: advanceAmount,
            payment_mode: advanceData.paymentMode,
            payment_date: new Date().toISOString(),
            reference_number: advanceData.referenceNumber || null,
            received_by: advanceData.receivedBy || profile?.id || null,
            attachment_url: proofUrl,
            notes: `Advance payment at order creation`,
          }]);
        }
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Failed to save order');
    } finally {
      setSubmitting(false);
    }
  };

  // Source tag: shows which channel brought in this client
  const getSourceTag = (job: Job) => {
    const clientSource = job.client?.source;
    if (clientSource === 'marketing') {
      return { label: '🎯 Marketing', shortName: (job as any).sales_person?.full_name, className: 'bg-violet-100 text-violet-700 border border-violet-200' };
    }
    if (clientSource === 'referral') {
      return { label: '🤝 Referral', shortName: undefined, className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
    }
    if (clientSource === 'walk_in') {
      return { label: '🚶 Walk-in', shortName: undefined, className: 'bg-amber-50 text-amber-700 border border-amber-200' };
    }
    if (clientSource === 'online') {
      return { label: '🌐 Online', shortName: undefined, className: 'bg-sky-50 text-sky-700 border border-sky-200' };
    }
    return { label: '📋 Direct', shortName: (job as any).sales_person?.full_name, className: 'bg-gray-100 text-gray-500 border border-gray-200' };
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
      'new': 'bg-muted text-foreground',
      'designing': 'bg-gray-900 text-white',
      'approval': 'bg-amber-100 text-amber-700',
      'printing': 'bg-gray-900 text-white',
      'finishing': 'bg-pink-100 text-pink-700',
      'quality_check': 'bg-orange-100 text-orange-700',
      'ready': 'bg-gray-100 text-gray-900',
      'dispatched': 'bg-cyan-100 text-cyan-700',
      'delivered': 'bg-gray-100 text-gray-700',
      'cancelled': 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // Helper to get category name from ID
  const getCategoryName = (job: Job) => {
    return job.product_category || '';
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const s = searchQuery.toLowerCase();
      const catName = getCategoryName(job).toLowerCase();
      const matchSearch =
        (job.job_number || '').toLowerCase().includes(s) ||
        (job.project_name || '').toLowerCase().includes(s) ||
        (job.client?.company || '').toLowerCase().includes(s) ||
        (job.client?.name || '').toLowerCase().includes(s) ||
        catName.includes(s);
      const matchStatus = statusFilter === 'all' || job.current_stage === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [jobs, searchQuery, statusFilter, categories]);

  return (
    <div className="space-y-3 md:space-y-6 lg:space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/sales" className="p-2 hover:bg-white rounded-md border border-gray-100 lg:hidden bg-gray-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-page-title text-gray-900 tracking-tight">
              {isMarketingView ? 'Marketing Orders' : 'Orders'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredJobs.length} orders found
            </p>
          </div>
        </div>
        <div className="hidden lg:block">
          {profile?.role !== 'marketing' && (
            <button
              onClick={handleAddNew}
              className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md transition-all hover:scale-105 active:scale-95 font-semibold shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span>New Order</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 sm:p-4 rounded-md border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search orders, clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="designing">Designing</SelectItem>
            <SelectItem value="printing">Printing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {jobsLoading ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-md border border-gray-100">Loading orders...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-md border border-gray-100">
            No orders found matching your criteria.
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="lg:hidden space-y-4">
              {filteredJobs.map((job) => {
                // Determine header color based on status
                const headerColors = {
                  'new': 'bg-gradient-to-r from-gray-700 to-gray-800',
                  'designing': 'bg-gradient-to-r from-gray-800 to-gray-900',
                  'approval': 'bg-gradient-to-r from-yellow-400 to-yellow-500',
                  'printing': 'bg-gradient-to-r from-purple-500 to-purple-600',
                  'finishing': 'bg-gradient-to-r from-pink-500 to-pink-600',
                  'quality_check': 'bg-gradient-to-r from-orange-500 to-orange-600',
                  'ready': 'bg-gradient-to-r from-green-500 to-green-600',
                  'dispatched': 'bg-gradient-to-r from-cyan-500 to-cyan-600',
                  'delivered': 'bg-gradient-to-r from-gray-400 to-gray-500',
                  'cancelled': 'bg-gradient-to-r from-red-500 to-red-600',
                };
                const headerBg = headerColors[job.current_stage as keyof typeof headerColors] || 'bg-gradient-to-r from-gray-400 to-gray-500';
                const headerTextColor = job.current_stage === 'approval' ? 'text-gray-900' : 'text-white';

                return (
                  <div key={job.id} className="bg-white rounded-md overflow-hidden shadow-sm hover:shadow-sm transition-all border border-gray-100">
                    {/* Colored Header Tab */}
                    <div className={`${headerBg} px-5 py-3 flex items-center justify-between`}>
                      <span className={`${headerTextColor} font-semibold text-sm md:text-base`}>
                        {job.job_number}
                      </span>
                      <span className={`${headerTextColor}/90 text-xs px-3 py-1 bg-white/20 rounded-md font-medium capitalize`}>
                        {job.current_stage.replace('_', ' ')}
                      </span>
                    </div>

                    {/* White Card Body */}
                    <div className="p-4">
                      {/* Client/Subtitle */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-gray-500 text-sm">
                          {job.client?.company || job.client?.name || 'Unknown'}
                        </p>
                        {(() => {
                          const tag = getSourceTag(job);
                          return (
                            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md ${tag.className}`}>
                              {tag.label}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Category + Project Name */}
                      {getCategoryName(job) && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded mb-1">
                          <Tag className="w-3 h-3" />{getCategoryName(job)}
                        </span>
                      )}
                      <h3 className="text-gray-900 font-bold text-lg mb-4">
                        {job.project_name}
                      </h3>

                      {/* Details Row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span>{job.quantity} pcs</span>
                          </div>
                        </div>
                        <span className="text-gray-900 font-bold text-2xl font-bold">
                          {formatCurrency(job.total_amount)}
                        </span>
                      </div>

                      {/* Deadline */}
                      {job.client_deadline && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>Due: {formatDate(job.client_deadline)}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelectedJob(job); setOpenedViaLink(false); setShowViewModal(true); }}
                          className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4 md:w-4.5 md:h-4.5" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                        {profile?.role !== 'marketing' && (
                          <button
                            onClick={() => handleEdit(job)}
                            className="px-4 py-2.5 border-2 border-gray-900 text-gray-900 rounded-md font-medium hover:bg-gray-50 transition-colors"
                          >
                            <Edit className="w-4 h-4 md:w-4.5 md:h-4.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden lg:block bg-white rounded-md border border-gray-100 overflow-hidden">
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
                          {job.priority === 'urgent' && <span className="text-xs font-bold uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded-md">Urgent</span>}
                          {job.priority === 'high' && <span className="text-xs font-bold uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">High</span>}
                          {job.priority === 'normal' && <span className="text-xs font-medium uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">Normal</span>}
                        </div>
                        <div className="font-semibold text-gray-800">
                          {job.project_name}
                          {getCategoryName(job) && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              <Tag className="w-3 h-3" />{getCategoryName(job)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{job.quantity} items</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-gray-900">{job.client?.company || job.client?.name || '-'}</div>
                        {job.client?.company && (
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <User className="w-3 h-3" /> {job.client?.name}
                          </div>
                        )}
                        {(() => {
                          const tag = getSourceTag(job);
                          return (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md ${tag.className}`}>
                                {tag.label}
                              </span>
                              {tag.shortName && (
                                <span className="text-xs text-gray-400">{tag.shortName}</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-bold text-gray-900">{formatCurrency(job.total_amount)}</div>
                        {job.payment_status !== 'paid' && (
                          <span className="text-label text-destructive bg-white px-2 py-0.5 rounded-md mt-1 inline-block">
                            Due: {formatCurrency(job.total_amount - job.amount_received)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md w-fit">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {job.client_deadline ? formatDate(job.client_deadline) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-md ${getStatusColor(job.current_stage)}`}>
                          {job.current_stage.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2 text-gray-500">
                          <button onClick={() => { setSelectedJob(job); setOpenedViaLink(false); setShowViewModal(true); }} className="p-2 hover:bg-gray-100 rounded-md hover:text-gray-900 transition-colors">
                            <Eye className="w-4 h-4 md:w-4.5 md:h-4.5" />
                          </button>
                          {profile?.role !== 'marketing' && (
                            <>
                              <button onClick={() => handleEdit(job)} className="p-2 hover:bg-gray-100 rounded-md hover:text-gray-900 transition-colors">
                                <Edit className="w-4 h-4 md:w-4.5 md:h-4.5" />
                              </button>
                              <button onClick={(e) => handleDelete(job.id, e)} className="p-2 hover:bg-red-50 rounded-md hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5" />
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
          <div className="bg-white rounded-md w-full max-w-2xl shadow-xl">
            <UnifiedJobForm
              mode="modal"
              editingJob={isEditing ? selectedJob : null}
              onSuccess={() => { setShowModal(false); }}
              onCancel={() => setShowModal(false)}
            />
          </div>
        </div>
      )}

      {showViewModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-section text-gray-900">{selectedJob.project_name}</h2>
                  <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-0.5 rounded-md">{selectedJob.job_number}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Ordered on {selectedJob.order_date ? formatDate(selectedJob.order_date) : '—'}</p>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setOpenedViaLink(false);
                  if (openedViaLink) router.back();
                }}
                className="p-2 hover:bg-gray-100 rounded-md"
                title={openedViaLink ? 'Close and go back' : 'Close'}
              >
                {openedViaLink ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </button>
            </div>

            <div className="p-4 space-y-6">
              <div className="flex items-center gap-2 md:gap-4 p-4 bg-gray-50 rounded-md border border-gray-100">
                <div className="w-12 h-12 rounded-md bg-gray-900 flex items-center justify-center text-white text-section">
                  {(selectedJob.client?.company || selectedJob.client?.name)?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedJob.client?.company || selectedJob.client?.name}</h3>
                  {selectedJob.client?.company && <p className="text-sm text-gray-600">{selectedJob.client?.name}</p>}
                </div>
              </div>

              {/* Category + Job Type + Advance badges */}
              <div className="flex flex-wrap items-center gap-2">
                {getCategoryName(selectedJob) && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-md">
                    <Tag className="w-4 h-4" />{getCategoryName(selectedJob)}
                  </span>
                )}
                {/* Job Type badge */}
                {(selectedJob as any).job_type && (
                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md ${(selectedJob as any).job_type === 'Design Only' ? 'bg-violet-100 text-violet-700'
                    : (selectedJob as any).job_type === 'Print Only' ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-900 text-white'
                    }`}>
                    {(selectedJob as any).job_type === 'Design Only' ? '🎨' : (selectedJob as any).job_type === 'Print Only' ? '🖨️' : '🎨+🖨️'} {(selectedJob as any).job_type}
                  </span>
                )}
                {selectedJob.amount_received > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-md">
                    <IndianRupee className="w-3.5 h-3.5" />Advance: {formatCurrency(selectedJob.amount_received)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Status</p>
                  <p className="font-medium text-gray-900 capitalize mt-1">{selectedJob.current_stage.replace('_', ' ')}</p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Priority</p>
                  <p className={`font-medium capitalize mt-1 ${selectedJob.priority === 'urgent' ? 'text-red-600' : 'text-gray-900'}`}>{selectedJob.priority}</p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Deadline</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedJob.client_deadline ? formatDate(selectedJob.client_deadline) : '-'}</p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Quantity</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedJob.quantity}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Description / Specifications</h4>
                <p className="text-gray-600 text-sm leading-relaxed p-4 bg-gray-50 rounded-md border border-gray-100 min-h-[80px]">
                  {selectedJob.description || 'No description provided.'}
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-md border border-gray-200">
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(selectedJob.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600">GST ({selectedJob.gst_rate ?? 0}%)</span>
                  <span className="font-medium">{formatCurrency(selectedJob.gst_amount || 0)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900 text-lg">{formatCurrency(selectedJob.total_amount)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedJob); }} className="flex-1 py-3 border border-border text-gray-900 font-semibold rounded-md hover:bg-muted transition-colors">
                  Edit Order
                </button>
                <ShareToChat
                  jobId={selectedJob.id}
                  jobNumber={selectedJob.job_number}
                  projectName={selectedJob.project_name}
                  clientName={selectedJob.client?.company || selectedJob.client?.name}
                  className="flex-1 py-3 justify-center border border-blue-200 rounded-md font-semibold text-sm"
                />
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    router.push(`/admin/jobs?highlight=${selectedJob.id}`);
                  }}
                  className="flex-1 py-3 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Briefcase className="w-4 h-4" />
                  Open in Jobs
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
