'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, Truck, CheckCircle,
  MapPin, Phone, X, Eye, Upload, Share2, Package, MessageCircle, Loader2
} from 'lucide-react';
import { useDispatches } from '@/lib/hooks';
import { Dispatch, DispatchStatus } from '@/types/database';

export default function DispatchHistoryPage() {
  const { dispatches, loading, updateDispatch } = useDispatches();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);

  // Filter for dispatched/history items
  const historyDispatches = dispatches.filter(d =>
    ['dispatched', 'in_transit', 'delivered', 'returned'].includes(d.status)
  );

  const filteredDispatches = historyDispatches.filter(d => {
    const matchesSearch =
      d.dispatch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.job?.job_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.client?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.client?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-700 border-gray-200',
      'packed': 'bg-amber-100 text-amber-700 border-gray-200',
      'dispatched': 'bg-oms-blue text-oms-blue border-[rgba(0,0,255,0.2)]',
      'in_transit': 'bg-oms-blue text-oms-blue border-[rgba(0,0,255,0.2)]',
      'delivered': 'bg-gray-100 text-gray-900 border-green-200',
      'returned': 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleView = (dispatch: Dispatch) => {
    setSelectedDispatch(dispatch);
    setShowViewModal(true);
  };

  // WhatsApp Share Dispatch Status
  // Note: This relies on local state data for messaging, we might need a utility using DB fields
  const handleWhatsAppShare = (dispatch: Dispatch) => {
    const clientPhone = dispatch.client?.phone;
    if (!clientPhone) return alert('No client phone number available');

    const message = `📦 Dispatch Update for Order #${dispatch.job?.job_number || 'N/A'}\n\nStatus: ${getStatusLabel(dispatch.status)}\nTransporter: ${dispatch.transporter_name || 'N/A'}\nTracking / LR: ${dispatch.tracking_number || 'N/A'}\nVehicle: ${dispatch.vehicle_number || 'N/A'}\nDriver: ${dispatch.driver_name} (${dispatch.driver_phone})\n\nExpected Delivery: ${dispatch.expected_delivery || 'TBD'}\n\nThank you for choosing Aayam!`;

    // Simple wa.me link
    window.open(`https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleMarkDelivered = async (dispatch: Dispatch) => {
    if (confirm('Mark this dispatch as DELIVERED?')) {
      await updateDispatch(dispatch.id, {
        status: 'delivered',
        actual_delivery: new Date().toISOString().split('T')[0]
      });
    }
  };

  const qcPassedCount = dispatches.filter(d => d.status === 'pending' || d.status === 'packed').length; // "Ready" queue
  const inTransitCount = dispatches.filter(d => ['dispatched', 'in_transit'].includes(d.status)).length;
  const deliveredCount = dispatches.filter(d => d.status === 'delivered').length;

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-oms-blue" /></div>;

  return (
    <div className="space-y-4 lg:space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/admin/dispatch" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-xl lg:text-page-title text-gray-900">Dispatch History</h1>
          <p className="text-sm text-gray-500">{filteredDispatches.length} records</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-page-title text-amber-700">{qcPassedCount}</p>
          <p className="text-xs text-oms-orange font-medium">Pending / Packed</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-page-title text-blue-700">{inTransitCount}</p>
          <p className="text-xs text-blue-600 font-medium">In Transit</p>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-3 text-center">
          <p className="text-page-title text-gray-900">{deliveredCount}</p>
          <p className="text-xs text-gray-900 font-medium">Delivered</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-oms-blue">
          <option value="all">All Status</option>
          <option value="dispatched">Dispatched</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredDispatches.length === 0 && <div className="text-center py-12 text-gray-500">No dispatch history found.</div>}
        {filteredDispatches.map((dispatch) => (
          <div key={dispatch.id} className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900">{dispatch.dispatch_number}</span>
                    <span className="text-xs text-gray-400">• Order: {dispatch.job?.job_number}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(dispatch.status)}`}>{getStatusLabel(dispatch.status)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{dispatch.client?.company || dispatch.client?.name}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {dispatch.packages > 0 && <span className="px-2 py-1 bg-[rgba(0,0,255,0.05)] text-oms-blue rounded-lg">📦 {dispatch.packages} Pkgs</span>}
                </div>
              </div>

              {dispatch.transporter_name && (
                <div className="p-3 bg-gray-50 rounded-xl text-sm grid grid-cols-2 gap-2">
                  <div><span className="text-gray-500">Transporter:</span> <span className="font-medium">{dispatch.transporter_name || '-'}</span></div>
                  {dispatch.tracking_number && <div><span className="text-gray-500">LR/Track:</span> <span className="font-medium text-gray-900">{dispatch.tracking_number}</span></div>}
                  {dispatch.vehicle_number && <div><span className="text-gray-500">Vehicle:</span> <span className="font-medium">{dispatch.vehicle_number}</span></div>}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  {dispatch.dispatch_date && <span>Dispatched: {new Date(dispatch.dispatch_date).toLocaleDateString()}</span>}
                  {dispatch.actual_delivery && <span className="ml-3 text-gray-900">Delivered: {new Date(dispatch.actual_delivery).toLocaleDateString()}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleWhatsAppShare(dispatch)} className="px-3 py-1.5 text-sm text-gray-900 hover:bg-white rounded-lg flex items-center gap-1"><MessageCircle size={14} /> WhatsApp</button>

                  {dispatch.status === 'dispatched' || dispatch.status === 'in_transit' ? (
                    <>
                      <button onClick={() => handleView(dispatch)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg flex items-center gap-1"><Eye size={14} /> View</button>
                      <button onClick={() => handleMarkDelivered(dispatch)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm"><CheckCircle size={14} /> Delivered</button>
                    </>
                  ) : (
                    <button onClick={() => handleView(dispatch)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm"><Eye size={16} /> View</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showViewModal && selectedDispatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-section text-gray-900">Dispatch Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className={`p-4 rounded-xl text-center ${selectedDispatch.status === 'delivered' ? 'bg-white' : 'bg-blue-50'}`}>
                {selectedDispatch.status === 'delivered' ? <CheckCircle size={32} className="mx-auto mb-2 text-gray-900" /> : <Truck size={32} className="mx-auto mb-2 text-blue-600" />}
                <p className="text-section">{getStatusLabel(selectedDispatch.status)}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">ID</span><span className="font-medium">{selectedDispatch.dispatch_number}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Client</span><span className="font-medium">{selectedDispatch.client?.company || selectedDispatch.client?.name}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Packages</span><span className="font-medium">📦 {selectedDispatch.packages}</span></div>
              </div>

              {selectedDispatch.transporter_name && (
                <div className="p-3 bg-[rgba(0,0,255,0.05)] rounded-xl">
                  <p className="text-sm text-oms-blue">Transporter</p>
                  <p className="font-medium text-indigo-900">{selectedDispatch.transporter_name}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {selectedDispatch.tracking_number && <div className="p-3 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500">Tracking Info</p><p className="font-medium text-gray-900">{selectedDispatch.tracking_number}</p></div>}
              </div>

              {selectedDispatch.proof_of_delivery_url && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Proof of Delivery</p>
                  <img src={selectedDispatch.proof_of_delivery_url} alt="POD" className="w-full rounded-xl" />
                </div>
              )}

              {(selectedDispatch.vehicle_number || selectedDispatch.driver_name) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500">Vehicle</p><p className="font-medium">{selectedDispatch.vehicle_number || '-'}</p></div>
                  <div className="p-3 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500">Driver</p><p className="font-medium">{selectedDispatch.driver_name || '-'}</p><a href={`tel:${selectedDispatch.driver_phone}`} className="text-xs text-oms-blue">{selectedDispatch.driver_phone}</a></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {selectedDispatch.dispatch_date && <div className="p-3 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500">Dispatched</p><p className="font-medium">{new Date(selectedDispatch.dispatch_date).toLocaleDateString()}</p></div>}
                {selectedDispatch.actual_delivery && <div className="p-3 bg-white rounded-xl"><p className="text-xs text-gray-900">Delivered</p><p className="font-medium text-gray-900">{new Date(selectedDispatch.actual_delivery).toLocaleDateString()}</p></div>}
              </div>

              <button onClick={() => setShowViewModal(false)} className="w-full px-4 py-2.5 bg-oms-blue text-white rounded-xl hover:bg-blue-600">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
