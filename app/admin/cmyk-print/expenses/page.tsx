'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Edit, X, Loader2, Zap, Truck, Wrench, Package, Users, MoreHorizontal, Banknote, Smartphone, Building2, Tag, Settings2, Coins, ClipboardCheck, ChevronDown } from 'lucide-react';
import { useCMYKExpenses, useCMYKAccounts, useCMYKExpenseCategories, useCMYKTransfers, useCMYKPettyCashCounts } from '@/lib/hooks';
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
  const { cmykAccounts, updateAccount } = useCMYKAccounts();
  const { transfers, createTransfer } = useCMYKTransfers();
  const { counts, createCount } = useCMYKPettyCashCounts();
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

  // ---------- Petty cash ----------
  const pettyAccount: any = (cmykAccounts || []).find((a: any) => a.is_petty_cash) || null;
  const pettyId: string | null = pettyAccount?.id || null;
  const pettyFloat = Number(pettyAccount?.float_amount) || 0;
  const pettyExpenses = (expenses || []).filter((e: any) => pettyId && e.cmyk_account_id === pettyId);
  const pettyPaid = pettyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pettyIn = (transfers || []).filter((t: any) => t.to_account_id === pettyId).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  const pettyOut = (transfers || []).filter((t: any) => t.from_account_id === pettyId).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  const pettyBalance = (Number(pettyAccount?.opening_balance) || 0) + pettyIn - pettyOut - pettyPaid;
  const monthPrefix = today().slice(0, 7);
  const pettySpentMonth = pettyExpenses.filter(e => (e.expense_date || '').startsWith(monthPrefix)).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const lastCount: any = (counts || [])[0] || null;
  const sourceAccounts = activeAccounts.filter((a: any) => !a.is_petty_cash);

  const [filterPetty, setFilterPetty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pettyModal, setPettyModal] = useState<null | 'topup' | 'count' | 'float'>(null);
  const [pettyBusy, setPettyBusy] = useState(false);
  const [pf, setPf] = useState({ date: today(), from: '', amount: '', note: '' });

  const openPettyModal = (kind: 'topup' | 'count' | 'float') => {
    if (kind === 'topup') {
      const shortfall = Math.max(0, pettyFloat - pettyBalance);
      const cash = sourceAccounts.find((a: any) => a.type === 'cash') || sourceAccounts[0];
      setPf({ date: today(), from: cash?.id || '', amount: shortfall > 0 ? String(shortfall) : '', note: '' });
    } else if (kind === 'count') {
      setPf({ date: today(), from: '', amount: '', note: '' });
    } else {
      setPf({ date: today(), from: '', amount: String(pettyFloat || ''), note: '' });
    }
    setPettyModal(kind);
  };

  const openAddPetty = () => {
    setForm({ expense_date: today(), category: 'consumables', amount: '', description: '', cmyk_account_id: pettyId || '' });
    setIsEditing(false);
    setEditingId('');
    setShowModal(true);
  };

  const handlePettySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pettyId) return;
    const amt = parseFloat(pf.amount);
    if (pettyModal === 'topup') {
      if (!pf.from) { toast.error('Choose which account the money comes from'); return; }
      if (!(amt > 0)) { toast.error('Enter a valid amount'); return; }
      setPettyBusy(true);
      const res = await createTransfer({ transfer_date: pf.date, from_account_id: pf.from, to_account_id: pettyId, amount: amt, note: pf.note || undefined });
      setPettyBusy(false);
      if (res?.error) { toast.error('Could not save the top-up: ' + res.error); return; }
      toast.success('Petty cash topped up');
    } else if (pettyModal === 'count') {
      if (!(amt >= 0) || pf.amount === '') { toast.error('Enter the amount you counted'); return; }
      const diff = amt - pettyBalance;
      if (diff !== 0 && !pf.note.trim()) { toast.error('There is a difference — add a short note explaining it'); return; }
      setPettyBusy(true);
      const res = await createCount({ count_date: pf.date, book_amount: pettyBalance, counted_amount: amt, difference: diff, note: pf.note || undefined });
      setPettyBusy(false);
      if (res?.error) { toast.error('Could not save the count: ' + res.error); return; }
      toast.success(diff === 0 ? 'Counted — cash matches' : 'Count saved with the difference noted');
    } else if (pettyModal === 'float') {
      if (!(amt >= 0)) { toast.error('Enter a valid amount'); return; }
      setPettyBusy(true);
      const res = await updateAccount(pettyId, { float_amount: amt });
      setPettyBusy(false);
      if (res?.error) { toast.error('Could not save the float: ' + res.error); return; }
      toast.success('Float updated');
    }
    setPettyModal(null);
  };

  // Recent top-ups and counts, newest first, for the History panel.
  const pettyHistory = [
    ...(transfers || []).filter((t: any) => t.to_account_id === pettyId).map((t: any) => ({ kind: 'topup', id: t.id, date: t.transfer_date, at: t.created_at, amount: Number(t.amount) || 0, from: accountName(t.from_account_id), note: t.note })),
    ...(counts || []).map((c: any) => ({ kind: 'count', id: c.id, date: c.count_date, at: c.created_at, amount: Number(c.counted_amount) || 0, diff: Number(c.difference) || 0, note: c.note })),
  ].sort((a: any, b: any) => String(b.date + (b.at || '')).localeCompare(String(a.date + (a.at || '')))).slice(0, 8);

  const filtered = (expenses || []).filter(e => {
    const catMatch = filterCategory === 'all' || e.category === filterCategory;
    if (filterPetty && (!pettyId || (e as any).cmyk_account_id !== pettyId)) return false;
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

      {/* Petty Cash */}
      {pettyAccount && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center"><Coins className="w-4 h-4" /></div>
                <h2 className="text-sm font-semibold">Petty Cash</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openPettyModal('topup')}><Plus className="w-4 h-4 mr-1" /> Top up</Button>
                <Button size="sm" variant="outline" onClick={openAddPetty}><Plus className="w-4 h-4 mr-1" /> Petty expense</Button>
                <Button size="sm" variant="outline" onClick={() => openPettyModal('count')}><ClipboardCheck className="w-4 h-4 mr-1" /> Count cash</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Cash in box</p>
                <p className={`text-lg font-semibold ${pettyBalance < 0 ? 'text-destructive' : ''}`}>{formatCurrency(pettyBalance)}</p>
                {pettyFloat > 0 && pettyBalance < pettyFloat && (
                  <p className="text-[11px] text-amber-600">{formatCurrency(pettyFloat - pettyBalance)} below the float — top up</p>
                )}
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground flex items-center justify-between">Float
                  <button type="button" onClick={() => openPettyModal('float')} className="text-[11px] underline hover:text-foreground">Change</button>
                </p>
                <p className="text-lg font-semibold">{formatCurrency(pettyFloat)}</p>
                <p className="text-[11px] text-muted-foreground">Amount to keep in the box</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Spent this month</p>
                <p className="text-lg font-semibold">{formatCurrency(pettySpentMonth)}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Last counted</p>
                {lastCount ? (
                  <>
                    <p className="text-lg font-semibold">{new Date(lastCount.count_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    <p className={`text-[11px] ${Number(lastCount.difference) === 0 ? 'text-green-700' : 'text-amber-600'}`}>
                      {Number(lastCount.difference) === 0 ? 'Matched' : (Number(lastCount.difference) < 0 ? 'Short ' : 'Excess ') + formatCurrency(Math.abs(Number(lastCount.difference)))}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not counted yet</p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setShowHistory(v => !v)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} /> Top-ups and counts
            </button>
            {showHistory && (
              pettyHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing yet.</p>
              ) : (
                <div className="divide-y divide-border border border-border rounded-md">
                  {pettyHistory.map((h: any) => (
                    <div key={h.kind + h.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="text-muted-foreground w-14">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      {h.kind === 'topup' ? (
                        <span className="flex-1">Top-up from {h.from || 'account'}{h.note ? ` — ${h.note}` : ''}</span>
                      ) : (
                        <span className="flex-1">Counted {formatCurrency(h.amount)} — {h.diff === 0 ? 'matched' : (h.diff < 0 ? 'short ' : 'excess ') + formatCurrency(Math.abs(h.diff))}{h.note ? ` — ${h.note}` : ''}</span>
                      )}
                      <span className={`font-semibold ${h.kind === 'topup' ? 'text-green-700' : ''}`}>{h.kind === 'topup' ? '+ ' + formatCurrency(h.amount) : ''}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

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
        {pettyId && (
          <Button variant={filterPetty ? 'default' : 'outline'} size="sm" onClick={() => setFilterPetty(v => !v)}>
            <Coins className="w-4 h-4 mr-1" /> Petty cash only
          </Button>
        )}
        {(filterCategory !== 'all' || filterFrom || filterTo || filterPetty) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterCategory('all'); setFilterFrom(''); setFilterTo(''); setFilterPetty(false); }}>
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
      {/* Petty cash modals */}
      {pettyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-md w-full max-w-md border border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">{pettyModal === 'topup' ? 'Top up petty cash' : pettyModal === 'count' ? 'Count petty cash' : 'Petty cash float'}</h2>
              <button onClick={() => setPettyModal(null)} className="p-1.5 hover:bg-muted rounded-md"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handlePettySubmit} className="p-4 space-y-4">
              {pettyModal !== 'float' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
                  <input type="date" required value={pf.date} onChange={e => setPf({ ...pf, date: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}
              {pettyModal === 'topup' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Money comes from</label>
                  <select value={pf.from} onChange={e => setPf({ ...pf, from: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Choose account</option>
                    {sourceAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {pettyModal === 'count' && (
                <div className="rounded-md bg-muted/50 p-3 text-xs">
                  The system says the box should hold <strong>{formatCurrency(pettyBalance)}</strong>. Count the real cash and enter it below.
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {pettyModal === 'topup' ? 'Amount (₹)' : pettyModal === 'count' ? 'Cash you counted (₹)' : 'Float (₹)'}
                </label>
                <input type="number" required min="0" step="0.01" value={pf.amount} onChange={e => setPf({ ...pf, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                {pettyModal === 'topup' && pettyFloat > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">Filled in to bring the box back up to the {formatCurrency(pettyFloat)} float.</p>
                )}
                {pettyModal === 'count' && pf.amount !== '' && (() => {
                  const d = (parseFloat(pf.amount) || 0) - pettyBalance;
                  return <p className={`text-xs mt-1 font-medium ${d === 0 ? 'text-green-700' : 'text-amber-600'}`}>{d === 0 ? 'Matches the books.' : (d < 0 ? 'Short by ' : 'Excess of ') + formatCurrency(Math.abs(d))}</p>;
                })()}
              </div>
              {pettyModal !== 'float' && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{pettyModal === 'count' ? 'Note (needed if there is a difference)' : 'Note'}</label>
                  <input type="text" value={pf.note} onChange={e => setPf({ ...pf, note: e.target.value })}
                    placeholder={pettyModal === 'count' ? 'e.g. Tea bill not entered' : 'Optional'}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPettyModal(null)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={pettyBusy}>
                  {pettyBusy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
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
              <p className="text-[11px] text-muted-foreground">A category already used by an expense cannot be removed. The Other category always stays.</p>
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowCatModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
