'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Palette, Phone, Mail, MapPin,
    Calendar, Briefcase, Edit, Trash2, Eye, X,
    CheckCircle, Users, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

export default function DesignersManager() {
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

            if (error && (error.message?.includes('column') || error.code === '42703')) {
                // Fallback if column missing
                const { document_url, ...safeData } = designerData;
                if (editingDesigner) {
                    ({ error } = await supabase.from('designers').update(safeData).eq('id', editingDesigner.id));
                } else {
                    ({ error } = await supabase.from('designers').insert([safeData]));
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
        if (!confirm('Delete this designer?')) return;
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
            'full-time': 'bg-green-100 text-green-700',
            'part-time': 'bg-blue-100 text-blue-700',
            'freelance': 'bg-[rgba(0,0,255,0.1)] text-oms-blue'
        };
        return badges[type] || 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Designers Directory</h2>
                    <p className="text-sm text-gray-500">{activeDesigners} active of {totalDesigners} total</p>
                </div>
                <button onClick={() => { resetForm(); setShowModal(true); }}
                    className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors">
                    <Plus size={18} /><span>Add Designer</span>
                </button>
            </div>

            {/* Stats - Mini */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border flex items-center gap-3">
                    <div className="p-2 bg-[rgba(0,0,255,0.1)] rounded-lg text-oms-blue"><Users size={18} /></div>
                    <div><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold">{totalDesigners}</p></div>
                </div>
                <div className="bg-white p-3 rounded-xl border flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg text-green-600"><CheckCircle size={18} /></div>
                    <div><p className="text-xs text-gray-500">Active</p><p className="text-lg font-bold">{activeDesigners}</p></div>
                </div>
                <div className="bg-white p-3 rounded-xl border flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Briefcase size={18} /></div>
                    <div><p className="text-xs text-gray-500">Full-time</p><p className="text-lg font-bold">{designers.filter(d => d.employment_type === 'full-time').length}</p></div>
                </div>
                <div className="bg-white p-3 rounded-xl border flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Palette size={18} /></div>
                    <div><p className="text-xs text-gray-500">Freelance</p><p className="text-lg font-bold">{designers.filter(d => d.employment_type === 'freelance').length}</p></div>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDesigners.map(designer => (
                    <div key={designer.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow group">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-[rgba(0,0,255,0.1)] rounded-full flex items-center justify-center text-oms-blue font-bold text-lg">
                                    {designer.name?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{designer.name}</h3>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getEmploymentBadge(designer.employment_type)}`}>{designer.employment_type}</span>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(designer)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Edit size={14} /></button>
                                <button onClick={() => handleDelete(designer.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={14} /></button>
                            </div>
                        </div>

                        <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /> {designer.phone}</div>
                            {designer.email && <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400" /> {designer.email}</div>}
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3 h-6 overflow-hidden">
                            {designer.skills?.slice(0, 3).map(s => <span key={s} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600">{s}</span>)}
                        </div>

                        <div className="pt-3 border-t flex justify-between items-center text-sm">
                            <span className="text-gray-500">Rate: <span className="text-gray-900 font-bold">{formatCurrency(designer.hourly_rate)}/hr</span></span>
                            <button onClick={() => handleViewDetail(designer)} className="text-oms-blue hover:text-oms-blue font-medium text-xs flex items-center gap-1"><Eye size={12} /> View Profile</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-bold">{editingDesigner ? 'Edit Designer' : 'Add Designer'}</h2>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            {/* Form fields same as original but tighter */}
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Full Name</label><input required className="w-full border rounded-lg p-2 text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Phone</label><input required className="w-full border rounded-lg p-2 text-sm" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Email</label><input className="w-full border rounded-lg p-2 text-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Type</label>
                                    <select className="w-full border rounded-lg p-2 text-sm" value={formData.employment_type} onChange={e => setFormData({ ...formData, employment_type: e.target.value })}>
                                        <option value="full-time">Full Time</option>
                                        <option value="part-time">Part Time</option>
                                        <option value="freelance">Freelance</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Joined</label>
                                    <input type="date" className="w-full border rounded-lg p-2 text-sm" value={formData.joining_date} onChange={e => setFormData({ ...formData, joining_date: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Hourly Rate</label><input type="number" className="w-full border rounded-lg p-2 text-sm" value={formData.hourly_rate} onChange={e => setFormData({ ...formData, hourly_rate: +e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Monthly Salary</label><input type="number" className="w-full border rounded-lg p-2 text-sm" value={formData.monthly_salary} onChange={e => setFormData({ ...formData, monthly_salary: +e.target.value })} /></div>
                            </div>

                            {/* Skills */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block">Skills</label>
                                <div className="flex flex-wrap gap-2">
                                    {skillOptions.map(skill => (
                                        <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                                            className={`px-2 py-1 rounded text-xs transition-colors border ${formData.skills.includes(skill) ? 'bg-[rgba(0,0,255,0.1)] text-white border-[rgba(0,0,255,0.2)]-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                                            {skill}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Document Upload */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Identity Document</label>
                                <div className="flex items-center gap-2">
                                    <input type="file" onChange={handleFileUpload} className="text-xs w-full" disabled={uploadingDoc} />
                                    {uploadingDoc && <Loader2 className="animate-spin text-oms-blue" size={16} />}
                                </div>
                                {formData.document_url && <a href={formData.document_url} target="_blank" className="text-xs text-blue-600 underline mt-1 block">View Uploaded Doc</a>}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={resetForm} className="flex-1 py-2 border rounded-lg text-sm font-bold text-gray-600">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold">{saving ? 'Saving...' : 'Save Designer'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedDesigner && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 relative">
                        <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-[rgba(0,0,255,0.1)] rounded-full flex items-center justify-center text-2xl font-bold text-oms-blue">{selectedDesigner.name.charAt(0)}</div>
                            <div>
                                <h2 className="text-xl font-bold">{selectedDesigner.name}</h2>
                                <p className="text-gray-500">{selectedDesigner.employment_type}</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-2">
                                <p className="flex items-center gap-2"><Phone size={14} /> {selectedDesigner.phone}</p>
                                <p className="flex items-center gap-2"><Mail size={14} /> {selectedDesigner.email}</p>
                                <p className="flex items-center gap-2"><MapPin size={14} /> {selectedDesigner.city}, {selectedDesigner.state}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 border rounded-lg">
                                    <p className="text-xs text-gray-500">Hourly</p>
                                    <p className="font-bold">{formatCurrency(selectedDesigner.hourly_rate)}</p>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <p className="text-xs text-gray-500">Monthly</p>
                                    <p className="font-bold">{formatCurrency(selectedDesigner.monthly_salary)}</p>
                                </div>
                            </div>
                            {selectedDesigner.document_url && (
                                <a href={selectedDesigner.document_url} target="_blank" className="block text-center py-2 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold">View ID Document</a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
