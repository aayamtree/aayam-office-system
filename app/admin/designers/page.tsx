'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Palette, Phone, Mail, MapPin, Clock,
  Calendar, IndianRupee, Briefcase, Edit, Trash2, Eye, X,
  CheckCircle, TrendingUp, Users, Loader2, Upload, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';

interface Designer {
  id: string;
  name: string;
  phone: string;
  email: string;
  skills: string[];
  joining_date: string;
  employment_type: string;
  hourly_rate: number;
  monthly_salary: number;
  is_active: boolean;
  city: string;
  state: string;
  created_at: string;
  document_url?: string;
}

const skillOptions = [
  'Logo Design', 'Brochure', 'Packaging', 'Social Media',
  'Wedding Cards', 'Invitations', 'Flex Design', 'Banner',
  '3D Design', 'Product Packaging', 'Label Design',
  'UI/UX', 'Web Design', 'App Design', 'Illustration'
];

const employmentTypes = ['full-time', 'part-time', 'freelance'];

export default function DesignersPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingDesigner, setEditingDesigner] = useState<Designer | null>(null);
  const [selectedDesigner, setSelectedDesigner] = useState<Designer | null>(null);
  const confirm = useConfirm();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    skills: [] as string[],
    joining_date: '',
    employment_type: 'full-time',
    hourly_rate: 0,
    monthly_salary: 0,
    is_active: true,
    city: '',
    state: 'Gujarat',
    document_url: ''
  });

  const [uploadingDoc, setUploadingDoc] = useState(false);

  // ADMIN-ONLY PAGE — redirect non-admin users
  if (profile && profile.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500 mb-6">This page is only accessible to administrators.</p>
        <button
          onClick={() => router.push(profile.role === 'designer' ? '/admin/designers/tasks' : '/admin/dashboard')}
          className="px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium"
        >
          Go to My Dashboard
        </button>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      setUploadingDoc(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `identity-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, document_url: publicUrl }));
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  useEffect(() => {
    fetchDesigners();
  }, []);

  const fetchDesigners = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('designers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) console.error('Error:', error);
      setDesigners(data || []);
    } catch (error) {
      console.error('Error fetching designers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const totalDesigners = designers.length;
  const activeDesigners = designers.filter(d => d.is_active).length;

  // Filter designers
  const filteredDesigners = designers.filter(designer => {
    const matchesSearch = designer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      designer.phone?.includes(searchTerm) ||
      designer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? designer.is_active : !designer.is_active);
    const matchesSkill = skillFilter === 'all' || designer.skills?.includes(skillFilter);
    return matchesSearch && matchesStatus && matchesSkill;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const designerData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        skills: formData.skills,
        joining_date: formData.joining_date || null,
        employment_type: formData.employment_type,
        hourly_rate: formData.hourly_rate,
        monthly_salary: formData.monthly_salary,
        is_active: formData.is_active,
        city: formData.city || null,
        state: formData.state || null,
        document_url: formData.document_url || null
      };

      let error;
      if (editingDesigner) {
        ({ error } = await supabase
          .from('designers')
          .update(designerData)
          .eq('id', editingDesigner.id));
      } else {
        ({ error } = await supabase
          .from('designers')
          .insert([designerData]));
      }

      // Fallback: If document_url column is missing, retry without it
      if (error && (error.message?.includes('column') || error.code === '42703')) {
        console.warn('Column document_url missing, retrying without it...');
        const { document_url, ...safeData } = designerData;

        if (editingDesigner) {
          ({ error } = await supabase
            .from('designers')
            .update(safeData)
            .eq('id', editingDesigner.id));
        } else {
          ({ error } = await supabase
            .from('designers')
            .insert([safeData]));
        }

        if (!error) {
          alert('Designer saved successfully, but Identity Document could not be saved because the "document_url" column is missing in the database. Please contact admin to add this column.');
        }
      }

      if (error) throw error;

      await fetchDesigners();
      resetForm();
    } catch (error) {
      console.error('Error saving designer:', error);
      alert('Error saving designer');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      skills: [],
      joining_date: '',
      employment_type: 'full-time',
      hourly_rate: 0,
      monthly_salary: 0,
      is_active: true,
      city: '',
      state: 'Gujarat',
      document_url: ''
    });
    setEditingDesigner(null);
    setShowModal(false);
  };

  const handleEdit = (designer: Designer) => {
    setFormData({
      name: designer.name || '',
      phone: designer.phone || '',
      email: designer.email || '',
      skills: designer.skills || [],
      joining_date: designer.joining_date || '',
      employment_type: designer.employment_type || 'full-time',
      hourly_rate: designer.hourly_rate || 0,
      monthly_salary: designer.monthly_salary || 0,
      is_active: designer.is_active,
      city: designer.city || '',
      state: designer.state || 'Gujarat',
      document_url: designer.document_url || ''
    });
    setEditingDesigner(designer);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete Designer', message: 'Are you sure you want to delete this designer?', variant: 'danger', confirmLabel: 'Delete' });
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('designers').delete().eq('id', id);
      if (error) throw error;
      setDesigners(designers.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error:', error);
      alert('Error deleting designer');
    }
  };

  const handleViewDetail = (designer: Designer) => {
    setSelectedDesigner(designer);
    setShowDetailModal(true);
  };

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  const getEmploymentBadge = (type: string) => {
    const badges: Record<string, string> = {
      'full-time': 'bg-gray-100 text-gray-900',
      'part-time': 'bg-muted text-foreground',
      'freelance': 'bg-gray-900 text-white'
    };
    return badges[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading designers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h1 className="text-page-title text-gray-900">Designers</h1>
          <p className="text-sm text-gray-500">{activeDesigners} active of {totalDesigners} total</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg hover:bg-gray-800">
          <Plus size={18} /><span>Add Designer</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-900 rounded-lg"><Users size={20} className="text-white" /></div>
            <div><p className="text-xs text-gray-500">Total</p><p className="text-page-title">{totalDesigners}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg"><CheckCircle size={20} className="text-gray-900" /></div>
            <div><p className="text-xs text-gray-500">Active</p><p className="text-page-title text-gray-900">{activeDesigners}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg"><Briefcase size={20} className="text-foreground" /></div>
            <div><p className="text-xs text-gray-500">Full-time</p><p className="text-page-title text-foreground">{designers.filter(d => d.employment_type === 'full-time').length}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg"><Palette size={20} className="text-orange-600" /></div>
            <div><p className="text-xs text-gray-500">Freelance</p><p className="text-page-title text-orange-600">{designers.filter(d => d.employment_type === 'freelance').length}</p></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search designers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
            <SelectValue placeholder="All Skills" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            {skillOptions.map(skill => <SelectItem key={skill} value={skill}>{skill}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Empty State */}
      {filteredDesigners.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Palette size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium mb-2">No designers found</h3>
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg">
            <Plus size={18} />Add Designer
          </button>
        </div>
      )}

      {/* Designer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
        {filteredDesigners.map(designer => (
          <div key={designer.id} className="bg-white rounded-lg border p-4  transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center">
                  <span className="text-white text-section">{designer.name?.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold">{designer.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getEmploymentBadge(designer.employment_type)}`}>
                    {designer.employment_type}
                  </span>
                </div>
              </div>
              <span className={`w-2 h-2 rounded-full ${designer.is_active ? 'bg-white0' : 'bg-gray-300'}`}></span>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-3">
              <div className="flex items-center gap-2"><Phone size={14} />{designer.phone}</div>
              {designer.email && <div className="flex items-center gap-2"><Mail size={14} />{designer.email}</div>}
              {designer.city && <div className="flex items-center gap-2"><MapPin size={14} />{designer.city}</div>}
            </div>

            {designer.skills && designer.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {designer.skills.slice(0, 3).map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 bg-muted text-primary rounded text-xs">{skill}</span>
                ))}
                {designer.skills.length > 3 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{designer.skills.length - 3}</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="text-sm">
                <span className="text-gray-500">Rate:</span>
                <span className="font-medium ml-1">{formatCurrency(designer.hourly_rate)}/hr</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleViewDetail(designer)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <Eye size={16} className="text-gray-500" />
                </button>
                <button onClick={() => handleEdit(designer)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <Edit size={16} className="text-gray-500" />
                </button>
                <button onClick={() => handleDelete(designer.id)} className="p-2 hover:bg-red-50 rounded-lg">
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-section">{editingDesigner ? 'Edit Designer' : 'Add Designer'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-md"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone *</label>
                  <input type="tel" required value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Employment Type</label>
                  <select value={formData.employment_type}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Joining Date</label>
                  <input type="date" value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Hourly Rate (₹)</label>
                  <input type="number" min="0" value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monthly Salary (₹)</label>
                  <input type="number" min="0" value={formData.monthly_salary}
                    onChange={(e) => setFormData({ ...formData, monthly_salary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input type="text" value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select value={formData.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>


              {/* Identity Document Upload */}
              <div>
                <label className="block text-sm font-medium mb-1">Identity Document (Image/PDF)</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-primary hover:file:bg-primary"
                      disabled={uploadingDoc}
                    />
                    {uploadingDoc && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin text-primary" /></div>}
                  </div>
                  {formData.document_url && (
                    <a href={formData.document_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white text-gray-900 rounded-md hover:bg-gray-100" title="View Document">
                      <Eye size={20} />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {skillOptions.map(skill => (
                    <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${formData.skills.includes(skill)
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-md font-medium">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-md font-medium flex items-center justify-center gap-2">
                  {saving && <Loader2 size={18} className="animate-spin" />}
                  {editingDesigner ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div >
      )
      }

      {/* Detail Modal */}
      {
        showDetailModal && selectedDesigner && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xl">{selectedDesigner.name?.charAt(0)}</span>
                    </div>
                    <div>
                      <h2 className="text-page-title">{selectedDesigner.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getEmploymentBadge(selectedDesigner.employment_type)}`}>
                        {selectedDesigner.employment_type}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Contact */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-3"><Phone size={16} className="text-gray-400" />{selectedDesigner.phone}</div>
                    {selectedDesigner.email && <div className="flex items-center gap-3"><Mail size={16} className="text-gray-400" />{selectedDesigner.email}</div>}
                    {selectedDesigner.city && <div className="flex items-center gap-3"><MapPin size={16} className="text-gray-400" />{selectedDesigner.city}, {selectedDesigner.state}</div>}
                    {selectedDesigner.joining_date && <div className="flex items-center gap-3"><Calendar size={16} className="text-gray-400" />Joined: {new Date(selectedDesigner.joining_date).toLocaleDateString('en-IN')}</div>}
                  </div>
                </div>

                {/* Rate */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Hourly Rate</p>
                    <p className="text-page-title text-primary">{formatCurrency(selectedDesigner.hourly_rate)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Monthly Salary</p>
                    <p className="text-page-title text-gray-900">{formatCurrency(selectedDesigner.monthly_salary)}</p>
                  </div>
                </div>

                {/* Identity Document Link (Detail View) */}
                {selectedDesigner.document_url && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Identity Document</h3>
                    <a href={selectedDesigner.document_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-muted text-foreground rounded-md hover:bg-muted transition-colors border border-border">
                      <Eye size={18} />
                      <span className="font-medium">View Uploaded Document</span>
                    </a>
                  </div>
                )}

                {/* Skills */}
                {selectedDesigner.skills && selectedDesigner.skills.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedDesigner.skills.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-gray-900 text-white rounded-full text-sm">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowDetailModal(false); handleEdit(selectedDesigner); }}
                    className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Edit</button>
                  <button onClick={() => setShowDetailModal(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium">Close</button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
