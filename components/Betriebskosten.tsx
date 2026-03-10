import React, { useState, useMemo } from 'react';
import { Property, OperatingCostEntry, CostCategory } from '../types';
import { dataService } from '../services/dataService';
import { analyzeOperatingCosts } from '../services/geminiService';
import { useDataCore } from '../core/DataCoreProvider';
import { useTranslation } from '../core/i18nProvider';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    Wallet, Plus, Trash2, X, Search, Building2, Sparkles, Loader2,
    TrendingDown, TrendingUp, Calculator, Flame, Droplets, Zap,
    Trash, ShieldCheck, MapPin, ArrowUpDown, Receipt, PiggyBank, BarChart3, Filter
} from 'lucide-react';

const COST_CATEGORIES: CostCategory[] = [
    'Heizung', 'Wasser', 'Strom', 'Müllabfuhr', 'Hausmeister',
    'Gebäudeversicherung', 'Grundsteuer', 'Aufzug', 'Gartenpflege',
    'Reinigung', 'Schornsteinfeger', 'Allgemeinstrom', 'Sonstige'
];

const categoryColors: Record<string, string> = {
    'Heizung': '#ef4444',
    'Wasser': '#3b82f6',
    'Strom': '#f59e0b',
    'Müllabfuhr': '#10b981',
    'Hausmeister': '#8b5cf6',
    'Gebäudeversicherung': '#06b6d4',
    'Grundsteuer': '#ec4899',
    'Aufzug': '#6366f1',
    'Gartenpflege': '#22c55e',
    'Reinigung': '#14b8a6',
    'Schornsteinfeger': '#78716c',
    'Allgemeinstrom': '#d97706',
    'Sonstige': '#94a3b8',
};

const categoryIcons: Record<string, React.ReactNode> = {
    'Heizung': <Flame className="w-4 h-4" />,
    'Wasser': <Droplets className="w-4 h-4" />,
    'Strom': <Zap className="w-4 h-4" />,
    'Müllabfuhr': <Trash className="w-4 h-4" />,
    'Hausmeister': <ShieldCheck className="w-4 h-4" />,
    'Gebäudeversicherung': <ShieldCheck className="w-4 h-4" />,
    'Grundsteuer': <MapPin className="w-4 h-4" />,
    'Aufzug': <ArrowUpDown className="w-4 h-4" />,
    'Gartenpflege': <MapPin className="w-4 h-4" />,
    'Reinigung': <Droplets className="w-4 h-4" />,
    'Schornsteinfeger': <Flame className="w-4 h-4" />,
    'Allgemeinstrom': <Zap className="w-4 h-4" />,
    'Sonstige': <Receipt className="w-4 h-4" />,
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const Betriebskosten: React.FC<{ propertyId?: string }> = ({ propertyId }) => {
    // === DATA CORE ===
    const { data, dispatch, isLoading } = useDataCore();
    const { t } = useTranslation();
    const entries = propertyId ? data.costs.filter(c => c.propertyId === propertyId) : data.costs;
    const properties = data.properties;
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProperty, setFilterProperty] = useState('');
    const [filterCategory, setFilterCategory] = useState<CostCategory | ''>('');
    const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

    // Add Cost Modal
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addData, setAddData] = useState<{
        propertyId: string; category: CostCategory; amount: string;
        period: string; description: string; invoiceRef: string;
    }>({
        propertyId: '', category: 'Heizung', amount: '',
        period: new Date().toISOString().slice(0, 7), description: '', invoiceRef: ''
    });
    const [isAdding, setIsAdding] = useState(false);

    // AI Analysis
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProperty, setAnalysisProperty] = useState('');

    // Active Tab
    const [activeTab, setActiveTab] = useState<'overview' | 'entries' | 'analysis'>('overview');

    const getPropertyName = (id: string) => properties.find(p => p.id === id)?.name || '—';
    const getPropertySize = (id: string) => {
        const p = properties.find(p => p.id === id);
        return p ? Math.round(p.sizeSqFt * 0.0929) : 0; // sqft to sqm
    };

    // --- Filtered & computed data ---

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            if (filterProperty && e.propertyId !== filterProperty) return false;
            if (filterCategory && e.category !== filterCategory) return false;
            if (filterYear && e.year !== filterYear) return false;
            if (searchTerm && !e.category.toLowerCase().includes(searchTerm.toLowerCase())
                && !(e.description || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        }).sort((a, b) => b.period.localeCompare(a.period));
    }, [entries, filterProperty, filterCategory, filterYear, searchTerm]);

    const totalCosts = useMemo(() => filteredEntries.reduce((sum, e) => sum + e.amount, 0), [filteredEntries]);

    const categoryBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        filteredEntries.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
        return Object.entries(map)
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
            .sort((a, b) => b.value - a.value);
    }, [filteredEntries]);

    const monthlyTrend = useMemo(() => {
        const map: Record<string, number> = {};
        filteredEntries.forEach(e => {
            const month = e.period.slice(5, 7);
            map[month] = (map[month] || 0) + e.amount;
        });
        return Array.from({ length: 12 }, (_, i) => {
            const key = String(i + 1).padStart(2, '0');
            return { month: MONTHS_DE[i], kosten: Math.round((map[key] || 0) * 100) / 100 };
        });
    }, [filteredEntries]);

    const avgCostPerSqm = useMemo(() => {
        if (!filterProperty) {
            const totalSize = properties.reduce((sum, p) => sum + Math.round(p.sizeSqFt * 0.0929), 0);
            return totalSize > 0 ? totalCosts / totalSize : 0;
        }
        const size = getPropertySize(filterProperty);
        return size > 0 ? totalCosts / size : 0;
    }, [totalCosts, filterProperty, properties]);

    const years = useMemo(() => {
        const s = new Set(entries.map(e => e.year));
        s.add(new Date().getFullYear());
        return Array.from(s).sort((a, b) => b - a);
    }, [entries]);

    // --- Handlers ---

    const handleAddCost = async () => {
        if (!addData.propertyId || !addData.amount || !addData.period) return;
        setIsAdding(true);
        try {
            await dispatch({
                type: 'cost:add', payload: {
                    propertyId: addData.propertyId,
                    category: addData.category,
                    amount: parseFloat(addData.amount),
                    period: addData.period,
                    year: parseInt(addData.period.slice(0, 4)),
                    description: addData.description || '',
                    invoiceRef: addData.invoiceRef || '',
                    createdAt: new Date().toISOString(),
                }
            });
            setIsAddOpen(false);
            setAddData({ propertyId: '', category: 'Heizung', amount: '', period: new Date().toISOString().slice(0, 7), description: '', invoiceRef: '' });
        } catch (error: any) {
            alert(`Fehler: ${error.message}`);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteEntry = async (entry: OperatingCostEntry) => {
        if (!window.confirm(`Eintrag "${entry.category} - ${formatCurrency(entry.amount)}" löschen?`)) return;
        try {
            await dispatch({ type: 'cost:delete', id: entry.id });
        } catch (error: any) {
            alert(`Löschen fehlgeschlagen: ${error.message}`);
        }
    };

    const handleAIAnalyze = async () => {
        const targetPropertyId = analysisProperty || filterProperty;
        if (!targetPropertyId) {
            alert('Bitte wählen Sie eine Immobilie aus.');
            return;
        }
        const prop = properties.find(p => p.id === targetPropertyId);
        if (!prop) return;

        const relevantEntries = entries.filter(e => e.propertyId === targetPropertyId && e.year === filterYear);
        if (relevantEntries.length === 0) {
            alert('Keine Kosteneinträge für diese Immobilie/Jahr gefunden.');
            return;
        }

        setIsAnalyzing(true);
        try {
            const sizeSqm = Math.round(prop.sizeSqFt * 0.0929);
            const costData = relevantEntries.map(e => ({
                category: e.category,
                amount: e.amount,
                period: e.period,
            }));
            const result = await analyzeOperatingCosts(prop.name, sizeSqm, costData);
            setAiAnalysis(result);
            setActiveTab('analysis');
        } catch (error: any) {
            alert(`KI-Analyse fehlgeschlagen: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- RENDER ---

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-aera-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Betriebskosten werden geladen...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-aera-900">{t('costs.title')}</h1>
                    <p className="text-slate-500 mt-1">{t('costs.subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleAIAnalyze}
                        disabled={isAnalyzing || (!filterProperty && !analysisProperty)}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-aera-600 text-white px-5 py-2.5 rounded-xl hover:opacity-90 transition-all shadow-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysiere...</> : <><Sparkles className="w-4 h-4" /> KI-Analyse</>}
                    </button>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="flex items-center gap-2 bg-aera-600 text-white px-5 py-2.5 rounded-xl hover:bg-aera-700 transition-colors shadow-lg shadow-aera-600/20 font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Kosten erfassen
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-aera-100 rounded-lg flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-aera-600" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-aera-900">{formatCurrency(totalCosts)}</p>
                            <p className="text-xs text-slate-500">Gesamtkosten {filterYear}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Calculator className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-aera-900">{formatCurrency(avgCostPerSqm)}</p>
                            <p className="text-xs text-slate-500">Kosten / m² p.a.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-aera-900">{filteredEntries.length}</p>
                            <p className="text-xs text-slate-500">Einträge</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <PiggyBank className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-aera-900">{formatCurrency(totalCosts / 12)}</p>
                            <p className="text-xs text-slate-500">Ø Monatlich</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <select
                    value={filterProperty}
                    onChange={e => { setFilterProperty(e.target.value); setAnalysisProperty(e.target.value); }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                >
                    <option value="">Alle Immobilien</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value as CostCategory | '')}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                >
                    <option value="">Alle Kategorien</option>
                    {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                    value={filterYear}
                    onChange={e => setFilterYear(parseInt(e.target.value))}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none transition-all"
                        placeholder="Suchen..."
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {([
                    { key: 'overview' as const, label: 'Übersicht', icon: <BarChart3 className="w-4 h-4" /> },
                    { key: 'entries' as const, label: 'Einträge', icon: <Receipt className="w-4 h-4" /> },
                    { key: 'analysis' as const, label: 'KI-Analyse', icon: <Sparkles className="w-4 h-4" /> },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                            ? 'bg-white text-aera-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ===== TAB: OVERVIEW ===== */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Monthly Trend Chart */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-aera-600" />
                            Monatlicher Kostenverlauf {filterYear}
                        </h3>
                        {monthlyTrend.some(m => m.kosten > 0) ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="month" fontSize={11} tick={{ fill: '#64748b' }} />
                                    <YAxis fontSize={11} tick={{ fill: '#64748b' }} tickFormatter={v => `${v}€`} />
                                    <Tooltip
                                        formatter={(v: number) => [formatCurrency(v), 'Kosten']}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                    />
                                    <Bar dataKey="kosten" fill="#c4a46a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
                                Keine Daten für {filterYear}
                            </div>
                        )}
                    </div>

                    {/* Category Pie Chart */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <PiggyBank className="w-4 h-4 text-emerald-600" />
                            Kostenverteilung nach Kategorie
                        </h3>
                        {categoryBreakdown.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={categoryBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={90}
                                        innerRadius={55}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        labelLine={{ strokeWidth: 1 }}
                                    >
                                        {categoryBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={categoryColors[entry.name] || '#94a3b8'} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Betrag']} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
                                Keine Daten vorhanden
                            </div>
                        )}
                    </div>

                    {/* Top Cost Categories */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            Größte Kostentreiber
                        </h3>
                        {categoryBreakdown.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {categoryBreakdown.slice(0, 8).map((cat, idx) => (
                                    <div key={cat.name} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: `${categoryColors[cat.name]}20`, color: categoryColors[cat.name] }}
                                        >
                                            {categoryIcons[cat.name] || <Receipt className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-500 truncate">{cat.name}</p>
                                            <p className="text-sm font-bold text-slate-900">{formatCurrency(cat.value)}</p>
                                            <p className="text-[10px] text-slate-400">{totalCosts > 0 ? ((cat.value / totalCosts) * 100).toFixed(1) : 0}% Anteil</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-10 text-center text-slate-400 text-sm">
                                <Wallet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                Keine Kostendaten. Erfassen Sie Ihre ersten Betriebskosten.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ===== TAB: ENTRIES ===== */}
            {activeTab === 'entries' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {filteredEntries.length === 0 ? (
                        <div className="py-20 text-center">
                            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-600 mb-1">Keine Einträge</h3>
                            <p className="text-sm text-slate-400 mb-6">
                                {entries.length === 0 ? 'Erfassen Sie Ihre ersten Betriebskosten.' : 'Keine Einträge für diese Filter.'}
                            </p>
                            {entries.length === 0 && (
                                <button onClick={() => setIsAddOpen(true)} className="inline-flex items-center gap-2 bg-aera-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-aera-700 transition-colors">
                                    <Plus className="w-4 h-4" /> Ersten Eintrag erfassen
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Kategorie</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Immobilie</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Zeitraum</th>
                                    <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Betrag</th>
                                    <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Beschreibung</th>
                                    <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: `${categoryColors[entry.category]}15`, color: categoryColors[entry.category] }}
                                                >
                                                    {categoryIcons[entry.category] || <Receipt className="w-4 h-4" />}
                                                </div>
                                                <span className="font-medium text-slate-900">{entry.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{getPropertyName(entry.propertyId)}</td>
                                        <td className="px-5 py-3.5 text-slate-600">
                                            {MONTHS_DE[parseInt(entry.period.slice(5, 7)) - 1]} {entry.period.slice(0, 4)}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(entry.amount)}</td>
                                        <td className="px-5 py-3.5 text-slate-500 text-xs max-w-[200px] truncate">{entry.description || '—'}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleDeleteEntry(entry)}
                                                    className="p-2 rounded-lg hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors"
                                                    title="Löschen"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 border-t-2 border-slate-200">
                                    <td colSpan={3} className="px-5 py-3.5 font-bold text-slate-700">Summe</td>
                                    <td className="px-5 py-3.5 text-right font-bold text-aera-900 text-base">{formatCurrency(totalCosts)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            )}

            {/* ===== TAB: KI-ANALYSE ===== */}
            {activeTab === 'analysis' && (
                <div className="space-y-5">
                    {/* Property Selector for Analysis */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-aera-100 rounded-lg flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-violet-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">KI-Kostenanalyse</h3>
                                    <p className="text-xs text-slate-500">Wählen Sie eine Immobilie und starten Sie die Analyse</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={analysisProperty || filterProperty}
                                    onChange={e => setAnalysisProperty(e.target.value)}
                                    className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none"
                                >
                                    <option value="">Immobilie wählen...</option>
                                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <button
                                    onClick={handleAIAnalyze}
                                    disabled={isAnalyzing || (!filterProperty && !analysisProperty)}
                                    className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-aera-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysiere...</> : <><Sparkles className="w-4 h-4" /> Analyse starten</>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Analysis Result */}
                    {aiAnalysis ? (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-violet-50 via-aera-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-violet-600" />
                                    <h3 className="font-bold text-aera-900">KI-Analyse Ergebnis</h3>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Analyse basierend auf {filteredEntries.length} Einträgen für {filterYear}</p>
                            </div>
                            <div className="p-6">
                                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                                    {aiAnalysis}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-violet-100 to-aera-100 rounded-2xl flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-violet-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-1">Noch keine Analyse durchgeführt</h3>
                            <p className="text-sm text-slate-400 max-w-md mx-auto">
                                Wählen Sie eine Immobilie aus und klicken Sie auf „KI-Analyse", um Ihre Betriebskosten zu analysieren und Optimierungspotenziale zu erkennen.
                            </p>
                        </div>
                    )}

                    {/* Benchmark Info */}
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200 p-5">
                        <h4 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" />
                            Deutscher Durchschnitt (Betriebskostenspiegel)
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Warmkosten gesamt', value: '~2,88 €/m²/Monat' },
                                { label: 'Heizung & Warmwasser', value: '~1,07 €/m²/Monat' },
                                { label: 'Grundsteuer', value: '~0,19 €/m²/Monat' },
                                { label: 'Wasser/Abwasser', value: '~0,35 €/m²/Monat' },
                            ].map(item => (
                                <div key={item.label} className="bg-white/60 rounded-lg p-3 backdrop-blur-sm">
                                    <p className="text-xs text-emerald-600 font-medium">{item.label}</p>
                                    <p className="text-sm font-bold text-emerald-900 mt-0.5">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ADD COST MODAL */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-aera-100">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-aera-50">
                            <h2 className="text-xl font-bold text-aera-900">Betriebskosten erfassen</h2>
                            <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Immobilie *</label>
                                    <select value={addData.propertyId} onChange={e => setAddData(prev => ({ ...prev, propertyId: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white text-sm">
                                        <option value="">Auswählen...</option>
                                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Kategorie *</label>
                                    <select value={addData.category} onChange={e => setAddData(prev => ({ ...prev, category: e.target.value as CostCategory }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none bg-white text-sm">
                                        {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Betrag (€) *</label>
                                    <input type="number" step="0.01" min="0" value={addData.amount}
                                        onChange={e => setAddData(prev => ({ ...prev, amount: e.target.value }))}
                                        placeholder="z.B. 245.50"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Zeitraum *</label>
                                    <input type="month" value={addData.period}
                                        onChange={e => setAddData(prev => ({ ...prev, period: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Rechnungsnr.</label>
                                    <input type="text" value={addData.invoiceRef}
                                        onChange={e => setAddData(prev => ({ ...prev, invoiceRef: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Beschreibung</label>
                                    <input type="text" value={addData.description}
                                        onChange={e => setAddData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Optionale Beschreibung..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-aera-600/20 focus:border-aera-600 outline-none text-sm" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setIsAddOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Abbrechen</button>
                            <button
                                onClick={handleAddCost}
                                disabled={!addData.propertyId || !addData.amount || !addData.period || isAdding}
                                className="flex items-center gap-2 bg-aera-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-aera-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAdding ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichern...</> : <><Plus className="w-4 h-4" /> Erfassen</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Betriebskosten;
