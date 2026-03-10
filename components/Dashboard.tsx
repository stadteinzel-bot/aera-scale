
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
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${validationReport!.errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${validationReport!.errorCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
          <div className="flex-1">
            <p className={`font-semibold text-sm ${validationReport!.errorCount > 0 ? 'text-red-800' : 'text-amber-800'}`}>
              Berechnung geprüft: {validationReport!.totalIssues} Abweichung{validationReport!.totalIssues !== 1 ? 'en' : ''} erkannt
            </p>
            <p className="text-xs mt-0.5 text-slate-600">
              {validationReport!.errorCount} Fehler, {validationReport!.warningCount} Warnungen — Monat: {currentMonth}
            </p>
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); /* Navigate to reconciliation via parent if needed */ }}
            className="text-xs font-medium text-aera-700 hover:text-aera-900 flex items-center gap-1 shrink-0">
            <Shield className="w-3.5 h-3.5" /> Reconciliation Report
          </a>
        </div>
      )}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-aera-900">{tr('dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">{tr('dashboard.kpi')}</p>
        </div>
        <div className="flex gap-3">
          {!isSimulating ? (
            <button
              onClick={() => setIsSimulating(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center"
            >
              <BrainCircuit className="w-4 h-4 mr-2" />
              Decision Intelligence
            </button>
          ) : (
            <button
              onClick={closeSimulation}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
            >
              <X className="w-4 h-4 mr-2" />
              Exit Simulation
            </button>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${kpi.title === 'Active Maintenance' ? 'bg-amber-50' : 'bg-aera-100'}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.title === 'Active Maintenance' ? 'text-amber-600' : 'text-aera-900'}`} />
              </div>
              <div className={`flex items-center space-x-1 text-xs font-medium ${kpi.trend === 'up' && kpi.title !== 'Active Maintenance' ? 'text-emerald-600' :
                kpi.trend === 'down' ? 'text-red-600' : 'text-slate-600'
                }`}>
                <span>{kpi.change}</span>
                {kpi.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              </div>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{kpi.title}</h3>
            <p className="text-2xl font-bold text-aera-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Section - Enhanced with Simulation Layer */}
        <div className={`lg:col-span-2 bg-white p-6 rounded-xl border shadow-sm transition-all duration-500 ${isSimulating ? 'border-indigo-200 shadow-indigo-100 ring-4 ring-indigo-50/50' : 'border-slate-200'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-aera-900">{tr('dashboard.revenueOverTime')}</h3>
            {isSimulating && (
              <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold animate-pulse">
                "What-If" Mode Active
              </div>
            )}
          </div>

          {/* SIMULATION INPUT INTERFACE */}
          {isSimulating && (
            <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-indigo-100 animate-in slide-in-from-top-4">
              <label className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 block">
                AREA SCALE Decision Engine
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={simulationPrompt}
                  onChange={(e) => setSimulationPrompt(e.target.value)}
                  placeholder='Type a scenario... (e.g., "What if Acme Corp leaves in June?" or "Impact of 5% rent hike")'
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && runSimulation()}
                />
                <button
                  onClick={runSimulation}
                  disabled={isProcessingSim || !simulationPrompt}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {isProcessingSim ? 'Simulating...' : 'Run Scenario'}
                </button>
              </div>
              {simulationResult && (
                <div className="mt-4 p-3 bg-white rounded border-l-4 border-indigo-500 text-sm text-slate-700 shadow-sm animate-in fade-in">
                  <span className="font-bold text-indigo-900 block mb-1">AI Projection Analysis:</span>
                  {simulationResult.analysis}
                </div>
              )}
              {simulationError && (
                <div className="mt-4 p-3 bg-red-50 rounded border-l-4 border-red-500 text-sm text-red-700 shadow-sm animate-in fade-in flex items-center">
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
        <div className="bg-white p-0 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-aera-900 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Automated Feed</h3>
                <p className="text-xs text-aera-200 opacity-80 mt-1">AI-Curated Updates & Alerts</p>
              </div>
              <BrainCircuit className="w-5 h-5 text-aera-200" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-3">
            {feedItems.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-lg border transition-all duration-300 overflow-hidden ${expandedId === item.id ? 'border-aera-600 shadow-md ring-1 ring-aera-600/20' : 'border-slate-200 hover:border-aera-300 shadow-sm'}`}
              >
                {/* Card Header */}
                <div
                  onClick={() => handleExpand(item)}
                  className="p-4 cursor-pointer flex items-start gap-3"
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type === 'Maintenance'
                    ? (item.priority === 'Emergency' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600')
                    : 'bg-aera-100 text-aera-900'
                    }`}>
                    {item.type === 'Maintenance' ? <Wrench className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={`text-sm font-semibold truncate pr-2 ${expandedId === item.id ? 'text-aera-900' : 'text-slate-800'}`}>
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{item.date}</span>
                    </div>

                    {expandedId !== item.id && (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                        {item.rawContent}
                      </p>
                    )}

                    <div className="flex items-center mt-2 space-x-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${item.type === 'Maintenance' ? 'bg-slate-100 text-slate-500' : 'bg-aera-50 text-aera-700'
                        }`}>
                        {item.type}
                      </span>
                      {item.priority && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.priority === 'Emergency' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                          }`}>
                          {item.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`} />
                </div>

                {/* Expanded Content (AI Briefing) */}
                {expandedId === item.id && (
                  <div className="bg-aera-50/50 p-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center space-x-2 mb-2">
                      <BrainCircuit className="w-3 h-3 text-aera-600" />
                      <span className="text-[10px] font-bold text-aera-900 uppercase tracking-widest">Executive Briefing</span>
                    </div>

                    {loadingId === item.id ? (
                      <div className="flex items-center space-x-2 text-xs text-slate-500 py-2">
                        <div className="w-2 h-2 bg-aera-600 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-aera-600 rounded-full animate-bounce delay-75" />
                        <div className="w-2 h-2 bg-aera-600 rounded-full animate-bounce delay-150" />
                        <span>Generating professional update...</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                          {briefingCache[item.id]}
                        </p>
                        <div className="mt-3 flex justify-end">
                          <button className="text-xs text-aera-600 hover:text-aera-900 font-medium underline decoration-dotted">
                            View Full Details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button className="w-full py-3 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:bg-slate-50 hover:text-aera-900 transition-colors font-medium">
              View All Operations History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
