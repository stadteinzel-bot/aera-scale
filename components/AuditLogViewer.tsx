import React, { useState, useEffect, useCallback } from 'react';
import { Search, Shield, Download, Filter, ChevronDown, RefreshCw, FileText, User, Trash2, Edit3, Plus } from 'lucide-react';
import { dataService } from '../services/dataService';
import { useOrg } from '../services/OrgContext';
import type { AuditLogEntry } from '../types';

type ActionFilter = 'all' | 'create' | 'update' | 'delete' | 'login' | 'other';

const ACTION_COLORS: Record<string, { bg: string; text: string; icon: React.FC<any> }> = {
    create: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: Plus },
    update: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Edit3 },
    delete: { bg: 'bg-red-50', text: 'text-red-700', icon: Trash2 },
    login: { bg: 'bg-purple-50', text: 'text-purple-700', icon: User },
    other: { bg: 'bg-slate-50', text: 'text-slate-600', icon: FileText },
};

function getActionType(action: string): string {
    const a = action.toLowerCase();
    if (a.includes('created') || a.includes('create') || a.includes('eingeladen') || a.includes('added')) return 'create';
    if (a.includes('updated') || a.includes('update') || a.includes('changed') || a.includes('geändert')) return 'update';
    if (a.includes('deleted') || a.includes('delete') || a.includes('removed') || a.includes('gelöscht')) return 'delete';
    if (a.includes('login') || a.includes('signed') || a.includes('angemeldet')) return 'login';
    return 'other';
}

function formatDate(iso: string): string {
    try {
        return new Intl.DateTimeFormat('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        }).format(new Date(iso));
    } catch {
        return iso;
    }
}

const AuditLogViewer: React.FC = () => {
    const { orgId } = useOrg();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [filtered, setFiltered] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState<ActionFilter>('all');

    const load = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const data = await dataService.getAllAuditLogs(200);
            setLogs(data);
        } catch (e) {
            console.error('Failed to load audit logs:', e);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => { load(); }, [load]);

    // Apply filters
    useEffect(() => {
        let result = [...logs];
        if (actionFilter !== 'all') {
            result = result.filter(l => getActionType(l.action) === actionFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(l =>
                (l.action || '').toLowerCase().includes(q) ||
                (l.user || '').toLowerCase().includes(q) ||
                (l.details || '').toLowerCase().includes(q)
            );
        }
        setFiltered(result);
    }, [logs, search, actionFilter]);

    // Export to CSV
    const handleExport = () => {
        const header = 'Zeitstempel,Aktion,Benutzer,Details,PropertyId';
        const rows = filtered.map(l =>
            [l.timestamp, l.action, l.user, l.details || '', l.propertyId || '']
                .map(v => `"${String(v).replace(/"/g, '""')}"`)
                .join(',')
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100">
                        <Shield className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Audit Log</h2>
                        <p className="text-xs text-slate-400">{filtered.length} Einträge</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Aktualisieren"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={filtered.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-40"
                    >
                        <Download className="w-3.5 h-3.5" />
                        CSV exportieren
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Suchen…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-aera-500/30"
                    />
                </div>

                {/* Action filter */}
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select
                        value={actionFilter}
                        onChange={e => setActionFilter(e.target.value as ActionFilter)}
                        className="pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-aera-500/30 appearance-none"
                    >
                        <option value="all">Alle Aktionen</option>
                        <option value="create">Erstellt</option>
                        <option value="update">Geändert</option>
                        <option value="delete">Gelöscht</option>
                        <option value="login">Login</option>
                        <option value="other">Sonstiges</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Log Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-aera-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Keine Einträge gefunden</p>
                </div>
            ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Zeitstempel</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Aktion</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Benutzer</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map((log, i) => {
                                const type = getActionType(log.action);
                                const cfg = ACTION_COLORS[type] || ACTION_COLORS.other;
                                const Icon = cfg.icon;
                                return (
                                    <tr key={log.id || i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap font-mono">
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                                                <Icon className="w-3 h-3" />
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[160px] truncate">
                                            {log.user || '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[280px] truncate">
                                            {log.details || '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AuditLogViewer;
