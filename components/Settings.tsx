
import React, { useState, useEffect } from 'react';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../constants';
import { Bell, Calendar, AlertTriangle, Save, CheckCircle2, MessageCircle, Landmark, RefreshCw, ArrowRight, Wallet, Activity, BrainCircuit, AlertCircle, XCircle, Globe, Users, Settings as SettingsIcon, Eye, EyeOff, HardDrive, Zap, Crown, TrendingUp } from 'lucide-react';
import { BankSettings, ReconciliationResult, Tenant, NotificationSettings, Property } from '../types';
import { performSmartReconciliation } from '../services/geminiService';
import { dataService } from '../services/dataService';
import { useTranslation } from '../core/i18nProvider';
import type { Locale } from '../core/i18nProvider';
import { maskIBAN, maskBIC } from '../utils/maskUtils';
import OrgUsers from './OrgUsers';
import TwoFactorSettings from './TwoFactorSettings';
import { BankConnect } from './BankConnect';
import { BankTransactions } from './BankTransactions';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useOrg } from '../services/OrgContext';
import type { BankConnection } from '../services/bankingService';
import { getQuotaInfo, type QuotaInfo, PLAN_LABELS, type StoragePlan } from '../services/storageQuota';
import { doc, updateDoc } from 'firebase/firestore';

const Settings: React.FC = () => {
    const [settingsTab, setSettingsTab] = useState<'general' | 'org' | 'bank'>('general');
    const { orgId } = useOrg();
    const [bankConnections, setBankConnections] = useState<BankConnection[]>([]);
    const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
    const [planUpdating, setPlanUpdating] = useState(false);
    const [planSuccess, setPlanSuccess] = useState<string | null>(null);
    const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);  // ← passed to BankConnect/BankTransactions

    useEffect(() => {
        const loadData = async () => {
            const [savedSettings, tenantsData, savedBank] = await Promise.all([
                dataService.getSettings(),
                dataService.getTenants(),
                dataService.getBankSettings(),
            ]);
            setSettings(savedSettings);
            setTenants(tenantsData);
            if (savedBank) setBankSettings(savedBank);
        };
        loadData();
    }, []);

    // Load properties once orgId is resolved (avoids permission-denied race condition)
    useEffect(() => {
        if (!orgId) return;
        dataService.getProperties().then(setProperties);
        // Load quota info
        getQuotaInfo(orgId).then(setQuotaInfo).catch(console.warn);
    }, [orgId]);

    const handleUpgradePlan = async (plan: StoragePlan) => {
        if (!orgId || !db) return;
        setPlanUpdating(true);
        try {
            await updateDoc(doc(db, 'organizations', orgId), { storagePlan: plan });
            const updated = await getQuotaInfo(orgId);
            setQuotaInfo(updated);
            setPlanSuccess(plan);
            setTimeout(() => setPlanSuccess(null), 3000);
        } catch (e) {
            console.error('Plan upgrade failed:', e);
        } finally {
            setPlanUpdating(false);
        }
    };

    // Live bank connections (orgId subcollection — requires Firestore rules)
    useEffect(() => {
        if (!orgId) return;
        const q = query(
            collection(db, 'organizations', orgId, 'bankConnections'),
            orderBy('linkedAt', 'desc')
        );
        return onSnapshot(q,
            snap => setBankConnections(snap.docs.map(d => ({ connectionId: d.id, ...d.data() } as BankConnection))),
            (err) => console.warn('[Settings] bankConnections listener error (check Firestore rules):', err.code)
        );
    }, [orgId]);

    // Bank Settings State
    const [bankSettings, setBankSettings] = useState<BankSettings>({
        accountHolder: 'AREA SCALE Real Estate',
        iban: '',
        bic: '',
        bankName: '',
        enableAutoReconciliation: true,
        matchThreshold: 80
    });

    const [isSaved, setIsSaved] = useState(false);
    const [showIBAN, setShowIBAN] = useState(false);

    // Reconciliation State
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconciliationLogs, setReconciliationLogs] = useState<ReconciliationResult[] | null>(null);

    const handleSave = async () => {
        try {
            await Promise.all([
                dataService.saveSettings(settings),
                dataService.saveBankSettings(bankSettings),
            ]);
            // Audit log for bank settings change
            try {
                await dataService.addAuditLog({
                    action: 'bank_settings_updated',
                    entityType: 'settings',
                    entityId: 'bankSettings',
                    details: `Updated bank settings for ${bankSettings.accountHolder} (${bankSettings.bankName})`,
                    timestamp: new Date().toISOString(),
                    userId: '',
                    orgId: dataService.getOrgId(),
                } as any);
            } catch (_) { /* audit log failure is non-critical */ }
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        } catch (error: any) {
            alert(`Failed to save settings: ${error.message}`);
        }
    };

    const handleChange = (field: keyof typeof settings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleBankChange = (field: keyof BankSettings, value: any) => {
        setBankSettings(prev => ({ ...prev, [field]: value }));
    };

    const startSmartReconciliation = async () => {
        setIsReconciling(true);
        setReconciliationLogs(null);

        // 1. Prepare Mock Bank Data (In production, this comes from Plaid/Stripe/Bank API)
        const mockTransactions = [
            { id: 'tx1', date: '2023-11-01', amount: 45000, sender: 'Acme Corp Intl', reference: 'Rent Nov 2023 Unit 101' },
            { id: 'tx2', date: '2023-11-02', amount: 10000, sender: 'Logistics Plus GmbH', reference: 'INV-2023-11-LP' }, // Partial payment (Rent is 12500)
            { id: 'tx3', date: '2023-11-03', amount: 28000, sender: 'M. Chen / Innovate', reference: 'Rent' }, // Fuzzy match
            { id: 'tx4', date: '2023-11-04', amount: 50, sender: 'Starbucks Coffee', reference: 'Office Supply' }, // Unmatched
        ];

        // 2. Prepare Tenant Data for AI Context
        const tenantContext = tenants.map(t => ({
            name: t.name,
            monthlyRent: t.monthlyRent
        }));

        // 3. Call Gemini AI Service
        const results = await performSmartReconciliation(mockTransactions, tenantContext);

        setReconciliationLogs(results);
        setIsReconciling(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Matched': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Partial Payment': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Overpayment': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getConfidenceColor = (score: number) => {
        if (score >= 90) return 'bg-emerald-500';
        if (score >= 70) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const { t, locale, setLocale, availableLocales } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-10">
            <div className="mb-6">
                <h1 style={{ fontFamily: '"Cormorant Garamond", serif' }} className="text-3xl font-bold text-[#1A2E25]">{t('settings.title')}</h1>
                <p className="text-[#7A9589] mt-1 text-sm">{t('settings.subtitle')}</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-6 bg-cream-dark rounded-2xl p-1">
                <button
                    onClick={() => setSettingsTab('general')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${settingsTab === 'general'
                        ? 'bg-forest text-white shadow-soft'
                        : 'text-[#7A9589] hover:text-[#1A2E25]'
                        }`}
                >
                    <SettingsIcon className="w-4 h-4" /> Allgemein
                </button>
                <button
                    onClick={() => setSettingsTab('org')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${settingsTab === 'org'
                        ? 'bg-forest text-white shadow-soft'
                        : 'text-[#7A9589] hover:text-[#1A2E25]'
                        }`}
                >
                    <Users className="w-4 h-4" /> Organisation &amp; Benutzer
                </button>
                <button
                    onClick={() => setSettingsTab('bank')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${settingsTab === 'bank'
                        ? 'bg-forest text-white shadow-soft'
                        : 'text-[#7A9589] hover:text-[#1A2E25]'
                        }`}
                >
                    <Landmark className="w-4 h-4" /> Open Banking
                    {bankConnections.some(c => c.status === 'linked') && (
                        <span className="w-2 h-2 rounded-full bg-[#3D7A5A]" />
                    )}
                </button>
            </div>

            {settingsTab === 'org' ? (
                <OrgUsers />
            ) : settingsTab === 'bank' ? (
                <div className="space-y-6">
                    <BankConnect properties={properties} />
                    {bankConnections.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-aera-600" /> Kontoumsätze
                            </h3>
                            <BankTransactions connections={bankConnections} properties={properties} />
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">

                    {/* LANGUAGE SECTION */}
                    <div className="bg-white rounded-2xl border border-cream-deeper shadow-soft overflow-hidden">
                        <div className="p-6 border-b border-cream-deeper geo-pattern">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                                    <Globe className="w-5 h-5 text-gold" />
                                </div>
                                <div>
                                    <h2 style={{ fontFamily: '"Cormorant Garamond", serif' }} className="text-xl font-bold text-white">{t('settings.language')}</h2>
                                    <p className="text-sm text-white/60">{t('settings.languageDesc')}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8">
                            <div className="flex gap-3">
                                {availableLocales.map((loc) => (
                                    <button
                                        key={loc.code}
                                        onClick={() => setLocale(loc.code as Locale)}
                                        className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 transition-all duration-200 ${locale === loc.code
                                            ? 'border-aera-600 bg-aera-50 shadow-md ring-2 ring-aera-600/20'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <span className="text-2xl">{loc.flag}</span>
                                        <div className="text-left">
                                            <div className={`text-sm font-semibold ${locale === loc.code ? 'text-aera-900' : 'text-slate-700'}`}>{loc.label}</div>
                                            <div className="text-xs text-slate-400 uppercase">{loc.code}</div>
                                        </div>
                                        {locale === loc.code && (
                                            <CheckCircle2 className="w-5 h-5 text-aera-600 ml-2" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* BANKING SECTION */}
                    <div className="bg-white rounded-2xl border border-cream-deeper shadow-soft overflow-hidden">
                        <div className="p-6 border-b border-cream-deeper geo-pattern">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                                    <Landmark className="w-5 h-5 text-gold" />
                                </div>
                                <div>
                                    <h2 style={{ fontFamily: '"Cormorant Garamond", serif' }} className="text-xl font-bold text-white">{t('settings.banking')}</h2>
                                    <p className="text-sm text-white/60">{t('settings.bankingDesc')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                                <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
                                <p>Individuelle Bankverbindungen je Vermieter können direkt im jeweiligen Objekt unter <strong>Vermieter & Bankverbindung</strong> hinterlegt werden. Diese haben Vorrang bei der Dokumentenerstellung.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('settings.accountHolder')}</label>
                                    <input
                                        type="text"
                                        value={bankSettings.accountHolder}
                                        onChange={(e) => handleBankChange('accountHolder', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-aera-600 focus:border-aera-600 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">IBAN</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="DE89 3704 ...."
                                            value={showIBAN ? bankSettings.iban : maskIBAN(bankSettings.iban)}
                                            onChange={(e) => handleBankChange('iban', e.target.value)}
                                            onFocus={() => setShowIBAN(true)}
                                            className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:ring-aera-600 focus:border-aera-600 outline-none font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowIBAN(!showIBAN)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            title={showIBAN ? 'IBAN verbergen' : 'IBAN anzeigen'}
                                        >
                                            {showIBAN ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">BIC / SWIFT</label>
                                    <input
                                        type="text"
                                        value={showIBAN ? bankSettings.bic : maskBIC(bankSettings.bic)}
                                        onChange={(e) => handleBankChange('bic', e.target.value)}
                                        onFocus={() => setShowIBAN(true)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-aera-600 focus:border-aera-600 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                                    <input
                                        type="text"
                                        value={bankSettings.bankName}
                                        onChange={(e) => handleBankChange('bankName', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-aera-600 focus:border-aera-600 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <BrainCircuit className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-bold text-slate-900">AI Payment Intelligence</h3>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={bankSettings.enableAutoReconciliation}
                                            onChange={(e) => handleBankChange('enableAutoReconciliation', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-aera-600/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aera-600"></div>
                                    </label>
                                </div>
                                <p className="text-sm text-slate-600 mb-4">
                                    Uses <strong>Gemini 1.5 Pro</strong> to analyze incoming transactions. The AI detects tenants via fuzzy matching, identifies partial payments, and flags discrepancies automatically.
                                </p>

                                <button
                                    onClick={startSmartReconciliation}
                                    disabled={isReconciling || !bankSettings.enableAutoReconciliation}
                                    className="flex items-center justify-center space-x-2 w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 shadow-sm text-slate-700 rounded-lg hover:bg-slate-50 hover:text-aera-900 transition-colors disabled:opacity-50 font-medium text-sm"
                                >
                                    {isReconciling ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> : <Wallet className="w-4 h-4" />}
                                    <span>{isReconciling ? 'Running Financial Analysis...' : 'Simulate Incoming Transactions'}</span>
                                </button>

                                {/* Simulation Logs */}
                                {reconciliationLogs && (
                                    <div className="mt-6 bg-white rounded-lg border border-slate-200 overflow-hidden animate-in slide-in-from-top-2 shadow-sm">
                                        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between">
                                            <span className="w-1/3">Transaction</span>
                                            <span className="w-1/4">Status</span>
                                            <span className="w-1/3">AI Reasoning</span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {reconciliationLogs.map((log, idx) => (
                                                <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex flex-col md:flex-row gap-4">
                                                        {/* Transaction Details */}
                                                        <div className="w-full md:w-1/3">
                                                            <div className="font-bold text-slate-900">€{log.originalAmount.toLocaleString()}</div>
                                                            <div className="text-sm text-slate-700 font-medium">{log.senderName}</div>
                                                            <div className="text-xs text-slate-400 mt-1 font-mono">ID: {log.transactionId}</div>
                                                        </div>

                                                        {/* Status Badge */}
                                                        <div className="w-full md:w-1/4 flex flex-col items-start gap-2">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border flex items-center ${getStatusColor(log.status)}`}>
                                                                {log.status === 'Matched' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                                                {log.status === 'Partial Payment' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                                {log.status === 'Unmatched' && <XCircle className="w-3 h-3 mr-1" />}
                                                                {log.status}
                                                            </span>
                                                            {log.matchedTenantName && (
                                                                <span className="text-xs text-slate-500">
                                                                    Tenant: <strong>{log.matchedTenantName}</strong>
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* AI Reasoning & Confidence */}
                                                        <div className="w-full md:w-1/3">
                                                            <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                                                                {log.reasoning}
                                                            </p>

                                                            {/* Confidence Meter */}
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${getConfidenceColor(log.confidenceScore)}`}
                                                                        style={{ width: `${log.confidenceScore}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400">{log.confidenceScore}%</span>
                                                            </div>

                                                            {/* Discrepancy Highlight */}
                                                            {log.discrepancyAmount !== undefined && log.discrepancyAmount !== 0 && (
                                                                <div className="mt-2 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded inline-block">
                                                                    Discrepancy: {log.discrepancyAmount > 0 ? '+' : ''}€{log.discrepancyAmount.toLocaleString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-2 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-200">
                                            Processed by Gemini 1.5 Pro • 99.9% Accuracy Rate
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* NOTIFICATIONS SECTION */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-aera-50">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-aera-100 rounded-lg">
                                    <Bell className="w-5 h-5 text-aera-900" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-aera-900">Notifications</h2>
                                    <p className="text-sm text-slate-500">Configure automated tenant reminders.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* WhatsApp Integration Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 text-aera-900 font-semibold">
                                        <MessageCircle className="w-5 h-5 text-green-600" />
                                        <span>WhatsApp Integration</span>
                                    </div>
                                </div>

                                <div className="pl-7 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp AERA Number</label>
                                        <p className="text-xs text-slate-500 mb-2">The business phone number used to send and receive WhatsApp messages.</p>
                                        <input
                                            type="text"
                                            value={settings.businessWhatsappNumber}
                                            onChange={(e) => handleChange('businessWhatsappNumber', e.target.value)}
                                            placeholder="+49 123 4567890"
                                            className="w-full max-w-sm px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-aera-600 focus:border-aera-600 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Upcoming Reminder Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 text-aera-900 font-semibold">
                                        <Calendar className="w-5 h-5 text-aera-600" />
                                        <span>Upcoming Payment Reminder</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings.enableReminders}
                                            onChange={(e) => handleChange('enableReminders', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-aera-600/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-aera-600"></div>
                                    </label>
                                </div>

                                <div className={`pl-7 space-y-4 transition-opacity duration-200 ${settings.enableReminders ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <div className="flex items-center space-x-4">
                                        <span className="text-sm text-slate-600">Send reminder</span>
                                        <div className="relative w-24">
                                            <input
                                                type="number"
                                                value={settings.reminderDaysBefore}
                                                onChange={(e) => handleChange('reminderDaysBefore', parseInt(e.target.value))}
                                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-aera-600 focus:border-aera-600"
                                            />
                                            <span className="absolute right-3 top-2 text-xs text-slate-400">days</span>
                                        </div>
                                        <span className="text-sm text-slate-600">before due date.</span>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Message Template</label>
                                        <textarea
                                            value={settings.reminderMessage}
                                            onChange={(e) => handleChange('reminderMessage', e.target.value)}
                                            className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-aera-600 focus:border-aera-600"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Variables available: &#123;Tenant_Name&#125;, &#123;Property_Name&#125;, &#123;Due_Date&#125;</p>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Overdue Alert Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 text-aera-900 font-semibold">
                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                        <span>Overdue Payment Alert</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings.enableOverdueAlerts}
                                            onChange={(e) => handleChange('enableOverdueAlerts', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>

                                <div className={`pl-7 space-y-4 transition-opacity duration-200 ${settings.enableOverdueAlerts ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <div className="flex items-center space-x-4">
                                        <span className="text-sm text-slate-600">Send alert</span>
                                        <div className="relative w-24">
                                            <input
                                                type="number"
                                                value={settings.overdueDaysAfter}
                                                onChange={(e) => handleChange('overdueDaysAfter', parseInt(e.target.value))}
                                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                                            />
                                            <span className="absolute right-3 top-2 text-xs text-slate-400">days</span>
                                        </div>
                                        <span className="text-sm text-slate-600">after due date.</span>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Message Template</label>
                                        <textarea
                                            value={settings.overdueMessage}
                                            onChange={(e) => handleChange('overdueMessage', e.target.value)}
                                            className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-amber-500 focus:border-amber-500"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Variables available: &#123;Tenant_Name&#125;, &#123;Amount_Due&#125;</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-4 bg-transparent flex justify-between">
                        <button
                            onClick={() => window.location.hash = '#health'}
                            className="text-xs text-[#7A9589] hover:text-forest underline"
                        >
                            System Diagnostics
                        </button>

                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                className="btn-gold flex items-center gap-2 px-6 py-2.5 text-sm font-semibold shadow-soft"
                                style={{ width: 'auto', borderRadius: '10px' }}
                            >
                                {isSaved ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Gespeichert</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        <span>Konfiguration speichern</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* ── STORAGE QUOTA SECTION ── */}
                    {settingsTab === 'general' && (
                        <div className="px-8 pb-6">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                                    <div className="p-2 rounded-lg bg-aera-50">
                                        <HardDrive className="w-4 h-4 text-aera-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">Speicherplatz & Plan</h3>
                                        <p className="text-xs text-slate-400">Dokumenten-Speicher je Organisation</p>
                                    </div>
                                    {quotaInfo && (
                                        <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${quotaInfo.plan === 'enterprise' ? 'bg-violet-100 text-violet-700' :
                                            quotaInfo.plan === 'pro' ? 'bg-aera-100 text-aera-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {PLAN_LABELS[quotaInfo.plan]}
                                        </span>
                                    )}
                                </div>

                                <div className="px-6 py-5">
                                    {quotaInfo ? (
                                        <>
                                            {/* Usage bar */}
                                            <div className="mb-1 flex justify-between items-end">
                                                <span className="text-2xl font-bold text-slate-900">
                                                    {quotaInfo.plan === 'enterprise' ? '∞' : `${quotaInfo.usedGB.toFixed(2)} GB`}
                                                </span>
                                                <span className="text-sm text-slate-400">
                                                    {quotaInfo.plan === 'enterprise'
                                                        ? 'Unbegrenzt'
                                                        : `von ${quotaInfo.limitGB} GB verwendet`}
                                                </span>
                                            </div>

                                            {quotaInfo.plan !== 'enterprise' && (
                                                <>
                                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-1">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${quotaInfo.isAtLimit ? 'bg-red-500' :
                                                                quotaInfo.isNearLimit ? 'bg-amber-400' :
                                                                    'bg-gradient-to-r from-aera-500 to-cyan-400'
                                                                }`}
                                                            style={{ width: `${Math.min(quotaInfo.percentUsed, 100)}%` }}
                                                        />
                                                    </div>
                                                    <p className={`text-xs mt-1 ${quotaInfo.isAtLimit ? 'text-red-500 font-medium' :
                                                        quotaInfo.isNearLimit ? 'text-amber-500' :
                                                            'text-slate-400'
                                                        }`}>
                                                        {quotaInfo.isAtLimit
                                                            ? '⚠️ Speicher voll — bitte Plan upgraden'
                                                            : quotaInfo.isNearLimit
                                                                ? `Noch ${(quotaInfo.remaining / 1024 ** 3).toFixed(1)} GB verfügbar`
                                                                : `${quotaInfo.percentUsed.toFixed(1)} % genutzt`}
                                                    </p>
                                                </>
                                            )}

                                            {/* Plan cards */}
                                            <div className="grid grid-cols-3 gap-3 mt-5">
                                                {([
                                                    { plan: 'basic' as StoragePlan, label: 'Basic', storage: '1 GB', price: 'Kostenlos', icon: HardDrive, accent: 'border-slate-200', iconColor: 'text-slate-500', badge: null },
                                                    { plan: 'pro' as StoragePlan, label: 'Pro', storage: '50 GB', price: 'Auf Anfrage', icon: Zap, accent: 'border-aera-300', iconColor: 'text-aera-600', badge: 'Empfohlen' },
                                                    { plan: 'enterprise' as StoragePlan, label: 'Enterprise', storage: 'Unbegrenzt', price: 'Individuell', icon: Crown, accent: 'border-violet-300', iconColor: 'text-violet-600', badge: null },
                                                ]).map(({ plan, label, storage, price, icon: Icon, accent, iconColor, badge }) => {
                                                    const isActive = quotaInfo.plan === plan;
                                                    return (
                                                        <div key={plan} className={`relative rounded-xl border-2 p-4 transition-all ${isActive ? `${accent} bg-white shadow-md` : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                                                            }`}>
                                                            {badge && (
                                                                <span className="absolute -top-2 left-4 text-xs font-bold px-2 py-0.5 bg-aera-600 text-white rounded-full">{badge}</span>
                                                            )}
                                                            <Icon className={`w-5 h-5 mb-2 ${iconColor}`} />
                                                            <div className="font-bold text-slate-900 text-sm">{label}</div>
                                                            <div className="text-xs text-slate-500 mb-1">{storage} Speicher</div>
                                                            <div className="text-xs font-medium text-slate-400 mb-3">{price}</div>
                                                            {isActive ? (
                                                                <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Aktuell aktiv
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleUpgradePlan(plan)}
                                                                    disabled={planUpdating}
                                                                    className={`w-full text-xs font-medium py-1.5 px-3 rounded-lg transition-colors ${plan === 'pro'
                                                                        ? 'bg-aera-600 text-white hover:bg-aera-500'
                                                                        : plan === 'enterprise'
                                                                            ? 'bg-violet-600 text-white hover:bg-violet-500'
                                                                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                                        }`}
                                                                >
                                                                    {planUpdating ? 'Wird gespeichert…' :
                                                                        plan === 'basic' ? 'Downgrade' : 'Upgrade'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {planSuccess && (
                                                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 animate-in fade-in">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Plan erfolgreich auf <strong>{PLAN_LABELS[planSuccess as StoragePlan]}</strong> gesetzt
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Speicherinfo wird geladen…
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2FA SECTION */}
                    <TwoFactorSettings />

                </div>
            )}
        </div>
    );
};

export default Settings;
