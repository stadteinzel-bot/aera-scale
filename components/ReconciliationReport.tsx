// ===== AERA SCALE — Reconciliation Report (Admin UI) =====
import React, { useState, useEffect, useMemo } from 'react';
import {
    Shield, Loader2, AlertTriangle, CheckCircle2, ChevronDown,
    ChevronRight, Download, FileText, RefreshCw, X, Search,
    AlertCircle
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { generateReconciliationReport } from '../services/rentValidator';
import { downloadTextAsPdf } from '../utils/pdfExport';
import { Property, Tenant } from '../types';
import {
    Contract, RentLineItem, ReconciliationReport as ReconcReport,
    ReconciliationEntry, ValidationIssue, DEFAULT_VALIDATION_CONFIG,
} from '../types/rentTypes';

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

const FLAG_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    CALC_MISMATCH: { label: 'Summen-Abweichung', color: 'text-red-700', bg: 'bg-red-100' },
    DUPLICATE_LINEITEM: { label: 'Doppelzählung', color: 'text-red-700', bg: 'bg-red-100' },
    ANOMALY: { label: 'Anomalie', color: 'text-amber-700', bg: 'bg-amber-100' },
    NEGATIVE_AMOUNT: { label: 'Negativbetrag', color: 'text-amber-700', bg: 'bg-amber-100' },
    CURRENCY_MIX: { label: 'Währungsmix', color: 'text-red-700', bg: 'bg-red-100' },
    MISSING_CONTRACT: { label: 'Fehlender Vertrag', color: 'text-slate-700', bg: 'bg-slate-100' },
};

const ReconciliationReport: React.FC<{ propertyId?: string }> = ({ propertyId }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [report, setReport] = useState<ReconcReport | null>(null);
    const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
    const [expandedContract, setExpandedContract] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    );

    const loadReport = async (month: string) => {
        setIsLoading(true);
        try {
            const [contracts, lineItems, properties, tenants] = await Promise.all([
                dataService.getContracts(),
                dataService.getRentLineItems(),
                dataService.getProperties(),
                dataService.getTenants(),
            ]);

            const filteredProperties = propertyId ? properties.filter(p => p.id === propertyId) : properties;
            const filteredTenants = propertyId ? tenants.filter(t => t.propertyId === propertyId) : tenants;

            const rpt = generateReconciliationReport(
                contracts,
                lineItems,
                filteredProperties.map(p => ({ id: p.id, name: p.name })),
                filteredTenants.map(t => ({ id: t.id, name: t.name })),
                month,
                DEFAULT_VALIDATION_CONFIG
            );
            setReport(rpt);
        } catch (err) {
            console.error('Failed to load reconciliation report', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadReport(selectedMonth);
    }, [selectedMonth]);

    // Generate month options (last 12 months)
    const monthOptions = useMemo(() => {
        const options: string[] = [];
        const d = new Date();
        for (let i = 0; i < 12; i++) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            options.push(`${year}-${month}`);
            d.setMonth(d.getMonth() - 1);
        }
        return options;
    }, []);

    const formatMonth = (m: string) => {
        const [y, mo] = m.split('-');
        const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        return `${months[parseInt(mo) - 1]} ${y}`;
    };

    const handleExportPdf = () => {
        if (!report) return;

        let text = `# Reconciliation Report — ${formatMonth(report.month)}\n\n`;
        text += `## Zusammenfassung\n\n`;
        text += `- **Status:** ${report.isClean ? '✅ Keine Abweichungen' : `⚠️ ${report.issues.length} Abweichungen erkannt`}\n`;
        text += `- **Gesamt-MRR:** ${formatCurrency(report.totalMRR)}\n`;
        text += `- **Einmalzahlungen:** ${formatCurrency(report.totalOneTime)}\n`;
        text += `- **Bruttomiete:** ${formatCurrency(report.totalGrossRent)}\n\n`;

        if (report.issues.length > 0) {
            text += `## Abweichungen\n\n`;
            for (const issue of report.issues) {
                text += `- **[${issue.flag}]** ${issue.message}\n`;
            }
            text += '\n';
        }

        text += `## Pro Objekt\n\n`;
        for (const prop of report.byProperty) {
            text += `### ${prop.propertyName}\n`;
            text += `- MRR: ${formatCurrency(prop.totalMRR)}\n`;
            text += `- Verträge: ${prop.contracts.length}\n\n`;

            for (const entry of prop.contracts) {
                text += `#### ${entry.contractNumber} — ${entry.tenantName}\n`;
                text += `- Berechnete MRR: ${formatCurrency(entry.computedMRR)}\n`;
                if (entry.expectedMRR != null) {
                    text += `- Erwartete MRR: ${formatCurrency(entry.expectedMRR)}\n`;
                }
                text += `- Positionen: ${entry.lineItemCount}\n`;
                if (entry.issues.length > 0) {
                    text += `- Abweichungen: ${entry.issues.map(i => i.flag).join(', ')}\n`;
                }
                text += '\n';
            }
        }

        downloadTextAsPdf(text, `Reconciliation_${report.month}.pdf`, {
            title: 'Reconciliation Report',
            subtitle: formatMonth(report.month),
            headerColor: [15, 82, 70],
        });
    };

    const filteredEntries = useMemo(() => {
        if (!report || !searchQuery.trim()) return report?.entries || [];
        const q = searchQuery.toLowerCase();
        return report.entries.filter(e =>
            e.tenantName.toLowerCase().includes(q) ||
            e.contractNumber.toLowerCase().includes(q) ||
            e.propertyName.toLowerCase().includes(q)
        );
    }, [report, searchQuery]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-aera-600 mr-3" />
                <span className="text-slate-500 text-sm">Reconciliation Report wird erstellt...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-aera-900 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-aera-600" />
                        Reconciliation Report
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Berechnung-Validierung und Abstimmungsbericht für Admin.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aera-200 focus:border-aera-600 outline-none"
                    >
                        {monthOptions.map(m => (
                            <option key={m} value={m}>{formatMonth(m)}</option>
                        ))}
                    </select>
                    <button onClick={() => loadReport(selectedMonth)}
                        className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        <RefreshCw className="w-4 h-4 text-slate-600" />
                    </button>
                    <button onClick={handleExportPdf} disabled={!report}
                        className="flex items-center gap-2 bg-aera-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-aera-700 transition-colors disabled:opacity-50">
                        <Download className="w-4 h-4" /> PDF Export
                    </button>
                </div>
            </div>

            {/* Status Summary Cards */}
            {report && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className={`p-5 rounded-xl border ${report.isClean ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {report.isClean
                                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                : <AlertTriangle className="w-5 h-5 text-red-600" />
                            }
                            <span className={`text-sm font-semibold ${report.isClean ? 'text-emerald-800' : 'text-red-800'}`}>
                                {report.isClean ? 'Keine Abweichungen' : `${report.issues.length} Abweichungen`}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600">{formatMonth(report.month)}</p>
                    </div>
                    <div className="p-5 rounded-xl border border-slate-200 bg-white">
                        <p className="text-xs text-slate-500 mb-1">Gesamt-MRR</p>
                        <p className="text-xl font-bold text-aera-900">{formatCurrency(report.totalMRR)}</p>
                    </div>
                    <div className="p-5 rounded-xl border border-slate-200 bg-white">
                        <p className="text-xs text-slate-500 mb-1">Einmalzahlungen</p>
                        <p className="text-xl font-bold text-aera-900">{formatCurrency(report.totalOneTime)}</p>
                    </div>
                    <div className="p-5 rounded-xl border border-slate-200 bg-white">
                        <p className="text-xs text-slate-500 mb-1">Bruttomiete</p>
                        <p className="text-xl font-bold text-aera-900">{formatCurrency(report.totalGrossRent)}</p>
                    </div>
                </div>
            )}

            {/* Issues List */}
            {report && report.issues.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-red-50 to-amber-50">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            Abweichungen & Warnungen ({report.issues.length})
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                        {report.issues.map((issue, idx) => {
                            const cfg = FLAG_CONFIG[issue.flag] || { label: issue.flag, color: 'text-slate-700', bg: 'bg-slate-100' };
                            return (
                                <div key={idx} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${issue.severity === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {issue.severity === 'error' ? 'Fehler' : 'Warnung'}
                                    </span>
                                    <p className="text-sm text-slate-700 flex-1">{issue.message}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Suche nach Mieter, Vertrag oder Objekt..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aera-200 focus:border-aera-600 outline-none"
                />
            </div>

            {/* Per-Property Drilldown */}
            {report && report.byProperty.length > 0 ? (
                <div className="space-y-3">
                    {report.byProperty.map(prop => {
                        const isExpanded = expandedProperty === prop.propertyId;
                        const propContracts = prop.contracts.filter(c => {
                            if (!searchQuery.trim()) return true;
                            const q = searchQuery.toLowerCase();
                            return c.tenantName.toLowerCase().includes(q) ||
                                c.contractNumber.toLowerCase().includes(q) ||
                                c.propertyName.toLowerCase().includes(q);
                        });

                        if (searchQuery.trim() && propContracts.length === 0) return null;

                        return (
                            <div key={prop.propertyId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setExpandedProperty(isExpanded ? null : prop.propertyId)}
                                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        <div className="text-left">
                                            <h4 className="font-semibold text-slate-900">{prop.propertyName}</h4>
                                            <p className="text-xs text-slate-500">{prop.contracts.length} Verträge</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-aera-900">{formatCurrency(prop.totalMRR)}</p>
                                        <p className="text-xs text-slate-500">MRR</p>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-slate-100">
                                        {propContracts.map(entry => {
                                            const isContractExpanded = expandedContract === entry.contractId;
                                            const hasIssues = entry.issues.length > 0;

                                            return (
                                                <div key={entry.contractId} className={`border-b border-slate-50 last:border-0 ${hasIssues ? 'bg-amber-50/30' : ''}`}>
                                                    <button
                                                        onClick={() => setExpandedContract(isContractExpanded ? null : entry.contractId)}
                                                        className="w-full px-8 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {isContractExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                                                            <div className="text-left">
                                                                <p className="text-sm font-medium text-slate-800">
                                                                    {entry.contractNumber}
                                                                    {hasIssues && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline ml-1.5 -mt-0.5" />}
                                                                </p>
                                                                <p className="text-xs text-slate-500">{entry.tenantName} — {entry.lineItemCount} Positionen</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex items-center gap-4">
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-800">{formatCurrency(entry.computedMRR)}</p>
                                                                {entry.expectedMRR != null && (
                                                                    <p className="text-xs text-slate-400">Erwartet: {formatCurrency(entry.expectedMRR)}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>

                                                    {isContractExpanded && entry.issues.length > 0 && (
                                                        <div className="px-12 pb-3 space-y-1">
                                                            {entry.issues.map((issue, idx) => {
                                                                const cfg = FLAG_CONFIG[issue.flag] || { label: issue.flag, color: 'text-slate-700', bg: 'bg-slate-100' };
                                                                return (
                                                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                                                        <span className={`px-1.5 py-0.5 rounded font-semibold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                                                                        <span className="text-slate-600">{issue.message}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : !isLoading && (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Keine Verträge vorhanden. Erstellen Sie Verträge und Mietpositionen, um den Reconciliation Report zu nutzen.</p>
                </div>
            )}

            {/* Config Info */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500 font-medium mb-2">Konfiguration:</p>
                <div className="flex gap-6 text-xs text-slate-600">
                    <span>CALC_MISMATCH: ±{DEFAULT_VALIDATION_CONFIG.percentThreshold * 100}% / ±{DEFAULT_VALIDATION_CONFIG.absoluteThreshold}€</span>
                    <span>ANOMALY: ±{DEFAULT_VALIDATION_CONFIG.maxMonthlyDelta * 100}% MoM</span>
                    <span>Währungen: {DEFAULT_VALIDATION_CONFIG.allowedCurrencies.join(', ')}</span>
                </div>
            </div>
        </div>
    );
};

export default ReconciliationReport;
