import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Shield, Zap } from 'lucide-react';
import { getHealthReport, getTrackedErrors, getPerformanceMetrics, resetHealth } from '../services/healthMonitor';

interface HealthReport {
    status: string;
    totalErrors: number;
    errorsLast5min: number;
    criticalErrors: number;
    totalMetrics: number;
    avgResponseTime: number;
    slowOperations: number;
    recentErrors: any[];
    timestamp: string;
}

const AdminHealthDashboard: React.FC = () => {
    const [report, setReport] = useState<HealthReport | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const refresh = () => setReport(getHealthReport());

    useEffect(() => {
        refresh();
        if (!autoRefresh) return;
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh]);

    if (!report) return null;

    const statusColor = report.status === 'healthy' ? 'emerald' : 'amber';
    const StatusIcon = report.status === 'healthy' ? CheckCircle : AlertTriangle;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${statusColor}-50`}>
                        <Shield className={`w-6 h-6 text-${statusColor}-600`} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">System Health</h2>
                        <p className="text-xs text-slate-400">
                            Updated: {new Date(report.timestamp).toLocaleTimeString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${autoRefresh
                                ? 'bg-aera-100 text-aera-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                    >
                        {autoRefresh ? 'Auto ⏵' : 'Paused ⏸'}
                    </button>
                    <button
                        onClick={refresh}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-${statusColor}-50 border border-${statusColor}-200`}>
                <StatusIcon className={`w-5 h-5 text-${statusColor}-600`} />
                <span className={`text-sm font-semibold text-${statusColor}-800 capitalize`}>
                    {report.status}
                </span>
                <span className={`text-xs text-${statusColor}-600 ml-auto`}>
                    {report.totalErrors === 0 ? 'No errors recorded' : `${report.totalErrors} total errors`}
                </span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label="Errors (5min)"
                    value={report.errorsLast5min}
                    color={report.errorsLast5min > 0 ? 'red' : 'green'}
                />
                <MetricCard
                    icon={<Zap className="w-4 h-4" />}
                    label="Critical"
                    value={report.criticalErrors}
                    color={report.criticalErrors > 0 ? 'red' : 'green'}
                />
                <MetricCard
                    icon={<Clock className="w-4 h-4" />}
                    label="Avg Response"
                    value={`${report.avgResponseTime}ms`}
                    color={report.avgResponseTime > 2000 ? 'amber' : 'green'}
                />
                <MetricCard
                    icon={<Activity className="w-4 h-4" />}
                    label="Slow Ops"
                    value={report.slowOperations}
                    color={report.slowOperations > 5 ? 'amber' : 'green'}
                />
            </div>

            {/* Recent Errors */}
            {report.recentErrors.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent Errors</h3>
                    <div className="space-y-2">
                        {report.recentErrors.map((err, i) => (
                            <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-mono font-semibold text-red-700">
                                        {err.severity?.toUpperCase()}
                                    </span>
                                    <span className="text-xs text-red-400">
                                        {new Date(err.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <p className="text-sm text-red-800">{err.message}</p>
                                {err.component && (
                                    <p className="text-xs text-red-500 mt-1">Component: {err.component}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Performance Metrics Summary */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Performance Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="text-slate-400">Total Metrics:</span>
                        <span className="ml-2 font-mono text-slate-700">{report.totalMetrics}</span>
                    </div>
                    <div>
                        <span className="text-slate-400">Avg Duration:</span>
                        <span className="ml-2 font-mono text-slate-700">{report.avgResponseTime}ms</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Metric Card Sub-Component ──
const MetricCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number | string;
    color: string;
}> = ({ icon, label, value, color }) => (
    <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
            <div className={`text-${color}-500`}>{icon}</div>
            <span className="text-xs text-slate-400">{label}</span>
        </div>
        <p className="text-xl font-bold text-slate-800">{value}</p>
    </div>
);

export default AdminHealthDashboard;
