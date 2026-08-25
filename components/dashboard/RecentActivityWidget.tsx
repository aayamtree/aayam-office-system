'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ArrowRight, Activity, CheckSquare, Package, Upload, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createAuditedBrowserClient } from '@/lib/supabase';

const supabase = createAuditedBrowserClient();

// DB stores UTC in a `timestamp without time zone` column, so the string
// arrives with no timezone marker. Treat it as UTC by appending 'Z'.
function parseUtc(dateStr: string): number {
    const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(dateStr);
    const normalized = hasTz ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    return new Date(normalized).getTime();
}

function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - parseUtc(dateStr)) / 1000);
    if (diff < 0) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function actionIcon(action: string) {
    if (action === 'upload') return <Upload size={12} className="text-violet-500" />;
    if (action === 'checklist') return <CheckSquare size={12} className="text-teal-500" />;
    if (action === 'qc') return <Package size={12} className="text-orange-500" />;
    if (action === 'notification') return <Bell size={12} className="text-amber-500" />;
    if (action?.toLowerCase().includes('stage') || action?.toLowerCase().includes('updated')) return <ArrowRightLeft size={12} className="text-blue-500" />;
    return <Activity size={12} className="text-gray-400" />;
}

function actionDot(action: string) {
    if (action === 'checklist') return 'bg-teal-400';
    if (action === 'qc') return 'bg-orange-400';
    if (action === 'upload') return 'bg-violet-400';
    if (action === 'notification') return 'bg-amber-400';
    if (action?.toLowerCase().includes('created') || action === 'create') return 'bg-green-400';
    if (action?.toLowerCase().includes('stage') || action?.toLowerCase().includes('updated') || action === 'update') return 'bg-blue-400';
    return 'bg-gray-300';
}

interface RecentActivityWidgetProps {
    limit?: number;
}

export default function RecentActivityWidget({ limit = 8 }: RecentActivityWidgetProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            // Fetch from both tables in parallel
            const [actRes, notifRes] = await Promise.all([
                supabase
                    .from('activity_logs')
                    .select('id, action, description, created_at, user_name, module')
                    .not('action', 'in', '("login","LOGIN","logout","LOGOUT")')
                    .order('created_at', { ascending: false })
                    .limit(limit),
                supabase
                    .from('broadcast_notifications')
                    .select('id, message, created_at, priority')
                    .order('created_at', { ascending: false })
                    .limit(limit),
            ]);

            const actLogs = (actRes.data || []).map((l: any) => ({
                id: `al-${l.id}`,
                action: l.action,
                text: l.description || l.action,
                time: l.created_at,
                user: l.user_name || '',
                source: 'activity',
            }));

            const notifs = (notifRes.data || []).map((n: any) => ({
                id: `notif-${n.id}`,
                action: 'notification',
                text: n.message,
                time: n.created_at,
                user: 'System',
                source: 'notification',
            }));

            const merged = [...actLogs, ...notifs]
                .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                .slice(0, limit);

            setItems(merged);
            setLoading(false);
        }
        fetch();
    }, [limit]);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4" /> Recent Activity
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                        <Link href="/admin/activity" className="flex items-center gap-1">
                            View all <ArrowRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="divide-y divide-border">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-start gap-3 px-4 py-2.5 animate-pulse">
                                <div className="mt-1.5 w-2 h-2 rounded-full bg-muted shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-2.5 bg-muted rounded w-3/4" />
                                    <div className="h-2 bg-muted/60 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">No recent activity</div>
                ) : (
                    <div className="divide-y divide-border">
                        {items.map(item => (
                            <div key={item.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                                {/* Coloured dot */}
                                <div className="mt-1.5 shrink-0">
                                    <span className={`block w-2 h-2 rounded-full ${actionDot(item.action)}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-foreground line-clamp-2 leading-relaxed">{item.text}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {actionIcon(item.action)}
                                        {item.user && <span className="text-[10px] text-muted-foreground font-medium">{item.user}</span>}
                                        <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(item.time)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
