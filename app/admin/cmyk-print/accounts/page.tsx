'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Wallet, Banknote, Smartphone, Building2, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { useCMYKAccounts, usePOSSales, useCMYKClientPayments, useCMYKExpenses, useCMYKTransfers } from '@/lib/hooks';
import { useConfirm } from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';

const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

const TYPE_META: Record<string, { label: string; icon: any }> = {
  cash: { label: 'Cash', icon: Banknote },
  upi: { label: 'UPI', icon: Smartphone },
  bank: { label: 'Bank', icon: Building2 },
};

type FormState = { id: string; name: string; type: 'cash' | 'upi' | 'bank'; opening_balance: string; is_active: boolean };
const EMPTY: FormState = { id: '', name: '', type: 'cash', opening_balance: '0', is_active: true };

export default function CMYKAccountsPage() {
  const { cmykAccounts, loading, createAccount, updateAccount, deleteAccount } = useCMYKAccounts();
  const { sales } = usePOSSales();
  const { payments } = useCMYKClientPayments();
  const { expenses } = useCMYKExpenses();
  const { transfers } = useCMYKTransfers();
  const confirm = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Money received into each CMYK account = POS sales collected + client payments.
  const receivedByAccount = useMemo(() => {
    const map: Record<string, number> = {};
    (sales || []).forEach((s: any) => {
      if (s.cmyk_account_id) map[s.cmyk_account_id] = (map[s.cmyk_account_id] || 0) + (Number(s.amount_received) || 0);
    });
    (payments || []).forEach((p: any) => {
      if (p.cmyk_account_id) map[p.cmyk_account_id] = (map[p.cmyk_account_id] || 0) + (Number(p.amount) || 0);
    });
    return map;
  }, [sales, payments]);

  // Money paid OUT of each account. Untagged expenses are deliberately excluded — they
  // can't be attributed to an account, so guessing would make the balance wrong.
  const paidByAccount = useMemo(() => {
    const map: Record<string, number> = {};
    (expenses || []).forEach((e: any) => {
      if (e.cmyk_account_id) map[e.cmyk_account_id] = (map[e.cmyk_account_id] || 0) + (Number(e.amount) || 0);
    });
    return map;
  }, [expenses]);

  // Money moved between CMYK accounts (e.g. petty cash top-ups): + into the account, − out of it.
  const movedByAccount = useMemo(() => {
    const map: Record<string, number> = {};
    (transfers || []).forEach((t: any) => {
      const amt = Number(t.amount) || 0;
      map[t.to_account_id] = (map[t.to_account_id] || 0) + amt;
      map[t.from_account_id] = (map[t.from_account_id] || 0) - amt;
    });
    return map;
  }, [transfers]);

  const untaggedExpenses = useMemo(
    () => (expenses || []).reduce((sum: number, e: any) => sum + (e.cmyk_account_id ? 0 : (Number(e.amount) || 0)), 0),
    [expenses]
  );

  // Billed but not yet collected — the figure that used to silently disappear.
  const outstanding = useMemo(
    () => (sales || []).reduce(
      (sum: number, s: any) => sum + Math.max(0, (Number(s.total_amount) || 0) - (Number(s.amount_received) || 0)),
      0
    ),
    [sales]
  );

  const accounts = (cmykAccounts || []) as any[];
  const balanceOf = (a: any) =>
    (Number(a.opening_balance) || 0) + (receivedByAccount[a.id] || 0) - (paidByAccount[a.id] || 0) + (movedByAccount[a.id] || 0);
  const totalInHand = accounts.reduce((sum, a) => sum + balanceOf(a), 0);
  const totalReceived = accounts.reduce((sum, a) => sum + (receivedByAccount[a.id] || 0), 0);
  const totalPaid = accounts.reduce((sum, a) => sum + (paidByAccount[a.id] || 0), 0);

  const openAdd = () => { setForm(EMPTY); setShowForm(true); };
  const openEdit = (a: any) => {
    setForm({ id: a.id, name: a.name, type: a.type, opening_balance: String(a.opening_balance ?? 0), is_active: a.is_active !== false });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Enter an account name'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      opening_balance: parseFloat(form.opening_balance) || 0,
      is_active: form.is_active,
    };
    const { error } = form.id ? await updateAccount(form.id, payload) : await createAccount(payload as any);
    setSaving(false);
    if (error) { toast.error(error); return; }
    toast.success(form.id ? 'Account updated' : 'Account added');
    setShowForm(false);
  };

  const handleDelete = async (a: any) => {
    const received = receivedByAccount[a.id] || 0;
    const paidOut = paidByAccount[a.id] || 0;
    if (received > 0 || paidOut > 0 || (movedByAccount[a.id] || 0) !== 0 || a.is_petty_cash) {
      toast.error('This account already has receipts or expenses against it. Deactivate it instead of deleting.');
      return;
    }
    const { confirmed } = await confirm({
      title: `Delete ${a.name}?`,
      message: 'This removes the account. It cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    const { error } = await deleteAccount(a.id);
    if (error) { toast.error(error); return; }
    toast.success('Account deleted');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-gray-100 rounded-md"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2"><Wallet className="w-5 h-5" /> CMYK Accounts</h1>
            <p className="text-sm text-gray-500">CMYK&apos;s own cash, UPI &amp; bank accounts — separate from company banking</p>
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800">
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {/* Total */}
      <div className="bg-white border rounded-md p-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-500">Money in CMYK accounts (opening + received − paid out; transfers between accounts net to zero)</p>
            <p className="text-2xl font-bold">{fmt(totalInHand)}</p>
          </div>
          <div className="text-xs text-right space-y-0.5">
            <p className="text-green-700 font-medium">+ {fmt(totalReceived)} received</p>
            <p className="text-red-600 font-medium">− {fmt(totalPaid)} paid out</p>
          </div>
        </div>

        {(outstanding > 0 || untaggedExpenses > 0) && (
          <div className="mt-3 pt-3 border-t space-y-1.5 text-xs">
            {outstanding > 0 && (
              <p className="flex items-center justify-between gap-3 text-amber-700">
                <span>
                  <strong>{fmt(outstanding)}</strong> billed but not yet collected — not in the balance above.
                </span>
                <Link href="/admin/cmyk-print/sales" className="underline whitespace-nowrap shrink-0">See unpaid bills</Link>
              </p>
            )}
            {untaggedExpenses > 0 && (
              <p className="flex items-center justify-between gap-3 text-gray-500">
                <span>
                  <strong>{fmt(untaggedExpenses)}</strong> of expenses aren&apos;t tagged to an account, so they aren&apos;t deducted.
                </span>
                <Link href="/admin/cmyk-print/expenses" className="underline whitespace-nowrap shrink-0">Tag them</Link>
              </p>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-white border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Account</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Opening</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Received</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Paid out</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading…</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No CMYK accounts yet. Add one to start.</td></tr>
              ) : accounts.map((a) => {
                const Icon = (TYPE_META[a.type] || TYPE_META.cash).icon;
                const received = receivedByAccount[a.id] || 0;
                const paidOut = paidByAccount[a.id] || 0;
                const balance = balanceOf(a);
                return (
                  <tr key={a.id} className={`hover:bg-gray-50 ${a.is_active === false ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-400" /> {a.name}
                      {a.is_petty_cash && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Petty cash</span>}
                      {a.is_active === false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{(TYPE_META[a.type] || TYPE_META.cash).label}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(Number(a.opening_balance) || 0)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(received)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{paidOut > 0 ? `− ${fmt(paidOut)}` : '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${balance < 0 ? 'text-red-600' : ''}`}>
                      {fmt(balance)}
                      {(movedByAccount[a.id] || 0) !== 0 && (
                        <span className="block text-[10px] font-normal text-gray-400">
                          incl. {(movedByAccount[a.id] || 0) > 0 ? '+' : '−'}{fmt(Math.abs(movedByAccount[a.id] || 0))} transfers
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => openEdit(a)} title="Edit" className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(a)} title="Delete" className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">{form.id ? 'Edit Account' : 'Add CMYK Account'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. GPay – Satish, HDFC CMYK, Counter Cash"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <div className="flex bg-gray-100 p-1 rounded-md">
                  {(['cash', 'upi', 'bank'] as const).map(t => {
                    const M = TYPE_META[t];
                    return (
                      <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${form.type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <M.icon className="w-4 h-4" /> {M.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Opening balance (₹)</label>
                <input type="number" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              {form.id && (
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  Active (unchecked = hidden from payment pickers)
                </label>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {form.id ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
