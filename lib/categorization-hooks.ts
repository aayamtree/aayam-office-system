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

export interface TransactionCategorization {
    categorization_type: 'expense' | 'income';
    expense_category_id?: string;
    income_category_id?: string;
    expense_type?: 'goods' | 'services';
    payment_method?: string;
    categorization_notes?: string;
    transaction_date?: string;
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
            // Check if category already exists (case-insensitive)
            const { data: existing } = await supabase
                .from('expense_categories')
                .select('*')
                .ilike('name', trimmedName)
                .maybeSingle();

            if (existing) {
                // If it exists but was deactivated, reactivate it
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

    const getParentCategories = () => {
        return categories.filter(cat => !cat.parent_id);
    };

    const getSubcategories = (parentId: string) => {
        return categories.filter(cat => cat.parent_id === parentId);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    return {
        categories,
        loading,
        error,
        refetch: fetchCategories,
        createCategory,
        getParentCategories,
        getSubcategories
    };
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
            // Check if category already exists (case-insensitive)
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

    const getParentCategories = () => {
        return categories.filter(cat => !cat.parent_id);
    };

    const getSubcategories = (parentId: string) => {
        return categories.filter(cat => cat.parent_id === parentId);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    return {
        categories,
        loading,
        error,
        refetch: fetchCategories,
        createCategory,
        getParentCategories,
        getSubcategories
    };
}

// =====================================================
// TRANSACTION CATEGORIZATION HOOK (with Double-Entry)
// =====================================================

/**
 * Helper: Create a double-entry journal entry when a bank transaction is verified.
 * - Expense (outflow): Debit Expense Account, Credit Bank Account
 * - Income (inflow):   Debit Bank Account, Credit Income Account
 */
async function createJournalEntryForTransaction(
    transactionId: string,
    bankAccountId: string,
    categorization: TransactionCategorization,
    amount: number,
    transactionType: string, // 'inflow' | 'outflow'
    transactionDate: string,
    description: string,
    userId: string
): Promise<{ error: string | null }> {
    try {
        // 1. Find the COA account for the bank
        const { data: bankCoa } = await supabase
            .from('chart_of_accounts')
            .select('id, name')
            .eq('linked_bank_account_id', bankAccountId)
            .single();

        if (!bankCoa) {
            console.warn('No COA entry found for bank account', bankAccountId);
            return { error: null }; // Don't block categorization if COA not set up
        }

        // 2. Find the COA account for the category
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

        if (!categoryCoa) {
            console.warn('No COA entry found for category');
            return { error: null }; // Don't block categorization
        }

        // 3. Generate journal entry number
        const { data: entryNumData } = await supabase.rpc('generate_journal_entry_number');
        const entryNumber = entryNumData || `JE-${Date.now()}`;

        // 4. Create the journal entry
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

        // 5. Create journal entry lines (double-entry)
        let lines: any[] = [];

        if (categorization.categorization_type === 'expense') {
            // Expense (outflow): Debit Expense, Credit Bank
            lines = [
                {
                    journal_entry_id: journalEntry.id,
                    account_id: categoryCoa.id,
                    debit_amount: amount,
                    credit_amount: 0,
                    description: `${categoryCoa.name} — ${description}`,
                },
                {
                    journal_entry_id: journalEntry.id,
                    account_id: bankCoa.id,
                    debit_amount: 0,
                    credit_amount: amount,
                    description: `Payment from ${bankCoa.name}`,
                }
            ];
        } else {
            // Income (inflow): Debit Bank, Credit Income
            lines = [
                {
                    journal_entry_id: journalEntry.id,
                    account_id: bankCoa.id,
                    debit_amount: amount,
                    credit_amount: 0,
                    description: `Received into ${bankCoa.name}`,
                },
                {
                    journal_entry_id: journalEntry.id,
                    account_id: categoryCoa.id,
                    debit_amount: 0,
                    credit_amount: amount,
                    description: `${categoryCoa.name} — ${description}`,
                }
            ];
        }

        const { error: linesError } = await supabase
            .from('journal_entry_lines')
            .insert(lines);

        if (linesError) throw linesError;

        // 6. Update bank_accounts.current_balance
        // Outflow (expense) = decrease, Inflow (income) = increase
        const balanceChange = transactionType === 'outflow' ? -amount : amount;
        await supabase.rpc('update_bank_balance_delta', {
            p_bank_account_id: bankAccountId,
            p_delta: balanceChange
        }).then(res => {
            // If RPC doesn't exist, fall back to direct update
            if (res.error) {
                return supabase
                    .from('bank_accounts')
                    .select('current_balance')
                    .eq('id', bankAccountId)
                    .single()
                    .then(({ data: ba }) => {
                        if (ba) {
                            return supabase
                                .from('bank_accounts')
                                .update({ current_balance: (ba.current_balance || 0) + balanceChange })
                                .eq('id', bankAccountId);
                        }
                    });
            }
        });

        return { error: null };
    } catch (err: any) {
        console.error('Error creating journal entry:', err);
        return { error: err.message };
    }
}

/**
 * Helper: Delete journal entry and reverse balance when uncategorizing
 */
async function deleteJournalEntryForTransaction(
    transactionId: string
): Promise<{ error: string | null }> {
    try {
        // Find the journal entry linked to this transaction
        const { data: journalEntry } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('source_type', 'bank_transaction')
            .eq('source_id', transactionId)
            .maybeSingle();

        if (!journalEntry) return { error: null }; // No journal entry to delete

        // The COA balance trigger will auto-reverse when lines are deleted
        // Delete the journal entry (cascade deletes lines)
        const { error } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', journalEntry.id);

        if (error) throw error;

        return { error: null };
    } catch (err: any) {
        console.error('Error deleting journal entry:', err);
        return { error: err.message };
    }
}

export function useTransactionCategorization() {
    const [saving, setSaving] = useState(false);

    const categorizeTransaction = async (
        transactionId: string,
        categorization: TransactionCategorization
    ) => {
        try {
            setSaving(true);

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Get the transaction details (needed for journal entry)
            const { data: txn } = await supabase
                .from('bank_transactions')
                .select('bank_account_id, amount, transaction_type, transaction_date, description')
                .eq('id', transactionId)
                .single();

            if (!txn) throw new Error('Transaction not found');

            // First, delete any existing journal entry for this transaction (handles re-categorization)
            await deleteJournalEntryForTransaction(transactionId);

            // Update transaction with categorization
            const updateData: any = {
                categorization_type: categorization.categorization_type,
                payment_method: categorization.payment_method,
                categorization_notes: categorization.categorization_notes,
                is_verified: true,
                verified_by: user.id,
                verified_at: new Date().toISOString(),
            };

            // Add transaction date if provided
            if (categorization.transaction_date) {
                updateData.transaction_date = categorization.transaction_date;
            }

            // Add category based on type
            if (categorization.categorization_type === 'expense') {
                updateData.expense_category_id = categorization.expense_category_id;
                updateData.expense_type = categorization.expense_type;
                updateData.income_category_id = null;
            } else {
                updateData.income_category_id = categorization.income_category_id;
                updateData.expense_category_id = null;
                updateData.expense_type = null;
            }

            const { error: updateError } = await supabase
                .from('bank_transactions')
                .update(updateData)
                .eq('id', transactionId);

            if (updateError) throw updateError;

            // ── Double-Entry: Create journal entry ──
            const txnDate = categorization.transaction_date || txn.transaction_date;
            const journalResult = await createJournalEntryForTransaction(
                transactionId,
                txn.bank_account_id,
                categorization,
                txn.amount,
                txn.transaction_type,
                txnDate,
                txn.description || 'Bank transaction',
                user.id
            );

            if (journalResult.error) {
                console.warn('Journal entry creation failed (non-blocking):', journalResult.error);
            }

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

            // ── Double-Entry: Delete journal entry first ──
            // Get transaction to know the bank account for balance reversal
            const { data: txn } = await supabase
                .from('bank_transactions')
                .select('bank_account_id, amount, transaction_type')
                .eq('id', transactionId)
                .single();

            // Delete journal entry (COA balance auto-reverses via trigger)
            await deleteJournalEntryForTransaction(transactionId);

            // Reverse bank_accounts.current_balance
            if (txn) {
                const reverseChange = txn.transaction_type === 'outflow' ? txn.amount : -txn.amount;
                const { data: ba } = await supabase
                    .from('bank_accounts')
                    .select('current_balance')
                    .eq('id', txn.bank_account_id)
                    .single();

                if (ba) {
                    await supabase
                        .from('bank_accounts')
                        .update({ current_balance: (ba.current_balance || 0) + reverseChange })
                        .eq('id', txn.bank_account_id);
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

    return {
        categorizeTransaction,
        uncategorizeTransaction,
        saving
    };
}
