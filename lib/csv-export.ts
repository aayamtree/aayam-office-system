/**
 * CSV Export Utility
 * Generic function to export data arrays as downloadable CSV files.
 */

interface CSVColumn<T> {
    header: string;
    accessor: (row: T) => string | number;
}

/**
 * Export an array of data as a CSV file download.
 * @param data - Array of data objects
 * @param columns - Column definitions with header labels and accessor functions
 * @param filename - Name for the downloaded file (without .csv extension)
 */
export function exportToCSV<T>(
    data: T[],
    columns: CSVColumn<T>[],
    filename: string
): void {
    if (data.length === 0) {
        alert('No data to export.');
        return;
    }

    // Build CSV content
    const headers = columns.map(c => escapeCSV(c.header));
    const rows = data.map(row =>
        columns.map(c => escapeCSV(String(c.accessor(row) ?? ''))).join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

// ── Pre-built column definitions for common entities ──

export function formatINR(amount: number): string {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
}

export function formatDateShort(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

import { Job } from '@/types/database';

export const JOB_COLUMNS = [
    { header: 'Job Number', accessor: (j: Job) => j.job_number || '' },
    { header: 'Project', accessor: (j: Job) => j.project_name || '' },
    { header: 'Client', accessor: (j: Job) => j.client?.name || j.client?.company || '' },
    { header: 'Stage', accessor: (j: Job) => j.current_stage || '' },
    { header: 'Priority', accessor: (j: Job) => j.priority || '' },
    { header: 'Total Amount', accessor: (j: Job) => j.total_amount || 0 },
    { header: 'Amount Received', accessor: (j: Job) => j.amount_received || 0 },
    { header: 'Payment Status', accessor: (j: Job) => j.payment_status || '' },
    { header: 'Order Date', accessor: (j: Job) => formatDateShort(j.order_date) },
    { header: 'Deadline', accessor: (j: Job) => formatDateShort(j.client_deadline) },
];
