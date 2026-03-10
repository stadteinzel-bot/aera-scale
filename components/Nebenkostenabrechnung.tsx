import React, { useState, useMemo } from 'react';
import {
    Property, Tenant, OperatingCostEntry, CostCategory, AllocationKeyType,
    AllocationConfig, CostLineItem, TenantSettlement, Settlement
} from '../types';
import { dataService } from '../services/dataService';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';
import {
    analyzeInvoiceImage, generateSettlementDocument, validateSettlementCompliance
} from '../services/geminiService';
import {
    FileSpreadsheet, ChevronRight, ChevronLeft, Building2, Calendar, Check,
    Sparkles, Loader2, Users, Calculator, Scale, FileText, Download,
    ShieldCheck, AlertTriangle, Plus, Trash2, Eye, History, X,
    Upload, Camera, ArrowRight, CheckCircle2, Clock, Send
} from 'lucide-react';
import { downloadTextAsPdf, previewTextAsPdf } from '../utils/pdfExport';

// Default allocation keys per category (German standard)
const DEFAULT_ALLOCATION: AllocationConfig[] = [
    { category: 'Heizung', keyType: 'verbrauch', label: 'Nach Verbrauch' },
    { category: 'Wasser', keyType: 'personenzahl', label: 'Nach Personenzahl' },
    { category: 'Strom', keyType: 'flaeche', label: 'Nach Wohnfläche' },
    { category: 'Müllabfuhr', keyType: 'personenzahl', label: 'Nach Personenzahl' },
    { category: 'Hausmeister', keyType: 'flaeche', label: 'Nach Wohnfläche' },
    { category: 'Gebäudeversicherung', keyType: 'flaeche', label: 'Nach Wohnfläche' },
    { category: 'Grundsteuer', keyType: 'flaeche', label: 'Nach Wohnfläche' },
    { category: 'Aufzug', keyType: 'einheiten', label: 'Nach Einheiten' },
    { category: 'Gartenpflege', keyType: 'flaeche', label: 'Nach Wohnfläche' },
    { category: 'Reinigung', keyType: 'flaeche', label: 'Nach Wohnfläche' },
    { category: 'Schornsteinfeger', keyType: 'flaeche', label: 'Nach Wohnfläche' },
    { category: 'Allgemeinstrom', keyType: 'einheiten', label: 'Nach Einheiten' },
    { category: 'Sonstige', keyType: 'flaeche', label: 'Nach Wohnfläche' },
];

const KEY_TYPE_LABELS: Record<AllocationKeyType, string> = {
    flaeche: 'Nach Wohnfläche (m²)',
    personenzahl: 'Nach Personenzahl',
    einheiten: 'Nach Einheiten',
    verbrauch: 'Nach Verbrauch',
    direkt: 'Direkte Zuordnung',
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function daysBetween(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function toSqm(sqft: number): number {
    return Math.round(sqft * 0.0929);
}

const WIZARD_STEPS = [
    { num: 1, label: 'Immobilie & Zeitraum', icon: Building2 },
    { num: 2, label: 'Kosten prüfen', icon: Calculator },
    { num: 3, label: 'Umlageschlüssel', icon: Scale },
    { num: 4, label: 'Berechnung', icon: Users },
    { num: 5, label: 'KI-Prüfung & Dokument', icon: Sparkles },
];

const Nebenkostenabrechnung: React.FC<{ propertyId?: string }> = ({ propertyId: propId }) => {
    // === DATA CORE ===
    const { data, dispatch, isLoading } = useDataCore();
    const { t } = useTranslation();
    const properties = propId ? data.properties.filter(p => p.id === propId) : data.properties;
    const tenants = propId ? data.tenants.filter(t => t.propertyId === propId) : data.tenants;
    const costs = propId ? data.costs.filter(c => c.propertyId === propId) : data.costs;
    const settlements = propId ? data.settlements.filter(s => s.propertyId === propId) : data.settlements;

    // Wizard
    const [wizardStep, setWizardStep] = useState(0);
    const [selectedPropertyId, setSelectedPropertyId] = useState(propId || '');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);
    const [allocations, setAllocations] = useState<AllocationConfig[]>([...DEFAULT_ALLOCATION]);
    const [tenantSettlements, setTenantSettlements] = useState<TenantSettlement[]>([]);
    const [prepayments, setPrepayments] = useState<Record<string, number>>({});

    // AI states
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedDoc, setGeneratedDoc] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState('');
    const [selectedTenantForDoc, setSelectedTenantForDoc] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Invoice OCR
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<any>(null);

    // View settlement detail
    const [viewSettlement, setViewSettlement] = useState<Settlement | null>(null);

    // PDF Preview
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    const propertyCosts = useMemo(() =>
        costs.filter(c => c.propertyId === selectedPropertyId && c.year === selectedYear),
        [costs, selectedPropertyId, selectedYear]
    );
    const propertyTenants = useMemo(() =>
        tenants.filter(t => t.propertyId === selectedPropertyId),
        [tenants, selectedPropertyId]
    );

    const costByCategory = useMemo(() => {
        const map: Record<string, number> = {};
        propertyCosts.forEach(c => { map[c.category] = (map[c.category] || 0) + c.amount; });
        return map;
    }, [propertyCosts]);

    const totalCosts = useMemo(() =>
        Object.values(costByCategory).reduce((sum, v) => sum + v, 0), [costByCategory]
    );

    const totalPropertySqm = selectedProperty ? toSqm(selectedProperty.sizeSqFt) : 0;

    // --- CALCULATION ---
    const calculateSettlements = () => {
        if (!selectedProperty || propertyTenants.length === 0) return;

        const periodStart = `${selectedYear}-01-01`;
        const periodEnd = `${selectedYear}-12-31`;
        const totalDays = daysBetween(periodStart, periodEnd);

        const results: TenantSettlement[] = propertyTenants.map(tenant => {
            // Pro-rata: how many days was the tenant in the property during this year?
            const tenantStart = tenant.leaseStart > periodStart ? tenant.leaseStart : periodStart;
            const tenantEnd = tenant.leaseEnd && tenant.leaseEnd < periodEnd ? tenant.leaseEnd : periodEnd;
            const occupancyDays = daysBetween(tenantStart, tenantEnd);
            const proRataFactor = occupancyDays / totalDays;

            // Unit size — use unit size or proportional
            const tenantUnit = selectedProperty.units?.find(u => u.id === tenant.unitId);
            const unitSizeSqm = tenantUnit ? toSqm(tenantUnit.sizeSqFt) : totalPropertySqm > 0
                ? Math.round(totalPropertySqm / Math.max(1, propertyTenants.length)) : 0;
            const areaShare = totalPropertySqm > 0 ? unitSizeSqm / totalPropertySqm : (1 / Math.max(1, propertyTenants.length));

            // Calculate cost items
            const costItems: CostLineItem[] = Object.entries(costByCategory).map(([cat, totalAmount]) => {
                const alloc = allocations.find(a => a.category === cat);
                const keyType = alloc?.keyType || 'flaeche';

                // Share percentage based on allocation key
                let baseShare: number;
                switch (keyType) {
                    case 'flaeche': baseShare = areaShare; break;
                    case 'einheiten': baseShare = 1 / Math.max(1, propertyTenants.length); break;
                    case 'personenzahl': baseShare = 1 / Math.max(1, propertyTenants.length); break;
                    case 'verbrauch': baseShare = areaShare; break; // fallback to area
                    case 'direkt': baseShare = 1; break;
                    default: baseShare = areaShare;
                }
                const sharePercentage = baseShare * 100;
                const tenantShare = totalAmount * baseShare * proRataFactor;

                return {
                    category: cat as CostCategory,
                    totalAmount,
                    keyType,
                    tenantShare: Math.round(tenantShare * 100) / 100,
                    sharePercentage: Math.round(sharePercentage * 10) / 10,
                };
            });

            const totalTenantCosts = costItems.reduce((sum, ci) => sum + ci.tenantShare, 0);
            const prepayment = prepayments[tenant.id] || (tenant.monthlyRent * 0.2 * (occupancyDays / 30.44)); // estimate ~20% of rent
            const balance = totalTenantCosts - prepayment;

            return {
                tenantId: tenant.id,
                tenantName: tenant.name,
                propertyName: selectedProperty.name,
                unitSize: unitSizeSqm,
                occupancyDays,
                totalDays,
                proRataFactor: Math.round(proRataFactor * 1000) / 1000,
                costItems,
                totalCosts: Math.round(totalTenantCosts * 100) / 100,
                prepayments: Math.round(prepayment * 100) / 100,
                balance: Math.round(balance * 100) / 100,
            };
        });

        setTenantSettlements(results);
    };

    // --- AI ACTIONS ---
    const handleGenerateDocument = async (tenantId: string) => {
        const ts = tenantSettlements.find(t => t.tenantId === tenantId);
        if (!ts || !selectedProperty) return;
        setIsGenerating(true);
        setSelectedTenantForDoc(tenantId);
        try {
            const doc = await generateSettlementDocument({
                propertyName: selectedProperty.name,
                propertyAddress: selectedProperty.address,
                year: selectedYear,
                periodStart: `01.01.${selectedYear}`,
                periodEnd: `31.12.${selectedYear}`,
                tenantName: ts.tenantName,
                unitSize: ts.unitSize,
                totalPropertySize: totalPropertySqm,
                occupancyDays: ts.occupancyDays,
                totalDays: ts.totalDays,
                costItems: ts.costItems.map(ci => ({
                    category: ci.category,
                    totalAmount: ci.totalAmount,
                    tenantShare: ci.tenantShare,
                    sharePercentage: ci.sharePercentage,
                    keyType: KEY_TYPE_LABELS[ci.keyType],
                })),
                totalCosts: ts.totalCosts,
                prepayments: ts.prepayments,
                balance: ts.balance,
                landlordName: selectedProperty.landlord?.name,
                landlordAddress: selectedProperty.landlord ? `${selectedProperty.landlord.address}, ${selectedProperty.landlord.zipCode} ${selectedProperty.landlord.city}` : undefined,
                landlordIban: selectedProperty.landlord?.iban,
            });
            setGeneratedDoc(doc);
        } catch (error: any) {
            alert(`Fehler: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleValidate = async () => {
        if (!generatedDoc) return;
        setIsValidating(true);
        try {
            const result = await validateSettlementCompliance(generatedDoc);
            setValidationResult(result);
        } catch (error: any) {
            alert(`Prüfung fehlgeschlagen: ${error.message}`);
        } finally {
            setIsValidating(false);
        }
    };

    const handleSaveSettlement = async () => {
        if (!selectedProperty || tenantSettlements.length === 0) return;
        setIsSaving(true);
        try {
            await dispatch({
                type: 'settlement:add', payload: {
                    propertyId: selectedPropertyId,
                    year: selectedYear,
                    periodStart: `${selectedYear}-01-01`,
                    periodEnd: `${selectedYear}-12-31`,
                    tenantSettlements,
                    totalPropertyCosts: totalCosts,
                    status: validationResult ? 'validated' : 'draft',
                    aiValidation: validationResult || undefined,
                    createdAt: new Date().toISOString(),
                    generatedText: generatedDoc || undefined,
                }
            });
            alert('✅ Abrechnung gespeichert!');
        } catch (error: any) {
            alert(`Fehler: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInvoiceScan = async (file: File) => {
        setIsScanning(true);
        setScanResult(null);
        try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]);
                };
                reader.readAsDataURL(file);
            });
            const result = await analyzeInvoiceImage(base64, file.type);
            setScanResult(result);
        } catch (error: any) {
            alert(`OCR fehlgeschlagen: ${error.message}`);
        } finally {
            setIsScanning(false);
        }
    };

    // --- RENDER ---

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-aera-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Daten werden geladen...</p>
                </div>
            </div>
        );
    }

    // OVERVIEW (wizardStep === 0)
    if (wizardStep === 0) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-aera-900">{t('billing.title')}</h1>
                        <p className="text-slate-500 mt-1">{t('billing.subtitle')}</p>
                    </div>
                    <button
                        onClick={() => setWizardStep(1)}
                        className="flex items-center gap-2 bg-gradient-to-r from-aera-600 to-amber-600 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-all shadow-lg font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Neue Abrechnung erstellen
                    </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-aera-100 rounded-lg flex items-center justify-center">
                                <FileSpreadsheet className="w-5 h-5 text-aera-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-aera-900">{settlements.length}</p>
                                <p className="text-xs text-slate-500">Abrechnungen erstellt</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-aera-900">{settlements.filter(s => s.status === 'validated').length}</p>
                                <p className="text-xs text-slate-500">KI-validiert</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Send className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-aera-900">{settlements.filter(s => s.status === 'sent').length}</p>
                                <p className="text-xs text-slate-500">Versendet</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Invoice Scanner */}
                <div className="bg-gradient-to-br from-violet-50 to-aera-50 rounded-xl border border-violet-200 p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                            <Camera className="w-6 h-6 text-violet-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1">KI-Rechnungsscanner</h3>
                            <p className="text-sm text-slate-600 mb-3">Laden Sie eine Rechnung hoch — die KI erkennt automatisch Kategorie, Betrag und Zeitraum.</p>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-violet-700 transition-colors">
                                    <Upload className="w-4 h-4" />
                                    {isScanning ? 'Analysiere...' : 'Rechnung scannen'}
                                    <input type="file" accept="image/*,application/pdf" className="hidden"
                                        onChange={e => e.target.files?.[0] && handleInvoiceScan(e.target.files[0])}
                                        disabled={isScanning}
                                    />
                                </label>
                                {isScanning && <Loader2 className="w-5 h-5 animate-spin text-violet-600" />}
                            </div>
                            {scanResult && (
                                <div className="mt-4 bg-white rounded-lg border border-violet-200 p-4">
                                    <p className="text-xs font-bold text-violet-700 mb-2">✅ Erkannte Daten:</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <span className="text-slate-500">Kategorie:</span><span className="font-medium">{scanResult.category}</span>
                                        <span className="text-slate-500">Betrag:</span><span className="font-medium">{formatCurrency(scanResult.amount)}</span>
                                        <span className="text-slate-500">Zeitraum:</span><span className="font-medium">{scanResult.period}</span>
                                        <span className="text-slate-500">Lieferant:</span><span className="font-medium">{scanResult.vendor}</span>
                                        <span className="text-slate-500">Beschreibung:</span><span className="font-medium">{scanResult.description}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Settlement History */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <History className="w-5 h-5 text-aera-600" />
                        <h3 className="font-bold text-slate-900">Bisherige Abrechnungen</h3>
                    </div>
                    {settlements.length === 0 ? (
                        <div className="p-12 text-center">
                            <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-600 mb-1">Noch keine Abrechnungen</h3>
                            <p className="text-sm text-slate-400 mb-6">Erstellen Sie Ihre erste KI-gestützte Nebenkostenabrechnung.</p>
                            <button onClick={() => setWizardStep(1)} className="inline-flex items-center gap-2 bg-aera-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-aera-700 transition-colors">
                                <Plus className="w-4 h-4" /> Neue Abrechnung
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Immobilie</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Jahr</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Gesamtkosten</th>
                                    <th className="text-center px-5 py-3 font-semibold text-slate-600">Mieter</th>
                                    <th className="text-center px-5 py-3 font-semibold text-slate-600">Status</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-600">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {settlements.map(s => (
                                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-5 py-3 font-medium text-slate-900">
                                            {properties.find(p => p.id === s.propertyId)?.name || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">{s.year}</td>
                                        <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(s.totalPropertyCosts)}</td>
                                        <td className="px-5 py-3 text-center text-slate-600">{s.tenantSettlements?.length || 0}</td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.status === 'validated' ? 'bg-emerald-100 text-emerald-700' :
                                                s.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                {s.status === 'validated' ? <><CheckCircle2 className="w-3 h-3" /> Validiert</> :
                                                    s.status === 'sent' ? <><Send className="w-3 h-3" /> Versendet</> :
                                                        <><Clock className="w-3 h-3" /> Entwurf</>}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setViewSettlement(s)} className="p-2 rounded-lg hover:bg-aera-100 text-slate-500 hover:text-aera-700 transition-colors" title="Ansehen">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {s.generatedText && (
                                                    <button onClick={() => {
                                                        const prop = properties.find(p => p.id === s.propertyId);
                                                        downloadTextAsPdf(s.generatedText!, `Nebenkostenabrechnung_${s.year}_${prop?.name || ''}.pdf`, {
                                                            title: 'Nebenkostenabrechnung',
                                                            subtitle: `${prop?.name || ''} — ${s.year}`,
                                                        });
                                                    }} className="p-2 rounded-lg hover:bg-green-100 text-slate-500 hover:text-green-700 transition-colors" title="PDF herunterladen">
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={async () => { if (window.confirm('Abrechnung löschen?')) { await dispatch({ type: 'settlement:delete', id: s.id }); } }}
                                                    className="p-2 rounded-lg hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors" title="Löschen">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* View Settlement Modal */}
                {viewSettlement && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50">
                                <h2 className="text-lg font-bold text-aera-900">
                                    Abrechnung {viewSettlement.year} — {properties.find(p => p.id === viewSettlement.propertyId)?.name}
                                </h2>
                                <button onClick={() => setViewSettlement(null)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-4">
                                {viewSettlement.generatedText && (
                                    <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        {viewSettlement.generatedText}
                                    </div>
                                )}
                                {viewSettlement.aiValidation && (
                                    <div>
                                        <h4 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> KI-Validierung</h4>
                                        <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                                            {viewSettlement.aiValidation}
                                        </div>
                                    </div>
                                )}
                                {viewSettlement.tenantSettlements?.map(ts => (
                                    <div key={ts.tenantId} className="bg-white rounded-lg border border-slate-200 p-4">
                                        <h4 className="font-bold text-slate-900 mb-2">{ts.tenantName}</h4>
                                        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                                            <div><span className="text-slate-500">Fläche:</span> <span className="font-medium">{ts.unitSize} m²</span></div>
                                            <div><span className="text-slate-500">Nutzungstage:</span> <span className="font-medium">{ts.occupancyDays}/{ts.totalDays}</span></div>
                                            <div><span className="text-slate-500">Pro-Rata:</span> <span className="font-medium">{(ts.proRataFactor * 100).toFixed(1)}%</span></div>
                                        </div>
                                        <div className="space-y-1">
                                            {ts.costItems.map(ci => (
                                                <div key={ci.category} className="flex justify-between text-sm">
                                                    <span className="text-slate-600">{ci.category} ({ci.sharePercentage}%)</span>
                                                    <span className="font-medium">{formatCurrency(ci.tenantShare)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Gesamtkosten:</span><span className="font-bold">{formatCurrency(ts.totalCosts)}</span></div>
                                            <div className="flex justify-between text-sm"><span className="text-slate-600">Vorauszahlungen:</span><span className="font-medium text-emerald-600">-{formatCurrency(ts.prepayments)}</span></div>
                                            <div className={`flex justify-between text-sm font-bold ${ts.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                <span>{ts.balance > 0 ? 'Nachzahlung:' : 'Guthaben:'}</span>
                                                <span>{formatCurrency(Math.abs(ts.balance))}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ===== WIZARD STEPS =====
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Wizard Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-aera-900">Nebenkostenabrechnung erstellen</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Schritt {wizardStep} von 5</p>
                </div>
                <button onClick={() => { setWizardStep(0); setGeneratedDoc(''); setValidationResult(''); }}
                    className="text-sm text-slate-500 hover:text-slate-700 transition-colors">← Zurück zur Übersicht</button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-1 bg-white rounded-xl p-2 border border-slate-200 shadow-sm">
                {WIZARD_STEPS.map((step, idx) => {
                    const isActive = wizardStep === step.num;
                    const isDone = wizardStep > step.num;
                    return (
                        <React.Fragment key={step.num}>
                            {idx > 0 && <div className={`flex-1 h-0.5 ${isDone ? 'bg-aera-500' : 'bg-slate-200'}`} />}
                            <button
                                onClick={() => step.num <= wizardStep && setWizardStep(step.num)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${isActive ? 'bg-aera-600 text-white shadow-sm' :
                                    isDone ? 'bg-aera-100 text-aera-700 cursor-pointer' :
                                        'text-slate-400 cursor-default'
                                    }`}
                            >
                                {isDone ? <Check className="w-3.5 h-3.5" /> : <step.icon className="w-3.5 h-3.5" />}
                                <span className="hidden lg:inline">{step.label}</span>
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* ===== STEP 1: Property + Year ===== */}
            {wizardStep === 1 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                    <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-aera-600" /> Immobilie & Abrechnungszeitraum
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">Wählen Sie die Immobilie und das Abrechnungsjahr aus.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Immobilie</label>
                            <select value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none">
                                <option value="">Bitte wählen...</option>
                                {properties.map(p => <option key={p.id} value={p.id}>{p.name} — {p.address}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Abrechnungsjahr</label>
                            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none">
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y =>
                                    <option key={y} value={y}>{y}</option>
                                )}
                            </select>
                        </div>
                    </div>

                    {selectedProperty && (
                        <div className="mt-6 p-4 bg-aera-50 rounded-xl border border-aera-200">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div><span className="text-slate-500">Fläche:</span> <span className="font-medium">{totalPropertySqm} m²</span></div>
                                <div><span className="text-slate-500">Mieter:</span> <span className="font-medium">{propertyTenants.length}</span></div>
                                <div><span className="text-slate-500">Kosteneinträge {selectedYear}:</span> <span className="font-medium">{propertyCosts.length}</span></div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={() => setWizardStep(2)}
                            disabled={!selectedPropertyId || propertyCosts.length === 0}
                            className="flex items-center gap-2 bg-aera-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-aera-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Weiter <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ===== STEP 2: Cost Review ===== */}
            {wizardStep === 2 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-aera-600" /> Kostenübersicht {selectedYear}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">{propertyCosts.length} Kosteneinträge für {selectedProperty?.name}</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-5 py-3 font-semibold text-slate-600">Kategorie</th>
                                <th className="text-right px-5 py-3 font-semibold text-slate-600">Gesamtbetrag</th>
                                <th className="text-right px-5 py-3 font-semibold text-slate-600">Einträge</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(costByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                                <tr key={cat} className="border-b border-slate-100 hover:bg-slate-50/80">
                                    <td className="px-5 py-3 font-medium text-slate-900">{cat}</td>
                                    <td className="px-5 py-3 text-right font-semibold">{formatCurrency(amount)}</td>
                                    <td className="px-5 py-3 text-right text-slate-500">
                                        {propertyCosts.filter(c => c.category === cat).length}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-aera-50 border-t-2 border-aera-200">
                                <td className="px-5 py-3 font-bold text-aera-900">Gesamtkosten</td>
                                <td className="px-5 py-3 text-right font-bold text-aera-900 text-lg">{formatCurrency(totalCosts)}</td>
                                <td className="px-5 py-3 text-right text-slate-500">{propertyCosts.length}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div className="p-6 border-t border-slate-100 flex justify-between">
                        <button onClick={() => setWizardStep(1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium"><ChevronLeft className="w-4 h-4" /> Zurück</button>
                        <button onClick={() => setWizardStep(3)} className="flex items-center gap-2 bg-aera-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-aera-700 transition-colors">
                            Weiter <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ===== STEP 3: Allocation Keys ===== */}
            {wizardStep === 3 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Scale className="w-5 h-5 text-aera-600" /> Umlageschlüssel festlegen
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Bestimmen Sie den Verteilerschlüssel für jede Kostenart gemäß § 556a BGB.</p>
                    </div>
                    <div className="p-6 space-y-3">
                        {Object.keys(costByCategory).map(cat => {
                            const alloc = allocations.find(a => a.category === cat);
                            return (
                                <div key={cat} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <span className="w-48 text-sm font-medium text-slate-900">{cat}</span>
                                    <select
                                        value={alloc?.keyType || 'flaeche'}
                                        onChange={e => {
                                            const keyType = e.target.value as AllocationKeyType;
                                            setAllocations(prev => {
                                                const idx = prev.findIndex(a => a.category === cat);
                                                if (idx >= 0) {
                                                    const copy = [...prev];
                                                    copy[idx] = { ...copy[idx], keyType, label: KEY_TYPE_LABELS[keyType] };
                                                    return copy;
                                                }
                                                return [...prev, { category: cat as CostCategory, keyType, label: KEY_TYPE_LABELS[keyType] }];
                                            });
                                        }}
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                    >
                                        {Object.entries(KEY_TYPE_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                    <span className="text-right text-sm font-semibold text-slate-600 w-28">{formatCurrency(costByCategory[cat])}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-6 border-t border-slate-100 flex justify-between">
                        <button onClick={() => setWizardStep(2)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium"><ChevronLeft className="w-4 h-4" /> Zurück</button>
                        <button onClick={() => { calculateSettlements(); setWizardStep(4); }}
                            className="flex items-center gap-2 bg-aera-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-aera-700 transition-colors">
                            Berechnen & Weiter <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ===== STEP 4: Per-Tenant Calculation ===== */}
            {wizardStep === 4 && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
                            <Users className="w-5 h-5 text-aera-600" /> Mieter-Einzelabrechnungen
                        </h2>
                        <p className="text-sm text-slate-500">{tenantSettlements.length} Mieter für {selectedProperty?.name}</p>
                    </div>

                    {tenantSettlements.map(ts => (
                        <div key={ts.tenantId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-slate-900">{ts.tenantName}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {ts.unitSize} m² · {ts.occupancyDays}/{ts.totalDays} Tage · Pro-Rata: {(ts.proRataFactor * 100).toFixed(1)}%
                                    </p>
                                </div>
                                <div className={`text-right ${ts.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    <p className="text-sm text-slate-500">{ts.balance > 0 ? 'Nachzahlung' : 'Guthaben'}</p>
                                    <p className="text-xl font-bold">{formatCurrency(Math.abs(ts.balance))}</p>
                                </div>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-xs">
                                        <th className="text-left px-5 py-2 font-semibold text-slate-500">Kostenart</th>
                                        <th className="text-right px-5 py-2 font-semibold text-slate-500">Gesamt</th>
                                        <th className="text-center px-5 py-2 font-semibold text-slate-500">Schlüssel</th>
                                        <th className="text-right px-5 py-2 font-semibold text-slate-500">Anteil</th>
                                        <th className="text-right px-5 py-2 font-semibold text-slate-500">Betrag</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ts.costItems.map(ci => (
                                        <tr key={ci.category} className="border-t border-slate-100">
                                            <td className="px-5 py-2 text-slate-700">{ci.category}</td>
                                            <td className="px-5 py-2 text-right text-slate-500">{formatCurrency(ci.totalAmount)}</td>
                                            <td className="px-5 py-2 text-center text-slate-400 text-xs">{KEY_TYPE_LABELS[ci.keyType]?.split('(')[0]}</td>
                                            <td className="px-5 py-2 text-right text-slate-500">{ci.sharePercentage}%</td>
                                            <td className="px-5 py-2 text-right font-medium text-slate-900">{formatCurrency(ci.tenantShare)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-2">
                                <div className="flex justify-between text-sm"><span className="text-slate-600">Gesamtanteil:</span><span className="font-bold">{formatCurrency(ts.totalCosts)}</span></div>
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-slate-600">Vorauszahlungen (geschätzt):</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={prepayments[ts.tenantId] ?? ts.prepayments}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setPrepayments(prev => ({ ...prev, [ts.tenantId]: val }));
                                        }}
                                        onBlur={() => calculateSettlements()}
                                        className="w-32 px-2 py-1 border border-slate-300 rounded-lg text-right text-sm font-medium"
                                    />
                                </div>
                                <div className={`flex justify-between text-sm font-bold pt-2 border-t border-slate-300 ${ts.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    <span>{ts.balance > 0 ? 'Nachzahlung:' : 'Guthaben:'}</span>
                                    <span>{formatCurrency(Math.abs(ts.balance))}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-between pt-2">
                        <button onClick={() => setWizardStep(3)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium"><ChevronLeft className="w-4 h-4" /> Zurück</button>
                        <button onClick={() => setWizardStep(5)}
                            className="flex items-center gap-2 bg-aera-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-aera-700 transition-colors">
                            KI-Prüfung & Dokument <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ===== STEP 5: AI Document + Validation ===== */}
            {wizardStep === 5 && (
                <div className="space-y-5">
                    {/* Action Bar */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-violet-600" /> KI-Dokumenterstellung & Compliance-Prüfung
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            <select value={selectedTenantForDoc} onChange={e => setSelectedTenantForDoc(e.target.value)}
                                className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none">
                                <option value="">Mieter wählen...</option>
                                {tenantSettlements.map(ts => <option key={ts.tenantId} value={ts.tenantId}>{ts.tenantName}</option>)}
                            </select>
                            <button
                                onClick={() => selectedTenantForDoc && handleGenerateDocument(selectedTenantForDoc)}
                                disabled={!selectedTenantForDoc || isGenerating}
                                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-aera-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Erstelle Dokument...</> : <><FileText className="w-4 h-4" /> Abrechnung erstellen</>}
                            </button>
                            {generatedDoc && (
                                <button
                                    onClick={handleValidate}
                                    disabled={isValidating}
                                    className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isValidating ? <><Loader2 className="w-4 h-4 animate-spin" /> Prüfe...</> : <><ShieldCheck className="w-4 h-4" /> Compliance prüfen</>}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Generated Document */}
                    {generatedDoc && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-aera-50 to-amber-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="w-5 h-5 text-aera-600" />
                                    <h3 className="font-bold text-aera-900">Nebenkostenabrechnung</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
                                            const url = previewTextAsPdf(generatedDoc, {
                                                title: 'Nebenkostenabrechnung',
                                                subtitle: `${selectedProperty?.name || ''} — ${selectedYear} — ${tenantSettlements.find(t => t.tenantId === selectedTenantForDoc)?.tenantName || ''}`,
                                            });
                                            setPdfBlobUrl(url);
                                            setShowPdfPreview(true);
                                        }}
                                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        <Eye className="w-4 h-4" /> PDF Vorschau
                                    </button>
                                    <button
                                        onClick={() => {
                                            const tenantName = tenantSettlements.find(t => t.tenantId === selectedTenantForDoc)?.tenantName || '';
                                            downloadTextAsPdf(generatedDoc, `Nebenkostenabrechnung_${selectedYear}_${tenantName}.pdf`, {
                                                title: 'Nebenkostenabrechnung',
                                                subtitle: `${selectedProperty?.name || ''} — ${selectedYear} — ${tenantName}`,
                                            });
                                        }}
                                        className="flex items-center gap-1.5 text-sm text-aera-600 hover:text-aera-700 font-medium"
                                    >
                                        <Download className="w-4 h-4" /> PDF Download
                                    </button>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed font-mono bg-slate-50 rounded-lg p-6 border border-slate-200 max-h-[500px] overflow-y-auto">
                                    {generatedDoc}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Validation Result */}
                    {validationResult && (
                        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4 border-b border-emerald-200">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                    <h3 className="font-bold text-emerald-900">KI-Compliance-Prüfung</h3>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                                    {validationResult}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Actions */}
                    <div className="flex justify-between pt-2">
                        <button onClick={() => setWizardStep(4)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
                            <ChevronLeft className="w-4 h-4" /> Zurück
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveSettlement}
                                disabled={isSaving || tenantSettlements.length === 0}
                                className="flex items-center gap-2 bg-aera-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-aera-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichere...</> : <><Check className="w-4 h-4" /> Abrechnung speichern</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL: PDF PREVIEW ===== */}
            {showPdfPreview && pdfBlobUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-aera-600" /> PDF Vorschau
                            </h2>
                            <button onClick={() => { setShowPdfPreview(false); if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-200 p-0">
                            <iframe src={pdfBlobUrl} className="w-full h-full border-0" title="PDF Vorschau" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Nebenkostenabrechnung;
