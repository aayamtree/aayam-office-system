'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
  Calendar, User, Download, MessageCircle, Printer, Loader2, CheckCircle
} from 'lucide-react';
import { InvoiceData, downloadInvoicePDF, printInvoicePDF } from '@/components/invoice/InvoicePDF';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { shareOnWhatsApp, getInvoiceMessage, getPaymentReminderMessage } from '@/lib/whatsapp';
import { useInvoices, useClients, useJobs } from '@/lib/hooks';
import ClientQuickAddModal from '@/components/shared/ClientQuickAddModal';
import { Invoice, Client, InvoiceItem } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { logActivity } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export default function InvoicesPage() {
  const { settings: companySettings } = useCompanySettings();
  const { invoices, loading: invoicesLoading, createInvoice, updateInvoice, saveInvoiceItems, refetch: refetchInvoices } = useInvoices();
  const { clients, refetch: refetchClients } = useClients();
  const [showClientModal, setShowClientModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    clientId: '',
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    items: [{ description: '', item_notes: '', hsn_code: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 }] as InvoiceItem[],
    subtotal: 0,
    gstRate: 18,
    supplyType: 'inter_state' as 'inter_state' | 'intra_state', // inter = IGST, intra = CGST+SGST
    totalTax: 0,
    totalAmount: 0,
    paidAmount: 0,
    status: 'draft' as Invoice['payment_status'],
    notes: '',
    jobId: '',
  });

  // Convert Database Invoice to PDF Data format
  const convertToInvoiceData = (invoice: Invoice): InvoiceData => {
    // Safely handle potentially missing or undefined nested objects
    const clientName = invoice.client?.name || 'Unknown Client';
    const clientCompany = invoice.client?.company || '';
    const clientAddress = invoice.client?.address || '';
    const clientCity = invoice.client?.city || '';
    const clientState = invoice.client?.state || '';
    const clientPincode = invoice.client?.pincode || '';
    const clientPhone = invoice.client?.phone || '';
    const clientGstin = invoice.client?.gstin || '';

    // Calculate tax details from items if available, or fallbacks
    const items = invoice.items || [];

    // Aggregate tax amounts (simplified logic assuming unified tax handling or derived from total)
    // Ideally, we sum up CGST, SGST, IGST from the invoice record
    const cgstAmount = invoice.cgst_amount || 0;
    const sgstAmount = invoice.sgst_amount || 0;
    const igstAmount = invoice.igst_amount || 0;

    // Determine rates (simplified)
    const effectiveGstRate = invoice.items && invoice.items.length > 0 ? invoice.items[0].gst_rate : 18;

    return {
      ...companySettings,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: formatDate(invoice.invoice_date),
      dueDate: invoice.due_date ? formatDate(invoice.due_date) : '',
      clientName,
      clientCompany,
      clientAddress,
      clientCity,
      clientState,
      clientPincode,
      clientPhone,
      clientGstin,
      items: items.map(item => ({
        description: item.description,
        hsn: item.hsn_code || '4911',
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      })),
      subtotal: invoice.subtotal,
      cgstRate: effectiveGstRate / 2,
      cgstAmount: cgstAmount,
      sgstRate: effectiveGstRate / 2,
      sgstAmount: sgstAmount,
      igstRate: effectiveGstRate,
      igstAmount: igstAmount,
      totalTax: invoice.total_tax,
      discount: invoice.discount_amount,
      grandTotal: invoice.total_amount,
      isPaid: invoice.payment_status === 'paid',
      bankName: companySettings.bankName,
      bankAccount: companySettings.bankAccount,
      bankIfsc: companySettings.bankIfsc,
      bankBranch: companySettings.bankBranch,
      notes: invoice.notes
    };
  };

  // Handle PDF Download
  const handleDownloadPDF = async (invoice: Invoice) => {
    if (!invoice.client) {
      toast.info('Client details missing for this invoice.');
      return;
    }
    setPdfLoading(true);
    try {
      const invoiceData = convertToInvoiceData(invoice);
      await downloadInvoicePDF(invoiceData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error generating PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle PDF Print
  const handlePrintPDF = async (invoice: Invoice) => {
    if (!invoice.client) {
      toast.info('Client details missing for this invoice.');
      return;
    }
    setPdfLoading(true);
    try {
      const invoiceData = convertToInvoiceData(invoice);
      await printInvoicePDF(invoiceData);
    } catch (error) {
      console.error('Error printing PDF:', error);
      toast.error('Error printing. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle WhatsApp Share Invoice
  const handleWhatsAppShare = (invoice: Invoice) => {
    if (!invoice.client?.phone) {
      toast.info('Client phone number is missing.');
      return;
    }

    const itemsList = invoice.items?.map(i => `${i.description} (${i.quantity})`).join(', ') || '';

    const message = getInvoiceMessage({
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client?.name || '',
      clientCompany: invoice.client?.company || '',
      totalAmount: invoice.total_amount,
      paidAmount: invoice.amount_paid,
      dueDate: invoice.due_date ? formatDate(invoice.due_date) : '',
      items: itemsList,
    });
    shareOnWhatsApp(invoice.client.phone, message, `${invoice.client.name} (${invoice.client.company})`);
  };

  // Handle WhatsApp Payment Reminder
  const handlePaymentReminder = (invoice: Invoice) => {
    if (!invoice.client?.phone) {
      toast.info('Client phone number is missing.');
      return;
    }
    const message = getPaymentReminderMessage({
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client?.name || '',
      clientCompany: invoice.client?.company || '',
      totalAmount: invoice.total_amount,
      paidAmount: invoice.amount_paid,
      dueDate: invoice.due_date ? formatDate(invoice.due_date) : '',
    });
    shareOnWhatsApp(invoice.client.phone, message, `${invoice.client.name} (${invoice.client.company})`);
  };

  const calculateItemTotal = (item: InvoiceItem) => {
    return item.quantity * item.rate;
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }

    setFormData(prev => {
      const updatedItems = newItems;
      const sub = updatedItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = Math.round(sub * (prev.gstRate / 100));
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
      items: [...prev.items, { description: '', item_notes: '', hsn_code: '', quantity: 1, rate: 0, amount: 0, gst_rate: prev.gstRate } as InvoiceItem]
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
      invoiceNumber: '', // Will be auto-generated
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ description: '', item_notes: '', hsn_code: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 } as InvoiceItem],
      subtotal: 0,
      gstRate: 18,
      supplyType: 'inter_state' as const,
      totalTax: 0,
      totalAmount: 0,
      paidAmount: 0,
      status: 'pending',
      notes: '',
      jobId: '',
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (inv: Invoice) => {
    const items = inv.items || [];
    // Assuming uniform GST rate for simplicity in this form version
    const gstRate = items.length > 0 ? items[0].gst_rate : 18;

    setFormData({
      clientId: inv.client_id || '',
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : '',
      dueDate: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : '',
      items: items.length > 0 ? items : [{ description: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 } as InvoiceItem],
      subtotal: inv.subtotal,
      gstRate: gstRate,
      supplyType: 'inter_state' as const,
      totalTax: inv.total_tax,
      totalAmount: inv.total_amount,
      paidAmount: inv.amount_paid,
      status: inv.payment_status,
      notes: inv.notes || '',
      jobId: inv.job_id || '',
    });
    setSelectedInvoice(inv);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const isInterState = formData.supplyType === 'inter_state';
      const { items, ...invoiceFields } = {
        client_id: formData.clientId,
        invoice_date: formData.invoiceDate,
        due_date: formData.dueDate,
        subtotal: formData.subtotal,
        cgst_amount: isInterState ? 0 : formData.totalTax / 2,
        sgst_amount: isInterState ? 0 : formData.totalTax / 2,
        igst_amount: isInterState ? formData.totalTax : 0,
        total_tax: formData.totalTax,
        discount_amount: 0,
        total_amount: formData.totalAmount,
        payment_status: formData.status,
        amount_paid: formData.paidAmount,
        balance_due: formData.totalAmount - formData.paidAmount,
        notes: formData.notes,
        job_id: formData.jobId || undefined,
        items: formData.items,
      };

      let invoiceId = selectedInvoice?.id;

      if (isEditing && invoiceId) {
        await updateInvoice(invoiceId, invoiceFields);

        // Log activity
        const client = clients.find(c => c.id === formData.clientId);
        await logActivity(
          'Updated Invoice',
          'Finance',
          invoiceId,
          `Updated invoice ${selectedInvoice?.invoice_number} for ${client?.company || client?.name}`
        );
      } else {
        const { data, error } = await createInvoice(invoiceFields);
        if (error) throw new Error(error);
        if (data) {
          invoiceId = data.id;

          // Log activity
          const client = clients.find(c => c.id === formData.clientId);
          await logActivity(
            'Created Invoice',
            'Finance',
            invoiceId,
            `Created invoice for ${client?.company || client?.name} - Amount: ₹${formData.totalAmount.toLocaleString()}`
          );
        }
      }

      if (invoiceId) {
        await saveInvoiceItems(invoiceId, items);
      }

      setShowModal(false);
      // BUG-10: Refresh invoice list immediately so the stale 'Pending Invoice' banner disappears
      refetchInvoices();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    } finally {
      setSubmitting(false);
    }
  };

  // BUG-03: Compute effective display status — show 'overdue' if past due date and not paid
  const today = new Date().toISOString().split('T')[0];
  const getEffectiveStatus = (inv: Invoice): string => {
    if (inv.payment_status === 'paid') return 'paid';
    if (inv.due_date && inv.due_date < today && inv.payment_status === 'pending') return 'overdue';
    return inv.payment_status;
  };

  const filteredInvoices = invoices.filter(inv => {
    const effectiveStatus = getEffectiveStatus(inv);
    const matchesSearch =
      (inv.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.client?.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.client?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-700 border-gray-200',
      'partial': 'bg-amber-100 text-amber-700 border-gray-200',
      'paid': 'bg-gray-100 text-gray-900 border-green-200',
      'overdue': 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // BUG-12: Delete invoice with confirmation
  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This action cannot be undone.`)) return;
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
    if (error) {
      toast.error('Cannot delete invoice: ' + error.message);
    } else {
      toast.success('Invoice deleted successfully.');
      refetchInvoices();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const { jobs } = useJobs();

  // BUG-10: Jobs ready for invoicing — only show jobs WITHOUT an existing invoice
  const invoicedJobIds = new Set(invoices.map(inv => inv.job_id).filter(Boolean));
  const pendingInvoicingJobs = jobs.filter(j =>
    (['dispatched', 'delivered'].includes(j.current_stage)) &&
    j.payment_status !== 'paid' &&
    !invoicedJobIds.has(j.id)  // Exclude jobs that already have an invoice
  ).slice(0, 5);

  const handleCreateFromJob = (job: any) => {
    // Pre-fill invoice with Job Data
    const items = [{
      description: `${job.job_type || 'Print Job'}: ${job.project_name}`,
      quantity: job.quantity,
      rate: job.quote_per_piece || 0, // Fallback if 0
      amount: (job.quantity * (job.quote_per_piece || 0)),
      gst_rate: job.gst_rate || 18,
      hsn_code: '4911'
    }];

    // Calculate totals
    const subtotal = items[0].amount;
    const tax = Math.round(subtotal * (items[0].gst_rate / 100));

    setFormData({
      clientId: job.client_id || '',
      invoiceNumber: '', // Auto
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: items as any, // Cast to InvoiceItem
      subtotal: subtotal,
      gstRate: items[0].gst_rate,
      totalTax: tax,
      totalAmount: subtotal + tax,
      paidAmount: 0,
      supplyType: 'inter_state' as const,
      status: 'pending',
      notes: `Generated from Job #${job.job_number}`,
      jobId: job.id,
    });

    setIsEditing(false);
    setShowModal(true);
  };

  const totalOutstanding = invoices
    .filter(i => i.payment_status !== 'paid')
    .reduce((sum, i) => sum + (i.total_amount - i.amount_paid), 0);

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-md lg:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg md:text-xl lg:text-page-title text-gray-900">Invoices</h1>
            <p className="text-xs md:text-sm text-gray-500">{filteredInvoices.length} invoices • Outstanding: {formatCurrency(totalOutstanding)}</p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold"
        >
          <Plus className="w-4 h-4 md:hidden" />
          <Plus className="w-4 h-4 md:w-4.5 md:h-4.5 hidden md:block" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Ready for Invoicing Alert (Data Flow: Jobs -> Finance) */}
      {
        pendingInvoicingJobs.length > 0 && (
          <div className="bg-card rounded-md border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-muted rounded-md">
                <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Completed Jobs Pending Invoice</h3>
                <p className="text-[10px] text-muted-foreground">Recently dispatched jobs ready for billing</p>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {pendingInvoicingJobs.map((job: any) => (
                <div key={job.id} className="min-w-[220px] bg-card border border-border border-l-4 border-l-amber-400 rounded-md flex flex-col justify-between hover:shadow-sm transition-shadow">
                  <div className="bg-amber-50/60 px-3 py-1.5 border-b border-border/50 rounded-tr-md flex items-center justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground">{job.job_number}</span>
                    <span className="text-[9px] font-bold text-amber-700">₹{job.total_amount}</span>
                  </div>
                  <div className="px-3 pt-1.5 pb-2.5">
                    <p className="font-semibold text-foreground text-xs truncate" title={job.project_name}>{job.project_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{job.client?.company || 'Unknown Client'}</p>
                    <button
                      onClick={() => handleCreateFromJob(job)}
                      className="mt-2 w-full py-1.5 text-[10px] font-bold bg-foreground text-background rounded flex items-center justify-center gap-1 hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-3 h-3" /> Create Invoice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        {[
          { status: 'pending', label: 'Pending', bg: 'bg-gray-100 border-gray-200', text: 'text-gray-700' },
          { status: 'partial', label: 'Partial', bg: 'bg-amber-100 border-gray-200', text: 'text-amber-700' },
          { status: 'paid', label: 'Paid', bg: 'bg-gray-100 border-green-200', text: 'text-gray-900' },
          { status: 'overdue', label: 'Overdue', bg: 'bg-red-100 border-red-200', text: 'text-red-700' },
        ].map((item) => (
          <div key={item.status} className={`rounded-md md:rounded-md p-2 md:p-3 text-center border ${item.bg}`}>
            <p className={`text-lg md:text-page-title ${item.text}`}>{invoices.filter(i => i.payment_status === item.status).length}</p>
            <p className={`text-xs md:text-label ${item.text}`}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 md:w-4.5 md:h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices by number, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {invoicesLoading ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-md border border-gray-100">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-md border border-gray-100">
            No invoices found matching your criteria.
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="lg:hidden space-y-2.5">
              {filteredInvoices.map((inv) => {
                // Left border color based on status
                const borderColors: Record<string, string> = {
                  'paid': 'border-l-green-400',
                  'partial': 'border-l-amber-400',
                  'pending': 'border-l-stone-400',
                  'overdue': 'border-l-red-400',
                };
                const tintBgs: Record<string, string> = {
                  'paid': 'bg-green-50/60',
                  'partial': 'bg-amber-50/60',
                  'pending': 'bg-stone-50/60',
                  'overdue': 'bg-red-50/60',
                };
                const effStatus = getEffectiveStatus(inv);
                const borderColor = borderColors[effStatus] || 'border-l-stone-300';
                const tintBg = tintBgs[effStatus] || 'bg-stone-50';

                return (
                  <div key={inv.id} className={`bg-card rounded-md border border-border border-l-4 ${borderColor} hover:shadow-sm transition-shadow`}>
                    {/* Tinted strip */}
                    <div className={`${tintBg} px-3 py-2 flex items-center justify-between border-b border-border/50 rounded-tr-md`}>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">{inv.invoice_number}</span>
                      <span className="text-[9px] text-muted-foreground">{formatDate(inv.invoice_date)}</span>
                    </div>

                    {/* Card Body */}
                    <div className="px-4 py-3">
                      {/* Client — show company as primary, contact person as sub-text */}
                      <h3 className="text-foreground font-bold text-sm mb-0.5">{inv.client?.company || inv.client?.name || '—'}</h3>
                      {inv.client?.company && <p className="text-[10px] text-muted-foreground mb-2">{inv.client?.name}</p>}

                      {/* Price & Status — BUG-03: use effective status */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-bold text-xl">{formatCurrency(inv.total_amount)}</span>
                          {inv.amount_paid > 0 && inv.amount_paid < inv.total_amount && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Paid: {formatCurrency(inv.amount_paid)}</p>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-semibold rounded border ${getStatusColor(getEffectiveStatus(inv))}`}>
                          {getEffectiveStatus(inv)}
                        </span>
                      </div>

                      {/* Due Date */}
                      {inv.due_date && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-3 pb-2 border-b border-border/50">
                          <Calendar className="w-3 h-3" />
                          <span>Due: {formatDate(inv.due_date)}</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleDownloadPDF(inv)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-foreground text-background rounded text-xs font-medium hover:opacity-90 transition-opacity"
                        >
                          <Download className="w-3 h-3" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                        <button
                          onClick={() => handleWhatsAppShare(inv)}
                          className="px-2.5 py-1.5 border border-border text-muted-foreground rounded text-xs hover:text-foreground transition-colors"
                          aria-label="Share via WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleEdit(inv)}
                          className="px-2.5 py-1.5 border border-border text-muted-foreground rounded text-xs hover:text-foreground transition-colors"
                          aria-label="Edit invoice"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden lg:block bg-white rounded-md border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Invoice</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Client</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Due Date</th>
                    <th className="text-left px-6 py-4 text-label text-gray-500 uppercase">Status</th>
                    <th className="text-right px-6 py-4 text-label text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">{inv.invoice_number}</span>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(inv.invoice_date)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{inv.client?.company || inv.client?.name || '—'}</p>
                        {inv.client?.company && <p className="text-sm text-gray-500">{inv.client?.name}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</p>
                        {inv.amount_paid > 0 && inv.amount_paid < inv.total_amount && (
                          <p className="text-xs text-destructive">Paid: {formatCurrency(inv.amount_paid)}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                      <td className="px-6 py-4">
                        {/* BUG-03: Show computed effective status (overdue if past due date) */}
                        <span className={`px-3 py-1 text-xs rounded-md border ${getStatusColor(getEffectiveStatus(inv))}`}>
                          {getEffectiveStatus(inv)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setSelectedInvoice(inv); setShowViewModal(true); }} className="p-2 hover:bg-gray-100 rounded-md" title="View">
                            <Eye className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-500" />
                          </button>
                          <button onClick={() => handleWhatsAppShare(inv)} className="p-2 hover:bg-white rounded-md" title="Share on WhatsApp">
                            <MessageCircle className="w-4 h-4 md:w-4.5 md:h-4.5 text-foreground" />
                          </button>
                          <button onClick={() => handleDownloadPDF(inv)} className="p-2 hover:bg-gray-900 rounded-md" title="Download PDF">
                            <Download className="w-4 h-4 md:w-4.5 md:h-4.5 text-primary" />
                          </button>
                          <button onClick={() => handleEdit(inv)} className="p-2 hover:bg-gray-100 rounded-md" title="Edit">
                            <Edit className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-500" />
                          </button>
                          {/* BUG-12: Delete button (admin-only via confirmation dialog) */}
                          <button onClick={() => handleDeleteInvoice(inv)} className="p-2 hover:bg-red-50 rounded-md" title="Delete Invoice">
                            <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5 text-red-400 hover:text-red-600" />
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
      {
        showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                <h2 className="text-page-title text-gray-900">
                  {isEditing ? 'Edit Invoice' : 'New Invoice'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Client *</label>
                    <div className="flex gap-2">
                      <select
                        required
                        value={formData.clientId}
                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value, jobId: '' })}
                        className="flex-1 px-2 py-2 md:px-4 md:py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white text-sm md:text-base"
                      >
                        <option value="">Select Client</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.company} ({c.name})</option>
                        ))}
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Job ID</label>
                    <select
                      value={formData.jobId}
                      onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                      disabled={!formData.clientId}
                      className="w-full px-2 py-2 md:px-4 md:py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white disabled:bg-gray-100 disabled:text-gray-400 text-sm md:text-base"
                    >
                      <option value="">Select Job (Optional)</option>
                      {jobs
                        .filter(j => j.client_id === formData.clientId && /^(DO|PO|DP|AAY)-/.test(j.job_number || ''))
                        .map(j => (
                          <option key={j.id} value={j.id}>{j.job_number} - {j.project_name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      style={{ boxSizing: 'border-box', minWidth: 0 }}
                      className="w-full max-w-[200px] sm:max-w-full px-2 py-2 md:px-4 md:py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm md:text-base"
                    />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Items</label>
                    <button type="button" onClick={addItem} className="text-sm font-medium text-primary hover:text-primary">+ Add Item</button>
                  </div>
                  {/* Column headers */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-1 mb-1">
                    <div className="col-span-4 text-xs text-gray-400 font-medium">Item Name</div>
                    <div className="col-span-2 text-xs text-gray-400 font-medium">HSN/SAC</div>
                    <div className="col-span-2 text-xs text-gray-400 font-medium">Qty</div>
                    <div className="col-span-2 text-xs text-gray-400 font-medium">Rate (₹)</div>
                    <div className="col-span-2 text-xs text-gray-400 font-medium">Amount</div>
                  </div>

                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-100 space-y-2">
                        {/* Row 1: Description + HSN + Qty + Rate + Amount */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 sm:col-span-4">
                            <input
                              type="text"
                              placeholder="Item name *"
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-medium"
                            />
                          </div>
                          <div className="col-span-5 sm:col-span-2">
                            <input
                              type="text"
                              placeholder="HSN/SAC"
                              value={item.hsn_code || ''}
                              onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                            />
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
                          <div className="col-span-4 sm:col-span-2">
                            <input
                              type="number"
                              placeholder="Rate"
                              min="0"
                              step="0.01"
                              value={item.rate || ''}
                              onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                            />
                          </div>
                          <div className="col-span-12 sm:col-span-2 flex items-center justify-between">
                            <span className="font-semibold text-gray-800 text-sm">{formatCurrency(item.amount)}</span>
                            {formData.items.length > 1 && (
                              <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-1 ml-1">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Row 2: Sub-description (optional) */}
                        <input
                          type="text"
                          placeholder="Sub-description (e.g. 4 Design x 3200 pcs, colour, size...)"
                          value={item.item_notes || ''}
                          onChange={(e) => updateItem(index, 'item_notes', e.target.value)}
                          className="w-full px-3 py-1.5 border border-dashed border-gray-300 rounded-md text-xs text-gray-500 bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financials */}
                <div className="bg-gray-50 p-4 rounded-md border border-gray-100 space-y-4">
                  {/* Supply Type Toggle */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supply Type</label>
                    <div className="flex rounded-md border border-gray-200 overflow-hidden text-sm">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, supplyType: 'inter_state' }))}
                        className={`px-3 py-1.5 font-medium transition-colors ${formData.supplyType === 'inter_state' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        Inter-State (IGST)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, supplyType: 'intra_state' }))}
                        className={`px-3 py-1.5 font-medium transition-colors ${formData.supplyType === 'intra_state' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        Intra-State (CGST+SGST)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subtotal</label>
                      <div className="font-bold text-gray-900 text-lg">{formatCurrency(formData.subtotal)}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">GST Rate</label>
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
                    {formData.supplyType === 'inter_state' ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">IGST ({formData.gstRate}%)</label>
                        <div className="font-bold text-gray-700">{formatCurrency(formData.totalTax)}</div>
                      </div>
                    ) : (
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">CGST ({formData.gstRate / 2}%) + SGST ({formData.gstRate / 2}%)</label>
                        <div className="font-bold text-gray-700">{formatCurrency(formData.totalTax / 2)} + {formatCurrency(formData.totalTax / 2)}</div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Grand Total</label>
                      <div className="font-bold text-primary text-lg">{formatCurrency(formData.totalAmount)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 border-t border-gray-200 pt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Paid Amount (₹)</label>
                      <input
                        type="number"
                        value={formData.paidAmount || ''}
                        onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </div>
                  </div>
                </div>


                <div className="flex gap-2 md:gap-4 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-900 transition-colors -200 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* View Modal */}
      {
        showViewModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div>
                  <h2 className="text-page-title text-gray-900">{selectedInvoice.invoice_number}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                    {selectedInvoice.payment_status === 'overdue' && (
                      <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-md">OVERDUE</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-6">
                {/* Client Info */}
                <div className="flex items-center gap-2 md:gap-4 p-4 bg-gray-50 rounded-md border border-gray-100">
                  <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedInvoice.client?.company || selectedInvoice.client?.name}</h3>
                    {selectedInvoice.client?.company && <p className="text-sm text-gray-600">{selectedInvoice.client?.name}</p>}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Items</h4>
                  <div className="space-y-3">
                    {selectedInvoice.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-sm pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium text-gray-900">{item.description}</p>
                          <p className="text-gray-500">{item.quantity} x {formatCurrency(item.rate)}</p>
                        </div>
                        <p className="font-semibold text-gray-900">{formatCurrency(item.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Amount Details */}
                <div className="bg-gray-900/50 rounded-md p-5 border border-border-100 space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>GST</span>
                    <span>{formatCurrency(selectedInvoice.total_tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-border-100">
                    <span>Total Amount</span>
                    <span className="text-lg">{formatCurrency(selectedInvoice.total_amount)}</span>
                  </div>
                  {selectedInvoice.amount_paid > 0 && (
                    <>
                      <div className="flex justify-between text-gray-900 font-medium">
                        <span>Paid</span>
                        <span>- {formatCurrency(selectedInvoice.amount_paid)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-700 pt-3 border-t border-border-100">
                        <span>Balance Due</span>
                        <span>{formatCurrency(selectedInvoice.total_amount - selectedInvoice.amount_paid)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Due Date & Status */}
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <div className="p-3 border rounded-md">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Due Date</p>
                    <p className="font-medium text-gray-900 mt-1">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : '-'}</p>
                  </div>
                  <div className="p-3 border rounded-md">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Status</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold uppercase rounded-md ${getStatusColor(selectedInvoice.payment_status).replace('border', '')}`}>
                      {selectedInvoice.payment_status}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handlePrintPDF(selectedInvoice)}
                    disabled={pdfLoading}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {pdfLoading ? <Loader2 className="w-4 h-4 md:w-4.5 md:h-4.5 animate-spin" /> : <Printer className="w-4 h-4 md:w-4.5 md:h-4.5" />}
                    Print
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(selectedInvoice)}
                    disabled={pdfLoading}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {pdfLoading ? <Loader2 className="w-4 h-4 md:w-4.5 md:h-4.5 animate-spin" /> : <Download className="w-4 h-4 md:w-4.5 md:h-4.5" />}
                    Download PDF
                  </button>
                  <button
                    onClick={() => handleWhatsAppShare(selectedInvoice)}
                    className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    Share on WhatsApp
                  </button>
                </div>

                {/* Payment Reminder Button - Only show if balance due */}
                {selectedInvoice.amount_paid < selectedInvoice.total_amount && (
                  <button
                    onClick={() => handlePaymentReminder(selectedInvoice)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-destructive text-white font-semibold rounded-md hover:bg-red-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    Send Payment Reminder
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }
      {/* Client Quick Add Modal */}
      <ClientQuickAddModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onSuccess={(clientId) => {
          refetchClients();
          setFormData(prev => ({ ...prev, clientId }));
          setShowClientModal(false);
        }}
      />
    </div >
  );
}
