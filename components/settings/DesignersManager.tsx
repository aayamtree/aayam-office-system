'use client';

import React, { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import {
    Plus, Search, Palette, Phone, Mail, MapPin,
    Calendar, Briefcase, Edit, Trash2, Eye, X,
    CheckCircle, Users, Loader2, Link, UserCheck, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
    user_id?: string; // ← linked system user account
}

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
}

const skillOptions = [
    'Logo Design', 'Brochure', 'Packaging', 'Social Media',
    'Wedding Cards', 'Invitations', 'Flex Design', 'Banner',
    '3D Design', 'Product Packaging', 'Label Design',
    'UI/UX', 'Web Design', 'App Design', 'Illustration'
];

export default function DesignersManager() {
    const [designers, setDesigners] = useState<Designer[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
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
        document_url: '',
        user_id: '' // ← link to profile
    });

    const [uploadingDoc, setUploadingDoc] = useState(false);

    useEffect(() => {
        fetchDesigners();
        fetchProfiles();
    }, []);

    const fetchDesigners = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, is_active, phone, skills, hourly_rate, monthly_salary, employment_type, joining_date, city, state, document_url')
                .eq('role', 'designer')
                .order('full_name');
            if (error) console.error('Error:', error);
            // Map full_name → name for internal UI use
            setDesigners((data || []).map((p: any) => ({ ...p, name: p.full_name })));
        } catch (error) {
            console.error('Error fetching designers:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfiles = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, is_active')
                .eq('is_active', true)
                .order('full_name');
            setProfiles(data || []);
        } catch (error) {
            console.error('Error fetching profiles:', error);
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
            const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
            setFormData(prev => ({ ...prev, document_url: publicUrl }));
        } catch (error: any) {
            toast.error(String('Upload failed: ' + error.message));
        } finally {
            setUploadingDoc(false);
        }
    };

    const totalDesigners = designers.length;
    const activeDesigners = designers.filter(d => d.is_active).length;
    const freelanceDesigners = designers.filter(d => d.employment_type === 'freelance').length;

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
            const profileData = {
                full_name: formData.name,
                phone: formData.phone || null,
                skills: formData.skills,
                joining_date: formData.joining_date || null,
                employment_type: formData.employment_type,
                hourly_rate: formData.hourly_rate,
                monthly_salary: formData.monthly_salary,
                is_active: formData.is_active,
                city: formData.city || null,
                state: formData.state || null,
                document_url: formData.document_url || null,
            };

            let error;
            if (editingDesigner) {
                // Update existing profile
                ({ error } = await supabase
                    .from('profiles')
                    .update(profileData)
                    .eq('id', editingDesigner.id));
            }
            // Note: Creating a brand-new designer profile requires creating
            // an auth user first (done via Supabase Auth / invite flow).
            // The 'Add Designer' form here links/edits existing profiles.

            if (error) throw error;

            toast.success('Designer profile updated!');
            await fetchDesigners();
            resetForm();
        } catch (error) {
            console.error('Error saving designer:', error);
            toast.error('Error saving designer profile');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', phone: '', email: '', skills: [], joining_date: '',
            employment_type: 'full-time', hourly_rate: 0, monthly_salary: 0,
            is_active: true, city: '', state: 'Gujarat', document_url: '', user_id: ''
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
            document_url: designer.document_url || '',
            user_id: designer.user_id || ''
        });
        setEditingDesigner(designer);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        const { confirmed } = await confirm({ title: 'Remove Designer', message: 'This will set the designer as inactive. Their account and jobs are preserved.', variant: 'danger', confirmLabel: 'Remove' });
        if (!confirmed) return;
        try {
            // Demote to inactive — don't delete the profile (would break job history)
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: false })
                .eq('id', id);
            if (error) throw error;
            setDesigners(designers.filter(d => d.id !== id));
            toast.success('Designer set as inactive.');
        } catch (error) {
            toast.error('Error removing designer');
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
            'freelance': 'bg-primary/10 text-primary'
        };
        return badges[type] || 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="space-y-3 md:space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
                <div>
                    <h2 className="text-page-title text-gray-900">Designers Directory</h2>
                    <p className="text-sm text-gray-500">{activeDesigners} active · {totalDesigners} total</p>
                </div>
                <button onClick={() => { resetForm(); setShowModal(true); }}
                    className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors">
                    <Plus size={18} /><span>Add Designer</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-md border flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-md text-primary"><Users size={18} /></div>
                    <div><p className="text-xs text-gray-500">Total</p><p className="text-section">{totalDesigners}</p></div>
                </div>
                <div className="bg-white p-3 rounded-md border flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-md text-green-600"><CheckCircle size={18} /></div>
                    <div><p className="text-xs text-gray-500">Active</p><p className="text-section">{activeDesigners}</p></div>
                </div>
                <div className="bg-white p-3 rounded-md border flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-md text-blue-600"><Briefcase size={18} /></div>
                    <div><p className="text-xs text-gray-500">Full-time</p><p className="text-section">{designers.filter(d => d.employment_type === 'full-time').length}</p></div>
                </div>
                <div className="bg-white p-3 rounded-md border flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-md text-purple-600"><Briefcase size={18} /></div>
                    <div><p className="text-xs text-gray-500">Freelance</p><p className="text-section">{freelanceDesigners}</p></div>
                </div>
            </div>


            {/* Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-4">
                {filteredDesigners.map(designer => {
                    return (
                        <div key={designer.id} className="bg-white rounded-md overflow-hidden border border-gray-200 transition-shadow group">
                            {/* Dark header */}
                            <div className="bg-gray-900 px-3 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                        {designer.name?.charAt(0)}
                                    </div>
                                    <span className="font-semibold text-white text-sm">{designer.name}</span>
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ${designer.employment_type === 'full-time' ? 'bg-green-500/30 text-green-200' : designer.employment_type === 'freelance' ? 'bg-purple-500/30 text-purple-200' : 'bg-blue-500/30 text-blue-200'}`}>
                                        {designer.employment_type}
                                    </span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(designer)} className="p-1 hover:bg-white/20 rounded text-white/70 hover:text-white"><Edit size={13} /></button>
                                    <button onClick={() => handleDelete(designer.id)} className="p-1 hover:bg-red-500/30 rounded text-white/70 hover:text-red-300"><Trash2 size={13} /></button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-3 space-y-2">
                                <div className="space-y-1 text-sm text-gray-600">
                                    <div className="flex items-center gap-2"><Phone size={13} className="text-gray-400" /> {designer.phone}</div>
                                    {designer.email && <div className="flex items-center gap-2 text-xs text-gray-400"><Mail size={13} className="text-gray-300" /> {designer.email}</div>}
                                </div>

                                <div className="flex flex-wrap gap-1 h-6 overflow-hidden">
                                    {designer.skills?.slice(0, 3).map(s => <span key={s} className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">{s}</span>)}
                                </div>

                                {/* System user badge — profile IS the user */}
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded-md">
                                    <UserCheck size={13} className="text-green-600 shrink-0" />
                                    <span className="text-xs text-green-700 font-medium">System User</span>
                                    <span className="text-[10px] text-green-500 ml-auto truncate">{designer.email}</span>
                                </div>

                                <div className="pt-2 border-t flex justify-between items-center text-sm">
                                    <span className="text-gray-500">Rate: <span className="text-gray-900 font-bold">{formatCurrency(designer.hourly_rate)}/hr</span></span>
                                    <button onClick={() => handleViewDetail(designer)} className="text-primary font-medium text-xs flex items-center gap-1"><Eye size={12} /> View Profile</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="text-section">{editingDesigner ? 'Edit Designer' : 'Add Designer'}</h2>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-md"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-2 md:gap-4">
                                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Full Name</label><input required className="w-full border rounded-md p-2 text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Phone</label><input required className="w-full border rounded-md p-2 text-sm" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Email</label><input className="w-full border rounded-md p-2 text-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>

                            <div className="grid grid-cols-2 gap-2 md:gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Type</label>
                                    <select className="w-full border rounded-md p-2 text-sm" value={formData.employment_type} onChange={e => setFormData({ ...formData, employment_type: e.target.value })}>
                                        <option value="full-time">Full Time</option>
                                        <option value="part-time">Part Time</option>
                                        <option value="freelance">Freelance</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">Joined</label>
                                    <input type="date" className="w-full border rounded-md p-2 text-sm" value={formData.joining_date} onChange={e => setFormData({ ...formData, joining_date: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:gap-4">
                                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Hourly Rate</label><input type="number" className="w-full border rounded-md p-2 text-sm" value={formData.hourly_rate || ''} onChange={e => setFormData({ ...formData, hourly_rate: +e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Monthly Salary</label><input type="number" className="w-full border rounded-md p-2 text-sm" value={formData.monthly_salary || ''} onChange={e => setFormData({ ...formData, monthly_salary: +e.target.value })} /></div>
                            </div>


                            {/* Skills */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block">Skills</label>
                                <div className="flex flex-wrap gap-2">
                                    {skillOptions.map(skill => (
                                        <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                                            className={`px-2 py-1 rounded-md text-xs transition-colors border ${formData.skills.includes(skill) ? 'bg-primary text-primary-foreground border-primary' : 'bg-white text-gray-600 border-gray-200'}`}>
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
                                    {uploadingDoc && <Loader2 className="animate-spin text-primary" size={16} />}
                                </div>
                                {formData.document_url && <a href={formData.document_url} target="_blank" className="text-xs text-blue-600 underline mt-1 block">View Uploaded Doc</a>}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={resetForm} className="flex-1 py-2 border rounded-md text-sm font-bold text-gray-600">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-bold">
                                    {saving ? 'Saving...' : 'Save Designer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedDesigner && (() => {
                return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-md w-full max-w-md relative overflow-hidden">
                            <div className="bg-gray-900 px-5 py-4 flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white text-page-title font-bold">
                                    {selectedDesigner.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-white font-bold text-base">{selectedDesigner.name}</h2>
                                    <p className="text-white/60 text-xs">{selectedDesigner.employment_type}</p>
                                </div>
                                <button onClick={() => setShowDetailModal(false)} className="text-white/60 hover:text-white p-1"><X size={20} /></button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="p-3 bg-gray-50 rounded-md text-sm space-y-2">
                                    <p className="flex items-center gap-2"><Phone size={14} /> {selectedDesigner.phone}</p>
                                    {selectedDesigner.email && <p className="flex items-center gap-2"><Mail size={14} /> {selectedDesigner.email}</p>}
                                    {selectedDesigner.city && <p className="flex items-center gap-2"><MapPin size={14} /> {selectedDesigner.city}, {selectedDesigner.state}</p>}
                                </div>

                                {/* Profile is the user — show email directly */}
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-green-50 border-green-200">
                                    <UserCheck size={16} className="text-green-600" />
                                    <div>
                                        <p className="text-xs font-bold text-gray-600">System Login</p>
                                        <p className="text-sm font-medium text-green-700">{selectedDesigner.email}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 md:gap-4">
                                    <div className="p-3 border rounded-md"><p className="text-xs text-gray-500">Hourly</p><p className="font-bold">{formatCurrency(selectedDesigner.hourly_rate)}</p></div>
                                    <div className="p-3 border rounded-md"><p className="text-xs text-gray-500">Monthly</p><p className="font-bold">{formatCurrency(selectedDesigner.monthly_salary)}</p></div>
                                </div>
                                {selectedDesigner.document_url && (
                                    <a href={selectedDesigner.document_url} target="_blank" className="block text-center py-2 border border-blue-200 bg-blue-50 text-blue-600 rounded-md text-sm font-bold">View ID Document</a>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
