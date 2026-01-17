'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClients, useDesigners } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Briefcase, Folder, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewProjectPage() {
    const router = useRouter();
    const { clients } = useClients();
    const { designers } = useDesigners();
    const [creating, setCreating] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        clientId: '',
        designerId: '',
        jobType: 'Design',
        deadline: '',
        priority: 'normal',
        driveLink: '',
        description: '',
        file: null as File | null
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const jobData = {
                project_name: formData.title,
                client_id: formData.clientId,
                designer_id: formData.designerId || user?.id,
                job_type: formData.jobType,
                client_deadline: formData.deadline || null,
                priority: formData.priority,
                drive_link: formData.driveLink || null,
                description: formData.description || null,
                current_stage: 'new' as const,
                status: 'active' as const
            };

            const { error } = await supabase.from('jobs').insert([jobData]);

            if (error) throw error;

            alert('✅ Project created successfully!');
            router.push('/admin/designers/my-queue');
        } catch (error: any) {
            console.error('Error creating project:', error);
            alert('❌ Failed to create project: ' + error.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Premium Gradient Header */}
            <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
                <div className="relative max-w-5xl mx-auto p-6">
                    <Link
                        href="/admin/designers/my-queue"
                        className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm"
                    >
                        <ArrowLeft size={18} />
                        Back to My Queue
                    </Link>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl shadow-lg">
                            <Briefcase size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-white text-3xl mb-1">Create New Project</h1>
                            <p className="text-indigo-100 text-sm">Initialize a new design or print job with all details</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Content */}
            <div className="max-w-5xl mx-auto p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* 1. Project Basics */}
                    <div className="space-y-5 bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 pb-4 border-b-2 border-gradient-to-r from-indigo-500 to-purple-500">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-lg font-bold shadow-lg shadow-indigo-200">
                                1
                            </div>
                            <h4 className="text-base font-bold text-gray-800 uppercase tracking-wide">Project Basics</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    📝 Project Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    type="text"
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium hover:border-gray-300"
                                    placeholder="e.g. Wedding Invitation - Sharma Family"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    👤 Client <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white hover:border-gray-300"
                                    value={formData.clientId}
                                    onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                                >
                                    <option value="">Select Client</option>
                                    {clients?.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    🎨 Assign Designer
                                </label>
                                <select
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white hover:border-gray-300"
                                    value={formData.designerId}
                                    onChange={e => setFormData({ ...formData, designerId: e.target.value })}
                                >
                                    <option value="">Assign to Me (Default)</option>
                                    {designers?.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 2. Parameters */}
                    <div className="space-y-5 bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 pb-4 border-b-2 border-gradient-to-r from-orange-500 to-red-500">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white text-lg font-bold shadow-lg shadow-orange-200">
                                2
                            </div>
                            <h4 className="text-base font-bold text-gray-800 uppercase tracking-wide">Project Parameters</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    📋 Job Type
                                </label>
                                <select
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:ring-4 ring-orange-500/20 focus:border-orange-500 bg-white hover:border-gray-300 transition-all"
                                    value={formData.jobType}
                                    onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                                >
                                    <option value="Design">🎨 Design Only</option>
                                    <option value="Printing">🖨️ Printing Only</option>
                                    <option value="Design + Printing">✨ Design + Print</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    📅 Deadline
                                </label>
                                <input
                                    type="date"
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:ring-4 ring-orange-500/20 focus:border-orange-500 font-medium text-gray-600 hover:border-gray-300 transition-all"
                                    value={formData.deadline}
                                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    ⚡ Priority
                                </label>
                                <select
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:ring-4 ring-orange-500/20 focus:border-orange-500 bg-white hover:border-gray-300 transition-all"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                >
                                    <option value="normal">Normal</option>
                                    <option value="high">⚠️ High</option>
                                    <option value="urgent">🔥 Urgent</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 3. Assets & Brief */}
                    <div className="space-y-5 bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 pb-4 border-b-2 border-gradient-to-r from-blue-500 to-cyan-500">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white text-lg font-bold shadow-lg shadow-blue-200">
                                3
                            </div>
                            <h4 className="text-base font-bold text-gray-800 uppercase tracking-wide">Assets & Brief</h4>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border-2 border-blue-100 space-y-4">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Folder size={18} className="text-blue-600" />
                                Design Assets (Drive Link or File Upload)
                            </label>
                            <input
                                type="url"
                                className="w-full border-2 border-blue-200 rounded-xl px-4 py-4 text-base focus:ring-4 ring-blue-500/20 focus:border-blue-500 placeholder:text-blue-300 bg-white hover:border-blue-300 transition-all"
                                placeholder="https://drive.google.com/drive/folders/..."
                                value={formData.driveLink}
                                onChange={e => setFormData({ ...formData, driveLink: e.target.value })}
                            />
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-gray-400">OR</span>
                                <input
                                    type="file"
                                    onChange={e => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setFormData({ ...formData, file: e.target.files[0] });
                                        }
                                    }}
                                    className="text-sm text-gray-600 file:mr-3 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-500 file:text-white hover:file:bg-blue-600 file:shadow-lg file:shadow-blue-200 file:transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                📄 Description / Work Items
                            </label>
                            <textarea
                                rows={5}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:ring-4 ring-blue-500/20 focus:border-blue-500 leading-relaxed hover:border-gray-300 transition-all"
                                placeholder="Describe specific requirements, items to print, size, quantity, special instructions..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 items-center justify-end bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky bottom-4">
                        <Link
                            href="/admin/designers/my-queue"
                            className="px-8 py-4 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all text-base"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={creating}
                            className="px-10 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-purple-300 disabled:opacity-50 transition-all transform hover:scale-105 text-base flex items-center gap-2"
                        >
                            {creating ? <><Loader2 size={20} className="animate-spin" /> Creating...</> : <><CheckCircle size={20} /> Create Project</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
