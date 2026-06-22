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
import { getProjectTypeCode } from './job-workflow';
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
  const stableFilter = JSON.stringify(options?.filter ?? null);
  const stableOrderBy = JSON.stringify(options?.orderBy ?? null);
  const stableSelect = options?.select ?? '*';
  const stableLimit = options?.limit ?? null;
  const stablePage = options?.page ?? null;
  const stablePageSize = options?.pageSize ?? null;
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Key uses stable primitives — never object references
  const key = isSupabaseConfigured()
    ? [tableName, stableFilter, stableOrderBy, stableSelect, stableLimit, stablePage, stablePageSize]
    : null;

  // Simple fetcher — closes over stable string locals, NOT over the `options` object.
  // `options` itself is a new reference every render, but the locals above are
  // recalculated from it and primitives/strings don't change reference.
  const fetcher = async () => {
    let query = supabase.from(tableName).select(stableSelect);

    const filters: UseSupabaseQueryOptions['filter'] = stableFilter && stableFilter !== 'null'
      ? JSON.parse(stableFilter)
      : [];
    if (filters && filters.length > 0) {
      filters.forEach(f => {
        const op = f.op || 'eq';
        if (op === 'eq') query = query.eq(f.column, f.value);
        else if (op === 'neq') query = query.neq(f.column, f.value);
        else if (op === 'in') query = query.in(f.column, f.value);
        else if (op === 'lte') query = query.lte(f.column, f.value);
        else if (op === 'gte') query = query.gte(f.column, f.value);
      });
    }

    if (stableOrderBy && stableOrderBy !== 'null') {
      const orderBy: UseSupabaseQueryOptions['orderBy'] = JSON.parse(stableOrderBy);
      if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
    }

    if (stablePage && stablePageSize) {
      const from = (stablePage - 1) * stablePageSize;
      const to = from + stablePageSize - 1;
      query = query.range(from, to);
    } else if (stableLimit) {
      query = query.limit(stableLimit);
    }

    const { data: result, error: queryError } = await query;
    if (queryError) {
      console.warn(`[useSupabaseQuery] ${tableName} error:`, queryError.message);
      return [] as unknown as T[];
    }
    return (result as unknown as T[]) || [];
  };

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30000,
    keepPreviousData: true,
    fallbackData: [] as T[],
    // Never auto-retry on error — our fetcher already returns [] on error.
    // Without this, SWR retries with exponential backoff that floods the network.
    onErrorRetry: () => { },
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
    orderBy: { column: 'created_at', ascending: false },
    limit: 100 // Reduced from 200 for better performance
  });

  const createClient = async (client: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'outstanding_balance'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Insert on the server with the service role. The previous direct browser
    // insert failed with an RLS "anon" violation whenever the browser Supabase
    // session had lapsed (token expiry / daily reset / fallback profile),
    // because every clients policy only grants the `authenticated` role.
    try {
      const res = await fetch('/api/crm/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...client, assigned_to: user?.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        return { error: json?.error || 'Failed to create client' };
      }
      refetch();
      return { data: json.data, error: undefined };
    } catch (err: any) {
      return { error: err?.message || 'Failed to create client' };
    }
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
    orderBy: { column: 'created_at', ascending: false },
    limit: 100 // Reduced from 200 for better performance
  });

  const createVendor = async (vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'> & { outstanding_balance?: number }) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // If caller provided an outstanding_balance (e.g. seeded from opening_balance),
    // honor it. Otherwise initialize at 0.
    const incoming = vendor as any;
    const seed = typeof incoming.outstanding_balance === 'number' ? incoming.outstanding_balance : 0;
    const payload = {
      ...vendor,
      outstanding_balance: seed
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
// Single source of truth: reads from profiles table WHERE can_design = true
// This includes role='designer' users AND admins with can_design flag set
// =============================================
export function useDesigners() {
  const { data, loading, error, refetch } = useSupabaseQuery<any>('profiles', {
    select: 'id, full_name, email, role, can_design, is_active, phone, skills, hourly_rate, monthly_salary, employment_type, joining_date, city, state, document_url',
    filter: [{ column: 'can_design', value: true }],
    orderBy: { column: 'full_name', ascending: true }
  });

  // Map full_name → name for backward compat
  // Filter: must have a real name AND not be a placeholder like "Designer 5", "Designer 6" etc.
  const designers = (data || [])
    .filter((p: any) => {
      const n = (p.full_name || '').trim();
      return n !== '' && !/^Designer\s*\d+$/i.test(n);
    })
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
// Optimized select constants for jobs
export const JOB_SELECTS = {
  LIST: 'id, job_number, project_name, client_id, priority, current_stage, job_type, product_category, parent_job_id, client_deadline, total_amount, amount_received, payment_status, client:clients(id, name, company)',
  CARD: 'id, job_number, project_name, client_id, designer_id, current_stage, job_type, product_category, parent_job_id, total_amount, amount_received, payment_status, files, client:clients(id, company, name)',
  FULL: '*, client:clients(id, name, company, source), vendor:vendors(id, name)'
};

export function useJobs(options?: UseSupabaseQueryOptions) {
  const { user, profile } = useAuth();
  // Lightweight default: only fetch essential columns for list views
  const defaultSelect = options?.select || JOB_SELECTS.LIST;
  const { data, loading, error, refetch } = useSupabaseQuery<Job>('jobs', {
    select: defaultSelect,
    orderBy: { column: 'created_at', ascending: false },
    limit: options?.limit || 50, // Default pagination to 50 items
    ...options
  });

  // Pull the next master job number from the counter (consumes one value).
  // Format: <TYPE>-DDMMXXX  (TYPE = DO | PO | DP, XXX = shared daily sequence)
  const nextJobNumber = async (jobType?: string): Promise<string> => {
    const code = getProjectTypeCode(jobType);
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    let jobNumber = `${code}-${dd}${mm}001`;
    try {
      const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'job', type_prefix: code });
      if (numberData) jobNumber = numberData;
    } catch (e) {
      console.warn('RPC get_next_number failed, using fallback');
    }
    return jobNumber;
  };

  const createJob = async (job: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'job_number' | 'client' | 'vendor' | 'designer'> & { job_number?: string }) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };

    // Honor a caller-provided job number (e.g. "AAY-1806001-2" for a mix-order
    // item); otherwise pull a fresh master number from the counter.
    const jobNumber = job.job_number || await nextJobNumber((job as any).job_type);

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

    // Supabase PostgREST may return error=null even on FK constraint violations.
    // Verify by checking if the row still exists after the delete attempt.
    if (!error) {
      const { count } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('id', id);

      if (count && count > 0) {
        // Row still exists — delete was blocked (FK constraint or RLS)
        return { error: 'This order has linked invoice or dispatch records. Delete those first, then try again.' };
      }
      refetch();
      return { error: null };
    }

    return { error: error?.message };
  };

  return {
    jobs: data,
    loading,
    error,
    refetch,
    createJob,
    nextJobNumber,
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
    filter: [{ column: 'is_active', value: true }, { column: 'type', value: 'product' }],
    orderBy: { column: 'name', ascending: true }
  });

  const createCategory = async (name: string) => {
    if (!isSupabaseConfigured()) return { data: null, error: 'Database not configured' };

    const { data: newCat, error } = await supabase
      .from('product_categories')
      .insert([{ name: name.trim(), is_active: true, type: 'product' }])
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
// PURCHASE SERVICE CATEGORIES HOOK
// =============================================
export function usePurchaseServiceCategories() {
  const { data, loading, error, refetch } = useSupabaseQuery<any>('product_categories', {
    filter: [{ column: 'is_active', value: true }, { column: 'type', value: 'service' }],
    orderBy: { column: 'name', ascending: true }
  });

  const createServiceCategory = async (name: string) => {
    if (!isSupabaseConfigured()) return { data: null, error: 'Database not configured' };

    const { data: newCat, error } = await supabase
      .from('product_categories')
      .insert([{ name: name.trim(), is_active: true, type: 'service' }])
      .select()
      .single();

    if (!error) refetch();
    return { data: newCat, error: error?.message };
  };

  return {
    serviceCategories: data,
    loading,
    error,
    refetch,
    createServiceCategory
  };
}

// =============================================
// INVOICES HOOK
// =============================================
export function useInvoices() {
  const { data, loading, error, refetch } = useSupabaseQuery<Invoice>('invoices', {
    select: '*, client:clients(id, name, company, phone, email, address, city, state, pincode, gstin, delivery_same_as_billing, delivery_address, delivery_city, delivery_state, delivery_pincode), job:jobs(id, job_number, project_name), items:invoice_items(*)',
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
          item_notes: item.item_notes || null,
          hsn_code: item.hsn_code || null,
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
    select: 'id, lead_number, name, company, email, phone, source, status, product_interest, expected_value, lead_type, billing_preference, lost_reason, requirement, next_follow_up, notes, assigned_to, created_at, updated_at, next_followup_date, is_converted',
    filter,
    orderBy: { column: 'created_at', ascending: false },
    limit: 100  // Reduced from 200 for better performance
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
    select: '*, client:clients(id, name, company), job:jobs(id, job_number, project_name, current_stage)',
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

      // Single query for all 6 months, grouped in JS — avoids 6 round trips
      const sixMonthsAgo = months[0].start;
      const { data: salesData } = await supabase
        .from('jobs')
        .select('total_amount, created_at')
        .gte('created_at', sixMonthsAgo.toISOString())
        .neq('current_stage', 'cancelled');

      salesPerformance = months.map((m) => {
        const end = new Date(m.start.getFullYear(), m.start.getMonth() + 1, 1).toISOString();
        const start = m.start.toISOString();
        const value = (salesData || [])
          .filter((j: any) => j.created_at >= start && j.created_at < end)
          .reduce((sum: number, j: any) => sum + (j.total_amount || 0), 0);
        return { month: m.label, value, active: m.active };
      });
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
    orderBy: { column: 'created_at', ascending: false },
    limit: 100
  });

  // Writes go through a server API route that uses the service role. This keeps
  // saves working even when the browser's Supabase session has lapsed to "anon"
  // (a direct browser write fails RLS with "new row violates row-level security
  // policy" in that case). Reads still use the browser client above.
  const createQuotation = async (quotation: Omit<Quotation, 'id' | 'created_at' | 'updated_at' | 'quote_number' | 'client' | 'items'>) => {
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotation),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error || 'Failed to create quotation' };

      const data = json.data;
      if (data) {
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
      return { data, error: undefined };
    } catch (e: any) {
      return { error: e?.message || 'Network error while creating quotation' };
    }
  };

  const updateQuotation = async (id: string, updates: Partial<Quotation>) => {
    try {
      const res = await fetch('/api/quotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error || 'Failed to update quotation' };
      refetch();
      return { data: json.data, error: undefined };
    } catch (e: any) {
      return { error: e?.message || 'Network error while updating quotation' };
    }
  };

  const saveQuotationItems = async (quotationId: string, items: any[]) => {
    try {
      const res = await fetch('/api/quotations/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotationId, items }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error || 'Failed to save quotation items' };
      refetch();
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Network error while saving items' };
    }
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
// CMYK EXPENSES HOOK
// =============================================
export function useCMYKExpenses() {
  const { data, loading, error, refetch } = useSupabaseQuery<import('@/types/database').CMYKExpense>('cmyk_expenses', {
    orderBy: { column: 'expense_date', ascending: false }
  });

  const createExpense = async (expense: Omit<import('@/types/database').CMYKExpense, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { data, error } = await supabase.from('cmyk_expenses').insert([expense]).select().single();
    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updateExpense = async (id: string, updates: Partial<import('@/types/database').CMYKExpense>) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { data, error } = await supabase.from('cmyk_expenses').update(updates).eq('id', id).select().single();
    if (!error) refetch();
    return { data, error: error?.message };
  };

  const deleteExpense = async (id: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { error } = await supabase.from('cmyk_expenses').delete().eq('id', id);
    if (!error) refetch();
    return { error: error?.message };
  };

  return { expenses: data, loading, error, refetch, createExpense, updateExpense, deleteExpense };
}

// =============================================
// CMYK MONTHLY OVERVIEW HOOK
// =============================================
export function useCMYKMonthlyOverview(year: number, month: number) {
  const [data, setData] = useState<{
    total_revenue: number;
    pending_revenue: number;
    total_expenses: number;
    paper_cost: number;
    total_transactions: number;
    sheets_used: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const { data: result, error: err } = await supabase.rpc('get_cmyk_monthly_overview', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      if (err) throw err;
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [year, month]);

  return { overview: data, loading, error, refetch: fetch };
}

// =============================================
// CMYK JOB LOGS HOOK
// =============================================
export function useCMYKJobLogs(limit?: number) {
  const { data, loading, error, refetch } = useSupabaseQuery<import('@/types/database').CMYKJobLog>('cmyk_job_logs', {
    orderBy: { column: 'created_at', ascending: false },
    ...(limit ? { filter: [] } : {})
  });

  const completeJob = async (
    jobId: string,
    paperStockId: string,
    sheetsUsed: number,
    operatorId: string,
    operatorName: string,
    notes?: string
  ) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { data, error } = await supabase.rpc('complete_cmyk_print_job', {
      p_job_id: jobId,
      p_paper_stock_id: paperStockId,
      p_sheets_used: sheetsUsed,
      p_operator_id: operatorId,
      p_operator_name: operatorName,
      p_notes: notes || null
    });
    if (!error) refetch();
    return { data, error: error?.message };
  };

  const logs = limit ? (data || []).slice(0, limit) : data;
  return { logs: logs || [], loading, error, refetch, completeJob };
}

// =============================================
// CMYK PAPER PURCHASES HOOK
// =============================================
export function useCMYKPaperPurchases() {
  const { data, loading, error, refetch } = useSupabaseQuery<import('@/types/database').CMYKPaperPurchase>('cmyk_paper_purchases', {
    orderBy: { column: 'purchase_date', ascending: false }
  });

  const recordPurchase = async (purchase: {
    purchase_date: string;
    vendor_id?: string;
    vendor_name?: string;
    paper_stock_id: string;
    quantity: number;
    rate: number;
    gst_percent?: number;
    invoice_number?: string;
    notes?: string;
    created_by?: string;
  }) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const { data, error } = await supabase.rpc('record_paper_purchase', {
      p_purchase_date: purchase.purchase_date,
      p_vendor_id: purchase.vendor_id || null,
      p_vendor_name: purchase.vendor_name || null,
      p_paper_stock_id: purchase.paper_stock_id,
      p_quantity: purchase.quantity,
      p_rate: purchase.rate,
      p_gst_percent: purchase.gst_percent || 0,
      p_invoice_number: purchase.invoice_number || null,
      p_notes: purchase.notes || null,
      p_created_by: purchase.created_by || null
    });
    if (!error) refetch();
    return { data, error: error?.message };
  };

  const updatePayment = async (id: string, amountPaid: number, grandTotal: number) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    const newStatus = amountPaid >= grandTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';
    const { data, error } = await supabase
      .from('cmyk_paper_purchases')
      .update({ amount_paid: amountPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (!error) refetch();
    return { data, error: error?.message };
  };

  return { purchases: data || [], loading, error, refetch, recordPurchase, updatePayment };
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
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('activity_logs')
        .select(`
          id, action, entity_type, entity_id, description, metadata,
          created_at, ip_address,
          profiles ( full_name, role )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (err) { setError(err.message); }
      else {
        // Map profiles.full_name → user_name for activity page compatibility
        setLogs((data || []).map((l: any) => ({
          ...l,
          user_name: l.profiles?.full_name || null,
        })));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
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

    // The DB table stores start_time as a TIMESTAMP, but NewEventModal
    // provides start_date (DATE string) + optional start_time (time string).
    // Map them into a proper ISO timestamp for the DB.
    let startTimestamp: string;
    if (event.start_date) {
      if (event.start_time && !event.all_day) {
        // Combine date + time into ISO timestamp
        startTimestamp = `${event.start_date}T${event.start_time}:00`;
      } else {
        // All-day: use midnight UTC
        startTimestamp = `${event.start_date}T00:00:00`;
      }
    } else if (event.start_time) {
      // Already a full timestamp
      startTimestamp = event.start_time;
    } else {
      startTimestamp = new Date().toISOString();
    }

    const newEvent = {
      user_id: event.user_id,
      title: event.title || '',
      description: event.description,
      event_type: event.event_type || 'task',
      start_time: startTimestamp,
      all_day: event.all_day ?? true,
      priority: event.priority || 'normal',
      color: event.color || '#3b82f6',
      status: event.status || 'pending',
      is_recurring: false,
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

      // Fire-and-forget — don't fail event creation if mentions table is missing
      supabase.from('calendar_event_mentions').insert(mentions).then(({ error }) => {
        if (error) console.warn('Could not create event mentions:', error.message);
      });
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

    // Only show jobs updated in the last 14 days — avoids flooding the EOD form with stale tasks
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*, client:clients(*)')
      .eq('designer_id', currentUserId)
      // Exclude stages beyond design — once a job leaves the design phase it drops off the designer's EOD list
      .not('current_stage', 'in', '(completed,delivered,cancelled,approval,pre_print_qc,printing,finishing,quality_check,ready,dispatched)')
      .gte('updated_at', cutoffStr)
      .order('client_deadline', { ascending: true });

    return { data: jobs || [], error: error?.message };
  };

  // Load the MOST RECENT saved task-update for each job_id across ALL past reports for this user.
  // Used to carry-forward previous-day state so designers don't re-type the same details every morning.
  const loadLastTaskResponsesForUser = async (userId: string, jobIds: string[]): Promise<Record<string, any>> => {
    if (!isSupabaseConfigured() || jobIds.length === 0) return {};

    // Step 1: Get all report IDs for this user (avoids unreliable embedded-filter syntax)
    const { data: reports, error: reportsError } = await supabase
      .from('daily_work_reports')
      .select('id')
      .eq('user_id', userId);

    if (reportsError || !reports || reports.length === 0) return {};
    const reportIds = reports.map((r: any) => r.id);

    // Step 2: Get the most recent task update per job_id across all those reports
    const { data, error } = await supabase
      .from('report_task_updates')
      .select('*')
      .in('report_id', reportIds)
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });

    if (error || !data) return {};

    // Keep only the most recent entry per job_id
    const map: Record<string, any> = {};
    for (const row of data) {
      if (row.job_id && !map[row.job_id]) {
        map[row.job_id] = row;
      }
    }
    return map;
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
      task_status?: string;
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

      // 2. Upsert task updates by (report_id, job_id)
      // This preserves existing rows instead of delete+re-insert,
      // so historical data within a day is kept intact.
      if (reportData.task_updates.length > 0) {
        const { error: updatesError } = await supabase
          .from('report_task_updates')
          .upsert(
            reportData.task_updates.map(update => ({
              report_id: report.id,
              ...update
            })),
            { onConflict: 'report_id,job_id' }
          );

        if (updatesError) {
          // Fallback: if unique constraint doesn't exist yet, use delete+insert
          await supabase.from('report_task_updates').delete().eq('report_id', report.id);
          const { error: insertError } = await supabase
            .from('report_task_updates')
            .insert(reportData.task_updates.map(update => ({ report_id: report.id, ...update })));
          if (insertError) throw insertError;
        }
      }

      // 3. Log activity (fire-and-forget)
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

  // Load previously saved task responses for a report
  // Used to pre-populate the EOD form when the page loads
  const loadTodayTaskResponses = async (reportId: string): Promise<Record<string, any>> => {
    if (!isSupabaseConfigured()) return {};
    const { data, error } = await supabase
      .from('report_task_updates')
      .select('*')
      .eq('report_id', reportId);
    if (error || !data) return {};
    // Return a map keyed by job_id for quick lookup
    const map: Record<string, any> = {};
    for (const row of data) {
      if (row.job_id) map[row.job_id] = row;
    }
    return map;
  };

  // Submit an edit to a PAST EOD entry, logging the change for admin review
  const submitPastEODEdit = async (editData: {
    report_id: string;
    task_update_id: string;
    job_id: string;
    original_date: string;
    user_id: string;
    user_name: string;
    changes: Array<{ field: string; old_value: string | null; new_value: string | null }>;
    updatedFields: Record<string, any>;
  }) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    try {
      // 1. Update the task update row
      const { error: updateError } = await supabase
        .from('report_task_updates')
        .update(editData.updatedFields)
        .eq('id', editData.task_update_id);

      if (updateError) throw updateError;

      // 2. Insert edit log entries (one per changed field)
      if (editData.changes.length > 0) {
        const logRows = editData.changes.map(change => ({
          user_id: editData.user_id,
          report_id: editData.report_id,
          task_update_id: editData.task_update_id,
          original_date: editData.original_date,
          field_changed: change.field,
          old_value: change.old_value,
          new_value: change.new_value,
          user_name: editData.user_name,
          edited_at: new Date().toISOString()
        }));
        await supabase.from('eod_edit_log').insert(logRows);
      }

      refetch();
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'Failed to save edit' };
    }
  };

  // Admin: Fetch the edit audit log
  const getEODEditLog = async (filters?: { userId?: string; since?: string }) => {
    if (!isSupabaseConfigured()) return { data: [], error: null };
    let query = supabase
      .from('eod_edit_log')
      .select('*, profile:profiles!user_id(id, full_name, role)')
      .order('edited_at', { ascending: false })
      .limit(200);
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.since) query = query.gte('edited_at', filters.since);
    const { data, error } = await query;
    return { data: data || [], error: error?.message };
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

  // Admin: Get all team reports (with user profile join to fix 'Unknown' names)
  const getAllReports = async (filters?: { userId?: string; startDate?: string; endDate?: string; searchQuery?: string }) => {
    if (!isSupabaseConfigured()) return { data: [], error: null };

    let query = supabase
      .from('daily_work_reports')
      .select(`
        *,
        user:profiles(id, full_name, role, email),
        task_updates:report_task_updates(*, job:jobs(*, client:clients(*)))
      `)
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

  // Admin: Rate an EOD report (1-5 stars + optional comment)
  const rateReport = async (reportId: string, rating: number, comment?: string) => {
    if (!isSupabaseConfigured()) return { error: 'Database not configured' };
    try {
      const { data, error } = await supabase
        .from('daily_work_reports')
        .update({
          admin_rating: rating,
          admin_comment: comment || null,
          admin_rated_at: new Date().toISOString(),
          admin_rated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', reportId)
        .select()
        .single();
      if (error) throw error;
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
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

    // Get all active users from profiles table
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, role');

    if (usersError || !users) return { data: [], error: usersError?.message };


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
    fetchProductChecklist,
    rateReport,
    loadTodayTaskResponses,
    loadLastTaskResponsesForUser,
    submitPastEODEdit,
    getEODEditLog
  };
}

// NOTE: Old useCommissions (referencing separate 'commissions' table) removed.
// Commission data now lives directly on the jobs table via commission_* columns.
// See useCommissions() at the bottom of this file.



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

// NOTE: useUserNotes removed — user_notes table was dropped.
// Dashboard sticky notes use useDashboardNotes() → notes table instead.

// =============================================
// COMMISSION HOOK
// Reads commission data directly from jobs table — no separate table.
// commission_status: 'none' | 'eligible' | 'approved' | 'paid'
// =============================================
export function useCommissions(filterUserId?: string) {
  const { profile } = useAuth();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingCount: 0, pendingAmount: 0,
    approvedCount: 0, approvedAmount: 0,
    paidCount: 0, paidAmount: 0,
    thisMonthAmount: 0,
  });

  const fetchCommissions = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    const userId = filterUserId || (profile?.role === 'marketing' ? profile.id : null);

    let query = supabase
      .from('jobs')
      .select(`
        id, job_number, project_name, total_amount, amount_received,
        commission_user_id, commission_percentage, commission_amount,
        commission_status, commission_paid_at, created_at, gst_percentage,
        commission_user:profiles!commission_user_id(id, full_name, commission_rate),
        client:clients(name, company)
      `)
      .neq('commission_status', 'none')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('commission_user_id', userId);

    const { data, error } = await query;
    if (error) { console.error('Commission fetch error:', error); setLoading(false); return; }

    const jobs = data || [];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    setStats({
      pendingCount: jobs.filter(j => j.commission_status === 'eligible').length,
      pendingAmount: jobs.filter(j => j.commission_status === 'eligible').reduce((s, j) => s + (j.commission_amount || 0), 0),
      approvedCount: jobs.filter(j => j.commission_status === 'approved').length,
      approvedAmount: jobs.filter(j => j.commission_status === 'approved').reduce((s, j) => s + (j.commission_amount || 0), 0),
      paidCount: jobs.filter(j => j.commission_status === 'paid').length,
      paidAmount: jobs.filter(j => j.commission_status === 'paid').reduce((s, j) => s + (j.commission_amount || 0), 0),
      thisMonthAmount: jobs
        .filter(j => j.commission_status !== 'none' && j.created_at >= monthStart)
        .reduce((s, j) => s + (j.commission_amount || 0), 0),
    });

    setCommissions(jobs);
    setLoading(false);
  }, [profile?.id, profile?.role, filterUserId]);

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);

  // Admin: approve — set final % and recalculate amount
  const approveCommission = async (jobId: string, commissionPercentage: number, gstPercentage: number = 18) => {
    if (!isSupabaseConfigured()) return { error: 'DB not configured' };
    const { data: job } = await supabase.from('jobs').select('total_amount').eq('id', jobId).single();
    if (!job) return { error: 'Job not found' };
    const gstAmt = (job.total_amount * gstPercentage) / (100 + gstPercentage);
    const base = job.total_amount - gstAmt;
    const commissionAmount = parseFloat(((base * commissionPercentage) / 100).toFixed(2));
    const { error } = await supabase.from('jobs').update({
      commission_percentage: commissionPercentage,
      commission_amount: commissionAmount,
      commission_status: 'approved',
    }).eq('id', jobId);
    if (!error) fetchCommissions();
    return { error: error?.message };
  };

  // Admin: mark as physically paid out
  const markCommissionPaid = async (jobId: string) => {
    if (!isSupabaseConfigured()) return { error: 'DB not configured' };
    const { error } = await supabase.from('jobs').update({
      commission_status: 'paid',
      commission_paid_at: new Date().toISOString(),
    }).eq('id', jobId);
    if (!error) fetchCommissions();
    return { error: error?.message };
  };

  return { commissions, loading, stats, approveCommission, markCommissionPaid, refetch: fetchCommissions };
}

// Call this when a job becomes fully paid (amount_received >= total_amount)
// Auto-sets commission_status = 'eligible' if a marketing person is linked
export async function autoSetCommissionEligible(jobId: string) {
  if (!isSupabaseConfigured()) return;
  const { data: job } = await supabase
    .from('jobs')
    .select('commission_user_id, commission_status, total_amount, gst_percentage, client_id')
    .eq('id', jobId)
    .single();
  if (!job || job.commission_status !== 'none') return;

  let marketingUserId = job.commission_user_id;
  if (!marketingUserId && job.client_id) {
    const { data: client } = await supabase.from('clients').select('assigned_marketing_user_id').eq('id', job.client_id).single();
    marketingUserId = client?.assigned_marketing_user_id;
  }
  if (!marketingUserId) return;

  const { data: marketer } = await supabase.from('profiles').select('commission_rate').eq('id', marketingUserId).single();
  const gstPct = job.gst_percentage || 18;
  const gstAmt = (job.total_amount * gstPct) / (100 + gstPct);
  const base = job.total_amount - gstAmt;
  const rate = marketer?.commission_rate || 5;
  const commissionAmount = parseFloat(((base * rate) / 100).toFixed(2));

  await supabase.from('jobs').update({
    commission_user_id: marketingUserId,
    commission_percentage: rate,
    commission_amount: commissionAmount,
    commission_status: 'eligible',
  }).eq('id', jobId);
}

// =============================================
// WORK LOGS HOOK
// Fetches auto-captured work activity for a user/date.
// Used to pre-populate the EOD report.
// =============================================
export function useWorkLogs(userId?: string, date?: string) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const targetUser = userId || profile?.id;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const fetchLogs = useCallback(async () => {
    if (!targetUser || !isSupabaseConfigured()) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('work_logs')
      .select('*')
      .eq('user_id', targetUser)
      .eq('log_date', targetDate)
      .order('created_at', { ascending: true });

    if (!error) setLogs(data || []);
    setLoading(false);
  }, [targetUser, targetDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Build a ready-to-use summary string for the EOD "what did you do today" field
  const todaySummary = logs.length > 0
    ? logs.map((l, i) => `${i + 1}. ${l.description}`).join('\n')
    : '';

  return { logs, loading, todaySummary, refetch: fetchLogs };
}
