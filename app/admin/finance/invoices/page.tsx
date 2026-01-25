'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
  Calendar, User, Download, MessageCircle, Printer, Loader2, CheckCircle
} from 'lucide-react';
import { InvoiceData, defaultCompanyData, downloadInvoicePDF, printInvoicePDF } from '@/components/invoice/InvoicePDF';
import { shareOnWhatsApp, getInvoiceMessage, getPaymentReminderMessage } from '@/lib/whatsapp';
import { useInvoices, useClients, useJobs } from '@/lib/hooks';
import { Invoice, Client, InvoiceItem } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { logActivity } from '@/lib/logger';

export default function InvoicesPage() {
  const { invoices, loading: invoicesLoading, createInvoice, updateInvoice, saveInvoiceItems } = useInvoices();
  const { clients } = useClients();

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
    items: [{ description: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 }] as InvoiceItem[],
    subtotal: 0,
    gstRate: 18, // Global rate for simplicity in UI, though items have individual rates
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
      ...defaultCompanyData,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: formatDate(new Date(invoice.invoice_date)),
      dueDate: invoice.due_date ? formatDate(new Date(invoice.due_date)) : '',
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
      bankName: defaultCompanyData.bankName,
      bankAccount: defaultCompanyData.bankAccount,
      bankIfsc: defaultCompanyData.bankIfsc,
      bankBranch: defaultCompanyData.bankBranch,
      notes: invoice.notes
    };
  };

  // Handle PDF Download
  const handleDownloadPDF = async (invoice: Invoice) => {
    if (!invoice.client) {
      alert('Client details missing for this invoice.');
      return;
    }
    setPdfLoading(true);
    try {
      const invoiceData = convertToInvoiceData(invoice);
      await downloadInvoicePDF(invoiceData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle PDF Print
  const handlePrintPDF = async (invoice: Invoice) => {
    if (!invoice.client) {
      alert('Client details missing for this invoice.');
      return;
    }
    setPdfLoading(true);
    try {
      const invoiceData = convertToInvoiceData(invoice);
      await printInvoicePDF(invoiceData);
    } catch (error) {
      console.error('Error printing PDF:', error);
      alert('Error printing. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle WhatsApp Share Invoice
  const handleWhatsAppShare = (invoice: Invoice) => {
    if (!invoice.client?.phone) {
      alert('Client phone number is missing.');
      return;
    }

    const itemsList = invoice.items?.map(i => `${i.description} (${i.quantity})`).join(', ') || '';

    const message = getInvoiceMessage({
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client?.name || '',
      clientCompany: invoice.client?.company || '',
      totalAmount: invoice.total_amount,
      paidAmount: invoice.amount_paid,
      dueDate: invoice.due_date ? formatDate(new Date(invoice.due_date)) : '',
      items: itemsList,
    });
    shareOnWhatsApp(invoice.client.phone, message, `${invoice.client.name} (${invoice.client.company})`);
  };

  // Handle WhatsApp Payment Reminder
  const handlePaymentReminder = (invoice: Invoice) => {
    if (!invoice.client?.phone) {
      alert('Client phone number is missing.');
      return;
    }
    const message = getPaymentReminderMessage({
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client?.name || '',
      clientCompany: invoice.client?.company || '',
      totalAmount: invoice.total_amount,
      paidAmount: invoice.amount_paid,
      dueDate: invoice.due_date ? formatDate(new Date(invoice.due_date)) : '',
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
      items: [...prev.items, { description: '', quantity: 1, rate: 0, amount: 0, gst_rate: prev.gstRate } as InvoiceItem]
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
      items: [{ description: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 } as InvoiceItem],
      subtotal: 0,
      gstRate: 18,
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
      const { items, ...invoiceFields } = {
        client_id: formData.clientId,
        invoice_date: formData.invoiceDate,
        due_date: formData.dueDate,
        subtotal: formData.subtotal,
        cgst_amount: formData.totalTax / 2, // Simplified tax split
        sgst_amount: formData.totalTax / 2,
        igst_amount: 0,
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
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.client?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.client?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-700 border-gray-200',
      'partial': 'bg-amber-100 text-amber-700 border-amber-200',
      'paid': 'bg-green-100 text-green-700 border-green-200',
      'overdue': 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const { jobs } = useJobs();

  // Jobs ready for invoicing (Dispatched/Delivered but not fully paid?)
  // Ideally check if invoice exists, but for now we show dispatched jobs.
  const pendingInvoicingJobs = jobs.filter(j =>
    (['dispatched', 'delivered'].includes(j.current_stage)) &&
    j.payment_status !== 'paid'
  ).slice(0, 5); // Show top 5 recent

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
    <div className="space-y-4 lg:space-y-6 px-3 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-xs md:text-sm text-gray-500">{filteredInvoices.length} invoices • Outstanding: {formatCurrency(totalOutstanding)}</p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-sm md:text-base"
        >
          <Plus size={16} className="md:hidden" />
          <Plus size={18} className="hidden md:block" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Ready for Invoicing Alert (Data Flow: Jobs -> Finance) */}
      {
        pendingInvoicingJobs.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <CheckCircle size={18} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Completed Jobs Pending Invoice</h3>
                <p className="text-xs text-gray-500">Recently dispatched jobs ready for billing</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              {pendingInvoicingJobs.map((job: any) => (
                <div key={job.id} className="min-w-[280px] bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">{job.job_number}</span>
                      <span className="text-xs font-bold text-indigo-600">₹{job.total_amount}</span>
                    </div>
                    <p className="font-semibold text-gray-800 text-sm truncate" title={job.project_name}>{job.project_name}</p>
                    <p className="text-xs text-gray-500 truncate">{job.client?.company || 'Unknown Client'}</p>
                  </div>
                  <button
                    onClick={() => handleCreateFromJob(job)}
                    className="mt-3 w-full py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> Create Invoice
                  </button>
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
          { status: 'partial', label: 'Partial', bg: 'bg-amber-100 border-amber-200', text: 'text-amber-700' },
          { status: 'paid', label: 'Paid', bg: 'bg-green-100 border-green-200', text: 'text-green-700' },
          { status: 'overdue', label: 'Overdue', bg: 'bg-red-100 border-red-200', text: 'text-red-700' },
        ].map((item) => (
          <div key={item.status} className={`rounded-lg md:rounded-xl p-2 md:p-3 text-center border ${item.bg}`}>
            <p className={`text-lg md:text-xl font-bold ${item.text}`}>{invoices.filter(i => i.payment_status === item.status).length}</p>
            <p className={`text-[10px] md:text-xs font-medium ${item.text}`}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices by number, client..."
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
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {invoicesLoading ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
            No invoices found matching your criteria.
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="lg:hidden space-y-4">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative">
                  {/* Row 1: Invoice # & Status */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-gray-900 font-mono text-sm bg-gray-100 px-2 py-1 rounded-md">{inv.invoice_number}</span>
                      <p className="text-[10px] text-gray-400 mt-1">{formatDate(inv.invoice_date)}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full border ${getStatusColor(inv.payment_status)}`}>
                      {inv.payment_status}
                    </span>
                  </div>

                  {/* Row 2: Client & Amount */}
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 leading-tight mb-0.5">{inv.client?.company || 'Unknown Client'}</h3>
                      <div className="text-sm text-gray-600">{inv.client?.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-gray-900 text-lg">{formatCurrency(inv.total_amount)}</div>
                      {inv.amount_paid > 0 && inv.amount_paid < inv.total_amount && (
                        <div className="text-xs text-amber-600 font-medium">Paid: {formatCurrency(inv.amount_paid)}</div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Footer (Due Date & Actions) */}
                  <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                      <Calendar size={12} />
                      <span>Due: {inv.due_date ? formatDate(inv.due_date) : 'N/A'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => handleWhatsAppShare(inv)} className="p-2 bg-green-50 text-green-600 rounded-lg">
                        <MessageCircle size={16} />
                      </button>
                      <button onClick={() => handleDownloadPDF(inv)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Download size={16} />
                      </button>
                      <button onClick={() => { setSelectedInvoice(inv); setShowViewModal(true); }} className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleEdit(inv)} className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg">
                        <Edit size={16} />
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
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                        <p className="font-medium text-gray-900">{inv.client?.company || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">{inv.client?.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</p>
                        {inv.amount_paid > 0 && inv.amount_paid < inv.total_amount && (
                          <p className="text-xs text-amber-600">Paid: {formatCurrency(inv.amount_paid)}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs rounded-full border ${getStatusColor(inv.payment_status)}`}>
                          {inv.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setSelectedInvoice(inv); setShowViewModal(true); }} className="p-2 hover:bg-gray-100 rounded-lg" title="View">
                            <Eye size={18} className="text-gray-500" />
                          </button>
                          <button onClick={() => handleWhatsAppShare(inv)} className="p-2 hover:bg-green-50 rounded-lg" title="Share on WhatsApp">
                            <MessageCircle size={18} className="text-green-500" />
                          </button>
                          <button onClick={() => handleDownloadPDF(inv)} className="p-2 hover:bg-indigo-50 rounded-lg" title="Download PDF">
                            <Download size={18} className="text-indigo-500" />
                          </button>
                          <button onClick={() => handleEdit(inv)} className="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                            <Edit size={18} className="text-gray-500" />
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
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Edit Invoice' : 'New Invoice'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Client *</label>
                    <select
                      required
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value, jobId: '' })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                    >
                      <option value="">Select Client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.company} ({c.name})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Job ID</label>
                    <select
                      value={formData.jobId}
                      onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                      disabled={!formData.clientId}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">Select Job (Optional)</option>
                      {jobs
                        .filter(j => j.client_id === formData.clientId && (j.job_number.startsWith('AAY-')))
                        .map(j => (
                          <option key={j.id} value={j.id}>{j.job_number} - {j.project_name}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full max-w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Items</label>
                    <button type="button" onClick={addItem} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">+ Add Item</button>
                  </div>
                  <div className="space-y-4">
                    {formData.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
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
                            step="0.01"
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
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
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tax Amount</label>
                      <div className="font-bold text-gray-700">{formatCurrency(formData.totalTax)}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Grand Total</label>
                      <div className="font-bold text-indigo-700 text-lg">{formatCurrency(formData.totalAmount)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Paid Amount (₹)</label>
                      <input
                        type="number"
                        value={formData.paidAmount}
                        onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </div>
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
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedInvoice.invoice_number}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                    {selectedInvoice.payment_status === 'overdue' && (
                      <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">OVERDUE</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Client Info */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User size={24} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedInvoice.client?.company}</h3>
                    <p className="text-sm text-gray-600">{selectedInvoice.client?.name}</p>
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
                <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100 space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>GST</span>
                    <span>{formatCurrency(selectedInvoice.total_tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-indigo-100">
                    <span>Total Amount</span>
                    <span className="text-lg">{formatCurrency(selectedInvoice.total_amount)}</span>
                  </div>
                  {selectedInvoice.amount_paid > 0 && (
                    <>
                      <div className="flex justify-between text-green-600 font-medium">
                        <span>Paid</span>
                        <span>- {formatCurrency(selectedInvoice.amount_paid)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-700 pt-3 border-t border-indigo-100">
                        <span>Balance Due</span>
                        <span>{formatCurrency(selectedInvoice.total_amount - selectedInvoice.amount_paid)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Due Date & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-xl">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Due Date</p>
                    <p className="font-medium text-gray-900 mt-1">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : '-'}</p>
                  </div>
                  <div className="p-3 border rounded-xl">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Status</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold uppercase rounded-full ${getStatusColor(selectedInvoice.payment_status).replace('border', '')}`}>
                      {selectedInvoice.payment_status}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handlePrintPDF(selectedInvoice)}
                    disabled={pdfLoading}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                    Print
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(selectedInvoice)}
                    disabled={pdfLoading}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    Download PDF
                  </button>
                  <button
                    onClick={() => handleWhatsAppShare(selectedInvoice)}
                    className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle size={18} />
                    Share on WhatsApp
                  </button>
                </div>

                {/* Payment Reminder Button - Only show if balance due */}
                {selectedInvoice.amount_paid < selectedInvoice.total_amount && (
                  <button
                    onClick={() => handlePaymentReminder(selectedInvoice)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
                  >
                    <MessageCircle size={18} />
                    Send Payment Reminder
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
