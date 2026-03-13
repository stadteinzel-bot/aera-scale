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
                <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }} className="text-3xl font-bold text-[#1A2E25] flex items-center gap-3">
                    <Wallet className="w-6 h-6 text-gold" />
                    Finanzen
                </h1>
                <p className="text-[#7A9589] mt-1 text-sm">Portfolio-weite Finanzübersicht</p>
            </div>

            {/* Tab Nav */}
            <div className="flex space-x-1 bg-cream-dark p-1 rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                            activeTab === tab.id
                            ? 'bg-forest text-white shadow-soft'
                            : 'text-[#7A9589] hover:text-[#1A2E25]'
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
                    {[
                      { label: 'Fakturiert (Monat)', value: `€${totalInvoiced.toLocaleString()}`, color: 'text-[#1A2E25]' },
                      { label: 'Eingezogen',          value: `€${totalCollected.toLocaleString()}`, color: 'text-[#3D7A5A]' },
                      { label: 'Ausstehend',          value: `€${totalOutstanding.toLocaleString()}`, color: 'text-[#C9883A]' },
                      { label: 'Überfällig',          value: String(overdueCount), color: 'text-[#C94A3A]' },
                    ].map(card => (
                      <div key={card.label} className="bg-white rounded-2xl border border-cream-deeper p-5 shadow-soft hover:shadow-medium hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold to-transparent" />
                        <p className="text-xs font-semibold text-[#7A9589] uppercase tracking-wider mb-2">{card.label}</p>
                        <p className={`text-2xl font-bold ${card.color}`} style={{ fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.02em' }}>{card.value}</p>
                      </div>
                    ))}
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
