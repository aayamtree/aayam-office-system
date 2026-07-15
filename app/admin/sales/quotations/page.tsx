'use client';

import { useState, useMemo, useEffect } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft, ArrowRight,
  Calendar, User, FileText, IndianRupee, CheckCircle, XCircle, Clock, Loader2, Download
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useQuotations, useClients, useJobs, useLeads, useFollowUps, useProductCategories } from '@/lib/hooks';
import { Quotation, Client, QuotationItem, JobStatus } from '@/types/database';
import type { QuotationData } from '@/components/quotation/QuotationPDF';
// Lazy PDF: @react-pdf/renderer (~500KB) loads only when a PDF is actually generated
const downloadQuotationPDF = async (d: QuotationData) =>
  (await import('@/components/quotation/QuotationPDF')).downloadQuotationPDF(d);
import QuotationPreview from '@/components/quotation/QuotationPreview';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';
import ClientQuickAddModal from '@/components/shared/ClientQuickAddModal';
import ItemAutocomplete, { CatalogItem } from '@/components/items/ItemAutocomplete';
import { supabase } from '@/lib/supabase';

export default function QuotationsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { quotations: allQuotations, loading: quotationsLoading, createQuotation, updateQuotation, saveQuotationItems, deleteQuotation } = useQuotations();
  const { updateClient } = useClients();
  const { linkQuotationToFollowUp } = useFollowUps();
  const { categories: dbCategories } = useProductCategories();
  const confirm = useConfirm();
  const { settings: companySettings } = useCompanySettings();
  const [previewData, setPreviewData] = useState<QuotationData | null>(null);

  // This same component powers two routes:
  //  • Sales & Finance → Quotations (/admin/sales/quotations): company-wide, all quotes.
  //  • Marketing → Quotations (/admin/marketing/quotations): the marketing team's quotes only.
  const pathname = usePathname();
  const isMarketingView = (pathname || '').startsWith('/admin/marketing');

  // All profiles (id -> name/role): used for "Added by", the owner filter, and
  // to decide which quotes belong to the marketing team.
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string; role: string }[]>([]);
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name')
      .then(({ data }) => setAllProfiles(data || []));
  }, []);
  const roleById = useMemo(() => {
    const m: Record<string, string> = {};
    allProfiles.forEach(p => { m[p.id] = p.role; });
    return m;
  }, [allProfiles]);

  // Role-based visibility (same rule as the Clients page):
  //  • Admin (and other non-marketing roles) see ALL quotations.
  //  • Marketing users see ONLY quotations they created, or for a lead assigned
  //    to them. This applies on every page, so a marketing person never sees
  //    someone else's quotes, and a quote they save never "disappears".
  const quotations = useMemo(() => {
    if (profile?.role === 'marketing' && profile?.id) {
      return allQuotations.filter(q => {
        const q_ = q as any;
        const createdByMe = q_.created_by === profile.id;
        const assignedToMe = q_.lead?.assigned_to === profile.id;
        return createdByMe || assignedToMe;
      });
    }
    // Marketing → Quotations page: only quotes owned by the marketing team
    // (client sourced via marketing, or created by a marketing-role user).
    if (isMarketingView) {
      return allQuotations.filter(q => {
        const q_ = q as any;
        const c = q_.client || {};
        if (c.source === 'marketing') return true;
        const ownerId = q_.created_by || c.created_by;
        return ownerId ? roleById[ownerId] === 'marketing' : false;
      });
    }
    // Sales & Finance (and other non-marketing roles): all quotations, company-wide.
    return allQuotations;
  }, [allQuotations, profile, isMarketingView, roleById]);
  const { clients: allClients, refetch: refetchClients } = useClients();
  const { leads: allLeads, convertToClient } = useLeads();

  // IDs of clients/leads already referenced by this marketing user's quotations,
  // so they stay selectable even if created/owned by someone else.
  const linkedClientIds = useMemo(() => {
    const s = new Set<string>();
    if (profile?.role === 'marketing' && profile?.id) {
      allQuotations.forEach(q => {
        const q_ = q as any;
        if ((q_.created_by === profile.id || q_.lead?.assigned_to === profile.id) && q_.client_id) {
          s.add(q_.client_id);
        }
      });
    }
    return s;
  }, [allQuotations, profile]);

  const linkedLeadIds = useMemo(() => {
    const s = new Set<string>();
    if (profile?.role === 'marketing' && profile?.id) {
      allQuotations.forEach(q => {
        const q_ = q as any;
        if ((q_.created_by === profile.id || q_.lead?.assigned_to === profile.id) && q_.lead_id) {
          s.add(q_.lead_id);
        }
      });
    }
    return s;
  }, [allQuotations, profile]);

  const clients = useMemo(() => {
    if (profile?.role === 'marketing') {
      return allClients.filter(c =>
        c.created_by === profile.id ||
        (c as any).assigned_to === profile.id ||
        linkedClientIds.has(c.id)
      );
    }
    return allClients;
  }, [allClients, profile, linkedClientIds]);

  const leads = useMemo(() => {
    if (profile?.role === 'marketing') {
      return allLeads.filter(l =>
        l.assigned_to === profile.id ||
        (l as any).created_by === profile.id ||
        linkedLeadIds.has(l.id)
      );
    }
    return allLeads;
  }, [allLeads, profile, linkedLeadIds]);
  const { createJob, nextJobNumber } = useJobs();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  const nameFor = (id?: string | null) =>
    id ? (allProfiles.find(p => p.id === id)?.full_name || 'Unknown') : null;

  // Resolve the "owner" of a quote for performance/commission.
  // Priority: the client's assigned marketing person (the ownership that drives
  // commission). Falls back to whoever created the quote when the client is
  // Direct/unassigned. Returns the owner's profile id (or null).
  const ownerIdFor = (q: any): string | null => {
    const c = q.client || {};
    if (c.source === 'marketing' && c.assigned_marketing_user_id) {
      return c.assigned_marketing_user_id;
    }
    return q.created_by || c.created_by || null;
  };

  // Source badge + marketing person + "Added by", same visual language as the
  // Clients page. `compact` trims spacing for the mobile card.
  const renderSource = (q: any, compact = false) => {
    const c = q.client || {};
    const storedSource = q.lead && !q.client ? 'lead' : (c.source || 'direct');
    const badgeClass =
      storedSource === 'marketing' ? 'bg-gray-900 text-white' :
      storedSource === 'referral' ? 'bg-emerald-100 text-emerald-800' :
      storedSource === 'walk_in' ? 'bg-amber-100 text-amber-800' :
      storedSource === 'online' ? 'bg-sky-100 text-sky-800' :
      storedSource === 'lead' ? 'bg-indigo-100 text-indigo-800' :
      'bg-gray-100 text-gray-700';
    const badgeLabel =
      storedSource === 'marketing' ? 'MARKETING' :
      storedSource === 'referral' ? 'REFERRAL' :
      storedSource === 'walk_in' ? 'WALK-IN' :
      storedSource === 'online' ? 'ONLINE' :
      storedSource === 'lead' ? 'LEAD' :
      'DIRECT';
    const marketingPerson = c.source === 'marketing' ? nameFor(c.assigned_marketing_user_id) : null;
    const addedBy = nameFor(q.created_by || c.created_by);
    return (
      <div className={compact ? '' : 'space-y-1'}>
        <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-md tracking-wide ${badgeClass}`}>{badgeLabel}</span>
        {marketingPerson && (
          <p className="text-[12px] text-gray-900 font-semibold flex items-center gap-1">👤 {marketingPerson}</p>
        )}
        {addedBy && (
          <p className="text-[11px] text-gray-400">Added by: {addedBy}</p>
        )}
      </div>
    );
  };
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    clientId: '',
    leadId: '',
    quoteNumber: '', // Auto-generated
    validUntil: '',
    orderType: 'print' as 'print' | 'design' | 'design_print',
    productCategory: '',
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
  const [followUpIdParam, setFollowUpIdParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // Handle highlight param ÃÂ¢ÃÂÃÂ auto-fill search to jump to specific quote
      const highlightQuote = params.get('highlight');
      if (highlightQuote) {
        setSearchQuery(highlightQuote);
        // Clear URL to prevent sticky filter
        window.history.replaceState({}, '', window.location.pathname);
        return; // Don't process other params
      }

      if (params.get('new') === 'true') {
        const clientIdParam = params.get('clientId');
        const leadIdParam = params.get('leadId');
        const followUpId = params.get('followUpId');

        if (followUpId) {
          setFollowUpIdParam(followUpId);
        }

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
      'sent': 'bg-blue-50 text-blue-700',
      'viewed': 'bg-indigo-50 text-indigo-700',
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
      case 'expired': return <Clock size={14} className="text-destructive" />;
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

  // Fill a row from a saved catalog item (Zoho-style dropdown pick)
  const fillItemFromCatalog = (index: number, cat: CatalogItem) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const existing = newItems[index];
      const rate = Number(cat.rate) || 0;
      newItems[index] = {
        ...existing,
        description: cat.description ? `${cat.name} — ${cat.description}` : cat.name,
        rate,
        gst_rate: Number(cat.gst_rate) || existing.gst_rate,
        amount: (existing.quantity || 1) * rate,
      };
      const sub = newItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = Math.round(sub * (prev.gstRate / 100));
      return { ...prev, items: newItems, subtotal: sub, totalTax: tax, totalAmount: sub + tax };
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
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      orderType: 'print',
      productCategory: '',
      items: [{ description: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 } as QuotationItem],
      subtotal: 0,
      gstRate: 18,
      totalTax: 0,
      totalAmount: 0,
      status: 'draft',
      notes: '',
      terms: '',
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (q: Quotation) => {
    const items = q.items || [];
    // The gstRate in formData is for new items, existing items have their own gst_rate
    // For editing, we can take the gstRate from the first item if available, or default
    const gstRate = items.length > 0 ? (items[0].gst_rate ?? 18) : 18;  // ?? so 0% is preserved

    setFormData({
      clientId: q.client_id || '',
      leadId: q.lead_id || '',
      quoteNumber: q.quote_number,
      validUntil: q.valid_until ? new Date(q.valid_until).toISOString().split('T')[0] : '',
      orderType: q.order_type || 'print',
      productCategory: q.product_category || '',
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
    const { confirmed } = await confirm({ title: 'Delete Quotation', message: `Are you sure you want to delete Quotation ${quoteNumber}? This action cannot be undone.`, variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) {
      await deleteQuotation(id);
    }
  };

  // Implement Convert Logic
  const handleConvertToOrder = async (q: Quotation) => {
    const orderTypeLabel = q.order_type === 'print' ? 'Print Only' :
      q.order_type === 'design' ? 'Design Only' : 'Design + Print';

    const { confirmed: createConfirmed } = await confirm({ title: 'Convert to Order', message: `Create a new Job Order from Quotation "${q.quote_number}" (${orderTypeLabel})? This will mark the quote as Accepted.`, confirmLabel: 'Create Order' });
    if (!createConfirmed) return;

    try {
      let finalClientId = q.client_id;

      // 1. Auto-Convert Lead to Client if needed
      if ((!finalClientId || finalClientId === '') && q.lead_id) {
        const { confirmed: convertConfirmed } = await confirm({ title: 'Convert Lead to Client', message: 'This quotation is for a Lead. To create an order, the Lead must be converted to a Client. Proceed with conversion?', confirmLabel: 'Convert' });
        if (!convertConfirmed) return;

        // Use the hook function we exposed
        const { data: newClient, error: convertError } = await convertToClient(q.lead_id, user?.id || '');

        if (convertError) {
          throw new Error('Failed to convert Lead to Client: ' + convertError);
        }

        if (newClient) {
          finalClientId = newClient.id;
          toast.info(`Lead converted to Client: ${newClient.company || newClient.name}`);
        }
      }

      if (!finalClientId) {
        throw new Error('Cannot create an order without a valid Client. Please ensure the lead is converted properly.');
      }

      // 2. Build jobs from the quote — ONE JOB PER ITEM.
      // A single quote can be a "mix job" (Box + Label + Pouch). Each item becomes
      // its own production job so it routes to its own channel / designer / vendor.
      // Item #1 is the order's "group lead" (parent_job_id = null); items #2..n link
      // to it via parent_job_id, so dispatch & invoice can roll them up as ONE order.
      const ownerId = user?.id || profile?.id || q.created_by;

      const jobTypeLabel = (q.order_type === 'print' ? 'Print Only'
        : q.order_type === 'design' ? 'Design Only'
          : 'Design + Print') as 'Print Only' | 'Design Only' | 'Design + Print';

      // All jobs start at 'new'. The Job Queue is type-aware: a Print Only job at
      // 'new' shows "Confirm Print File" (design team verifies the client's file),
      // and confirming sends it straight to the Print Planner — it never enters
      // the design/approval flow. Design / Design+Print start designing as usual.
      const initialStage: JobStatus = 'new';

      // Fall back to a single synthetic item if the quote somehow has no items.
      const quoteItems = (q.items && q.items.length > 0)
        ? q.items
        : [{ description: `Order from ${q.quote_number}`, quantity: 1, rate: q.subtotal, amount: q.subtotal, gst_rate: 18, product_category: q.product_category } as QuotationItem];

      // One MASTER number for the whole order. A single-item order keeps the bare
      // number (AAY-1806001). A mix order suffixes each item: AAY-1806001-1,
      // AAY-1806001-2, … so every item shows its master at a glance.
      const masterNumber = await nextJobNumber(jobTypeLabel);
      const isMixOrder = quoteItems.length > 1;

      let leadJobId: string | undefined;

      for (let i = 0; i < quoteItems.length; i++) {
        const it = quoteItems[i];
        const itemJobNumber = isMixOrder ? `${masterNumber}-${i + 1}` : masterNumber;
        const itemGst = it.gst_rate ?? formData.gstRate ?? 18;  // ?? so 0% GST is preserved
        const itemSubtotal = it.amount ?? ((it.quantity || 1) * (it.rate || 0));
        // GST is computed PER ITEM, independently. Each job is self-contained so it
        // can dispatch / invoice on its own (a slow item ships separately later)
        // without affecting the others. No cross-item remainder juggling.
        const itemGstAmount = Math.round(itemSubtotal * (itemGst / 100));

        const jobPayload: any = {
          job_number: itemJobNumber,
          project_name: it.description || `${q.quote_number} – item ${i + 1}`,
          client_id: finalClientId,
          sales_person_id: ownerId,
          created_by: ownerId,
          // No vendor or designer initially
          job_type: jobTypeLabel,
          // Per-item category drives this item's production channel.
          product_category: it.product_category || q.product_category || 'Other',
          quantity: it.quantity || 1,
          quote_per_piece: it.rate || 0,
          subtotal: itemSubtotal,
          gst_rate: itemGst,
          gst_amount: itemGstAmount,
          discount_amount: 0,
          total_amount: itemSubtotal + itemGstAmount,
          payment_status: 'pending' as const,
          amount_received: 0,
          order_date: new Date().toISOString(),
          client_deadline: q.valid_until || undefined,
          current_stage: initialStage,
          priority: 'normal' as const,
          files: [],
          notes: `Converted from Quotation ${q.quote_number} (${orderTypeLabel})${quoteItems.length > 1 ? ` — item ${i + 1} of ${quoteItems.length}` : ''}. ${q.notes || ''}`,
          // Link siblings to the order's lead job so they group as one order.
          ...(i > 0 && leadJobId ? { parent_job_id: leadJobId } : {}),
        };

        const { data: job, error: jobError } = await createJob(jobPayload);
        if (jobError) throw new Error(jobError);
        if (i === 0) { leadJobId = job?.id; }
      }

      // 4. Update Quotation Status — link to the order's lead job
      await updateQuotation(q.id, {
        status: 'accepted',
        converted_to_job_id: leadJobId,
        client_id: finalClientId // Ensure the quotation is now linked to the real client
      });

      // 5. Route based on order type ÃÂ¢ÃÂÃÂ navigate to the created job
      const itemsLabel = isMixOrder ? ` (${quoteItems.length} items: ${masterNumber}-1…${masterNumber}-${quoteItems.length})` : '';
      if (q.order_type === 'print') {
        toast.success(`Order ${masterNumber} created!${itemsLabel} — awaiting client print files (verify printable).`);
      } else {
        toast.success(`Order ${masterNumber} created!${itemsLabel} — added to design queue.`);
      }
      // Navigate to orders page to show the new job
      setTimeout(() => router.push('/admin/sales/orders'), 1200);

    } catch (err: any) {
      console.error('Error converting to order:', err);
      toast.error(String('Failed to convert quotation to order: ' + err.message));
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { items, ...quoteFields } = {
        client_id: formData.clientId || null,
        lead_id: formData.leadId || null,
        order_type: formData.orderType,
        product_category: formData.productCategory || undefined,
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

        // Link quotation to follow-up if created from follow-up
        if (quoteId && followUpIdParam) {
          await linkQuotationToFollowUp(followUpIdParam, quoteId);
          setFollowUpIdParam(null); // Clear after linking
        }
      }

      if (quoteId) {
        await saveQuotationItems(quoteId, items);
      }

      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving quotation:', error);
      toast.error(String('Failed to save quotation: ' + (error.message || 'Unknown error')));
    } finally {
      setSubmitting(false);
    }
  };

  const buildPdfData = (q: Quotation) => ({
    ...companySettings,
    quoteNumber: q.quote_number,
    date: formatDate(q.created_at),
    validUntil: q.valid_until ? formatDate(q.valid_until) : '-',
    clientName: q.client?.name || q.lead?.name || 'Unknown',
    clientCompany: q.client?.company || q.lead?.company,
    clientAddress: q.client?.address,
    clientPhone: q.client?.phone,
    clientEmail: q.client?.email,
    clientState: (q.client as any)?.state || (q.lead as any)?.state,
    clientGstin: (q.client as any)?.gstin || '',
    items: q.items?.map(i => ({
      description: i.description,
      quantity: i.quantity,
      rate: i.rate,
      amount: i.amount
    })) || [],
    subtotal: q.subtotal,
    taxAmount: q.gst_amount,
    totalAmount: q.total_amount,
    gstRate: q.items?.[0]?.gst_rate ?? 18,
    terms: q.terms,
    notes: q.notes
  });

  const handleDownloadPDF = async (q: Quotation) => {
    await downloadQuotationPDF(buildPdfData(q) as any);
  };

  const handlePreviewPDF = (q: Quotation) => {
    setPreviewData(buildPdfData(q) as any);
  };



  const filteredQuotations = quotations.filter(q => {
    const matchesSearch =
      (q.quote_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.client?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.lead?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    const matchesOwner =
      ownerFilter === 'all' ||
      (ownerFilter === 'unassigned' ? !ownerIdFor(q) : ownerIdFor(q) === ownerFilter);
    return matchesSearch && matchesStatus && matchesOwner;
  });

  // Distinct owners actually present on the visible quotations, for the filter
  // dropdown (admin / non-marketing only).
  const ownerOptions = useMemo(() => {
    const ids = new Set<string>();
    quotations.forEach(q => {
      const id = ownerIdFor(q);
      if (id) ids.add(id);
    });
    return Array.from(ids)
      .map(id => ({ id, name: nameFor(id) || 'Unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [quotations, allProfiles]);

  // Marketing performance strip (admin only). Reflects the owner filter:
  // pick a person → their numbers; leave on "All" → team totals. Based on
  // converted business (the commission base), not raw draft activity.
  const perf = useMemo(() => {
    const scoped = quotations.filter(q => {
      const id = ownerIdFor(q);
      if (ownerFilter === 'all') return true;
      if (ownerFilter === 'unassigned') return !id;
      return id === ownerFilter;
    });
    const isConverted = (q: any) => !!q.converted_to_job_id || q.status === 'accepted';
    const quotes = scoped.length;
    const pipeline = scoped.reduce((s, q) => s + (q.total_amount || 0), 0);
    const convertedQuotes = scoped.filter(isConverted);
    const converted = convertedQuotes.length;
    const revenue = convertedQuotes.reduce((s, q) => s + (q.total_amount || 0), 0);
    const conversion = quotes > 0 ? Math.round((converted / quotes) * 100) : 0;
    return { quotes, pipeline, converted, revenue, conversion };
  }, [quotations, ownerFilter]);

  const perfLabel =
    ownerFilter === 'all' ? (isMarketingView ? 'All marketing' : 'Company-wide')
    : ownerFilter === 'unassigned' ? 'Direct / Unassigned'
    : (nameFor(ownerFilter) || 'Selected');

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/sales" className="p-2 hover:bg-gray-100 rounded-md lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-page-title text-gray-900">Quotations</h1>
            <p className="text-sm text-gray-500">{filteredQuotations.length} quotations found</p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { status: 'draft', bg: 'bg-gray-200 border-gray-300', text: 'text-gray-700' },
          { status: 'sent', bg: 'bg-muted border-border', text: 'text-foreground' },
          { status: 'accepted', bg: 'bg-gray-100 border-green-200', text: 'text-gray-900' },
          { status: 'rejected', bg: 'bg-red-100 border-red-200', text: 'text-red-700' },
          { status: 'expired', bg: 'bg-amber-100 border-gray-200', text: 'text-amber-700' },
        ].map((item) => (
          <div key={item.status} className={`rounded-md p-3 text-center border ${item.bg}`}>
            <p className={`text-page-title ${item.text}`}>{quotations.filter(q => q.status === item.status).length}</p>
            <p className={`text-xs capitalize font-medium ${item.text}`}>{item.status}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search quotations by number, client..."
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
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        {profile?.role !== 'marketing' && (
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-auto min-w-[160px] h-9 text-sm">
              <SelectValue placeholder="All Marketing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Marketing</SelectItem>
              {ownerOptions.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
              <SelectItem value="unassigned">Direct / Unassigned</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Marketing performance strip — admin only. Reflects the owner filter. */}
      {profile?.role === 'admin' && (
        <div className="bg-white rounded-md border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Performance · {perfLabel}
            </p>
            <Link href="/admin/team/performance" className="text-xs font-medium text-primary hover:underline">
              Full team report →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center">
              <p className="text-page-title text-gray-900">{perf.quotes}</p>
              <p className="text-xs text-gray-500">Quotes</p>
            </div>
            <div className="text-center">
              <p className="text-page-title text-gray-900">{formatCurrency(perf.pipeline)}</p>
              <p className="text-xs text-gray-500">Pipeline value</p>
            </div>
            <div className="text-center">
              <p className="text-page-title text-gray-900">{perf.converted}</p>
              <p className="text-xs text-gray-500">Converted</p>
            </div>
            <div className="text-center">
              <p className="text-page-title text-gray-900">{perf.conversion}%</p>
              <p className="text-xs text-gray-500">Conversion</p>
            </div>
            <div className="text-center">
              <p className="text-page-title text-green-700">{formatCurrency(perf.revenue)}</p>
              <p className="text-xs text-gray-500">Order revenue</p>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {quotationsLoading ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-md border border-gray-200">Loading quotations...</div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-md border border-gray-200">
            No quotations found matching your criteria.
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="lg:hidden space-y-4">
              {filteredQuotations.map((q) => {
                // Determine header color based on status
                const headerColors = {
                  'sent': 'bg-gray-700',
                  'viewed': 'bg-gray-800',
                  'accepted': 'bg-gray-900',
                  'rejected': 'bg-red-600',
                  'expired': 'bg-gray-400',
                  'draft': 'bg-gray-500',
                };
                const headerBg = headerColors[q.status as keyof typeof headerColors] || 'bg-gray-500';
                const headerTextColor = 'text-white';

                return (
                  <div key={q.id} className="bg-white rounded-md overflow-hidden hover:shadow-sm transition-all border border-gray-200">
                    {/* Colored Header Tab */}
                    <div className={`${headerBg} px-4 py-2.5 flex items-center justify-between`}>
                      <span className={`${headerTextColor} font-semibold text-sm md:text-base`}>
                        {q.quote_number}
                      </span>
                      <span className={`${headerTextColor}/90 text-sm`}>
                        {formatDate(q.created_at)}
                      </span>
                    </div>

                    {/* White Card Body */}
                    <div className="p-4">
                      {/* Company/Client Name */}
                      <h3 className="text-gray-900 font-bold text-lg mb-1">
                        {q.client?.company || q.lead?.company || q.lead?.name || q.client?.name || 'Unknown Client'}
                      </h3>

                      {/* Contact Person */}
                      {(q.client?.company || q.lead?.company) && (
                        <p className="text-gray-500 text-sm mb-2">
                          {q.client?.name || (q.lead ? 'LEAD' : 'No Contact')}
                        </p>
                      )}

                      {/* Source / Marketing owner */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        {renderSource(q, true)}
                      </div>

                      {/* View full quotation (PDF / print preview) */}
                      <button
                        onClick={() => handlePreviewPDF(q)}
                        className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 p-3 rounded-md mb-4 flex items-center justify-center gap-2 font-medium text-sm transition-colors"
                      >
                        <FileText size={16} />
                        View Quotation
                      </button>

                      {/* Price & Status Row */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-900 font-bold text-2xl font-bold">
                          {formatCurrency(q.total_amount)}
                        </span>
                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 ${getStatusColor(q.status)}`}>
                          {getStatusIcon(q.status)}
                          {q.status}
                        </span>
                      </div>

                      {/* Valid Until Info */}
                      {q.valid_until && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
                          <Clock size={16} className="text-gray-400" />
                          <span>Valid Until: {formatDate(q.valid_until)}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {(q.status === 'sent' || q.status === 'viewed' || q.status === 'draft') && (
                          <button
                            onClick={() => handleConvertToOrder(q)}
                            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={18} />
                            <span className="hidden sm:inline">Accept</span>
                          </button>
                        )}
                        {q.status === 'accepted' && (
                          (q as any).converted_to_job_id
                            ? (
                              // Already converted — show a locked green chip
                              <div className="flex-1 px-4 py-2.5 bg-green-50 border border-green-200 text-green-800 rounded-md font-medium flex items-center justify-center gap-2 cursor-default">
                                <CheckCircle size={18} className="text-green-600" />
                                <span>Order Already Created</span>
                              </div>
                            ) : (
                              // Not yet converted — show active button
                              <button
                                onClick={() => handleConvertToOrder(q)}
                                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                              >
                                <CheckCircle size={18} />
                                <span className="hidden sm:inline">Create Order</span>
                              </button>
                            )
                        )}
                        <button
                          onClick={() => handleEdit(q)}
                          className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(q)}
                          className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden lg:block bg-white rounded-md border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Quotation</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Client</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Source / Marketing</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Valid Until</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Status</th>
                    <th className="text-right px-6 py-4 text-label text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredQuotations.map((q) => (
                    <tr key={q.id} className={`hover:bg-gray-50 transition-colors ${q.status === 'accepted' || q.status === 'rejected' ? 'bg-gray-50/50 opacity-60' : ''}`}>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handlePreviewPDF(q)}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 underline decoration-indigo-400 decoration-2 underline-offset-2 inline-flex items-center gap-1.5 cursor-pointer"
                          title="Click to open the full quotation preview"
                        >
                          <FileText size={14} />
                          {q.quote_number}
                        </button>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(q.created_at)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{q.client?.company || q.lead?.company || q.lead?.name || q.client?.name || 'Unknown'}</p>
                        {(q.client?.company || q.lead?.company) && <p className="text-sm text-gray-500">{q.client?.name || (q.lead ? 'LEAD' : '')}</p>}
                      </td>
                      <td className="px-6 py-4">{renderSource(q)}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(q.total_amount)}</td>
                      <td className="px-6 py-4 text-gray-600">{q.valid_until ? formatDate(q.valid_until) : '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1 w-fit px-3 py-1 text-xs rounded-md ${getStatusColor(q.status)}`}>
                          {getStatusIcon(q.status)}
                          {q.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {q.status === 'accepted' && (
                            (q as any).converted_to_job_id
                              ? (
                                // Already converted — show locked badge, NOT a clickable button
                                <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-md text-sm font-medium flex items-center gap-1 cursor-default" title="Order already created from this quotation">
                                  <CheckCircle size={14} /> Order Created
                                </span>
                              ) : (
                                // Not yet converted — show active button
                                <button
                                  onClick={() => handleConvertToOrder(q)}
                                  className="px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors flex items-center gap-1.5"
                                  title="Convert this quotation to an order"
                                >
                                  <ArrowRight size={13} /> Order
                                </button>
                              )
                          )}
                          {(q.status === 'sent' || q.status === 'viewed' || q.status === 'draft') && (
                            <button
                              onClick={() => handleConvertToOrder(q)}
                              className="p-2 hover:bg-muted text-primary rounded-md"
                              title="Convert to Order"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                          <button onClick={() => handleEdit(q)} className="p-2 hover:bg-gray-100 rounded-md" title="Edit">
                            <Edit size={18} className="text-gray-500" />
                          </button>
                          <button onClick={() => handleDownloadPDF(q)} className="p-2 hover:bg-gray-100 rounded-md" title="Download PDF">
                            <Download size={18} className="text-gray-500" />
                          </button>
                          <button onClick={() => handleDelete(q.id, q.quote_number)} className="p-2 hover:bg-red-50 rounded-md" title="Delete">
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

      {/* Quotation Preview Modal */}
      {previewData && (
        <QuotationPreview data={previewData} onClose={() => setPreviewData(null)} />
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-section text-gray-900">
                {isEditing ? 'Edit Quotation' : 'New Quotation'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Client / Lead — full width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client / Lead *</label>
                <div className="flex gap-2">
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
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
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
                  <button
                    type="button"
                    title="Add New Client"
                    onClick={() => setShowClientModal(true)}
                    className="px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Type *</label>
                  <select
                    required
                    value={formData.orderType}
                    onChange={(e) => setFormData({ ...formData, orderType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
                  >
                    <option value="print">Print Only</option>
                    <option value="design">Design Only</option>
                    <option value="design_print">Design + Print</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.orderType === 'print' && 'Client provides design files'}
                    {formData.orderType === 'design' && 'Design work only, no printing'}
                    {formData.orderType === 'design_print' && 'Full service with design and printing'}
                  </p>
                </div>

                {formData.orderType === 'design_print' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Category *</label>
                    <select
                      required
                      value={formData.productCategory}
                      onChange={(e) => setFormData({ ...formData, productCategory: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
                    >
                      <option value="">Select Product</option>
                      {dbCategories.map((c: any) => (
                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Items</label>
                  <button type="button" onClick={addItem} className="text-sm font-medium text-primary hover:text-primary">+ Add Item</button>
                </div>
                {/* Column headers */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 mb-1">
                  <div className="col-span-5 text-xs font-semibold text-gray-500 uppercase">Description</div>
                  <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase">Qty</div>
                  <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase">Rate/pc</div>
                  <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase">Amount</div>
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded-md border border-gray-200">
                      <div className="col-span-12 sm:col-span-5">
                        <ItemAutocomplete
                          placeholder="Description (type to search saved items)"
                          value={item.description}
                          onChange={(text) => updateItem(index, 'description', text)}
                          onSelect={(cat) => fillItemFromCatalog(index, cat)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                        />
                        {/* Per-item category — routes THIS item to its own production channel (mix jobs) */}
                        <select
                          value={item.product_category || ''}
                          onChange={(e) => updateItem(index, 'product_category', e.target.value)}
                          className={`w-full mt-2 px-3 py-2 border rounded-md text-sm bg-white ${item.product_category ? 'border-gray-200 text-gray-800' : 'border-amber-300 text-amber-700'}`}
                          title="Product category for this item (Box / Label / Pouch). Each item routes to its own production channel."
                        >
                          <option value="">⚠ Select category…</option>
                          {dbCategories.map((c: any) => (
                            <option key={c.id || c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Rate/pc"
                          min="0"
                          step="any"
                          value={item.rate || ''}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
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
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
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
                      className="w-full px-2 py-1 border border-gray-200 rounded-md bg-white text-sm"
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
                    <div className="font-bold text-primary text-lg">{formatCurrency(formData.totalAmount)}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                  <textarea
                    rows={2}
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                    placeholder="Payment terms, delivery timeline..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Internal)</label>
                  <textarea
                    rows={1}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Quick Add Modal */}
      <ClientQuickAddModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onSuccess={(clientId) => {
          refetchClients();
          setFormData(prev => ({ ...prev, clientId, leadId: '' }));
          setShowClientModal(false);
        }}
      />
    </div>
  );
}
