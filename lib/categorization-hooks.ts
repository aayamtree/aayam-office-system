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
// TRANSACTION CATEGORIZATION HOOK
// =====================================================
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
                updateData.income_category_id = null; // Clear income category if any
            } else {
                updateData.income_category_id = categorization.income_category_id;
                updateData.expense_category_id = null; // Clear expense category if any
                updateData.expense_type = null;
            }

            const { error: updateError } = await supabase
                .from('bank_transactions')
                .update(updateData)
                .eq('id', transactionId);

            if (updateError) throw updateError;

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
