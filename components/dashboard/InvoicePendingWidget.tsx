'use client';

import { useEffect, useState } from 'react';
import { FileText, Package, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface PendingInvoiceJob {
    id: string;
    job_number: string;
    project_name: string;
    quantity: number;
    client_deadline?: string;
    updated_at?: string;
    packing_info?: {
        verified_qty: number;
        package_type: string;
        package_count: number;
        approx_weight_kg: number;
        packing_notes: string;
    };
    client?: { company?: string; name?: string };
    invoices?: { id: string }[];
}

export default function InvoicePendingWidget() {
    const [jobs, setJobs] = useState<PendingInvoiceJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPendingJobs = async () => {
            const { data } = await supabase
                .from('jobs')
                .select('id, job_number, project_name, quantity, client_deadline, updated_at, packing_info, client:clients(company, name), invoices(id)')
                .eq('current_stage', 'ready')
                .order('updated_at', { ascending: false });

            if (data) {
                // Filter jobs without invoices
                const noInvoice = data.filter((j: any) => !j.invoices || j.invoices.length === 0);
                setJobs(noInvoice as PendingInvoiceJob[]);
            }
            setLoading(false);
        };

        fetchPendingJobs();

        // Refresh every 30 seconds
        const interval = setInterval(fetchPendingJobs, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return null;
    if (jobs.length === 0) return null;

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 md:p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Invoice & E-Way Bill Pending
                </h3>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full font-medium">
                    {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
                </span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {jobs.map((job) => (
                    <Link
                        key={job.id}
                        href={`/admin/jobs/${job.id}`}
                        className="block bg-white rounded-lg p-3 border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-semibold text-gray-900 text-sm">{job.job_number}</p>
                                <p className="text-xs text-gray-600 truncate">{job.client?.company || job.client?.name}</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{job.project_name}</p>
                            </div>
                            <div className="text-right shrink-0">
                                {job.client_deadline && (
                                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(job.client_deadline).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Packing details */}
                        <div className="mt-2 flex items-center gap-3 text-xs">
                            <span className="text-gray-600">
                                Qty: <span className="font-medium text-gray-900">{job.packing_info?.verified_qty || job.quantity}</span>
                            </span>
                            {job.packing_info && (
                                <>
                                    <span className="text-green-700 font-medium flex items-center gap-1">
                                        <Package className="w-3 h-3" />
                                        {job.packing_info.package_count} {job.packing_info.package_type}(s)
                                    </span>
                                    <span className="text-gray-600">
                                        ~{job.packing_info.approx_weight_kg} kg
                                    </span>
                                </>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
