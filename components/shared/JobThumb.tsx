'use client';

import { useState } from 'react';
import { Package, X } from 'lucide-react';
import { pickJobThumbnail } from '@/lib/job-thumbnail';

interface JobThumbProps {
  job: { thumbnail_url?: string | null; files?: unknown; job_number?: string; project_name?: string; quantity?: number; client?: { name?: string; company?: string } | null };
  /** Pixel size of the square thumbnail. */
  size?: number;
  className?: string;
}

/**
 * Small picture of the actual product (box / label / pouch) so two jobs with
 * the same name from different clients can be told apart at a glance.
 * Tap to see it large. Falls back to a plain box icon when the job has no image.
 */
export default function JobThumb({ job, size = 56, className = '' }: JobThumbProps) {
  const src = pickJobThumbnail(job);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const box = { width: size, height: size };

  if (!src || failed) {
    return (
      <div style={box} className={`shrink-0 rounded-md border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 ${className}`} title="No product picture yet">
        <Package className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={box}
        title="Tap to enlarge"
        className={`shrink-0 rounded-md border border-gray-200 bg-white overflow-hidden hover:border-gray-500 transition-colors ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={job.project_name || 'Product'} loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-contain" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{job.client?.company || job.client?.name} {job.job_number ? `· #${job.job_number}` : ''}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{job.project_name}</p>
                {job.quantity != null && <p className="text-xs text-gray-500">Qty: {job.quantity}</p>}
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-900" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 overflow-auto bg-gray-50 flex-1 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={job.project_name || 'Product'} className="max-w-full max-h-[75vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
