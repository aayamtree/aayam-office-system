'use client';

import { useState } from 'react';
import {
  Search, IndianRupee, Eye, Building2, Calendar, X,
  CheckCircle, Clock, Lock, AlertCircle, CreditCard
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const currentUser = { id: 1, name: 'Marketing User' };

const paymentStatuses = [
  { id: 'pending', name: 'Pending', color: 'bg-muted text-muted-foreground' },
  { id: 'partial', name: 'Partial', color: 'bg-orange-100 text-orange-700' },
  { id: 'paid', name: 'Paid', color: 'bg-gray-100 text-gray-900' },
  { id: 'overdue', name: 'Overdue', color: 'bg-red-100 text-red-700' },
];

// Payment records for orders belonging to this marketing user
const myPayments = [
  {
    id: 1, orderId: 'ORD-001', clientName: 'Sharma Industries', subject: 'Wedding Invitation Cards',
    totalAmount: 35400, paidAmount: 20000, pendingAmount: 15400, status: 'partial',
    dueDate: '2025-12-30', lastPaymentDate: '2025-12-22',
    payments: [
      { date: '2025-12-20', amount: 10000, mode: 'NEFT' },
      { date: '2025-12-22', amount: 10000, mode: 'UPI' },
    ], ownerId: 1
  },
  {
    id: 2, orderId: 'ORD-002', clientName: 'Royal Prints', subject: 'Brochures and Catalogs',
    totalAmount: 20650, paidAmount: 0, pendingAmount: 20650, status: 'pending',
    dueDate: '2025-12-28', lastPaymentDate: null, payments: [], ownerId: 1
  },
  {
    id: 3, orderId: 'ORD-003', clientName: 'Patel Enterprises', subject: 'Business Stationery',
    totalAmount: 8260, paidAmount: 8260, pendingAmount: 0, status: 'paid',
    dueDate: '2025-12-20', lastPaymentDate: '2025-12-18',
    payments: [
      { date: '2025-12-10', amount: 4000, mode: 'Cash' },
      { date: '2025-12-18', amount: 4260, mode: 'NEFT' },
    ], ownerId: 1
  },
];

export default function MarketingPaymentsPage() {
  const [payments] = useState(myPayments.filter(p => p.ownerId === currentUser.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const filteredPayments = payments.filter(p => {
    const matchesSearch = (p.orderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const getStatusBadge = (status: string) => paymentStatuses.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-700';
  const getStatusName = (status: string) => paymentStatuses.find(s => s.id === status)?.name || status;

  // Stats
  const totalOrders = payments.length;
  const totalAmount = payments.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalPending = payments.reduce((sum, p) => sum + p.pendingAmount, 0);

  return (
    <div className="p-4 sm:p-4 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
        <div>
          <h1 className="text-page-title text-gray-900">Payment Status</h1>
          <p className="text-gray-500">Track payment status for your orders</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-md">
          <Lock size={16} />
          <span>View Only</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white rounded-md border p-4">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-page-title text-gray-900">{totalOrders}</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-page-title text-primary">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-sm text-gray-500">Received</p>
          <p className="text-page-title text-gray-900">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-page-title text-destructive">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by order ID, client..."
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
              {paymentStatuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {filteredPayments.map(payment => {
          const progress = (payment.paidAmount / payment.totalAmount) * 100;
          return (
            <div key={payment.id} className={`bg-white rounded-md border p-4  transition-shadow ${payment.status === 'overdue' ? 'border-l-4 border-l-red-500' :
              payment.status === 'pending' ? 'border-l-4 border-l-yellow-500' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-primary font-medium">{payment.orderId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${getStatusBadge(payment.status)}`}>
                      {getStatusName(payment.status)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{payment.subject}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                    <span className="flex items-center gap-1"><Building2 size={14} />{payment.clientName}</span>
                    <span className="flex items-center gap-1"><Calendar size={14} />Due: {formatDate(payment.dueDate)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="text-right">
                    <p className="text-section text-gray-900">{formatCurrency(payment.totalAmount)}</p>
                    <p className="text-xs text-gray-500">
                      Paid: <span className="text-gray-900 font-medium">{formatCurrency(payment.paidAmount)}</span>
                    </p>
                  </div>
                  <button onClick={() => { setSelectedPayment(payment); setShowDetailModal(true); }}
                    className="p-2 text-foreground hover:bg-muted rounded-md" title="View Details">
                    <Eye size={18} />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 pt-3 border-t">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Payment Progress</span>
                  <span className="font-medium">{progress.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${progress >= 100 ? 'bg-white0' : progress > 0 ? 'bg-orange-500' : 'bg-gray-300'
                    }`} style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-900">Paid: {formatCurrency(payment.paidAmount)}</span>
                  <span className="text-destructive">Pending: {formatCurrency(payment.pendingAmount)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPayments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-md border">
          <IndianRupee className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No payment records found</h3>
          <p className="mt-1 text-gray-500">Payment status will appear here for your orders</p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="font-mono text-primary">{selectedPayment.orderId}</span>
                <h2 className="text-page-title">{selectedPayment.subject}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-md"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <p className="text-xs text-gray-500">Client</p>
                  <p className="font-medium">{selectedPayment.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-0.5 rounded-md text-label ${getStatusBadge(selectedPayment.status)}`}>
                    {getStatusName(selectedPayment.status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Due Date</p>
                  <p className="font-medium">{formatDate(selectedPayment.dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Payment</p>
                  <p className="font-medium">
                    {selectedPayment.lastPaymentDate
                      ? formatDate(selectedPayment.lastPaymentDate)
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Amount Summary */}
              <div className="bg-gray-50 rounded-md p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-semibold">{formatCurrency(selectedPayment.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Paid Amount</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(selectedPayment.paidAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-medium">Pending Amount</span>
                  <span className="font-bold text-destructive">{formatCurrency(selectedPayment.pendingAmount)}</span>
                </div>
              </div>

              {/* Payment History */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Payment History</p>
                {selectedPayment.payments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPayment.payments.map((p: any, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-white rounded-md p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <CheckCircle size={16} className="text-gray-900" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{formatCurrency(p.amount)}</p>
                            <p className="text-xs text-gray-500">{formatDate(p.date)}</p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-white rounded-md">{p.mode}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <CreditCard className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm">No payments received yet</p>
                  </div>
                )}
              </div>

              <div className="bg-muted border border-border rounded-md p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-foreground flex-shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-foreground">
                    Contact Finance team for payment collection queries or to update payment status.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
