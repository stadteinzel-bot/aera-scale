
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Euro, Users, AlertCircle, Percent, Megaphone, Wrench, ChevronRight, BrainCircuit, X, AlertTriangle, Shield, TrendingUp, ShieldAlert } from 'lucide-react';
import { REVENUE_DATA } from '../constants';
import { generateExecutiveBriefing, generateScenarioSimulation, ScenarioResult } from '../services/geminiService';
import { computePortfolioKPIs } from '../services/rentEngine';
import { validate } from '../services/rentValidator';
import { useDataCore } from '../core/DataCoreProvider';
import { computePropertyRisk, computeTenantRisk, computePortfolioRisk } from '../core/riskEngine';
import { generateCashflowForecast, summarizeForecast } from '../core/cashflowEngine';
import { useTranslation } from '../core/i18nProvider';

interface FeedItem {
  id: string;
  type: 'Maintenance' | 'Announcement';
  title: string;
  rawContent: string;
  date: string;
  priority?: string;
  status?: string;
}

const Dashboard: React.FC<{ onSelectAsset?: (propertyId: string) => void }> = ({ onSelectAsset }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [briefingCache, setBriefingCache] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationPrompt, setSimulationPrompt] = useState('');
  const [isProcessingSim, setIsProcessingSim] = useState(false);
  const [simulationResult, setSimulationResult] = useState<ScenarioResult | null>(null);

  // === DATA CORE: Single source of truth for ALL data ===
  const { data, kpis: dcKpis, isLoading } = useDataCore();
  const { t: tr } = useTranslation();
  const { properties, tenants, tickets, contracts, lineItems, invoices, payments, messages: allMessages } = data;

  // Validation (computed from DataCore data)
  const validationReport = useMemo(() => {
    if (contracts.length === 0) return null;
    const now = new Date();
    const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return validate(contracts, lineItems, targetMonth);
  }, [contracts, lineItems]);

  // Risk & Forecast (computed from DataCore data)
  const portfolioRisk = useMemo(() => computePortfolioRisk(data), [data]);
  const propertyRisks = useMemo(() => computePropertyRisk(data), [data]);
  const tenantRisks = useMemo(() => computeTenantRisk(data), [data]);
  const cashflowForecast = useMemo(() => generateCashflowForecast(data), [data]);
  const forecastSummary = useMemo(() => summarizeForecast(cashflowForecast), [cashflowForecast]);

  // --- AERA SCALE KPI Computation ---
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const hasContracts = contracts.length > 0;

  const engineKPIs = hasContracts
    ? computePortfolioKPIs(
      contracts,
      lineItems,
      properties.map(p => ({ id: p.id, name: p.name })),
      currentMonth
    )
    : null;

  // Use KPIs from DataCore (centrally computed)
  const totalMonthlyRent = engineKPIs?.mrr ?? dcKpis.mrrTotal;

  const hasValidationErrors = validationReport && !validationReport.isClean;
  const isProvisional = hasValidationErrors && validationReport!.errorCount > 0;

  const kpiCards = [
    {
      title: tr('dashboard.monthlyRevenue'),
      value: isProvisional ? '—' : (totalMonthlyRent >= 1000 ? `€${(totalMonthlyRent / 1000).toFixed(1)}k` : `€${totalMonthlyRent.toLocaleString('de-DE')}`),
      change: hasContracts ? `${contracts.filter(c => c.status === 'active').length} ${tr('common.status')}` : `${tenants.length} ${tr('common.tenant')}`,
      trend: 'up' as const,
      icon: Euro,
      color: 'aera',
      provisional: isProvisional,
    },
    {
      title: tr('dashboard.occupancyRate'),
      value: `${dcKpis.occupancyRate}%`,
      change: `${dcKpis.occupiedUnits}/${dcKpis.totalUnits} ${tr('common.unit')}`,
      trend: dcKpis.occupancyRate >= 80 ? 'up' as const : 'down' as const,
      icon: Users,
      color: 'aera',
    },
    {
      title: tr('dashboard.activeTickets'),
      value: dcKpis.activeTickets.toString(),
      change: `${dcKpis.criticalTickets} ${tr('dashboard.riskLevel.critical')}`,
      trend: dcKpis.activeTickets > 3 ? 'up' as const : 'down' as const,
      icon: AlertCircle,
      color: 'gold',
    },
    {
      title: tr('dashboard.portfolioRisk'),
      value: `${portfolioRisk}/100`,
      change: portfolioRisk < 25 ? tr('dashboard.riskLevel.low') : portfolioRisk < 50 ? tr('dashboard.riskLevel.medium') : portfolioRisk < 75 ? tr('dashboard.riskLevel.high') : tr('dashboard.riskLevel.critical'),
      trend: portfolioRisk < 50 ? 'down' as const : 'up' as const,
      icon: ShieldAlert,
      color: portfolioRisk < 50 ? 'emerald' : 'gold',
    }
  ];

  const handleExpand = async (item: FeedItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);

    // If not cached, generate with AI
    if (!briefingCache[item.id]) {
      setLoadingId(item.id);
      const briefing = await generateExecutiveBriefing(item.title, item.rawContent, item.type);
      setBriefingCache(prev => ({ ...prev, [item.id]: briefing }));
      setLoadingId(null);
    }
  };

  const [simulationError, setSimulationError] = useState<string | null>(null);

  const runSimulation = async () => {
    if (!simulationPrompt.trim()) return;
    setIsProcessingSim(true);
    setSimulationError(null);

    const result = await generateScenarioSimulation(chartData, simulationPrompt);

    if (!result) {
      setSimulationError("AI Service Unavailable. Please check your API Key in .env.local");
    } else {
      setSimulationResult(result);
    }

    setIsProcessingSim(false);
  };

  const closeSimulation = () => {
    setIsSimulating(false);
    setSimulationResult(null);
    setSimulationPrompt('');
  };

  // Merge Actual Data with Simulated Data for Chart
  // Build chart data from actual monthly rents — if REVENUE_DATA is empty, generate from current month
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const baseChartData = REVENUE_DATA.length > 0
    ? REVENUE_DATA
    : months.slice(0, new Date().getMonth() + 1).map((m) => ({
      month: m,
      revenue: totalMonthlyRent,
      expenses: 0,
    }));
  const chartData = baseChartData.map((item, index) => ({
    ...item,
    simulatedRevenue: simulationResult?.simulatedData[index]?.revenue || null
  }));

  // Combine Tickets and Messages into one feed
  const feedItems: FeedItem[] = [
    ...tickets.map(t => ({
      id: t.id,
      type: 'Maintenance' as const,
      title: t.title,
      rawContent: t.description,
      date: t.dateCreated,
      priority: t.priority,
      status: t.status
    })),
    ...allMessages.filter(m => m.receiverId === 'all').map(m => ({
      id: m.id,
      type: 'Announcement' as const,
      title: 'General Announcement',
      rawContent: m.content,
      date: m.timestamp.split(' ')[0],
      status: 'Published'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">

      {/* VALIDATION WARNING BANNER */}
      {hasValidationErrors && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${validationReport!.errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${validationReport!.errorCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
          <div className="flex-1">
            <p className={`font-semibold text-sm ${validationReport!.errorCount > 0 ? 'text-red-800' : 'text-amber-800'}`}>
              Berechnung geprüft: {validationReport!.totalIssues} Abweichung{validationReport!.totalIssues !== 1 ? 'en' : ''} erkannt
            </p>
            <p className="text-xs mt-0.5 text-[#4A6358]">
              {validationReport!.errorCount} Fehler, {validationReport!.warningCount} Warnungen — Monat: {currentMonth}
            </p>
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); }}
            className="text-xs font-medium text-forest hover:text-forest-dark flex items-center gap-1 shrink-0">
            <Shield className="w-3.5 h-3.5" /> Reconciliation Report
          </a>
        </div>
      )}
      <div className="flex justify-between items-end">
        <div>
          <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }} className="text-3xl font-bold text-[#1A2E25]">{tr('dashboard.title')}</h1>
          <p className="text-[#7A9589] mt-1 text-sm">{tr('dashboard.kpi')}</p>
        </div>
        <div className="flex gap-3">
          {!isSimulating ? (
            <button
              onClick={() => setIsSimulating(true)}
              className="btn-gold px-5 py-2 rounded-xl text-sm font-semibold shadow-medium transition-all flex items-center gap-2"
              style={{ width: 'auto' }}
            >
              <BrainCircuit className="w-4 h-4" />
              Decision Intelligence
            </button>
          ) : (
            <button
              onClick={closeSimulation}
              className="bg-cream-dark hover:bg-cream-deeper text-[#4A6358] px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 border border-cream-deeper"
            >
              <X className="w-4 h-4" />
              Exit Simulation
            </button>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map((kpi, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-cream-deeper shadow-soft hover:shadow-medium hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden">
            {/* Gold top accent */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold to-transparent" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 rounded-xl bg-cream-dark">
                <kpi.icon className="w-5 h-5 text-forest" />
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                kpi.trend === 'up' ? 'text-[#3D7A5A]' : 'text-[#C94A3A]'
              }`}>
                <span>{kpi.change}</span>
                {kpi.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              </div>
            </div>
            <p className="text-[#7A9589] text-xs font-semibold uppercase tracking-wider mb-1">{kpi.title}</p>
            <p className="text-2xl font-bold text-[#1A2E25] mt-1" style={{ fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.02em' }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Chart Section */}
        <div className={`lg:col-span-2 bg-white p-6 rounded-2xl border shadow-soft transition-all duration-500 ${isSimulating ? 'border-gold/30 shadow-gold-focus ring-4 ring-gold/10' : 'border-cream-deeper'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-[#1A2E25]" style={{ fontFamily: '"Cormorant Garamond", serif' }}>{tr('dashboard.revenueOverTime')}</h3>
            {isSimulating && (
              <div className="px-3 py-1 bg-gold/10 text-gold-dark rounded-full text-xs font-bold animate-pulse border border-gold/20">
                What-If Mode
              </div>
            )}
          </div>

          {/* SIMULATION INPUT INTERFACE */}
          {isSimulating && (
            <div className="mb-6 bg-cream p-4 rounded-xl border border-gold/20 animate-in slide-in-from-top-4">
              <label className="text-xs font-bold text-forest uppercase tracking-wider mb-2 block">
                AERA SCALE — Decision Engine
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={simulationPrompt}
                  onChange={(e) => setSimulationPrompt(e.target.value)}
                  placeholder='Szenario eingeben… z.B. "Was wenn Mieter X auszieht?"'
                  className="input-field flex-1 text-sm"
                  style={{ padding: '10px 14px' }}
                  onKeyDown={(e) => e.key === 'Enter' && runSimulation()}
                />
                <button
                  onClick={runSimulation}
                  disabled={isProcessingSim || !simulationPrompt}
                  className="btn-gold text-sm px-4 py-2 disabled:opacity-50"
                  style={{ width: 'auto', borderRadius: '10px' }}
                >
                  {isProcessingSim ? 'Berechne…' : 'Simulieren'}
                </button>
              </div>
              {simulationResult && (
                <div className="mt-4 p-3 bg-white rounded-xl border-l-4 border-gold text-sm text-[#4A6358] shadow-soft animate-in fade-in">
                  <span className="font-bold text-[#1A2E25] block mb-1">KI-Projektions-Analyse:</span>
                  {simulationResult.analysis}
                </div>
              )}
              {simulationError && (
                <div className="mt-4 p-3 bg-red-50 rounded-xl border-l-4 border-red-500 text-sm text-red-700 shadow-soft animate-in fade-in flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {simulationError}
                </div>
              )}
            </div>
          )}

          <div className="h-80 w-full relative">
            {isProcessingSim && (
              <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <BrainCircuit className="w-8 h-8 text-indigo-600 animate-pulse mb-2" />
                  <span className="text-xs font-bold text-indigo-800">Calculating Futures...</span>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#103728" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#103728" stopOpacity={0} />
                  </linearGradient>
                  {/* Simulation Gradient */}
                  <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `€${value / 1000}k`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                {/* Actual Revenue - Fades out slightly during simulation to highlight the projection */}
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Actual Revenue"
                  stroke="#103728"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  opacity={simulationResult ? 0.4 : 1}
                />

                {/* Simulated Revenue Shadow Layer */}
                {simulationResult && (
                  <Area
                    type="monotone"
                    dataKey="simulatedRevenue"
                    name="Projected Scenario"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorSim)"
                    animationDuration={1500}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Intelligent Operations Feed */}
        <div className="bg-white p-0 rounded-2xl border border-cream-deeper shadow-soft flex flex-col overflow-hidden">
          <div className="p-5 border-b border-cream-deeper geo-pattern">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Aktivitäten</h3>
                <p className="text-xs text-white/50 mt-1">KI-gestützte Updates & Alerts</p>
              </div>
              <BrainCircuit className="w-5 h-5 text-gold" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-cream p-4 space-y-3">
            {feedItems.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${expandedId === item.id ? 'border-gold/40 shadow-medium ring-1 ring-gold/15' : 'border-cream-deeper hover:border-gold/30 shadow-soft'}`}
              >
                {/* Card Header */}
                <div
                  onClick={() => handleExpand(item)}
                  className="p-4 cursor-pointer flex items-start gap-3"
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type === 'Maintenance'
                    ? (item.priority === 'Emergency' ? 'bg-red-100 text-red-600' : 'bg-amber-50 text-amber-600')
                    : 'bg-cream-dark text-forest'
                    }`}>
                    {item.type === 'Maintenance' ? <Wrench className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={`text-sm font-semibold truncate pr-2 ${expandedId === item.id ? 'text-[#1A2E25]' : 'text-[#1A2E25]'}`}>
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-[#7A9589] whitespace-nowrap">{item.date}</span>
                    </div>

                    {expandedId !== item.id && (
                      <p className="text-xs text-[#7A9589] line-clamp-1 mt-1">
                        {item.rawContent}
                      </p>
                    )}

                    <div className="flex items-center mt-2 space-x-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                        item.type === 'Maintenance' ? 'bg-cream-dark text-[#4A6358]' : 'bg-cream-dark text-forest'
                      }`}>
                        {item.type}
                      </span>
                      {item.priority && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.priority === 'Emergency' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                          {item.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`} />
                </div>

                {/* Expanded Content (AI Briefing) */}
                {expandedId === item.id && (
                  <div className="bg-cream p-4 border-t border-cream-deeper animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center space-x-2 mb-2">
                      <BrainCircuit className="w-3 h-3 text-gold" />
                      <span className="text-[10px] font-bold text-[#1A2E25] uppercase tracking-widest">Executive Briefing</span>
                    </div>

                    {loadingId === item.id ? (
                      <div className="flex items-center space-x-2 text-xs text-[#7A9589] py-2">
                        <div className="w-2 h-2 bg-gold rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gold rounded-full animate-bounce delay-75" />
                        <div className="w-2 h-2 bg-gold rounded-full animate-bounce delay-150" />
                        <span>KI-Briefing wird erstellt…</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <p className="text-sm text-[#4A6358] leading-relaxed">
                          {briefingCache[item.id]}
                        </p>
                        <div className="mt-3 flex justify-end">
                          <button className="text-xs text-forest hover:text-forest-dark font-semibold underline decoration-dotted">
                            Details ansehen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button className="w-full py-3 border border-dashed border-cream-deeper rounded-xl text-xs text-[#7A9589] hover:bg-cream-dark hover:text-forest transition-colors font-semibold">
              Gesamten Verlauf anzeigen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
