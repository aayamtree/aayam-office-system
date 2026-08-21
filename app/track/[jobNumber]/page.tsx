import { supabase } from '@/lib/supabase';
import { getWorkflowForJobType, getStageName } from '@/lib/job-workflow';
import ProductBadge from '@/components/shared/ProductBadge';

// Friendly, customer-facing icons per stage id
const STAGE_ICONS: Record<string, string> = {
    new: '📋', designing: '🎨', approval: '✅', pre_print_qc: '🔍',
    print_file_ready: '📁', file_sent_client: '📨', file_received: '📥',
    file_check: '🔍', ready_to_print: '🟢', printing: '🖨️',
    material_received: '📦', quality_check: '🔎', ready: '📦',
    dispatched: '🚚', delivered: '🏠',
};

export default async function TrackJobPage({ params }: { params: Promise<{ jobNumber: string }> }) {
    const { jobNumber } = await params;

    // Fetch minimal job info for public display
    const { data: job, error } = await supabase
        .from('jobs')
        .select('job_number, project_name, current_stage, client_deadline, updated_at, order_date, job_type, product_category')
        .eq('job_number', jobNumber)
        .single();

    if (error || !job) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-sm border p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h1>
                    <p className="text-gray-500 text-sm">
                        We couldn&apos;t find an order with number <strong>{jobNumber}</strong>.
                        Please check the tracking link and try again.
                    </p>
                </div>
            </div>
        );
    }

    // Build the progress bar from the unified pipeline, filtered by this job's type
    const stages = getWorkflowForJobType(job.job_type).map(id => ({
        id,
        name: getStageName(id),
        icon: STAGE_ICONS[id] || '•',
    }));

    const currentIndex = stages.findIndex(s => s.id === job.current_stage);

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="max-w-2xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">A</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">Aayam</h1>
                            <p className="text-xs text-gray-500">Order Tracking</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Order Info Card */}
                <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="flex items-center gap-2">
                            <span className="font-mono text-sm px-3 py-1 bg-gray-100 rounded-md text-gray-700 font-medium">
                                {job.job_number}
                            </span>
                            <ProductBadge category={(job as any).product_category} size="sm" />
                        </span>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${job.current_stage === 'delivered' ? 'bg-green-100 text-green-700' :
                            job.current_stage === 'dispatched' ? 'bg-cyan-100 text-cyan-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                            {stages.find(s => s.id === job.current_stage)?.name || job.current_stage}
                        </span>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-4">{job.project_name}</h2>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1">Order Date</p>
                            <p className="text-gray-900 font-medium">{formatDate(job.order_date)}</p>
                        </div>
                        {job.client_deadline && (
                            <div>
                                <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1">Expected Delivery</p>
                                <p className="text-gray-900 font-medium">{formatDate(job.client_deadline)}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Timeline */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="font-bold text-gray-900 mb-6">Order Progress</h3>
                    <div className="space-y-0">
                        {stages.map((stage, index) => {
                            const isCompleted = index < currentIndex;
                            const isCurrent = index === currentIndex;
                            const isPending = index > currentIndex;
                            const isLast = index === stages.length - 1;

                            return (
                                <div key={stage.id} className="flex gap-4">
                                    {/* Timeline Line & Dot */}
                                    <div className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${isCompleted ? 'bg-green-100 text-green-600' :
                                            isCurrent ? 'bg-gray-900 text-white ring-4 ring-gray-200' :
                                                'bg-gray-100 text-gray-400'
                                            }`}>
                                            {isCompleted ? '✓' : stage.icon}
                                        </div>
                                        {!isLast && (
                                            <div className={`w-0.5 h-8 ${isCompleted ? 'bg-green-300' : 'bg-gray-200'
                                                }`} />
                                        )}
                                    </div>

                                    {/* Label */}
                                    <div className={`pb-6 ${isCurrent ? 'pt-1' : 'pt-1.5'}`}>
                                        <p className={`text-sm font-medium ${isCompleted ? 'text-green-700' :
                                            isCurrent ? 'text-gray-900 font-bold' :
                                                'text-gray-400'
                                            }`}>
                                            {stage.name}
                                        </p>
                                        {isCurrent && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Updated {formatDate(job.updated_at)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-xs text-gray-400">
                        Powered by Aayam Office System
                    </p>
                </div>
            </div>
        </div>
    );
}
