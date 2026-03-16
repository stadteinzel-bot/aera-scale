// ===== AERA SCALE — Onboarding Wizard (v2 – Simplified) =====
// 2 steps: Org name → First property (name + address only)
// Everything else (bank, units) is moved to the GettingStartedBanner checklist.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Users, Check, Sparkles, ChevronRight, ArrowRight } from 'lucide-react';
import { useOrg } from '../services/OrgContext';
import { useAuth } from '../services/AuthContext';
import { dataService } from '../services/dataService';
import type { Property } from '../types';

interface OnboardingWizardProps {
    onComplete: () => void;
}

const PROPERTY_TYPES = [
    { id: 'Residential', label: 'Wohnen', emoji: '🏠' },
    { id: 'Office', label: 'Büro', emoji: '🏢' },
    { id: 'Retail', label: 'Gewerbe', emoji: '🏪' },
    { id: 'Mixed Use', label: 'Gemischt', emoji: '🏗️' },
] as const;

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
    const { orgId, org, refreshOrg } = useOrg();
    const { user } = useAuth();
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [direction, setDirection] = useState(1);

    // Step 0: Org
    const [orgName, setOrgName] = useState(org.name || '');

    // Step 1: Property
    const [propertyName, setPropertyName] = useState('');
    const [propertyAddress, setPropertyAddress] = useState('');
    const [propertyType, setPropertyType] = useState<string>('Residential');

    const steps = [
        { title: 'Willkommen!', subtitle: 'Wie soll Ihre Organisation heißen?' },
        { title: 'Erste Immobilie', subtitle: 'Legen Sie Ihr erstes Objekt an – dauert 30 Sekunden.' },
    ];

    const canProceed = () => {
        if (step === 0) return orgName.trim().length > 0;
        if (step === 1) return propertyName.trim().length > 0 && propertyAddress.trim().length > 0;
        return true;
    };

    const goNext = () => {
        setDirection(1);
        setStep(s => s + 1);
    };

    const handleFinish = async (skipProperty = false) => {
        setIsSubmitting(true);
        try {
            await dataService.updateOrganization(orgId, { name: orgName.trim() });

            if (!skipProperty && propertyName.trim()) {
                const property: Omit<Property, 'id'> = {
                    name: propertyName.trim(),
                    address: propertyAddress.trim(),
                    type: propertyType as any,
                    status: 'Vacant',
                    sizeSqFt: 0,
                    rentPerSqFt: 0,
                    units: [],
                    image: `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
                };
                await dataService.addProperty(property);
            }

            await dataService.updateOrganization(orgId, { onboardingComplete: true });
            await refreshOrg();
            onComplete();
        } catch (e) {
            console.error('Onboarding error:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const slideVariants = {
        enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
    };

    return (
        <div className="h-screen flex items-center justify-center bg-[#0F1E17] relative overflow-hidden font-sans">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#2D4A3E]/60 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#C9A84C]/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-lg mx-auto px-4 relative z-10">
                {/* Logo + brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2D4A3E] to-[#1A2E25] border border-[#C9A84C]/25 mb-4 shadow-lg">
                        <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
                            <rect x="8"  y="24" width="20" height="32" rx="2" fill="rgba(255,255,255,0.85)"/>
                            <rect x="16" y="12" width="32" height="44" rx="2" fill="rgba(255,255,255,0.50)"/>
                            <rect x="36" y="20" width="20" height="36" rx="2" fill="rgba(255,255,255,0.75)"/>
                            <rect x="14" y="30" width="5" height="5" rx="1" fill="#C9A84C"/>
                            <rect x="26" y="22" width="5" height="5" rx="1" fill="#C9A84C"/>
                            <rect x="43" y="28" width="5" height="5" rx="1" fill="#C9A84C"/>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">AERA SCALE</h1>
                    <p className="text-sm text-white/40 mt-1">Immobilienverwaltung · KI-gestützt</p>
                </div>

                {/* Step dots */}
                <div className="flex justify-center gap-2 mb-8">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === step ? 'w-8 bg-[#C9A84C]' : i < step ? 'w-4 bg-[#C9A84C]/40' : 'w-4 bg-white/10'
                            }`}
                        />
                    ))}
                </div>

                {/* Card */}
                <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Card header */}
                    <div className="px-8 pt-8 pb-6 border-b border-white/5">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={step}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                            >
                                <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-widest mb-1">
                                    Schritt {step + 1} von {steps.length}
                                </p>
                                <h2 className="text-xl font-bold text-white">{steps[step].title}</h2>
                                <p className="text-sm text-white/45 mt-1">{steps[step].subtitle}</p>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Card body */}
                    <div className="px-8 py-6">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={step}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                            >
                                {step === 0 ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
                                                Organisationsname *
                                            </label>
                                            <input
                                                autoFocus
                                                value={orgName}
                                                onChange={e => setOrgName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && canProceed() && goNext()}
                                                placeholder="z.B. Immobilien Müller GmbH"
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]/40 transition-all text-sm"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5">
                                            <div className="w-8 h-8 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/25 flex items-center justify-center text-xs font-bold text-[#C9A84C]">
                                                {(user?.email || 'A').substring(0, 1).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-white/70">{user?.email}</p>
                                                <p className="text-xs text-white/30">Org-Administrator</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
                                                Objektname *
                                            </label>
                                            <input
                                                autoFocus
                                                value={propertyName}
                                                onChange={e => setPropertyName(e.target.value)}
                                                placeholder="z.B. Musterstraße 12"
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]/40 transition-all text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
                                                Adresse *
                                            </label>
                                            <input
                                                value={propertyAddress}
                                                onChange={e => setPropertyAddress(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && canProceed() && handleFinish()}
                                                placeholder="Musterstraße 12, 10115 Berlin"
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]/40 transition-all text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
                                                Objekttyp
                                            </label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {PROPERTY_TYPES.map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setPropertyType(t.id)}
                                                        className={`py-2.5 px-2 rounded-xl border text-xs font-medium transition-all text-center flex flex-col items-center gap-1 ${
                                                            propertyType === t.id
                                                                ? 'bg-[#C9A84C]/15 border-[#C9A84C]/50 text-[#C9A84C]'
                                                                : 'bg-white/3 border-white/8 text-white/40 hover:border-white/20 hover:text-white/60'
                                                        }`}
                                                    >
                                                        <span className="text-base">{t.emoji}</span>
                                                        <span>{t.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Card footer */}
                    <div className="px-8 pb-8 pt-2 flex items-center justify-between">
                        {step > 0 ? (
                            <button
                                onClick={() => { setDirection(-1); setStep(s => s - 1); }}
                                className="text-sm text-white/35 hover:text-white/60 transition-colors"
                            >
                                ← Zurück
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-3">
                            {step === 1 && (
                                <button
                                    onClick={() => handleFinish(true)}
                                    disabled={isSubmitting}
                                    className="text-xs text-white/30 hover:text-white/50 transition-colors"
                                >
                                    Später →
                                </button>
                            )}
                            {step < steps.length - 1 ? (
                                <button
                                    onClick={goNext}
                                    disabled={!canProceed()}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#1A2E25] rounded-xl text-sm font-semibold hover:bg-[#D4B05A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#C9A84C]/20"
                                >
                                    Weiter <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleFinish(false)}
                                    disabled={isSubmitting || !canProceed()}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#1A2E25] rounded-xl text-sm font-semibold hover:bg-[#D4B05A] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#C9A84C]/20"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-[#1A2E25]/30 border-t-[#1A2E25] rounded-full animate-spin" />
                                            Wird eingerichtet…
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Einrichten &amp; loslegen
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-white/20 mt-6">
                    ✓ Keine Kreditkarte · ✓ 14 Tage kostenlos · ✓ DSGVO-konform
                </p>
            </div>
        </div>
    );
};

export default OnboardingWizard;
