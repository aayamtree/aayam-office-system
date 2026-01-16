'use client';

import { useActivityLogs } from '@/lib/hooks';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ActivityFeed({ variant = 'card' }: { variant?: 'card' | 'minimal' }) {
    const { logs, loading } = useActivityLogs(10);

    if (loading) return <div className="h-48 animate-pulse bg-gray-50 rounded-2xl"></div>;

    const Container = variant === 'card' ? 'div' : 'div';
    const containerClasses = variant === 'card'
        ? "bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full"
        : "h-full";

    return (
        <Container className={containerClasses}>
            <div className="flex items-center gap-2 mb-4">
                <Activity size={20} className="text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Activity Feed</h2>
            </div>

            <div className="space-y-6 relative pl-2">
                {/* Connector Line */}
                <div className="absolute left-4.5 top-0 bottom-0 w-[2px] bg-gray-100"></div>

                {logs?.slice(0, 5).map((log, idx) => (
                    <div key={log.id} className="relative pl-8 group">
                        <div className="absolute left-0 top-1.5 w-5 h-5 bg-white border-2 border-indigo-100 rounded-full flex items-center justify-center group-hover:border-indigo-500 transition-colors z-10">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        </div>

                        <p className="text-sm text-gray-800 leading-snug">
                            <span className="font-semibold">{log.user?.full_name || 'System'}</span> {log.details || log.action}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 font-medium">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                    </div>
                ))}

                {!logs?.length && (
                    <p className="text-sm text-gray-400 pl-8">No recent activity.</p>
                )}
            </div>
        </Container>
    );
}
