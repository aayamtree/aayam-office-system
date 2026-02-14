'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Phone, Mail, MapPin, Edit, Trash2, Eye, X, ArrowLeft, Building2, Loader2, Package } from 'lucide-react';
import { useVendors } from '@/lib/hooks';
import { Vendor } from '@/types/database';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';

const categories = ['Paper', 'Ink & Toner', 'Binding', 'Lamination', 'Machinery', 'Packaging', 'Other'];

export default function VendorsPage() {
  const { vendors, loading, createVendor, updateVendor, deleteVendor } = useVendors();

  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', category: 'Paper', is_active: true, payment_terms: '',
  });

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name?.toLowerCase().includes(searchQuery.toLowerCase()) || vendor.company?.toLowerCase().includes(searchQuery.toLowerCase()) || vendor.phone?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? vendor.is_active : !vendor.is_active);
    const matchesCategory = categoryFilter === 'all' || vendor.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleAddNew = () => {
    setFormData({ name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', category: 'Paper', is_active: true, payment_terms: '' });
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
      payment_terms: String(vendor.payment_terms || '')
    });
    setSelectedVendor(vendor);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleView = (vendor: Vendor) => { setSelectedVendor(vendor); setShowViewModal(true); };

  const handleDelete = async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete Vendor', message: 'Are you sure you want to delete this vendor?', variant: 'danger', confirmLabel: 'Delete' });
    if (confirmed) {
      try {
        await deleteVendor(id);
      } catch (error) { console.error('Error:', error); alert('Error deleting'); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing && selectedVendor) {
        const { error } = await updateVendor(selectedVendor.id, formData as any);
        if (error) throw new Error(error);
      } else {
        const { error } = await createVendor(formData as any);
        if (error) throw new Error(error);
      }
      setShowModal(false); setIsEditing(false); setSelectedVendor(null);
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = { 'Paper': 'bg-muted text-foreground', 'Ink & Toner': 'bg-gray-900 text-white', 'Binding': 'bg-amber-100 text-amber-700', 'Lamination': 'bg-gray-100 text-gray-900', 'Machinery': 'bg-red-100 text-red-700', 'Packaging': 'bg-gray-900 text-white' };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="ml-2">Loading...</span></div>;

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"><ArrowLeft className="w-5 h-5" /></Link>
          <div><h1 className="text-page-title text-gray-900">Vendors</h1><p className="text-sm text-gray-500">{filteredVendors.length} vendors</p></div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/vendors/purchases" className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
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
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
          {/* Mobile View: Cards */}
          <div className="lg:hidden space-y-4">
            {filteredVendors.map((vendor) => {
              // Header color based on category
              const categoryGradients: Record<string, string> = {
                'Paper': 'bg-gradient-to-r from-gray-700 to-gray-800',
                'Ink & Toner': 'bg-gradient-to-r from-purple-500 to-purple-600',
                'Binding': 'bg-gradient-to-r from-amber-500 to-amber-600',
                'Lamination': 'bg-gradient-to-r from-gray-500 to-gray-600',
                'Machinery': 'bg-gradient-to-r from-red-500 to-red-600',
                'Packaging': 'bg-gradient-to-r from-green-500 to-green-600',
              };
              const headerBg = categoryGradients[vendor.category || 'Paper'] || 'bg-gradient-to-r from-gray-400 to-gray-500';

              return (
                <div key={vendor.id} className={`bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all border ${!vendor.is_active ? 'border-gray-300 opacity-60' : 'border-gray-100'}`}>
                  {/* Colored Header */}
                  <div className={`${headerBg} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">{vendor.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <span className="text-white font-bold text-sm block">{vendor.name}</span>
                        <span className="text-white/80 text-xs">{vendor.company || 'Individual'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/90 text-xs px-3 py-1 bg-white/20 rounded-full font-medium capitalize">
                        {vendor.category}
                      </span>
                    </div>
                  </div>

                  {/* White Card Body */}
                  <div className="p-4">
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{vendor.phone}</span>
                      </div>
                      {vendor.city && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{vendor.city}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${vendor.is_active ? 'bg-muted text-foreground' : 'bg-gray-100 text-gray-600'}`}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>

                      <div className="flex items-center gap-1">
                        <Link href={`./vendors/purchases?vendorId=${vendor.id}`} className="p-2 text-gray-400 hover:text-foreground hover:bg-muted rounded-lg transition-colors" aria-label="View vendor purchases">
                          <Package className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleView(vendor)} className="p-2 text-gray-400 hover:text-foreground hover:bg-muted rounded-lg transition-colors" aria-label="View vendor details">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(vendor)} className="p-2 text-gray-400 hover:text-foreground hover:bg-muted rounded-lg transition-colors" aria-label="Edit vendor">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(vendor.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" aria-label="Delete vendor">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredVendors.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-100">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No vendors found</h3>
                <p className="text-sm text-gray-500 mb-4">Try adjusting your filters</p>
                <button onClick={handleAddNew} className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-bold">
                  <Plus className="w-4 h-4" /> Add Vendor
                </button>
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden lg:block bg-white rounded-lg border border-gray-100 overflow-hidden">
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
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${getCategoryColor(vendor.category || 'Paper')}`}>
                        {vendor.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${vendor.is_active ? 'bg-gray-100 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`./vendors/purchases?vendorId=${vendor.id}`} className="p-2 hover:bg-gray-900 text-white rounded-lg" title="View Bills" aria-label="View vendor purchases">
                          <Package className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </Link>
                        <button onClick={() => handleView(vendor)} className="p-2 hover:bg-gray-100 rounded-lg" title="View Details" aria-label="View vendor details">
                          <Eye className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-500" />
                        </button>
                        <button onClick={() => handleEdit(vendor)} className="p-2 hover:bg-gray-100 rounded-lg" title="Edit" aria-label="Edit vendor">
                          <Edit className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(vendor.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Delete" aria-label="Delete vendor">
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
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section">{isEditing ? 'Edit Vendor' : 'Add Vendor'}</h2><button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Name *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="block text-sm font-medium mb-1">Company</label><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Phone *</label><input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Category</label><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">GSTIN</label><input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border rounded-lg" maxLength={15} /></div></div>
              <div><label className="block text-sm font-medium mb-1">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} /></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div><div><label className="block text-sm font-medium mb-1">Status</label><select value={formData.is_active ? 'active' : 'inactive'} onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })} className="w-full px-3 py-2 border rounded-lg"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border rounded-lg">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 flex items-center justify-center gap-2 shadow-sm font-semibold">{saving && <Loader2 className="w-4 h-4 md:w-4.5 md:h-4.5 animate-spin" />}{isEditing ? 'Update' : 'Add'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section">Vendor Details</h2><button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 md:gap-4"><div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center"><span className="text-orange-600 font-bold text-2xl">{selectedVendor.name?.charAt(0)}</span></div><div><h3 className="text-section">{selectedVendor.name}</h3><p className="text-gray-500">{selectedVendor.company}</p><span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${getCategoryColor(selectedVendor.category || 'Paper')}`}>{selectedVendor.category}</span></div></div>
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><Phone className="w-4 h-4 text-gray-400" /><span>{selectedVendor.phone}</span></div>{selectedVendor.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-gray-400" /><span>{selectedVendor.email}</span></div>}{selectedVendor.address && <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-gray-400" /><span>{selectedVendor.address}, {selectedVendor.city}</span></div>}{selectedVendor.gstin && <div className="flex items-center gap-3"><Building2 className="w-4 h-4 text-gray-400" /><span>GSTIN: {selectedVendor.gstin}</span></div>}</div>
              <div className="flex gap-3">
                <Link href={`/admin/finance/vendors/purchases?vendor=${selectedVendor.id}`} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 shadow-sm font-semibold">
                  <Package className="w-4 h-4 md:w-4.5 md:h-4.5" /> Record Bill
                </Link>
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedVendor); }} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Edit</button>
                <button onClick={() => setShowViewModal(false)} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
