'use client';

import { useState, useEffect } from 'react';
import { Paperclip, Upload, Download, FileText, Image as ImageIcon, File as FileIcon, ExternalLink, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatDistanceToNow } from 'date-fns';

interface FileLogEntry {
    id: string;
    action: string;
    created_at: string;
    metadata: {
        fileName?: string;
        fileSize?: number;
        fileType?: string;
        fileUrl?: string;
        uploadedTo?: string;
        downloadedFrom?: string;
        description?: string;
    };
    user: {
        full_name?: string;
        role?: string;
    } | null;
}

function getFileIcon(fileType?: string) {
    if (!fileType) return FileIcon;
    if (fileType.includes('image')) return ImageIcon;
    if (fileType.includes('pdf')) return FileText;
    return FileIcon;
}

function formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface RecentFilesWidgetProps {
    /** Show all files (admin) or only current user's files */
    showAll?: boolean;
    /** Max entries to show */
    limit?: number;
    /** Compact mode for sidebars */
    compact?: boolean;
}

export default function RecentFilesWidget({ showAll = false, limit = 10, compact = false }: RecentFilesWidgetProps) {
    const { profile } = useAuth();
    const [fileLogs, setFileLogs] = useState<FileLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFileLogs = async () => {
            if (!profile?.id) return;

            let query = supabase
                .from('activity_logs')
                .select('id, action, created_at, metadata, user:profiles(full_name, role)')
                .in('action', ['upload', 'view'])
                .eq('entity_type', 'file')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (!showAll) {
                query = query.eq('user_id', profile.id);
            }

            const { data, error } = await query;

            if (!error && data) {
                setFileLogs(data as unknown as FileLogEntry[]);
            }
            setLoading(false);
        };

        fetchFileLogs();
    }, [profile?.id, showAll, limit]);

    if (loading) {
        return (
            <div className={`${compact ? '' : 'bg-white rounded-lg border border-gray-100 p-4'}`}>
                <div className="h-32 animate-pulse bg-gray-50 rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className={`${compact ? '' : 'bg-white rounded-lg border border-gray-100 p-4 md:p-6'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-gray-900 flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
                    <Paperclip size={compact ? 16 : 18} className="text-primary" />
                    {showAll ? 'All File Activity' : 'My Recent Files'}
                </h3>
                <span className="text-xs text-gray-400 font-medium">{fileLogs.length} entries</span>
            </div>

            {fileLogs.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No file activity yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {fileLogs.map((log) => {
                        const isUpload = log.action === 'upload';
                        const FileIconComponent = getFileIcon(log.metadata?.fileType);
                        const fileName = log.metadata?.fileName || 'Unknown file';
                        const location = log.metadata?.uploadedTo || log.metadata?.downloadedFrom || '';

                        return (
                            <div key={log.id} className={`flex items-start gap-3 ${compact ? 'py-1.5' : 'py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'}`}>
                                {/* Icon */}
                                <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded ${isUpload ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {isUpload ? <Upload size={12} /> : <Download size={12} />}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <FileIconComponent className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                        {log.metadata?.fileUrl && !log.metadata.fileUrl.startsWith('data:') ? (
                                            <a
                                                href={log.metadata.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-medium text-gray-800 truncate hover:text-primary hover:underline"
                                            >
                                                {fileName}
                                            </a>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-800 truncate">{fileName}</span>
                                        )}
                                        {log.metadata?.fileSize && (
                                            <span className="text-[10px] text-gray-400 flex-shrink-0">({formatFileSize(log.metadata.fileSize)})</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-0.5">
                                        {showAll && log.user?.full_name && (
                                            <span className="text-[10px] font-bold text-primary">
                                                {log.user.full_name}
                                            </span>
                                        )}
                                        {location && (
                                            <span className="text-[10px] text-gray-400 truncate">
                                                {isUpload ? '→' : '←'} {location}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-300 flex items-center gap-0.5 flex-shrink-0">
                                            <Clock size={8} />
                                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                </div>

                                {/* Open link */}
                                {log.metadata?.fileUrl && !log.metadata.fileUrl.startsWith('data:') && (
                                    <a href={log.metadata.fileUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 p-1 text-gray-300 hover:text-primary">
                                        <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
