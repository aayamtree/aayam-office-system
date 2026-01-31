'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Phone, Mail, MapPin, Edit, Trash2, Eye, X, ArrowLeft, Building2, Loader2, Package } from 'lucide-react';
import { useVendors } from '@/lib/hooks';
import { Vendor } from '@/types/database';

const categories = ['Paper', 'Ink & Toner', 'Binding', 'Lamination', 'Machinery', 'Packaging', 'Other'];

export default function VendorsPage() {
  const { vendors, loading, createVendor, updateVendor, deleteVendor } = useVendors();

  const [saving, setSaving] = useState(false);
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
    if (confirm('Delete this vendor?')) {
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
    const colors: Record<string, string> = { 'Paper': 'bg-blue-100 text-blue-700', 'Ink & Toner': 'bg-oms-blue text-oms-blue', 'Binding': 'bg-amber-100 text-amber-700', 'Lamination': 'bg-gray-100 text-gray-900', 'Machinery': 'bg-red-100 text-red-700', 'Packaging': 'bg-oms-blue text-oms-blue' };
    return colors[cat] || 'bg-gray-100 text-gray-700';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-oms-blue" /><span className="ml-2">Loading...</span></div>;

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/finance" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"><ArrowLeft size={20} /></Link>
          <div><h1 className="text-xl lg:text-page-title text-gray-900">Vendors</h1><p className="text-sm text-gray-500">{filteredVendors.length} vendors</p></div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/vendors/purchases" className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            <Package size={18} />
            <span className="hidden sm:inline">Purchases & Bills</span>
          </Link>
          <button onClick={handleAddNew} className="flex items-center justify-center gap-2 bg-oms-blue text-white px-4 py-2.5 rounded-xl hover:bg-blue-600">
            <Plus size={18} />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl" /></div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl"><option value="all">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl"><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>

      <div className="space-y-4">
        <>
          {/* Mobile View: Cards */}
          <div className="lg:hidden space-y-4">
            {filteredVendors.map((vendor) => (
              <div key={vendor.id} className="bg-white rounded-lg md:rounded-2xl p-3 md:p-4 border border-gray-100 relative">
                {/* Row 1: Name & Category */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-orange-600 text-section">{vendor.name?.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 leading-tight mobile-card-title">{vendor.name}</h3>
                      <p className="text-xs text-gray-500">{vendor.company || 'Individual'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${getCategoryColor(vendor.category || 'Paper')}`}>
                    {vendor.category}
                  </span>
                </div>

                {/* Row 2: Contact Info */}
                <div className="mb-4 pl-[3.25rem]"> {/* Indent to align with text next to avatar */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Phone size={14} className="text-gray-400" />
                    <span>{vendor.phone}</span>
                  </div>
                  {vendor.city && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin size={12} className="text-gray-400" />
                      <span>{vendor.city}</span>
                    </div>
                  )}
                </div>

                {/* Row 3: Footer */}
                <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${vendor.is_active ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${vendor.is_active ? 'bg-white0' : 'bg-gray-400'}`}></div>
                    {vendor.is_active ? 'Active' : 'Inactive'}
                  </span>

                  <div className="flex items-center gap-1">
                    <Link href={`./vendors/purchases?vendorId=${vendor.id}`} className="p-2 bg-oms-blue text-oms-blue rounded-lg">
                      <Package size={16} />
                    </Link>
                    <button onClick={() => handleView(vendor)} className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => handleEdit(vendor)} className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(vendor.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredVendors.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <Package size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No vendors found</h3>
                <p className="text-sm text-gray-500 mb-4">Try adjusting your filters</p>
                <button onClick={handleAddNew} className="inline-flex items-center gap-2 bg-oms-blue text-white px-4 py-2 rounded-xl text-sm font-bold">
                  <Plus size={16} /> Add Vendor
                </button>
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
                        <Link href={`./vendors/purchases?vendorId=${vendor.id}`} className="p-2 hover:bg-oms-blue text-oms-blue rounded-lg" title="View Bills">
                          <Package size={18} />
                        </Link>
                        <button onClick={() => handleView(vendor)} className="p-2 hover:bg-gray-100 rounded-lg" title="View Details">
                          <Eye size={18} className="text-gray-500" />
                        </button>
                        <button onClick={() => handleEdit(vendor)} className="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                          <Edit size={18} className="text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(vendor.id)} className="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 size={18} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No vendors found. <button onClick={handleAddNew} className="text-oms-blue font-bold hover:underline">Add New Vendor</button>
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
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section">{isEditing ? 'Edit Vendor' : 'Add Vendor'}</h2><button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Name *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-xl" /></div><div><label className="block text-sm font-medium mb-1">Company</label><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-3 py-2 border rounded-xl" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Phone *</label><input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 border rounded-xl" /></div><div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border rounded-xl" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">Category</label><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-xl">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">GSTIN</label><input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border rounded-xl" maxLength={15} /></div></div>
              <div><label className="block text-sm font-medium mb-1">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border rounded-xl" rows={2} /></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border rounded-xl" /></div><div><label className="block text-sm font-medium mb-1">Status</label><select value={formData.is_active ? 'active' : 'inactive'} onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })} className="w-full px-3 py-2 border rounded-xl"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border rounded-xl">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-oms-blue text-white rounded-xl flex items-center justify-center gap-2">{saving && <Loader2 size={18} className="animate-spin" />}{isEditing ? 'Update' : 'Add'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section">Vendor Details</h2><button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button></div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 md:gap-4"><div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center"><span className="text-orange-600 font-bold text-2xl">{selectedVendor.name?.charAt(0)}</span></div><div><h3 className="text-section">{selectedVendor.name}</h3><p className="text-gray-500">{selectedVendor.company}</p><span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${getCategoryColor(selectedVendor.category || 'Paper')}`}>{selectedVendor.category}</span></div></div>
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl"><div className="flex items-center gap-3"><Phone size={16} className="text-gray-400" /><span>{selectedVendor.phone}</span></div>{selectedVendor.email && <div className="flex items-center gap-3"><Mail size={16} className="text-gray-400" /><span>{selectedVendor.email}</span></div>}{selectedVendor.address && <div className="flex items-center gap-3"><MapPin size={16} className="text-gray-400" /><span>{selectedVendor.address}, {selectedVendor.city}</span></div>}{selectedVendor.gstin && <div className="flex items-center gap-3"><Building2 size={16} className="text-gray-400" /><span>GSTIN: {selectedVendor.gstin}</span></div>}</div>
              <div className="flex gap-3">
                <Link href="/admin/finance/vendors/purchases" className="flex-1 px-4 py-2.5 bg-oms-blue text-oms-blue rounded-xl font-medium text-center hover:bg-oms-blue flex items-center justify-center gap-2">
                  <Package size={18} /> Record Bill
                </Link>
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedVendor); }} className="flex-1 px-4 py-2.5 border rounded-xl font-medium">Edit</button>
                <button onClick={() => setShowViewModal(false)} className="flex-1 px-4 py-2.5 bg-oms-blue text-white rounded-xl font-medium">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
