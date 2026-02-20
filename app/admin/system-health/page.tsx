'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
    Activity, Database, RefreshCcw, CheckCircle2,
    AlertTriangle, Loader2, Server, Zap, Clock,
    Shield, HardDrive, BarChart3
} from 'lucide-react';

interface HealthData {
    status: string;
    timestamp: string;
    database: { connected: boolean; responseTime: string; error?: string };
    tables: Record<string, { count: number }>;
    systemHealth?: any;
    responseTime: string;
}

interface MaintenanceResult {
    status: string;
    duration_ms: number;
    tables_analyzed: number;
    table_counts: Record<string, number>;
    message: string;
}

export default function SystemHealthPage() {
    const { profile } = useAuth();
    const [healthData, setHealthData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);
    const [lastOptimize, setLastOptimize] = useState<MaintenanceResult | null>(null);
    const [error, setError] = useState('');

    const fetchHealth = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setHealthData(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch health data');
        } finally {
            setLoading(false);
        }
    };

    const runOptimization = async () => {
        setOptimizing(true);
        setError('');
        try {
            const { data, error: rpcError } = await supabase.rpc('run_system_maintenance');
            if (rpcError) {
                setError(`Optimization failed: ${rpcError.message}. Run SYSTEM_MAINTENANCE.sql in Supabase SQL Editor first.`);
            } else {
                setLastOptimize(data as MaintenanceResult);
                // Refresh health after optimization
                await fetchHealth();
            }
        } catch (err: any) {
            setError(err.message || 'Optimization failed');
        } finally {
            setOptimizing(false);
        }
    };

    useEffect(() => {
        fetchHealth();
    }, []);

    // Only admin can access
    if (profile?.role && profile.role !== 'admin') {
        return (
            <div className="flex h-96 items-center justify-center">
                <p className="text-muted-foreground">Admin access required</p>
            </div>
        );
    }

    const statusColor = healthData?.status === 'healthy'
        ? 'text-green-600 bg-green-50 border-green-200'
        : healthData?.status === 'degraded'
            ? 'text-amber-600 bg-amber-50 border-amber-200'
            : 'text-red-600 bg-red-50 border-red-200';

    const statusIcon = healthData?.status === 'healthy'
        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
        : <AlertTriangle className="w-5 h-5 text-amber-600" />;

    return (
        <div className="space-y-6 pb-12 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-page-title text-gray-900 flex items-center gap-2">
                        <Activity className="w-6 h-6" /> System Health
                    </h1>
                    <p className="text-gray-500 text-sm">Monitor performance and run optimizations</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchHealth}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={runOptimization}
                        disabled={optimizing}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                        {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {optimizing ? 'Optimizing...' : 'Run Optimization'}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    {error}
                </div>
            )}

            {/* Last Optimization Result */}
            {lastOptimize && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Optimization Complete!</p>
                        <p>{lastOptimize.message}</p>
                        <p className="text-xs mt-1 text-green-600">
                            {lastOptimize.tables_analyzed} tables analyzed in {lastOptimize.duration_ms}ms
                        </p>
                    </div>
                </div>
            )}

            {loading && !healthData ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-3 text-gray-500">Checking system health...</span>
                </div>
            ) : healthData ? (
                <>
                    {/* Status Banner */}
                    <div className={`p-4 rounded-lg border flex items-center gap-3 ${statusColor}`}>
                        {statusIcon}
                        <div>
                            <p className="font-bold capitalize">{healthData.status}</p>
                            <p className="text-xs opacity-80">
                                Last checked: {new Date(healthData.timestamp).toLocaleString()} •
                                Response: {healthData.responseTime}
                            </p>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Database */}
                        <div className="bg-white p-4 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-4 h-4 text-gray-400" />
                                <span className="text-xs font-bold text-gray-500 uppercase">Database</span>
                            </div>
                            <p className={`text-lg font-bold ${healthData.database.connected ? 'text-green-600' : 'text-red-600'}`}>
                                {healthData.database.connected ? 'Connected' : 'Disconnected'}
                            </p>
                            <p className="text-xs text-gray-500">{healthData.database.responseTime} response</p>
                        </div>

                        {/* Response Time */}
                        <div className="bg-white p-4 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-xs font-bold text-gray-500 uppercase">API Speed</span>
                            </div>
                            <p className="text-lg font-bold text-gray-900">{healthData.responseTime}</p>
                            <p className="text-xs text-gray-500">Health check round-trip</p>
                        </div>

                        {/* DB Size */}
                        {healthData.systemHealth && (
                            <>
                                <div className="bg-white p-4 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <HardDrive className="w-4 h-4 text-gray-400" />
                                        <span className="text-xs font-bold text-gray-500 uppercase">DB Size</span>
                                    </div>
                                    <p className="text-lg font-bold text-gray-900">{healthData.systemHealth.database_size}</p>
                                    <p className="text-xs text-gray-500">{healthData.systemHealth.total_indexes} indexes</p>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Server className="w-4 h-4 text-gray-400" />
                                        <span className="text-xs font-bold text-gray-500 uppercase">Connections</span>
                                    </div>
                                    <p className="text-lg font-bold text-gray-900">{healthData.systemHealth.active_connections}</p>
                                    <p className="text-xs text-gray-500">Active database connections</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Table Stats */}
                    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-gray-500" />
                            <h3 className="font-bold text-sm text-gray-700">Table Statistics</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Table</th>
                                        <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Rows</th>
                                        {healthData.systemHealth?.tables && (
                                            <>
                                                <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Size</th>
                                                <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Last Analyzed</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {healthData.systemHealth?.tables ? (
                                        // Detailed stats from RPC
                                        healthData.systemHealth.tables.map((table: any, i: number) => (
                                            <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                                                <td className="px-4 py-2 font-mono text-xs font-medium">{table.table_name}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{(table.row_count ?? 0).toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right text-gray-500">{table.total_size}</td>
                                                <td className="px-4 py-2 text-right text-gray-500 text-xs">
                                                    {table.last_analyze
                                                        ? new Date(table.last_analyze).toLocaleDateString()
                                                        : table.last_autoanalyze
                                                            ? new Date(table.last_autoanalyze).toLocaleDateString()
                                                            : <span className="text-amber-500">Never</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        // Basic stats from /api/health
                                        Object.entries(healthData.tables).map(([name, info]) => (
                                            <tr key={name} className="border-t border-gray-50 hover:bg-gray-50">
                                                <td className="px-4 py-2 font-mono text-xs font-medium">{name}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{info.count.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Performance Tips */}
                    <div className="bg-white rounded-lg border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-4 h-4 text-gray-500" />
                            <h3 className="font-bold text-sm text-gray-700">Performance Tips</h3>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                            <p>✅ <strong>Run Optimization</strong> — Click the button above to refresh database statistics. Do this weekly or whenever things feel slow.</p>
                            <p>✅ <strong>Indexes</strong> — Run <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">PERFORMANCE_INDEXES.sql</code> in Supabase SQL Editor (one-time setup).</p>
                            <p>✅ <strong>Monitor</strong> — Check this page periodically. If DB response &gt; 200ms, run optimization.</p>
                            <p>💡 <strong>Scaling</strong> — For 50+ users, consider upgrading your Supabase plan for more database connections.</p>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
