import React, { useState, useEffect, useCallback } from 'react';
import {
    Landmark, BrainCircuit, Bell, MessageCircle, Save, CheckCircle2,
    AlertTriangle, Calendar, RefreshCw, Wallet, XCircle, Shield,
    Eye, EyeOff, Clock, Send, ChevronDown, ChevronRight, Info
} from 'lucide-react';
import { Property, AssetConfig as AssetConfigType, AuditLogEntry, ReconciliationResult, Tenant } from '../types';
import { useDataCore } from '../core/DataCoreProvider';
import { useAuth } from '../services/AuthContext';
import { dataService } from '../services/dataService';
import { performSmartReconciliation } from '../services/geminiService';

interface AssetConfigProps {
    property: Property;
}

type ConfigSection = 'bank' | 'ai' | 'notifications' | 'whatsapp';

// ── Defaults ──
const DEFAULT_CONFIG: Omit<AssetConfigType, 'propertyId'> = {
    aiPaymentEnabled: false,
    aiMatchThreshold: 80,
    aiPartialPaymentTolerance: 5,
    notifications: {
        enableReminders: true,
        reminderDaysBefore: 3,
        reminderTemplate: 'Sehr geehrte/r {Tenant_Name},\n\nwir möchten Sie daran erinnern, dass die Miete für {Property_Name} am {Due_Date} fällig ist.\n\nMit freundlichen Grüßen,\nIhr Vermieter',
        enableOverdueAlerts: true,
        overdueDaysAfter: 5,
        overdueTemplate: 'Sehr geehrte/r {Tenant_Name},\n\ndie Mietzahlung in Höhe von {Amount_Due} € für {Property_Name} ist überfällig. Bitte überweisen Sie den Betrag umgehend.\n\nMit freundlichen Grüßen,\nIhr Vermieter',
    },
    whatsapp: { mode: 'global', overrideNumber: '' },
    updatedAt: '',
};

// ── Utility ──
function maskIBAN(iban: string): string {
    const clean = iban.replace(/\s/g, '');
    if (clean.length < 8) return iban;
    return clean.slice(0, 4) + ' •••• •••• ' + clean.slice(-4);
}

// ── Section card wrapper ──
const SectionCard: React.FC<{
    id: ConfigSection;
    icon: React.ElementType;
    title: string;
    subtitle: string;
    gradient: string;
    activeSection: ConfigSection | null;
    onToggle: (id: ConfigSection) => void;
    children: React.ReactNode;
}> = ({ id, icon: Icon, title, subtitle, gradient, activeSection, onToggle, children }) => {
    const isOpen = activeSection === id;
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
            <button
                onClick={() => onToggle(id)}
                className={`w-full p-5 flex items-center gap-4 text-left transition-colors ${isOpen ? gradient + ' text-white' : 'hover:bg-slate-50'}`}
            >
                <div className={`p-2.5 rounded-lg ${isOpen ? 'bg-white/15 backdrop-blur-sm' : 'bg-slate-100'}`}>
                    <Icon className={`w-5 h-5 ${isOpen ? 'text-white/90' : 'text-slate-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold ${isOpen ? '' : 'text-slate-900'}`}>{title}</h3>
                    <p className={`text-sm ${isOpen ? 'text-white/70' : 'text-slate-500'}`}>{subtitle}</p>
                </div>
                {isOpen
                    ? <ChevronDown className="w-5 h-5 text-white/60" />
                    : <ChevronRight className="w-5 h-5 text-slate-400" />}
            </button>
            {isOpen && (
                <div className="p-6 animate-in fade-in slide-in-from-top-2 duration-200 border-t border-slate-100">
                    {children}
                </div>
            )}
        </div>
    );
};

// ── Toggle switch ──
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; color?: string }> = ({ checked, onChange, color = 'peer-checked:bg-aera-600' }) => (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-aera-600/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${color}`}></div>
    </label>
);

// ────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────
const AssetConfigComponent: React.FC<AssetConfigProps> = ({ property }) => {
    const { data } = useDataCore();
    const { user } = useAuth();
    const tenants = data.tenants.filter(t => t.propertyId === property.id);

    const [config, setConfig] = useState<AssetConfigType>({ propertyId: property.id, ...DEFAULT_CONFIG });
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [activeSection, setActiveSection] = useState<ConfigSection | null>('bank');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [showIBAN, setShowIBAN] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simResults, setSimResults] = useState<ReconciliationResult[] | null>(null);

    // Load config + audit logs
    useEffect(() => {
        (async () => {
            const [saved, logs] = await Promise.all([
                dataService.getAssetConfig(property.id),
                dataService.getAuditLogs(property.id),
            ]);
            if (saved) setConfig(saved);
            setAuditLogs(logs);
        })();
    }, [property.id]);

    const handleToggleSection = (id: ConfigSection) => {
        setActiveSection(prev => prev === id ? null : id);
    };

    // ── Save handler with audit ──
    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            await dataService.saveAssetConfig(property.id, config);
            await dataService.addAuditLog({
                propertyId: property.id,
                action: 'config_updated',
                field: activeSection || 'general',
                timestamp: new Date().toISOString(),
                userEmail: user?.email || 'unknown',
            });
            setSaveStatus('saved');
            const logs = await dataService.getAuditLogs(property.id);
            setAuditLogs(logs);
            setTimeout(() => setSaveStatus('idle'), 2500);
        } catch (err) {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setIsSaving(false);
        }
    }, [config, property.id, activeSection]);

    // ── AI Simulation ──
    const handleSimulation = async () => {
        setIsSimulating(true);
        setSimResults(null);
        const mockTransactions = [
            { id: 'sim-1', date: '2025-03-01', amount: tenants[0]?.monthlyRent || 1200, sender: tenants[0]?.name || 'Max Müller GmbH', reference: `Miete ${property.name}` },
            { id: 'sim-2', date: '2025-03-02', amount: (tenants[1]?.monthlyRent || 950) * 0.8, sender: (tenants[1]?.name || 'Innovations AG').split(' ').reverse().join(' '), reference: 'Rent' },
            { id: 'sim-3', date: '2025-03-03', amount: 42.50, sender: 'Café Sonnenschein', reference: 'Kaffee Büro' },
        ];
        const tenantContext = tenants.map(t => ({ name: t.name, monthlyRent: t.monthlyRent }));
        const results = await performSmartReconciliation(mockTransactions, tenantContext);
        setSimResults(results);
        await dataService.addAuditLog({
            propertyId: property.id,
            action: 'ai_simulation_run',
            field: 'ai_payment',
            timestamp: new Date().toISOString(),
            userEmail: user?.email || 'unknown',
        });
        setIsSimulating(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Matched': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Partial Payment': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Overpayment': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };
    const getConfidenceColor = (s: number) => s >= 90 ? 'bg-emerald-500' : s >= 70 ? 'bg-amber-500' : 'bg-red-500';

    // ── Template preview ──
    const previewTemplate = (tpl: string) => {
        return tpl
            .replace(/{Tenant_Name}/g, tenants[0]?.name || 'Max Mustermann')
            .replace(/{Property_Name}/g, property.name)
            .replace(/{Due_Date}/g, '01.04.2025')
            .replace(/{Amount_Due}/g, (tenants[0]?.monthlyRent || 1200).toFixed(2));
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-300 pb-10">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-aera-900">Konfiguration</h1>
                <p className="text-slate-500 mt-1 text-sm">
                    Asset-spezifische Einstellungen für <strong>{property.name}</strong>
                </p>
            </div>

            <div className="space-y-3">
                {/* ═══════════════ A: BANKVERBINDUNG ═══════════════ */}
                <SectionCard
                    id="bank"
                    icon={Landmark}
                    title="Bankverbindung (Asset-Override)"
                    subtitle="Überschreibt globale Defaults bei der Dokumentenerstellung"
                    gradient="bg-gradient-to-r from-aera-900 to-aera-800"
                    activeSection={activeSection}
                    onToggle={handleToggleSection}
                >
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 mb-6">
                        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                        <p>Diese Bankverbindung überschreibt globale Defaults bei der Dokumentenerstellung für dieses Objekt. Priorität: Asset-Override → Vermieter-Daten → Globale Einstellung.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Kontoinhaber</label>
                            <input
                                type="text"
                                value={config.bankOverride?.accountHolder || ''}
                                onChange={e => setConfig(c => ({ ...c, bankOverride: { ...c.bankOverride!, accountHolder: e.target.value, iban: c.bankOverride?.iban || '', bic: c.bankOverride?.bic || '', bankName: c.bankOverride?.bankName || '' } }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                placeholder="AERA SCALE GmbH"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                IBAN
                                <button onClick={() => setShowIBAN(!showIBAN)} className="ml-2 text-slate-400 hover:text-slate-600">
                                    {showIBAN ? <EyeOff className="w-3.5 h-3.5 inline" /> : <Eye className="w-3.5 h-3.5 inline" />}
                                </button>
                            </label>
                            <input
                                type="text"
                                value={showIBAN ? (config.bankOverride?.iban || '') : maskIBAN(config.bankOverride?.iban || '')}
                                onChange={e => setConfig(c => ({ ...c, bankOverride: { ...c.bankOverride!, iban: e.target.value, accountHolder: c.bankOverride?.accountHolder || '', bic: c.bankOverride?.bic || '', bankName: c.bankOverride?.bankName || '' } }))}
                                onFocus={() => setShowIBAN(true)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none font-mono"
                                placeholder="DE89 3704 0044 0532 0130 00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">BIC / SWIFT</label>
                            <input
                                type="text"
                                value={config.bankOverride?.bic || ''}
                                onChange={e => setConfig(c => ({ ...c, bankOverride: { ...c.bankOverride!, bic: e.target.value, accountHolder: c.bankOverride?.accountHolder || '', iban: c.bankOverride?.iban || '', bankName: c.bankOverride?.bankName || '' } }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none font-mono"
                                placeholder="COBADEFFXXX"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                            <input
                                type="text"
                                value={config.bankOverride?.bankName || ''}
                                onChange={e => setConfig(c => ({ ...c, bankOverride: { ...c.bankOverride!, bankName: e.target.value, accountHolder: c.bankOverride?.accountHolder || '', iban: c.bankOverride?.iban || '', bic: c.bankOverride?.bic || '' } }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                placeholder="Commerzbank AG"
                            />
                        </div>
                    </div>

                    {/* Active source indicator */}
                    <div className="mt-5 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs">
                        <Shield className="w-4 h-4 text-aera-600" />
                        <span className="text-slate-600">
                            Aktive Bankverbindung:{' '}
                            {config.bankOverride?.iban
                                ? <strong className="text-aera-800">{maskIBAN(config.bankOverride.iban)} (Asset-Override)</strong>
                                : property.landlord?.iban
                                    ? <strong className="text-slate-800">{maskIBAN(property.landlord.iban)} (Vermieter-Daten)</strong>
                                    : <span className="text-amber-600 font-medium">Keine Bankverbindung hinterlegt</span>
                            }
                        </span>
                    </div>
                </SectionCard>

                {/* ═══════════════ B: AI PAYMENT INTELLIGENCE ═══════════════ */}
                <SectionCard
                    id="ai"
                    icon={BrainCircuit}
                    title="AI Payment Intelligence"
                    subtitle="Transaktionsanalyse powered by Gemini"
                    gradient="bg-gradient-to-r from-indigo-900 to-indigo-800"
                    activeSection={activeSection}
                    onToggle={handleToggleSection}
                >
                    <div className="space-y-6">
                        {/* Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-slate-900">AI Payment Intelligence aktiv</p>
                                <p className="text-xs text-slate-500 mt-0.5">Powered by Gemini — erkennt Mieter, Teilzahlungen und Abweichungen</p>
                            </div>
                            <Toggle
                                checked={config.aiPaymentEnabled}
                                onChange={v => setConfig(c => ({ ...c, aiPaymentEnabled: v }))}
                            />
                        </div>

                        <div className={`space-y-5 transition-opacity duration-200 ${config.aiPaymentEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            {/* Threshold */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Matching-Sensitivität: <strong className="text-aera-700">{config.aiMatchThreshold}%</strong>
                                </label>
                                <input
                                    type="range"
                                    min={30}
                                    max={100}
                                    value={config.aiMatchThreshold}
                                    onChange={e => setConfig(c => ({ ...c, aiMatchThreshold: Number(e.target.value) }))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-aera-600"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                    <span>Tolerant (30%)</span>
                                    <span>Strikt (100%)</span>
                                </div>
                            </div>

                            {/* Partial payment tolerance */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Toleranzbetrag für Teilzahlungen</label>
                                <div className="relative w-40">
                                    <input
                                        type="number"
                                        min={0}
                                        value={config.aiPartialPaymentTolerance}
                                        onChange={e => setConfig(c => ({ ...c, aiPartialPaymentTolerance: Number(e.target.value) }))}
                                        className="w-full pl-6 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none"
                                    />
                                    <span className="absolute left-3 top-2 text-sm text-slate-400">€</span>
                                </div>
                            </div>

                            {/* Simulate */}
                            <div className="pt-2 border-t border-slate-100">
                                <button
                                    onClick={handleSimulation}
                                    disabled={isSimulating}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 shadow-sm text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-900 transition-colors disabled:opacity-50 font-medium text-sm"
                                >
                                    {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> : <Wallet className="w-4 h-4" />}
                                    <span>{isSimulating ? 'Analyse läuft…' : 'Transaktion simulieren'}</span>
                                </button>
                            </div>

                            {/* Results table */}
                            {simResults && (
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden animate-in slide-in-from-top-2 shadow-sm">
                                    <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between">
                                        <span className="w-1/3">Transaktion</span>
                                        <span className="w-1/4">Status</span>
                                        <span className="w-1/3">AI Reasoning</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {simResults.map((log, idx) => (
                                            <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex flex-col md:flex-row gap-4">
                                                    <div className="w-full md:w-1/3">
                                                        <div className="font-bold text-slate-900">€{log.originalAmount.toLocaleString()}</div>
                                                        <div className="text-sm text-slate-700 font-medium">{log.senderName}</div>
                                                        <div className="text-xs text-slate-400 mt-1 font-mono">ID: {log.transactionId}</div>
                                                    </div>
                                                    <div className="w-full md:w-1/4 flex flex-col items-start gap-2">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border flex items-center ${getStatusColor(log.status)}`}>
                                                            {log.status === 'Matched' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                                            {log.status === 'Partial Payment' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                            {log.status === 'Unmatched' && <XCircle className="w-3 h-3 mr-1" />}
                                                            {log.status}
                                                        </span>
                                                        {log.matchedTenantName && (
                                                            <span className="text-xs text-slate-500">Mieter: <strong>{log.matchedTenantName}</strong></span>
                                                        )}
                                                    </div>
                                                    <div className="w-full md:w-1/3">
                                                        <p className="text-xs text-slate-600 mb-2 leading-relaxed">{log.reasoning}</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${getConfidenceColor(log.confidenceScore)}`} style={{ width: `${log.confidenceScore}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-400">{log.confidenceScore}%</span>
                                                        </div>
                                                        {log.discrepancyAmount !== undefined && log.discrepancyAmount !== 0 && (
                                                            <div className="mt-2 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded inline-block">
                                                                Abweichung: {log.discrepancyAmount > 0 ? '+' : ''}€{log.discrepancyAmount.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-2 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
                                        Powered by Gemini • Asset-spezifische Analyse
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </SectionCard>

                {/* ═══════════════ C: NOTIFICATIONS ═══════════════ */}
                <SectionCard
                    id="notifications"
                    icon={Bell}
                    title="Benachrichtigungen"
                    subtitle="Automatisierte Zahlungserinnerungen & Mahnungen"
                    gradient="bg-gradient-to-r from-amber-700 to-amber-600"
                    activeSection={activeSection}
                    onToggle={handleToggleSection}
                >
                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 mb-6">
                        <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                        <p>Diese Einstellungen überschreiben globale Notification-Defaults für dieses Objekt. Falls nicht konfiguriert, gelten die globalen Einstellungen.</p>
                    </div>

                    <div className="space-y-8">
                        {/* C1: Upcoming Payment Reminder */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-semibold text-slate-900">
                                    <Calendar className="w-5 h-5 text-aera-600" />
                                    <span>Zahlungserinnerung</span>
                                </div>
                                <Toggle
                                    checked={config.notifications.enableReminders}
                                    onChange={v => setConfig(c => ({ ...c, notifications: { ...c.notifications, enableReminders: v } }))}
                                />
                            </div>
                            <div className={`pl-7 space-y-4 transition-opacity duration-200 ${config.notifications.enableReminders ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-slate-600">Erinnerung senden</span>
                                    <div className="relative w-20">
                                        <input
                                            type="number"
                                            value={config.notifications.reminderDaysBefore}
                                            onChange={e => setConfig(c => ({ ...c, notifications: { ...c.notifications, reminderDaysBefore: parseInt(e.target.value) || 0 } }))}
                                            className="w-full pl-3 pr-2 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-center"
                                        />
                                    </div>
                                    <span className="text-sm text-slate-600">Tage vor Fälligkeit</span>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Nachrichtenvorlage</label>
                                    <textarea
                                        value={config.notifications.reminderTemplate}
                                        onChange={e => setConfig(c => ({ ...c, notifications: { ...c.notifications, reminderTemplate: e.target.value } }))}
                                        className="w-full h-28 p-3 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none resize-none"
                                    />
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {['{Tenant_Name}', '{Property_Name}', '{Due_Date}'].map(v => (
                                            <span key={v} className="px-2 py-0.5 bg-aera-50 text-aera-700 text-[10px] font-mono rounded-md border border-aera-200">{v}</span>
                                        ))}
                                    </div>
                                </div>
                                {/* Preview */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                                        <Eye className="w-3.5 h-3.5" />Vorschau (Beispieldaten)
                                    </div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{previewTemplate(config.notifications.reminderTemplate)}</p>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        {/* C2: Overdue Alert */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-semibold text-slate-900">
                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    <span>Zahlungsverzug-Mahnung</span>
                                </div>
                                <Toggle
                                    checked={config.notifications.enableOverdueAlerts}
                                    onChange={v => setConfig(c => ({ ...c, notifications: { ...c.notifications, enableOverdueAlerts: v } }))}
                                    color="peer-checked:bg-amber-500"
                                />
                            </div>
                            <div className={`pl-7 space-y-4 transition-opacity duration-200 ${config.notifications.enableOverdueAlerts ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-slate-600">Mahnung senden</span>
                                    <div className="relative w-20">
                                        <input
                                            type="number"
                                            value={config.notifications.overdueDaysAfter}
                                            onChange={e => setConfig(c => ({ ...c, notifications: { ...c.notifications, overdueDaysAfter: parseInt(e.target.value) || 0 } }))}
                                            className="w-full pl-3 pr-2 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-center"
                                        />
                                    </div>
                                    <span className="text-sm text-slate-600">Tage nach Fälligkeit</span>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Nachrichtenvorlage</label>
                                    <textarea
                                        value={config.notifications.overdueTemplate}
                                        onChange={e => setConfig(c => ({ ...c, notifications: { ...c.notifications, overdueTemplate: e.target.value } }))}
                                        className="w-full h-28 p-3 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none resize-none"
                                    />
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {['{Tenant_Name}', '{Amount_Due}', '{Property_Name}'].map(v => (
                                            <span key={v} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-mono rounded-md border border-amber-200">{v}</span>
                                        ))}
                                    </div>
                                </div>
                                {/* Preview */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                                        <Eye className="w-3.5 h-3.5" />Vorschau (Beispieldaten)
                                    </div>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{previewTemplate(config.notifications.overdueTemplate)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* ═══════════════ D: WHATSAPP ═══════════════ */}
                <SectionCard
                    id="whatsapp"
                    icon={MessageCircle}
                    title="WhatsApp Integration"
                    subtitle="Business-Kommunikation über WhatsApp"
                    gradient="bg-gradient-to-r from-green-700 to-green-600"
                    activeSection={activeSection}
                    onToggle={handleToggleSection}
                >
                    <div className="space-y-5">
                        {/* Mode toggle */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Verbindungsmodus</label>
                            <div className="flex gap-3">
                                {[
                                    { value: 'global' as const, label: 'Globale Nummer verwenden', desc: 'Verwendet die globale WhatsApp-Nummer aus Einstellungen' },
                                    { value: 'override' as const, label: 'Eigene Nummer', desc: 'Asset-spezifische WhatsApp-Nummer' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setConfig(c => ({ ...c, whatsapp: { ...c.whatsapp, mode: opt.value } }))}
                                        className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${config.whatsapp.mode === opt.value
                                            ? 'border-green-600 bg-green-50 shadow-md ring-2 ring-green-600/20'
                                            : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                    >
                                        <div className={`text-sm font-semibold ${config.whatsapp.mode === opt.value ? 'text-green-800' : 'text-slate-700'}`}>{opt.label}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Override number */}
                        {config.whatsapp.mode === 'override' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp AERA Nummer</label>
                                <input
                                    type="text"
                                    value={config.whatsapp.overrideNumber}
                                    onChange={e => setConfig(c => ({ ...c, whatsapp: { ...c.whatsapp, overrideNumber: e.target.value } }))}
                                    placeholder="+49 123 4567890"
                                    className="w-full max-w-sm px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-600/20 focus:border-green-600 outline-none"
                                />
                            </div>
                        )}

                        {/* Status + Test */}
                        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${config.whatsapp.mode === 'override' && config.whatsapp.overrideNumber ? 'bg-green-500 animate-pulse' : config.whatsapp.mode === 'global' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                                <span className="text-sm text-slate-600">
                                    {config.whatsapp.mode === 'global' ? 'Globale Verbindung aktiv' : config.whatsapp.overrideNumber ? 'Verbunden' : 'Nicht verbunden'}
                                </span>
                            </div>
                            <button className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                <Send className="w-3.5 h-3.5" />
                                Test-Nachricht
                            </button>
                        </div>
                    </div>
                </SectionCard>
            </div>

            {/* ═══════════════ SAVE BUTTON ═══════════════ */}
            <div className="mt-6 flex items-center justify-between">
                {/* Audit log summary */}
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {auditLogs.length > 0
                        ? `Letzte Änderung: ${new Date(auditLogs[0].timestamp).toLocaleString('de-DE')}`
                        : 'Noch keine Änderungen'}
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-all ${saveStatus === 'saved'
                        ? 'bg-emerald-600 text-white'
                        : saveStatus === 'error'
                            ? 'bg-red-600 text-white'
                            : 'bg-aera-900 hover:bg-aera-800 text-white'
                        } disabled:opacity-60`}
                >
                    {saveStatus === 'saved' ? (
                        <><CheckCircle2 className="w-4 h-4" /><span>Gespeichert</span></>
                    ) : saveStatus === 'error' ? (
                        <><XCircle className="w-4 h-4" /><span>Fehler</span></>
                    ) : isSaving ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /><span>Speichern…</span></>
                    ) : (
                        <><Save className="w-4 h-4" /><span>Konfiguration speichern</span></>
                    )}
                </button>
            </div>

            {/* ═══════════════ AUDIT LOG ═══════════════ */}
            {auditLogs.length > 0 && (
                <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audit Log</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{auditLogs.length} Einträge</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {auditLogs.slice(0, 10).map(log => (
                            <div key={log.id} className="px-5 py-2.5 flex items-center gap-3 text-xs hover:bg-slate-50">
                                <div className="w-1.5 h-1.5 rounded-full bg-aera-400 shrink-0" />
                                <span className="text-slate-400 font-mono w-32 shrink-0">{new Date(log.timestamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="text-slate-700 font-medium">{log.action}</span>
                                <span className="text-slate-400">· {log.field}</span>
                                <span className="text-slate-400 ml-auto">{log.userEmail}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetConfigComponent;
