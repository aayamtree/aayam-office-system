'use client';

import useSWR from 'swr';
import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  Client, Vendor, Designer, Job, Invoice, Lead,
  Quotation, Dispatch, BankAccount, DesignTask, DesignProject,
  PurchaseBill, VendorPayment, PaymentReceived, POSCategory, POSProduct,
  PaperStock, POSSale, Note, Reminder, BankTransaction
} from '@/types/database';

// Generic hook for fetching data
export interface UseSupabaseQueryOptions {
  select?: string;
  filter?: { column: string; value: any }[];
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
}

export function useSupabaseQuery<T>(
  tableName: string,
  options?: UseSupabaseQueryOptions
) {
  const stableFilter = JSON.stringify(options?.filter);
  const stableOrderBy = JSON.stringify(options?.orderBy);
  const stableOptions = JSON.stringify(options);

  // Key for SWR cache
  const key = isSupabaseConfigured() ? [tableName, stableFilter, stableOrderBy, options?.select, options?.limit] : null;

  const fetcher = async () => {
    let query = supabase
      .from(tableName)
      .select(options?.select || '*');

    // Apply filters
    if (options?.filter) {
      options.filter.forEach(f => {
        query = query.eq(f.column, f.value);
      });
    }

    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? false
      });
    }

    // Apply limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: result, error: queryError } = await query;

    if (queryError) throw queryError;
    return (result as unknown as T[]) || [];
  };

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false, // Don't refetch on window focus (save bandwidth)
    dedupingInterval: 5000,   // Share requests within 5 secs
    keepPreviousData: true,   // Show previous data while fetching new data
  });

  return {
    data: data || [],
    loading: isLoading,
    error: error ? (error.message || 'An error occurred') : null,
    refetch: mutate
  };
}

// =============================================
// CLIENTS HOOK
// =============================================
export function useClients() {
  const { data, loading, error, refetch } = useSupabaseQuery<Client>('clients', {
    orderBy: { column: 'created_at', ascending: false }
  });

  const createClient = async (client: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'outstanding_balance'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const payload = { ...client } as any;
    delete payload.outstanding_balance;
    delete payload.client_type;
    delete payload.credit_limit;

    const { data, error } = await supabase
      .from('clients')
      .insert([payload])
      .select()
      .single();

    if (!error) await refetch();
    return { data, error: error?.message };
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) await refetch();
    return { data, error: error?.message };
  };

  const deleteClient = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (!error) await refetch();
    return { error: error?.message };
  };

  return {
    clients: data,
    loading,
    error,
    refetch,
    createClient,
    updateClient,
    deleteClient
  };
}

// =============================================
// VENDORS HOOK
// =============================================
export function useVendors() {
  const { data, loading, error, refetch } = useSupabaseQuery<Vendor>('vendors', {
    orderBy: { column: 'created_at', ascending: false }
  });

  const createVendor = async (vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at' | 'outstanding_balance'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const payload = { ...vendor } as any;
    delete payload.outstanding_balance;
    delete payload.payment_terms;

    const { data, error } = await supabase
      .from('vendors')
      .insert([payload])
      .select()
      .single();

    if (!error) await refetch();
    return { data, error: error?.message };
  };

  const updateVendor = async (id: string, updates: Partial<Vendor>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const payload = { ...updates } as any;
    delete payload.outstanding_balance;
    delete payload.payment_terms;

    const { data, error } = await supabase
      .from('vendors')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (!error) await refetch();
    return { data, error: error?.message };
  };

  const deleteVendor = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);

    if (!error) await refetch();
    return { error: error?.message };
  };

  return {
    vendors: data,
    loading,
    error,
    refetch,
    createVendor,
    updateVendor,
    deleteVendor
  };
}

// =============================================
// DESIGNERS HOOK
// =============================================
// =============================================
// DESIGNERS HOOK (Linked to Profiles)
// =============================================
export function useDesigners() {
  const { data: designers, loading, error, refetch } = useSupabaseQuery<any>('designers', {
    orderBy: { column: 'name', ascending: true }
  });

  return {
    designers: designers || [],
    loading,
    error,
    refetch
  };
}

// =============================================
// JOBS HOOK
// =============================================
export function useJobs(options?: UseSupabaseQueryOptions) {
  const { data, loading, error, refetch } = useSupabaseQuery<Job>('jobs', {
    select: '*', // Removed all joins (client, vendor) to fix "Infinite Loading" if FKs logic is missing in DB
    orderBy: { column: 'created_at', ascending: false },
    ...options
  });

  const createJob = async (job: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'job_number' | 'client' | 'vendor' | 'designer'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Get next job number
    // Fallback: AAY-YY-XXXX (Random 4 digit)
    let jobNumber = `AAY-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'job' });
      if (numberData) jobNumber = numberData;
    } catch (e) {
      console.warn('RPC get_next_number failed, using fallback');
    }

    const newJob = { ...job, job_number: jobNumber };

    const { data, error } = await supabase
      .from('jobs')
      .insert([newJob])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateJob = async (id: string, updates: Partial<Job>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateJobStage = async (id: string, newStage: Job['current_stage'], notes?: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Get current job
    const { data: job } = await supabase
      .from('jobs')
      .select('current_stage')
      .eq('id', id)
      .single();

    // Update job stage
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ current_stage: newStage })
      .eq('id', id);

    if (updateError) return { error: updateError.message };

    // Log stage change
    await supabase.from('job_stage_history').insert([{
      job_id: id,
      from_stage: job?.current_stage,
      to_stage: newStage,
      notes
    }]);

    refetch();
    return { error: null };
  };

  const deleteJob = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id);

    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    jobs: data,
    loading,
    error,
    refetch,
    createJob,
    updateJob,
    updateJobStage,
    deleteJob
  };
}

// =============================================
// INVOICES HOOK
// =============================================
export function useInvoices() {
  const { data, loading, error, refetch } = useSupabaseQuery<Invoice>('invoices', {
    select: '*, client:clients(*), job:jobs(*), items:invoice_items(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createInvoice = async (invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'invoice_number' | 'client' | 'job' | 'items'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'invoice' });

    const { data, error } = await supabase
      .from('invoices')
      .insert([{ ...invoice, invoice_number: numberData || `INV-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const saveInvoiceItems = async (invoiceId: string, items: any[]) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Delete existing items
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

    if (items.length > 0) {
      // Insert new items
      const { error } = await supabase
        .from('invoice_items')
        .insert(items.map(item => ({
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          hsn_code: item.hsn_code,
          gst_rate: item.gst_rate
        })));

      if (error) return { error: error.message };
    }

    refetch();
    return { error: null };
  };

  return {
    invoices: data,
    loading,
    error,
    refetch,
    createInvoice,
    updateInvoice,
    saveInvoiceItems
  };
}

// =============================================
// LEADS HOOK
// =============================================
export function useLeads() {
  const { data, loading, error, refetch } = useSupabaseQuery<Lead>('leads', {
    select: '*, assigned_user:profiles(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createLead = async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'lead_number' | 'assigned_user' | 'follow_ups'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'lead' });

    const { data, error } = await supabase
      .from('leads')
      .insert([{ ...lead, lead_number: numberData || `LD-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const convertToClient = async (leadId: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Get lead data
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (!lead) return { error: 'Lead not found' };

    // Create client from lead
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert([{
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
        is_active: true,
        outstanding_balance: 0
      }])
      .select()
      .single();

    if (clientError) return { error: clientError.message };

    // Update lead status
    await supabase
      .from('leads')
      .update({
        status: 'won',
        converted_to_client_id: client.id
      })
      .eq('id', leadId);

    refetch();
    return { data: client, error: null };
  };

  const deleteLead = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    leads: data,
    loading,
    error,
    refetch,
    createLead,
    updateLead,
    convertToClient,
    deleteLead
  };
}

// =============================================
// BANK ACCOUNTS HOOK
// =============================================
export function useBankAccounts() {
  const { data, loading, error, refetch } = useSupabaseQuery<BankAccount>('bank_accounts', {
    orderBy: { column: 'is_default', ascending: false }
  });

  const createBankAccount = async (account: Omit<BankAccount, 'id' | 'created_at' | 'updated_at' | 'current_balance'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert([{ ...account, current_balance: account.opening_balance }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateBankAccount = async (id: string, updates: Partial<BankAccount>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('bank_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const setDefaultAccount = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Remove default from all accounts
    await supabase.from('bank_accounts').update({ is_default: false }).neq('id', '');

    // Set new default
    await supabase.from('bank_accounts').update({ is_default: true }).eq('id', id);

    refetch();
    return { error: null };
  };

  const deleteBankAccount = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id);

    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    bankAccounts: data,
    loading,
    error,
    refetch,
    createBankAccount,
    updateBankAccount,
    setDefaultAccount,
    deleteBankAccount
  };
}

// =============================================
// BANK TRANSACTIONS HOOK
// =============================================
export function useBankTransactions(accountId?: string) {
  const options = accountId
    ? { filter: [{ column: 'bank_account_id', value: accountId }], orderBy: { column: 'transaction_date', ascending: false } }
    : { orderBy: { column: 'transaction_date', ascending: false } };

  const { data, loading, error, refetch } = useSupabaseQuery<BankTransaction>('bank_transactions', options as any);

  const importTransactions = async (transactions: Omit<BankTransaction, 'id' | 'created_at'>[]) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: result, error } = await supabase
      .from('bank_transactions')
      .insert(transactions)
      .select();

    if (!error) refetch();
    return { data: result, error: error?.message };
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase
      .from('bank_transactions')
      .delete()
      .eq('id', id);
    if (!error) refetch();
    return { error: error?.message };
  };

  const updateTransaction = async (id: string, updates: Partial<BankTransaction>) => {
    const { error } = await supabase
      .from('bank_transactions')
      .update(updates)
      .eq('id', id);
    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    transactions: data,
    loading,
    error,
    refetch,
    importTransactions,
    deleteTransaction,
    updateTransaction
  };
}

// =============================================
// DESIGN TASKS HOOK
// =============================================
export function useDesignTasks() {
  const { data, loading, error, refetch } = useSupabaseQuery<DesignTask>('design_tasks', {
    select: '*, client:clients(*), job:jobs(*), designer:designers(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createTask = async (task: Omit<DesignTask, 'id' | 'created_at' | 'updated_at' | 'task_number' | 'client' | 'job' | 'designer' | 'remarks'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'task' });

    const { data, error } = await supabase
      .from('design_tasks')
      .insert([{ ...task, task_number: numberData || `TSK-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateTask = async (id: string, updates: Partial<DesignTask>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('design_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const addRemark = async (taskId: string, userId: string, remark: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('task_remarks')
      .insert([{ task_id: taskId, user_id: userId, remark }]);

    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    tasks: data,
    loading,
    error,
    refetch,
    createTask,
    updateTask,
    addRemark
  };
}

// =============================================
// PURCHASE BILLS HOOK
// =============================================
export function usePurchaseBills() {
  const { data, loading, error, refetch } = useSupabaseQuery<PurchaseBill>('purchase_bills', {
    select: '*, vendor:vendors(*), job:jobs(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createPurchaseBill = async (bill: Omit<PurchaseBill, 'id' | 'created_at' | 'updated_at' | 'bill_number' | 'vendor' | 'job'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'purchase_bill' });

    const { data, error } = await supabase
      .from('purchase_bills')
      .insert([{ ...bill, bill_number: numberData || `PB-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updatePurchaseBill = async (id: string, updates: Partial<PurchaseBill>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('purchase_bills')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  return {
    purchaseBills: data,
    loading,
    error,
    refetch,
    createPurchaseBill,
    updatePurchaseBill
  };
}

// =============================================
// VENDOR PAYMENTS HOOK
// =============================================
export function useVendorPayments() {
  const { data, loading, error, refetch } = useSupabaseQuery<VendorPayment>('vendor_payments', {
    select: '*, vendor:vendors(*), bank_account:bank_accounts(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createVendorPayment = async (payment: Omit<VendorPayment, 'id' | 'created_at' | 'payment_number' | 'vendor' | 'bank_account'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'vendor_payment' });

    const { data, error } = await supabase
      .from('vendor_payments')
      .insert([{ ...payment, payment_number: numberData || `VP-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  return {
    vendorPayments: data,
    loading,
    error,
    refetch,
    createVendorPayment
  };
}

// =============================================
// PAYMENTS RECEIVED HOOK
// =============================================
export function usePaymentsReceived() {
  const { data, loading, error, refetch } = useSupabaseQuery<PaymentReceived>('payments_received', {
    select: '*, client:clients(*), bank_account:bank_accounts(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createPayment = async (payment: Omit<PaymentReceived, 'id' | 'created_at' | 'payment_number' | 'client' | 'bank_account'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'payment' });

    const { data, error } = await supabase
      .from('payments_received')
      .insert([{ ...payment, payment_number: numberData || `PAY-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  return {
    payments: data,
    loading,
    error,
    refetch,
    createPayment
  };
}

// =============================================
// DISPATCHES HOOK
// =============================================
export function useDispatches() {
  const { data, loading, error, refetch } = useSupabaseQuery<Dispatch>('dispatches', {
    select: '*, client:clients(*), job:jobs(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createDispatch = async (dispatch: Omit<Dispatch, 'id' | 'created_at' | 'updated_at' | 'dispatch_number' | 'client' | 'job'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'dispatch' });

    const { data, error } = await supabase
      .from('dispatches')
      .insert([{ ...dispatch, dispatch_number: numberData || `DSP-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateDispatch = async (id: string, updates: Partial<Dispatch>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('dispatches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  return {
    dispatches: data,
    loading,
    error,
    refetch,
    createDispatch,
    updateDispatch
  };
}

// =============================================
// DASHBOARD STATS HOOK
// =============================================
export function useDashboardStats() {
  const [stats, setStats] = useState({
    totalClients: 0,
    activeJobs: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    pendingDispatches: 0,
    leadsThisMonth: 0,
    pipeline: {} as Record<string, number>,
    alerts: {
      overduePayments: 0,
      followUpsDue: 0,
      lowStock: 0,
    },
    salesPerformance: [] as { month: string; value: number; active?: boolean }[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const todayStr = new Date().toISOString().split('T')[0];

        const [
          clients,
          jobs,
          invoices,
          dispatches,
          leadsMonth,
          leadsFollowUp,
          lowStock
        ] = await Promise.all([
          // 1. Total Clients
          supabase.from('clients').select('id', { count: 'exact', head: true }),

          // 2. Active Jobs for Pipeline (fetch stage)
          supabase.from('jobs').select('current_stage').neq('current_stage', 'delivered').neq('current_stage', 'cancelled'),

          // 3. Invoices for Revenue & Payments
          supabase.from('invoices').select('total_amount, payment_status, created_at, balance_due, due_date').gte('created_at', startOfYear),

          // 4. Pending Dispatches
          supabase.from('dispatches').select('id', { count: 'exact', head: true }).in('status', ['pending', 'packed', 'ready']),

          // 5. Leads this month
          supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),

          // 6. Follow-ups Due (today or earlier and not won/lost)
          supabase.from('leads').select('id', { count: 'exact', head: true }).lte('next_follow_up', todayStr).not('status', 'in', '("won","lost")'),

          // 7. Low Stock
          supabase.from('paper_stock').select('quantity, reorder_level'),
        ]);

        // Aggregations
        const totalRevenue = invoices.data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

        // This calculates total pending from ALL fetched invoices (this year). For total outstanding, we might need all time unpaid, but this year is a good proxy.
        const pendingPayments = invoices.data?.filter(inv => inv.payment_status !== 'paid').reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;

        const overduePaymentsCount = invoices.data?.filter(inv => inv.payment_status !== 'paid' && inv.due_date && inv.due_date < todayStr).length || 0;

        // Pipeline
        const pipelineCounts: Record<string, number> = {};
        jobs.data?.forEach(j => {
          const stage = j.current_stage || 'new';
          pipelineCounts[stage] = (pipelineCounts[stage] || 0) + 1;
        });

        // Low Stock
        const lowStockCount = lowStock.data?.filter(item => item.quantity <= (item.reorder_level || 0)).length || 0;

        // Sales Performance (Monthly)
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlySales = new Array(12).fill(0);
        invoices.data?.forEach(inv => {
          const d = new Date(inv.created_at);
          monthlySales[d.getMonth()] += (inv.total_amount || 0);
        });

        const currentMonthIdx = new Date().getMonth();
        const salesPerformance = monthNames.map((m, idx) => ({
          month: m,
          value: monthlySales[idx],
          active: idx === currentMonthIdx
        })).slice(Math.max(0, currentMonthIdx - 5), currentMonthIdx + 1); // Last 6 months

        setStats({
          totalClients: clients.count || 0,
          activeJobs: jobs.data?.length || 0,
          totalRevenue,
          pendingPayments,
          pendingDispatches: dispatches.count || 0,
          leadsThisMonth: leadsMonth.count || 0,
          pipeline: pipelineCounts,
          alerts: {
            overduePayments: overduePaymentsCount,
            followUpsDue: leadsFollowUp.count || 0,
            lowStock: lowStockCount,
          },
          salesPerformance,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading };
}

// =============================================
// QUOTATIONS HOOK
// =============================================
export function useQuotations() {
  const { data, loading, error, refetch } = useSupabaseQuery<Quotation>('quotations', {
    select: '*, client:clients(*), items:quotation_items(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createQuotation = async (quotation: Omit<Quotation, 'id' | 'created_at' | 'updated_at' | 'quote_number' | 'client' | 'items'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'quotation' });

    const { data, error } = await supabase
      .from('quotations')
      .insert([{ ...quotation, quote_number: numberData || `QT-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateQuotation = async (id: string, updates: Partial<Quotation>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('quotations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const saveQuotationItems = async (quotationId: string, items: any[]) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Delete existing items
    await supabase.from('quotation_items').delete().eq('quotation_id', quotationId);

    if (items.length > 0) {
      // Insert new items
      const { error } = await supabase
        .from('quotation_items')
        .insert(items.map(item => ({
          quotation_id: quotationId,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          gst_rate: item.gst_rate
        })));

      if (error) return { error: error.message };
    }

    refetch();
    return { error: null };
  };

  const deleteQuotation = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id);

    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    quotations: data,
    loading,
    error,
    refetch,
    createQuotation,
    updateQuotation,
    saveQuotationItems,
    deleteQuotation
  };
}

// =============================================
// PAPER STOCK HOOK
// =============================================
// =============================================
// PAPER STOCK HOOK
// =============================================
export function usePaperStock() {
  const { data, loading, error, refetch } = useSupabaseQuery<PaperStock>('paper_stock', {
    orderBy: { column: 'name', ascending: true }
  });

  const createStockItem = async (item: Omit<PaperStock, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('paper_stock')
      .insert([item])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateStockItem = async (id: string, updates: Partial<PaperStock>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('paper_stock')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const deleteStockItem = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('paper_stock')
      .delete()
      .eq('id', id);

    if (!error) refetch();
    return { error: error?.message };
  };

  return { stock: data, loading, error, refetch, createStockItem, updateStockItem, deleteStockItem };
}

// =============================================
// POS SALES HOOK
// =============================================
export function usePOSSales() {
  const { data, loading, error, refetch } = useSupabaseQuery<POSSale>('pos_sales', {
    select: '*, items:pos_sale_items(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createPOSSale = async (
    sale: Omit<POSSale, 'id' | 'created_at' | 'updated_at' | 'sale_number' | 'items'>,
    items: Omit<import('@/types/database').POSSaleItem, 'id' | 'sale_id'>[]
  ) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Get next number
    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'pos_sale' });
    const saleNumber = numberData || `POS-${Date.now()}`;

    // 1. Create Sale Record
    const { data: saleData, error: saleError } = await supabase
      .from('pos_sales')
      .insert([{ ...sale, sale_number: saleNumber }])
      .select()
      .single();

    if (saleError) return { error: saleError.message };

    // 2. Create Sale Items
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('pos_sale_items')
        .insert(items.map(item => ({
          ...item,
          sale_id: saleData.id
        })));

      if (itemsError) return { error: itemsError.message };
    }

    refetch();
    return { data: saleData, error: null };
  };

  return { sales: data, loading, error, refetch, createPOSSale };
}

// =============================================
// POS PRODUCTS HOOK
// =============================================
export function usePOSProducts() {
  const { data: categories, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useSupabaseQuery<POSCategory>('pos_categories', {
    orderBy: { column: 'sort_order', ascending: true }
  });

  const { data: products, loading: productsLoading, error: productsError, refetch: refetchProducts } = useSupabaseQuery<POSProduct>('pos_products', {
    select: '*, category:pos_categories(*)',
    orderBy: { column: 'name', ascending: true }
  });

  const createCategory = async (category: Omit<POSCategory, 'id' | 'created_at'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('pos_categories')
      .insert([category])
      .select()
      .single();

    if (!error) refetchCategories();
    return { data, error: error?.message };
  };

  const updateCategory = async (id: string, updates: Partial<POSCategory>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('pos_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetchCategories();
    return { data, error: error?.message };
  };

  const deleteCategory = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('pos_categories')
      .delete()
      .eq('id', id);

    if (!error) refetchCategories();
    return { error: error?.message };
  };

  const createProduct = async (product: Omit<POSProduct, 'id' | 'created_at' | 'category'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('pos_products')
      .insert([product])
      .select()
      .single();

    if (!error) refetchProducts();
    return { data, error: error?.message };
  };

  const updateProduct = async (id: string, updates: Partial<POSProduct>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('pos_products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetchProducts();
    return { data, error: error?.message };
  };

  const deleteProduct = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('pos_products')
      .delete()
      .eq('id', id);

    if (!error) refetchProducts();
    return { error: error?.message };
  };

  return {
    categories,
    products,
    loading: categoriesLoading || productsLoading,
    error: categoriesError || productsError,
    createCategory,
    updateCategory,
    deleteCategory,
    createProduct,
    updateProduct,
    deleteProduct,
    refetch: () => { refetchCategories(); refetchProducts(); }
  };
}

// =============================================
// NOES HOOK (Google Keep Style)
// =============================================
export function useNotes() {
  const { data, loading, error, refetch } = useSupabaseQuery<Note>('notes', {
    orderBy: { column: 'created_at', ascending: false }
  });

  const createNote = async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: user } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('notes')
      .insert([{ ...note, user_id: user.user?.id }])
      .select()
      .single();

    if (!error) await refetch();
    return { data, error: error?.message };
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) await refetch();
    return { data, error: error?.message };
  };

  const deleteNote = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (!error) await refetch();
    return { error: error?.message };
  };

  return {
    notes: data,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote
  };
}

// =============================================
// REMINDERS HOOK
// =============================================
export function useReminders() {
  const { data, loading, error, refetch } = useSupabaseQuery<Reminder>('reminders', {
    orderBy: { column: 'due_date', ascending: true }
  });

  const createReminder = async (reminder: Omit<Reminder, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: user } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('reminders')
      .insert([{ ...reminder, user_id: user.user?.id }])
      .select()
      .single();

    if (!error) await refetch();
    return { data, error: error?.message };
  };

  const updateReminder = async (id: string, updates: Partial<Reminder>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) await refetch();
    return { data, error: error?.message };
  };

  const deleteReminder = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

    if (!error) await refetch();
    return { error: error?.message };
  };

  return {
    reminders: data,
    loading,
    error,
    createReminder,
    updateReminder,
    deleteReminder
  };
}
// =============================================
// EXPENSES HOOK
// =============================================
export function useExpenses() {
  const { data, loading, error, refetch } = useSupabaseQuery<import('@/types/database').Expense>('expenses', {
    select: '*, bank_account:bank_accounts(*)',
    orderBy: { column: 'expense_date', ascending: false }
  });

  const createExpense = async (expense: Omit<import('@/types/database').Expense, 'id' | 'created_at' | 'updated_at' | 'expense_number' | 'bank_account'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'expense' });

    const { data, error } = await supabase
      .from('expenses')
      .insert([{ ...expense, expense_number: numberData || `EXP-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateExpense = async (id: string, updates: Partial<import('@/types/database').Expense>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const deleteExpense = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    expenses: data,
    loading,
    error,
    refetch,
    createExpense,
    updateExpense,
    deleteExpense
  };
}

export { useAuth } from './auth-context';
