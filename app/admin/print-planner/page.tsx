'use client';

import { useState } from 'react';
import { PrintJobQueue } from '@/components/print-planner/PrintJobQueue';
import { CreatePrintRunForm } from '@/components/print-planner/CreatePrintRunForm';
import { ArrowLeft, ArrowRight, CheckCircle, Layers, Package, Settings2, Users, AlertTriangle, Ruler } from 'lucide-react';

const DEFAULT_PULLING = 1100; // Default pulling multiple

// Common sheet sizes in Indian printing industry
const COMMON_SHEET_SIZES = [
    '20" × 30"',
    '23" × 36"',
    '25" × 36"',
    '22" × 28"',
    '18" × 23"',
    'Custom',
];

function roundToMultiple(n: number, multiple: number): number {
    if (n <= 0) return 0;
    return Math.ceil(n / multiple) * multiple;
}

interface PendingJob {
    id: string;
    job_number: string;
    project_name: string;
    client_id: string;
    client_name: string;
    job_type: string;
    quantity?: number;
    urgency?: 'low' | 'normal' | 'high' | 'urgent';
    due_date?: string;
}

// Extended job with UPS/Qty configuration
interface ConfiguredJob extends PendingJob {
    quantity_needed: number;
    ups_in_sheet: number;
    sheets_required: number;   // Raw calculation: ceil(qty / ups)
    pulling_sheets: number;    // Rounded to nearest 500
    actual_print_qty: number;  // pulling_sheets × ups
    extra_prints: number;      // actual - needed (waste)
}

const STEPS = [
    { id: 1, label: 'Select Jobs', icon: Package },
    { id: 2, label: 'Configure UPS & Qty', icon: Settings2 },
    { id: 3, label: 'Print Specs & Submit', icon: CheckCircle },
];

export default function PrintPlannerPage() {
    const [step, setStep] = useState(1);
    const [selectedJobs, setSelectedJobs] = useState<PendingJob[]>([]);
    const [configuredJobs, setConfiguredJobs] = useState<ConfiguredJob[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [pullingMultiple, setPullingMultiple] = useState(DEFAULT_PULLING);
    const [sheetSize, setSheetSize] = useState('23" × 36"');


    // Step 1: Add job to selection
    const handleAddJob = (job: PendingJob) => {
        if (selectedJobs.length > 0) {
            const existingJobType = selectedJobs[0].job_type;
            if (job.job_type !== existingJobType) {
                alert(`Cannot add ${job.job_type} job to ${existingJobType} print run.\n\nOnly jobs with the same type can be batched together.`);
                return;
            }
        }
        setSelectedJobs(prev => [...prev, job]);
    };

    const handleRemoveJobStep1 = (jobId: string) => {
        setSelectedJobs(prev => prev.filter(j => j.id !== jobId));
    };

    // Step 1 → Step 2: Initialize configured jobs
    const goToStep2 = () => {
        const configured: ConfiguredJob[] = selectedJobs.map(job => {
            const qty = job.quantity || 0;
            const ups = 1;
            const rawSheets = qty > 0 ? Math.ceil(qty / ups) : 0;
            const pulling = roundToMultiple(rawSheets, pullingMultiple);
            const actualQty = pulling * ups;
            return {
                ...job,
                quantity_needed: qty,
                ups_in_sheet: ups,
                sheets_required: rawSheets,
                pulling_sheets: pulling,
                actual_print_qty: actualQty,
                extra_prints: actualQty - qty,
            };
        });
        setConfiguredJobs(configured);
        setStep(2);
    };

    // Step 2: Update job configuration
    const updateJobConfig = (jobId: string, field: 'quantity_needed' | 'ups_in_sheet', value: number) => {
        setConfiguredJobs(prev => prev.map(job => {
            if (job.id !== jobId) return job;
            const updated = { ...job, [field]: value };
            // Recalculate sheets with pulling
            const rawSheets = updated.ups_in_sheet > 0
                ? Math.ceil(updated.quantity_needed / updated.ups_in_sheet)
                : 0;
            updated.sheets_required = rawSheets;
            updated.pulling_sheets = roundToMultiple(rawSheets, pullingMultiple);
            updated.actual_print_qty = updated.pulling_sheets * updated.ups_in_sheet;
            updated.extra_prints = updated.actual_print_qty - updated.quantity_needed;
            return updated;
        }));
    };

    // Recalculate all jobs when pulling multiple changes
    const handlePullingChange = (newMultiple: number) => {
        if (newMultiple < 1) return;
        setPullingMultiple(newMultiple);
        setConfiguredJobs(prev => prev.map(job => {
            const rawSheets = job.ups_in_sheet > 0
                ? Math.ceil(job.quantity_needed / job.ups_in_sheet)
                : 0;
            const pulling = roundToMultiple(rawSheets, newMultiple);
            const actualQty = pulling * job.ups_in_sheet;
            return {
                ...job,
                sheets_required: rawSheets,
                pulling_sheets: pulling,
                actual_print_qty: actualQty,
                extra_prints: actualQty - job.quantity_needed,
            };
        }));
    };

    const removeJobStep2 = (jobId: string) => {
        setConfiguredJobs(prev => prev.filter(j => j.id !== jobId));
        setSelectedJobs(prev => prev.filter(j => j.id !== jobId));
    };

    // Step 3: Success handler
    const handleSuccess = () => {
        setRefreshKey(prev => prev + 1);
        setSelectedJobs([]);
        setConfiguredJobs([]);
        setStep(1);
        alert('Print run created successfully!');
    };

    const handleClear = () => {
        setSelectedJobs([]);
        setConfiguredJobs([]);
        setStep(1);
    };

    const selectedJobIds = new Set(selectedJobs.map(j => j.id));
    const selectedJobType = selectedJobs.length > 0 ? selectedJobs[0].job_type : null;
    const uniqueClients = Array.from(new Set(configuredJobs.map(j => j.client_name)));
    const isMultiClient = uniqueClients.length > 1;
    const totalSheets = configuredJobs.length > 0
        ? (isMultiClient
            ? Math.max(...configuredJobs.map(j => j.sheets_required))
            : configuredJobs.reduce((sum, j) => sum + j.sheets_required, 0))
        : 0;
    const totalPullingSheets = configuredJobs.length > 0
        ? (isMultiClient
            ? roundToMultiple(Math.max(...configuredJobs.map(j => j.pulling_sheets)), pullingMultiple)
            : configuredJobs.reduce((sum, j) => sum + j.pulling_sheets, 0))
        : 0;
    const totalQty = configuredJobs.reduce((sum, j) => sum + j.quantity_needed, 0);
    const totalActualQty = configuredJobs.reduce((sum, j) => sum + j.actual_print_qty, 0);
    const totalExtra = totalActualQty - totalQty;

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-12">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-page-title text-gray-900 mb-1">Print Planner</h1>
                <p className="text-sm text-gray-600">Select jobs → Configure quantity & UPS → Create print run</p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-4 bg-white rounded-md border border-gray-200 p-3">
                {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const isActive = step === s.id;
                    const isCompleted = step > s.id;
                    return (
                        <div key={s.id} className="flex items-center gap-2 flex-1">
                            <button
                                onClick={() => {
                                    if (isCompleted) setStep(s.id);
                                }}
                                disabled={!isCompleted && !isActive}
                                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all w-full ${isActive
                                    ? 'bg-gray-900 text-white'
                                    : isCompleted
                                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                                        : 'bg-gray-50 text-gray-400 cursor-default'
                                    }`}
                            >
                                <Icon size={16} />
                                <span className="hidden sm:inline">{s.label}</span>
                                <span className="sm:hidden">{s.id}</span>
                            </button>
                            {i < STEPS.length - 1 && (
                                <ArrowRight size={14} className="text-gray-300 shrink-0" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step 1: Select Jobs */}
            {step === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left: Job Queue (2/3) */}
                    <div className="lg:col-span-2 h-[calc(100vh-280px)]">
                        <PrintJobQueue
                            key={refreshKey}
                            onAddJob={handleAddJob}
                            selectedJobType={selectedJobType}
                            disabledJobIds={selectedJobIds}
                        />
                    </div>

                    {/* Right: Selected Jobs Summary (1/3) */}
                    <div className="h-[calc(100vh-280px)] flex flex-col bg-white rounded-md border border-gray-200">
                        <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900">
                                    Selected Jobs ({selectedJobs.length})
                                </h3>
                                {selectedJobs.length > 0 && (
                                    <button
                                        onClick={() => setSelectedJobs([])}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        Clear all
                                    </button>
                                )}
                            </div>
                            {selectedJobType && (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-gray-900 text-white rounded text-xs font-bold">
                                        {selectedJobType}
                                    </span>
                                    {isMultiClient && (
                                        <span className="flex items-center gap-1 text-xs font-medium text-gray-600">
                                            <Users size={12} /> Multi-client
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {selectedJobs.length === 0 ? (
                                <div className="text-center py-12">
                                    <Package className="mx-auto h-10 w-10 text-gray-200 mb-2" />
                                    <p className="text-sm text-gray-400">Click &quot;Add&quot; on jobs to select them</p>
                                </div>
                            ) : (
                                selectedJobs.map(job => (
                                    <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{job.job_number}</p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {job.client_name} · {job.project_name}
                                            </p>
                                            {job.quantity && (
                                                <p className="text-xs text-gray-400">{job.quantity.toLocaleString()} qty</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveJobStep1(job.id)}
                                            className="ml-2 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-all"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Next Button */}
                        <div className="p-4 border-t border-gray-200">
                            <button
                                onClick={goToStep2}
                                disabled={selectedJobs.length === 0}
                                className="w-full py-3 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                Next: Configure UPS & Qty
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Configure UPS & Quantity per Job */}
            {step === 2 && (
                <div className="bg-white rounded-md border border-gray-200">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Settings2 size={16} />
                                    Configure Each Job
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Set UPS per sheet and quantity for each job. Sheets auto-round to pulling multiple.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isMultiClient && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md text-xs font-bold text-gray-700 border border-gray-200">
                                        <Layers size={14} />
                                        GANG SHEET — Multiple clients share sheets
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Print Settings Bar */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-4">
                        {/* Sheet Size */}
                        <div className="flex items-center gap-2">
                            <Ruler size={14} className="text-gray-500" />
                            <label className="text-xs font-bold text-gray-600 whitespace-nowrap">Sheet Size</label>
                            <select
                                value={COMMON_SHEET_SIZES.includes(sheetSize) ? sheetSize : 'Custom'}
                                onChange={(e) => {
                                    if (e.target.value === 'Custom') {
                                        const custom = prompt('Enter custom sheet size (e.g. 24" × 36")');
                                        if (custom) setSheetSize(custom);
                                    } else {
                                        setSheetSize(e.target.value);
                                    }
                                }}
                                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 outline-none bg-white font-medium"
                            >
                                {COMMON_SHEET_SIZES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            {!COMMON_SHEET_SIZES.includes(sheetSize) && (
                                <span className="text-xs font-bold text-gray-700 bg-white px-2 py-1 rounded border">{sheetSize}</span>
                            )}
                        </div>

                        {/* Separator */}
                        <div className="h-6 w-px bg-gray-300"></div>

                        {/* Pulling Multiple */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-600 whitespace-nowrap">Pulling ×</label>
                            <input
                                type="number"
                                min="1"
                                step="100"
                                value={pullingMultiple}
                                onChange={(e) => handlePullingChange(parseInt(e.target.value) || DEFAULT_PULLING)}
                                className="w-20 px-2 py-1.5 text-center text-sm font-bold border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 outline-none bg-white"
                            />
                            <span className="text-xs text-gray-400">sheets/pull</span>
                        </div>

                        {/* Quick presets */}
                        <div className="flex items-center gap-1">
                            {[500, 1000, 1100, 1500].map(n => (
                                <button
                                    key={n}
                                    onClick={() => handlePullingChange(n)}
                                    className={`px-2 py-1 text-xs rounded transition-all ${pullingMultiple === n
                                        ? 'bg-gray-900 text-white font-bold'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>

                    </div>

                    {/* Job Configuration Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Job #</th>
                                    <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Client</th>
                                    <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Project</th>
                                    <th className="text-center text-xs font-bold text-gray-600 px-4 py-3 w-28">Client Qty</th>
                                    <th className="text-center text-xs font-bold text-gray-600 px-4 py-3 w-24">UPS / Sheet</th>
                                    <th className="text-center text-xs font-bold text-gray-600 px-4 py-3 w-28">Print Qty</th>
                                    <th className="text-center text-xs font-bold text-gray-600 px-4 py-3 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {configuredJobs.map((job, idx) => (
                                    <tr key={job.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm font-bold text-gray-900">{job.job_number}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-700">{job.client_name}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-700">{job.project_name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                value={job.quantity_needed}
                                                onChange={(e) => updateJobConfig(job.id, 'quantity_needed', parseInt(e.target.value) || 0)}
                                                className="w-24 px-3 py-1.5 text-center text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="number"
                                                min="1"
                                                value={job.ups_in_sheet}
                                                onChange={(e) => updateJobConfig(job.id, 'ups_in_sheet', parseInt(e.target.value) || 1)}
                                                className="w-20 px-3 py-1.5 text-center text-sm font-bold border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none bg-gray-50"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-bold text-gray-900">{job.actual_print_qty.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => removeJobStep2(job.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                                title="Remove job"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 border-t-2 border-gray-300">
                                    <td colSpan={3} className="px-4 py-3 text-right">
                                        <span className="text-sm font-bold text-gray-700">TOTALS</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-sm font-bold text-gray-900">{totalQty.toLocaleString()}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-xs text-gray-500">—</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-sm font-bold text-gray-900">{totalActualQty.toLocaleString()}</span>
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Info Banner */}
                    <div className="mx-4 my-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-blue-900">Pulling ×{pullingMultiple} · Sheet: {sheetSize}</p>
                                <p className="text-xs text-blue-700 mt-0.5">
                                    Client needs <strong>{totalQty.toLocaleString()}</strong> →
                                    We print <strong>{totalActualQty.toLocaleString()}</strong>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Gang Sheet Info */}
                    {isMultiClient && (
                        <div className="mx-4 my-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                            <div className="flex items-start gap-2">
                                <Layers size={16} className="text-gray-700 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Gang Sheet Mode</p>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                        Multiple clients&apos; jobs share the same physical sheets.
                                        Total sheets = max sheets across jobs ({totalSheets} sheets),
                                        not the sum.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                        <button
                            onClick={() => setStep(1)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-all"
                        >
                            <ArrowLeft size={16} />
                            Back to Selection
                        </button>
                        <button
                            onClick={() => setStep(3)}
                            disabled={configuredJobs.length === 0}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next: Print Specs
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Print Specs & Submit */}
            {step === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left: Summary (1/3) */}
                    <div className="bg-white rounded-md border border-gray-200 p-4">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <Package size={16} />
                            Print Run Summary
                        </h3>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="p-3 bg-gray-50 rounded-md text-center">
                                <p className="text-2xl font-bold text-gray-900">{configuredJobs.length}</p>
                                <p className="text-xs text-gray-500">Jobs</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-md text-center">
                                <p className="text-2xl font-bold text-gray-900">{uniqueClients.length}</p>
                                <p className="text-xs text-gray-500">Client{uniqueClients.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-md text-center">
                                <p className="text-2xl font-bold text-gray-900">{totalQty.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">Client Qty</p>
                            </div>
                            <div className="p-3 bg-gray-900 rounded-md text-center">
                                <p className="text-2xl font-bold text-white">{totalPullingSheets.toLocaleString()}</p>
                                <p className="text-xs text-gray-300">Pulling Sheets</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-md text-center">
                                <p className="text-2xl font-bold text-gray-900">{totalActualQty.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">Print Qty</p>
                            </div>
                            {totalExtra > 0 && (
                                <div className="p-3 bg-amber-50 rounded-md text-center border border-amber-200">
                                    <p className="text-2xl font-bold text-amber-700">+{totalExtra.toLocaleString()}</p>
                                    <p className="text-xs text-amber-600">Extra Prints</p>
                                </div>
                            )}
                        </div>

                        {isMultiClient && (
                            <div className="mb-4 px-3 py-2 bg-gray-100 rounded-md border border-gray-200">
                                <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                    <Layers size={12} /> GANG SHEET
                                </p>
                            </div>
                        )}

                        {/* Job List */}
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {configuredJobs.map(job => (
                                <div key={job.id} className="p-2.5 bg-gray-50 rounded-md">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-900">{job.job_number}</span>
                                        <span className="text-xs font-bold text-gray-700">{job.pulling_sheets.toLocaleString()} sheets</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{job.client_name} · {job.project_name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Client: {job.quantity_needed.toLocaleString()} → Print: {job.actual_print_qty.toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-all border border-gray-200"
                        >
                            <ArrowLeft size={14} />
                            Edit Configuration
                        </button>
                    </div>

                    {/* Right: Print Specs Form (2/3) */}
                    <div className="lg:col-span-2">
                        <CreatePrintRunForm
                            selectedJobs={configuredJobs.map(j => ({
                                id: j.id,
                                job_number: j.job_number,
                                project_name: j.project_name,
                                client_name: j.client_name,
                                job_type: j.job_type,
                                quantity: j.quantity,
                                quantity_needed: j.quantity_needed,
                                ups_in_sheet: j.ups_in_sheet,
                            }))}
                            onRemoveJob={removeJobStep2}
                            onClear={handleClear}
                            onSuccess={handleSuccess}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
