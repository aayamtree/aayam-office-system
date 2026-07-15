'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
  Calendar, User, Download, MessageCircle, Printer, Loader2, CheckCircle, Send
} from 'lucide-react';
import type { InvoiceData } from '@/components/invoice/InvoicePDF';
// Lazy PDF: @react-pdf/renderer (~500KB) loads only when a PDF is actually generated
const downloadInvoicePDF = async (d: InvoiceData) =>
  (await import('@/components/invoice/InvoicePDF')).downloadInvoicePDF(d);
const printInvoicePDF = async (d: InvoiceData) =>
  (await import('@/components/invoice/InvoicePDF')).printInvoicePDF(d);
const downloadReceiptPDF = async (d: any) =>
  (await import('@/components/finance/ReceiptPDF')).downloadReceiptPDF(await d);
const printReceiptPDF = async (d: any) =>
  (await import('@/components/finance/ReceiptPDF')).printReceiptPDF(await d);
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { shareOnWhatsApp, getInvoiceMessage, getPaymentReminderMessage } from '@/lib/whatsapp';
import { useInvoices, useClients, useJobs, useBankAccounts, useCashAccounts, useQuotations } from '@/lib/hooks';
import ClientQuickAddModal from '@/components/shared/ClientQuickAddModal';
import ItemAutocomplete, { CatalogItem } from '@/components/items/ItemAutocomplete';
import { Invoice, Client, InvoiceItem } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { logActivity } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export default function InvoicesPage() {
  const { settings: companySettings } = useCompanySettings();
  const { invoices, loading: invoicesLoading, createInvoice, updateInvoice, saveInvoiceItems, refetch: refetchInvoices } = useInvoices();
  const { clients, refetch: refetchClients } = useClients();
  const { bankAccounts } = useBankAccounts();
  const { cashAccounts } = useCashAccounts();
  const { quotations } = useQuotations();
  const [showClientModal, setShowClientModal] = useState(false);

  // ── Create from Quote (pick which quoted items the client actually ordered) ──
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [pickedQuote, setPickedQuote] = useState<any>(null);
  const [quoteItemSel, setQuoteItemSel] = useState<{ checked: boolean; quantity: number }[]>([]);

  const openQuotePicker = () => { setPickedQuote(null); setQuoteItemSel([]); setShowQuotePicker(true); };
  const selectQuote = (q: any) => {
    setPickedQuote(q);
    setQuoteItemSel((q.items || []).map((it: any) => ({ checked: true, quantity: Number(it.quantity) || 1 })));
  };

  const createInvoiceFromQuote = () => {
    if (!pickedQuote) return;
    const srcItems = pickedQuote.items || [];
    const chosen = srcItems
      .map((it: any, idx: number) => ({ it, sel: quoteItemSel[idx] }))
      .filter((x: any) => x.sel?.checked)
      .map((x: any) => {
        const qty = Number(x.sel.quantity) || 0;
        const rate = Number(x.it.rate) || 0;
        const gst_rate = Number(x.it.gst_rate) || 18;
        return { description: x.it.description || '', item_specs: x.it.item_specs || '', item_notes: x.it.item_notes || '', hsn_code: '4911', quantity: qty, rate, amount: qty * rate, gst_rate };
      });
    if (chosen.length === 0) { toast.error('Tick at least one item to invoice'); return; }

    const subtotal = chosen.reduce((s: number, i: any) => s + i.amount, 0);
    const totalTax = chosen.reduce((s: number, i: any) => s + Math.round(i.amount * (i.gst_rate / 100)), 0);
    const isGujarat = (pickedQuote.client?.state || '').toLowerCase() === 'gujarat';

    setFormData({
      clientId: pickedQuote.client_id || '',
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: chosen as any,
      subtotal,
      gstRate: chosen[0]?.gst_rate || 18,
      supplyType: (isGujarat ? 'intra_state' : 'inter_state') as 'inter_state' | 'intra_state',
      totalTax,
      totalAmount: subtotal + totalTax,
      paidAmount: 0,
      status: 'pending',
      notes: `From Quote ${pickedQuote.quote_number || ''}`.trim(),
      jobId: '',
    });
    setIsEditing(false);
    setShowQuotePicker(false);
    setShowModal(true);
  };
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // ── Record Payment (Zoho-style, posts to ledger via fn_record_invoice_payment) ──
  const [showPayModal, setShowPayModal] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: 0,
    mode: 'bank_transfer',
    date: new Date().toISOString().split('T')[0],
    accountKind: 'bank' as 'bank' | 'cash',
    accountId: '',
    reference: '',
    notes: '',
  });

  const openPaymentModal = (inv: Invoice) => {
    const balance = Math.max(0, (inv.total_amount || 0) - (inv.amount_paid || 0));
    const firstBank = (bankAccounts || []).find((b: any) => b.is_default) || (bankAccounts || [])[0];
    const firstCash = (cashAccounts || [])[0];
    setPayInvoice(inv);
    setPayForm({
      amount: balance,
      mode: 'bank_transfer',
      date: new Date().toISOString().split('T')[0],
      accountKind: firstBank ? 'bank' : 'cash',
      accountId: firstBank ? firstBank.id : (firstCash ? firstCash.id : ''),
      reference: '',
      notes: '',
    });
    setShowViewModal(false);
    setShowPayModal(true);
  };

  // ── Payments list for the open invoice (for receipts) ──
  const [invoicePayments, setInvoicePayments] = useState<any[]>([]);
  const loadInvoicePayments = async (invId: string) => {
    const { data } = await supabase
      .from('payments_received')
      .select('id, payment_number, payment_date, amount, payment_mode, reference_number')
      .eq('invoice_id', invId)
      .order('payment_date', { ascending: false });
    setInvoicePayments(data || []);
  };

  // Async because the receipt module (with the PDF library) is lazy-loaded;
  // downloadReceiptPDF/printReceiptPDF wrappers `await` their argument, so
  // passing this promise directly still works.
  const receiptDataFor = async (payment: any) => {
    const { buildReceiptData } = await import('@/components/finance/ReceiptPDF');
    return buildReceiptData(payment, selectedInvoice, selectedInvoice?.client);
  };

  // Load this invoice's payments whenever the detail drawer opens
  useEffect(() => {
    if (showViewModal && selectedInvoice) {
      loadInvoicePayments(selectedInvoice.id);
    } else {
      setInvoicePayments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showViewModal, selectedInvoice]);

  const handleReceiptTelegram = async (payment: any) => {
    if (!selectedInvoice) return;
    try {
      const res = await fetch('/api/telegram/send-receipt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedInvoice.client_id,
          receiptNumber: payment.payment_number,
          amount: payment.amount,
          date: payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN') : '',
          invoiceNumber: selectedInvoice.invoice_number,
          mode: (payment.payment_mode || '').replace('_', ' '),
          reference: payment.reference_number,
          balance: Math.max(0, (selectedInvoice.total_amount || 0) - (selectedInvoice.amount_paid || 0)),
        }),
      });
      const j = await res.json();
      if (j.sent) toast.success('Receipt sent on Telegram.');
      else if (j.reason === 'not_linked') toast.error('This client has not linked Telegram yet.');
      else toast.error('Could not send: ' + (j.error || 'unknown error'));
    } catch (err: any) {
      toast.error('Could not send receipt: ' + (err.message || 'error'));
    }
  };

  const submitPayment = async () => {
    if (!payInvoice) return;
    if (!payForm.amount || payForm.amount <= 0) { toast.error('Enter a payment amount greater than zero'); return; }
    if (!payForm.accountId) { toast.error('Select a deposit account'); return; }
    setPaySubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('fn_record_invoice_payment', {
        p_invoice_id: payInvoice.id,
        p_amount: payForm.amount,
        p_mode: payForm.mode,
        p_date: payForm.date,
        p_bank_account_id: payForm.accountKind === 'bank' ? payForm.accountId : null,
        p_cash_account_id: payForm.accountKind === 'cash' ? payForm.accountId : null,
        p_reference: payForm.reference || null,
        p_notes: payForm.notes || null,
        p_user_id: user?.id || null,
      });
      if (error) throw error;
      toast.success('Payment recorded and posted to the ledger.');
      setShowPayModal(false);
      setPayInvoice(null);
      refetchInvoices();
    } catch (err: any) {
      toast.error('Could not record payment: ' + (err.message || 'unknown error'));
    } finally {
      setPaySubmitting(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    clientId: '',
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    items: [{ description: '', item_specs: '', item_notes: '', hsn_code: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 }] as InvoiceItem[],
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

  // ── Shipping address selection (per invoice) ──
  const [clientShipAddrs, setClientShipAddrs] = useState<any[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>(''); // '' = billing, id, or 'new'
  const [showNewShip, setShowNewShip] = useState(false);
  const [savingInvShip, setSavingInvShip] = useState(false);
  const [newInvShip, setNewInvShip] = useState({ label: '', address: '', city: '', state: '', pincode: '' });
  const blankShip = { label: '', address: '', city: '', state: '', pincode: '', addressId: '' };
  const [shipping, setShipping] = useState({ ...blankShip });

  const applyShipSelection = (id: string, listArg?: any[]) => {
    const list = listArg || clientShipAddrs;
    setSelectedShipId(id);
    setShowNewShip(id === 'new');
    if (id === 'new') return;
    if (!id) { setShipping({ ...blankShip }); return; }
    const a = list.find(x => x.id === id);
    if (a) setShipping({ label: a.label || '', address: a.address || '', city: a.city || '', state: a.state || '', pincode: a.pincode || '', addressId: a.id });
  };

  const loadClientShipping = async (clientId: string, presetSnapshot?: any) => {
    setClientShipAddrs([]); setSelectedShipId(''); setShowNewShip(false);
    setNewInvShip({ label: '', address: '', city: '', state: '', pincode: '' });
    if (!clientId) { setShipping({ ...blankShip }); return; }
    try {
      const res = await fetch(`/api/clients/${clientId}/shipping-addresses`);
      const j = await res.json();
      const saved = j.data || [];
      // Surface the client's own on-file delivery address as a selectable option
      // (billing address is the default "" option and shown inline below).
      const c = clients.find((x: any) => x.id === clientId) as any;
      const synthetic: any[] = [];
      if (c && c.delivery_same_as_billing === false && (c.delivery_address || '').trim()) {
        synthetic.push({
          id: '__delivery',
          label: 'Delivery address (on file)',
          address: c.delivery_address || '',
          city: c.delivery_city || '',
          state: c.delivery_state || '',
          pincode: c.delivery_pincode || '',
        });
      }
      const list = [...synthetic, ...saved];
      setClientShipAddrs(list);
      // Editing an existing invoice with a saved snapshot → restore selection
      if (presetSnapshot && presetSnapshot.address) {
        const match = list.find((x: any) => x.id === presetSnapshot.addressId);
        if (match) { applyShipSelection(match.id, list); }
        else { setSelectedShipId('keep'); setShipping(presetSnapshot); }
        return;
      }
      // Default to billing ("") unless the client has a saved default shipping address.
      const def = saved.find((a: any) => a.is_default);
      if (def) applyShipSelection(def.id, list);
      else { setSelectedShipId(''); setShipping({ ...blankShip }); }
    } catch { /* non-fatal */ }
  };

  const saveNewInvShip = async () => {
    if (!newInvShip.address.trim()) { toast.error('Enter the shipping address'); return; }
    if (!formData.clientId) { toast.error('Select a client first'); return; }
    setSavingInvShip(true);
    try {
      const res = await fetch(`/api/clients/${formData.clientId}/shipping-addresses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newInvShip),
      });
      const j = await res.json();
      if (j.data) {
        const list = [...clientShipAddrs, j.data];
        setClientShipAddrs(list);
        applyShipSelection(j.data.id, list);
        setNewInvShip({ label: '', address: '', city: '', state: '', pincode: '' });
      } else { toast.error(j.error || 'Failed to add address'); }
    } catch { toast.error('Failed to add address'); } finally { setSavingInvShip(false); }
  };

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
      deliverySameAsBilling: !((invoice as any).shipping_address && String((invoice as any).shipping_address).trim()),
      deliveryLabel: (invoice as any).shipping_label || '',
      deliveryAddress: (invoice as any).shipping_address || '',
      deliveryCity: (invoice as any).shipping_city || '',
      deliveryState: (invoice as any).shipping_state || '',
      deliveryPincode: (invoice as any).shipping_pincode || '',
      items: items.map(item => ({
        description: item.description,
        specs: item.item_specs || '',
        notes: item.item_notes || '',
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

  // Link a line item to a job: autofill description, qty and rate from the job.
  const applyJobToItem = (index: number, jobId: string) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      if (!jobId) {
        newItems[index] = { ...newItems[index], job_id: null, job_number: '' } as InvoiceItem;
      } else {
        const job = jobs.find((j: any) => j.id === jobId) as any;
        if (job) {
          const qty = Number(job.quantity) || newItems[index].quantity || 1;
          const rate = Number(job.quote_per_piece) || 0;
          newItems[index] = {
            ...newItems[index],
            job_id: job.id,
            job_number: job.job_number,
            description: job.project_name || newItems[index].description,
            quantity: qty,
            rate,
            amount: qty * rate,
          } as InvoiceItem;
        }
      }
      const sub = newItems.reduce((sum, it) => sum + it.amount, 0);
      const tax = Math.round(sub * (prev.gstRate / 100));
      return { ...prev, items: newItems, subtotal: sub, totalTax: tax, totalAmount: sub + tax };
    });
  };

  // Fill a row from a saved catalog item (Zoho-style dropdown pick):
  // name → item name, description → sub-description line, plus rate/HSN/GST.
  const fillItemFromCatalog = (index: number, cat: CatalogItem) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const existing = newItems[index];
      const rate = Number(cat.rate) || 0;
      newItems[index] = {
        ...existing,
        description: cat.name,
        item_specs: cat.description || '',   // saved item's standard details (size, process...)
        // item_notes untouched — that line is for THIS invoice's particular details
        hsn_code: cat.hsn_code || existing.hsn_code,
        rate,
        gst_rate: Number(cat.gst_rate) || existing.gst_rate,
        amount: (existing.quantity || 1) * rate,
      } as InvoiceItem;
      const sub = newItems.reduce((sum, it) => sum + it.amount, 0);
      const tax = Math.round(sub * (prev.gstRate / 100));
      return { ...prev, items: newItems, subtotal: sub, totalTax: tax, totalAmount: sub + tax };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', item_specs: '', item_notes: '', hsn_code: '', quantity: 1, rate: 0, amount: 0, gst_rate: prev.gstRate, job_id: null } as InvoiceItem]
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
      items: [{ description: '', item_specs: '', item_notes: '', hsn_code: '', quantity: 1, rate: 0, amount: 0, gst_rate: 18 } as InvoiceItem],
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
    setClientShipAddrs([]); setSelectedShipId(''); setShowNewShip(false);
    setShipping({ ...blankShip });
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
      supplyType: ((inv.cgst_amount || 0) > 0 ? 'intra_state' : 'inter_state') as 'inter_state' | 'intra_state',
      totalTax: inv.total_tax,
      totalAmount: inv.total_amount,
      paidAmount: inv.amount_paid,
      status: inv.payment_status,
      notes: inv.notes || '',
      jobId: inv.job_id || '',
    });
    // Restore the shipping snapshot saved on this invoice
    loadClientShipping(inv.client_id || '', {
      label: (inv as any).shipping_label || '',
      address: (inv as any).shipping_address || '',
      city: (inv as any).shipping_city || '',
      state: (inv as any).shipping_state || '',
      pincode: (inv as any).shipping_pincode || '',
      addressId: (inv as any).shipping_address_id || '',
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
        // Keep invoices.job_id pointing at the first job-linked line (backward compat
        // with profitability/tracking). Full per-line linkage lives on invoice_items.job_id.
        job_id: (formData.items.find(it => (it as any).job_id)?.job_id) || undefined,
        // Frozen shipping snapshot for this invoice
        shipping_address_id: shipping.addressId || null,
        shipping_label: shipping.label || null,
        shipping_address: shipping.address || null,
        shipping_city: shipping.city || null,
        shipping_state: shipping.state || null,
        shipping_pincode: shipping.pincode || null,
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
    const balance = (inv.total_amount || 0) - (inv.amount_paid || 0);
    // Fully settled
    if (inv.payment_status === 'paid' || balance <= 0) return 'paid';
    // Past due date with a balance still owing → overdue (even if partially paid)
    if (inv.due_date && inv.due_date < today) return 'overdue';
    // Some money received but not all → partial
    if ((inv.amount_paid || 0) > 0) return 'partial';
    return 'pending';
  };

  // Zoho-style status label with day counts (e.g. "Overdue by 5 days", "Due in 3 days")
  const dayDiffFromToday = (dateStr?: string | null): number => {
    if (!dateStr) return 0;
    const due = new Date(dateStr + 'T00:00:00');
    const now = new Date(today + 'T00:00:00');
    return Math.round((due.getTime() - now.getTime()) / 86400000);
  };
  const getStatusLabel = (inv: Invoice): string => {
    const eff = getEffectiveStatus(inv);
    if (eff === 'paid') return 'Paid';
    if (eff === 'overdue') {
      const n = Math.abs(dayDiffFromToday(inv.due_date));
      return `Overdue by ${n} ${n === 1 ? 'day' : 'days'}`;
    }
    if (eff === 'partial') return 'Partially Paid';
    // pending (not yet due)
    if (inv.due_date) {
      const n = dayDiffFromToday(inv.due_date);
      if (n === 0) return 'Due Today';
      if (n === 1) return 'Due Tomorrow';
      if (n > 1) return `Due in ${n} days`;
    }
    return 'Pending';
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

  // Currently selected client (for Ship To billing-address preview)
  const selectedClient = clients.find((c: any) => c.id === formData.clientId) as any;

  // Jobs belonging to the selected client, eligible to be billed as line items
  const clientJobs = jobs.filter((j: any) =>
    j.client_id === formData.clientId && /^(DO|PO|DP|AAY)-/.test(j.job_number || '')
  );

  // BUG-10: Jobs ready for invoicing — only show jobs WITHOUT an existing invoice.
  // A job counts as invoiced if it's the invoice's job_id OR appears as a line item.
  const invoicedJobIds = new Set<string>();
  invoices.forEach(inv => {
    if (inv.job_id) invoicedJobIds.add(inv.job_id);
    (inv.items || []).forEach((it: any) => { if (it.job_id) invoicedJobIds.add(it.job_id); });
  });
  // Jobs already used on OTHER invoices (excludes the invoice currently being edited),
  // so a job can't be invoiced twice across invoices.
  const otherInvoiceJobIds = new Set<string>();
  invoices.forEach(inv => {
    if (isEditing && selectedInvoice && inv.id === selectedInvoice.id) return;
    if (inv.job_id) otherInvoiceJobIds.add(inv.job_id);
    (inv.items || []).forEach((it: any) => { if (it.job_id) otherInvoiceJobIds.add(it.job_id); });
  });

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
      hsn_code: '4911',
      job_id: job.id,
      job_number: job.job_number,
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
        <div className="flex items-center gap-2">
          <button
            onClick={openQuotePicker}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 shadow-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>From Quote</span>
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold"
          >
            <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
            <span>New Invoice</span>
          </button>
        </div>
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
            <p className={`text-lg md:text-page-title ${item.text}`}>{invoices.filter(i => getEffectiveStatus(i) === item.status).length}</p>
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
                          <span className="text-foreground font-bold text-xl">{formatCurrency(Math.max(0, (inv.total_amount || 0) - (inv.amount_paid || 0)))}</span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {inv.amount_paid > 0 && inv.amount_paid < inv.total_amount
                              ? `Total ${formatCurrency(inv.total_amount)} • Paid ${formatCurrency(inv.amount_paid)}`
                              : `Total: ${formatCurrency(inv.total_amount)}`}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-semibold rounded border whitespace-nowrap ${getStatusColor(getEffectiveStatus(inv))}`}>
                          {getStatusLabel(inv)}
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
                    <th className="text-right px-6 py-4 text-label text-gray-500 uppercase">Amount</th>
                    <th className="text-right px-6 py-4 text-label text-gray-500 uppercase">Balance Due</th>
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
                      <td className="px-6 py-4 text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</p>
                        {inv.amount_paid > 0 && inv.amount_paid < inv.total_amount && (
                          <p className="text-xs text-gray-400">Paid: {formatCurrency(inv.amount_paid)}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* Balance Due — Zoho's headline figure (total − amount paid) */}
                        <p className={`font-semibold ${getEffectiveStatus(inv) === 'paid' ? 'text-gray-400' : 'text-gray-900'}`}>
                          {formatCurrency(Math.max(0, (inv.total_amount || 0) - (inv.amount_paid || 0)))}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                      <td className="px-6 py-4">
                        {/* Zoho-style status with day count */}
                        <span className={`px-3 py-1 text-xs rounded-md border whitespace-nowrap ${getStatusColor(getEffectiveStatus(inv))}`}>
                          {getStatusLabel(inv)}
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
                        onChange={(e) => {
                          const cid = e.target.value;
                          const c = clients.find(cl => cl.id === cid);
                          // Auto: Gujarat (home state) => CGST+SGST (intra), any other state => IGST (inter). Still editable below.
                          const st = (c?.state || '').trim().toLowerCase();
                          const supplyType = st ? (st === 'gujarat' ? 'intra_state' : 'inter_state') : formData.supplyType;
                          setFormData({ ...formData, clientId: cid, jobId: '', supplyType });
                          loadClientShipping(cid);
                        }}
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

                  {/* Ship To — pick a saved shipping address or add a new one */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ship To</label>
                    <select
                      value={selectedShipId}
                      onChange={(e) => applyShipSelection(e.target.value)}
                      disabled={!formData.clientId}
                      className="w-full px-2 py-2 md:px-4 md:py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white disabled:bg-gray-100 disabled:text-gray-400 text-sm md:text-base"
                    >
                      <option value="">
                        Billing address{selectedClient && [selectedClient.address, selectedClient.city].filter(Boolean).length ? ` — ${[selectedClient.address, selectedClient.city].filter(Boolean).join(', ')}` : ' (same as billing)'}
                      </option>
                      {selectedShipId === 'keep' && shipping.address && (
                        <option value="keep">{shipping.label ? `${shipping.label} — ` : ''}{[shipping.address, shipping.city].filter(Boolean).join(', ')}</option>
                      )}
                      {clientShipAddrs.map(a => (
                        <option key={a.id} value={a.id}>{a.label ? `${a.label} — ` : ''}{[a.address, a.city, a.state].filter(Boolean).join(', ')}</option>
                      ))}
                      <option value="new">+ Add new shipping address…</option>
                    </select>

                    {/* Selected address preview */}
                    {selectedShipId && selectedShipId !== 'new' && shipping.address && (
                      <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2.5">
                        {shipping.label && <span className="font-semibold text-gray-800">{shipping.label}: </span>}
                        {[shipping.address, shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ')}
                      </div>
                    )}

                    {/* Billing address preview (shown when no separate shipping is chosen) */}
                    {!selectedShipId && selectedClient && (selectedClient.address || selectedClient.city) && (
                      <div className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2.5">
                        <span className="font-semibold text-gray-800">Billing: </span>
                        {[selectedClient.address, selectedClient.city, selectedClient.state, selectedClient.pincode].filter(Boolean).join(', ')}
                      </div>
                    )}

                    {/* Inline add-new shipping address */}
                    {showNewShip && (
                      <div className="mt-2 space-y-2 bg-gray-50 border border-gray-200 rounded-md p-3">
                        <input type="text" value={newInvShip.label} onChange={(e) => setNewInvShip({ ...newInvShip, label: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="Label (e.g. Warehouse, Factory)" />
                        <textarea value={newInvShip.address} onChange={(e) => setNewInvShip({ ...newInvShip, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" rows={2} placeholder="Shipping address" />
                        <div className="grid grid-cols-3 gap-2">
                          <input type="text" value={newInvShip.city} onChange={(e) => setNewInvShip({ ...newInvShip, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="City" />
                          <input type="text" value={newInvShip.state} onChange={(e) => setNewInvShip({ ...newInvShip, state: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="State" />
                          <input type="text" value={newInvShip.pincode} onChange={(e) => setNewInvShip({ ...newInvShip, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" maxLength={6} placeholder="Pincode" />
                        </div>
                        <button type="button" onClick={saveNewInvShip} disabled={savingInvShip || !newInvShip.address.trim()} className="w-full px-3 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" /> {savingInvShip ? 'Saving…' : 'Save & use this address'}
                        </button>
                      </div>
                    )}
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
                        {/* Row 0: Optional — pull this line from a Job */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">From Job</span>
                          <select
                            value={item.job_id || ''}
                            onChange={(e) => applyJobToItem(index, e.target.value)}
                            disabled={!formData.clientId}
                            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-md text-xs bg-white disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <option value="">— none (manual line) —</option>
                            {clientJobs
                              .filter((j: any) => j.id === item.job_id || (
                                !formData.items.some((it, i) => i !== index && (it as any).job_id === j.id) &&
                                !otherInvoiceJobIds.has(j.id)
                              ))
                              .map((j: any) => (
                                <option key={j.id} value={j.id}>{j.job_number} — {j.project_name}</option>
                              ))}
                          </select>
                        </div>
                        {/* Row 1: Description + HSN + Qty + Rate + Amount */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 sm:col-span-4">
                            <ItemAutocomplete
                              placeholder="Item name * (type to search saved items)"
                              value={item.description}
                              onChange={(text) => updateItem(index, 'description', text)}
                              onSelect={(cat) => fillItemFromCatalog(index, cat)}
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
                        {/* Row 2: saved item details (auto-filled from catalog, editable) */}
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-[72px] text-right">Item Details</span>
                          <input
                            type="text"
                            placeholder="From saved item — size, process... (prints under item name)"
                            value={item.item_specs || ''}
                            onChange={(e) => updateItem(index, 'item_specs', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-600 bg-white"
                          />
                        </div>
                        {/* Row 3: particular details for THIS invoice */}
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-[72px] text-right">This Job</span>
                          <input
                            type="text"
                            placeholder='Particular details — e.g. "Medhini Royal 500 ml label", design, matter...'
                            value={item.item_notes || ''}
                            onChange={(e) => updateItem(index, 'item_notes', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 bg-white"
                          />
                        </div>
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
          <div className="fixed inset-0 bg-black/50 flex justify-end z-50 backdrop-blur-sm" onClick={() => setShowViewModal(false)}>
            <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <h2 className="text-page-title text-gray-900">{selectedInvoice.invoice_number}</h2>
                  <span className={`px-2.5 py-1 text-xs rounded-md border whitespace-nowrap ${getStatusColor(getEffectiveStatus(selectedInvoice))}`}>
                    {getStatusLabel(selectedInvoice)}
                  </span>
                </div>
                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Toolbar (Zoho-style) */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 overflow-x-auto">
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedInvoice); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md whitespace-nowrap"><Edit className="w-4 h-4" /> Edit</button>
                {getEffectiveStatus(selectedInvoice) !== 'paid' && (
                  <button onClick={() => openPaymentModal(selectedInvoice)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-md whitespace-nowrap"><CheckCircle className="w-4 h-4" /> Record Payment</button>
                )}
                <button onClick={() => handleDownloadPDF(selectedInvoice)} disabled={pdfLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md whitespace-nowrap disabled:opacity-50"><Download className="w-4 h-4" /> PDF</button>
                <button onClick={() => handlePrintPDF(selectedInvoice)} disabled={pdfLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md whitespace-nowrap disabled:opacity-50"><Printer className="w-4 h-4" /> Print</button>
                <button onClick={() => handleWhatsAppShare(selectedInvoice)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md whitespace-nowrap"><MessageCircle className="w-4 h-4" /> Share</button>
              </div>

              <div className="p-4 space-y-6">
                {/* Client Info */}
                <div className="p-4 bg-gray-50 rounded-md border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Bill To</p>
                      <h3 className="font-bold text-gray-900 leading-tight">{selectedInvoice.client?.company || selectedInvoice.client?.name}</h3>
                      {selectedInvoice.client?.company && <p className="text-sm text-gray-600">{selectedInvoice.client?.name}</p>}
                    </div>
                  </div>
                  {selectedInvoice.client?.address && <p className="text-sm text-gray-500">{selectedInvoice.client?.address}{selectedInvoice.client?.city ? `, ${selectedInvoice.client.city}` : ''}{selectedInvoice.client?.state ? `, ${selectedInvoice.client.state}` : ''}</p>}
                  {selectedInvoice.client?.gstin && <p className="text-xs text-gray-500 mt-1">GSTIN: {selectedInvoice.client?.gstin}</p>}
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
                <div className="bg-gray-50 rounded-md p-5 border border-gray-100 space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {(selectedInvoice.igst_amount || 0) > 0 ? (
                    <div className="flex justify-between text-gray-600">
                      <span>IGST</span>
                      <span>{formatCurrency(selectedInvoice.igst_amount || 0)}</span>
                    </div>
                  ) : ((selectedInvoice.cgst_amount || 0) > 0 || (selectedInvoice.sgst_amount || 0) > 0) ? (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>CGST</span>
                        <span>{formatCurrency(selectedInvoice.cgst_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>SGST</span>
                        <span>{formatCurrency(selectedInvoice.sgst_amount || 0)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-gray-600">
                      <span>GST</span>
                      <span>{formatCurrency(selectedInvoice.total_tax)}</span>
                    </div>
                  )}
                  {(selectedInvoice.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Discount</span>
                      <span>- {formatCurrency(selectedInvoice.discount_amount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-gray-200">
                    <span>Total Amount</span>
                    <span className="text-lg">{formatCurrency(selectedInvoice.total_amount)}</span>
                  </div>
                  {selectedInvoice.amount_paid > 0 && (
                    <div className="flex justify-between text-gray-900 font-medium">
                      <span>Paid</span>
                      <span>- {formatCurrency(selectedInvoice.amount_paid)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-3 border-t border-gray-200">
                    <span className="text-gray-900">Balance Due</span>
                    <span className={`text-lg ${getEffectiveStatus(selectedInvoice) === 'paid' ? 'text-green-700' : 'text-gray-900'}`}>
                      {formatCurrency(Math.max(0, selectedInvoice.total_amount - selectedInvoice.amount_paid))}
                    </span>
                  </div>
                </div>

                {/* Due Date & Status */}
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <div className="p-3 border rounded-md">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Due Date</p>
                    <p className="font-medium text-gray-900 mt-1">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : '-'}</p>
                  </div>
                  <div className="p-3 border rounded-md">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Status</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-md border ${getStatusColor(getEffectiveStatus(selectedInvoice))}`}>
                      {getStatusLabel(selectedInvoice)}
                    </span>
                  </div>
                </div>

                {/* Payments Received + per-payment receipts */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Payments Received</h4>
                  {invoicePayments.length === 0 ? (
                    <p className="text-sm text-gray-400 p-3 bg-gray-50 border border-gray-100 rounded-md">No payments recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {invoicePayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-100 rounded-md">
                          <div>
                            <p className="text-sm font-semibold text-green-800">{formatCurrency(p.amount)}</p>
                            <p className="text-[11px] text-gray-500">
                              {p.payment_number} • {formatDate(p.payment_date)}{p.payment_mode ? ' • ' + String(p.payment_mode).replace('_', ' ') : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => downloadReceiptPDF(receiptDataFor(p))} title="Download receipt" className="p-1.5 hover:bg-white rounded-md text-gray-600"><Download className="w-4 h-4" /></button>
                            <button onClick={() => printReceiptPDF(receiptDataFor(p))} title="Print receipt" className="p-1.5 hover:bg-white rounded-md text-gray-600"><Printer className="w-4 h-4" /></button>
                            <button onClick={() => handleReceiptTelegram(p)} title="Send receipt on Telegram" className="p-1.5 hover:bg-white rounded-md text-sky-600"><Send className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
      {/* Create from Quote picker */}
      {showQuotePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm" onClick={() => setShowQuotePicker(false)}>
          <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="text-page-title text-gray-900">{pickedQuote ? 'Choose items to invoice' : 'Create Invoice from Quote'}</h2>
                <p className="text-sm text-gray-500">{pickedQuote ? `${pickedQuote.quote_number} • ${pickedQuote.client?.company || pickedQuote.client?.name || ''}` : 'Pick a quotation, then tick the items the client actually ordered'}</p>
              </div>
              <button onClick={() => setShowQuotePicker(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>

            {!pickedQuote ? (
              <div className="p-4 space-y-2">
                {(quotations || []).length === 0 ? (
                  <p className="text-sm text-gray-400 p-4 text-center">No quotations found.</p>
                ) : (quotations || []).map((q: any) => (
                  <button key={q.id} onClick={() => selectQuote(q)} className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 text-left">
                    <div>
                      <p className="font-semibold text-gray-900">{q.quote_number}</p>
                      <p className="text-xs text-gray-500">{q.client?.company || q.client?.name || '—'} • {(q.items || []).length} item(s)</p>
                    </div>
                    <span className="font-semibold text-gray-900">{formatCurrency(q.total_amount || 0)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {(pickedQuote.items || []).map((it: any, idx: number) => (
                  <div key={it.id || idx} className="flex items-center gap-3 p-3 border border-gray-200 rounded-md">
                    <input type="checkbox" checked={quoteItemSel[idx]?.checked ?? false}
                      onChange={(e) => setQuoteItemSel(prev => prev.map((s, i) => i === idx ? { ...s, checked: e.target.checked } : s))}
                      className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{it.description}</p>
                      <p className="text-xs text-gray-500">Rate {formatCurrency(it.rate || 0)} • GST {it.gst_rate || 18}%</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">Qty</span>
                      <input type="number" value={quoteItemSel[idx]?.quantity ?? ''}
                        onChange={(e) => setQuoteItemSel(prev => prev.map((s, i) => i === idx ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s))}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-md text-sm" />
                    </div>
                  </div>
                ))}
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <button onClick={() => setPickedQuote(null)} className="px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-50">Back</button>
                  <button onClick={createInvoiceFromQuote} className="flex-1 px-4 py-2.5 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800">Create Invoice from selected</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Payment Modal (posts to ledger) */}
      {showPayModal && payInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-md w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="text-page-title text-gray-900">Record Payment</h2>
                <p className="text-sm text-gray-500">{payInvoice.invoice_number} • Balance {formatCurrency(Math.max(0, (payInvoice.total_amount || 0) - (payInvoice.amount_paid || 0)))}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Amount Received</label>
                <input type="number" value={payForm.amount || ''} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Payment Date</label>
                  <input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Mode</label>
                  <select value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Deposit To</label>
                <div className="flex gap-2 mt-1 mb-2">
                  <button type="button" onClick={() => { const f = (bankAccounts || [])[0]; setPayForm({ ...payForm, accountKind: 'bank', accountId: f ? f.id : '' }); }}
                    className={`flex-1 py-1.5 text-sm rounded-md border ${payForm.accountKind === 'bank' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>Bank</button>
                  <button type="button" onClick={() => { const f = (cashAccounts || [])[0]; setPayForm({ ...payForm, accountKind: 'cash', accountId: f ? f.id : '' }); }}
                    className={`flex-1 py-1.5 text-sm rounded-md border ${payForm.accountKind === 'cash' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>Cash</button>
                </div>
                <select value={payForm.accountId} onChange={(e) => setPayForm({ ...payForm, accountId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400">
                  <option value="">Select account…</option>
                  {(payForm.accountKind === 'bank' ? bankAccounts : cashAccounts || []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Reference (optional)</label>
                <input type="text" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="UTR / cheque no."
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={submitPayment} disabled={paySubmitting}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white font-semibold rounded-md hover:bg-gray-800 disabled:opacity-50">
                  {paySubmitting ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
