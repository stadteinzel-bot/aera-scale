// ===== AERA SCALE — Bank Connect (Tink) =====
// Tink uses a hosted Link UI — no custom bank picker needed.
// Flow: Button click → Cloud Function generates Tink Link URL → redirect →
//       bank consent → redirect back → tinkHandleCallback stores accounts.

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useOrg } from '../services/OrgContext';
import { createTinkLink, handleTinkCallback, type BankConnection } from '../services/bankingService';
import { dataService } from '../services/dataService';
import type { Property } from '../types';
import {
    Landmark, CheckCircle2, Clock, AlertTriangle,
    ExternalLink, Loader2, ChevronDown, Building,
} from 'lucide-react';

const MARKETS = [
    { code: 'DE', label: '🇩🇪 Deutschland' },
    { code: 'AT', label: '🇦🇹 Österreich' },
    { code: 'CH', label: '🇨🇭 Schweiz' },
    { code: 'NL', label: '🇳🇱 Niederlande' },
    { code: 'FR', label: '🇫🇷 Frankreich' },
    { code: 'GB', label: '🇬🇧 United Kingdom' },
];

function statusBadge(s: BankConnection['status']) {
    return {
        linked: { color: 'bg-emerald-100 text-emerald-700', label: 'Verbunden', Icon: CheckCircle2 },
        pending: { color: 'bg-amber-100 text-amber-700', label: 'Ausstehend', Icon: Clock },
        expired: { color: 'bg-red-100 text-red-700', label: 'Abgelaufen', Icon: AlertTriangle },
    }[s];
}

export const BankConnect: React.FC<{ properties?: Property[] }> = ({ properties: propsProp }) => {
    const { orgId } = useOrg();
    const [market, setMarket] = useState('DE');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connections, setConnections] = useState<BankConnection[]>([]);
    const [ownProperties, setOwnProperties] = useState<Property[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

    // Use properties from parent if provided; otherwise fetch independently (fallback)
    const properties = propsProp ?? ownProperties;

    // Fallback: load properties only when not provided by parent and orgId is ready
    useEffect(() => {
        if (propsProp !== undefined || !orgId) return;
        dataService.getProperties().then(setOwnProperties);
    }, [orgId, propsProp]);

    // Live listener for bank connections
    useEffect(() => {
        if (!orgId) return;
        const q = query(
            collection(db, 'organizations', orgId, 'bankConnections'),
            orderBy('linkedAt', 'desc')
        );
        return onSnapshot(q, snap =>
            setConnections(snap.docs.map(d => ({ connectionId: d.id, ...d.data() } as BankConnection)))
        );
    }, [orgId]);

    // Handle Tink OAuth callback — ?code=...&state=orgId|propertyId
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state'); // "orgId" or "orgId|propertyId"
        if (!code || !state) return;

        // Parse orgId and optional propertyId from state
        const [stateOrgId, statePropertyId] = state.split('|');
        if (stateOrgId !== orgId) return;

        // Clear params from URL immediately
        window.history.replaceState({}, '', window.location.pathname);
        setLoading(true);
        handleTinkCallback(orgId, code, statePropertyId)
            .then(() => setError(null))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [orgId]);

    const handleConnect = async () => {
        setLoading(true);
        setError(null);
        try {
            const redirectUri = `${window.location.origin}${window.location.pathname}`;
            const { linkUrl } = await createTinkLink(
                orgId,
                redirectUri,
                market,
                selectedPropertyId || undefined
            );
            window.location.href = linkUrl;
        } catch (e: any) {
            setError(e.message);
            setLoading(false);
        }
    };

    const getPropertyName = (propertyId?: string) =>
        propertyId ? (properties.find(p => p.id === propertyId)?.name ?? propertyId) : null;

    return (
        <div className="space-y-6">
            {/* Existing connections */}
            {connections.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Verknüpfte Bankkonten</h3>
                    {connections.map(c => {
                        const badge = statusBadge(c.status);
                        const propName = getPropertyName(c.propertyId);
                        return (
                            <div key={c.connectionId} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <div className="w-10 h-10 bg-aera-50 rounded-lg flex items-center justify-center">
                                    <Landmark className="w-5 h-5 text-aera-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-900">
                                        {c.accounts?.[0]?.name ?? 'Bankkonto'}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {c.accounts?.length ?? 0} Konto{(c.accounts?.length ?? 0) !== 1 ? 'en' : ''}
                                        {c.accounts?.[0]?.iban ? ` · ${c.accounts[0].iban}` : ''}
                                    </p>
                                    {propName && (
                                        <p className="text-xs text-aera-600 flex items-center gap-1 mt-0.5">
                                            <Building className="w-3 h-3" />
                                            {propName}
                                        </p>
                                    )}
                                </div>
                                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                                    <badge.Icon className="w-3 h-3" />
                                    {badge.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Connect new bank via Tink Link */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-aera-900 to-aera-800 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                            <Landmark className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold">Bank verbinden</h2>
                            <p className="text-xs text-aera-300">via Tink (Visa) — PSD2 Open Banking</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {/* Property selector */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">
                            Immobilie zuordnen <span className="text-slate-400">(optional)</span>
                        </label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <select
                                value={selectedPropertyId}
                                onChange={e => setSelectedPropertyId(e.target.value)}
                                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-aera-400"
                            >
                                <option value="">— Alle Objekte / Kein spezifisches Objekt</option>
                                {properties.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} · {p.address}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Transaktionen werden dann diesem Objekt zugeordnet und separat gefiltert.
                        </p>
                    </div>

                    {/* Market selector */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Land</label>
                        <div className="relative">
                            <select
                                value={market}
                                onChange={e => setMarket(e.target.value)}
                                className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-aera-400"
                            >
                                {MARKETS.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* How it works */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-600">
                        <p className="font-medium text-slate-800">So funktioniert es:</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                            <li>Wähle optional eine Immobilie und klicke "Bank verbinden"</li>
                            <li>Wähle deine Bank in Tink (PSD2-gesichert)</li>
                            <li>Kontoumsätze werden automatisch importiert</li>
                            <li>Mietzahlungen werden automatisch zugeordnet</li>
                        </ol>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleConnect}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-aera-600 hover:bg-aera-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                        {loading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird verbunden…</>
                            : <><ExternalLink className="w-4 h-4" /> Bank verbinden</>
                        }
                    </button>
                    <p className="text-center text-xs text-slate-400">
                        Verschlüsselt via Tink (Visa) · PSD2 konform · Deine Zugangsdaten werden nie gespeichert
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BankConnect;
