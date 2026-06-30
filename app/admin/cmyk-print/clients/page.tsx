'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit, Trash2, X, Loader2, Users, Search, FileText } from 'lucide-react';
import { useCMYKClients } from '@/lib/hooks';
import { CMYKClient } from '@/types/database';
import { toast } from '@/lib/toast';
import { useConfirm } from '@/components/ConfirmModal';

const EMPTY = {
  id: '', company: '', name: '', phone: '', email: '', gstin: '',
  address: '', billing_cycle: 'monthly' as 'monthly' | 'immediate',
  opening_balance: 0, notes: '', is_active: true,
};

export default function CMYKClientsPage() {
  const { cmykClients, loading, createCMYKClient, updateCMYKClient, deleteCMYKClient } = useCMYKClients();
  const confirm = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const openAdd = () => { setForm(EMPTY); setShowForm(true); };
  const openEdit = (c: CMYKClient) => {
    setForm({
      id: c.id, company: c.company || '', name: c.name || '', phone: c.phone || '',
      email: c.email || '', gstin: c.gstin || '', address: c.address || '',
      billing_cycle: c.billing_cycle || 'monthly', opening_balance: c.opening_balance || 0,
      notes: c.notes || '', is_active: c.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company && !form.name) { toast.error('Enter a company or contact name'); return; }
    setSaving(true);
    const payload = {
      company: form.company || undefined,
      name: form.name || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      gstin: form.gstin || undefined,
      address: form.address || undefined,
      billing_cycle: form.billing_cycle,
      opening_balance: Number(form.opening_balance) || 0,
      notes: form.notes || undefined,
      is_active: form.is_active,
    };
    const res = form.id
      ? await updateCMYKClient(form.id, payload)
      : await createCMYKClient(payload);
    setSaving(false);
    if (res.error) { toast.error('Failed: ' + res.error); return; }
    toast.success(form.id ? 'Client updated' : 'Client added');
    setShowForm(false);
    setForm(EMPTY);
  };

  const handleDelete = async (c: CMYKClient) => {
    const { confirmed } = await confirm({
      title: 'Delete CMYK Client',
      message: `Delete "${c.company || c.name}"? Their past bills stay, but lose the client link.`,
      variant: 'danger', confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    const res = await deleteCMYKClient(c.id);
    if (res.error) toast.error('Failed: ' + res.error);
    else toast.success('Client deleted');
  };

  const list = (cmykClients || []).filter(c => {
    const q = search.toLowerCase();
    return !q || (c.company || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/cmyk-print" className="p-2 hover:bg-gray-100 rounded-md"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5" /> CMYK Clients</h1>
            <p className="text-sm text-gray-500">Print-business clients — kept separate from the main app</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/cmyk-print/client-report"
            className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-gray-50">
            <FileText className="w-4 h-4" /> Monthly Report
          </Link>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder="Search clients..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">GSTIN</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Billing</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No CMYK clients yet. Click <button onClick={openAdd} className="text-primary font-medium">Add Client</button>.</td></tr>
              ) : list.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.company || c.name}</p>
                    {c.company && c.name && <p className="text-xs text-gray-500">{c.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.gstin || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.billing_cycle === 'monthly' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.billing_cycle === 'monthly' ? 'Month-end' : 'Immediate'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/cmyk-print/client-report?client=${c.id}`} title="Monthly report"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><FileText className="w-4 h-4" /></Link>
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(c)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">{form.id ? 'Edit Client' : 'Add CMYK Client'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company / Shop Name</label>
                  <input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="e.g. Sharma Printers" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="e.g. Raj Sharma" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                  <input type="text" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                  <select value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value as 'monthly' | 'immediate' })}
                    className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-gray-400">
                    <option value="monthly">Month-end invoice</option>
                    <option value="immediate">Immediate / per bill</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                  <input type="number" value={form.opening_balance || ''} onChange={e => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="0" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                    Active client
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {form.id ? 'Update' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
