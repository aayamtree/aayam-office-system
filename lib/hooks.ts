'use client';

import useSWR from 'swr';
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { useAuth } from './auth-context';
import {
  Client, Vendor, Designer, Job, Invoice, Lead,
  Quotation, Dispatch, BankAccount, DesignTask, DesignProject,
  PurchaseBill, VendorPayment, PaymentReceived, POSCategory, POSProduct,
  PaperStock, POSSale, Note, Reminder, BankTransaction, SalesOrder, ActivityLog, JobChecklist, UserCalendarEvent, Commission, UserNote
} from '@/types/database';
import { logActivity } from './logger';
import { autoProgressJob } from './job-auto-progress';
import { upsertAutoCalendarEvent } from './calendar-auto-events';

// Generic hook for fetching data
export interface UseSupabaseQueryOptions {
  select?: string;
  filter?: { column: string; value: any; op?: 'eq' | 'neq' | 'in' | 'lte' | 'gte' }[];
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  page?: number;      // 1-indexed page number for pagination
  pageSize?: number;   // Number of rows per page (default: 50)
}

export function useSupabaseQuery<T>(
  tableName: string,
  options?: UseSupabaseQueryOptions
) {
  const stableFilter = JSON.stringify(options?.filter);
  const stableOrderBy = JSON.stringify(options?.orderBy);
  const stableOptions = JSON.stringify(options);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Key for SWR cache
  const key = isSupabaseConfigured() ? [tableName, stableFilter, stableOrderBy, options?.select, options?.limit, options?.page, options?.pageSize] : null;

  const fetcher = async () => {
    let query = supabase
      .from(tableName)
      .select(options?.select || '*');

    // Apply filters (supports eq, neq, in, lte, gte)
    if (options?.filter) {
      options.filter.forEach(f => {
        const op = f.op || 'eq';
        if (op === 'eq') query = query.eq(f.column, f.value);
        else if (op === 'neq') query = query.neq(f.column, f.value);
        else if (op === 'in') query = query.in(f.column, f.value);
        else if (op === 'lte') query = query.lte(f.column, f.value);
        else if (op === 'gte') query = query.gte(f.column, f.value);
      });
    }

    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? false
      });
    }

    // Apply pagination (range) or simple limit
    if (options?.page && options?.pageSize) {
      const from = (options.page - 1) * options.pageSize;
      const to = from + options.pageSize - 1;
      query = query.range(from, to);
    } else if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: result, error: queryError } = await query;

    if (queryError) {
      // If it's a missing table or column error (400/404/500 from PostgREST),
      // return empty array instead of throwing to prevent SWR infinite retry loops
      console.warn(`[useSupabaseQuery] ${tableName} error:`, queryError.message);
      return [] as unknown as T[];
    }
    return (result as unknown as T[]) || [];
  };

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,    // PERF: Don't refetch on tab switch — saves API calls
    revalidateOnReconnect: true, // Refetch on reconnect
    dedupingInterval: 30000,     // 30s dedup — navigating between pages reuses cached data
    keepPreviousData: true,      // Show previous data while fetching new data
    // PERF: No refreshInterval — no auto-polling. Data refreshes on writes via mutate().
    fallbackData: [] as T[],     // Instant render with empty array, no loading state on revisit
  });

  // =============================================
  // REALTIME SUBSCRIPTION — Auto-refetch on changes
  // ONLY for tables where OTHER users' changes need instant visibility.
  // All other tables use SWR's mutate() after writes — no realtime needed.
  // Reduced from 10 → 2 to save ~8 WebSocket connections per component on free tier.
  // =============================================
  const REALTIME_TABLES = new Set([
    // PERF: Removed 'jobs' — saves 1 WebSocket connection. Jobs sync via SWR mutate() on writes.
    'design_tasks',  // Designers need to see new task assignments instantly
  ]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !key) return;
    // Skip realtime for static/rarely-changing tables
    if (!REALTIME_TABLES.has(tableName)) return;

    const channelName = `realtime-${tableName}-${stableFilter}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => {
          // Debounce: wait 1s before refetching (prevents rapid-fire during bulk ops)
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            mutate();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [tableName, stableFilter]);

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
      created_by: user?.id,
      outstanding_balance: 0  // Initialize at 0
    } as any;

    const { data, error } = await supabase
      .from('clients')
      .insert([payload])
      .select()
      .single();

    if (!error) refetch();
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

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const deleteClient = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (!error) refetch();
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

    const payload = {
      ...vendor,
      outstanding_balance: 0  // Initialize at 0
    } as any;

    const { data, error } = await supabase
      .from('vendors')
      .insert([payload])
      .select()
      .single();

    if (!error) refetch();
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

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const deleteVendor = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);

    if (!error) refetch();
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
// Single source of truth: reads from profiles table WHERE role = 'designer'
// =============================================
export function useDesigners() {
  const { data, loading, error, refetch } = useSupabaseQuery<any>('profiles', {
    select: 'id, full_name, email, role, is_active, phone, skills, hourly_rate, monthly_salary, employment_type, joining_date, city, state, document_url',
    filter: [{ column: 'role', value: 'designer' }],
    orderBy: { column: 'full_name', ascending: true }
  });

  // Map full_name → name for backward compatibility, and filter out profiles with no name
  const designers = (data || [])
    .filter((p: any) => p.full_name && p.full_name.trim() !== '')
    .map((p: any) => ({ ...p, name: p.full_name }));

  return {
    designers,
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
    select: '*, client:clients(id, name, company, phone, email)',
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
  const { user, profile } = useAuth();
  // Lightweight default: only fetch client/vendor names for list views
  // Pages needing full relations can pass select: '*, client:clients(*), ...' in options
  const defaultSelect = '*, client:clients(id, name), vendor:vendors(id, name), designer:profiles(id, full_name)';
  const { data, loading, error, refetch } = useSupabaseQuery<Job>('jobs', {
    select: options?.select || defaultSelect,
    orderBy: { column: 'created_at', ascending: false },
    // PERF: No default limit — callers use pagination via page/pageSize or explicit limit
    ...options
  });

  const createJob = async (job: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'job_number' | 'client' | 'vendor' | 'designer'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Get next job number
    // Fallback: AAY-DDMMXXX (DD=day, MM=month, XXX=daily sequence)
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    let jobNumber = `AAY-${dd}${mm}001`;

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

    if (!error && data) {
      logActivity('Created Job', 'job', data.id, `New job ${jobNumber} created for ${data.client_name || 'client'}`, undefined, user?.id);

      // Auto-create calendar event for deadline
      if (data.client_deadline && profile?.id) {
        await upsertAutoCalendarEvent({
          userId: profile.id,
          sourceType: 'job',
          sourceId: data.id,
          title: `📋 Deadline: ${data.project_name}`,
          date: data.client_deadline,
          description: `Job ${jobNumber} deadline`,
          visibility: 'team',
        });
      }

      refetch();
    }
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

    if (!error && data) {
      // Auto-update calendar event if deadline changed
      if (updates.client_deadline && profile?.id) {
        await upsertAutoCalendarEvent({
          userId: profile.id,
          sourceType: 'job',
          sourceId: id,
          title: `📋 Deadline: ${data.project_name}`,
          date: updates.client_deadline,
          description: `Job ${data.job_number} deadline`,
          visibility: 'team',
        });
      }
      refetch();
    }
    return { data, error: error?.message };
  };

  const updateJobStage = async (id: string, newStage: Job['current_stage'], notes?: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Get current job
    const { data: job } = await supabase
      .from('jobs')
      .select('current_stage, job_number, revision_count')
      .eq('id', id)
      .single();

    // Auto-increment revision_count when moving BACK to designing from approval/later stages
    const revisionTriggerStages = ['approval', 'pre_print_qc', 'printing', 'finishing', 'quality_check', 'ready'];
    const shouldIncrementRevision = newStage === 'designing' && job?.current_stage && revisionTriggerStages.includes(job.current_stage);

    // Update job stage (and revision_count if applicable)
    const updateData: any = { current_stage: newStage };
    if (shouldIncrementRevision) {
      updateData.revision_count = (job?.revision_count || 0) + 1;
    }

    const { error: updateError } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', id);

    if (updateError) return { error: updateError.message };

    // Log stage change
    await supabase.from('job_stage_history').insert([{
      job_id: id,
      from_stage: job?.current_stage,
      to_stage: newStage,
      notes
    }]);

    // Log activity (fire-and-forget)
    logActivity(
      'Updated Job Stage',
      'Sales',
      id,
      `Job ${job?.job_number} moved from ${job?.current_stage || 'new'} to ${newStage}${notes ? ': ' + notes : ''}`,
      undefined, user?.id
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
// PRODUCT CATEGORIES HOOK
// =============================================
export function useProductCategories() {
  const { data, loading, error, refetch } = useSupabaseQuery<any>('product_categories', {
    filter: [{ column: 'is_active', value: true }],
    orderBy: { column: 'name', ascending: true }
  });

  const createCategory = async (name: string) => {
    if (!isSupabaseConfigured()) return { data: null, error: 'Database not configured' };

    const { data: newCat, error } = await supabase
      .from('product_categories')
      .insert([{ name: name.trim(), is_active: true }])
      .select()
      .single();

    if (!error) refetch();
    return { data: newCat, error: error?.message };
  };

  return {
    categories: data,
    loading,
    error,
    refetch,
    createCategory
  };
}

// =============================================
// INVOICES HOOK
// =============================================
export function useInvoices() {
  const { data, loading, error, refetch } = useSupabaseQuery<Invoice>('invoices', {
    select: '*, client:clients(id, name, company), job:jobs(id, job_number, project_name), items:invoice_items(*)',
    orderBy: { column: 'created_at', ascending: false },
    limit: 200  // Default pagination
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
    orderBy: { column: 'created_at', ascending: false },
    limit: 200  // Default pagination
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

    if (!error && data) {
      logActivity('Created Lead', 'lead', data.id, `New lead ${data.lead_number} - ${data.name}`, undefined, user?.id);
      refetch();
    }
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
        assigned_to: lead.assigned_to || userId,
        created_by: userId,
        // ✅ Mark as marketing-sourced with full traceability
        source: 'marketing',
        assigned_marketing_user_id: lead.assigned_to || userId,
        source_lead_id: leadId,
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
    select: '*, client:clients(id, name, company), job:jobs(id, job_number, project_name, current_stage), designer:profiles(id, full_name, email)',
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
      .select('*, job:jobs(id)')
      .single();

    if (!error) {
      // Auto-progress: design completed → job moves to approval
      if (updates.status === 'completed' && data?.job_id) {
        await autoProgressJob(data.job_id, 'design_completed');
      }
      refetch();
    }
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
    select: '*, vendor:vendors(id, name, company, phone), job:jobs(id, job_number, project_name)',
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
  const { user } = useAuth();
  const { data, loading, error, refetch } = useSupabaseQuery<Dispatch>('dispatches', {
    select: '*, client:clients(id, name, company, phone, address), job:jobs(id, job_number, project_name)',
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
      // Auto-progress: dispatch created → job moves to dispatched
      if (dispatch.job_id) {
        await autoProgressJob(dispatch.job_id, 'dispatch_created');
      }
      // Log activity (fire-and-forget)
      logActivity(
        'Created Dispatch',
        'Dispatch',
        data.id,
        `Created dispatch ${data.dispatch_number} - ${dispatch.packages} package(s)`,
        undefined, user?.id
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
// Default empty stats shape (used as fallback)
const EMPTY_STATS = {
  totalClients: 0,
  activeJobs: 0,
  totalRevenue: 0,
  pendingPayments: 0,
  pendingDispatches: 0,
  leadsThisMonth: 0,
  ordersThisMonth: 0,
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
};

type DashboardStats = typeof EMPTY_STATS;

// Standalone fetcher — shared by all callers via SWR deduplication
// PERF: Uses parallel lightweight queries instead of single heavy RPC
async function fetchDashboardStats(): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) return EMPTY_STATS;

  const today = new Date().toISOString().split('T')[0];
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

  // Safe query wrapper — if any single query fails, return fallback
  const safe = async <T>(fn: () => PromiseLike<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  try {
    // ── GROUP 1: Core KPIs (all run in parallel) ──
    const [
      clientsRes,
      activeJobsRes,
      revenueRes,
      pendingRes,
      ordersMonthRes,
      leadsMonthRes,
      dispatchesRes,
    ] = await Promise.all([
      safe(() => supabase.from('clients').select('id', { count: 'exact', head: true }).then(r => r), { count: 0 } as any),
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).not('current_stage', 'in', '("delivered","cancelled")').then(r => r), { count: 0 } as any),
      safe(() => supabase.from('jobs').select('total_amount').not('current_stage', 'in', '("delivered","cancelled")').gte('created_at', startOfYear).then(r => r), { data: [] } as any),
      safe(() => supabase.from('jobs').select('total_amount, amount_received').neq('payment_status', 'paid').not('current_stage', 'in', '("delivered","cancelled")').then(r => r), { data: [] } as any),
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth).neq('current_stage', 'cancelled').then(r => r), { count: 0 } as any),
      safe(() => supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth).then(r => r), { count: 0 } as any),
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['ready', 'packed']).then(r => r), { count: 0 } as any),
    ]);

    const totalRevenue = (revenueRes.data || []).reduce((sum: number, j: any) => sum + (j.total_amount || 0), 0);
    const pendingPayments = (pendingRes.data || []).reduce((sum: number, j: any) =>
      sum + ((j.total_amount || 0) - (j.amount_received || 0)), 0);

    // ── GROUP 2: Pipeline + Focus + Alerts (parallel) ──
    const [
      pipelineRes,
      pipelineOverdueRes,
      jobsDueTodayRes,
      jobsDelayedRes,
      jobsCompletedRes,
      overduePaymentsRes,
      followUpsDueRes,
      followUpsTableRes,
      feedbackPendingRes,
      vendorRes,
      vendorDueTodayRes,
      vendorDelayedRes,
    ] = await Promise.all([
      // Pipeline grouped counts
      safe(() => supabase.from('jobs').select('current_stage').not('current_stage', 'in', '("delivered","cancelled")').then(r => r), { data: [] } as any),
      // Pipeline overdue
      safe(() => supabase.from('jobs').select('current_stage').not('current_stage', 'in', '("delivered","cancelled")').not('client_deadline', 'is', null).lt('client_deadline', today).then(r => r), { data: [] } as any),
      // Today's focus
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).not('current_stage', 'in', '("delivered","cancelled")').eq('client_deadline', today).then(r => r), { count: 0 } as any),
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).not('current_stage', 'in', '("delivered","cancelled")').lt('client_deadline', today).not('client_deadline', 'is', null).then(r => r), { count: 0 } as any),
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('current_stage', 'delivered').gte('updated_at', today).then(r => r), { count: 0 } as any),
      // Alerts
      safe(() => supabase.from('invoices').select('id', { count: 'exact', head: true }).neq('payment_status', 'paid').not('due_date', 'is', null).lt('due_date', today).then(r => r), { count: 0 } as any),
      safe(() => supabase.from('leads').select('id', { count: 'exact', head: true }).not('next_follow_up', 'is', null).lte('next_follow_up', today).not('status', 'in', '("won","lost")').then(r => r), { count: 0 } as any),
      safe(() => supabase.from('follow_ups').select('id', { count: 'exact', head: true }).not('follow_up_date', 'is', null).lte('follow_up_date', today).then(r => r), { count: 0 } as any),
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('current_stage', 'approval').then(r => r), { count: 0 } as any),
      // Vendor stats
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['printing', 'finishing']).then(r => r), { count: 0 } as any),
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['printing', 'finishing']).eq('internal_deadline', today).then(r => r), { count: 0 } as any),
      safe(() => supabase.from('jobs').select('id', { count: 'exact', head: true }).in('current_stage', ['printing', 'finishing']).not('internal_deadline', 'is', null).lt('internal_deadline', today).then(r => r), { count: 0 } as any),
    ]);

    // Build pipeline map
    const pipeline: Record<string, number> = {};
    (pipelineRes.data || []).forEach((j: any) => {
      const s = j.current_stage || 'new';
      pipeline[s] = (pipeline[s] || 0) + 1;
    });

    const pipelineOverdue: Record<string, number> = {};
    (pipelineOverdueRes.data || []).forEach((j: any) => {
      const s = j.current_stage || 'new';
      pipelineOverdue[s] = (pipelineOverdue[s] || 0) + 1;
    });

    // ── GROUP 3: Sales Performance (non-blocking, can be slow) ──
    let salesPerformance: { month: string; value: number; active?: boolean }[] = [];
    try {
      const now = new Date();
      const months: { start: Date; label: string; active: boolean }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          start: d,
          label: d.toLocaleString('en', { month: 'short' }),
          active: i === 0,
        });
      }

      const salesPromises = months.map(async (m) => {
        const end = new Date(m.start.getFullYear(), m.start.getMonth() + 1, 1);
        const { data } = await supabase
          .from('jobs')
          .select('total_amount')
          .gte('created_at', m.start.toISOString())
          .lt('created_at', end.toISOString())
          .neq('current_stage', 'cancelled');

        const value = (data || []).reduce((sum: number, j: any) => sum + (j.total_amount || 0), 0);
        return { month: m.label, value, active: m.active };
      });

      salesPerformance = await Promise.all(salesPromises);
    } catch {
      salesPerformance = [];
    }

    const feedbackCount = feedbackPendingRes.count || 0;

    return {
      totalClients: clientsRes.count || 0,
      activeJobs: activeJobsRes.count || 0,
      totalRevenue,
      pendingPayments,
      pendingDispatches: dispatchesRes.count || 0,
      leadsThisMonth: leadsMonthRes.count || 0,
      ordersThisMonth: ordersMonthRes.count || 0,
      pipeline,
      pipelineOverdue,
      alerts: {
        overduePayments: overduePaymentsRes.count || 0,
        followUpsDue: (followUpsDueRes.count || 0) + (followUpsTableRes.count || 0),
        lowStock: 0,
        blockedJobs: feedbackCount,
        blockedBreakdown: {
          feedback: feedbackCount,
          payment: 0
        }
      },
      todaysFocus: {
        jobsDue: jobsDueTodayRes.count || 0,
        jobsDelayed: jobsDelayedRes.count || 0,
        jobsCompleted: jobsCompletedRes.count || 0,
        paymentsDue: 0
      },
      vendorStats: {
        jobsAtVendor: vendorRes.count || 0,
        dueToday: vendorDueTodayRes.count || 0,
        delayed: vendorDelayedRes.count || 0
      },
      salesPerformance,
    };
  } catch (error) {
    console.error('Dashboard stats fetch error:', error);
    return EMPTY_STATS;
  }
}

export function useDashboardStats() {
  const { data, isLoading } = useSWR(
    isSupabaseConfigured() ? 'dashboard-stats' : null,
    fetchDashboardStats,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,     // 30s dedup — all callers share ONE fetch
      // PERF: No refreshInterval — data refreshes on navigation. Saves API calls.
      keepPreviousData: true,
      fallbackData: EMPTY_STATS,
    }
  );

  return { stats: data || EMPTY_STATS, loading: isLoading };
}

// =============================================
// QUOTATIONS HOOK
// =============================================
export function useQuotations() {
  const { user, profile } = useAuth();

  // Fetch all quotations — role-based filtering is done in the page
  // (marketing: created_by = me OR lead.assigned_to = me)
  const { data, loading, error, refetch } = useSupabaseQuery<Quotation>('quotations', {
    select: '*, client:clients(*), lead:leads(*), items:quotation_items(*)',
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
      // Log activity (fire-and-forget)
      logActivity(
        'Created Quotation',
        'Sales',
        data.id,
        `Created quotation ${data.quote_number} for ₹${quotation.total_amount?.toLocaleString() || 0}`,
        undefined, user?.id
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

    if (!error) refetch();
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

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const deleteNote = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (!error) refetch();
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
// DASHBOARD NOTES HOOK (personal + tagged)
// =============================================
export function useDashboardNotes() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false); // start false — renders instantly, populates silently

  const fetchNotes = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }

    try {
      // Fetch notes where user is creator OR tagged
      const { data: myNotes } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', profile.id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(20);

      const { data: taggedNotes } = await supabase
        .from('notes')
        .select('*')
        .contains('tagged_users', [profile.id])
        .neq('user_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      const combined = [...(myNotes || []), ...(taggedNotes || [])];
      const unique = combined.filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i);
      unique.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setNotes(unique as Note[]);
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const createNote = async (note: { title?: string; content: string; color?: string; is_pinned?: boolean; tagged_users?: string[] }) => {
    if (!profile?.id) return { error: 'User not loaded yet. Please wait and try again.' };

    // Build insert object — only include columns that exist
    const insertData: Record<string, any> = {
      content: note.content,
      user_id: profile.id,
      color: note.color || 'yellow',
      is_pinned: note.is_pinned || false,
    };
    if (note.title) insertData.title = note.title;
    if (note.tagged_users && note.tagged_users.length > 0) insertData.tagged_users = note.tagged_users;

    const { data, error } = await supabase
      .from('notes')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Note create error:', error);
      return { data: null, error: error.message };
    }

    fetchNotes();
    return { data, error: null };
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (!error) fetchNotes();
    return { data, error: error?.message };
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (!error) fetchNotes();
    return { error: error?.message };
  };

  const togglePin = async (id: string, pinned: boolean) => {
    return updateNote(id, { is_pinned: !pinned });
  };

  return { notes, loading, createNote, updateNote, deleteNote, togglePin, refetch: fetchNotes };
}

// =============================================
// REMINDERS HOOK (user-scoped)
// =============================================
export function useReminders() {
  const { profile } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    if (!profile?.id || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', profile.id)
      .order('due_date', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setReminders(data || []);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const createReminder = async (reminder: Omit<Reminder, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured() || !profile?.id) return { error: 'Database not configured' };

    const { data, error } = await supabase
      .from('reminders')
      .insert([{ ...reminder, user_id: profile.id }])
      .select()
      .single();

    if (!error) fetchReminders();
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

    if (!error) fetchReminders();
    return { data, error: error?.message };
  };

  const deleteReminder = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

    if (!error) fetchReminders();
    return { error: error?.message };
  };

  return {
    reminders,
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
    select: '*, bank_account:bank_accounts(id, bank_name, account_name, account_number)',
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

    // Try the RPC first (it also generates a payment number)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('record_payment_received', {
      p_client_id: payment.client_id,
      p_amount: payment.amount,
      p_payment_mode: payment.payment_mode,
      p_payment_date: payment.payment_date,
      p_bank_account_id: payment.bank_account_id ?? null,
      p_reference: payment.reference_number ?? null,
      p_notes: payment.notes ?? null,
      p_invoice_id: payment.invoice_id ?? null,
      p_attachment_url: payment.attachment_url ?? null,
    });

    if (!rpcError) {
      await fetchData();
      return { data: rpcResult, error: null };
    }

    // RPC failed (e.g. function does not exist) — fall back to direct insert
    console.warn('[payments_received] RPC failed, using direct insert:', rpcError.message);
    const { data: directResult, error: directError } = await supabase
      .from('payments_received')
      .insert([{
        client_id: payment.client_id ?? null,
        job_id: (payment as any).job_id ?? null,
        amount: payment.amount,
        payment_mode: payment.payment_mode,
        payment_date: payment.payment_date,
        bank_account_id: payment.bank_account_id ?? null,
        reference_number: payment.reference_number ?? null,
        notes: payment.notes ?? null,
        invoice_id: payment.invoice_id ?? null,
        attachment_url: payment.attachment_url ?? null,
      }])
      .select()
      .single();

    if (!directError) await fetchData();
    return { data: directResult, error: directError?.message ?? null };
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
    select: '*',
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
  // Build query conditions — DB column is `start_time` (TIMESTAMP)
  const conditions: any[] = [];

  if (startDate) {
    conditions.push({ column: 'start_time', op: 'gte', value: startDate });
  }
  if (endDate) {
    conditions.push({ column: 'start_time', op: 'lte', value: endDate });
  }

  const { data, loading, error, refetch } = useSupabaseQuery<UserCalendarEvent>('user_calendar_events', {
    select: '*',
    filter: conditions.length > 0 ? conditions : undefined,
    orderBy: { column: 'start_time', ascending: true }
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
  const { user } = useAuth();
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

      // 4. Log activity (fire-and-forget)
      logActivity(
        'Submitted EOD Report',
        'System',
        report.id,
        `Daily work report submitted for ${reportData.report_date}`,
        undefined, user?.id
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
  const fetchProductChecklist = async (productCategory: string, category: 'design' | 'dispatch' = 'design') => {
    if (!isSupabaseConfigured()) return { data: [], error: null };

    try {
      const { data, error } = await supabase
        .from('job_checklists')
        .select('items')
        .eq('job_type', productCategory)
        .eq('category', category)
        .single();

      if (error) {
        console.log('No checklist found for', productCategory, error);
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
    select: '*, marketing_person:profiles!marketing_person_id(id, full_name, email, role)',
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
      logActivity(
        'Created Commission',
        'Commissions',
        newCommission.id,
        `Created commission for ${commission.project_name || 'project'}: ₹${commission.project_total_amount}`,
        undefined, user?.id
      );
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
      logActivity(
        'Updated Commission',
        'Commissions',
        id,
        `Updated commission status to ${updates.status || 'updated'}`,
        undefined, user?.id
      );
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
      logActivity(
        'Deleted Commission',
        'Commissions',
        id,
        'Deleted commission record',
        undefined, user?.id
      );
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
      logActivity(
        'Marked Commission Paid',
        'Commissions',
        id,
        `Marked commission as paid${paymentReference ? ` (Ref: ${paymentReference})` : ''}`,
        undefined, user?.id
      );
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
      logActivity(
        'Approved Commission',
        'Commissions',
        id,
        'Approved commission for payment',
        undefined, user?.id
      );
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

// =============================================
// ACTIVITY FEED HOOK
// =============================================
export function useActivityFeed(limit: number = 20) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          // Batch fetch profile names for all unique user_ids
          const userIds = Array.from(new Set(data.map(a => a.user_id).filter(Boolean)));
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, username, role')
            .in('id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

          const enriched = data.map(a => ({
            ...a,
            profiles: profileMap.get(a.user_id) || null
          }));

          setActivities(enriched);
        } else if (!error) {
          setActivities([]);
        }
      } catch (error) {
        console.error('Error fetching activity feed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();

    // Refresh every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  return { activities, loading };
}

// =============================================
// USER NOTES HOOK (Dashboard Sticky Notes)
// =============================================
export function useUserNotes() {
  const { profile } = useAuth();
  const userId = profile?.id;

  const { data, loading, error, refetch } = useSupabaseQuery<UserNote>('user_notes', {
    select: '*',
    orderBy: { column: 'created_at', ascending: false }
  });

  // Filter client-side: my notes + shared notes tagging me
  const notes = (data || []).filter(n =>
    n.user_id === userId ||
    (n.note_type === 'shared' && n.tagged_users?.includes(userId || '')) ||
    n.note_type === 'pinned'
  );

  const createNote = async (content: string, noteType: 'personal' | 'pinned' | 'shared' = 'personal', taggedUsers?: string[], jobId?: string) => {
    if (!isSupabaseConfigured() || !userId) return { error: 'Not configured' };

    const { data, error } = await supabase
      .from('user_notes')
      .insert([{
        user_id: userId,
        content,
        note_type: noteType,
        tagged_users: taggedUsers || [],
        job_id: jobId || null,
        is_archived: false
      }])
      .select()
      .single();

    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateNote = async (id: string, updates: { content?: string; note_type?: string; is_archived?: boolean }) => {
    if (!isSupabaseConfigured()) return { error: 'Not configured' };

    const { error } = await supabase
      .from('user_notes')
      .update(updates)
      .eq('id', id);

    if (!error) refetch();
    return { error: error?.message };
  };

  const archiveNote = async (id: string) => updateNote(id, { is_archived: true });

  return {
    notes: notes.filter(n => !n.is_archived),
    archivedNotes: notes.filter(n => n.is_archived),
    loading,
    error,
    refetch,
    createNote,
    updateNote,
    archiveNote
  };
}
