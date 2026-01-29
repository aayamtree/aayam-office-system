'use client';

import useSWR from 'swr';
import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { useAuth } from './auth-context';
import {
  Client, Vendor, Designer, Job, Invoice, Lead,
  Quotation, Dispatch, BankAccount, DesignTask, DesignProject,
  PurchaseBill, VendorPayment, PaymentReceived, POSCategory, POSProduct,
  PaperStock, POSSale, Note, Reminder, BankTransaction, SalesOrder, ActivityLog, JobChecklist, UserCalendarEvent, Commission
} from '@/types/database';
import { logActivity } from './logger';

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
    revalidateOnFocus: false, // Don't auto-refetch on window focus (was causing flickering)
    revalidateOnReconnect: false, // Don't refetch on reconnect
    dedupingInterval: 5000,   // Increase to 5s to prevent excessive refetching
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
  const { user, profile } = useAuth();

  // Build filter based on role
  const filter = profile?.role === 'marketing'
    ? [{ column: 'assigned_to', value: user?.id }]  // Marketing sees only their clients
    : undefined;  // Admin sees all

  const { data, loading, error, refetch } = useSupabaseQuery<Client>('clients', {
    filter,
    orderBy: { column: 'created_at', ascending: false }
  });

  const createClient = async (client: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'outstanding_balance'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const payload = {
      ...client,
      assigned_to: user?.id,  // Auto-assign to creator
      created_by: user?.id
    } as any;
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
// SALES ORDERS HOOK
// =============================================
export function useSalesOrders() {
  const { data, loading, error, refetch } = useSupabaseQuery<SalesOrder>('sales_orders', {
    select: '*, client:clients(*)', // Add quotation link when available
    orderBy: { column: 'created_at', ascending: false }
  });

  const createSalesOrder = async (so: Omit<SalesOrder, 'id' | 'created_at' | 'updated_at' | 'so_number' | 'client'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'sales_order' });

    const { data, error } = await supabase
      .from('sales_orders')
      .insert([{ ...so, so_number: numberData || `SO-${Date.now()}` }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateSalesOrder = async (id: string, updates: Partial<SalesOrder>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('sales_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  return { salesOrders: data, loading, error, refetch, createSalesOrder, updateSalesOrder };
}

// =============================================
// JOBS HOOK
// =============================================
export function useJobs(options?: UseSupabaseQueryOptions) {
  const { data, loading, error, refetch } = useSupabaseQuery<Job>('jobs', {
    select: '*, client:clients(*), vendor:vendors(*), invoices(*)',
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
      .select('current_stage, job_number')
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

    // Log activity
    await logActivity(
      'Updated Job Stage',
      'Sales',
      id,
      `Job ${job?.job_number} moved from ${job?.current_stage || 'new'} to ${newStage}${notes ? ': ' + notes : ''}`
    );

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
  const { user, profile } = useAuth();

  // Build filter based on role
  const filter = profile?.role === 'marketing'
    ? [{ column: 'assigned_to', value: user?.id }]  // Marketing sees only their leads
    : undefined;  // Admin sees all

  const { data, loading, error, refetch } = useSupabaseQuery<Lead>('leads', {
    select: '*',
    filter,
    orderBy: { column: 'created_at', ascending: false }
  });

  const createLead = async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'lead_number' | 'assigned_user' | 'follow_ups'> & { created_at?: string }) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'lead' });

    const { data, error } = await supabase
      .from('leads')
      .insert([{
        ...lead,
        lead_number: numberData || `LD-${Date.now()}`,
        assigned_to: lead.assigned_to || user?.id,  // Use passed value or fallback to current user
        created_by: lead.created_by || user?.id     // Use passed value or fallback to current user
      }])
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

  const convertToClient = async (leadId: string, userId: string) => {
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
        outstanding_balance: 0,
        assigned_to: lead.assigned_to || userId,  // Inherit ownership from lead
        created_by: userId // User who converts
      }])
      .select()
      .single();

    if (clientError) return { error: clientError.message };

    // Update lead status
    await supabase
      .from('leads')
      .update({
        status: 'converted',
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
    refresh: refetch,
    createBankAccount,
    updateBankAccount,
    setDefaultAccount,
    deleteBankAccount
  };
}

// =============================================
// CASH ACCOUNTS HOOK
// =============================================
export function useCashAccounts() {
  const { data, loading, error, refetch } = useSupabaseQuery<any>('cash_accounts', {
    orderBy: { column: 'created_at', ascending: false }
  });

  const createCashAccount = async (account: any) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('cash_accounts')
      .insert([account])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateCashAccount = async (id: string, updates: any) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('cash_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  return {
    cashAccounts: data,
    loading,
    error,
    refetch,
    refresh: refetch,
    createCashAccount,
    updateCashAccount
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
    updatePurchaseBill,
    deletePurchaseBill: async (id: string) => {
      if (!isSupabaseConfigured()) return { error: 'Database not configured' };
      const { error } = await supabase.from('purchase_bills').delete().eq('id', id);
      if (!error) refetch();
      return { error: error?.message };
    }
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

    if (!error && data) {
      // Log activity
      await logActivity(
        'Created Dispatch',
        'Dispatch',
        data.id,
        `Created dispatch ${data.dispatch_number} - ${dispatch.packages} package(s)`
      );
      refetch();
    }
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
    pipelineOverdue: {} as Record<string, number>,
    alerts: {
      overduePayments: 0,
      followUpsDue: 0,
      lowStock: 0,
      blockedJobs: 0,
      blockedBreakdown: { feedback: 0, payment: 0 }
    },
    todaysFocus: {
      jobsDue: 0,
      jobsDelayed: 0,
      jobsCompleted: 0,
      paymentsDue: 0
    },
    vendorStats: {
      jobsAtVendor: 0,
      dueToday: 0,
      delayed: 0
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
          lowStock,
          completedJobs,
          followUpsTable
        ] = await Promise.all([
          // 1. Total Clients
          supabase.from('clients').select('id', { count: 'exact', head: true }),

          // 2. Active Jobs for Pipeline (fetch stage, deadline, vendor info)
          supabase.from('jobs').select('id, current_stage, client_deadline, internal_deadline, vendor_id').neq('current_stage', 'delivered').neq('current_stage', 'cancelled'),

          // 3. Invoices for Revenue & Payments
          supabase.from('invoices').select('total_amount, payment_status, created_at, balance_due, due_date, job_id').gte('created_at', startOfYear),

          // 4. Pending Dispatches
          supabase.from('dispatches').select('id', { count: 'exact', head: true }).in('status', ['pending', 'packed', 'ready']),

          // 5. Leads this month
          supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),

          // 6. Follow-ups Due (today or earlier and not won/lost) - NOTE: This only checks leads. Ideally should combine with `follow_ups` table.
          supabase.from('leads').select('id', { count: 'exact', head: true }).lte('next_follow_up', todayStr).not('status', 'in', '("won","lost")'),

          // 7. Low Stock
          supabase.from('paper_stock').select('quantity, reorder_level'),

          // 8. Jobs Completed Today
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('current_stage', 'delivered').gte('updated_at', todayStr),

          // 9. Follow ups table count - get follow-ups due today or earlier
          supabase.from('follow_ups').select('id', { count: 'exact', head: true }).lte('follow_up_date', todayStr),
        ]);

        // Aggregations
        const totalRevenue = invoices.data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

        // Blocked Jobs Logic
        const feedbackPendingCount = jobs.data?.filter(j => j.current_stage === 'approval').length || 0;

        // Payment Hold: Jobs in Ready/Packed/Dispatched/Delivered but unpaid?
        // Let's strictly say "Ready or Packed" (completed production) but not paid.
        // We need to map Job ID to Payment Status.
        const unpaidJobIds = new Set(invoices.data?.filter(inv => inv.payment_status !== 'paid' && inv.job_id).map(inv => inv.job_id));
        const paymentHoldCount = jobs.data?.filter(j => ['ready', 'packed'].includes(j.current_stage || '') && unpaidJobIds.has(j.id)).length || 0;

        const totalBlocked = feedbackPendingCount + paymentHoldCount;

        // This calculates total pending from ALL fetched invoices (this year). For total outstanding, we might need all time unpaid, but this year is a good proxy.
        const pendingPayments = invoices.data?.filter(inv => inv.payment_status !== 'paid').reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;

        const overduePaymentsCount = invoices.data?.filter(inv => inv.payment_status !== 'paid' && inv.due_date && inv.due_date < todayStr).length || 0;
        const paymentsDueTodayCount = invoices.data?.filter(inv => inv.payment_status !== 'paid' && inv.due_date && inv.due_date === todayStr).length || 0;

        // Pipeline & Jobs Focus
        const pipelineCounts: Record<string, number> = {};
        const pipelineOverdue: Record<string, number> = {};
        let jobsDueTodayCount = 0;
        let jobsDelayedCount = 0;

        jobs.data?.forEach(j => {
          const stage = j.current_stage || 'new';
          pipelineCounts[stage] = (pipelineCounts[stage] || 0) + 1;

          // Focus Checks on Active Jobs
          if (j.client_deadline) {
            const deadline = j.client_deadline.split('T')[0];
            if (deadline === todayStr) jobsDueTodayCount++;
            if (deadline < todayStr) {
              jobsDelayedCount++;
              pipelineOverdue[stage] = (pipelineOverdue[stage] || 0) + 1;
            }
          }
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
          pipelineOverdue,
          alerts: {
            overduePayments: overduePaymentsCount,
            followUpsDue: (leadsFollowUp.count || 0) + (followUpsTable.count || 0),
            lowStock: lowStockCount,
            blockedJobs: totalBlocked,
            blockedBreakdown: { feedback: feedbackPendingCount, payment: paymentHoldCount }
          },
          todaysFocus: {
            jobsDue: jobsDueTodayCount,
            jobsDelayed: jobsDelayedCount,
            jobsCompleted: completedJobs.count || 0,
            paymentsDue: paymentsDueTodayCount
          },
          vendorStats: {
            jobsAtVendor: jobs.data?.filter(j => ['printing', 'finishing'].includes(j.current_stage || '')).length || 0,
            dueToday: jobs.data?.filter(j => ['printing', 'finishing'].includes(j.current_stage || '') && j.internal_deadline && j.internal_deadline.split('T')[0] === todayStr).length || 0,
            delayed: jobs.data?.filter(j => ['printing', 'finishing'].includes(j.current_stage || '') && j.internal_deadline && j.internal_deadline.split('T')[0] < todayStr).length || 0
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
  const { user, profile } = useAuth();

  // Build filter based on role
  const filter = profile?.role === 'marketing'
    ? [{ column: 'created_by', value: user?.id }]  // Marketing sees only their quotations
    : undefined;  // Admin sees all

  const { data, loading, error, refetch } = useSupabaseQuery<Quotation>('quotations', {
    select: '*, client:clients(*), lead:leads(*), items:quotation_items(*)',
    filter,
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

    if (!error && data) {
      // Log activity
      await logActivity(
        'Created Quotation',
        'Sales',
        data.id,
        `Created quotation ${data.quote_number} for ₹${quotation.total_amount?.toLocaleString() || 0}`
      );
      refetch();
    }
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
    select: '*, job:jobs(job_number, project_name)',
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



// =============================================
// FOLLOW UPS HOOK (REBUILT - SIMPLE VERSION)
// =============================================
export function useFollowUps() {
  const { user, profile } = useAuth();

  const { data, loading, error, refetch } = useSupabaseQuery<any>('follow_ups', {
    select: '*, lead:leads(name, company, assigned_to), client:clients(name, company), quotation:quotations(id, quote_number, status)',
    orderBy: { column: 'follow_up_date', ascending: true }
  });

  // Simple: just return all data, RLS handles access control
  const followUps = data || [];

  const createFollowUp = async (followUp: any) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const payload = { ...followUp };
    // Sanitize UUIDs
    if (!payload.lead_id) delete payload.lead_id;
    if (!payload.client_id) delete payload.client_id;
    if (payload.lead_id === '') delete payload.lead_id;
    if (payload.client_id === '') delete payload.client_id;

    const { data, error } = await supabase
      .from('follow_ups')
      .insert([payload])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateFollowUp = async (id: string, updates: any) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { data, error } = await supabase
      .from('follow_ups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error) refetch();
    return { data, error: error?.message };
  };

  const deleteFollowUp = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { error } = await supabase.from('follow_ups').delete().eq('id', id);
    if (!error) refetch();
    return { error: error?.message };
  };

  // Link a quotation to a follow-up to prevent duplicates
  const linkQuotationToFollowUp = async (followUpId: string, quotationId: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { error } = await supabase
      .from('follow_ups')
      .update({ quotation_id: quotationId })
      .eq('id', followUpId);

    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    followUps,  // All data (RLS filtered)
    loading,
    error,
    refetch,
    createFollowUp,
    updateFollowUp,
    deleteFollowUp,
    linkQuotationToFollowUp,
  };
}

// =============================================
// DESIGN PROJECTS HOOK
// =============================================
export function useDesignProjects() {
  const { data, loading, error, refetch } = useSupabaseQuery<any>('design_projects', {
    select: '*, client:clients(name, company), tasks:design_tasks(*)',
    orderBy: { column: 'created_at', ascending: false }
  });

  const createProject = async (project: any) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Get project number
    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'design_project' });

    const payload = { ...project, project_number: numberData || `PRJ-${Date.now()}` };
    // Tasks are separate
    const tasks = payload.tasks || [];
    delete payload.tasks;
    // Client Name/etc are derived
    delete payload.clientName;
    delete payload.teamNames;

    const { data: newProject, error } = await supabase
      .from('design_projects')
      .insert([payload])
      .select()
      .single();

    if (error) return { error: error.message };

    // Insert Tasks
    if (tasks.length > 0) {
      const taskPayloads = tasks.map((t: any) => ({
        project_id: newProject.id,
        name: t.name,
        status: t.status || 'pending',
        progress: t.progress || 0
      }));
      await supabase.from('design_tasks').insert(taskPayloads);
    }

    refetch();
    return { data: newProject, error: null };
  };

  const updateProject = async (id: string, updates: any) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Tasks logic... complex for update. For now, we assume tasks are managed separately or we just update project fields.
    const payload = { ...updates };
    delete payload.tasks;
    delete payload.clientName;
    delete payload.teamNames;

    const { data, error } = await supabase
      .from('design_projects')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const deleteProject = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { error } = await supabase.from('design_projects').delete().eq('id', id);
    if (!error) refetch();
    return { error: error?.message };
  };

  return {
    projects: data,
    loading,
    error,
    refetch,
    createProject,
    updateProject,
    deleteProject
  };
}

export { useAuth } from './auth-context';

// =============================================
// PAYMENTS HOOK (Received)
// =============================================
// =============================================
// PAYMENTS RECEIVED HOOK
// =============================================
export function usePaymentsReceived() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) {
      setError('Database not configured');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: result, error: rpcError } = await supabase.rpc('get_all_payments_received');

      if (rpcError) throw rpcError;
      setData(result || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payments');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createPaymentReceived = async (payment: Omit<PaymentReceived, 'id' | 'created_at' | 'updated_at' | 'payment_number' | 'client' | 'bank_account'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: result, error } = await supabase.rpc('record_payment_received', {
      p_client_id: payment.client_id,
      p_amount: payment.amount,
      p_payment_mode: payment.payment_mode,
      p_payment_date: payment.payment_date,
      p_bank_account_id: payment.bank_account_id,
      p_reference: payment.reference_number,
      p_notes: payment.notes,
      p_invoice_id: payment.invoice_id,
      p_attachment_url: payment.attachment_url
    });

    if (!error) await fetchData();
    return { data: result, error: error?.message };
  };

  const deletePaymentReceived = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { error } = await supabase.from('payments_received').delete().eq('id', id);
    if (!error) await fetchData();
    return { error: error?.message };
  };

  return { paymentsReceived: data, loading, error, refetch: fetchData, createPaymentReceived, deletePaymentReceived };
}

// =============================================
// VENDOR PAYMENTS HOOK (Paid)
// =============================================
export function useVendorPayments() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) {
      setError('Database not configured');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: result, error: rpcError } = await supabase.rpc('get_all_vendor_payments');

      if (rpcError) throw rpcError;
      setData(result || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payments');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createVendorPayment = async (payment: Omit<VendorPayment, 'id' | 'created_at' | 'updated_at' | 'payment_number' | 'vendor' | 'bank_account'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: result, error } = await supabase.rpc('record_vendor_payment', {
      p_vendor_id: payment.vendor_id,
      p_amount: payment.amount,
      p_payment_mode: payment.payment_mode,
      p_payment_date: payment.payment_date,
      p_bank_account_id: payment.bank_account_id,
      p_reference: payment.reference_number,
      p_notes: payment.notes,
      p_purchase_bill_id: payment.purchase_bill_id,
      p_attachment_url: payment.attachment_url
    });

    if (!error) await fetchData();
    return { data: result, error: error?.message };
  };

  const deleteVendorPayment = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { error } = await supabase.from('vendor_payments').delete().eq('id', id);
    if (!error) await fetchData();
    return { error: error?.message };
  };

  return { vendorPayments: data, loading, error, refetch: fetchData, createVendorPayment, deleteVendorPayment };
}

// =============================================
// ACTIVITY LOGS HOOK
// =============================================
export function useActivityLogs(limit = 100) {
  const { data, loading, error, refetch } = useSupabaseQuery<ActivityLog>('activity_logs', {
    select: '*, user:profiles(*)',
    orderBy: { column: 'created_at', ascending: false },
    limit
  });

  return { logs: data, loading, error, refetch };
}

// =============================================
// CHECKLISTS HOOK
// =============================================
export function useJobChecklists() {
  const { data, loading, error, refetch } = useSupabaseQuery<JobChecklist>('job_checklists', {
    select: '*',
    orderBy: { column: 'job_type', ascending: true }
  });

  return { checklists: data, loading, error, refetch };
}

// =============================================
// PERSONAL CALENDAR HOOK
// =============================================
export function useCalendarEvents(startDate?: string, endDate?: string) {
  // Build query conditions
  const conditions: any[] = [];

  if (startDate) {
    conditions.push({ column: 'start_date', operator: 'gte', value: startDate });
  }
  if (endDate) {
    conditions.push({ column: 'start_date', operator: 'lte', value: endDate });
  }

  const { data, loading, error, refetch } = useSupabaseQuery<UserCalendarEvent>('user_calendar_events', {
    select: '*',
    filter: conditions.length > 0 ? conditions : undefined,
    orderBy: { column: 'start_date', ascending: true }
  });

  const createEvent = async (event: Partial<UserCalendarEvent>) => {
    // user_id should be provided by the component
    if (!event.user_id) throw new Error('user_id is required');

    const newEvent = {
      ...event,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: created, error: createError } = await supabase
      .from('user_calendar_events')
      .insert([newEvent])
      .select()
      .single();

    if (createError) throw createError;

    // If there are tagged users, create mentions
    if (event.tagged_users && event.tagged_users.length > 0) {
      const mentions = event.tagged_users.map(userId => ({
        event_id: created.id,
        tagged_user_id: userId
      }));

      await supabase.from('calendar_event_mentions').insert(mentions);
    }

    refetch();
    return created;
  };

  const updateEvent = async (id: string, updates: Partial<UserCalendarEvent>) => {
    const { data: updated, error: updateError } = await supabase
      .from('user_calendar_events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update mentions if tagged_users changed
    if (updates.tagged_users !== undefined) {
      // Delete existing mentions
      await supabase.from('calendar_event_mentions').delete().eq('event_id', id);

      // Create new mentions
      if (updates.tagged_users.length > 0) {
        const mentions = updates.tagged_users.map(userId => ({
          event_id: id,
          tagged_user_id: userId
        }));
        await supabase.from('calendar_event_mentions').insert(mentions);
      }
    }

    refetch();
    return updated;
  };

  const deleteEvent = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('user_calendar_events')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    refetch();
  };

  const toggleComplete = async (id: string, completed: boolean) => {
    const updates: Partial<UserCalendarEvent> = {
      status: completed ? 'completed' : 'pending',
      completed_at: completed ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('user_calendar_events')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    refetch();
  };

  return {
    events: data,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleComplete,
    refetch
  };
}

// =============================================
// DAILY WORK REPORTS HOOK (EOD Reports)
// =============================================
export function useDailyReports(userId?: string, dateFilter?: { start?: string; end?: string }) {
  // Build options for main reports
  const options: UseSupabaseQueryOptions = {
    select: '*, task_updates:report_task_updates(*, job:jobs(*, client:clients(*)))',
    orderBy: { column: 'report_date', ascending: false }
  };

  if (userId) {
    options.filter = [{ column: 'user_id', value: userId }];
  }

  const { data, loading, error, refetch } = useSupabaseQuery<any>('daily_work_reports', options);

  // Fetch today's pending tasks for the user
  const fetchMyTodayTasks = async (currentUserId: string) => {
    if (!isSupabaseConfigured()) return { data: [], error: null };

    // Get all jobs assigned to user that are NOT completed/delivered/cancelled
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*, client:clients(*)')
      .eq('designer_id', currentUserId)
      .not('current_stage', 'in', '(completed,delivered,cancelled)')
      .order('client_deadline', { ascending: true });

    return { data: jobs || [], error: error?.message };
  };

  // Submit EOD Report
  const submitEODReport = async (reportData: {
    user_id: string;
    report_date: string;
    overall_notes?: string;
    blockers?: string;
    tomorrow_plan?: string;
    work_hours?: number;
    task_updates: Array<{
      job_id: string;
      status_update: string;
      completion_percentage?: number;
      time_spent?: number;
      checklist?: any;
      client_comments?: string;
      client_approval_received?: boolean;
      approval_file_url?: string;
      print_file_ready?: boolean;
      print_checklist_done?: boolean;
    }>;
  }) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    try {
      // 1. Create or update main report
      const { data: report, error: reportError } = await supabase
        .from('daily_work_reports')
        .upsert([{
          user_id: reportData.user_id,
          report_date: reportData.report_date,
          overall_notes: reportData.overall_notes,
          blockers: reportData.blockers,
          tomorrow_plan: reportData.tomorrow_plan,
          work_hours: reportData.work_hours,
          submitted_at: new Date().toISOString()
        }], { onConflict: 'user_id,report_date' })
        .select()
        .single();

      if (reportError) throw reportError;

      // 2. Delete existing task updates for this report
      await supabase
        .from('report_task_updates')
        .delete()
        .eq('report_id', report.id);

      // 3. Insert new task updates
      if (reportData.task_updates.length > 0) {
        const { error: updatesError } = await supabase
          .from('report_task_updates')
          .insert(reportData.task_updates.map(update => ({
            report_id: report.id,
            ...update
          })));

        if (updatesError) throw updatesError;
      }

      // 4. Log activity
      await logActivity(
        'Submitted EOD Report',
        'System',
        report.id,
        `Daily work report submitted for ${reportData.report_date}`
      );

      refetch();
      return { data: report, error: null };
    } catch (e: any) {
      return { error: e.message || 'Failed to submit report' };
    }
  };

  // Get user's reports within date range
  const getMyReports = async (currentUserId: string, startDate?: string, endDate?: string) => {
    if (!isSupabaseConfigured()) return { data: [], error: null };

    let query = supabase
      .from('daily_work_reports')
      .select('*, task_updates:report_task_updates(*, job:jobs(*, client:clients(*)))')
      .eq('user_id', currentUserId)
      .order('report_date', { ascending: false });

    if (startDate) query = query.gte('report_date', startDate);
    if (endDate) query = query.lte('report_date', endDate);

    const { data, error } = await query;
    return { data: data || [], error: error?.message };
  };

  // Admin: Get all team reports
  const getAllReports = async (filters?: { userId?: string; startDate?: string; endDate?: string; searchQuery?: string }) => {
    if (!isSupabaseConfigured()) return { data: [], error: null };

    let query = supabase
      .from('daily_work_reports')
      .select('*, task_updates:report_task_updates(*, job:jobs(*, client:clients(*)))')
      .order('report_date', { ascending: false });

    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.startDate) query = query.gte('report_date', filters.startDate);
    if (filters?.endDate) query = query.lte('report_date', filters.endDate);

    const { data, error } = await query.limit(100);

    // Client-side search for hashtags and text
    let filteredData = data || [];
    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      filteredData = filteredData.filter((report: any) => {
        const notesMatch = (report.overall_notes || '').toLowerCase().includes(searchLower);
        const tagsMatch = report.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));
        const userMatch = (report.user?.full_name || '').toLowerCase().includes(searchLower);
        return notesMatch || tagsMatch || userMatch;
      });
    }

    return { data: filteredData, error: error?.message };
  };

  // Search reports by hashtag or text
  const searchReports = async (query: string, isAdmin: boolean = false, currentUserId?: string) => {
    if (!isSupabaseConfigured()) return { data: [], error: null };

    const { data: allReports, error } = isAdmin
      ? await getAllReports({ searchQuery: query })
      : currentUserId
        ? await getMyReports(currentUserId)
        : { data: [], error: null };

    if (error) return { data: [], error };

    // Filter based on query
    const searchLower = query.toLowerCase();
    const filtered = (allReports as any[]).filter((report: any) => {
      const notesMatch = (report.overall_notes || '').toLowerCase().includes(searchLower);
      const blockersMatch = (report.blockers || '').toLowerCase().includes(searchLower);
      const tagsMatch = report.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));
      return notesMatch || blockersMatch || tagsMatch;
    });

    return { data: filtered, error: null };
  };

  // Get today's submission status for team (Admin)
  const getTodaySubmissionStatus = async () => {
    if (!isSupabaseConfigured()) return { data: [], error: null };

    const today = new Date().toISOString().split('T')[0];

    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, full_name, role')
      .eq('is_active', true);

    if (usersError) return { data: [], error: usersError.message };

    // Get today's reports
    const { data: reports, error: reportsError } = await supabase
      .from('daily_work_reports')
      .select('user_id, submitted_at')
      .eq('report_date', today);

    if (reportsError) return { data: [], error: reportsError.message };

    // Combine data
    const statusData = (users || []).map((user: any) => {
      const report = (reports || []).find((r: any) => r.user_id === user.id);
      return {
        user_id: user.id,
        user_name: user.full_name,
        role: user.role,
        submitted: !!report,
        submitted_at: report?.submitted_at
      };
    });

    return { data: statusData, error: null };
  };

  // Fetch product-specific checklist from job_checklists
  const fetchProductChecklist = async (productType: string, category: 'design' | 'dispatch' = 'design') => {
    if (!isSupabaseConfigured()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('job_checklists')
        .select('items')
        .eq('job_type', productType)
        .eq('category', category)
        .single();

      if (error) {
        console.log('No checklist found for', productType, error);
        return { data: [], error: null }; // Return empty instead of error
      }

      // Convert items to checklist format
      const items = data?.items || [];
      const checklistItems = items.map((item: string, index: number) => ({
        item,
        checked: false,
        comment: '',
        order: index + 1
      }));

      return { data: checklistItems, error: null };
    } catch (e: any) {
      console.error('Error fetching checklist:', e);
      return { data: [], error: e.message };
    }
  };

  return {
    reports: data,
    loading,
    error,
    refetch,
    fetchMyTodayTasks,
    submitEODReport,
    getMyReports,
    getAllReports,
    searchReports,
    getTodaySubmissionStatus,
    fetchProductChecklist // Add new function
  };
}

// =============================================
// COMMISSIONS HOOK
// =============================================
export function useCommissions() {
  const { user, profile } = useAuth();

  // Build filter based on role
  const filter = profile?.role === 'admin'
    ? undefined // Admin sees all commissions
    : [{ column: 'marketing_person_id', value: user?.id }]; // Marketing users see only their own

  const { data, loading, error, refetch } = useSupabaseQuery<Commission>('commissions', {
    select: '*, marketing_person:profiles!marketing_person_id(*)',
    filter,
    orderBy: { column: 'created_at', ascending: false }
  });

  const createCommission = async (commission: Omit<Commission, 'id' | 'created_at' | 'updated_at' | 'gst_amount' | 'base_amount' | 'commission_amount'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const payload = {
      ...commission,
      created_by: user?.id,
    };

    const { data: newCommission, error: insertError } = await supabase
      .from('commissions')
      .insert([payload])
      .select('*, marketing_person:profiles!marketing_person_id(*)')
      .single();

    if (insertError) {
      console.error('Error creating commission:', insertError);
      return { error: insertError.message };
    }

    if (user) {
      await logActivity(user.id, 'created', 'commission', newCommission.id, `Created commission for ${commission.project_name || 'project'}: ₹${commission.project_total_amount}`);
    }

    refetch();
    return { data: newCommission, error: null };
  };

  const updateCommission = async (id: string, updates: Partial<Commission>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: updatedCommission, error: updateError } = await supabase
      .from('commissions')
      .update(updates)
      .eq('id', id)
      .select('*, marketing_person:profiles!marketing_person_id(*)')
      .single();

    if (updateError) {
      console.error('Error updating commission:', updateError);
      return { error: updateError.message };
    }

    if (user) {
      await logActivity(user.id, 'updated', 'commission', id, `Updated commission status to ${updates.status || 'updated'}`);
    }

    refetch();
    return { data: updatedCommission, error: null };
  };

  const deleteCommission = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error: deleteError } = await supabase
      .from('commissions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting commission:', deleteError);
      return { error: deleteError.message };
    }

    if (user) {
      await logActivity(user.id, 'deleted', 'commission', id, 'Deleted commission record');
    }

    refetch();
    return { error: null };
  };

  const markAsPaid = async (id: string, paymentReference?: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const updates = {
      status: 'paid' as const,
      paid_at: new Date().toISOString(),
      paid_by: user?.id,
      payment_reference: paymentReference
    };

    const { data: updatedCommission, error: updateError } = await supabase
      .from('commissions')
      .update(updates)
      .eq('id', id)
      .select('*, marketing_person:profiles!marketing_person_id(*)')
      .single();

    if (updateError) {
      console.error('Error marking commission as paid:', updateError);
      return { error: updateError.message };
    }

    if (user) {
      await logActivity(user.id, 'updated', 'commission', id, `Marked commission as paid${paymentReference ? ` (Ref: ${paymentReference})` : ''}`);
    }

    refetch();
    return { data: updatedCommission, error: null };
  };

  const approveCommission = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { data: updatedCommission, error: updateError } = await supabase
      .from('commissions')
      .update({ status: 'approved' })
      .eq('id', id)
      .select('*, marketing_person:profiles!marketing_person_id(*)')
      .single();

    if (updateError) {
      console.error('Error approving commission:', updateError);
      return { error: updateError.message };
    }

    if (user) {
      await logActivity(user.id, 'updated', 'commission', id, 'Approved commission for payment');
    }

    refetch();
    return { data: updatedCommission, error: null };
  };

  return {
    commissions: data,
    loading,
    error,
    refetch,
    createCommission,
    updateCommission,
    deleteCommission,
    markAsPaid,
    approveCommission
  };
}
