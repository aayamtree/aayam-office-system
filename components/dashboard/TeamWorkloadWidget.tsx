'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDesigners } from '@/lib/hooks';
import { BarChart3, Clock, AlertTriangle, Users } from 'lucide-react';

interface DesignerWorkload {
    designer_id: string;
    designer_name: string;
    total_hours: number;
    days_worked: number;
    avg_daily: number;
}

export default function TeamWorkloadWidget() {
    const { designers } = useDesigners();
    const [workloads, setWorkloads] = useState<DesignerWorkload[]>([]);
    const [period, setPeriod] = useState<'week' | 'month'>('week');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (designers.length > 0) {
            fetchWorkload();
        }
    }, [designers, period]);

    const fetchWorkload = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startDate = new Date();
            if (period === 'week') {
                startDate.setDate(now.getDate() - 7);
            } else {
                startDate.setDate(now.getDate() - 30);
            }

            const { data: hours } = await supabase
                .from('designer_hours')
                .select('designer_id, hours_worked, overtime_hours, date')
                .gte('date', startDate.toISOString().split('T')[0])
                .lte('date', now.toISOString().split('T')[0]);

            if (!hours) {
                setWorkloads([]);
                setLoading(false);
                return;
            }

            // Group by designer
            const grouped: Record<string, { total: number; dates: Set<string> }> = {};
            hours.forEach(h => {
                if (!grouped[h.designer_id]) {
                    grouped[h.designer_id] = { total: 0, dates: new Set() };
                }
                grouped[h.designer_id].total += (h.hours_worked || 0) + (h.overtime_hours || 0);
                grouped[h.designer_id].dates.add(h.date);
            });

            const result: DesignerWorkload[] = designers
                .filter(d => d.is_active !== false)
                .map(d => {
                    const data = grouped[d.id] || { total: 0, dates: new Set() };
                    const daysWorked = data.dates.size;
                    return {
                        designer_id: d.id,
                        designer_name: d.name,
                        total_hours: Math.round(data.total * 10) / 10,
                        days_worked: daysWorked,
                        avg_daily: daysWorked > 0 ? Math.round((data.total / daysWorked) * 10) / 10 : 0,
                    };
                })
                .sort((a, b) => b.total_hours - a.total_hours);

            setWorkloads(result);
        } catch (error) {
            console.error('Error fetching workload:', error);
        } finally {
            setLoading(false);
        }
    };

    const maxHours = Math.max(...workloads.map(w => w.total_hours), 1);

    return (
        <div className="bg-white rounded-lg border border-gray-100 p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    Team Workload
                </h3>
                <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
                    <button
                        onClick={() => setPeriod('week')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${period === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${period === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        30 Days
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-6 text-sm text-gray-400">Loading workload data...</div>
            ) : workloads.length === 0 ? (
                <div className="text-center py-6">
                    <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No designers found</p>
                    <p className="text-xs text-gray-400">Add designers to see their workload</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {workloads.map(w => {
                        const barWidth = maxHours > 0 ? (w.total_hours / maxHours) * 100 : 0;
                        const isOverloaded = w.avg_daily > 8;

                        return (
                            <div key={w.designer_id} className="group">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                            {w.designer_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">{w.designer_name}</span>
                                        {isOverloaded && (
                                            <span title="Averaging >8h/day">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-gray-900">{w.total_hours}h</span>
                                        <span className="text-xs text-gray-400 ml-1">({w.days_worked}d)</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${isOverloaded ? 'bg-amber-400' : w.total_hours > 0 ? 'bg-gray-800' : 'bg-gray-200'
                                            }`}
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                                {w.total_hours > 0 && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Avg: {w.avg_daily}h/day
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    {workloads.every(w => w.total_hours === 0) && (
                        <p className="text-xs text-gray-400 italic text-center mt-2">
                            No hours logged yet for this period. Use Design Tasks to log hours.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
