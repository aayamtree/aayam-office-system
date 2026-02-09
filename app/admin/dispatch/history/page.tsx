'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, ArrowLeft, Truck, CheckCircle,
  MapPin, Phone, X, Eye, Upload, Share2, Package, MessageCircle, Loader2
} from 'lucide-react';
import { useDispatches } from '@/lib/hooks';
import { Dispatch, DispatchStatus } from '@/types/database';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      'dispatched': 'bg-gray-900 text-white border-border',
      'in_transit': 'bg-gray-900 text-white border-border',
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

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3 md:space-y-4 px-2 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/admin/dispatch" className="p-2 hover:bg-gray-100 rounded-md lg:hidden"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl lg:text-page-title text-gray-900">Dispatch History</h1>
          <p className="text-sm text-gray-500">{filteredDispatches.length} records</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-md p-3 text-center">
          <p className="text-page-title text-amber-700">{qcPassedCount}</p>
          <p className="text-xs text-destructive font-medium">Pending / Packed</p>
        </div>
        <div className="bg-muted border border-border rounded-md p-3 text-center">
          <p className="text-page-title text-foreground">{inTransitCount}</p>
          <p className="text-xs text-foreground font-medium">In Transit</p>
        </div>
        <div className="bg-white border border-green-200 rounded-md p-3 text-center">
          <p className="text-page-title text-gray-900">{deliveredCount}</p>
          <p className="text-xs text-gray-900 font-medium">Delivered</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredDispatches.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No dispatch history found.</div>}
        {filteredDispatches.map((dispatch) => (
          <div key={dispatch.id} className="bg-white rounded-md border border-gray-200 overflow-hidden">
            {/* Header strip */}
            <div className={`px-3 py-2 flex items-center justify-between ${dispatch.status === 'delivered' ? 'bg-gray-900' : dispatch.status === 'returned' ? 'bg-red-600' : 'bg-gray-700'}`}>
              <span className="text-white font-semibold text-sm">{dispatch.dispatch_number}</span>
              <span className={`px-2 py-0.5 text-xs rounded-md border font-medium ${dispatch.status === 'delivered' ? 'bg-white/15 text-white border-white/20' : getStatusColor(dispatch.status)}`}>{getStatusLabel(dispatch.status)}</span>
            </div>

            <div className="p-3">
              {/* Client & Order */}
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-900">{dispatch.client?.company || dispatch.client?.name}</p>
                <p className="text-xs text-gray-400">Order: {dispatch.job?.job_number}</p>
              </div>

              {/* Packages */}
              {dispatch.packages > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Package className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{dispatch.packages} Pkgs</span>
                </div>
              )}

              {/* Transporter Info */}
              {dispatch.transporter_name && (
                <div className="p-2 bg-gray-50 rounded-md text-xs space-y-1 mb-2">
                  <div><span className="text-gray-500">Transporter:</span> <span className="font-medium">{dispatch.transporter_name}</span></div>
                  {dispatch.tracking_number && <div><span className="text-gray-500">LR/Track:</span> <span className="font-medium text-gray-900">{dispatch.tracking_number}</span></div>}
                  {dispatch.vehicle_number && <div><span className="text-gray-500">Vehicle:</span> <span className="font-medium">{dispatch.vehicle_number}</span></div>}
                </div>
              )}

              {/* Dates */}
              <div className="text-xs text-gray-500 mb-3">
                {dispatch.dispatch_date && <span>Dispatched: {new Date(dispatch.dispatch_date).toLocaleDateString()}</span>}
                {dispatch.actual_delivery && <span className="ml-2 text-gray-900">Delivered: {new Date(dispatch.actual_delivery).toLocaleDateString()}</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => handleWhatsAppShare(dispatch)} className="px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-md border border-gray-200 flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</button>

                {dispatch.status === 'dispatched' || dispatch.status === 'in_transit' ? (
                  <>
                    <button onClick={() => handleView(dispatch)} className="px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-md border border-gray-200 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> View</button>
                    <button onClick={() => handleMarkDelivered(dispatch)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-xs font-semibold ml-auto"><CheckCircle className="w-3.5 h-3.5" /> Delivered</button>
                  </>
                ) : (
                  <button onClick={() => handleView(dispatch)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-xs font-medium"><Eye className="w-3.5 h-3.5" /> View</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showViewModal && selectedDispatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-section text-gray-900">Dispatch Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className={`p-4 rounded-md text-center ${selectedDispatch.status === 'delivered' ? 'bg-white' : 'bg-muted'}`}>
                {selectedDispatch.status === 'delivered' ? <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-900" /> : <Truck className="w-8 h-8 mx-auto mb-2 text-foreground" />}
                <p className="text-section">{getStatusLabel(selectedDispatch.status)}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-gray-50 rounded-md"><span className="text-gray-500">ID</span><span className="font-medium">{selectedDispatch.dispatch_number}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-md"><span className="text-gray-500">Client</span><span className="font-medium">{selectedDispatch.client?.company || selectedDispatch.client?.name}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-md"><span className="text-gray-500">Packages</span><span className="font-medium flex items-center gap-1.5"><Package className="w-4 h-4 text-gray-500" /> {selectedDispatch.packages}</span></div>
              </div>

              {selectedDispatch.transporter_name && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-primary">Transporter</p>
                  <p className="font-medium text-gray-900">{selectedDispatch.transporter_name}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {selectedDispatch.tracking_number && <div className="p-3 bg-gray-50 rounded-md"><p className="text-xs text-gray-500">Tracking Info</p><p className="font-medium text-gray-900">{selectedDispatch.tracking_number}</p></div>}
              </div>

              {selectedDispatch.proof_of_delivery_url && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Proof of Delivery</p>
                  <img src={selectedDispatch.proof_of_delivery_url} alt="POD" className="w-full rounded-md" />
                </div>
              )}

              {(selectedDispatch.vehicle_number || selectedDispatch.driver_name) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-md"><p className="text-xs text-gray-500">Vehicle</p><p className="font-medium">{selectedDispatch.vehicle_number || '-'}</p></div>
                  <div className="p-3 bg-gray-50 rounded-md"><p className="text-xs text-gray-500">Driver</p><p className="font-medium">{selectedDispatch.driver_name || '-'}</p><a href={`tel:${selectedDispatch.driver_phone}`} className="text-xs text-primary">{selectedDispatch.driver_phone}</a></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {selectedDispatch.dispatch_date && <div className="p-3 bg-gray-50 rounded-md"><p className="text-xs text-gray-500">Dispatched</p><p className="font-medium">{new Date(selectedDispatch.dispatch_date).toLocaleDateString()}</p></div>}
                {selectedDispatch.actual_delivery && <div className="p-3 bg-white rounded-md"><p className="text-xs text-gray-900">Delivered</p><p className="font-medium text-gray-900">{new Date(selectedDispatch.actual_delivery).toLocaleDateString()}</p></div>}
              </div>

              <button onClick={() => setShowViewModal(false)} className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 shadow-sm font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
