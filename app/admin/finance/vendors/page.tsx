'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { Search, Plus, Phone, Mail, MapPin, Edit, Trash2, Eye, X, ArrowLeft, Building2, Loader2, Package, Settings, FileBarChart } from 'lucide-react';
import { useVendors } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logActivity';
import { Vendor } from '@/types/database';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';
import { LEGACY_LEDGER_CLOSED } from '@/lib/legacy-ledger';

interface VendorCategory { id: string; name: string; color: string; }


export default function VendorsPage() {
  const { vendors, loading, createVendor, updateVendor, deleteVendor } = useVendors();
  const { profile, session } = useAuth();

  // Dynamic categories from Supabase
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const fetchCategories = async () => {
    const { data } = await supabase
      .from('vendor_categories')
      .select('id, name, color')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (data) setCategories(data);
  };
  useEffect(() => { fetchCategories(); }, []);

  const categoryNames = categories.map(c => c.name);
  const defaultCategory = categoryNames[0] || 'Paper';

  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', category: defaultCategory, is_active: true, payment_terms: '',
    opening_balance: '', opening_balance_date: '',
  });

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = (vendor.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (vendor.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || (vendor.phone || '').includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? vendor.is_active : !vendor.is_active);
    const matchesCategory = categoryFilter === 'all' || vendor.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleAddNew = () => {
    setFormData({ name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', category: defaultCategory, is_active: true, payment_terms: '', opening_balance: '', opening_balance_date: '' });
    setIsEditing(false);
    setSelectedVendor(null);
    setShowModal(true);
  };

  const handleEdit = (vendor: Vendor) => {
    setFormData({
      name: vendor.name || '',
      company: vendor.company || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      gstin: vendor.gstin || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || 'Gujarat',
      category: vendor.category || 'Paper',
      is_active: vendor.is_active,
      payment_terms: String(vendor.payment_terms ?? ''),
      opening_balance: vendor.opening_balance != null ? String(vendor.opening_balance) : '',
      opening_balance_date: vendor.opening_balance_date || '',
    });
    setSelectedVendor(vendor);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleView = (vendor: Vendor) => { setSelectedVendor(vendor); setShowViewModal(true); };

  const handleDelete = async (id: string) => {
    const vendorName = vendors.find(v => v.id === id)?.name || 'Unknown';
    // A vendor is master data with money hanging off it. Bills, payments, jobs and
    // print runs all block the delete at the database, so the delete only ever goes
    // through for a vendor that looks unused — but bank and cash transactions are
    // set to NULL instead of blocking, so those entries quietly lose their vendor
    // and stop showing up in any vendor-wise spend report.
    const { confirmed } = await confirm({
      title: `Delete ${vendorName}?`,
      message: 'The vendor record is removed for good.',
      consequences: [
        'Bank entries, cash entries and paper purchases paid to this vendor keep their amount but lose the vendor name \u2014 vendor-wise spend reports stop counting them.',
        'If any bill, payment, job or print run still points at this vendor, the delete is refused. Make the vendor inactive instead.',
        'The only copy left is the weekly backup, which can be up to seven days old.',
      ],
      variant: 'danger',
      confirmLabel: 'Delete vendor',
      requireExactInput: 'DELETE',
    });
    if (confirmed) {
      // deleteVendor RETURNS its error instead of throwing, so the old catch
      // never ran: the refusal this dialog promises was silent, and the
      // activity log recorded a deletion that had not happened.
      const result = await deleteVendor(id);
      if (result?.error) {
        toast.error('Cannot delete vendor: ' + result.error);
        return;
      }
      toast.success(`${vendorName} deleted`);
      logActivity({ userId: session?.user?.id || '', userName: profile?.full_name || 'Unknown', action: 'DELETE', module: 'Finance', entityId: id, entityName: vendorName, description: `Deleted Vendor: ${vendorName}` });
    }
  };

  // Upserts the "Opening Balance" purchase_bill for a vendor so it participates
  // in the normal payables workflow (matches Zoho Books behavior).
  // Marker: purchase_bills.product_type = 'Opening Balance'.
  const upsertOpeningBalanceBill = async (vendorId: string, amount: number, asOfDate: string | null) => {
    // The vendor MASTER stays fully editable — it is live data the whole app
    // uses. Only this side effect is retired: it writes a purchase_bills row,
    // and purchase_bills is the abandoned ledger (5 rows against Zoho's 608).
    // Guarded silently, with no toast: the person is saving a vendor, not a
    // bill, and a refusal about bills would be baffling. Their vendor edit
    // still saves.
    if (LEGACY_LEDGER_CLOSED) return { error: null };
    // Find an existing opening balance bill for this vendor
    const { data: existing } = await supabase
      .from('purchase_bills')
      .select('id, amount_paid, total_amount')
      .eq('vendor_id', vendorId)
      .eq('product_type', 'Opening Balance')
      .limit(1)
      .maybeSingle();

    const billDate = asOfDate || new Date().toISOString().slice(0, 10);

    if (amount <= 0) {
      // Opening balance was cleared
      if (existing) {
        if ((existing.amount_paid || 0) > 0) {
          toast.error('Opening balance bill has payments applied — cannot remove. Keep amount > 0 or reverse payments first.');
          return { error: 'bill_has_payments' };
        }
        await supabase.from('purchase_bills').delete().eq('id', existing.id);
      }
      return { error: null };
    }

    if (existing) {
      // Update existing OB bill — don't touch amount_paid
      const newStatus = (existing.amount_paid || 0) >= amount ? 'paid' : ((existing.amount_paid || 0) > 0 ? 'partial' : 'pending');
      const { error } = await supabase
        .from('purchase_bills')
        .update({
          total_amount: amount,
          subtotal: amount,
          gst_rate: 0,
          gst_amount: 0,
          bill_date: billDate,
          due_date: billDate,
          description: `Opening Balance as of ${billDate}`,
          payment_status: newStatus,
        })
        .eq('id', existing.id);
      return { error: error?.message || null };
    }

    // Create a new OB bill
    const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'purchase_bill' });
    const { error } = await supabase
      .from('purchase_bills')
      .insert([{
        bill_number: numberData || `OB-${Date.now()}`,
        vendor_id: vendorId,
        product_type: 'Opening Balance',
        description: `Opening Balance as of ${billDate}`,
        quantity: 1,
        rate: amount,
        subtotal: amount,
        gst_rate: 0,
        gst_amount: 0,
        total_amount: amount,
        amount_paid: 0,
        payment_status: 'pending',
        bill_date: billDate,
        due_date: billDate,
        payment_terms: 'Due on Receipt',
        items: [{ description: 'Opening Balance', quantity: 1, rate: amount, unit: 'Lumpsum', gst_rate: 0 }],
      }]);
    return { error: error?.message || null };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.phone && formData.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    setSaving(true);
    try {
      const ptRaw = formData.payment_terms;
      const payment_terms = ptRaw === '' || ptRaw === null || ptRaw === undefined
        ? null
        : Number(ptRaw) || null;

      // Parse opening balance (optional). Empty string => 0 amount; empty date => null.
      const obRaw = formData.opening_balance;
      const opening_balance = obRaw === '' || obRaw === null || obRaw === undefined
        ? 0
        : Number(obRaw) || 0;
      const opening_balance_date = formData.opening_balance_date || null;

      // opening_balance is still written on every save — but the input is
      // disabled, so it can only ever carry the value already on the vendor
      // (or 0 for a new one). Nothing new can be entered, so it can no longer
      // drift away from purchase_bills.
      const basePayload: any = {
        ...formData,
        payment_terms,
        opening_balance,
        opening_balance_date,
      };

      let vendorId: string | null = null;

      if (isEditing && selectedVendor) {
        const { error } = await updateVendor(selectedVendor.id, basePayload);
        if (error) throw new Error(error);
        vendorId = selectedVendor.id;
        logActivity({ userId: session?.user?.id || '', userName: profile?.full_name || 'Unknown', action: 'UPDATE', module: 'Finance', entityId: selectedVendor.id, entityName: formData.name, description: `Updated Vendor: ${formData.name} (${formData.category || 'Vendor'})` });
      } else {
        // Seed outstanding_balance so record_vendor_payment correctly decrements it
        // when the opening-balance bill is paid down.
        const createPayload = {
          ...basePayload,
          outstanding_balance: opening_balance,
        };
        const { data: created, error } = await createVendor(createPayload);
        if (error) throw new Error(error);
        vendorId = created?.id || null;
        logActivity({ userId: session?.user?.id || '', userName: profile?.full_name || 'Unknown', action: 'CREATE', module: 'Finance', entityName: formData.name, description: `Added Vendor: ${formData.name} (${formData.category || 'Vendor'}) — ${formData.phone}${opening_balance > 0 ? ` — Opening Balance ₹${opening_balance}` : ''}` });
      }

      // Upsert the opening-balance bill for this vendor (only when we have a vendor id)
      if (vendorId) {
        const obResult = await upsertOpeningBalanceBill(vendorId, opening_balance, opening_balance_date);
        if (obResult.error && obResult.error !== 'bill_has_payments') {
          console.error('Opening balance bill error:', obResult.error);
          toast.error(`Vendor saved, but opening-balance bill failed: ${obResult.error}`);
        }
      }

      setShowModal(false); setIsEditing(false); setSelectedVendor(null);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(String(error.message || 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    const found = categories.find(c => c.name === cat);
    return found?.color || 'bg-gray-100 text-gray-700';
  };

  if (loading) return (
    <div className="space-y-3">
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card rounded-md border border-border border-l-4 border-l-orange-200 animate-pulse">
            <div className="h-8 bg-muted rounded-t-md" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-2/3 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
              <div className="flex justify-between pt-3 border-t border-border">
                <div className="h-5 w-16 bg-muted rounded" />
                <div className="flex gap-1">{[1, 2, 3, 4].map(j => <div key={j} className="h-7 w-7 bg-muted rounded" />)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Desktop table skeleton */}
      <div className="hidden lg:block bg-white rounded-md border overflow-hidden animate-pulse">
        <div className="h-10 bg-gray-50 border-b" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-6 px-6 py-4 border-b items-center">
            <div className="flex items-center gap-3 flex-1"><div className="h-10 w-10 bg-gray-200 rounded-full" /><div className="space-y-1"><div className="h-4 w-28 bg-gray-200 rounded" /><div className="h-3 w-20 bg-gray-200 rounded" /></div></div>
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-5 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded" />
            <div className="flex gap-1 ml-auto">{[1, 2, 3, 4].map(j => <div key={j} className="h-8 w-8 bg-gray-200 rounded" />)}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-md lg:hidden"><ArrowLeft className="w-5 h-5" /></Link>
          <div><h1 className="text-page-title text-gray-900">Vendors</h1><p className="text-sm text-gray-500">{filteredVendors.length} vendors</p></div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/vendors/purchases" className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-md hover:bg-gray-50 transition-colors">
            <Package className="w-4 h-4 md:w-4.5 md:h-4.5" />
            <span className="hidden sm:inline">Purchases & Bills</span>
          </Link>
          <button onClick={handleAddNew} className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-md hover:bg-gray-800">
            <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto min-w-[100px] h-9 text-sm">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <>
          {/* Mobile/Tablet View: Queue-style cards */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {filteredVendors.map((vendor) => (
              <div key={vendor.id} className={`bg-white rounded-md border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden ${!vendor.is_active ? 'opacity-70' : ''}`}>
                {/* ── Header Bar ── */}
                <div className="bg-gray-900 px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-white/10 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                      {vendor.name?.charAt(0)}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{vendor.company || vendor.name}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${getCategoryColor(vendor.category || 'Paper')}`}>
                    {vendor.category}
                  </span>
                </div>

                {/* ── Body ── */}
                <div className="p-3 space-y-2">
                  {vendor.company && (
                    <p className="text-[11px] text-gray-400 font-medium">{vendor.name}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-gray-600">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span className="font-semibold text-gray-900">{vendor.phone}</span>
                    </span>
                    {vendor.city && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span>{vendor.city}</span>
                      </span>
                    )}
                  </div>
                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-medium ${vendor.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {vendor.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* ── Action Footer ── */}
                <div className="flex items-center border-t border-gray-100">
                  <Link href={`/admin/finance/vendors/${vendor.id}`} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                    <FileBarChart className="w-3.5 h-3.5" /> Statement
                  </Link>
                  <div className="w-px h-5 bg-gray-100" />
                  <button onClick={() => handleView(vendor)} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <div className="w-px h-5 bg-gray-100" />
                  <button onClick={() => handleEdit(vendor)} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <div className="w-px h-5 bg-gray-100" />
                  <button onClick={() => handleDelete(vendor.id)} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {filteredVendors.length === 0 && (
              <div className="col-span-full text-center py-12 bg-card rounded-md border border-border">
                <Package className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="text-sm font-medium text-foreground mb-1">No vendors found</h3>
                <p className="text-xs text-muted-foreground mb-3">Try adjusting your filters</p>
                <button onClick={handleAddNew} className="inline-flex items-center gap-2 bg-foreground text-background px-3 py-2 rounded-md text-xs font-semibold hover:opacity-90">
                  <Plus className="w-3.5 h-3.5" /> Add Vendor
                </button>
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden lg:block bg-white rounded-md border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">
                          {vendor.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{vendor.name}</p>
                          <p className="text-xs text-gray-500">{vendor.company || 'Individual'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 font-medium">{vendor.phone}</p>
                      <p className="text-xs text-gray-500">{vendor.email || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide ${getCategoryColor(vendor.category || 'Paper')}`}>
                        {vendor.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide ${vendor.is_active ? 'bg-gray-100 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/finance/vendors/${vendor.id}`} className="p-2 hover:bg-gray-100 rounded-md transition-colors" title="Statement / ledger" aria-label="Vendor statement">
                          <FileBarChart className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-500" />
                        </Link>
                        <Link href={`./vendors/purchases?vendorId=${vendor.id}`} className="p-2 hover:bg-gray-100 rounded-md transition-colors" title="View Bills" aria-label="View vendor purchases">
                          <Package className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-500" />
                        </Link>
                        <button onClick={() => handleView(vendor)} className="p-2 hover:bg-gray-100 rounded-md" title="View Details" aria-label="View vendor details">
                          <Eye className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-500" />
                        </button>
                        <button onClick={() => handleEdit(vendor)} className="p-2 hover:bg-gray-100 rounded-md" title="Edit" aria-label="Edit vendor">
                          <Edit className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(vendor.id)} className="p-2 hover:bg-red-50 rounded-md" title="Delete" aria-label="Delete vendor">
                          <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No vendors found. <button onClick={handleAddNew} className="text-primary font-bold hover:underline">Add New Vendor</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section">{isEditing ? 'Edit Vendor' : 'Add Vendor'}</h2><button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Name *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div><div><label className="block text-sm font-medium mb-1">Company</label><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Phone *</label><input type="tel" required minLength={10} maxLength={10} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="w-full px-3 py-2 border rounded-md" /></div><div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Category</label><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-md">{categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">GSTIN</label><input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border rounded-md" maxLength={15} /></div></div>
              <div><label className="block text-sm font-medium mb-1">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border rounded-md" rows={2} /></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div><div><label className="block text-sm font-medium mb-1">Status</label><select value={formData.is_active ? 'active' : 'inactive'} onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })} className="w-full px-3 py-2 border rounded-md"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>

              {/* Opening Balance (what we already owe this vendor as of a given date) */}
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Opening Balance</p>
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.opening_balance || ''}
                      onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                      disabled={LEGACY_LEDGER_CLOSED}
                      className="w-full px-3 py-2 border rounded-md disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">As of Date</label>
                    <input
                      type="date"
                      value={formData.opening_balance_date}
                      onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                      disabled={LEGACY_LEDGER_CLOSED}
                      className="w-full px-3 py-2 border rounded-md disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {LEGACY_LEDGER_CLOSED
                    ? 'Opening balances are set in Zoho Books now. This field is disabled because the bill it used to create lives in the old ledger — leaving it editable would save a number with nothing behind it. Everything else on this form still saves normally.'
                    : 'Amount you already owe this vendor when adding them. Leave blank or 0 if none.'}
                </p>
              </div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border rounded-md">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 flex items-center justify-center gap-2 shadow-sm font-semibold">{saving && <Loader2 className="w-4 h-4 md:w-4.5 md:h-4.5 animate-spin" />}{isEditing ? 'Update' : 'Add'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section">Vendor Details</h2><button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button></div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 md:gap-4"><div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center"><span className="text-orange-600 font-bold text-2xl">{selectedVendor.name?.charAt(0)}</span></div><div><h3 className="text-section">{selectedVendor.name}</h3><p className="text-gray-500">{selectedVendor.company}</p><span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-md ${getCategoryColor(selectedVendor.category || 'Paper')}`}>{selectedVendor.category}</span></div></div>
              <div className="space-y-3 p-4 bg-gray-50 rounded-md"><div className="flex items-center gap-3"><Phone className="w-4 h-4 text-gray-400" /><span>{selectedVendor.phone}</span></div>{selectedVendor.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-gray-400" /><span>{selectedVendor.email}</span></div>}{selectedVendor.address && <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-gray-400" /><span>{selectedVendor.address}, {selectedVendor.city}</span></div>}{selectedVendor.gstin && <div className="flex items-center gap-3"><Building2 className="w-4 h-4 text-gray-400" /><span>GSTIN: {selectedVendor.gstin}</span></div>}{(selectedVendor.opening_balance || 0) > 0 && <div className="flex items-center gap-3 pt-2 border-t"><span className="text-sm font-semibold text-gray-700">Opening Balance:</span><span className="text-sm text-red-600 font-bold">₹{Number(selectedVendor.opening_balance || 0).toLocaleString('en-IN')}</span>{selectedVendor.opening_balance_date && <span className="text-xs text-gray-500">as of {selectedVendor.opening_balance_date}</span>}</div>}</div>
              <div className="flex gap-2 flex-wrap mt-2">
                <Link href={`/admin/finance/vendors/purchases?vendor=${selectedVendor.id}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold text-sm">
                  <Package className="w-4 h-4" /> Record Bill
                </Link>
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedVendor); }} className="flex-1 px-4 py-2.5 border rounded-md font-medium text-sm">Edit</button>
                <Link
                  href={`/admin/reports/vendor/${selectedVendor.id}`}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-bold shadow-sm text-center flex items-center justify-center gap-2 text-sm border-2 border-red-700"
                  onClick={() => setShowViewModal(false)}
                >
                  <FileBarChart className="w-4 h-4" /> REPORT
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
