'use client';

import { useState, useRef } from 'react';
import {
    Paperclip, Upload, X, FileText, Image as ImageIcon,
    File as FileIcon, Loader2, ExternalLink, HardDrive,
    Cloud, MoveRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logFileUpload, logFileDownload } from '@/lib/activity-logger';
import { uploadToDrive, getProjectFolder } from '@/lib/google-drive-upload';
import type { FileAttachment } from '@/types/database';

// ── Config ────────────────────────────────────────────────────
const LOCAL_SERVER_URL = 'http://192.168.1.200:3001';
const LOCAL_API_KEY = 'aayam-local-2025';
const MAX_LOCAL_SIZE = 500 * 1024 * 1024;   // 500 MB
const MAX_DRIVE_SIZE = 100 * 1024 * 1024;   // 100 MB

type StorageType = 'local' | 'google_drive';

interface JobFileAttachmentsProps {
    jobId: string;
    jobNumber?: string;
    projectName?: string;
    files: FileAttachment[];
    onFilesUpdated: (files: FileAttachment[]) => void;
}

function getFileIcon(type: string) {
    if (type?.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (type?.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    return <FileIcon className="w-4 h-4 text-gray-500" />;
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStorageBadge(file: FileAttachment) {
    const storage = (file as any).storage || 'supabase';
    if (storage === 'local') {
        return (
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-full">
                <HardDrive className="w-2.5 h-2.5" /> Local
            </span>
        );
    }
    if (storage === 'google_drive') {
        return (
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full">
                <Cloud className="w-2.5 h-2.5" /> Drive
            </span>
        );
    }
    return null;
}

// ── Check if local server is reachable ────────────────────────
async function checkLocalServer(): Promise<boolean> {
    try {
        const res = await fetch(`${LOCAL_SERVER_URL}/health`, {
            signal: AbortSignal.timeout(3000)
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ── Upload to local server ────────────────────────────────────
async function uploadToLocal(file: File, jobNumber: string): Promise<{ url: string; path: string } | null> {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${LOCAL_SERVER_URL}/upload`, {
        method: 'POST',
        headers: {
            'x-api-key': LOCAL_API_KEY,
            'x-job-number': jobNumber || 'misc',
        },
        body: form,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return { url: data.url, path: data.path };
}

// ── Upload to Google Drive ────────────────────────────────────
async function uploadToGoogleDrive(
    file: File,
    jobNumber: string,
    projectName: string
): Promise<{ url: string; fileId: string } | null> {
    // Get org access token
    const tokenRes = await fetch('/api/drive/token');
    if (!tokenRes.ok) return null;
    const { accessToken } = await tokenRes.json();
    if (!accessToken) return null;

    // Get or create folder
    const { folderId } = await getProjectFolder(accessToken, jobNumber || 'misc', projectName || 'Project');

    const result = await uploadToDrive(accessToken, file, folderId || undefined, file.name);
    if (!result.success || !result.webViewLink) return null;

    return { url: result.webViewLink, fileId: result.fileId || '' };
}

export default function JobFileAttachments({
    jobId, jobNumber = '', projectName = '', files, onFilesUpdated
}: JobFileAttachmentsProps) {
    const [storage, setStorage] = useState<StorageType>('local');
    const [uploading, setUploading] = useState(false);
    const [movingToDrive, setMovingToDrive] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [localOnline, setLocalOnline] = useState<boolean | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Check local server when switching to local tab
    const handleStorageSwitch = async (type: StorageType) => {
        setStorage(type);
        setError('');
        if (type === 'local' && localOnline === null) {
            const online = await checkLocalServer();
            setLocalOnline(online);
            if (!online) setError('Local file server not reachable at 192.168.1.200:3001 — is it running?');
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;
        if (!isSupabaseConfigured()) { setError('Storage not configured'); return; }

        setUploading(true);
        setError('');

        const newFiles: FileAttachment[] = [...files];

        for (const file of Array.from(selectedFiles)) {
            // Size check
            const maxSize = storage === 'local' ? MAX_LOCAL_SIZE : MAX_DRIVE_SIZE;
            const maxLabel = storage === 'local' ? '500 MB' : '100 MB';
            if (file.size > maxSize) {
                setError(`${file.name} exceeds ${maxLabel} limit`);
                continue;
            }

            try {
                if (storage === 'local') {
                    // ── Local server upload ──────────────────
                    const result = await uploadToLocal(file, jobNumber);
                    if (!result) {
                        setError(`Failed to upload ${file.name} — is the local server running?`);
                        continue;
                    }
                    newFiles.push({
                        name: file.name,
                        url: result.url,
                        type: file.type,
                        size: file.size,
                        uploaded_at: new Date().toISOString(),
                        storage: 'local',
                    } as any);
                    logFileUpload({ fileName: file.name, fileSize: file.size, fileType: file.type, fileUrl: result.url, uploadedTo: `Job ${jobNumber} (Local)`, resourceId: jobId });

                } else {
                    // ── Google Drive upload ──────────────────
                    const result = await uploadToGoogleDrive(file, jobNumber, projectName);
                    if (!result) {
                        setError(`Failed to upload ${file.name} to Google Drive — check Drive connection in Settings`);
                        continue;
                    }
                    newFiles.push({
                        name: file.name,
                        url: result.url,
                        type: file.type,
                        size: file.size,
                        uploaded_at: new Date().toISOString(),
                        storage: 'google_drive',
                        driveFileId: result.fileId,
                    } as any);
                    logFileUpload({ fileName: file.name, fileSize: file.size, fileType: file.type, fileUrl: result.url, uploadedTo: `Job ${jobNumber} (Google Drive)`, resourceId: jobId });
                }
            } catch (err) {
                console.error('Upload error:', err);
                setError(`Failed to upload ${file.name}`);
            }
        }

        // Save file list to job
        const { error: updateError } = await supabase
            .from('jobs')
            .update({ files: newFiles })
            .eq('id', jobId);

        if (updateError) setError('Failed to save file reference');
        else onFilesUpdated(newFiles);

        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    // Move a local file to Google Drive (for client sharing)
    const handleMoveToDrive = async (index: number) => {
        const file = files[index];
        if (!file) return;
        setMovingToDrive(index);
        setError('');

        try {
            // Download from local server
            const res = await fetch(file.url);
            if (!res.ok) throw new Error('Could not fetch local file');
            const blob = await res.blob();
            const fileObj = new File([blob], file.name, { type: file.type });

            // Upload to Drive
            const result = await uploadToGoogleDrive(fileObj, jobNumber, projectName);
            if (!result) throw new Error('Google Drive upload failed');

            // Update file record
            const updated = [...files];
            updated[index] = {
                ...file,
                url: result.url,
                storage: 'google_drive',
                driveFileId: result.fileId,
            } as any;

            const { error: updateError } = await supabase
                .from('jobs')
                .update({ files: updated })
                .eq('id', jobId);

            if (updateError) throw new Error('Failed to update file reference');
            onFilesUpdated(updated);
        } catch (err: any) {
            setError(err.message || 'Failed to move file to Drive');
        } finally {
            setMovingToDrive(null);
        }
    };

    const handleRemove = async (index: number) => {
        const updated = files.filter((_, i) => i !== index);
        const { error: updateError } = await supabase
            .from('jobs')
            .update({ files: updated })
            .eq('id', jobId);
        if (!updateError) onFilesUpdated(updated);
    };

    const isLocalFile = (file: FileAttachment) => (file as any).storage === 'local';
    const isDriveFile = (file: FileAttachment) => (file as any).storage === 'google_drive';

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Attachments
                    {files.length > 0 && (
                        <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-md">{files.length}</span>
                    )}
                </h4>
            </div>

            {/* Storage selector */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg mb-3">
                <button
                    onClick={() => handleStorageSwitch('local')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${storage === 'local'
                        ? 'bg-white text-orange-600 shadow-sm border border-orange-200'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <HardDrive className="w-3.5 h-3.5" />
                    📁 Local Drive
                </button>
                <button
                    onClick={() => handleStorageSwitch('google_drive')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${storage === 'google_drive'
                        ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Cloud className="w-3.5 h-3.5" />
                    ☁️ Google Drive
                </button>
            </div>

            {/* Storage info */}
            {storage === 'local' && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3 ${localOnline === false
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-orange-50 text-orange-700 border border-orange-200'
                    }`}>
                    {localOnline === false
                        ? <><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Local server offline at 192.168.1.200:3001</>
                        : <><HardDrive className="w-3.5 h-3.5 flex-shrink-0" /> Saves to office PC · No internet used · Up to 500 MB</>
                    }
                </div>
            )}
            {storage === 'google_drive' && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3 bg-blue-50 text-blue-700 border border-blue-200">
                    <Cloud className="w-3.5 h-3.5 flex-shrink-0" /> Saves to Google Drive · Accessible anywhere · Up to 100 MB
                </div>
            )}

            {/* Upload button */}
            <div className="mb-3">
                <label className={`flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors w-full border-2 border-dashed ${uploading
                    ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                    : storage === 'local'
                        ? 'bg-orange-50 text-orange-600 border-orange-300 hover:bg-orange-100'
                        : 'bg-blue-50 text-blue-600 border-blue-300 hover:bg-blue-100'
                    }`}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : `Upload to ${storage === 'local' ? 'Local Drive' : 'Google Drive'}`}
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={storage === 'local'
                            ? '*'  // all types for local (print files: .ai, .psd, .indd, .pdf, etc.)
                            : 'image/*,.pdf,.doc,.docx,.xlsx,.xls,.csv'
                        }
                        disabled={uploading || (storage === 'local' && localOnline === false)}
                        onChange={handleUpload}
                        className="hidden"
                    />
                </label>
            </div>

            {error && (
                <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
                </p>
            )}

            {/* File list */}
            {files.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No files attached</p>
            ) : (
                <div className="space-y-1.5">
                    {files.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg group border border-gray-100">
                            {getFileIcon(file.type)}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
                                    {getStorageBadge(file)}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Move local file to Drive */}
                                {isLocalFile(file) && (
                                    <button
                                        onClick={() => handleMoveToDrive(i)}
                                        disabled={movingToDrive === i}
                                        title="Move to Google Drive (for client sharing)"
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                    >
                                        {movingToDrive === i
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <><MoveRight className="w-3 h-3" /> Drive</>
                                        }
                                    </button>
                                )}
                                {/* Open/download */}
                                {!file.url?.startsWith('data:') && (
                                    <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={isDriveFile(file) ? 'Open in Google Drive' : 'Open file'}
                                        className="p-1 hover:bg-gray-200 rounded"
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
