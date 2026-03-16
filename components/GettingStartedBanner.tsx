// ===== AERA SCALE — Getting Started Checklist Banner =====
// Shows after onboarding wizard is complete.
// Tracks progress based on real data. Dismissible via localStorage.

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, Circle, X, ChevronDown, ChevronUp,
    Building2, Users, CreditCard, FileText, Zap
} from 'lucide-react';
import { useDataCore } from '../core/DataCoreProvider';
import { useOrg } from '../services/OrgContext';

const DISMISS_KEY = 'aera-onboarding-banner-dismissed';

interface ChecklistItem {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType;
    done: boolean;
    action?: string;
}

interface GettingStartedBannerProps {
    onNavigate?: (view: string) => void;
    onSelectAsset?: (id: string) => void;
}

const GettingStartedBanner: React.FC<GettingStartedBannerProps> = ({ onNavigate }) => {
    const { data } = useDataCore();
    const { org } = useOrg();
    const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY));
    const [collapsed, setCollapsed] = useState(false);

    const items: ChecklistItem[] = [
        {
            id: 'org',
            label: 'Organisation eingerichtet',
            description: 'Name Ihrer Hausverwaltung festgelegt',
            icon: Zap,
            done: !!(org.name && org.name !== 'Meine Organisation'),
        },
        {
            id: 'property',
            label: 'Erste Immobilie anlegen',
            description: 'Fügen Sie Ihr erstes Objekt hinzu',
            icon: Building2,
            done: data.properties.length > 0,
            action: 'properties',
        },
        {
            id: 'unit',
            label: 'Erste Einheit anlegen',
            description: 'Mieteinheit zu Ihrem Objekt hinzufügen',
            icon: Building2,
            done: data.properties.some(p => (p.units?.length ?? 0) > 0),
            action: 'properties',
        },
        {
            id: 'tenant',
            label: 'Ersten Mieter anlegen',
            description: 'Mieter erfassen und Einheit zuweisen',
            icon: Users,
            done: data.tenants.length > 0,
            action: 'tenants',
        },
        {
            id: 'contract',
            label: 'Ersten Mietvertrag anlegen',
            description: 'Vertrag für Ihren Mieter hinterlegen',
            icon: FileText,
            done: data.contracts.length > 0,
            action: 'properties',
        },
    ];

    const completedCount = items.filter(i => i.done).length;
    const totalCount = items.length;
    const allDone = completedCount === totalCount;
    const progressPct = Math.round((completedCount / totalCount) * 100);

    const handleDismiss = () => {
        localStorage.setItem(DISMISS_KEY, '1');
        setDismissed(true);
    };

    if (dismissed || allDone) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="mb-6 bg-gradient-to-r from-[#1A2E25] to-[#2D4A3E] rounded-2xl border border-[#C9A84C]/20 shadow-lg overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-[#C9A84C]" />
                            <span className="text-sm font-semibold text-white">Erste Schritte</span>
                            <span className="text-xs text-[#C9A84C] font-medium bg-[#C9A84C]/10 px-2 py-0.5 rounded-full">
                                {completedCount}/{totalCount}
                            </span>
                        </div>
                        {/* Progress bar */}
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-[#C9A84C] rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPct}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                />
                            </div>
                            <span className="text-xs text-white/50">{progressPct}%</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCollapsed(c => !c)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                        >
                            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white/80"
                            title="Ausblenden"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Checklist */}
                <AnimatePresence>
                    {!collapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                        >
                            <div className="px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                {items.map((item, i) => (
                                    <div
                                        key={item.id}
                                        onClick={() => !item.done && item.action && onNavigate?.(item.action)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-150
                                            ${item.done
                                                ? 'border-[#C9A84C]/20 bg-[#C9A84C]/5 opacity-60'
                                                : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 cursor-pointer'
                                            }`}
                                    >
                                        <div className="shrink-0 mt-0.5">
                                            {item.done
                                                ? <CheckCircle2 className="w-4 h-4 text-[#C9A84C]" />
                                                : <Circle className="w-4 h-4 text-white/30" />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-medium leading-tight ${item.done ? 'text-white/40 line-through' : 'text-white'}`}>
                                                {item.label}
                                            </p>
                                            {!item.done && (
                                                <p className="text-xs text-white/35 mt-0.5 leading-tight">{item.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
};

export default GettingStartedBanner;
