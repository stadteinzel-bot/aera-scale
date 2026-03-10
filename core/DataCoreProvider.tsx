// ===== AERA SCALE — DataCore Provider =====
// Central React Context that loads ALL data once, provides it to all modules,
// and dispatches mutations through the event bus.
// Replaces the per-module useEffect data loading anti-pattern.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { dataService } from '../services/dataService';
import { eventBus, DataCoreEvent } from './eventBus';
import type { EntityName, EntityMap } from './entitySchema';
import type {
    Property, Tenant, MaintenanceTicket, RentInvoice,
    Payment, OperatingCostEntry, Settlement, PropertyDocument, Message,
} from '../types';
import type { Contract, RentLineItem } from '../types/rentTypes';

// ---------------------------------------------------------------------------
// KPI TYPES (computed from DataCore state)
// ---------------------------------------------------------------------------

export interface DashboardKPIs {
    // Revenue
    mrrTotal: number;
    invoicedThisMonth: number;
    collectedThisMonth: number;
    outstandingAmount: number;

    // Operations
    occupancyRate: number;
    totalUnits: number;
    occupiedUnits: number;
    activeTickets: number;
    criticalTickets: number;

    // Tenants
    totalTenants: number;
    tenantsLate: number;
    leasesExpiringSoon: number;

    // Invoices
    overdueInvoices: number;
    draftInvoices: number;

    // Computed month (for chart)
    currentMonth: string;
}

// ---------------------------------------------------------------------------
// DATACORE CONTEXT TYPE
// ---------------------------------------------------------------------------

export interface DataCoreContextType {
    // Raw data (all entities)
    data: EntityMap;

    // Computed KPIs
    kpis: DashboardKPIs;

    // Loading state
    isLoading: boolean;
    loadError: string | null;
    lastUpdated: Date | null;

    // Mutation dispatcher — writes to Firestore + emits event + updates local state
    dispatch: (action: DataCoreAction) => Promise<void>;

    // Force reload all data
    reload: (collections?: EntityName[]) => Promise<void>;

    // Lookup helpers
    getPropertyById: (id: string) => Property | undefined;
    getTenantById: (id: string) => Tenant | undefined;
    getUnitRent: (propertyId: string, unitId?: string) => number;
}

// ---------------------------------------------------------------------------
// ACTIONS
// ---------------------------------------------------------------------------

export type DataCoreAction =
    | { type: 'property:add'; payload: Omit<Property, 'id'> }
    | { type: 'property:update'; id: string; payload: Partial<Property> }
    | { type: 'property:delete'; id: string }

    | { type: 'tenant:add'; payload: Omit<Tenant, 'id'> }
    | { type: 'tenant:update'; id: string; payload: Partial<Tenant> }
    | { type: 'tenant:delete'; id: string }

    | { type: 'ticket:add'; payload: Omit<MaintenanceTicket, 'id'> }
    | { type: 'ticket:update'; id: string; payload: Partial<MaintenanceTicket> }
    | { type: 'ticket:delete'; id: string }

    | { type: 'invoice:add'; payload: Omit<RentInvoice, 'id'> }
    | { type: 'invoice:update'; id: string; payload: Partial<RentInvoice> }
    | { type: 'invoice:delete'; id: string }

    | { type: 'payment:add'; payload: Omit<Payment, 'id'> }
    | { type: 'payment:delete'; id: string }

    | { type: 'cost:add'; payload: Omit<OperatingCostEntry, 'id'> }
    | { type: 'cost:update'; id: string; payload: Partial<OperatingCostEntry> }
    | { type: 'cost:delete'; id: string }

    | { type: 'settlement:add'; payload: Omit<Settlement, 'id'> }
    | { type: 'settlement:update'; id: string; payload: Partial<Settlement> }
    | { type: 'settlement:delete'; id: string }

    | { type: 'contract:add'; payload: Omit<Contract, 'id'> }
    | { type: 'contract:update'; id: string; payload: Partial<Contract> }
    | { type: 'contract:delete'; id: string }

    | { type: 'lineItem:add'; payload: Omit<RentLineItem, 'id'> }
    | { type: 'lineItem:update'; id: string; payload: Partial<RentLineItem> }
    | { type: 'lineItem:delete'; id: string }

    | { type: 'document:add'; payload: Omit<PropertyDocument, 'id'> }
    | { type: 'document:update'; id: string; payload: Partial<PropertyDocument> }
    | { type: 'document:delete'; id: string }

    | { type: 'message:add'; payload: Omit<Message, 'id'> }
    | { type: 'message:update'; id: string; payload: Partial<Message> };

// ---------------------------------------------------------------------------
// KPI COMPUTATION (pure function)
// ---------------------------------------------------------------------------

function computeKPIs(data: EntityMap): DashboardKPIs {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Build property lookup map for O(1) access (replaces O(n) Array.find)
    const propertyMap = new Map(data.properties.map(p => [p.id, p]));

    // Revenue: derive from tenant→unit mapping (authoritative source = PropertyUnit.rentMonthly)
    let mrrTotal = 0;
    for (const tenant of data.tenants) {
        const prop = propertyMap.get(tenant.propertyId);
        const unit = prop?.units?.find(u => u.id === tenant.unitId);
        mrrTotal += unit?.rentMonthly ?? tenant.monthlyRent ?? 0;
    }

    // Units
    const allUnits = data.properties.flatMap(p => p.units || []);
    const occupiedUnits = allUnits.filter(u => u.status === 'Occupied');

    // Invoices this month
    const monthInvoices = data.invoices.filter(i => i.period === currentMonth);
    const invoicedThisMonth = monthInvoices.reduce((a, i) => a + i.totalAmount, 0);
    const collectedThisMonth = data.payments
        .filter(p => p.date.startsWith(currentMonth))
        .reduce((a, p) => a + p.amount, 0);

    const overdueInvoices = data.invoices.filter(i => i.status === 'overdue').length;
    const draftInvoices = data.invoices.filter(i => i.status === 'draft').length;
    const outstandingAmount = data.invoices
        .filter(i => ['sent', 'partial', 'overdue'].includes(i.status))
        .reduce((a, i) => a + (i.totalAmount - i.paidAmount), 0);

    // Tickets
    const activeTickets = data.tickets.filter(t => t.status !== 'Resolved').length;
    const criticalTickets = data.tickets.filter(t =>
        t.status !== 'Resolved' && (t.priority === 'Emergency' || t.priority === 'High')
    ).length;

    // Tenants
    const tenantsLate = data.tenants.filter(t => t.status === 'Late' || t.status === 'Notice Given').length;
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const leasesExpiringSoon = data.tenants.filter(t => {
        if (!t.leaseEnd) return false;
        const end = new Date(t.leaseEnd);
        return end <= ninetyDaysFromNow && end > now;
    }).length;

    return {
        mrrTotal,
        invoicedThisMonth,
        collectedThisMonth,
        outstandingAmount,
        occupancyRate: allUnits.length > 0 ? Math.round((occupiedUnits.length / allUnits.length) * 100) : 0,
        totalUnits: allUnits.length,
        occupiedUnits: occupiedUnits.length,
        activeTickets,
        criticalTickets,
        totalTenants: data.tenants.length,
        tenantsLate,
        leasesExpiringSoon,
        overdueInvoices,
        draftInvoices,
        currentMonth,
    };
}

// ---------------------------------------------------------------------------
// EMPTY STATE
// ---------------------------------------------------------------------------

const EMPTY_DATA: EntityMap = {
    properties: [], tenants: [], tickets: [], invoices: [], payments: [],
    costs: [], settlements: [], contracts: [], lineItems: [], documents: [], messages: [],
};

const EMPTY_KPIS: DashboardKPIs = {
    mrrTotal: 0, invoicedThisMonth: 0, collectedThisMonth: 0, outstandingAmount: 0,
    occupancyRate: 0, totalUnits: 0, occupiedUnits: 0,
    activeTickets: 0, criticalTickets: 0,
    totalTenants: 0, tenantsLate: 0, leasesExpiringSoon: 0,
    overdueInvoices: 0, draftInvoices: 0, currentMonth: '',
};

// ---------------------------------------------------------------------------
// CONTEXT + PROVIDER
// ---------------------------------------------------------------------------

const DataCoreContext = createContext<DataCoreContextType | null>(null);

export const DataCoreProvider: React.FC<{ children: React.ReactNode; orgId: string }> = ({ children, orgId }) => {
    const [data, setData] = useState<EntityMap>(EMPTY_DATA);
    const [kpis, setKpis] = useState<DashboardKPIs>(EMPTY_KPIS);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const dataRef = useRef(data);
    dataRef.current = data;

    // ---- LOAD DATA (Two-Phase: Critical First, Rest Lazy) ----
    const reload = useCallback(async (collections?: EntityName[]) => {
        // Always init dataService with current orgId before any queries
        // This eliminates the race condition between OrgGate.useEffect and our useEffect
        if (!orgId) {
            console.warn('[DataCore] reload() called without orgId — skipping');
            setIsLoading(false);
            return;
        }
        dataService.init(orgId);
        setIsLoading(true);
        setLoadError(null);
        try {
            const all = !collections;

            // Phase 1: Critical collections needed for Dashboard KPIs
            const criticalCollections: EntityName[] = ['properties', 'tenants', 'tickets'];
            const isCritical = (name: EntityName) => all || collections!.includes(name);

            const phase1Fetchers = [
                isCritical('properties') ? dataService.getProperties() : Promise.resolve(dataRef.current.properties),
                isCritical('tenants') ? dataService.getTenants() : Promise.resolve(dataRef.current.tenants),
                isCritical('tickets') ? dataService.getTickets() : Promise.resolve(dataRef.current.tickets),
            ];

            const phase1Results = await Promise.allSettled(phase1Fetchers);
            const phase1Names = ['properties', 'tenants', 'tickets'];
            const phase1Resolved = phase1Results.map((r, i) => {
                if (r.status === 'fulfilled') return r.value;
                console.warn(`[DataCore] Failed to load ${phase1Names[i]}:`, (r as PromiseRejectedResult).reason?.message);
                return (dataRef.current as any)[phase1Names[i]] || [];
            });

            // Show dashboard immediately with critical data
            const partialData: EntityMap = {
                properties: phase1Resolved[0],
                tenants: phase1Resolved[1],
                tickets: phase1Resolved[2],
                invoices: dataRef.current.invoices,
                payments: dataRef.current.payments,
                costs: dataRef.current.costs,
                settlements: dataRef.current.settlements,
                contracts: dataRef.current.contracts,
                lineItems: dataRef.current.lineItems,
                documents: dataRef.current.documents,
                messages: dataRef.current.messages,
            };
            setData(partialData);
            setKpis(computeKPIs(partialData));
            setIsLoading(false); // Dashboard usable now

            // Phase 2: Load remaining collections in background
            const phase2Fetchers = [
                all || collections!.includes('invoices') ? dataService.getInvoices() : Promise.resolve(dataRef.current.invoices),
                all || collections!.includes('payments') ? dataService.getPayments() : Promise.resolve(dataRef.current.payments),
                all || collections!.includes('costs') ? dataService.getOperatingCosts() : Promise.resolve(dataRef.current.costs),
                all || collections!.includes('settlements') ? dataService.getSettlements() : Promise.resolve(dataRef.current.settlements),
                all || collections!.includes('contracts') ? dataService.getContracts() : Promise.resolve(dataRef.current.contracts),
                all || collections!.includes('lineItems') ? dataService.getRentLineItems() : Promise.resolve(dataRef.current.lineItems),
                all || collections!.includes('documents') ? dataService.getDocuments() : Promise.resolve(dataRef.current.documents),
                all || collections!.includes('messages') ? dataService.getMessages() : Promise.resolve(dataRef.current.messages),
            ];

            const phase2Results = await Promise.allSettled(phase2Fetchers);
            const phase2Names = ['invoices', 'payments', 'costs', 'settlements', 'contracts', 'lineItems', 'documents', 'messages'];
            const phase2Resolved = phase2Results.map((r, i) => {
                if (r.status === 'fulfilled') return r.value;
                console.warn(`[DataCore] Failed to load ${phase2Names[i]}:`, (r as PromiseRejectedResult).reason?.message);
                return (dataRef.current as any)[phase2Names[i]] || [];
            });

            const fullData: EntityMap = {
                properties: phase1Resolved[0],
                tenants: phase1Resolved[1],
                tickets: phase1Resolved[2],
                invoices: phase2Resolved[0],
                payments: phase2Resolved[1],
                costs: phase2Resolved[2],
                settlements: phase2Resolved[3],
                contracts: phase2Resolved[4],
                lineItems: phase2Resolved[5],
                documents: phase2Resolved[6],
                messages: phase2Resolved[7],
            };

            setData(fullData);
            setKpis(computeKPIs(fullData));
            setLastUpdated(new Date());

            // Auto-repair tenant rents (silent background)
            dataService.syncTenantRents().catch(() => { });

            eventBus.emit({ type: 'data:reloaded', payload: { collections: collections || Object.keys(EMPTY_DATA) as EntityName[] } });
        } catch (e: any) {
            const msg = e?.message || 'Unknown error loading data';
            console.error('[DataCore] Failed to load data:', e);
            setLoadError(msg);
            setIsLoading(false);
        }
    }, [orgId]);

    // ---- INITIAL LOAD (re-fires whenever orgId changes) ----
    useEffect(() => { if (orgId) reload(); }, [reload, orgId]);


    // ---- DISPATCH MUTATIONS ----
    const dispatch = useCallback(async (action: DataCoreAction) => {
        const current = dataRef.current;
        const type = action.type;

        try {
            if (type === 'property:add') {
                const saved = await dataService.addProperty(action.payload);
                setData(prev => { const next = { ...prev, properties: [...prev.properties, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'entity:created', entity: 'properties', payload: saved });

            } else if (type === 'property:update') {
                await dataService.updateProperty(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, properties: prev.properties.map(p => p.id === action.id ? { ...p, ...action.payload } : p) };
                    setKpis(computeKPIs(next));
                    return next;
                });
                eventBus.emit({ type: 'entity:updated', entity: 'properties', id: action.id, payload: action.payload });

            } else if (type === 'property:delete') {
                await dataService.deleteProperty(action.id);
                setData(prev => { const next = { ...prev, properties: prev.properties.filter(p => p.id !== action.id) }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'entity:deleted', entity: 'properties', id: action.id });

            } else if (type === 'tenant:add') {
                // Auto-derive monthlyRent from unit
                const prop = current.properties.find(p => p.id === action.payload.propertyId);
                const unit = prop?.units?.find(u => u.id === action.payload.unitId);
                const withRent = { ...action.payload, monthlyRent: unit?.rentMonthly ?? action.payload.monthlyRent ?? 0 };
                const saved = await dataService.addTenant(withRent);
                setData(prev => { const next = { ...prev, tenants: [...prev.tenants, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'entity:created', entity: 'tenants', payload: saved });

            } else if (type === 'tenant:update') {
                await dataService.updateTenant(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, tenants: prev.tenants.map(t => t.id === action.id ? { ...t, ...action.payload } as Tenant : t) };
                    setKpis(computeKPIs(next));
                    return next;
                });
                eventBus.emit({ type: 'entity:updated', entity: 'tenants', id: action.id, payload: action.payload });

            } else if (type === 'tenant:delete') {
                await dataService.deleteTenant(action.id);
                setData(prev => { const next = { ...prev, tenants: prev.tenants.filter(t => t.id !== action.id) }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'entity:deleted', entity: 'tenants', id: action.id });

            } else if (type === 'ticket:add') {
                const saved = await dataService.addTicket(action.payload);
                setData(prev => { const next = { ...prev, tickets: [...prev.tickets, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'ticket:created', payload: saved });

            } else if (type === 'ticket:update') {
                const old = current.tickets.find(t => t.id === action.id);
                await dataService.updateTicket(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, tickets: prev.tickets.map(t => t.id === action.id ? { ...t, ...action.payload } as MaintenanceTicket : t) };
                    setKpis(computeKPIs(next));
                    return next;
                });
                if (old && action.payload.status && old.status !== action.payload.status) {
                    eventBus.emit({ type: 'ticket:statusChanged', payload: { id: action.id, from: old.status, to: action.payload.status } });
                }

            } else if (type === 'ticket:delete') {
                await dataService.deleteTicket(action.id);
                setData(prev => { const next = { ...prev, tickets: prev.tickets.filter(t => t.id !== action.id) }; setKpis(computeKPIs(next)); return next; });

            } else if (type === 'invoice:add') {
                const saved = await dataService.addInvoice(action.payload);
                setData(prev => { const next = { ...prev, invoices: [...prev.invoices, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'invoice:created', payload: saved });

            } else if (type === 'invoice:update') {
                const old = current.invoices.find(i => i.id === action.id);
                await dataService.updateInvoice(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, invoices: prev.invoices.map(i => i.id === action.id ? { ...i, ...action.payload } as RentInvoice : i) };
                    setKpis(computeKPIs(next));
                    return next;
                });
                if (old && action.payload.status && old.status !== action.payload.status) {
                    eventBus.emit({ type: 'invoice:statusChanged', payload: { id: action.id, from: old.status, to: action.payload.status as string } });
                }

            } else if (type === 'invoice:delete') {
                await dataService.deleteInvoice(action.id);
                setData(prev => { const next = { ...prev, invoices: prev.invoices.filter(i => i.id !== action.id) }; setKpis(computeKPIs(next)); return next; });

            } else if (type === 'payment:add') {
                const saved = await dataService.addPayment(action.payload);
                setData(prev => { const next = { ...prev, payments: [...prev.payments, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'payment:received', payload: saved });

            } else if (type === 'payment:delete') {
                await dataService.deletePayment(action.id);
                setData(prev => { const next = { ...prev, payments: prev.payments.filter(p => p.id !== action.id) }; setKpis(computeKPIs(next)); return next; });

            } else if (type === 'cost:add') {
                const saved = await dataService.addOperatingCost(action.payload);
                setData(prev => { const next = { ...prev, costs: [...prev.costs, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'entity:created', entity: 'costs', payload: saved });

            } else if (type === 'cost:update') {
                await dataService.updateOperatingCost(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, costs: prev.costs.map(c => c.id === action.id ? { ...c, ...action.payload } as OperatingCostEntry : c) };
                    setKpis(computeKPIs(next));
                    return next;
                });

            } else if (type === 'cost:delete') {
                await dataService.deleteOperatingCost(action.id);
                setData(prev => { const next = { ...prev, costs: prev.costs.filter(c => c.id !== action.id) }; setKpis(computeKPIs(next)); return next; });

            } else if (type === 'settlement:add') {
                const saved = await dataService.addSettlement(action.payload);
                setData(prev => { const next = { ...prev, settlements: [...prev.settlements, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'settlement:created', payload: saved });

            } else if (type === 'settlement:update') {
                await dataService.updateSettlement(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, settlements: prev.settlements.map(s => s.id === action.id ? { ...s, ...action.payload } as Settlement : s) };
                    setKpis(computeKPIs(next));
                    return next;
                });

            } else if (type === 'settlement:delete') {
                await dataService.deleteSettlement(action.id);
                setData(prev => { const next = { ...prev, settlements: prev.settlements.filter(s => s.id !== action.id) }; setKpis(computeKPIs(next)); return next; });

            } else if (type === 'contract:add') {
                const saved = await dataService.addContract(action.payload);
                setData(prev => { const next = { ...prev, contracts: [...prev.contracts, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'entity:created', entity: 'contracts', payload: saved });

            } else if (type === 'contract:update') {
                const old = current.contracts.find(c => c.id === action.id);
                await dataService.updateContract(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, contracts: prev.contracts.map(c => c.id === action.id ? { ...c, ...action.payload } as Contract : c) };
                    setKpis(computeKPIs(next));
                    return next;
                });
                if (old && action.payload.status && old.status !== action.payload.status) {
                    eventBus.emit({ type: 'contract:statusChanged', payload: { id: action.id, from: old.status, to: action.payload.status } });
                }

            } else if (type === 'contract:delete') {
                await dataService.deleteContract(action.id);
                setData(prev => { const next = { ...prev, contracts: prev.contracts.filter(c => c.id !== action.id) }; setKpis(computeKPIs(next)); return next; });

            } else if (type === 'lineItem:add') {
                const saved = await dataService.addRentLineItem(action.payload);
                setData(prev => { const next = { ...prev, lineItems: [...prev.lineItems, saved] }; setKpis(computeKPIs(next)); return next; });

            } else if (type === 'lineItem:update') {
                await dataService.updateRentLineItem(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, lineItems: prev.lineItems.map(l => l.id === action.id ? { ...l, ...action.payload } as RentLineItem : l) };
                    setKpis(computeKPIs(next));
                    return next;
                });

            } else if (type === 'lineItem:delete') {
                await dataService.deleteRentLineItem(action.id);
                setData(prev => { const next = { ...prev, lineItems: prev.lineItems.filter(l => l.id !== action.id) }; setKpis(computeKPIs(next)); return next; });

            } else if (type === 'document:add') {
                const saved = await dataService.addDocument(action.payload);
                setData(prev => { const next = { ...prev, documents: [...prev.documents, saved] }; setKpis(computeKPIs(next)); return next; });
                eventBus.emit({ type: 'document:uploaded', payload: saved });

            } else if (type === 'document:update') {
                await dataService.updateDocument(action.id, action.payload);
                setData(prev => {
                    const next = { ...prev, documents: prev.documents.map(d => d.id === action.id ? { ...d, ...action.payload } as PropertyDocument : d) };
                    return next;
                });

            } else if (type === 'document:delete') {
                const existing = current.documents.find(d => d.id === action.id);
                await dataService.deleteDocument(action.id, existing?.storagePath);
                setData(prev => { const next = { ...prev, documents: prev.documents.filter(d => d.id !== action.id) }; return next; });

            } else if (type === 'message:add') {
                const saved = await dataService.addMessage(action.payload);
                setData(prev => ({ ...prev, messages: [...prev.messages, saved] }));

            } else if (type === 'message:update') {
                await dataService.updateMessage(action.id, action.payload);
                setData(prev => ({
                    ...prev, messages: prev.messages.map(m => m.id === action.id ? { ...m, ...action.payload } as Message : m),
                }));
            }

            eventBus.emit({ type: 'kpis:recomputed', payload: undefined });
        } catch (e: any) {
            console.error(`[DataCore] dispatch(${type}) failed:`, e);
            throw e; // Let the UI handle the error
        }
    }, []);

    // ---- LOOKUP HELPERS ----
    const getPropertyById = useCallback((id: string) => data.properties.find(p => p.id === id), [data.properties]);
    const getTenantById = useCallback((id: string) => data.tenants.find(t => t.id === id), [data.tenants]);
    const getUnitRent = useCallback((propertyId: string, unitId?: string) => {
        if (!unitId) return 0;
        const prop = data.properties.find(p => p.id === propertyId);
        const unit = prop?.units?.find(u => u.id === unitId);
        return unit?.rentMonthly ?? 0;
    }, [data.properties]);

    const value: DataCoreContextType = {
        data, kpis, isLoading, loadError, lastUpdated,
        dispatch, reload,
        getPropertyById, getTenantById, getUnitRent,
    };

    return <DataCoreContext.Provider value={value}>{children}</DataCoreContext.Provider>;
};

// ---------------------------------------------------------------------------
// HOOK
// ---------------------------------------------------------------------------

export function useDataCore(): DataCoreContextType {
    const ctx = useContext(DataCoreContext);
    if (!ctx) throw new Error('useDataCore must be used within a DataCoreProvider');
    return ctx;
}
