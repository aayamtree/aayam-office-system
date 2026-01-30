'use client';

import { useState, useEffect } from 'react';
import { Plus, Printer, Search, Filter, Eye, Edit2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PrintRun, Machine, SheetSize, Material } from '@/types/database';
import Link from 'next/link';
import { QuickAddMachine, QuickAddSheetSize, QuickAddMaterial } from '@/components/print-planner/QuickAddModals';

export default function PrintPlannerPage() {
    const [printRuns, setPrintRuns] = useState<PrintRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'planned' | 'printed' | 'delivered'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewModal, setShowNewModal] = useState(false);

    useEffect(() => {
        fetchPrintRuns();
    }, [filter]);

    const fetchPrintRuns = async () => {
        try {
            let query = supabase
                .from('print_runs')
                .select(`
          *,
          machine:machines(*),
          sheet_size:sheet_sizes(*),
          material:materials(*),
          created_by_profile:profiles!print_runs_created_by_fkey(full_name)
        `)
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setPrintRuns(data || []);
        } catch (error) {
            console.error('Error fetching print runs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredRuns = printRuns.filter(run =>
        run.print_run_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'planned': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'printed': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <Printer className="text-indigo-600" size={32} />
                                Print Planner
                            </h1>
                            <p className="text-gray-500 mt-1">Manage print runs and batch multiple jobs together</p>
                        </div>
                        <button
                            onClick={() => setShowNewModal(true)}
                            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Create Print Run
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Printer className="text-blue-600" size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Planned</p>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            {printRuns.filter(r => r.status === 'planned').length}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Printer className="text-purple-600" size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Printed</p>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            {printRuns.filter(r => r.status === 'printed').length}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <CheckCircle className="text-green-600" size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Delivered</p>
                        </div>
                        <p className="text-2xl font-bold text-green-600">
                            {printRuns.filter(r => r.status === 'delivered').length}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white rounded-lg">
                                <Printer className="text-indigo-600" size={20} />
                            </div>
                            <p className="text-sm text-gray-600 font-medium">Total Runs</p>
                        </div>
                        <p className="text-2xl font-bold text-indigo-900">{printRuns.length}</p>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {(['all', 'planned', 'printed', 'delivered'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize ${filter === f
                                        ? f === 'all' ? 'bg-indigo-600 text-white'
                                            : f === 'planned' ? 'bg-blue-600 text-white'
                                                : f === 'printed' ? 'bg-purple-600 text-white'
                                                    : 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by print run number..."
                                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Print Runs List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : filteredRuns.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                            <Printer className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No print runs found</p>
                            <p className="text-sm text-gray-400 mt-1">Create a new print run to get started</p>
                        </div>
                    ) : (
                        filteredRuns.map((run) => (
                            <div
                                key={run.id}
                                className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-indigo-200 transition-all shadow-sm hover:shadow-md"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="text-xl font-bold text-gray-900">{run.print_run_number}</h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getStatusColor(run.status)}`}>
                                                {run.status.toUpperCase()}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-500 font-medium">Machine</p>
                                                <p className="text-gray-900 font-bold">{run.machine?.name || 'Not set'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 font-medium">Sheet Size</p>
                                                <p className="text-gray-900 font-bold">{run.sheet_size?.size || 'Not set'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 font-medium">Material</p>
                                                <p className="text-gray-900 font-bold">{run.material?.name || 'Not set'}</p>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                            <span>Created: {new Date(run.created_at).toLocaleDateString()}</span>
                                            {run.notes && <span className="text-gray-400">• {run.notes}</span>}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/admin/print-planner/${run.id}`}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm font-bold"
                                        >
                                            <Eye size={16} />
                                            View Details
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* New Print Run Modal */}
            {showNewModal && (
                <NewPrintRunModal
                    onClose={() => setShowNewModal(false)}
                    onCreated={() => {
                        setShowNewModal(false);
                        fetchPrintRuns();
                    }}
                />
            )}
        </div>
    );
}

// New Print Run Modal Component
function NewPrintRunModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [machines, setMachines] = useState<Machine[]>([]);
    const [sheetSizes, setSheetSizes] = useState<SheetSize[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);

    // Quick-add modal states
    const [showMachineAdd, setShowMachineAdd] = useState(false);
    const [showSheetSizeAdd, setShowSheetSizeAdd] = useState(false);
    const [showMaterialAdd, setShowMaterialAdd] = useState(false);

    const [formData, setFormData] = useState({
        machine_id: '',
        sheet_size_id: '',
        material_id: '',
        notes: ''
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const [machinesRes, sizesRes, materialsRes] = await Promise.all([
                supabase.from('machines').select('*').eq('is_active', true).order('name'),
                supabase.from('sheet_sizes').select('*').eq('is_active', true).order('size'),
                supabase.from('materials').select('*').eq('is_active', true).order('name')
            ]);

            if (machinesRes.data) setMachines(machinesRes.data);
            if (sizesRes.data) setSheetSizes(sizesRes.data);
            if (materialsRes.data) setMaterials(materialsRes.data);
        } catch (err) {
            console.error('Error fetching config:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: insertError } = await supabase
                .from('print_runs')
                .insert([{
                    machine_id: formData.machine_id || null,
                    sheet_size_id: formData.sheet_size_id || null,
                    material_id: formData.material_id || null,
                    notes: formData.notes || null,
                    status: 'planned'
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            await supabase.from('activity_logs').insert([{
                action: 'created',
                module: 'print_runs',
                details: { print_run_id: data.id, print_run_number: data.print_run_number }
            }]);

            onCreated();
        } catch (err: any) {
            setError(err.message || 'Failed to create print run');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-bold flex items-center gap-3">
                            <Plus size={28} />
                            Create New Print Run
                        </h3>
                        <p className="text-indigo-100 text-sm mt-1">Set up a new print batch container</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-all">
                        <Printer size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Machine
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={formData.machine_id}
                                    onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                >
                                    <option value="">Select Machine</option>
                                    {machines.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowMachineAdd(true)}
                                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center"
                                    title="Add New Machine"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Sheet Size
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={formData.sheet_size_id}
                                    onChange={(e) => setFormData({ ...formData, sheet_size_id: e.target.value })}
                                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                >
                                    <option value="">Select Size</option>
                                    {sheetSizes.map(s => (
                                        <option key={s.id} value={s.id}>{s.size}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowSheetSizeAdd(true)}
                                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center"
                                    title="Add New Sheet Size"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Material
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={formData.material_id}
                                    onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
                                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                >
                                    <option value="">Select Material</option>
                                    {materials.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowMaterialAdd(true)}
                                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center"
                                    title="Add New Material"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-4 ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                            rows={3}
                            placeholder="Optional notes about this print run"
                        />
                    </div>

                    <div className="pt-4 border-t-2 border-gray-100 flex gap-4 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating...' : 'Create Print Run'}
                        </button>
                    </div>
                </form>

                {/* Quick-Add Modals */}
                {showMachineAdd && (
                    <QuickAddMachine
                        onClose={() => setShowMachineAdd(false)}
                        onAdded={(newMachine) => {
                            setMachines([...machines, newMachine]);
                            setFormData({ ...formData, machine_id: newMachine.id });
                            setShowMachineAdd(false);
                        }}
                    />
                )}

                {showSheetSizeAdd && (
                    <QuickAddSheetSize
                        onClose={() => setShowSheetSizeAdd(false)}
                        onAdded={(newSize) => {
                            setSheetSizes([...sheetSizes, newSize]);
                            setFormData({ ...formData, sheet_size_id: newSize.id });
                            setShowSheetSizeAdd(false);
                        }}
                    />
                )}

                {showMaterialAdd && (
                    <QuickAddMaterial
                        onClose={() => setShowMaterialAdd(false)}
                        onAdded={(newMaterial) => {
                            setMaterials([...materials, newMaterial]);
                            setFormData({ ...formData, material_id: newMaterial.id });
                            setShowMaterialAdd(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
