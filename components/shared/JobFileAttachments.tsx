'use client';

import { useState, useRef } from 'react';
import { Paperclip, Upload, X, FileText, Image, File as FileIcon, Loader2, ExternalLink } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logFileUpload, logFileDownload } from '@/lib/activity-logger';
import type { FileAttachment } from '@/types/database';

interface JobFileAttachmentsProps {
    jobId: string;
    files: FileAttachment[];
    onFilesUpdated: (files: FileAttachment[]) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function getFileIcon(type: string) {
    if (type.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    return <FileIcon className="w-4 h-4 text-gray-500" />;
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function JobFileAttachments({ jobId, files, onFilesUpdated }: JobFileAttachmentsProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;
        if (!isSupabaseConfigured()) {
            setError('Storage not configured');
            return;
        }

        setUploading(true);
        setError('');

        const newFiles: FileAttachment[] = [...files];

        for (const file of Array.from(selectedFiles)) {
            if (file.size > MAX_FILE_SIZE) {
                setError(`${file.name} exceeds 5 MB limit`);
                continue;
            }

            try {
                const ext = file.name.split('.').pop();
                const path = `jobs/${jobId}/${Date.now()}_${file.name}`;

                const { data, error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(path, file, { cacheControl: '3600', upsert: false });

                if (uploadError) {
                    // If bucket doesn't exist, fall back to base64 data URL
                    console.warn('Storage upload failed, using data URL fallback:', uploadError.message);

                    const dataUrl = await readFileAsDataURL(file);
                    const newFile = {
                        name: file.name,
                        url: dataUrl,
                        type: file.type,
                        size: file.size,
                        uploaded_at: new Date().toISOString(),
                    };
                    newFiles.push(newFile);
                    // Log upload
                    logFileUpload({ fileName: file.name, fileSize: file.size, fileType: file.type, fileUrl: dataUrl, uploadedTo: `Job ${jobId}`, resourceId: jobId });
                } else {
                    const { data: urlData } = supabase.storage
                        .from('attachments')
                        .getPublicUrl(data.path);

                    const newFile = {
                        name: file.name,
                        url: urlData.publicUrl,
                        type: file.type,
                        size: file.size,
                        uploaded_at: new Date().toISOString(),
                    };
                    newFiles.push(newFile);
                    // Log upload
                    logFileUpload({ fileName: file.name, fileSize: file.size, fileType: file.type, fileUrl: urlData.publicUrl, uploadedTo: `Job ${jobId}`, resourceId: jobId });
                }
            } catch (err) {
                console.error('File upload error:', err);
                setError(`Failed to upload ${file.name}`);
            }
        }

        // Save updated files array to the job
        const { error: updateError } = await supabase
            .from('jobs')
            .update({ files: newFiles })
            .eq('id', jobId);

        if (updateError) {
            setError('Failed to save file reference');
        } else {
            onFilesUpdated(newFiles);
        }

        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleRemove = async (index: number) => {
        const updated = files.filter((_, i) => i !== index);

        const { error: updateError } = await supabase
            .from('jobs')
            .update({ files: updated })
            .eq('id', jobId);

        if (!updateError) {
            onFilesUpdated(updated);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Attachments
                    {files.length > 0 && (
                        <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-md">{files.length}</span>
                    )}
                </h4>
                <label className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition-colors ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}>
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.csv"
                        disabled={uploading}
                        onChange={handleUpload}
                        className="hidden"
                    />
                </label>
            </div>

            {error && (
                <p className="text-xs text-red-500 mb-2">{error}</p>
            )}

            {files.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">No files attached</p>
            ) : (
                <div className="space-y-1.5">
                    {files.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg group">
                            {getFileIcon(file.type)}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
                                <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!file.url.startsWith('data:') && (
                                    <a href={file.url} target="_blank" rel="noreferrer" className="p-1 hover:bg-gray-200 rounded"
                                        onClick={() => logFileDownload({ fileName: file.name, fileSize: file.size, fileType: file.type, fileUrl: file.url, downloadedFrom: `Job ${jobId}`, resourceId: jobId })}
                                    >
                                        <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                                    </a>
                                )}
                                <button onClick={() => handleRemove(i)} className="p-1 hover:bg-red-100 rounded">
                                    <X className="w-3.5 h-3.5 text-red-500" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function readFileAsDataURL(file: globalThis.File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
