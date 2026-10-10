'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Package, Layers, ChevronLeft, ChevronRight, ScanLine, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import ProductBadge from '@/components/shared/ProductBadge';
import { matchesQuery } from '@/lib/page-search';
import { canShareSheet, printFamily } from '@/lib/product-category';

interface PendingJob {
    id: string;
    job_number: string;
    project_name: string;
    client_id: string;
    client_name: string;
    job_type: string;         // work type: print_only / design_print
    product_category?: string; // product type: POUCH / BOX / STICKER — used for grouping
    quantity?: number;
    urgency?: 'low' | 'normal' | 'high' | 'urgent';
    due_date?: string;
}

interface SheetLabel {
    label_name: string;
    ups_count: number;
    matched_job_id: string | null;
    matched_job_number: string | null;
    match_confidence: 'high' | 'medium' | 'low' | 'none';
}

interface PrintJobQueueProps {
    onAddJob: (job: PendingJob) => void;
    selectedJobType: string | null;
    disabledJobIds: Set<string>;
}


export function PrintJobQueue({ onAddJob, selectedJobType, disabledJobIds }: PrintJobQueueProps) {
    const [jobs, setJobs] = useState<PendingJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [jobTypes, setJobTypes] = useState<string[]>(['ALL']);

    // Sheet scanner state
    const [scanning, setScanning] = useState(false);
    const [scanMatched, setScanMatched] = useState<SheetLabel[]>([]);
    const [scanUnmatched, setScanUnmatched] = useState<SheetLabel[]>([]);
    const [showScanResults, setShowScanResults] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchPendingJobs();
        fetchCategories();
    }, []);

    // Fetch job type filters from product_categories (central source)
    const fetchCategories = async () => {
        const { data } = await supabase
            .from('product_categories')
            .select('name')
            .eq('is_active', true)
            .order('name', { ascending: true });
        if (data && data.length > 0) {
            setJobTypes(['ALL', ...data.map((c: any) => c.name.toUpperCase())]);
        }
    };

    const fetchPendingJobs = async () => {
        try {
            const { data, error } = await supabase
                .from('pending_print_jobs')
                .select('*')
                .neq('is_on_hold', true)  // ← exclude on-hold jobs from Print Planner
                .order('created_at', { ascending: true });

            if (error) throw error;
            // Extra client-side safety: also filter out any on_hold that slipped through
            setJobs((data || []).filter((j: any) => !j.is_on_hold));
        } catch (error: any) {
            toast.error('Failed to load print job queue: ' + (error.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleScanSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setScanning(true);
        setShowScanResults(false);
        setScanMatched([]);
        setScanUnmatched([]);

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('jobs', JSON.stringify(jobs.map(j => ({
                id: j.id,
                job_number: j.job_number,
                project_name: j.project_name,
                client_name: j.client_name,
                product_category: j.product_category,
                quantity: j.quantity,
            }))));

            const res = await fetch('/api/analyze-print-sheet', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Scan failed');

            const matched: SheetLabel[] = data.matched || [];
            const unmatched: SheetLabel[] = data.unmatched || [];

            // Auto-add matched jobs that aren't already added
            let addedCount = 0;
            for (const label of matched) {
                if (!label.matched_job_id) continue;
                const job = jobs.find(j => j.id === label.matched_job_id);
                if (job && !disabledJobIds.has(job.id)) {
                    onAddJob(job);
                    addedCount++;
                }
            }

            setScanMatched(matched);
            setScanUnmatched(unmatched);
            setShowScanResults(true);

            if (addedCount > 0) {
                toast.success(`✅ Sheet scanned — ${addedCount} job${addedCount > 1 ? 's' : ''} auto-added`);
            } else {
                toast.error('No matching jobs found on this sheet');
            }
        } catch (err: any) {
            toast.error('Sheet scan failed: ' + (err.message || 'Unknown error'));
        } finally {
            setScanning(false);
            // Reset file input so same file can be re-uploaded
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const filteredJobs = jobs.filter(job => {
        // Filter by product_category (POUCH/BOX/STICKER), not job_type (print_only/design_print)
        const productCat = (job.product_category || '').toUpperCase();
        const matchesFilter = filter === 'ALL' || productCat === filter;
        // job no., client AND job name; punctuation is ignored ("dp2809009" finds "DP-2809009")
        const matchesSearch = matchesQuery([job.job_number, job.client_name, job.project_name], searchTerm.trim());
        return matchesFilter && matchesSearch;
    });


    // "Added" = already in the selected list (show green ✓, button disabled but distinct style)
    const isAdded = (job: PendingJob) => disabledJobIds.has(job.id);
    // "Locked" = wrong product_category for the current print run (grayed out)
    const isLocked = (job: PendingJob) =>
        !disabledJobIds.has(job.id) && !!selectedJobType && !canShareSheet(job.product_category, selectedJobType);
    const isJobDisabled = (job: PendingJob) => isAdded(job) || isLocked(job);

    return (
        <div className="h-full flex flex-col bg-white rounded-md border border-gray-200">
            {/* Header — compact on mobile */}
            <div className="px-3 py-2 border-b border-gray-200 lg:p-6">
                {/* Title row — hidden on mobile to save space */}
                <div className="hidden lg:flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                        <Package className="text-gray-700" size={20} />
                    </div>
                    <div>
                        <h2 className="text-page-title text-gray-900">Pending Print Jobs</h2>
                        <p className="text-sm text-gray-500">Ready for print assignment</p>
                    </div>
                </div>
                {/* Mobile title — one line */}
                <p className="text-sm font-bold text-gray-900 mb-1.5 lg:hidden">Pending Print Jobs</p>

                {/* Search + Scan row */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search job no., client or job name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all outline-none text-sm"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={scanning || jobs.length === 0}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border transition-all shrink-0 ${
                            scanning
                                ? 'bg-amber-50 border-amber-300 text-amber-700 cursor-wait'
                                : 'bg-gray-900 border-gray-900 text-white hover:bg-gray-700'
                        }`}
                        title="Upload your imposition sheet image — AI will auto-match jobs"
                    >
                        <ScanLine size={14} />
                        {scanning ? 'Scanning...' : 'Scan Sheet'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleScanSheet}
                    />
                </div>
            </div>

            {/* Job Type Filters — single-line with arrow scroll buttons */}
            <div className="px-3 py-2 border-b border-gray-100">
                <div className="flex items-center gap-1">
                    {/* Left arrow */}
                    <button
                        onClick={() => {
                            const el = document.getElementById('pill-scroll');
                            if (el) el.scrollBy({ left: -120, behavior: 'smooth' });
                        }}
                        className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    {/* Scrollable pill row */}
                    <div id="pill-scroll" className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                        {jobTypes.map((type: string) => (
                            <button
                                key={type}
                                onClick={() => setFilter(type)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap flex-shrink-0 transition-all ${filter === type
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Right arrow */}
                    <button
                        onClick={() => {
                            const el = document.getElementById('pill-scroll');
                            if (el) el.scrollBy({ left: 120, behavior: 'smooth' });
                        }}
                        className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Scan Results Panel */}
            {showScanResults && (
                <div className="mx-2 mt-2 rounded-md border border-gray-200 overflow-hidden text-xs">
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                        <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">Sheet Scan Results</span>
                        <button
                            onClick={() => { setShowScanResults(false); setScanMatched([]); setScanUnmatched([]); }}
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                        >
                            <X size={13} />
                        </button>
                    </div>

                    {/* Matched jobs — confirmed auto-added */}
                    {scanMatched.length > 0 && (
                        <div className="p-2 space-y-1 border-b border-gray-100">
                            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide px-1 mb-1">✓ Auto-added ({scanMatched.length})</p>
                            {scanMatched.map((label, i) => (
                                <div key={i} className="flex items-center gap-2 px-2 py-1 bg-green-50 rounded border border-green-100">
                                    <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                                    <span className="text-gray-800 font-medium truncate flex-1">{label.label_name}</span>
                                    {label.matched_job_number && (
                                        <span className="font-mono text-[10px] text-gray-500 shrink-0">{label.matched_job_number}</span>
                                    )}
                                    {label.ups_count > 1 && (
                                        <span className="text-[10px] text-green-600 shrink-0">{label.ups_count}× UPS</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Unmatched labels — flagged, no pending job found */}
                    {scanUnmatched.length > 0 && (
                        <div className="p-2 space-y-1">
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide px-1 mb-1">⚠ Not in queue ({scanUnmatched.length})</p>
                            {scanUnmatched.map((label, i) => (
                                <div key={i} className="flex items-center gap-2 px-2 py-1 bg-amber-50 rounded border border-amber-200">
                                    <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                                    <span className="text-gray-800 font-medium truncate flex-1">{label.label_name}</span>
                                    {label.ups_count > 1 && (
                                        <span className="text-[10px] text-amber-600 shrink-0">{label.ups_count}× UPS</span>
                                    )}
                                    <span className="text-[10px] text-amber-600 shrink-0">Add to queue?</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Jobs List — compact rows, fit many at once */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No pending jobs</p>
                        <p className="text-sm text-gray-400">All jobs are assigned or none match filter</p>
                    </div>
                ) : (
                    filteredJobs.map(job => {
                        const added  = isAdded(job);
                        const locked = isLocked(job);
                        return (
                            <div
                                key={job.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-all ${
                                    added   ? 'bg-green-50 border-green-200' :
                                    locked  ? 'bg-gray-50 border-gray-100 opacity-40' :
                                              'bg-white border-gray-200 hover:border-gray-400'
                                }`}
                            >
                                {/* Job number */}
                                <span className="font-mono text-xs font-bold text-gray-900 w-24 shrink-0">
                                    {job.job_number}
                                </span>

                                {/* Category badge — same colours as every other board */}
                                <ProductBadge category={job.product_category} />

                                {/* Urgency dot */}
                                {job.urgency && job.urgency !== 'normal' && (
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${job.urgency === 'urgent' ? 'bg-red-500' : job.urgency === 'high' ? 'bg-orange-400' : 'bg-gray-300'}`}
                                        title={job.urgency} />
                                )}

                                {/* Name + client — takes remaining space, truncates */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate leading-tight">{job.project_name}</p>
                                    <p className="text-[10px] text-gray-400 truncate leading-tight">
                                        {job.client_name}{job.quantity ? ` · ${job.quantity.toLocaleString()} qty` : ''}
                                    </p>
                                </div>

                                {/* Add button — 3 states: added (green ✓) / locked (gray) / available (black) */}
                                <button
                                    onClick={() => !added && !locked && onAddJob(job)}
                                    disabled={locked}
                                    className={`px-3 py-1 rounded text-xs font-medium shrink-0 transition-all ${
                                        added  ? 'bg-green-100 text-green-700 cursor-default' :
                                        locked ? 'bg-gray-100 text-gray-300 cursor-not-allowed' :
                                                 'bg-gray-900 text-white hover:bg-gray-700'
                                    }`}
                                    title={locked && selectedJobType ? (job.product_category ? `This sheet takes ${printFamily(selectedJobType)} jobs only` : 'Set this job\'s product type first — jobs with no type cannot share a sheet') : ''}
                                >
                                    {added ? '✓' : 'Add'}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Job Type Lock Warning */}
            {selectedJobType && (
                <div className="p-4 border-t border-gray-200 bg-gray-100">
                    <div className="flex items-center gap-2 text-sm">
                        <Layers size={16} className="text-gray-700" />
                        <span className="font-medium text-gray-900">
                            Locked to: <span className="font-bold">{printFamily(selectedJobType)}</span> jobs only
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
