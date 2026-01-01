'use client';

import Link from 'next/link';
import { Package, CheckCircle, Truck, Clock, AlertTriangle, ClipboardCheck, Loader2 } from 'lucide-react';
import { useJobs, useDispatches } from '@/lib/hooks';

export default function DispatchPage() {
  const { jobs, loading: jobsLoading } = useJobs({
    orderBy: { column: 'client_deadline', ascending: true }
  });
  const { dispatches, loading: dispatchesLoading } = useDispatches();

  const loading = jobsLoading || dispatchesLoading;

  // Filter Data
  const pendingQC = jobs.filter(j => j.current_stage === 'quality_check');

  // Dispatch Requirement: Print Complete (ready) AND Payment Cleared (paid)
  const readyToDispatch = jobs.filter(j => j.current_stage === 'ready' && j.payment_status === 'paid');

  const sentDispatches = dispatches.slice(0, 3); // Get latest 3

  // Calculate Delayed Jobs
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const delayedCount = jobs.filter(j => {
    if (!j.client_deadline) return false;
    const deadline = new Date(j.client_deadline);
    const isPastDeadline = deadline < today;
    const isNotCompleted = !['delivered', 'completed', 'cancelled', 'dispatched'].includes(j.current_stage);
    return isPastDeadline && isNotCompleted;
  }).length;

  const stats = [
    { label: 'Pending QC', value: pendingQC.length.toString(), change: 'Need checking', icon: ClipboardCheck, color: 'bg-amber-500' },
    { label: 'Ready to Dispatch', value: readyToDispatch.length.toString(), change: 'Awaiting pickup', icon: Package, color: 'bg-blue-500' },
    { label: 'Dispatched Total', value: dispatches.length.toString(), change: 'All time', icon: Truck, color: 'bg-green-500' },
    { label: 'Delayed', value: delayedCount.toString(), change: 'Needs attention', icon: AlertTriangle, color: 'bg-red-500' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'in_transit': return 'bg-blue-100 text-blue-700';
      case 'dispatched': return 'bg-indigo-100 text-indigo-700';
      case 'pending': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'delivered': return 'Delivered';
      case 'in_transit': return 'In Transit';
      case 'dispatched': return 'Dispatched';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch</h1>
          <p className="text-gray-500">Quality check and dispatch management</p>
        </div>
        <Link
          href="/admin/dispatch/qc-check"
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <ClipboardCheck size={18} />
          <span>Start QC</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center`}>
                <stat.icon size={20} className="text-white" />
              </div>
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">
              {loading ? '...' : stat.value}
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mt-1">{stat.label}</p>
            <p className="text-xs text-gray-400 mt-2">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/dispatch/qc-check" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardCheck size={24} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">QC Check</h2>
              <p className="text-sm text-gray-500">Quality control verification</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-amber-600">● {pendingQC.length} Pending</span>
          </div>
        </Link>

        {/* Other links kept static for now as they point to further screens we might not have refactored yet */}
        <Link href="/admin/dispatch/history" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Truck size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Dispatch History</h2>
              <p className="text-sm text-gray-500">Track all dispatches</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-blue-600">● {dispatches.length} Total</span>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending QC */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending QC</h2>
            <Link href="/admin/dispatch/qc-check" className="text-sm text-indigo-600 hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {pendingQC.length === 0 ? (
              <div className="text-center text-gray-400 py-4">No jobs pending QC.</div>
            ) : pendingQC.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{job.job_number}</p>
                    {job.priority === 'urgent' && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Urgent</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{job.client?.company || job.client?.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{job.project_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Due</p>
                  <p className="text-sm font-medium text-gray-900">{job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : '-'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ready to Dispatch */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Ready to Dispatch</h2>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
              {readyToDispatch.length} ready
            </span>
          </div>
          <div className="space-y-3">
            {readyToDispatch.length === 0 ? (
              <div className="text-center text-gray-400 py-4">No jobs ready for dispatch.</div>
            ) : readyToDispatch.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900">{job.job_number}</p>
                  <p className="text-sm text-gray-600">{job.client?.company || job.client?.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{job.project_name} - {job.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mt-1">Due: {job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : '-'}</p>
                </div>
              </div>
            ))}
          </div>
          {readyToDispatch.length > 0 && (
            <Link
              href="/admin/dispatch/history?status=ready"
              className="block w-full mt-4 text-center py-2.5 bg-green-100 text-green-700 rounded-xl text-sm font-medium hover:bg-green-200 transition-colors"
            >
              Process Dispatch
            </Link>
          )}
        </div>
      </div>

      {/* Recent Dispatches */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Dispatches</h2>
          <Link href="/admin/dispatch/history" className="text-sm text-indigo-600 hover:underline">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sentDispatches.length === 0 ? (
            <div className="col-span-3 text-center text-gray-400 py-4">No recent dispatches.</div>
          ) : sentDispatches.map((dispatch) => (
            <div key={dispatch.id} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900">{dispatch.dispatch_number}</p>
                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(dispatch.status)}`}>
                  {getStatusLabel(dispatch.status)}
                </span>
              </div>
              <p className="text-sm text-gray-600">{dispatch.client?.company || dispatch.client?.name}</p>
              <p className="text-xs text-gray-400 mt-1">Packages: {dispatch.packages}</p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">{dispatch.transporter_name || 'Self'}</span>
                <span className="text-xs text-gray-500">{dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString() : '-'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
