// ===== AERA SCALE — Onboarding Wizard =====
// Multi-step setup wizard shown after first registration.
// Steps: Org name → First property → Bank details → First unit

import React, { useState } from 'react';
import { Building2, CreditCard, Home, ChevronRight, ChevronLeft, Check, Sparkles, Hexagon, Users, ArrowRight } from 'lucide-react';
import { useOrg } from '../services/OrgContext';
import { useAuth } from '../services/AuthContext';
import { dataService } from '../services/dataService';
import type { Property, PropertyUnit } from '../types';

interface OnboardingWizardProps {
    onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
    const { orgId, org, refreshOrg } = useOrg();
    const { user } = useAuth();
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [orgName, setOrgName] = useState(org.name || '');

    const [propertyName, setPropertyName] = useState('');
    const [propertyAddress, setPropertyAddress] = useState('');
    const [propertyType, setPropertyType] = useState<'Office' | 'Retail' | 'Industrial' | 'Mixed Use'>('Office');

    const [bankAccountHolder, setBankAccountHolder] = useState('');
    const [bankIban, setBankIban] = useState('');
    const [bankBic, setBankBic] = useState('');
    const [bankName, setBankName] = useState('');

    const [unitNumber, setUnitNumber] = useState('');
    const [unitRent, setUnitRent] = useState('');
    const [unitSize, setUnitSize] = useState('');
    const [unitFloor, setUnitFloor] = useState('');

    const steps = [
        { title: 'Organisation bestätigen', icon: Users, description: 'Name Ihrer Organisation' },
        { title: 'Erstes Objekt', icon: Building2, description: 'Legen Sie Ihr erstes Objekt an' },
        { title: 'Bankverbindung', icon: CreditCard, description: 'Hinterlegen Sie Ihre Bankdaten' },
        { title: 'Erste Einheit', icon: Home, description: 'Erstellen Sie Ihre erste Mieteinheit' },
    ];

    const canProceed = () => {
        switch (step) {
            case 0: return orgName.trim().length > 0;
            case 1: return propertyName.trim().length > 0 && propertyAddress.trim().length > 0;
            case 2: return true; // Bank details optional
            case 3: return true; // Unit optional (can be skipped)
            default: return true;
        }
    };

    const handleFinish = async () => {
        setIsSubmitting(true);
        try {
            // 1. Update org name
            await dataService.updateOrganization(orgId, { name: orgName.trim() });

            // 2. Create the first property
            const unit: PropertyUnit | undefined = unitNumber.trim() ? {
                id: `unit_${Date.now()}`,
                unitNumber: unitNumber.trim(),
                rentMonthly: parseFloat(unitRent) || 0,
                sizeSqFt: parseFloat(unitSize) || 0,
                status: 'Vacant',
                floor: unitFloor || undefined,
            } : undefined;

            const property: Omit<Property, 'id'> = {
                name: propertyName.trim(),
                address: propertyAddress.trim(),
                type: propertyType,
                status: 'Vacant',
                sizeSqFt: 0,
                rentPerSqFt: 0,
                units: unit ? [unit] : [],
                image: '',
                landlord: bankAccountHolder ? {
                    name: bankAccountHolder,
                    address: propertyAddress.trim(),
                    zipCode: '',
                    city: '',
                    email: '',
                    iban: bankIban,
                    bic: bankBic,
                    bankName: bankName,
                } : undefined,
            };

            await dataService.addProperty(property);

            // 3. Mark onboarding complete
            await dataService.updateOrganization(orgId, { onboardingComplete: true });

            // 4. Refresh org context
            await refreshOrg();

            onComplete();
        } catch (e) {
            console.error('Onboarding error:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 0:
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Organisationsname</label>
                            <input
                                value={orgName}
                                onChange={e => setOrgName(e.target.value)}
                                placeholder="z.B. Hausverwaltung Müller GmbH"
                                className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent"
                            />
                        </div>
                        <div className="p-4 bg-aera-800/30 rounded-xl border border-aera-700/50">
                            <p className="text-sm text-slate-400">
                                <span className="text-aera-400 font-medium">Admin-Konto:</span> {user?.email}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Sie sind automatisch als Org-Admin registriert.</p>
                        </div>
                    </div>
                );
            case 1:
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Objektname *</label>
                            <input
                                value={propertyName}
                                onChange={e => setPropertyName(e.target.value)}
                                placeholder="z.B. Musterstraße 12"
                                className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Adresse *</label>
                            <input
                                value={propertyAddress}
                                onChange={e => setPropertyAddress(e.target.value)}
                                placeholder="Musterstraße 12, 10115 Berlin"
                                className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Typ</label>
                            <div className="grid grid-cols-3 gap-3">
                                {(['Office', 'Retail', 'Mixed Use'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setPropertyType(t)}
                                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${propertyType === t
                                            ? 'bg-aera-600/20 border-aera-500 text-aera-300'
                                            : 'bg-aera-800/30 border-aera-700/50 text-slate-400 hover:border-aera-600/50'
                                            }`}
                                    >
                                        {t === 'Office' ? 'Bürogebäude' : t === 'Retail' ? 'Gewerbe' : 'Gemischt'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400 mb-2">Optional — können Sie später ergänzen.</p>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Kontoinhaber</label>
                            <input value={bankAccountHolder} onChange={e => setBankAccountHolder(e.target.value)} placeholder="Max Mustermann" className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">IBAN</label>
                            <input value={bankIban} onChange={e => setBankIban(e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">BIC</label>
                                <input value={bankBic} onChange={e => setBankBic(e.target.value)} placeholder="COBADEFFXXX" className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Bankname</label>
                                <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Commerzbank" className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent" />
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400 mb-2">Optional — erstellen Sie Ihre erste Mieteinheit.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Einheitsnummer</label>
                                <input value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder="WE-01" className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Monatliche Miete (€)</label>
                                <input type="number" value={unitRent} onChange={e => setUnitRent(e.target.value)} placeholder="850" className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Fläche (m²)</label>
                                <input type="number" value={unitSize} onChange={e => setUnitSize(e.target.value)} placeholder="65" className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Etage</label>
                                <input value={unitFloor} onChange={e => setUnitFloor(e.target.value)} placeholder="EG" className="w-full px-4 py-3 bg-aera-800/50 border border-aera-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-aera-500 focus:border-transparent" />
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-aera-950 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 -left-1/4 w-[600px] h-[600px] bg-aera-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-0 -right-1/4 w-[500px] h-[500px] bg-emerald-400/15 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
            </div>

            <div className="w-full max-w-2xl mx-auto px-4 relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-aera-800 to-aera-950 border border-aera-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Hexagon className="w-8 h-8 text-aera-500 fill-current" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Willkommen bei AERA SCALE</h1>
                    <p className="text-slate-400">Richten Sie Ihre Organisation in wenigen Schritten ein.</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center mb-8 gap-2">
                    {steps.map((s, i) => (
                        <React.Fragment key={i}>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${i === step
                                ? 'bg-aera-600/20 text-aera-400 border border-aera-500/30'
                                : i < step
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'text-slate-600 border border-transparent'
                                }`}>
                                {i < step ? <Check className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                                {!false && <span className="hidden sm:inline">{s.title}</span>}
                            </div>
                            {i < steps.length - 1 && <div className={`w-6 h-px ${i < step ? 'bg-emerald-500/50' : 'bg-aera-700'}`} />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Card */}
                <div className="bg-white/[0.03] backdrop-blur-sm border border-aera-700/50 rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        {React.createElement(steps[step].icon, { className: 'w-5 h-5 text-aera-400' })}
                        <div>
                            <h2 className="text-lg font-semibold text-white">{steps[step].title}</h2>
                            <p className="text-sm text-slate-500">{steps[step].description}</p>
                        </div>
                    </div>

                    {renderStepContent()}

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-aera-800">
                        {step > 0 ? (
                            <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                                <ChevronLeft className="w-4 h-4" /> Zurück
                            </button>
                        ) : <div />}

                        {step < steps.length - 1 ? (
                            <button
                                onClick={() => setStep(step + 1)}
                                disabled={!canProceed()}
                                className="flex items-center gap-2 px-6 py-2.5 bg-aera-600 text-white rounded-xl text-sm font-medium hover:bg-aera-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Weiter <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleFinish}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-aera-600 to-emerald-600 text-white rounded-xl text-sm font-medium hover:from-aera-500 hover:to-emerald-500 transition-all disabled:opacity-60 shadow-lg shadow-aera-600/20"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Wird eingerichtet…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Einrichtung abschließen
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Skip option */}
                {step >= 2 && (
                    <div className="text-center mt-4">
                        <button
                            onClick={handleFinish}
                            disabled={isSubmitting}
                            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                        >
                            Überspringen und später einrichten →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingWizard;
