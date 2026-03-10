import React from 'react';
import { motion } from 'framer-motion';
import { Property, AssetTab } from '../types';
import { useDataCore } from '../core/DataCoreProvider';
import {
    ArrowLeft, BarChart3, Calendar, Users, Layers, Wrench,
    MessageSquare, FolderOpen, Wallet, FileSpreadsheet, Receipt,
    FileText, Shield, ChevronDown, Building2, Settings2
} from 'lucide-react';

// ---- Existing module components (will receive propertyId prop) ----
import CalendarView from './CalendarView';
import Tenants from './Tenants';
import Maintenance from './Maintenance';
import Communications from './Communications';
import Documents from './Documents';
import Betriebskosten from './Betriebskosten';
import Nebenkostenabrechnung from './Nebenkostenabrechnung';
import Mietrechnungen from './Mietrechnungen';
import LeaseAnalyzer from './LeaseAnalyzer';
import ReconciliationReport from './ReconciliationReport';
import AssetOverview from './AssetOverview';
import PropertyDetail from './PropertyDetail';
import AssetConfigComponent from './AssetConfig';

interface AssetLayoutProps {
    property: Property;
    activeTab: AssetTab;
    onTabChange: (tab: AssetTab) => void;
    onBack: () => void;
    onSwitchAsset: (id: string) => void;
}

const TAB_ITEMS: { id: AssetTab; label: string; icon: React.ElementType }[] = [
    { id: AssetTab.OVERVIEW, label: 'Übersicht', icon: BarChart3 },
    { id: AssetTab.CALENDAR, label: 'Kalender', icon: Calendar },
    { id: AssetTab.TENANTS, label: 'Mieter', icon: Users },
    { id: AssetTab.UNITS, label: 'Einheiten', icon: Layers },
    { id: AssetTab.MAINTENANCE, label: 'Wartung', icon: Wrench },
    { id: AssetTab.MESSAGES, label: 'Nachrichten', icon: MessageSquare },
    { id: AssetTab.DOCUMENTS, label: 'Dokumente', icon: FolderOpen },
    { id: AssetTab.OPERATING_COSTS, label: 'Betriebskosten', icon: Wallet },
    { id: AssetTab.SERVICE_CHARGES, label: 'NK-Abrechnung', icon: FileSpreadsheet },
    { id: AssetTab.RENT_INVOICES, label: 'Mietrechnungen', icon: Receipt },
    { id: AssetTab.AI_AUTOMATION, label: 'KI / Lease AI', icon: FileText },
    { id: AssetTab.RECONCILIATION, label: 'Abgleich', icon: Shield },
    { id: AssetTab.CONFIG, label: 'Konfiguration', icon: Settings2 },
];

const AssetLayout: React.FC<AssetLayoutProps> = ({ property, activeTab, onTabChange, onBack, onSwitchAsset }) => {
    const { data } = useDataCore();
    const [switcherOpen, setSwitcherOpen] = React.useState(false);

    const currentTabLabel = TAB_ITEMS.find(t => t.id === activeTab)?.label || '';

    const renderContent = () => {
        switch (activeTab) {
            case AssetTab.OVERVIEW:
                return <AssetOverview property={property} />;
            case AssetTab.CALENDAR:
                return <CalendarView propertyId={property.id} />;
            case AssetTab.TENANTS:
                return <Tenants propertyId={property.id} />;
            case AssetTab.UNITS:
                return <PropertyDetail property={property} onBack={() => onTabChange(AssetTab.OVERVIEW)} />;
            case AssetTab.MAINTENANCE:
                return <Maintenance propertyId={property.id} />;
            case AssetTab.MESSAGES:
                return <Communications propertyId={property.id} />;
            case AssetTab.DOCUMENTS:
                return <Documents propertyId={property.id} />;
            case AssetTab.OPERATING_COSTS:
                return <Betriebskosten propertyId={property.id} />;
            case AssetTab.SERVICE_CHARGES:
                return <Nebenkostenabrechnung propertyId={property.id} />;
            case AssetTab.RENT_INVOICES:
                return <Mietrechnungen propertyId={property.id} />;
            case AssetTab.AI_AUTOMATION:
                return <LeaseAnalyzer propertyId={property.id} />;
            case AssetTab.RECONCILIATION:
                return <ReconciliationReport propertyId={property.id} />;
            case AssetTab.CONFIG:
                return <AssetConfigComponent property={property} />;
            default:
                return <AssetOverview property={property} />;
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* ── Header: Back + Asset Name + Quick Switcher + Breadcrumb ── */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 shrink-0">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-aera-700 transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="hidden sm:inline">Immobilien</span>
                </button>

                <div className="h-5 w-px bg-slate-200" />

                {/* Quick Switcher */}
                <div className="relative">
                    <button
                        onClick={() => setSwitcherOpen(!switcherOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <Building2 className="w-4 h-4 text-aera-600" />
                        <span className="font-semibold text-slate-900 text-sm">{property.name}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {switcherOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
                            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 max-h-64 overflow-y-auto">
                                {data.properties.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { onSwitchAsset(p.id); setSwitcherOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors ${p.id === property.id ? 'bg-aera-50 text-aera-800' : 'text-slate-700'}`}
                                    >
                                        <Building2 className={`w-4 h-4 shrink-0 ${p.id === property.id ? 'text-aera-600' : 'text-slate-400'}`} />
                                        <div className="overflow-hidden">
                                            <div className="text-sm font-medium truncate">{p.name}</div>
                                            <div className="text-xs text-slate-400 truncate">{p.address}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Breadcrumb */}
                <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
                    <span>Immobilien</span>
                    <span>›</span>
                    <span className="text-slate-600">{property.name}</span>
                    <span>›</span>
                    <span className="text-aera-600 font-medium">{currentTabLabel}</span>
                </div>
            </div>

            {/* ── Body: Asset Sidebar + Content ── */}
            <div className="flex-1 flex min-h-0">
                {/* Asset Sidebar */}
                <nav className="w-52 bg-slate-50 border-r border-slate-200 shrink-0 overflow-y-auto py-3 px-2 space-y-0.5">
                    {TAB_ITEMS.map((item, index) => {
                        const isActive = activeTab === item.id;
                        const isConfig = item.id === AssetTab.CONFIG;
                        return (
                            <React.Fragment key={item.id}>
                                {isConfig && <div className="my-2 mx-3 border-t border-slate-200" />}
                                <button
                                    onClick={() => onTabChange(item.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative group ${isActive
                                        ? 'bg-white text-aera-800 font-medium shadow-sm border border-slate-200'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                        }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="asset-tab-indicator"
                                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-aera-600 rounded-r-full"
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-aera-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                    <span>{item.label}</span>
                                </button>
                            </React.Fragment>
                        );
                    })}
                </nav>

                {/* Content Area */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-7xl mx-auto p-6 w-full">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            {renderContent()}
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetLayout;
