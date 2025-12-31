'use client';

import { useState } from 'react';
import { 
  Search, ShoppingCart, Eye, Building2, Calendar, IndianRupee, X,
  Package, Clock, CheckCircle, AlertCircle, Lock
} from 'lucide-react';

const currentUser = { id: 1, name: 'Marketing User' };

const orderStatuses = [
  { id: 'confirmed', name: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
  { id: 'in_production', name: 'In Production', color: 'bg-purple-100 text-purple-700' },
  { id: 'ready', name: 'Ready', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'dispatched', name: 'Dispatched', color: 'bg-orange-100 text-orange-700' },
  { id: 'delivered', name: 'Delivered', color: 'bg-green-100 text-green-700' },
];

// Orders from quotations created by this marketing user
const myOrders = [
  { id: 1, orderId: 'ORD-001', clientId: 1, clientName: 'Sharma Industries', subject: 'Wedding Invitation Cards',
    total: 35400, status: 'in_production', orderDate: '2025-12-20', expectedDelivery: '2025-12-30',
    items: [{ name: 'Wedding Cards', qty: 1000 }, { name: 'Envelope', qty: 1000 }], ownerId: 1 },
  { id: 2, orderId: 'ORD-002', clientId: 4, clientName: 'Royal Prints', subject: 'Brochures and Catalogs',
    total: 20650, status: 'ready', orderDate: '2025-12-18', expectedDelivery: '2025-12-26',
    items: [{ name: 'A4 Brochure', qty: 500 }], ownerId: 1 },
  { id: 3, orderId: 'ORD-003', clientId: 2, clientName: 'Patel Enterprises', subject: 'Business Stationery',
    total: 8260, status: 'delivered', orderDate: '2025-12-10', expectedDelivery: '2025-12-20',
    items: [{ name: 'Business Cards', qty: 500 }, { name: 'Letterhead', qty: 200 }], ownerId: 1 },
];

export default function MarketingOrdersPage() {
  const [orders] = useState(myOrders.filter(o => o.ownerId === currentUser.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         o.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const getStatusBadge = (status: string) => orderStatuses.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-700';
  const getStatusName = (status: string) => orderStatuses.find(s => s.id === status)?.name || status;

  // Stats
  const totalOrders = orders.length;
  const inProduction = orders.filter(o => o.status === 'in_production').length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const totalValue = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500">Track orders from your converted quotations</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
          <Lock size={16} />
          <span>View Only</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">In Production</p>
          <p className="text-2xl font-bold text-purple-600">{inProduction}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Delivered</p>
          <p className="text-2xl font-bold text-green-600">{delivered}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search orders..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            {orderStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.map(order => (
          <div key={order.id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-indigo-600 font-medium">{order.orderId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(order.status)}`}>
                    {getStatusName(order.status)}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{order.subject}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1"><Building2 size={14} />{order.clientName}</span>
                  <span className="flex items-center gap-1"><Calendar size={14} />Order: {new Date(order.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  <span className="flex items-center gap-1"><Clock size={14} />Due: {new Date(order.expectedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-lg text-gray-900">{formatCurrency(order.total)}</p>
                </div>
                <button onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Details">
                  <Eye size={18} />
                </button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center justify-between text-xs mb-2">
                {orderStatuses.map((status, index) => {
                  const currentIndex = orderStatuses.findIndex(s => s.id === order.status);
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
                  style={{ width: `${((orderStatuses.findIndex(s => s.id === order.status) + 1) / orderStatuses.length) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No orders found</h3>
          <p className="mt-1 text-gray-500">Orders will appear here when quotations are accepted</p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="font-mono text-indigo-600">{selectedOrder.orderId}</span>
                <h2 className="text-xl font-bold">{selectedOrder.subject}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Client</p>
                  <p className="font-medium">{selectedOrder.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedOrder.status)}`}>
                    {getStatusName(selectedOrder.status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Order Date</p>
                  <p className="font-medium">{new Date(selectedOrder.orderDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Expected Delivery</p>
                  <p className="font-medium">{new Date(selectedOrder.expectedDelivery).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between text-sm bg-gray-50 rounded-lg p-2">
                      <span>{item.name}</span>
                      <span className="font-medium">Qty: {item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-50 rounded-xl p-4">
                <div className="flex justify-between font-semibold">
                  <span>Order Total</span>
                  <span className="text-indigo-600">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Progress */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Order Progress</p>
                <div className="space-y-2">
                  {orderStatuses.map((status, index) => {
                    const currentIndex = orderStatuses.findIndex(s => s.id === selectedOrder.status);
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
