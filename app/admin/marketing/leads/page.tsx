'use client';

import { useState } from 'react';
import { 
  Plus, Search, Phone, Mail, Building2, Calendar, Edit, Trash2, Eye, X,
  MessageSquare, UserPlus, Filter, ChevronDown, Clock, MapPin
} from 'lucide-react';

const currentUser = { id: 1, name: 'Marketing User' };

const leadStatuses = [
  { id: 'new', name: 'New', color: 'bg-blue-100 text-blue-700' },
  { id: 'contacted', name: 'Contacted', color: 'bg-purple-100 text-purple-700' },
  { id: 'warm', name: 'Warm', color: 'bg-orange-100 text-orange-700' },
  { id: 'hot', name: 'Hot', color: 'bg-red-100 text-red-700' },
  { id: 'converted', name: 'Converted', color: 'bg-green-100 text-green-700' },
  { id: 'lost', name: 'Lost', color: 'bg-gray-100 text-gray-700' },
];

const leadSources = ['Website', 'Referral', 'Cold Call', 'Social Media', 'Exhibition', 'Walk-in', 'Other'];

const initialLeads = [
  { id: 1, companyName: 'Sharma Industries', contactPerson: 'Rajesh Sharma', phone: '9876543210', email: 'rajesh@sharma.com',
    city: 'Ahmedabad', source: 'Referral', status: 'hot', requirement: 'Wedding cards - 1000 qty', 
    estimatedValue: 50000, createdAt: '2025-12-25', lastContact: '2025-12-25', ownerId: 1 },
  { id: 2, companyName: 'Patel Enterprises', contactPerson: 'Mukesh Patel', phone: '9898989898', email: 'mukesh@patel.com',
    city: 'Rajkot', source: 'Website', status: 'warm', requirement: 'Business cards and letterheads', 
    estimatedValue: 25000, createdAt: '2025-12-24', lastContact: '2025-12-24', ownerId: 1 },
  { id: 3, companyName: 'Gujarat Textiles', contactPerson: 'Amit Shah', phone: '9825123456', email: 'amit@gjtextiles.com',
    city: 'Surat', source: 'Exhibition', status: 'new', requirement: 'Product packaging boxes', 
    estimatedValue: 150000, createdAt: '2025-12-24', lastContact: null, ownerId: 1 },
  { id: 4, companyName: 'Royal Prints', contactPerson: 'Vikram Singh', phone: '9712345678', email: 'vikram@royal.com',
    city: 'Ahmedabad', source: 'Cold Call', status: 'contacted', requirement: 'Brochures and catalogs', 
    estimatedValue: 35000, createdAt: '2025-12-23', lastContact: '2025-12-23', ownerId: 1 },
  { id: 5, companyName: 'Modern Packaging', contactPerson: 'Suresh Kumar', phone: '9823456789', email: 'suresh@modern.com',
    city: 'Vadodara', source: 'Referral', status: 'converted', requirement: 'Corrugated boxes - bulk', 
    estimatedValue: 200000, createdAt: '2025-12-20', lastContact: '2025-12-22', ownerId: 1 },
];

export default function MarketingLeadsPage() {
  const [leads, setLeads] = useState(initialLeads.filter(l => l.ownerId === currentUser.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const [formData, setFormData] = useState({
    companyName: '', contactPerson: '', phone: '', email: '', city: '',
    source: 'Website', status: 'new', requirement: '', estimatedValue: 0
  });

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLead) {
      setLeads(leads.map(l => l.id === editingLead.id ? { ...l, ...formData } : l));
    } else {
      const newLead = {
        id: Date.now(), ...formData, createdAt: new Date().toISOString().split('T')[0],
        lastContact: null, ownerId: currentUser.id
      };
      setLeads([newLead, ...leads]);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ companyName: '', contactPerson: '', phone: '', email: '', city: '',
      source: 'Website', status: 'new', requirement: '', estimatedValue: 0 });
    setEditingLead(null);
    setShowModal(false);
  };

  const handleEdit = (lead: any) => {
    setFormData({ companyName: lead.companyName, contactPerson: lead.contactPerson, phone: lead.phone,
      email: lead.email, city: lead.city, source: lead.source, status: lead.status,
      requirement: lead.requirement, estimatedValue: lead.estimatedValue });
    setEditingLead(lead);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this lead?')) setLeads(leads.filter(l => l.id !== id));
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const getStatusBadge = (status: string) => leadStatuses.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-700';

  // Stats
  const totalLeads = leads.length;
  const hotLeads = leads.filter(l => l.status === 'hot').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const totalValue = leads.reduce((sum, l) => sum + l.estimatedValue, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leads</h1>
          <p className="text-gray-500">Manage your assigned leads</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium">
          <UserPlus size={18} />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Total Leads</p>
          <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Hot Leads</p>
          <p className="text-2xl font-bold text-red-600">{hotLeads}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Converted</p>
          <p className="text-2xl font-bold text-green-600">{convertedLeads}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Pipeline Value</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search by company, contact, phone..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            {leadStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Sources</option>
            {leadSources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredLeads.map(lead => (
          <div key={lead.id} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
            lead.status === 'hot' ? 'border-l-4 border-l-red-500' : 
            lead.status === 'warm' ? 'border-l-4 border-l-orange-400' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{lead.companyName}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(lead.status)}`}>
                    {lead.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{lead.source}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1"><Building2 size={14} />{lead.contactPerson}</span>
                  <span className="flex items-center gap-1"><Phone size={14} />{lead.phone}</span>
                  <span className="flex items-center gap-1"><MapPin size={14} />{lead.city}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{lead.requirement}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(lead.estimatedValue)}</p>
                  <p className="text-xs text-gray-500">Est. Value</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setSelectedLead(lead); setShowDetailModal(true); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={18} /></button>
                  <button onClick={() => handleEdit(lead)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(lead.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredLeads.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <UserPlus className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No leads found</h3>
          <p className="mt-1 text-gray-500">Start adding leads to grow your pipeline</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Company Name *</label>
                  <input type="text" required value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="Sharma Industries" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Contact Person *</label>
                  <input type="text" required value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="Rajesh Sharma" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone *</label>
                  <input type="tel" required value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="9876543210" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input type="email" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="email@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">City</label>
                  <input type="text" value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="Ahmedabad" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Source</label>
                  <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    {leadSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    {leadStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Requirement</label>
                  <textarea value={formData.requirement}
                    onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" rows={2} placeholder="What they need..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Estimated Value (₹)</label>
                  <input type="number" min="0" value={formData.estimatedValue || ''}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  {editingLead ? 'Update Lead' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedLead.companyName}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(selectedLead.status)}`}>
                  {selectedLead.status}
                </span>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Contact Person</p>
                  <p className="font-medium">{selectedLead.contactPerson}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="font-medium">{selectedLead.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-medium">{selectedLead.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">City</p>
                  <p className="font-medium">{selectedLead.city}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Source</p>
                  <p className="font-medium">{selectedLead.source}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Estimated Value</p>
                  <p className="font-medium text-indigo-600">{formatCurrency(selectedLead.estimatedValue)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Requirement</p>
                <p className="font-medium">{selectedLead.requirement}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <a href={`tel:${selectedLead.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-100 text-green-700 rounded-xl font-medium">
                  <Phone size={18} />Call
                </a>
                <button onClick={() => { setShowDetailModal(false); handleEdit(selectedLead); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-100 text-indigo-700 rounded-xl font-medium">
                  <Edit size={18} />Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
