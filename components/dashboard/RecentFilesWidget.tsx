'use client';

import { useState, useEffect } from 'react';
import { Paperclip, Upload, FileText, Image as ImageIcon, File as FileIcon, ExternalLink, Clock, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatDistanceToNow } from 'date-fns';

interface FileEntry {
    id: string;
    source: 'activity' | 'notification';
    fileName?: string;
    fileUrl?: string;
    fileSize?: number;
    fileType?: string;
    location?: string;
    userName?: string;
    created_at: string;
    message?: string;
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
    showAll?: boolean;
    limit?: number;
    compact?: boolean;
}

export default function RecentFilesWidget({ showAll = false, limit = 15, compact = false }: RecentFilesWidgetProps) {
    const { profile } = useAuth();
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            if (!profile?.id) return;

            // Query 1: activity_logs with action='upload' OR entity_type='file'
            let actQuery = supabase
                .from('activity_logs')
                .select('id, action, created_at, metadata, user_name, entity_type, description')
                .or('action.eq.upload,entity_type.eq.file')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (!showAll) actQuery = actQuery.eq('user_id', profile.id);
            const { data: actData } = await actQuery;

            // Query 2: broadcast_notifications that contain file-related keywords
            const { data: notifData } = await supabase
                .from('broadcast_notifications')
                .select('id, message, created_at')
                .ilike('message', '%upload%')
                .order('created_at', { ascending: false })
                .limit(limit);

            // Normalise activity_logs → FileEntry
            const actEntries: FileEntry[] = (actData || []).map((l: any) => {
                const meta = l.metadata || {};
                return {
                    id: `al-${l.id}`,
                    source: 'activity',
                    fileName: meta.fileName || (l.description ? l.description.split(' ')[1] : undefined),
                    fileUrl: meta.fileUrl,
                    fileSize: meta.fileSize,
                    fileType: meta.fileType,
                    location: meta.uploadedTo || meta.downloadedFrom || '',
                    userName: l.user_name || '',
                    created_at: l.created_at,
                    message: l.description,
                };
            });

            // Normalise broadcast_notifications → FileEntry
            const notifEntries: FileEntry[] = (notifData || []).map((n: any) => ({
                id: `notif-${n.id}`,
                source: 'notification',
                message: n.message,
                userName: 'System',
                created_at: n.created_at,
            }));

            // Merge + sort by newest
            const merged = [...actEntries, ...notifEntries]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, limit);

            setEntries(merged);
            setLoading(false);
        };

        fetchFiles();
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
                <span className="text-xs text-gray-400 font-medium">{entries.length} entries</span>
            </div>

            {entries.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No file activity yet</p>
                    <p className="text-xs text-gray-300 mt-1">Files uploaded to jobs will appear here</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry) => {
                        const FileIconComponent = getFileIcon(entry.fileType);

                        // Notification-sourced entries
                        if (entry.source === 'notification') {
                            return (
                                <div key={entry.id} className={`flex items-start gap-3 ${compact ? 'py-1.5' : 'py-2 px-3 bg-amber-50/60 rounded-lg'}`}>
                                    <div className="flex-shrink-0 mt-0.5 p-1.5 rounded bg-amber-100 text-amber-600">
                                        <Bell size={12} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-800 line-clamp-2">{entry.message}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {showAll && entry.userName && (
                                                <span className="text-[10px] font-bold text-primary">{entry.userName}</span>
                                            )}
                                            <span className="text-[10px] text-gray-300 flex items-center gap-0.5 flex-shrink-0 ml-auto">
                                                <Clock size={8} />
                                                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Activity-log sourced entries
                        const fileName = entry.fileName || (entry.message ? entry.message : 'File');
                        return (
                            <div key={entry.id} className={`flex items-start gap-3 ${compact ? 'py-1.5' : 'py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'}`}>
                                <div className="flex-shrink-0 mt-0.5 p-1.5 rounded bg-green-50 text-green-600">
                                    <Upload size={12} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <FileIconComponent className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                        {entry.fileUrl && !entry.fileUrl.startsWith('data:') ? (
                                            <a
                                                href={entry.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-medium text-gray-800 truncate hover:text-primary hover:underline"
                                            >
                                                {fileName}
                                            </a>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-800 truncate">
                                                {entry.message || fileName}
                                            </span>
                                        )}
                                        {entry.fileSize && (
                                            <span className="text-[10px] text-gray-400 flex-shrink-0">({formatFileSize(entry.fileSize)})</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {showAll && entry.userName && (
                                            <span className="text-[10px] font-bold text-primary">{entry.userName}</span>
                                        )}
                                        {entry.location && (
                                            <span className="text-[10px] text-gray-400 truncate">→ {entry.location}</span>
                                        )}
                                        <span className="text-[10px] text-gray-300 flex items-center gap-0.5 flex-shrink-0 ml-auto">
                                            <Clock size={8} />
                                            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                </div>
                                {entry.fileUrl && !entry.fileUrl.startsWith('data:') && (
                                    <a href={entry.fileUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 p-1 text-gray-300 hover:text-primary">
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
