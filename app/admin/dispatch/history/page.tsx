'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import {
  Search, ArrowLeft, Truck, CheckCircle,
  MapPin, Phone, X, Eye, Upload, Share2, Package, MessageCircle, Loader2,
  ClipboardCheck, User, Clock
} from 'lucide-react';
import { useDispatches } from '@/lib/hooks';
import { Dispatch, DispatchStatus } from '@/types/database';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ConfirmModal';
import { supabase } from '@/lib/supabase';

// Minimal print run type for history
interface PrintRunHistory {
  id: string;
  print_run_number: string;
  status: string;
  delivery_mode?: string;
  delivery_address?: string;
  transporter_name?: string;
  eway_bill_number?: string;
  dispatch_date?: string;
  invoice_reference?: string;
  created_at: string;
  updated_at?: string;
  vendor?: { name: string; company?: string };
  print_run_jobs?: {
    id: string;
    client_name?: string;
    item_name?: string;
    job?: { job_number?: string; client?: { company?: string; name?: string; phone?: string } };
  }[];
}

// QC record for report modal
interface QcReportRecord {
  id: string;
  qc_type: string;
  checklist: Record<string, boolean>;
  result: string;
  notes?: string;
  photos?: string[];
  skip_reason?: string;
  performed_by_name?: string;
  performed_at: string;
  design_file_url?: string;
}

export default function DispatchHistoryPage() {
  const { dispatches, loading, updateDispatch } = useDispatches();
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'jobs' | 'print_runs'>('all');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);

  // Print runs
  const [printRuns, setPrintRuns] = useState<PrintRunHistory[]>([]);
  const [printRunsLoading, setPrintRunsLoading] = useState(true);

  // QC Report modal
  const [showQcReport, setShowQcReport] = useState(false);
  const [qcReportRecords, setQcReportRecords] = useState<QcReportRecord[]>([]);
  const [qcReportTitle, setQcReportTitle] = useState('');
  const [qcReportLoading, setQcReportLoading] = useState(false);

  useEffect(() => {
    const fetchPrintRuns = async () => {
      setPrintRunsLoading(true);
      try {
        const { data, error } = await supabase
          .from('print_runs')
          .select('*, vendor:vendors!print_runs_vendor_id_fkey(name, company), print_run_jobs(*, job:jobs(job_number, client:clients(company, name, phone)))')
          // A warehouse run's terminal state is `handed_over`; only a
          // direct-to-client run ever reaches `dispatched`. Filtering on
          // 'dispatched' alone emptied this tab permanently.
          .in('status', ['handed_over', 'dispatched'])
          .order('updated_at', { ascending: false });
        // Thrown, not ignored: the catch below already tells the user. Without
        // this a failure showed an empty dispatch history, which reads as
        // "nothing was ever dispatched".
        if (error) throw error;
        setPrintRuns(data || []);
      } catch (err: any) {
        toast.error('Failed to load print run history: ' + (err.message || 'Unknown error'));
      } finally {
        setPrintRunsLoading(false);
      }
    };
    fetchPrintRuns();
  }, []);

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

  const filteredPrintRuns = printRuns.filter(pr => {
    const matchesSearch =
      pr.print_run_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.print_run_jobs?.some(j =>
        j.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.job?.job_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.job?.client?.company?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesStatus = statusFilter === 'all' || statusFilter === 'dispatched';
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

  const handleWhatsAppShare = (dispatch: Dispatch) => {
    const clientPhone = dispatch.client?.phone;
    if (!clientPhone) return toast.info('No client phone number available');

    const message = `📦 Dispatch Update for Order #${dispatch.job?.job_number || 'N/A'}\n\nStatus: ${getStatusLabel(dispatch.status)}\nTransporter: ${dispatch.transporter_name || 'N/A'}\nTracking / LR: ${dispatch.tracking_number || 'N/A'}\nVehicle: ${dispatch.vehicle_number || 'N/A'}\nDriver: ${dispatch.driver_name} (${dispatch.driver_phone})\n\nExpected Delivery: ${dispatch.expected_delivery || 'TBD'}\n\nThank you for choosing Aayam!`;

    window.open(`https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleMarkDelivered = async (dispatch: Dispatch) => {
    const { confirmed } = await confirm({ title: 'Mark Delivered', message: 'Mark this dispatch as DELIVERED?', confirmLabel: 'Mark Delivered' });
    if (confirmed) {
      await updateDispatch(dispatch.id, {
        status: 'delivered',
        actual_delivery: new Date().toISOString().split('T')[0]
      });
    }
  };

  // View QC Report
  const handleViewQcReport = async (type: 'job' | 'print_run', id: string, title: string) => {
    setQcReportTitle(title);
    setQcReportLoading(true);
    setShowQcReport(true);
    try {
      const column = type === 'job' ? 'job_id' : 'print_run_id';
      const { data } = await supabase
        .from('qc_records')
        .select('*')
        .eq(column, id)
        .order('performed_at', { ascending: false });
      setQcReportRecords(data || []);
    } catch {
      setQcReportRecords([]);
    } finally {
      setQcReportLoading(false);
    }
  };

  const qcPassedCount = dispatches.filter(d => d.status === 'pending' || d.status === 'packed').length;
  const inTransitCount = dispatches.filter(d => ['dispatched', 'in_transit'].includes(d.status)).length;
  const deliveredCount = dispatches.filter(d => d.status === 'delivered').length;

  const isLoading = loading || printRunsLoading;

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/admin/dispatch" className="p-2 hover:bg-gray-100 rounded-md lg:hidden"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl lg:text-page-title text-gray-900">Dispatch History</h1>
          <p className="text-sm text-gray-500">{filteredDispatches.length} dispatches · {filteredPrintRuns.length} print runs</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-center">
          <p className="text-page-title text-green-700">{printRuns.length}</p>
          <p className="text-xs text-green-700 font-medium">Print Runs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
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
          <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
            {(['all', 'jobs', 'print_runs'] as const).map(src => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${sourceFilter === src ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                {src === 'all' ? 'All' : src === 'jobs' ? 'Jobs' : 'Print Runs'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sourceFilter !== 'print_runs' && filteredDispatches.length === 0 && sourceFilter !== 'all' && (
          <div className="col-span-full text-center py-12 text-gray-500">No dispatch records found.</div>
        )}

        {/* Job dispatches */}
        {sourceFilter !== 'print_runs' && filteredDispatches.map((dispatch) => (
          <div key={dispatch.id} className="bg-white rounded-md border border-gray-200 overflow-hidden">
            <div className={`px-3 py-2 flex items-center justify-between ${dispatch.status === 'delivered' ? 'bg-gray-900' : dispatch.status === 'returned' ? 'bg-red-600' : 'bg-gray-700'}`}>
              <span className="text-white font-semibold text-sm">{dispatch.dispatch_number}</span>
              <span className={`px-2 py-0.5 text-xs rounded-md border font-medium ${dispatch.status === 'delivered' ? 'bg-white/15 text-white border-white/20' : getStatusColor(dispatch.status)}`}>{getStatusLabel(dispatch.status)}</span>
            </div>

            <div className="p-3">
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-900">{dispatch.client?.company || dispatch.client?.name}</p>
                <p className="text-xs text-gray-400">Order: {dispatch.job?.job_number}</p>
              </div>

              {dispatch.packages > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Package className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{dispatch.packages} Pkgs</span>
                </div>
              )}

              {dispatch.transporter_name && (
                <div className="p-2 bg-gray-50 rounded-md text-xs space-y-1 mb-2">
                  <div><span className="text-gray-500">Transporter:</span> <span className="font-medium">{dispatch.transporter_name}</span></div>
                  {dispatch.tracking_number && <div><span className="text-gray-500">LR/Track:</span> <span className="font-medium text-gray-900">{dispatch.tracking_number}</span></div>}
                </div>
              )}

              <div className="text-xs text-gray-500 mb-3">
                {dispatch.dispatch_date && <span>Dispatched: {new Date(dispatch.dispatch_date).toLocaleDateString()}</span>}
                {dispatch.actual_delivery && <span className="ml-2 text-gray-900">Delivered: {new Date(dispatch.actual_delivery).toLocaleDateString()}</span>}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => handleWhatsAppShare(dispatch)} className="px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-md border border-gray-200 flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</button>
                <button
                  onClick={() => dispatch.job_id && handleViewQcReport('job', dispatch.job_id, `${dispatch.dispatch_number} — ${dispatch.job?.job_number}`)}
                  className="px-2.5 py-1.5 text-xs text-purple-700 hover:bg-purple-50 rounded-md border border-purple-200 flex items-center gap-1"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" /> QC Report
                </button>

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

        {/* Print run dispatches */}
        {sourceFilter !== 'jobs' && filteredPrintRuns.map((pr) => (
          <div key={pr.id} className="bg-white rounded-md border border-green-200 overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between bg-green-700">
              <span className="text-white font-semibold text-sm">{pr.print_run_number}</span>
              <span className="px-2 py-0.5 text-xs rounded-md bg-white/15 text-white border border-white/20 font-medium">Print Run</span>
            </div>
            <div className="p-3">
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-900">
                  {pr.print_run_jobs?.map(j => j.client_name || j.job?.client?.company).filter(Boolean).slice(0, 2).join(', ') || 'No clients'}
                </p>
                <p className="text-xs text-gray-400">
                  {pr.print_run_jobs?.map(j => j.job?.job_number).filter(Boolean).join(', ') || 'No jobs linked'}
                </p>
              </div>

              <div className="p-2 bg-green-50 rounded-md text-xs space-y-1 mb-2">
                <div><span className="text-gray-500">Delivery:</span> <span className="font-medium">{pr.delivery_mode === 'direct_to_client' ? '📦 Direct to Client' : '🏭 Via Warehouse'}</span></div>
                {pr.transporter_name && <div><span className="text-gray-500">Transporter:</span> <span className="font-medium">{pr.transporter_name}</span></div>}
                {pr.eway_bill_number && <div><span className="text-gray-500">E-way Bill:</span> <span className="font-medium">{pr.eway_bill_number}</span></div>}
              </div>

              <div className="text-xs text-gray-500 mb-3">
                {pr.dispatch_date
                  ? <span>Dispatched: {new Date(pr.dispatch_date).toLocaleDateString()}</span>
                  : pr.updated_at && <span>Updated: {new Date(pr.updated_at).toLocaleDateString()}</span>
                }
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleViewQcReport('print_run', pr.id, pr.print_run_number)}
                  className="px-2.5 py-1.5 text-xs text-purple-700 hover:bg-purple-50 rounded-md border border-purple-200 flex items-center gap-1"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" /> QC Report
                </button>
                <Link href="/admin/print-runs" className="px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-md border border-gray-200 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> View Run
                </Link>
              </div>
            </div>
          </div>
        ))}

        {filteredDispatches.length === 0 && filteredPrintRuns.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">No dispatch history found.</div>
        )}
      </div>

      {/* View Modal */}
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedDispatch.proof_of_delivery_url} alt="Proof of Delivery" className="w-full rounded-md" />
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

      {/* QC Report Modal */}
      {showQcReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-section text-gray-900">QC Report</h2>
                <p className="text-xs text-gray-500 mt-0.5">{qcReportTitle}</p>
              </div>
              <button onClick={() => setShowQcReport(false)} className="p-2 hover:bg-gray-100 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              {qcReportLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : qcReportRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No QC records found</p>
                  <p className="text-xs mt-1">QC will be logged when the check is performed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {qcReportRecords.map(record => (
                    <div key={record.id} className={`p-4 rounded-md border ${record.result === 'passed' ? 'bg-green-50 border-green-200' :
                      record.result === 'failed' ? 'bg-red-50 border-red-200' :
                        'bg-amber-50 border-amber-200'
                      }`}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${record.result === 'passed' ? 'bg-green-100 text-green-800' :
                            record.result === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                            {record.result.toUpperCase()}
                          </span>
                          <span className="text-xs font-medium text-gray-700 capitalize">
                            {record.qc_type.replace('_', '-')} QC
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(record.performed_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        <User className="w-3 h-3" />
                        {record.performed_by_name || 'Unknown'}
                      </div>

                      {/* Checklist */}
                      {record.checklist && Object.keys(record.checklist).length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Checklist</p>
                          <div className="grid grid-cols-2 gap-1">
                            {Object.entries(record.checklist).map(([key, val]) => (
                              <div key={key} className="flex items-center gap-1.5 text-xs">
                                {val ? <CheckCircle className="w-3 h-3 text-green-600" /> : <X className="w-3 h-3 text-red-400" />}
                                <span className={val ? 'text-gray-700' : 'text-gray-400'}>{key}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {record.notes && (
                        <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{record.notes}&rdquo;</p>
                      )}

                      {record.skip_reason && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs">
                          <span className="text-amber-600 font-medium">Skip Reason:</span>
                          <span className="text-gray-600">{record.skip_reason}</span>
                        </div>
                      )}

                      {record.photos && record.photos.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Remote QC Photos</p>
                          <div className="flex gap-2 flex-wrap">
                            {record.photos.map((url, idx) => (
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">
                                Photo {idx + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
