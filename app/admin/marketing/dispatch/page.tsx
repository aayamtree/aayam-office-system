'use client';

import { useState } from 'react';
import { 
  Search, Truck, Eye, Building2, Calendar, X, Package, MapPin,
  Clock, CheckCircle, Lock, Phone
} from 'lucide-react';

const currentUser = { id: 1, name: 'Marketing User' };

const dispatchStatuses = [
  { id: 'packing', name: 'Packing', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'ready', name: 'Ready to Ship', color: 'bg-blue-100 text-blue-700' },
  { id: 'shipped', name: 'Shipped', color: 'bg-purple-100 text-purple-700' },
  { id: 'in_transit', name: 'In Transit', color: 'bg-orange-100 text-orange-700' },
  { id: 'delivered', name: 'Delivered', color: 'bg-green-100 text-green-700' },
];

// Dispatch records for orders belonging to this marketing user
const myDispatches = [
  { id: 1, dispatchId: 'DSP-001', orderId: 'ORD-001', clientName: 'Sharma Industries', 
    subject: 'Wedding Invitation Cards', status: 'in_transit', 
    dispatchDate: '2025-12-25', expectedDelivery: '2025-12-28',
    transporter: 'BlueDart', trackingNo: 'BD123456789', 
    address: '123 Main Street, Ahmedabad', contact: '9876543210', ownerId: 1 },
  { id: 2, dispatchId: 'DSP-002', orderId: 'ORD-002', clientName: 'Royal Prints', 
    subject: 'Brochures and Catalogs', status: 'ready',
    dispatchDate: null, expectedDelivery: '2025-12-28',
    transporter: '', trackingNo: '', 
    address: '456 Park Road, Rajkot', contact: '9898989898', ownerId: 1 },
  { id: 3, dispatchId: 'DSP-003', orderId: 'ORD-003', clientName: 'Patel Enterprises', 
    subject: 'Business Stationery', status: 'delivered',
    dispatchDate: '2025-12-18', expectedDelivery: '2025-12-20',
    transporter: 'DTDC', trackingNo: 'DT987654321', 
    address: '789 Business Park, Vadodara', contact: '9712345678', ownerId: 1 },
];

export default function MarketingDispatchPage() {
  const [dispatches] = useState(myDispatches.filter(d => d.ownerId === currentUser.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<any>(null);

  const filteredDispatches = dispatches.filter(d => {
    const matchesSearch = d.dispatchId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.orderId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => dispatchStatuses.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-700';
  const getStatusName = (status: string) => dispatchStatuses.find(s => s.id === status)?.name || status;

  // Stats
  const totalDispatches = dispatches.length;
  const inTransit = dispatches.filter(d => d.status === 'in_transit' || d.status === 'shipped').length;
  const delivered = dispatches.filter(d => d.status === 'delivered').length;
  const pending = dispatches.filter(d => d.status === 'packing' || d.status === 'ready').length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch Status</h1>
          <p className="text-gray-500">Track shipments for your orders</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
          <Lock size={16} />
          <span>View Only</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Total Shipments</p>
          <p className="text-2xl font-bold text-gray-900">{totalDispatches}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">In Transit</p>
          <p className="text-2xl font-bold text-orange-600">{inTransit}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Delivered</p>
          <p className="text-2xl font-bold text-green-600">{delivered}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search by ID, client, order..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            {dispatchStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Dispatches List */}
      <div className="space-y-3">
        {filteredDispatches.map(dispatch => (
          <div key={dispatch.id} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
            dispatch.status === 'in_transit' ? 'border-l-4 border-l-orange-500' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-cyan-600 font-medium">{dispatch.dispatchId}</span>
                  <span className="text-xs text-gray-400">|</span>
                  <span className="font-mono text-xs text-gray-500">{dispatch.orderId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(dispatch.status)}`}>
                    {getStatusName(dispatch.status)}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{dispatch.subject}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1"><Building2 size={14} />{dispatch.clientName}</span>
                  {dispatch.transporter && (
                    <span className="flex items-center gap-1"><Truck size={14} />{dispatch.transporter}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {dispatch.trackingNo && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Tracking</p>
                    <p className="font-mono text-sm">{dispatch.trackingNo}</p>
                  </div>
                )}
                <button onClick={() => { setSelectedDispatch(dispatch); setShowDetailModal(true); }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Details">
                  <Eye size={18} />
                </button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center justify-between text-xs mb-2">
                {dispatchStatuses.map((status, index) => {
                  const currentIndex = dispatchStatuses.findIndex(s => s.id === dispatch.status);
                  const isComplete = index <= currentIndex;
                  return (
                    <div key={status.id} className={`flex items-center gap-1 ${isComplete ? 'text-green-600' : 'text-gray-400'}`}>
                      {isComplete ? <CheckCircle size={14} /> : <Clock size={14} />}
                      <span className="hidden sm:inline">{status.name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${((dispatchStatuses.findIndex(s => s.id === dispatch.status) + 1) / dispatchStatuses.length) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDispatches.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No dispatches found</h3>
          <p className="mt-1 text-gray-500">Dispatches will appear here when orders are shipped</p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedDispatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="font-mono text-cyan-600">{selectedDispatch.dispatchId}</span>
                <h2 className="text-xl font-bold">{selectedDispatch.subject}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Client</p>
                  <p className="font-medium">{selectedDispatch.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedDispatch.status)}`}>
                    {getStatusName(selectedDispatch.status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Order ID</p>
                  <p className="font-mono font-medium">{selectedDispatch.orderId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Expected Delivery</p>
                  <p className="font-medium">{new Date(selectedDispatch.expectedDelivery).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              
              {selectedDispatch.transporter && (
                <div className="bg-cyan-50 rounded-xl p-4 space-y-2">
                  <p className="font-medium text-cyan-900">Shipping Details</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Transporter</p>
                      <p className="font-medium">{selectedDispatch.transporter}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Tracking No.</p>
                      <p className="font-mono font-medium">{selectedDispatch.trackingNo}</p>
                    </div>
                    {selectedDispatch.dispatchDate && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Dispatch Date</p>
                        <p className="font-medium">{new Date(selectedDispatch.dispatchDate).toLocaleDateString('en-IN')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="font-medium text-gray-900">Delivery Address</p>
                <p className="text-sm flex items-start gap-2">
                  <MapPin size={16} className="text-gray-400 mt-0.5" />
                  {selectedDispatch.address}
                </p>
                <p className="text-sm flex items-center gap-2">
                  <Phone size={16} className="text-gray-400" />
                  {selectedDispatch.contact}
                </p>
              </div>

              {/* Progress */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Shipment Progress</p>
                <div className="space-y-2">
                  {dispatchStatuses.map((status, index) => {
                    const currentIndex = dispatchStatuses.findIndex(s => s.id === selectedDispatch.status);
                    const isComplete = index <= currentIndex;
                    return (
                      <div key={status.id} className={`flex items-center gap-2 ${isComplete ? 'text-green-600' : 'text-gray-400'}`}>
                        {isComplete ? <CheckCircle size={16} /> : <Clock size={16} />}
                        <span className={isComplete ? 'font-medium' : ''}>{status.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
