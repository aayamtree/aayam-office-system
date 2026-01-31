'use client';

import { useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import Link from 'next/link';
import { CSS } from '@dnd-kit/utilities';
import {
    Layers, Package, Printer, ArrowRight, ArrowLeft, CheckCircle,
    AlertCircle, Filter, Plus, X, Box, FileText, Settings
} from 'lucide-react';
import { useJobs } from '@/lib/hooks';
import { Job } from '@/types/database';

// Mock Workflows for Prototype
const WORKFLOWS = {
    sticker: {
        name: 'Sticker / Label',
        stages: ['Pre-press', 'Printing (Digital)', 'Lamination', 'Die Cutting', 'QC']
    },
    box: {
        name: 'Packaging Box',
        stages: ['Pre-press', 'Printing (Offset)', 'Lamination', 'Spot UV', 'Die Cutting', 'Pasting', 'QC']
    },
    pouch: {
        name: 'Pouch',
        stages: ['Pre-press', 'Cylinder Making', 'Printing (Rotogravure)', 'Lamination', 'Slitting', 'Pouching', 'QC']
    },
    generic: {
        name: 'Standard Print',
        stages: ['Pre-press', 'Printing', 'Cutting', 'QC']
    }
};

export default function PrintPlannerPage() {
    const { jobs, loading } = useJobs();

    // Local State for Batch Planning
    const [selectedWorkflow, setSelectedWorkflow] = useState<keyof typeof WORKFLOWS>('generic');
    const [selectedJobs, setSelectedJobs] = useState<Job[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Filter Jobs that are 'Approved' and waiting for production
    // In real app, we might check if they are explicitly marked 'Ready for Print'
    const poolJobs = jobs.filter(j =>
        (j.current_stage === 'approval' || j.current_stage === 'designing') && // For demo, allow designing too
        !selectedJobs.find(s => s.id === j.id)
    );

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            // Reordering logic if needed inside batch
        }
    };

    const addToBatch = (job: Job) => {
        setSelectedJobs([...selectedJobs, job]);
    };

    const removeFromBatch = (jobId: string) => {
        setSelectedJobs(selectedJobs.filter(j => j.id !== jobId));
    };

    const createBatch = () => {
        if (selectedJobs.length === 0) return;
        const workflow = WORKFLOWS[selectedWorkflow];
        alert(`Creating Batch with ${selectedJobs.length} jobs.\nWorkflow: ${workflow.name}\nStages: ${workflow.stages.join(' -> ')}`);
        // Here we would call API to create row in 'print_batches' and link items
    };

    // Draggable Item Component
    const DraggableJob = ({ job, inBatch }: { job: Job, inBatch?: boolean }) => {
        return (
            <div
                className={`p-3 rounded-xl border mb-2 cursor-pointer transition-all 
          ${inBatch ? 'bg-oms-blue border-[rgba(0,0,255,0.2)]-200' : 'bg-white border-gray-200'}
        `}
                onClick={() => !inBatch && addToBatch(job)}
            >
                <div className="flex justify-between items-start">
                    <div>
                        <span className="font-mono text-xs font-bold text-gray-500">{job.job_number}</span>
                        <h4 className="font-semibold text-gray-800 text-sm leading-tight">{job.project_name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{job.client?.company || job.client?.name}</p>
                    </div>
                    {inBatch && (
                        <button onClick={(e) => { e.stopPropagation(); removeFromBatch(job.id); }} className="text-gray-400 hover:text-red-500">
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div className="mt-2 flex gap-2 text-xs text-gray-500">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-gray-200">Qty: {job.quantity}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{job.priority}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-3 md:gap-6 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Link href="/admin/jobs" className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft size={20} className="text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-page-title text-gray-900 flex items-center gap-2">
                            <Layers className="text-oms-blue" />
                            Print Planner
                        </h1>
                        <p className="text-gray-500 text-sm hidden sm:block">Group approved designs into optimized production batches</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* Filters placeholder */}
                    <button className="px-4 py-2 border rounded-xl flex items-center gap-2 text-sm font-medium hover:bg-gray-50">
                        <Filter size={16} /> Filter Queue
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-3 md:gap-6 min-h-0">

                {/* LEFT COLUMN: Input Queue */}
                <div className="w-full md:w-1/3 flex flex-col bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden h-1/3 md:h-auto">
                    <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <FileText size={18} /> Ready for Print ({poolJobs.length})
                        </h3>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto">
                        {poolJobs.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <p>No jobs ready for print</p>
                            </div>
                        ) : (
                            poolJobs.map(job => <DraggableJob key={job.id} job={job} />)
                        )}
                    </div>
                </div>

                {/* MIDDLE: Batch Composer */}
                <div className="w-full md:flex-1 flex flex-col bg-white rounded-2xl border-2 border-dashed border-[rgba(0,0,255,0.2)]-200 overflow-hidden relative h-2/3 md:h-auto">

                    {/* Batch Config Header */}
                    <div className="p-6 border-b bg-oms-blue/50">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <label className="text-xs font-bold text-oms-blue uppercase tracking-wider">New Batch Configuration</label>
                                <h2 className="text-page-title text-gray-900 mt-1">Untitled Batch #{Math.floor(Math.random() * 1000)}</h2>
                            </div>
                            <select
                                value={selectedWorkflow}
                                onChange={(e) => setSelectedWorkflow(e.target.value as any)}
                                className="px-4 py-2 rounded-xl border border-[rgba(0,0,255,0.2)]-200 bg-white font-medium text-gray-700 focus:ring-2 focus:ring-oms-blue"
                            >
                                {Object.entries(WORKFLOWS).map(([key, wf]) => (
                                    <option key={key} value={key}>{wf.name} Workflow</option>
                                ))}
                            </select>
                        </div>

                        {/* Workflow Visualization */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {WORKFLOWS[selectedWorkflow].stages.map((stage, i) => (
                                <div key={stage} className="flex items-center">
                                    <div className="px-3 py-1.5 bg-white border border-[rgba(0,0,255,0.2)]-100 rounded-lg text-xs font-bold text-oms-blue whitespace-nowrap">
                                        {stage}
                                    </div>
                                    {i < WORKFLOWS[selectedWorkflow].stages.length - 1 && (
                                        <div className="h-0.5 w-4 bg-oms-blue"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Batch Content Area */}
                    <div className="flex-1 p-6 overflow-y-auto bg-white">
                        {selectedJobs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                <Box size={48} className="mb-4 opacity-50" />
                                <p className="font-medium">Drag jobs here or click +</p>
                                <p className="text-sm">Group jobs to optimize material usage</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {selectedJobs.map(job => <DraggableJob key={job.id} job={job} inBatch />)}
                            </div>
                        )}
                    </div>

                    {/* Footer Action */}
                    <div className="p-4 border-t bg-white flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                            <span className="font-bold text-gray-900">{selectedJobs.length}</span> jobs in batch
                        </div>
                        <button
                            onClick={createBatch}
                            disabled={selectedJobs.length === 0}
                            className="bg-oms-blue hover:bg-oms-blue disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 -200 transition-all"
                        >
                            <Printer size={18} />
                            Start Production Run
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}
