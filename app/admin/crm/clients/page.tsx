'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Phone, Mail, MapPin, Hash,
  Edit, Trash2, Eye, X, ArrowLeft, Building2, Loader2,
  Briefcase, IndianRupee, ExternalLink
} from 'lucide-react';
import { useClients, useJobs } from '@/lib/hooks';
import { Client } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WhatsAppButton from '@/components/shared/WhatsAppButton';

// Sub-component: Client Jobs & Financial Summary
function ClientJobsSection({ clientId }: { clientId: string }) {
  const { jobs } = useJobs();
  const clientJobs = (jobs || []).filter(j => j.client_id === clientId);
  const totalBilled = clientJobs.reduce((s, j) => s + (j.total_amount || 0), 0);
  const totalReceived = clientJobs.reduce((s, j) => s + (j.amount_received || 0), 0);
  const outstanding = totalBilled - totalReceived;

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-blue-100 text-blue-700', 'designing': 'bg-purple-100 text-purple-700',
      'approval': 'bg-amber-100 text-amber-700', 'printing': 'bg-cyan-100 text-cyan-700',
      'dispatched': 'bg-green-100 text-green-700', 'delivered': 'bg-gray-100 text-gray-700',
      'cancelled': 'bg-red-100 text-red-700',
    };
    return colors[stage] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-3">
      {/* Financial Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-xs text-gray-500">Total Billed</p>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-xs text-gray-500">Received</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3 text-center">
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className={`text-sm font-bold ${outstanding > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(outstanding)}</p>
        </div>
      </div>

      {/* Recent Jobs */}
      {clientJobs.length > 0 ? (
        <div className="border border-gray-100 rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase">Recent Jobs</span>
            <span className="text-xs text-gray-400">{clientJobs.length} total</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
            {clientJobs.slice(0, 5).map(job => (
              <div key={job.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.project_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{job.job_number}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-700">{formatCurrency(job.total_amount)}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${getStageColor(job.current_stage)}`}>
                    {job.current_stage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-gray-400 bg-gray-50 rounded-md">No jobs yet</div>
      )}
    </div>
  );
}

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
    name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', is_active: true, brand_name: '',
  });

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone?.includes(searchQuery) ||
      client.brand_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? client.is_active : !client.is_active);

    // RBAC: Marketers only see their own clients
    if (profile?.role === 'marketing') {
      if (client.created_by !== profile.id) return false;
    }

    return matchesSearch && matchesStatus;
  });

  const handleAddNew = () => {
    setFormData({ name: '', company: '', email: '', phone: '', gstin: '', address: '', city: '', state: 'Gujarat', is_active: true, brand_name: '' });
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
      is_active: client.is_active,
      brand_name: client.brand_name || '',
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="ml-2">Loading...</span></div>;

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-3 md:space-y-6 px-2 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/crm" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"><ArrowLeft className="w-5 h-5" /></Link>
          <div><h1 className="text-lg md:text-xl lg:text-page-title text-gray-900">Clients</h1><p className="text-xs md:text-sm text-gray-500">{filteredClients.length} clients</p></div>
        </div>
        {profile?.role !== 'marketing' && (
          <button onClick={handleAddNew} className="flex items-center justify-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-md hover:bg-gray-800 transition-colors shadow-sm font-semibold text-sm md:text-base"><Plus className="w-4 h-4 md:hidden" /><Plus className="w-4 h-4 hidden md:block" /><span>Add Client</span></button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="text" placeholder="Search name, company, brand..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
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
            {filteredClients.map((client) => {
              const headerBg = client.is_active ? 'bg-gray-900' : 'bg-gray-400';

              return (
                <div key={client.id} className="bg-white rounded-md overflow-hidden hover:shadow-sm transition-all border border-gray-200">
                  {/* Header */}
                  <div className={`${headerBg} px-4 py-2.5 flex items-center justify-between`}>
                    <span className="text-white font-semibold text-sm">
                      {client.company || client.name}
                    </span>
                    <span className="text-white/90 text-xs px-2 py-0.5 bg-white/15 rounded-md font-medium">
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-3">
                    <p className="text-gray-500 text-sm mb-1">
                      {client.company ? client.name : 'Individual'}
                    </p>

                    {/* Brand Tags */}
                    {client.brand_name && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {client.brand_name.split(/\s+/).filter(Boolean).map((tag, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md font-medium">
                            {tag.startsWith('#') ? tag : `#${tag}`}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-gray-900 text-sm">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">{client.phone}</span>
                      </div>
                      {client.city && (
                        <div className="flex items-center gap-2 text-gray-600 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>{client.city}</span>
                        </div>
                      )}
                    </div>

                    {/* Source Badge */}
                    {profile?.role === 'admin' && (
                      <div className="mb-3 pb-3 border-b border-gray-100">
                        <span className={`px-2 py-1 text-xs font-medium rounded-md ${client.created_by ? 'bg-muted text-foreground' : 'bg-gray-100 text-gray-600'}`}>
                          {client.created_by ? 'Marketing Team' : 'Existing Client'}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(client)}
                        className="flex-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(client)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="px-3 py-1.5 border border-red-200 text-red-500 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredClients.length === 0 && (
              <div className="text-center py-12 bg-white rounded-md border border-gray-200">
                <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No clients found</h3>
                <p className="text-sm text-gray-500 mb-4">Try adjusting your filters</p>
                {profile?.role !== 'marketing' && (
                  <button onClick={handleAddNew} className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-800 shadow-sm">
                    <Plus className="w-4 h-4" /> Add Client
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden lg:block bg-white rounded-md border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                  {profile?.role === 'admin' && <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Source</th>}
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Brands</th>
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
                        <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">
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
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${client.created_by ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {client.created_by ? 'Marketing' : 'Existing'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {client.brand_name ? (
                        <div className="flex flex-wrap gap-1">
                          {client.brand_name.split(/\s+/).filter(Boolean).map((tag, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md font-medium">
                              {tag.startsWith('#') ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 font-medium">{client.phone}</p>
                      <p className="text-sm text-gray-500">{client.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{client.city || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide ${client.is_active ? 'bg-gray-100 text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleView(client)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" aria-label="View client details">
                          <Eye className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </button>
                        <button onClick={() => handleEdit(client)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors" aria-label="Edit client">
                          <Edit className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </button>
                        <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4 md:w-4.5 md:h-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
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
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b"><h2 className="text-section text-gray-900">{isEditing ? 'Edit Client' : 'Add Client'}</h2><button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">Name *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Company</label><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">Phone *</label><input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div></div>
              <div><label className="block text-sm font-medium mb-1 text-gray-700">GSTIN</label><input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" maxLength={15} /></div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Brands <span className="text-gray-400 font-normal">(#hashtag format)</span></label>
                <div className="relative">
                  <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={formData.brand_name} onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="#tiger #cobra #premium" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Add brand names separated by spaces, e.g. #tiger #cobra</p>
              </div>
              <div><label className="block text-sm font-medium mb-1 text-gray-700">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" rows={2} /></div>
              <div className="grid grid-cols-2 gap-2 md:gap-4"><div><label className="block text-sm font-medium mb-1 text-gray-700">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400" /></div><div><label className="block text-sm font-medium mb-1 text-gray-700">Status</label><select value={formData.is_active ? 'active' : 'inactive'} onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-gray-700 font-semibold">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50 font-semibold shadow-sm">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{isEditing ? 'Update' : 'Add'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-section text-gray-900">Client Profile</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Client Identity */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-2xl">{selectedClient.name?.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-section text-gray-900">{selectedClient.name}</h3>
                  <p className="text-gray-500">{selectedClient.company}</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-full ${selectedClient.client_type === 'premium' ? 'bg-amber-100 text-amber-700' :
                    selectedClient.client_type === 'corporate' ? 'bg-gray-900 text-white' :
                      'bg-gray-100 text-gray-700'
                    }`}>{selectedClient.client_type}</span>
                </div>
              </div>

              {/* Brands */}
              {selectedClient.brand_name && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedClient.brand_name.split(/\s+/).filter(Boolean).map((tag, i) => (
                    <span key={i} className="text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-2 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{selectedClient.phone}</span><WhatsAppButton phone={selectedClient.phone} /></div>
                {selectedClient.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{selectedClient.email}</span></div>}
                {selectedClient.address && <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-gray-400" /><span className="text-gray-700">{selectedClient.address}, {selectedClient.city}</span></div>}
                {selectedClient.gstin && <div className="flex items-center gap-3"><Building2 className="w-4 h-4 text-gray-400" /><span className="text-gray-700">GSTIN: {selectedClient.gstin}</span></div>}
              </div>

              {/* Client Jobs */}
              <ClientJobsSection clientId={selectedClient.id} />

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => { setShowViewModal(false); handleEdit(selectedClient); }} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-gray-700 font-semibold">Edit</button>
                <Link href={`/admin/jobs?client=${selectedClient.id}`} className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors font-semibold shadow-sm text-center flex items-center justify-center gap-2">
                  <Briefcase className="w-4 h-4" /> View All Jobs
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
