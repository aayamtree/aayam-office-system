'use client';

import { useActivityLogs } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Activity, Upload, FileText, Image, FileVideo, File as FileIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Helper to get file icon based on type
function getFileIcon(fileType?: string) {
    if (!fileType) return FileIcon;
    if (fileType.includes('image')) return Image;
    if (fileType.includes('video')) return FileVideo;
    if (fileType.includes('pdf')) return FileText;
    return FileIcon;
}

// Helper to format file size
function formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ActivityFeed({ variant = 'card' }: { variant?: 'card' | 'minimal' }) {
    const { logs, loading } = useActivityLogs(10);
    const { profile } = useAuth();

    // Admin-only access
    if (profile?.role !== 'admin') {
        return null;
    }

    if (loading) return <div className="h-48 animate-pulse bg-gray-50 rounded-2xl"></div>;

    const Container = variant === 'card' ? 'div' : 'div';
    const containerClasses = variant === 'card'
        ? "bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full"
        : "h-full";

    return (
        <Container className={containerClasses}>
            <div className="flex items-center gap-2 mb-4">
                <Activity size={20} className="text-oms-blue" />
                <h2 className="text-section text-gray-900">Activity Feed</h2>
            </div>

            <div className="space-y-6 relative pl-2">
                {/* Connector Line */}
                <div className="absolute left-4.5 top-0 bottom-0 w-[2px] bg-gray-100"></div>

                {logs?.slice(0, 5).map((log, idx) => {
                    const isUpload = log.action === 'upload';
                    const FileIconComponent = isUpload
                        ? getFileIcon(log.details?.fileType)
                        : null;

                    return (
                        <div key={log.id} className="relative pl-8 group">
                            {/* Timeline Dot */}
                            <div className={`absolute left-0 top-1.5 w-5 h-5 bg-white border-2 rounded-full flex items-center justify-center group-hover:border-indigo-500 transition-colors z-10 ${isUpload ? 'border-green-400' : 'border-indigo-100'
                                }`}>
                                {isUpload ? (
                                    <Upload className="w-2.5 h-2.5 text-green-600" />
                                ) : (
                                    <div className="w-2 h-2 bg-[rgba(0,0,255,0.1)] rounded-full"></div>
                                )}
                            </div>

                            {/* Activity Content */}
                            <div className="text-sm text-gray-800 leading-snug">
                                <span className="font-semibold">{log.user?.full_name || 'System'}</span>

                                {isUpload ? (
                                    <div className="mt-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span>uploaded</span>
                                            {FileIconComponent && (
                                                <FileIconComponent className="w-4 h-4 text-gray-500" />
                                            )}
                                            <a
                                                href={log.details?.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-blue-600 hover:underline"
                                            >
                                                {log.details?.fileName || 'file'}
                                            </a>
                                            {log.details?.fileSize && (
                                                <span className="text-xs text-gray-500">
                                                    ({formatFileSize(log.details.fileSize)})
                                                </span>
                                            )}
                                        </div>
                                        {log.details?.uploadedTo && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                to <span className="font-medium">{log.details.uploadedTo}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span> {log.details?.description || log.action}</span>
                                )}
                            </div>

                            {/* Timestamp */}
                            <p className="text-xs text-gray-400 mt-1 font-medium">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </p>
                        </div>
                    );
                })}

                {!logs?.length && (
                    <p className="text-sm text-gray-400 pl-8">No recent activity.</p>
                )}
            </div>
        </Container>
    );
}
