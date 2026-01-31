'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    Search, Plus, Eye, Edit, Trash2, X, ArrowLeft,
    Calendar, User, FileText, CheckCircle, AlertCircle,
    Palette, Printer, Layers, ArrowRight
} from 'lucide-react';
import { useSalesOrders, useClients } from '@/lib/hooks';
import { SalesOrder } from '@/types/database';

export default function SalesOrdersPage() {
    const { salesOrders, loading, createSalesOrder, updateSalesOrder } = useSalesOrders();
    const { clients } = useClients();

    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        clientId: '',
        projectName: '',
        description: '',
        workType: 'design_only' as SalesOrder['work_type'],
        amount: '',
        gstRate: 18,
        date: new Date().toISOString().split('T')[0],
    });

    // Derived Data
    const filteredOrders = (salesOrders || []).filter(so => {
        const searchString = searchQuery.toLowerCase();
        return (
            (so.so_number || '').toLowerCase().includes(searchString) ||
            (so.project_name || '').toLowerCase().includes(searchString) ||
            (so.client?.company || '').toLowerCase().includes(searchString)
        );
    });

    const handleAddNew = () => {
        setFormData({
            clientId: '',
            projectName: '',
            description: '',
            workType: 'design_only',
            amount: '',
            gstRate: 18,
            date: new Date().toISOString().split('T')[0],
        });
        setIsEditing(false);
        setShowModal(true);
    };

    const calculateTotal = (amt: number, gst: number) => {
        const gstVal = amt * (gst / 100);
        return { gstAmount: gstVal, total: amt + gstVal };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const subtotal = parseFloat(formData.amount.toString()) || 0;
            const { gstAmount, total } = calculateTotal(subtotal, formData.gstRate);

            const payload = {
                client_id: formData.clientId,
                project_name: formData.projectName,
                description: formData.description,
                work_type: formData.workType,
                subtotal: subtotal,
                gst_rate: formData.gstRate,
                gst_amount: gstAmount,
                total_amount: total,
                order_date: formData.date
            };

            if (isEditing && selectedOrder) {
                await updateSalesOrder(selectedOrder.id, payload);
            } else {
                await createSalesOrder({
                    ...payload,
                    status: 'draft',
                    payment_status: 'pending',
                    quantity: 1, // Default
                } as any);
            }
            setShowModal(false);
        } catch (err: any) {
            alert('Error saving order: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmOrder = async (order: SalesOrder) => {
        if (!confirm('Are you sure? Confirming this order will trigger: \n' +
            (order.work_type.includes('design') ? '- Design Project Creation\n' : '') +
            (order.work_type === 'print_only' ? '- Production Job Creation\n' : '')
        )) return;

        await updateSalesOrder(order.id, { status: 'confirmed' });
    };

    // Helper to get status color
    const getStatusColor = (status: string) => {
        if (status === 'draft') return 'bg-gray-100 text-gray-700';
        if (status === 'confirmed') return 'bg-blue-100 text-blue-700';
        if (status === 'in_progress') return 'bg-oms-blue text-white';
        if (status === 'ready_for_invoice') return 'bg-gray-100 text-gray-900';
        return 'bg-gray-100 text-gray-500';
    };

    return (
        <div className="space-y-3 md:space-y-6 px-2 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
                <div>
                    <h1 className="text-page-title text-gray-900">Sales Orders</h1>
                    <p className="text-gray-500">Manage incoming orders and initiate workflows.</p>
                </div>
                <button onClick={handleAddNew} className="flex items-center justify-center gap-2 bg-oms-blue text-white px-4 py-2.5 rounded-xl hover:bg-oms-blue transition-colors">
                    <Plus size={18} /> New Sales Order
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search orders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-oms-blue focus:outline-none"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">SO Number</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Client</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Project / Type</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-400">No sales orders found.</td>
                                </tr>
                            ) : filteredOrders.map((so) => (
                                <tr key={so.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="p-4 font-mono text-sm font-medium text-gray-900">{so.so_number}</td>
                                    <td className="p-4">
                                        <p className="font-medium text-gray-900">{so.client?.company || 'Unknown'}</p>
                                        <p className="text-xs text-gray-500">{so.client?.name}</p>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-sm text-gray-900 font-medium">{so.project_name}</p>
                                        <div className="flex gap-2 mt-1">
                                            {so.work_type === 'design_only' && <span className="inline-flex items-center gap-1 text-[10px] bg-oms-blue text-white px-1.5 py-0.5 rounded border border-[rgba(0,0,255,0.2)]-100"><Palette size={10} /> Design</span>}
                                            {so.work_type === 'print_only' && <span className="inline-flex items-center gap-1 text-[10px] bg-oms-blue text-white px-1.5 py-0.5 rounded border border-[rgba(0,0,255,0.2)]-100"><Printer size={10} /> Print</span>}
                                            {so.work_type === 'design_and_print' && <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100"><Layers size={10} /> Full</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium text-gray-900">₹{so.total_amount}</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-label ${getStatusColor(so.status)}`}>
                                            {so.status.replace(/_/g, ' ').toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {so.status === 'draft' && (
                                                <button onClick={() => handleConfirmOrder(so)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1">
                                                    Confirm <ArrowRight size={12} />
                                                </button>
                                            )}

                                            {/* Logic for Links */}
                                            {/* If In Progress/Confirmed, show links based on type */}
                                            {(so.status !== 'draft') && (
                                                <>
                                                    {so.work_type.includes('design') && (
                                                        <Link href="/admin/designers" className="p-1.5 text-oms-blue hover:bg-oms-blue rounded-lg" title="View Design">
                                                            <Palette size={16} />
                                                        </Link>
                                                    )}
                                                    {(so.work_type === 'print_only' || so.status === 'completed') && (
                                                        <Link href="/admin/jobs" className="p-1.5 text-oms-blue hover:bg-oms-blue rounded-lg" title="View Job">
                                                            <Printer size={16} />
                                                        </Link>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal - Create/Edit */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg  overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="text-section text-gray-900">
                                {isEditing ? 'Edit Order' : 'New Sales Order'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">

                            {/* Client Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                                <select required value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} className="w-full px-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-oms-blue">
                                    <option value="">Select Client</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                                </select>
                            </div>

                            {/* Work Type */}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'design_only', label: 'Design Only', icon: Palette },
                                    { id: 'print_only', label: 'Print Only', icon: Printer },
                                    { id: 'design_and_print', label: 'Design + Print', icon: Layers },
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, workType: type.id as any })}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${formData.workType === type.id
                                                ? 'border-oms-blue bg-oms-blue text-white'
                                                : 'border-gray-200 hover:border-oms-blue/20 text-gray-600'
                                            }`}
                                    >
                                        <type.icon size={20} className="mb-1" />
                                        <span className="text-label">{type.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Project Details */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                                <input required type="text" value={formData.projectName} onChange={e => setFormData({ ...formData, projectName: e.target.value })} className="w-full px-3 py-2 border rounded-xl" placeholder="e.g. Summer Campaign Flyers" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-xl" placeholder="Specs, Notes..." />
                            </div>

                            {/* Money */}
                            <div className="grid grid-cols-2 gap-2 md:gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Excl. Tax)</label>
                                    <input required type="number" min="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
                                    <select value={formData.gstRate} onChange={e => setFormData({ ...formData, gstRate: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-xl bg-white">
                                        <option value="0">0%</option>
                                        <option value="5">5%</option>
                                        <option value="12">12%</option>
                                        <option value="18">18%</option>
                                        <option value="28">28%</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-6 py-2 bg-oms-blue text-white rounded-xl hover:bg-oms-blue transition-colors disabled:opacity-50">
                                    {submitting ? 'Saving...' : 'Create Sales Order'}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
