// ===== AERA SCALE — Bank Transactions Component =====
// Shows Firestore-synced bank transactions with reconciliation status.
// "Sync" button triggers gcSyncTransactions Cloud Function to fetch latest
// transactions and auto-match them against open rent invoices.
// Supports filtering by Immobilie (property).

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useOrg } from '../services/OrgContext';
import { syncTinkTransactions, type BankConnection, type StoredTransaction } from '../services/bankingService';
import { dataService } from '../services/dataService';
import type { Property } from '../types';
import {
    RefreshCw, CheckCircle2, Circle, ArrowUpRight, ArrowDownLeft,
    Loader2, AlertTriangle, CalendarDays, Building,
} from 'lucide-react';

function formatDate(d: string): string {
    if (!d) return '—';
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

function formatEur(n: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

interface BankTransactionsProps {
    connections: BankConnection[];
    properties?: Property[];
}

export const BankTransactions: React.FC<BankTransactionsProps> = ({ connections, properties: propsProp }) => {
    const { orgId } = useOrg();
    const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ synced: number; reconciled: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ownProperties, setOwnProperties] = useState<Property[]>([]);
    const [filterPropertyId, setFilterPropertyId] = useState<string>('');

    // Use properties from parent if provided; otherwise fetch independently
    const properties = propsProp ?? ownProperties;

    // Fallback: load properties only when not provided by parent and orgId is ready
    useEffect(() => {
        if (propsProp !== undefined || !orgId) return;
        dataService.getProperties().then(setOwnProperties);
    }, [orgId, propsProp]);

    // Live Firestore listener for banktransactions
    useEffect(() => {
        if (!orgId) return;
        const q = query(
            collection(db, 'organizations', orgId, 'bankTransactions'),
            orderBy('date', 'desc')
        );
        return onSnapshot(q, snap =>
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoredTransaction)))
        );
    }, [orgId]);

    const linkedConnections = connections.filter(c => c.status === 'linked');

    // Filter transactions by selected property
    const filteredTransactions = filterPropertyId
        ? transactions.filter(t => t.propertyId === filterPropertyId)
        : transactions;

    const handleSync = async () => {
        if (!linkedConnections.length) return;
        setSyncing(true);
        setError(null);
        setSyncResult(null);
        try {
            // Sync only connections for the selected property (or all if no filter)
            const connectionsToSync = filterPropertyId
                ? linkedConnections.filter(c => c.propertyId === filterPropertyId || !c.propertyId)
                : linkedConnections;

            let totalSynced = 0, totalReconciled = 0;
            for (const c of connectionsToSync) {
                const r = await syncTinkTransactions(orgId, c.connectionId);
                totalSynced += r.synced;
                totalReconciled += r.reconciled;
            }
            setSyncResult({ synced: totalSynced, reconciled: totalReconciled });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSyncing(false);
        }
    };

    const matched = filteredTransactions.filter(t => t.matchStatus === 'matched').length;
    const unmatched = filteredTransactions.filter(t => t.matchStatus === 'unmatched' && t.amount > 0).length;

    const getPropertyName = (propertyId?: string) =>
        propertyId ? (properties.find(p => p.id === propertyId)?.name ?? null) : null;

    return (
        <div className="space-y-4">
            {/* Property Filter */}
            {properties.length > 0 && (
                <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="relative flex-1 max-w-xs">
                        <select
                            value={filterPropertyId}
                            onChange={e => setFilterPropertyId(e.target.value)}
                            className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-aera-400"
                        >
                            <option value="">Alle Immobilien</option>
                            {properties.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {filterPropertyId && (
                        <span className="text-xs text-aera-600 font-medium bg-aera-50 px-2 py-1 rounded-full">
                            {filteredTransactions.length} Transaktionen
                        </span>
                    )}
                </div>
            )}

            {/* Stats + Sync bar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-4 flex-1">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-aera-900">{filteredTransactions.length}</p>
                        <p className="text-xs text-slate-500">Transaktionen</p>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-600">{matched}</p>
                        <p className="text-xs text-slate-500">Zugeordnet</p>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="text-center">
                        <p className="text-2xl font-bold text-amber-500">{unmatched}</p>
                        <p className="text-xs text-slate-500">Offen</p>
                    </div>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing || linkedConnections.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-aera-600 hover:bg-aera-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                    {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {filterPropertyId ? 'Objekt synchronisieren' : 'Synchronisieren'}
                </button>
            </div>

            {/* Sync result banner */}
            {syncResult && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                        <strong>{syncResult.synced}</strong> neue Transaktionen synchronisiert,
                        <strong> {syncResult.reconciled}</strong> Rechnungen automatisch zugeordnet.
                    </span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Transaction list */}
            {filteredTransactions.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">Keine Transaktionen</p>
                    <p className="text-sm mt-1">
                        {filterPropertyId
                            ? 'Keine Transaktionen für diese Immobilie'
                            : linkedConnections.length > 0
                                ? 'Klicke "Synchronisieren" um Umsätze abzurufen'
                                : 'Verbinde zuerst ein Bankkonto'}
                    </p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="divide-y divide-slate-100">
                        {filteredTransactions.map(tx => {
                            const propName = getPropertyName(tx.propertyId);
                            return (
                                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                                    {/* Amount icon */}
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tx.amount > 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                        {tx.amount > 0
                                            ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                                            : <ArrowUpRight className="w-4 h-4 text-red-400" />}
                                    </div>

                                    {/* Description */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{tx.description || '—'}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-slate-400">{formatDate(tx.date)}</p>
                                            {propName && (
                                                <span className="text-xs text-aera-500 flex items-center gap-0.5">
                                                    <Building className="w-3 h-3" />
                                                    {propName}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <p className={`text-sm font-bold shrink-0 ${tx.amount > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                        {tx.amount > 0 ? '+' : ''}{formatEur(tx.amount)}
                                    </p>

                                    {/* Match status */}
                                    {tx.amount > 0 && (
                                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 ${tx.matchStatus === 'matched'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-50 text-amber-600'
                                            }`}>
                                            {tx.matchStatus === 'matched'
                                                ? <><CheckCircle2 className="w-3 h-3" /> Zugeordnet</>
                                                : <><Circle className="w-3 h-3" /> Offen</>}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BankTransactions;
