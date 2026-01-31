'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, CheckCircle, Truck, Clock, AlertTriangle, ClipboardCheck, Loader2, X } from 'lucide-react';
import { useJobs, useDispatches } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import { Job, Dispatch } from '@/types/database';

export default function DispatchPage() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading, updateJobStage } = useJobs({
    orderBy: { column: 'client_deadline', ascending: true }
  });
  const { dispatches, loading: dispatchesLoading, createDispatch } = useDispatches();

  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    transporter_name: '',
    tracking_number: '',
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    packages: 1,
    notes: '',
    attachmentUrl: ''
  });

  const loading = jobsLoading || dispatchesLoading;

  // Filter Data
  const pendingQC = jobs.filter(j => j.current_stage === 'quality_check');

  // Ready to Dispatch (QC Passed - 'ready')
  // Removed payment check as per user request
  const readyToDispatch = jobs.filter(j => j.current_stage === 'ready');

  const sentDispatches = dispatches.slice(0, 3); // Get latest 3

  // Calculate Delayed Jobs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

  const handleOpenDispatch = (job: Job) => {
    setSelectedJob(job);
    setDispatchForm({
      transporter_name: '', tracking_number: '', vehicle_number: '',
      driver_name: '', driver_phone: '', packages: job.quantity || 1, notes: '',
      attachmentUrl: ''
    });
    setShowDispatchModal(true);
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmitting(true);

    try {
      // 1. Create Dispatch Record
      const result = await createDispatch({
        job_id: selectedJob.id,
        client_id: selectedJob.client_id,
        status: 'dispatched',
        dispatch_date: new Date().toISOString(),
        ...dispatchForm
      } as any);

      if (result.error) throw new Error(result.error);

      // 2. Update Job Status to 'dispatched'
      // This effectively removes it from "Ready" list and moves logic to "Dispatched"
      await updateJobStage(selectedJob.id, 'dispatched', `Dispatched via ${dispatchForm.transporter_name || 'Self'}. Tracking: ${dispatchForm.tracking_number || 'N/A'}`);

      setShowDispatchModal(false);
      alert('Order marked as Dispatched!');
    } catch (err: any) {
      alert('Error dispatching: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in px-3 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-page-title text-gray-900">Dispatch Command Center</h1>
          <p className="text-sm md:text-base text-gray-500">Welcome, {profile?.full_name || 'Dispatcher'} | QC & Logistics</p>
        </div>
        <Link
          href="/admin/dispatch/qc-check"
          className="flex items-center justify-center gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-sm md:text-base"
        >
          <ClipboardCheck size={16} className="md:hidden" />
          <ClipboardCheck size={18} className="hidden md:block" />
          <span>Start QC</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg md:rounded-2xl p-3 md:p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
              <div className={`w-8 h-8 md:w-10 md:h-10 ${stat.color} rounded-lg md:rounded-xl flex items-center justify-center`}>
                <stat.icon size={16} className="text-white md:hidden" />
                <stat.icon size={20} className="text-white hidden md:block" />
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

      {/* QC & Ready Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending QC */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section text-gray-900">Pending QC</h2>
            <Link href="/admin/dispatch/qc-check" className="text-sm text-oms-blue hover:underline">
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
                    {job.priority === 'urgent' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Urgent</span>}
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

        {/* Ready to Dispatch - NOW WITH ACTION */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-section text-gray-900">Ready to Dispatch</h2>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
              {readyToDispatch.length} ready
            </span>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {readyToDispatch.length === 0 ? (
              <div className="text-center text-gray-400 py-4">No jobs ready for dispatch.</div>
            ) : readyToDispatch.map((job) => (
              <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl gap-3">
                <div>
                  <p className="font-medium text-gray-900">{job.job_number}</p>
                  <p className="text-sm text-gray-600">{job.client?.company || job.client?.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{job.project_name} - {job.quantity}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-500">Due</p>
                    <p className="text-sm font-medium">{job.client_deadline ? new Date(job.client_deadline).toLocaleDateString() : '-'}</p>
                  </div>
                  {(() => {
                    const hasInvoice = (job as any).invoices && (job as any).invoices.length > 0;
                    return (
                      <button
                        disabled={!hasInvoice}
                        onClick={() => handleOpenDispatch(job)}
                        className={`px-4 py-2 text-white text-sm font-medium rounded-lg shadow-sm whitespace-nowrap ${hasInvoice ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
                          }`}
                        title={hasInvoice ? 'Proceed to Dispatch' : 'Strict Rule: Cannot Dispatch without Invoice'}
                      >
                        {hasInvoice ? 'Dispatch Now' : 'Invoice Needed'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Dispatches */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-section text-gray-900">Recent Dispatches</h2>
          <Link href="/admin/dispatch/history" className="text-sm text-oms-blue hover:underline">
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

      {/* Create Dispatch Modal */}
      {showDispatchModal && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-section">Create Dispatch</h2>
                <p className="text-sm text-gray-500">Order #{selectedJob.job_number}</p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Transporter Name</label>
                  <input type="text" placeholder="e.g. DTDC, Self"
                    value={dispatchForm.transporter_name} onChange={e => setDispatchForm({ ...dispatchForm, transporter_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tracking / LR No</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.tracking_number} onChange={e => setDispatchForm({ ...dispatchForm, tracking_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Vehicle No</label>
                  <input type="text" placeholder="e.g. OD-02-AA-1234"
                    value={dispatchForm.vehicle_number} onChange={e => setDispatchForm({ ...dispatchForm, vehicle_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Packages Count</label>
                  <input type="number" min="1"
                    value={dispatchForm.packages} onChange={e => setDispatchForm({ ...dispatchForm, packages: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Driver Name</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.driver_name} onChange={e => setDispatchForm({ ...dispatchForm, driver_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Driver Phone</label>
                  <input type="text" placeholder="Optional"
                    value={dispatchForm.driver_phone} onChange={e => setDispatchForm({ ...dispatchForm, driver_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea rows={3} placeholder="Any delivery instructions..."
                  value={dispatchForm.notes} onChange={e => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Attachment (Transport Slip/Package Photo)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // TODO: Upload to storage and get URL
                      // For now, store filename
                      setDispatchForm({ ...dispatchForm, attachmentUrl: file.name });
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                />
                {dispatchForm.attachmentUrl && (
                  <p className="text-xs text-green-600 mt-1">✓ {dispatchForm.attachmentUrl}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Upload slip/photo from gallery or camera</p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-500 flex gap-2">
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                This will move the order status to &quot;Dispatched&quot; and create a dispatch record.
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDispatchModal(false)} className="flex-1 px-4 py-2 border rounded-xl">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-xl">
                  {submitting ? 'Creating...' : 'Create Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
