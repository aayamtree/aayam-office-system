'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
  Truck, Phone, Mail, MapPin, Building2, FileText, Loader2
} from 'lucide-react';
import { useVendors } from '@/lib/hooks';
import { Vendor } from '@/types/database';

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

export default function TransportersPage() {
  const { vendors, loading, createVendor, updateVendor, deleteVendor } = useVendors();
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTransporter, setSelectedTransporter] = useState<Vendor | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter only transporters
  const transporters = vendors.filter(v => v.category === 'transporter');

  const [formData, setFormData] = useState({
    company: '', // Transporter Company Name
    name: '',    // Contact Person
    phone: '',
    email: '', // Not in UI previously but good to have
    gstin: '',
    address: '',
    city: '',
    state: 'Gujarat',
    pincode: '',
    notes: '', // Will store service areas here if needed
    is_active: true,
  });

  const filteredTransporters = transporters.filter(t => {
    const companyName = t.company || t.name;
    const matchesSearch =
      companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase());

    // Simple state filter
    const matchesState = stateFilter === 'all' || t.state === stateFilter;
    return matchesSearch && matchesState;
  });

  // Group by state
  const groupedByState = filteredTransporters.reduce((acc, t) => {
    const state = t.state || 'Unknown';
    if (!acc[state]) acc[state] = [];
    acc[state].push(t);
    return acc;
  }, {} as Record<string, Vendor[]>);

  const handleAddNew = () => {
    setFormData({
      company: '', name: '', phone: '', email: '',
      gstin: '', address: '', city: '', state: 'Gujarat', pincode: '',
      notes: '', is_active: true,
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (t: Vendor) => {
    setFormData({
      company: t.company || '',
      name: t.name,
      phone: t.phone,
      email: t.email || '',
      gstin: t.gstin || '',
      address: t.address || '',
      city: t.city || '',
      state: t.state || 'Gujarat',
      pincode: '',
      notes: '',
      is_active: t.is_active,
    });
    setSelectedTransporter(t);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleView = (t: Vendor) => {
    setSelectedTransporter(t);
    setShowViewModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this transporter?')) {
      await deleteVendor(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    console.log("Submitting form data:", formData);

    try {
      const payload = {
        name: formData.name, // Contact Person
        company: formData.company, // Company Name
        phone: formData.phone,
        email: formData.email,
        gstin: formData.gstin,
        address: formData.address, // + (formData.pincode ? ` - ${formData.pincode}` : ''),
        city: formData.city,
        state: formData.state,
        category: 'transporter',
        payment_terms: 0,
        outstanding_balance: 0,
        is_active: formData.is_active,
      };

      if (isEditing && selectedTransporter) {
        await updateVendor(selectedTransporter.id, payload);
      } else {
        await createVendor(payload);
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert('Failed to save transporter');
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueStates = Array.from(new Set(transporters.map(t => t.state || 'Unknown'))).sort();

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6 px-2 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/dispatch" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl lg:text-page-title text-gray-900">Transporters</h1>
            <p className="text-sm text-gray-500">{transporters.length} transporters registered</p>
          </div>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-md hover:bg-gray-800 shadow-sm font-semibold"
        >
          <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
          <span>Add Transporter</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 md:w-4.5 md:h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search transporters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg"
        >
          <option value="all">All States</option>
          {uniqueStates.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </div>

      {/* State-wise Grouped List */}
      <div className="space-y-6">
        {Object.entries(groupedByState).sort((a, b) => a[0].localeCompare(b[0])).map(([state, stateTransporters]) => (
          <div key={state}>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-section text-gray-900">{state}</h2>
              <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
                {stateTransporters.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
              {stateTransporters.map((t) => (
                <div key={t.id} className="bg-white rounded-lg p-4 border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                        <Truck className="w-4 h-4 md:w-4.5 md:h-4.5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{t.company || t.name}</h3>
                        <p className="text-sm text-gray-500">{t.name}</p> {/* Contact Person */}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${t.is_active ? 'bg-gray-100 text-gray-900' : 'bg-red-100 text-red-500'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${t.phone}`} className="text-primary">{t.phone}</a>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{t.city}, {t.state}</span>
                    </div>
                    {t.gstin && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs">{t.gstin}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button onClick={() => handleView(t)} className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                      <Eye className="w-4 h-4" /> View
                    </button>
                    <button onClick={() => handleEdit(t)} className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                      <Edit className="w-4 h-4" /> Edit
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-section text-gray-900">
                {isEditing ? 'Edit Transporter' : 'Add Transporter'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="e.g. Shree Ganesh Transport"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="e.g. Ramesh Patel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <textarea
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <select
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="">Select</option>
                    {indianStates.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-gray-400"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active Transporter</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 shadow-sm font-semibold">
                  {submitting ? 'Saving...' : (isEditing ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedTransporter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-section text-gray-900">Transporter Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 md:gap-4 p-4 bg-muted rounded-lg">
                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedTransporter.company || selectedTransporter.name}</h3>
                  <p className="text-sm text-gray-500">{selectedTransporter.city}, {selectedTransporter.state}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Contact Person</span>
                  <span className="font-medium text-gray-900">{selectedTransporter.name}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Phone</span>
                  <a href={`tel:${selectedTransporter.phone}`} className="font-medium text-primary">{selectedTransporter.phone}</a>
                </div>
                {selectedTransporter.email && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{selectedTransporter.email}</span>
                  </div>
                )}
                {selectedTransporter.gstin && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">GST Number</span>
                    <span className="font-medium text-gray-900">{selectedTransporter.gstin}</span>
                  </div>
                )}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-500 text-sm">Address</span>
                  <p className="font-medium text-gray-900 mt-1">{selectedTransporter.address}</p>
                  <p className="text-sm text-gray-600">{selectedTransporter.city}, {selectedTransporter.state}</p>
                </div>
              </div>

              <button
                onClick={() => setShowViewModal(false)}
                className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 shadow-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
