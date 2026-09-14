'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ArrowRight, Activity, CheckSquare, Package, Upload, ArrowRightLeft, ChevronRight } from 'lucide-react';
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
    const [open, setOpen] = useState(false);

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

    // ── Satish, 2026-09-14: "recent activity needs to fold down... if we want
    //    to see it then it shows, otherwise just a one-liner." He is right:
    //    this is HISTORY, not something to act on, so it costs one line until
    //    it is asked for. Collapsed is the default on every load — deliberately
    //    not remembered, because a feed that reopens itself is back to charging
    //    rent on the page. The fetch still runs while shut, which is what lets
    //    the summary line say how many and how long ago. ──
    const newest = items.length > 0 ? items[0].time : null;

    return (
        <section className="overflow-hidden rounded-xl border bg-card">
            {/* The toggle and the link are SIBLINGS, never nested: an anchor
                inside a button is invalid, and it makes the link unreachable
                by keyboard. */}
            <div className="flex items-center gap-3 px-5 py-4">
                <button
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    aria-expanded={open}
                    className="-my-2 flex min-w-0 flex-1 items-center gap-3 rounded-md py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                    />
                    <span className="shrink-0 text-[13px] font-semibold">Recent activity</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                        {loading
                            ? 'loading…'
                            : items.length === 0
                                ? 'nothing recorded yet'
                                : `${items.length} ${items.length === 1 ? 'entry' : 'entries'}${newest ? ` · last one ${timeAgo(newest)}` : ''}`}
                    </span>
                </button>
                <Link
                    href="/admin/activity"
                    className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
                >
                    View all <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            {open && (
                <div className="border-t px-5 pb-4 pt-1">
                    {loading ? (
                        <div className="grid gap-x-8 sm:grid-cols-2">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex animate-pulse items-start gap-3 border-b py-3 last:border-0">
                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-2.5 w-3/4 rounded bg-muted" />
                                        <div className="h-2 w-1/3 rounded bg-muted/60" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">No recent activity</p>
                    ) : (
                        <div className="grid gap-x-8 sm:grid-cols-2">
                            {items.map(item => (
                                <div key={item.id} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                                    <span className={`mt-[7px] block h-1.5 w-1.5 shrink-0 rounded-full ${actionDot(item.action)}`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[12.5px] leading-snug text-foreground" title={item.text}>
                                            {item.text}
                                        </p>
                                        <div className="mt-0.5 flex items-center gap-1.5">
                                            {actionIcon(item.action)}
                                            {item.user && <span className="truncate text-[10.5px] text-muted-foreground">{item.user}</span>}
                                            <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-muted-foreground/70">
                                                {timeAgo(item.time)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            )}
        </section>
    );
}
