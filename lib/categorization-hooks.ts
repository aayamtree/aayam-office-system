/**
 * Transaction Categorization Hooks
 * Manages expense/income categories and transaction categorization
 */

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// =====================================================
// TYPES
// =====================================================
export interface ExpenseCategory {
    id: string;
    name: string;
    description: string | null;
    parent_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface IncomeCategory {
    id: string;
    name: string;
    description: string | null;
    parent_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface InvoiceAllocation {
    invoice_id: string;
    amount: number;
}

export interface BillAllocation {
    bill_id: string;
    amount: number;
}

export interface TransactionCategorization {
    categorization_type: 'expense' | 'income';
    expense_category_id?: string;
    income_category_id?: string;
    expense_type?: 'goods' | 'services';
    payment_method?: string;
    categorization_notes?: string;
    transaction_date?: string;
    // Client payment linking (income — Customer Payment / Customer Advance)
    client_id?: string;
    invoice_allocations?: InvoiceAllocation[];
    // Vendor payment linking (expense — Vendor Payment / Vendor Advance)
    vendor_id?: string;
    bill_allocations?: BillAllocation[];
    // Direct expense (salary, rent, utilities etc. — no vendor/bill needed)
    payee_name?: string;
}

// =====================================================
// EXPENSE CATEGORIES HOOK
// =====================================================
export function useExpenseCategories() {
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('expense_categories')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (fetchError) throw fetchError;
            setCategories(data || []);
            setError(null);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching expense categories:', err);
        } finally {
            setLoading(false);
        }
    };

    const createCategory = async (name: string, description?: string, parentId?: string) => {
        try {
            const trimmedName = name.trim();
            const { data: existing } = await supabase
                .from('expense_categories')
                .select('*')
                .ilike('name', trimmedName)
                .maybeSingle();

            if (existing) {
                if (!existing.is_active) {
                    await supabase.from('expense_categories').update({ is_active: true }).eq('id', existing.id);
                    await fetchCategories();
                }
                return { data: existing, error: null };
            }

            const { data, error: createError } = await supabase
                .from('expense_categories')
                .insert([{ name: trimmedName, description, parent_id: parentId }])
                .select()
                .single();

            if (createError) throw createError;
            await fetchCategories();
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    };

    const getParentCategories = () => categories.filter(cat => !cat.parent_id);
    const getSubcategories = (parentId: string) => categories.filter(cat => cat.parent_id === parentId);

    useEffect(() => { fetchCategories(); }, []);

    return { categories, loading, error, refetch: fetchCategories, createCategory, getParentCategories, getSubcategories };
}

// =====================================================
// INCOME CATEGORIES HOOK
// =====================================================
export function useIncomeCategories() {
    const [categories, setCategories] = useState<IncomeCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('income_categories')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (fetchError) throw fetchError;
            setCategories(data || []);
            setError(null);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching income categories:', err);
        } finally {
            setLoading(false);
        }
    };

    const createCategory = async (name: string, description?: string, parentId?: string) => {
        try {
            const trimmedName = name.trim();
            const { data: existing } = await supabase
                .from('income_categories')
                .select('*')
                .ilike('name', trimmedName)
                .maybeSingle();

            if (existing) {
                if (!existing.is_active) {
                    await supabase.from('income_categories').update({ is_active: true }).eq('id', existing.id);
                    await fetchCategories();
                }
                return { data: existing, error: null };
            }

            const { data, error: createError } = await supabase
                .from('income_categories')
                .insert([{ name: trimmedName, description, parent_id: parentId }])
                .select()
                .single();

            if (createError) throw createError;
            await fetchCategories();
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    };

    const getParentCategories = () => categories.filter(cat => !cat.parent_id);
    const getSubcategories = (parentId: string) => categories.filter(cat => cat.parent_id === parentId);

    useEffect(() => { fetchCategories(); }, []);

    return { categories, loading, error, refetch: fetchCategories, createCategory, getParentCategories, getSubcategories };
}

// =====================================================
// DOUBLE-ENTRY JOURNAL ENTRY HELPER
// =====================================================
async function createJournalEntryForTransaction(
    transactionId: string,
    bankAccountId: string,
    categorization: TransactionCategorization,
    amount: number,
    transactionType: string,
    transactionDate: string,
    description: string,
    userId: string
): Promise<{ error: string | null }> {
    try {
        const { data: bankCoa } = await supabase
            .from('chart_of_accounts')
            .select('id, name')
            .eq('linked_bank_account_id', bankAccountId)
            .single();

        if (!bankCoa) return { error: null };

        let categoryCoa: { id: string; name: string } | null = null;
        if (categorization.categorization_type === 'expense' && categorization.expense_category_id) {
            const { data } = await supabase
                .from('chart_of_accounts')
                .select('id, name')
                .eq('linked_expense_category_id', categorization.expense_category_id)
                .single();
            categoryCoa = data;
        } else if (categorization.categorization_type === 'income' && categorization.income_category_id) {
            const { data } = await supabase
                .from('chart_of_accounts')
                .select('id, name')
                .eq('linked_income_category_id', categorization.income_category_id)
                .single();
            categoryCoa = data;
        }

        if (!categoryCoa) return { error: null };

        const { data: entryNumData } = await supabase.rpc('generate_journal_entry_number');
        const entryNumber = entryNumData || `JE-${Date.now()}`;

        const { data: journalEntry, error: jeError } = await supabase
            .from('journal_entries')
            .insert([{
                entry_number: entryNumber,
                entry_date: transactionDate,
                description: `${categorization.categorization_type === 'expense' ? 'Paid' : 'Received'}: ${description}`,
                source_type: 'bank_transaction',
                source_id: transactionId,
                is_posted: true,
                created_by: userId,
            }])
            .select()
            .single();

        if (jeError) throw jeError;

        let lines: any[] = [];
        if (categorization.categorization_type === 'expense') {
            lines = [
                { journal_entry_id: journalEntry.id, account_id: categoryCoa.id, debit_amount: amount, credit_amount: 0, description: `${categoryCoa.name} — ${description}` },
                { journal_entry_id: journalEntry.id, account_id: bankCoa.id, debit_amount: 0, credit_amount: amount, description: `Payment from ${bankCoa.name}` }
            ];
        } else {
            lines = [
                { journal_entry_id: journalEntry.id, account_id: bankCoa.id, debit_amount: amount, credit_amount: 0, description: `Received into ${bankCoa.name}` },
                { journal_entry_id: journalEntry.id, account_id: categoryCoa.id, debit_amount: 0, credit_amount: amount, description: `${categoryCoa.name} — ${description}` }
            ];
        }

        const { error: linesError } = await supabase.from('journal_entry_lines').insert(lines);
        if (linesError) throw linesError;

        const balanceChange = transactionType === 'outflow' ? -amount : amount;
        await supabase.rpc('update_bank_balance_delta', { p_bank_account_id: bankAccountId, p_delta: balanceChange })
            .then(res => {
                if (res.error) {
                    return supabase.from('bank_accounts').select('current_balance').eq('id', bankAccountId).single()
                        .then(({ data: ba }) => {
                            if (ba) return supabase.from('bank_accounts').update({ current_balance: (ba.current_balance || 0) + balanceChange }).eq('id', bankAccountId);
                        });
                }
            });

        return { error: null };
    } catch (err: any) {
        console.error('Error creating journal entry:', err);
        return { error: err.message };
    }
}

async function deleteJournalEntryForTransaction(transactionId: string): Promise<{ error: string | null }> {
    try {
        const { data: journalEntry } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('source_type', 'bank_transaction')
            .eq('source_id', transactionId)
            .maybeSingle();

        if (!journalEntry) return { error: null };

        const { error } = await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
        if (error) throw error;
        return { error: null };
    } catch (err: any) {
        return { error: err.message };
    }
}

// =====================================================
// CLIENT PAYMENT ALLOCATION
// Applies bank transaction amount to client invoices
// Uses reference_number = 'BT:<txn_id>' to link back
// =====================================================
async function applyClientPaymentAllocations(
    bankTransactionId: string,
    clientId: string,
    allocations: InvoiceAllocation[],
    paymentMethod: string,
    paymentDate: string,
    bankAccountId: string,
    userId: string,
    notes?: string
): Promise<void> {
    // Remove any previous payment records for this bank transaction (re-categorization)
    await supabase.from('payments_received').delete().eq('reference_number', `BT:${bankTransactionId}`);

    for (const alloc of allocations) {
        if (alloc.amount <= 0) continue;

        const { data: invoice } = await supabase
            .from('invoices')
            .select('id, amount_paid, balance_due, total_amount, payment_status')
            .eq('id', alloc.invoice_id)
            .single();

        if (!invoice) continue;

        const payNum = `PMT-BT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        await supabase.from('payments_received').insert([{
            payment_number: payNum,
            client_id: clientId,
            invoice_id: alloc.invoice_id,
            amount: alloc.amount,
            payment_mode: paymentMethod,
            payment_date: paymentDate,
            bank_account_id: bankAccountId,
            reference_number: `BT:${bankTransactionId}`,
            notes: notes || null,
            received_by: userId,
        }]);

        const newAmountPaid = Number(invoice.amount_paid || 0) + alloc.amount;
        const newBalanceDue = Math.max(0, Number(invoice.total_amount) - newAmountPaid);
        const newStatus: 'pending' | 'partial' | 'paid' =
            newBalanceDue <= 0 ? 'paid' : newAmountPaid <= 0 ? 'pending' : 'partial';

        await supabase.from('invoices').update({
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            payment_status: newStatus,
        }).eq('id', alloc.invoice_id);
    }
}

// =====================================================
// VENDOR PAYMENT ALLOCATION
// Applies bank transaction amount to vendor purchase bills
// Uses reference_number = 'BT:<txn_id>' to link back
// =====================================================
async function applyVendorPaymentAllocations(
    bankTransactionId: string,
    vendorId: string,
    allocations: BillAllocation[],
    paymentMethod: string,
    paymentDate: string,
    bankAccountId: string,
    userId: string,
    notes?: string
): Promise<void> {
    // Remove any previous vendor payment records for this bank transaction
    await supabase.from('vendor_payments').delete().eq('reference_number', `BT:${bankTransactionId}`);

    for (const alloc of allocations) {
        if (alloc.amount <= 0) continue;

        const { data: bill } = await supabase
            .from('purchase_bills')
            .select('id, amount_paid, total_amount, payment_status')
            .eq('id', alloc.bill_id)
            .single();

        if (!bill) continue;

        const payNum = `VP-BT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        await supabase.from('vendor_payments').insert([{
            payment_number: payNum,
            vendor_id: vendorId,
            purchase_bill_id: alloc.bill_id,
            amount: alloc.amount,
            payment_mode: paymentMethod,
            payment_date: paymentDate,
            bank_account_id: bankAccountId,
            reference_number: `BT:${bankTransactionId}`,
            notes: notes || null,
            paid_by: userId,
        }]);

        const newAmountPaid = Number(bill.amount_paid || 0) + alloc.amount;
        const newStatus: 'pending' | 'partial' | 'paid' =
            newAmountPaid >= Number(bill.total_amount) ? 'paid' : newAmountPaid <= 0 ? 'pending' : 'partial';

        await supabase.from('purchase_bills').update({
            amount_paid: newAmountPaid,
            payment_status: newStatus,
        }).eq('id', alloc.bill_id);
    }
}

// =====================================================
// MAIN HOOK: CATEGORIZE / UNCATEGORIZE
// =====================================================
export function useTransactionCategorization() {
    const [saving, setSaving] = useState(false);

    const categorizeTransaction = async (
        transactionId: string,
        categorization: TransactionCategorization
    ) => {
        try {
            setSaving(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const { data: txn } = await supabase
                .from('bank_transactions')
                .select('bank_account_id, amount, transaction_type, transaction_date, description')
                .eq('id', transactionId)
                .single();

            if (!txn) throw new Error('Transaction not found');

            // Delete any existing journal entry (handles re-categorization)
            await deleteJournalEntryForTransaction(transactionId);

            const updateData: any = {
                categorization_type: categorization.categorization_type,
                payment_method: categorization.payment_method,
                categorization_notes: categorization.categorization_notes,
                is_verified: true,
                verified_by: user.id,
                verified_at: new Date().toISOString(),
            };

            if (categorization.transaction_date) {
                updateData.transaction_date = categorization.transaction_date;
            }

            if (categorization.categorization_type === 'expense') {
                updateData.expense_category_id = categorization.expense_category_id;
                updateData.expense_type = categorization.expense_type;
                updateData.income_category_id = null;
                updateData.client_id = null;
                updateData.vendor_id = categorization.vendor_id || null;
                updateData.payee_name = categorization.payee_name || null;
            } else {
                updateData.income_category_id = categorization.income_category_id;
                updateData.expense_category_id = null;
                updateData.expense_type = null;
                updateData.client_id = categorization.client_id || null;
                updateData.vendor_id = null;
            }

            const { error: updateError } = await supabase
                .from('bank_transactions')
                .update(updateData)
                .eq('id', transactionId);

            if (updateError) throw updateError;

            // ── CLIENT PAYMENT: apply invoice allocations ──
            if (
                categorization.categorization_type === 'income' &&
                categorization.client_id &&
                categorization.invoice_allocations &&
                categorization.invoice_allocations.length > 0
            ) {
                await applyClientPaymentAllocations(
                    transactionId,
                    categorization.client_id,
                    categorization.invoice_allocations,
                    categorization.payment_method || 'bank_transfer',
                    categorization.transaction_date || txn.transaction_date,
                    txn.bank_account_id,
                    user.id,
                    categorization.categorization_notes
                );
            }

            // ── VENDOR PAYMENT: apply bill allocations ──
            if (
                categorization.categorization_type === 'expense' &&
                categorization.vendor_id &&
                categorization.bill_allocations &&
                categorization.bill_allocations.length > 0
            ) {
                await applyVendorPaymentAllocations(
                    transactionId,
                    categorization.vendor_id,
                    categorization.bill_allocations,
                    categorization.payment_method || 'bank_transfer',
                    categorization.transaction_date || txn.transaction_date,
                    txn.bank_account_id,
                    user.id,
                    categorization.categorization_notes
                );
            }

            // ── Double-Entry Journal ──
            const txnDate = categorization.transaction_date || txn.transaction_date;
            await createJournalEntryForTransaction(
                transactionId,
                txn.bank_account_id,
                categorization,
                txn.amount,
                txn.transaction_type,
                txnDate,
                txn.description || 'Bank transaction',
                user.id
            );

            return { error: null };
        } catch (err: any) {
            console.error('Error categorizing transaction:', err);
            return { error: err.message };
        } finally {
            setSaving(false);
        }
    };

    const uncategorizeTransaction = async (transactionId: string) => {
        try {
            setSaving(true);

            // ── Reverse client payment allocations ──
            const { data: linkedPayments } = await supabase
                .from('payments_received')
                .select('id, invoice_id, amount')
                .eq('reference_number', `BT:${transactionId}`);

            if (linkedPayments && linkedPayments.length > 0) {
                for (const pmt of linkedPayments) {
                    if (!pmt.invoice_id) continue;
                    const { data: inv } = await supabase
                        .from('invoices')
                        .select('amount_paid, total_amount')
                        .eq('id', pmt.invoice_id)
                        .single();
                    if (inv) {
                        const newAmountPaid = Math.max(0, Number(inv.amount_paid) - pmt.amount);
                        const newBalanceDue = Math.max(0, Number(inv.total_amount) - newAmountPaid);
                        await supabase.from('invoices').update({
                            amount_paid: newAmountPaid,
                            balance_due: newBalanceDue,
                            payment_status: newAmountPaid <= 0 ? 'pending' : 'partial',
                        }).eq('id', pmt.invoice_id);
                    }
                }
                await supabase.from('payments_received').delete().eq('reference_number', `BT:${transactionId}`);
            }

            // ── Reverse vendor payment allocations ──
            const { data: linkedVendorPayments } = await supabase
                .from('vendor_payments')
                .select('id, purchase_bill_id, amount')
                .eq('reference_number', `BT:${transactionId}`);

            if (linkedVendorPayments && linkedVendorPayments.length > 0) {
                for (const pmt of linkedVendorPayments) {
                    if (!pmt.purchase_bill_id) continue;
                    const { data: bill } = await supabase
                        .from('purchase_bills')
                        .select('amount_paid, total_amount')
                        .eq('id', pmt.purchase_bill_id)
                        .single();
                    if (bill) {
                        const newAmountPaid = Math.max(0, Number(bill.amount_paid) - pmt.amount);
                        await supabase.from('purchase_bills').update({
                            amount_paid: newAmountPaid,
                            payment_status: newAmountPaid <= 0 ? 'pending' : 'partial',
                        }).eq('id', pmt.purchase_bill_id);
                    }
                }
                await supabase.from('vendor_payments').delete().eq('reference_number', `BT:${transactionId}`);
            }

            // ── Delete journal entry ──
            const { data: txn } = await supabase
                .from('bank_transactions')
                .select('bank_account_id, amount, transaction_type')
                .eq('id', transactionId)
                .single();

            await deleteJournalEntryForTransaction(transactionId);

            if (txn) {
                const reverseChange = txn.transaction_type === 'outflow' ? txn.amount : -txn.amount;
                const { data: ba } = await supabase.from('bank_accounts').select('current_balance').eq('id', txn.bank_account_id).single();
                if (ba) {
                    await supabase.from('bank_accounts').update({ current_balance: (ba.current_balance || 0) + reverseChange }).eq('id', txn.bank_account_id);
                }
            }

            const { error: updateError } = await supabase
                .from('bank_transactions')
                .update({
                    categorization_type: null,
                    expense_category_id: null,
                    income_category_id: null,
                    expense_type: null,
                    payment_method: null,
                    categorization_notes: null,
                    client_id: null,
                    vendor_id: null,
                    payee_name: null,
                    is_verified: false,
                    verified_by: null,
                    verified_at: null,
                })
                .eq('id', transactionId);

            if (updateError) throw updateError;

            return { error: null };
        } catch (err: any) {
            console.error('Error uncategorizing transaction:', err);
            return { error: err.message };
        } finally {
            setSaving(false);
        }
    };

    return { categorizeTransaction, uncategorizeTransaction, saving };
}
