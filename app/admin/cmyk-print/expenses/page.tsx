'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Edit, X, Loader2, Zap, Truck, Wrench, Package, Users, MoreHorizontal, Banknote, Smartphone, Building2, Tag, Settings2 } from 'lucide-react';
import { useCMYKExpenses, useCMYKAccounts, useCMYKExpenseCategories } from '@/lib/hooks';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const DEFAULT_CATEGORIES = [
  { value: 'transportation', label: 'Transportation', icon: Truck, color: 'bg-blue-100 text-blue-700' },
  { value: 'electricity', label: 'Electricity', icon: Zap, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
  { value: 'consumables', label: 'Consumables', icon: Package, color: 'bg-purple-100 text-purple-700' },
  { value: 'labor', label: 'Labor', icon: Users, color: 'bg-green-100 text-green-700' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: 'bg-muted text-muted-foreground' },
];

const CATEGORY_ICONS: Record<string, any> = { transportation: Truck, electricity: Zap, maintenance: Wrench, consumables: Package, labor: Users, other: MoreHorizontal };
const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700', yellow: 'bg-yellow-100 text-yellow-700', orange: 'bg-orange-100 text-orange-700',
  purple: 'bg-purple-100 text-purple-700', green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700',
  pink: 'bg-pink-100 text-pink-700', teal: 'bg-teal-100 text-teal-700', slate: 'bg-muted text-muted-foreground',
};
const NEW_CATEGORY_COLORS = ['blue', 'yellow', 'orange', 'purple', 'green', 'red', 'pink', 'teal'];

const today = () => new Date().toISOString().split('T')[0];

export default function CMYKExpensesPage() {
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useCMYKExpenses();
  const { cmykAccounts } = useCMYKAccounts();
  const confirm = useConfirm();
  const { categories: dbCategories, createCategory, deleteCategory } = useCMYKExpenseCategories();

  // Categories come from the database; the built-in list is only a fallback until it loads.
  const EXPENSE_CATEGORIES = useMemo(() => {
    const rows = (dbCategories || []) as any[];
    if (rows.length === 0) return DEFAULT_CATEGORIES;
    return rows.map(r => ({
      id: r.id, value: r.value, label: r.label, is_system: r.is_system,
      icon: CATEGORY_ICONS[r.value] || Tag,
      color: COLOR_CLASSES[r.color] || COLOR_CLASSES.slate,
    }));
  }, [dbCategories]);
  const getCategoryMeta = (value: string) =>
    EXPENSE_CATEGORIES.find((c: any) => c.value === value) ||
    { value, label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '), icon: Tag, color: COLOR_CLASSES.slate };

  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
  const [catBusy, setCatBusy] = useState(false);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatBusy(true);
    const res = await createCategory(newCatName, newCatColor);
    setCatBusy(false);
    if (res?.error) { toast.error(res.error); return; }
    toast.success('Category added');
    setNewCatName('');
  };

  const handleRemoveCategory = async (cat: any) => {
    const used = (expenses || []).filter(e => e.category === cat.value).length;
    if (used > 0) {
      toast.error(`"${cat.label}" is used by ${used} expense${used > 1 ? 's' : ''}. Change or delete those first.`);
      return;
    }
    const { confirmed } = await confirm({
      title: `Remove "${cat.label}"?`,
      message: 'No expenses use this category, so nothing else changes.',
      variant: 'danger',
      confirmLabel: 'Remove category',
    });
    if (!confirmed) return;
    const res = await deleteCategory(cat.id);
    if (res?.error) toast.error('Could not remove: ' + res.error);
    else { toast.success('Category removed'); if (filterCategory === cat.value) setFilterCategory('all'); }
  };

  // Which CMYK account the money left. Untagged expenses are still recorded, they just
  // can't be deducted from any one account's balance.
  const activeAccounts = useMemo(
    () => (cmykAccounts || []).filter((a: any) => a.is_active !== false),
    [cmykAccounts]
  );
  const accountIcon = (t: string) => (t === 'cash' ? Banknote : t === 'bank' ? Building2 : Smartphone);
  const accountName = (id?: string | null) =>
    (cmykAccounts || []).find((a: any) => a.id === id)?.name || null;

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
    cmyk_account_id: '',
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
    setForm({
      expense_date: today(),
      category: 'transportation',
      amount: '',
      description: '',
      cmyk_account_id: activeAccounts[0]?.id || '',
    });
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
      cmyk_account_id: expense.cmyk_account_id || '',
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
        // Explicit null, not undefined — clearing the account must actually clear it.
        cmyk_account_id: form.cmyk_account_id || null,
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
    // Money out of the business. Once it is gone the day's totals change and
    // nothing records that it was ever there.
    const { confirmed } = await confirm({
      title: 'Delete this expense?',
      message: 'The expense is removed for good.',
      consequences: [
        'The day\u2019s and month\u2019s CMYK expense totals change to match \u2014 anything already reported from them no longer agrees.',
        'No record is kept of the deleted entry, its amount, or who removed it.',
        'The only copy left is the weekly backup, which can be up to seven days old.',
      ],
      variant: 'danger',
      confirmLabel: 'Delete expense',
      requireExactInput: 'DELETE',
    });
    if (!confirmed) return;
    // The hook returns its error; announcing success without reading it told
    // people a record was gone while it was still sitting there.
    const result = await deleteExpense(id);
    if (result?.error) toast.error('Could not delete the expense: ' + result.error);
    else toast.success('Expense deleted');
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
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCatModal(true)} size="sm" variant="outline">
            <Settings2 className="w-4 h-4 mr-1" /> Categories
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Expense
          </Button>
        </div>
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
                        {accountName((expense as any).cmyk_account_id) ? (
                          <Badge variant="outline" className="text-xs">{accountName((expense as any).cmyk_account_id)}</Badge>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium" title="Not deducted from any CMYK account balance">No account</span>
                        )}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-muted-foreground">Category *</label>
                  <button type="button" onClick={() => setShowCatModal(true)} className="text-[11px] text-muted-foreground hover:text-foreground underline">+ Add category</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.map((cat: any) => {
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
              {/* Which account the money left — this is what makes the Accounts page
                  balance reflect real cash in hand instead of receipts only. */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-muted-foreground">Paid from</label>
                  <Link href="/admin/cmyk-print/accounts" className="text-[11px] text-muted-foreground hover:text-foreground underline">Manage accounts</Link>
                </div>
                {activeAccounts.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    No CMYK accounts yet. <Link href="/admin/cmyk-print/accounts" className="underline">Add one</Link>.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {activeAccounts.map((a: any) => {
                      const Icon = accountIcon(a.type);
                      return (
                        <button key={a.id} type="button" onClick={() => setForm({ ...form, cmyk_account_id: a.id })}
                          className={`p-2.5 rounded-md border-2 flex items-center justify-center gap-1.5 text-xs transition-all ${form.cmyk_account_id === a.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}>
                          <Icon size={15} /> {a.name}
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => setForm({ ...form, cmyk_account_id: '' })}
                      className={`p-2.5 rounded-md border-2 border-dashed flex items-center justify-center gap-1.5 text-xs transition-all ${!form.cmyk_account_id ? 'border-muted-foreground/60 bg-muted' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}>
                      Not from a CMYK account
                    </button>
                  </div>
                )}
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
      {/* Manage Categories Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-background rounded-md w-full max-w-md border border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">Manage Categories</h2>
              <button onClick={() => setShowCatModal(false)} className="p-1.5 hover:bg-muted rounded-md"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              <form onSubmit={handleAddCategory} className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">New category</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. Packaging" value={newCatName} maxLength={30}
                    onChange={e => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  <Button type="submit" size="sm" disabled={catBusy || !newCatName.trim()}>
                    {catBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Add</>}
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  {NEW_CATEGORY_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setNewCatColor(c)} title={c}
                      className={`w-6 h-6 rounded-full border-2 ${COLOR_CLASSES[c].split(' ')[0]} ${newCatColor === c ? 'border-foreground' : 'border-transparent'}`} />
                  ))}
                </div>
              </form>
              <div className="divide-y divide-border border border-border rounded-md max-h-72 overflow-y-auto">
                {EXPENSE_CATEGORIES.map((cat: any) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.value} className="flex items-center gap-2 p-2.5">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${cat.color}`}><Icon className="w-3.5 h-3.5" /></div>
                      <span className="flex-1 text-sm">{cat.label}</span>
                      {cat.is_system || !cat.id ? (
                        <span className="text-[10px] text-muted-foreground">Default</span>
                      ) : (
                        <button onClick={() => handleRemoveCategory(cat)} className="p-1.5 hover:bg-red-50 rounded-md text-muted-foreground hover:text-destructive" title="Remove category">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">A category that is already used by an expense can't be removed. "Other" always stays.</p>
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowCatModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
