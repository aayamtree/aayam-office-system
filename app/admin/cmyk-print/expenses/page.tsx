'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Edit, X, Loader2, Zap, Truck, Wrench, Package, Users, MoreHorizontal } from 'lucide-react';
import { useCMYKExpenses } from '@/lib/hooks';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const EXPENSE_CATEGORIES = [
  { value: 'transportation', label: 'Transportation', icon: Truck, color: 'bg-blue-100 text-blue-700' },
  { value: 'electricity', label: 'Electricity', icon: Zap, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
  { value: 'consumables', label: 'Consumables', icon: Package, color: 'bg-purple-100 text-purple-700' },
  { value: 'labor', label: 'Labor', icon: Users, color: 'bg-green-100 text-green-700' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: 'bg-muted text-muted-foreground' },
];

const getCategoryMeta = (value: string) => EXPENSE_CATEGORIES.find(c => c.value === value) || EXPENSE_CATEGORIES[5];

const today = () => new Date().toISOString().split('T')[0];

export default function CMYKExpensesPage() {
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useCMYKExpenses();
  const confirm = useConfirm();

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const [form, setForm] = useState({
    expense_date: today(),
    category: 'transportation',
    amount: '',
    description: '',
  });

  const filtered = (expenses || []).filter(e => {
    const catMatch = filterCategory === 'all' || e.category === filterCategory;
    const fromMatch = !filterFrom || e.expense_date >= filterFrom;
    const toMatch = !filterTo || e.expense_date <= filterTo;
    return catMatch && fromMatch && toMatch;
  });

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: (expenses || []).filter(e => e.category === cat.value).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0);

  const openAdd = () => {
    setForm({ expense_date: today(), category: 'transportation', amount: '', description: '' });
    setIsEditing(false);
    setEditingId('');
    setShowModal(true);
  };

  const openEdit = (expense: any) => {
    setForm({
      expense_date: expense.expense_date,
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description || '',
    });
    setIsEditing(true);
    setEditingId(expense.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmitting(true);
    try {
      const payload = {
        expense_date: form.expense_date,
        category: form.category,
        amount: parseFloat(form.amount),
        description: form.description || undefined,
      };
      if (isEditing) {
        await updateExpense(editingId, payload);
        toast.success('Expense updated');
      } else {
        await createExpense(payload as any);
        toast.success('Expense recorded');
      }
      setShowModal(false);
    } catch {
      toast.error('Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete Expense', message: 'Delete this expense record?', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) {
      await deleteExpense(id);
      toast.success('Expense deleted');
    }
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-muted rounded-md border border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">CMYK Expenses</h1>
            <p className="text-sm text-muted-foreground">Track daily operational costs</p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Expense
        </Button>
      </div>

      {/* Category Summary */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {byCategory.map(cat => {
            const Icon = cat.icon;
            return (
              <Card key={cat.value} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}>
                <CardContent className="p-3">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-2 ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">{cat.label}</p>
                  <p className="text-sm font-semibold">{formatCurrency(cat.total)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        <span className="text-muted-foreground text-sm">to</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          className="px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        {(filterCategory !== 'all' || filterFrom || filterTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterCategory('all'); setFilterFrom(''); setFilterTo(''); }}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
        {filtered.length > 0 && (
          <span className="ml-auto text-sm font-medium">Total: {formatCurrency(totalFiltered)}</span>
        )}
      </div>

      {/* Expense List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No expenses found.</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={openAdd}>Add your first expense</Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(expense => {
                const meta = getCategoryMeta(expense.category);
                const Icon = meta.icon;
                return (
                  <div key={expense.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{meta.label}</span>
                        <Badge variant="outline" className="text-xs">{new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Badge>
                      </div>
                      {expense.description && <p className="text-xs text-muted-foreground truncate">{expense.description}</p>}
                    </div>
                    <span className="text-sm font-semibold text-destructive flex-shrink-0">{formatCurrency(expense.amount)}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(expense)} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(expense.id)} className="p-1.5 hover:bg-red-50 rounded-md text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-md w-full max-w-md border border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">{isEditing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-muted rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                  <input type="date" required value={form.expense_date}
                    onChange={e => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (₹) *</label>
                  <input type="number" required min="1" step="0.01" placeholder="0.00" value={form.amount || ''}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Category *</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button key={cat.value} type="button"
                        onClick={() => setForm({ ...form, category: cat.value })}
                        className={`flex items-center gap-1.5 px-2 py-2 rounded-md border text-xs font-medium transition-all ${form.category === cat.value ? 'border-foreground bg-muted' : 'border-border hover:bg-muted/50'}`}>
                        <Icon className="w-3.5 h-3.5" /> {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <input type="text" placeholder="e.g. Diesel for delivery" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {isEditing ? 'Update' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
