'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Phone, Mail, MapPin,
  Edit, Trash2, Eye, X, ArrowLeft, Building2, Loader2
} from 'lucide-react';
import { useClients } from '@/lib/hooks';
import { Client } from '@/types/database';
import { useAuth } from '@/lib/auth-context';

export default function ClientsPage() {
  const { profile } = useAuth();
  const { clients, loading, createClient, updateClient, deleteClient } = useClients();

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', is_active: true,
  });

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? client.is_active : !client.is_active);

    // RBAC: Marketers only see their own clients
    if (profile?.role === 'marketing') {
      if (client.created_by !== profile.id) return false;
    }

    return matchesSearch && matchesStatus;
  });

  const handleAddNew = () => {
    setFormData({ name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', is_active: true });
    setIsEditing(false);
    setSelectedClient(null);
    setShowModal(true);
  };

  const handleEdit = (client: Client) => {
    setFormData({
      name: client.name || '',
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      gstin: client.gstin || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || 'Gujarat',
      is_active: client.is_active
    });
    setSelectedClient(client);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleView = (client: Client) => {
    setSelectedClient(client);
    setShowViewModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this client?')) {
      try {
        await deleteClient(id);
      } catch (error) {
        console.error('Error:', error);
        alert('Error deleting');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing && selectedClient) {
        await updateClient(selectedClient.id, formData);
      } else {
        await createClient({
          ...formData,
          client_type: 'regular',
          credit_limit: 0,
          created_by: profile?.id // Explicitly track creator
        });
      }
      setShowModal(false);
      setIsEditing(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Error:', error);
      alert('Error saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-oms-blue" /><span className="ml-2">Loading...</span></div>;

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6 px-2 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"><ArrowLeft size={20} /></Link>
          <div><h1 className="text-lg md:text-xl lg:text-page-title text-gray-900">Clients</h1><p className="text-xs md:text-sm text-gray-500">{filteredClients.length} clients</p></div>
        </div>
        {profile?.role !== 'marketing' && (
          <button onClick={handleAddNew} className="flex items-center justify-center gap-2 bg-oms-blue text-white px-3 md:px-4 py-2 md:py-2.5 rounded-xl hover:bg-blue-600 transition-colors -900/20 text-sm md:text-base"><Plus size={16} className="md:hidden" /><Plus size={18} className="hidden md:block" /><span>Add Client</span></button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>

      <div className="space-y-4">
        <>
          {/* Mobile View: Cards */}
          <div className="lg:hidden space-y-4">
            {filteredClients.map((client) => {
              // Determine header color based on status
              const headerBg = client.is_active
                ? 'bg-gradient-to-r from-oms-blue to-blue-600'
                : 'bg-gradient-to-r from-gray-400 to-gray-500';

              return (
                <div key={client.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100">
                  {/* Colored Header Tab */}
                  <div className={`${headerBg} px-5 py-3 flex items-center justify-between`}>
                    <span className="text-white font-semibold text-sm md:text-base">
                      {client.company || client.name}
                    </span>
                    <span className="text-white/90 text-xs px-3 py-1 bg-white/20 rounded-full font-medium">
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* White Card Body */}
                  <div className="p-5">
                    {/* Client Name/Subtitle */}
                    <p className="text-gray-500 text-sm mb-1">
                      {client.company ? client.name : 'Individual'}
                    </p>

                    {/* Contact Info */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-gray-900">
                        <Phone size={16} className="text-gray-400" />
                        <span className="font-medium">{client.phone}</span>
                      </div>
                      {client.city && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <MapPin size={14} className="text-gray-400" />
                          <span>{client.city}</span>
                        </div>
                      )}
                    </div>

                    {/* Source Badge */}
                    {profile?.role === 'admin' && (
                      <div className="mb-4 pb-4 border-b border-gray-100">
                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${client.created_by ? 'bg-blue-50 text-oms-blue' : 'bg-gray-100 text-gray-600'}`}>
                          {client.created_by ? 'Marketing Team' : 'Existing Client'}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(client)}
                        className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye size={18} />
                        <span className="hidden sm:inline">View</span>
                      </button>
                      <button
                        onClick={() => handleEdit(client)}
                        className="px-4 py-2.5 border-2 border-gray-900 text-gray-900 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="px-4 py-2.5 border-2 border-red-500 text-red-500 rounded-xl font-medium hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredClients.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No clients found</h3>
                <p className="text-sm text-gray-500 mb-4">Try adjusting your filters</p>
                {profile?.role !== 'marketing' && (
                  <button onClick={handleAddNew} className="inline-flex items-center gap-2 bg-oms-blue text-white px-4 py-2 rounded-xl text-sm font-bold">
                    <Plus size={16} /> Add Client
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                  {profile?.role === 'admin' && <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Source</th>}
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">City</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-oms-blue rounded-full flex items-center justify-center text-oms-blue font-bold">
                          {client.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{client.name}</p>
                          <p className="text-sm text-gray-500">{client.company}</p>
                        </div>
                      </div>
                    </td>
                    {profile?.role === 'admin' && (
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${client.created_by ? 'bg-oms-blue text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {client.created_by ? 'Marketing' : 'Existing'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 font-medium">{client.phone}</p>
                      <p className="text-sm text-gray-500">{client.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{client.city || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${client.is_active ? 'bg-gray-100 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleView(client)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleEdit(client)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No clients found.
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
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section text-gray-900">{isEditing ? 'Edit Client' : 'Add Client'}</h2><button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">Name *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Company</label><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">Phone *</label><input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" /></div></div>
              <div><label className="block text-sm font-medium mb-1 text-gray-700">GSTIN</label><input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" maxLength={15} /></div>
              <div><label className="block text-sm font-medium mb-1 text-gray-700">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" rows={2} /></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Status</label><select value={formData.is_active ? 'active' : 'inactive'} onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border rounded-xl hover:bg-gray-50 transition-colors">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-oms-blue text-white rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors disabled:opacity-50">{saving && <Loader2 size={18} className="animate-spin" />}{isEditing ? 'Update' : 'Add'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section text-gray-900">Client Details</h2><button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button></div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 md:gap-4"><div className="w-16 h-16 bg-oms-blue rounded-full flex items-center justify-center"><span className="text-oms-blue font-bold text-2xl">{selectedClient.name?.charAt(0)}</span></div><div><h3 className="text-section text-gray-900">{selectedClient.name}</h3><p className="text-gray-500">{selectedClient.company}</p></div></div>
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl"><div className="flex items-center gap-3"><Phone size={16} className="text-gray-400" /><span className="text-gray-700">{selectedClient.phone}</span></div>{selectedClient.email && <div className="flex items-center gap-3"><Mail size={16} className="text-gray-400" /><span className="text-gray-700">{selectedClient.email}</span></div>}{selectedClient.address && <div className="flex items-center gap-3"><MapPin size={16} className="text-gray-400" /><span className="text-gray-700">{selectedClient.address}, {selectedClient.city}</span></div>}{selectedClient.gstin && <div className="flex items-center gap-3"><Building2 size={16} className="text-gray-400" /><span className="text-gray-700">GSTIN: {selectedClient.gstin}</span></div>}</div>
              <div className="flex gap-3"><button onClick={() => { setShowViewModal(false); handleEdit(selectedClient); }} className="flex-1 px-4 py-2.5 border rounded-xl hover:bg-gray-50 transition-colors">Edit</button><button onClick={() => setShowViewModal(false)} className="flex-1 px-4 py-2.5 bg-oms-blue text-white rounded-xl hover:bg-blue-600 transition-colors">Close</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
