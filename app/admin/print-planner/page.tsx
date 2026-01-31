'use client';

import { useState } from 'react';
import { PrintJobQueue } from '@/components/print-planner/PrintJobQueue';
import { CreatePrintRunForm } from '@/components/print-planner/CreatePrintRunForm';

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

export default function PrintPlannerPage() {
    const [selectedJobs, setSelectedJobs] = useState<PendingJob[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleAddJob = (job: PendingJob) => {
        // Validate job type matches if jobs already selected
        if (selectedJobs.length > 0) {
            const existingJobType = selectedJobs[0].job_type;
            if (job.job_type !== existingJobType) {
                alert(`Cannot add ${job.job_type} job to ${existingJobType} print run.\n\nOnly jobs with the same type can be batched together.`);
                return;
            }
        }

        // Add job to selection
        setSelectedJobs(prev => [...prev, job]);
    };

    const handleRemoveJob = (jobId: string) => {
        setSelectedJobs(prev => prev.filter(j => j.id !== jobId));
    };

    const handleClear = () => {
        setSelectedJobs([]);
    };

    const handleSuccess = () => {
        // Refresh job queue
        setRefreshKey(prev => prev + 1);
        alert('Print run created successfully!');
    };

    const selectedJobIds = new Set(selectedJobs.map(j => j.id));
    const selectedJobType = selectedJobs.length > 0 ? selectedJobs[0].job_type : null;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Print Planner</h1>
                <p className="text-gray-600">Batch print jobs with same job type for efficient printing</p>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
                {/* Left: Job Queue */}
                <PrintJobQueue
                    key={refreshKey}
                    onAddJob={handleAddJob}
                    selectedJobType={selectedJobType}
                    disabledJobIds={selectedJobIds}
                />

                {/* Right: Create Print Run */}
                <CreatePrintRunForm
                    selectedJobs={selectedJobs}
                    onRemoveJob={handleRemoveJob}
                    onClear={handleClear}
                    onSuccess={handleSuccess}
                />
            </div>

            {/* Info Banner */}
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-[rgba(0,0,255,0.2)]-200 rounded-xl">
                <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[rgba(0,0,255,0.1)] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm font-bold">ℹ</span>
                    </div>
                    <div>
                        <p className="font-bold text-purple-900 mb-1">Job Type Batching Rule</p>
                        <p className="text-sm text-purple-800">
                            Only jobs with the <strong>same job type</strong> can be added to a print run.
                            For example: STICKER jobs cannot be batched with POUCH jobs as they use different vendors and processes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
