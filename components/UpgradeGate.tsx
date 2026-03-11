// ===== AERA SCALE — Upgrade Gate =====
// Wraps Pro/Enterprise features. Shows a freundliches upgrade modal for Basic users.
// Usage: <UpgradeGate feature="Open Banking"> ... protected content ... </UpgradeGate>

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, X, ArrowRight, Zap } from 'lucide-react';
import { useOrg } from '../services/OrgContext';

const HOMEPAGE_PRICING = 'https://stadteinzel-bot.github.io/aera-scale/homepage/#pricing';
const APP_REGISTER_PRO = 'https://aera-scale-983360724436.europe-west1.run.app/?mode=register&plan=pro';

type Plan = 'basic' | 'pro' | 'enterprise';

interface UpgradeGateProps {
    /** Human-readable feature name shown in the modal */
    feature: string;
    /** Minimum plan required to access this feature */
    requiredPlan?: Plan;
    /** Children rendered only when the user has access */
    children: React.ReactNode;
    /** Optional: render a custom locked placeholder instead of children */
    lockedFallback?: React.ReactNode;
}

const PLAN_ORDER: Record<Plan, number> = { basic: 0, pro: 1, enterprise: 2 };

const planLabel: Record<Plan, string> = {
    basic: 'Basic',
    pro: 'Pro',
    enterprise: 'Enterprise',
};

const planColor: Record<Plan, string> = {
    basic:      'text-slate-400',
    pro:        'text-aera-400',
    enterprise: 'text-amber-400',
};

export const UpgradeGate: React.FC<UpgradeGateProps> = ({
    feature,
    requiredPlan = 'pro',
    children,
    lockedFallback,
}) => {
    const { org } = useOrg();
    const [showModal, setShowModal] = useState(false);

    // Determine user's current plan (default 'basic' if not set)
    const currentPlan: Plan = (org?.plan as Plan) ?? 'basic';
    const hasAccess = PLAN_ORDER[currentPlan] >= PLAN_ORDER[requiredPlan];

    if (hasAccess) return <>{children}</>;

    // Locked: show fallback or a click-to-upgrade placeholder
    return (
        <>
            {/* Locked placeholder */}
            <div
                onClick={() => setShowModal(true)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setShowModal(true)}
                className="relative cursor-pointer group select-none"
                aria-label={`${feature} — Upgrade erforderlich`}
            >
                {/* Blur overlay */}
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-aera-950/70 backdrop-blur-sm rounded-xl">
                    <div className="w-10 h-10 bg-aera-800 border border-aera-600/50 rounded-xl flex items-center justify-center shadow-xl group-hover:bg-aera-700 transition-colors">
                        <Lock className="w-5 h-5 text-aera-400" />
                    </div>
                    <p className="text-xs font-semibold text-white/80 text-center px-4">
                        {feature} erfordert{' '}
                        <span className={planColor[requiredPlan]}>
                            {planLabel[requiredPlan]}
                        </span>
                    </p>
                    <span className="text-[10px] text-aera-400 font-medium uppercase tracking-wider group-hover:text-aera-300 transition-colors">
                        Upgrade ansehen →
                    </span>
                </div>

                {/* Blurred content underneath */}
                <div className="opacity-30 pointer-events-none blur-[2px]" aria-hidden>
                    {lockedFallback ?? children}
                </div>
            </div>

            {/* Upgrade Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Backdrop */}
                        <motion.div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowModal(false)}
                        />

                        {/* Card */}
                        <motion.div
                            className="relative z-10 w-full max-w-md bg-aera-950 border border-aera-700/60 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
                            initial={{ scale: 0.94, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.94, y: 20 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        >
                            {/* Header gradient */}
                            <div className="h-1 w-full bg-gradient-to-r from-aera-500 via-aera-400 to-emerald-400" />

                            <div className="p-6">
                                {/* Close */}
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="absolute top-4 right-4 text-aera-500 hover:text-white transition-colors"
                                    aria-label="Schließen"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                {/* Icon */}
                                <div className="w-12 h-12 bg-gradient-to-br from-aera-500 to-aera-700 rounded-xl flex items-center justify-center shadow-lg shadow-aera-600/30 mb-4">
                                    <Zap className="w-6 h-6 text-white" />
                                </div>

                                {/* Title */}
                                <h2 className="text-lg font-bold text-white mb-1">
                                    Upgrade auf {planLabel[requiredPlan]}
                                </h2>
                                <p className="text-sm text-aera-300/80 mb-5 leading-relaxed">
                                    <strong className="text-white">{feature}</strong> ist im{' '}
                                    <span className={planColor[requiredPlan]}>
                                        {planLabel[requiredPlan]}-Plan
                                    </span>{' '}
                                    enthalten. Schalten Sie alle Profi-Funktionen frei:
                                    Open Banking, KI-Vertragsanalyse, automatische Mietrechnungen
                                    und mehr.
                                </p>

                                {/* Feature list */}
                                <ul className="space-y-2 mb-6">
                                    {[
                                        'Unbegrenzte Immobilien',
                                        'Open Banking via Tink',
                                        'KI-Vertragsanalyse',
                                        'Automatische Mietrechnungen',
                                        'Betriebskostenabrechnung',
                                        'Prioritäts-Support',
                                    ].map(item => (
                                        <li key={item} className="flex items-center gap-2 text-sm text-aera-200/80">
                                            <Sparkles className="w-3.5 h-3.5 text-aera-400 shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                {/* CTAs */}
                                <div className="flex flex-col gap-2">
                                    <a
                                        href={APP_REGISTER_PRO}
                                        className="flex items-center justify-center gap-2 w-full py-3 bg-white text-aera-900 font-bold rounded-xl hover:bg-aera-50 transition-colors text-sm shadow-lg shadow-black/20"
                                    >
                                        <span>Jetzt auf {planLabel[requiredPlan]} upgraden</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </a>
                                    <a
                                        href={HOMEPAGE_PRICING}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-1 w-full py-2.5 text-aera-400 hover:text-white text-xs font-medium transition-colors"
                                    >
                                        Alle Preise vergleichen →
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default UpgradeGate;
