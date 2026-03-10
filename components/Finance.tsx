import React, { useState } from 'react';
import { useDataCore } from '../core/DataCoreProvider';
import { Receipt, FileSpreadsheet, Wallet, Shield, TrendingUp } from 'lucide-react';
import Mietrechnungen from './Mietrechnungen';
import Nebenkostenabrechnung from './Nebenkostenabrechnung';
import ReconciliationReport from './ReconciliationReport';
import Betriebskosten from './Betriebskosten';

type FinanceTab = 'overview' | 'invoices' | 'operating' | 'settlements' | 'reconciliation';

const Finance: React.FC = () => {
    const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
    const { data } = useDataCore();

    const tabs: { id: FinanceTab; label: string; icon: React.ElementType }[] = [
        { id: 'overview', label: 'Übersicht', icon: TrendingUp },
        { id: 'invoices', label: 'Mietrechnungen', icon: Receipt },
        { id: 'operating', label: 'Betriebskosten', icon: Wallet },
        { id: 'settlements', label: 'NK-Abrechnung', icon: FileSpreadsheet },
        { id: 'reconciliation', label: 'Abgleich', icon: Shield },
    ];

    // Global finance KPIs
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthInvoices = data.invoices.filter(i => i.period === currentMonth);
    const totalInvoiced = monthInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollected = monthInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalOutstanding = totalInvoiced - totalCollected;
    const overdueCount = data.invoices.filter(i => i.status === 'overdue').length;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-aera-600" />
                    Finanzen
                </h1>
                <p className="text-slate-500 mt-1">Portfolio-weite Finanzübersicht</p>
            </div>

            {/* Tab Nav */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id
                            ? 'bg-white text-aera-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Fakturiert (Monat)</p>
                        <p className="text-2xl font-bold text-slate-900">€{totalInvoiced.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Eingezogen</p>
                        <p className="text-2xl font-bold text-emerald-600">€{totalCollected.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Ausstehend</p>
                        <p className="text-2xl font-bold text-amber-600">€{totalOutstanding.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Überfällig</p>
                        <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
                    </div>
                </div>
            )}

            {activeTab === 'invoices' && <Mietrechnungen />}
            {activeTab === 'operating' && <Betriebskosten />}
            {activeTab === 'settlements' && <Nebenkostenabrechnung />}
            {activeTab === 'reconciliation' && <ReconciliationReport />}
        </div>
    );
};

export default Finance;
