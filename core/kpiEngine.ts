// ===== AERA SCALE — KPI Aggregation Engine =====
// Computes all dashboard KPIs from the central DataCore state.
// Pure functions — no side effects, fully deterministic.

import type { EntityMap } from './entitySchema';
import type { DashboardKPIs } from './DataCoreProvider';

// ---------------------------------------------------------------------------
// EXTENDED KPIs (beyond DashboardKPIs)
// ---------------------------------------------------------------------------

export interface PropertyOccupancy {
    propertyId: string;
    propertyName: string;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    maintenanceUnits: number;
    occupancyRate: number;
    monthlyRevenue: number;
}

export interface RevenueBreakdown {
    month: string;
    kaltmiete: number;
    nebenkosten: number;
    totalInvoiced: number;
    totalCollected: number;
    outstanding: number;
}

export interface TenantHealth {
    tenantId: string;
    tenantName: string;
    propertyName: string;
    monthlyRent: number;
    paymentRate: number;       // 0-100: % of invoices paid on time
    openTickets: number;
    leaseDaysRemaining: number;
    status: string;
}

export interface OperatingCostSummary {
    totalYTD: number;
    byCategory: { category: string; amount: number }[];
    byProperty: { propertyId: string; propertyName: string; amount: number }[];
    avgPerUnit: number;
}

// ---------------------------------------------------------------------------
// COMPUTATION FUNCTIONS
// ---------------------------------------------------------------------------

/** Compute occupancy breakdown per property */
export function computeOccupancyByProperty(data: EntityMap): PropertyOccupancy[] {
    return data.properties.map(p => {
        const units = p.units || [];
        const occupied = units.filter(u => u.status === 'Occupied');
        const vacant = units.filter(u => u.status === 'Vacant');
        const maint = units.filter(u => u.status === 'Maintenance');
        const revenue = data.tenants
            .filter(t => t.propertyId === p.id)
            .reduce((acc, t) => {
                const unit = units.find(u => u.id === t.unitId);
                return acc + (unit?.rentMonthly ?? t.monthlyRent ?? 0);
            }, 0);

        return {
            propertyId: p.id,
            propertyName: p.name,
            totalUnits: units.length,
            occupiedUnits: occupied.length,
            vacantUnits: vacant.length,
            maintenanceUnits: maint.length,
            occupancyRate: units.length > 0 ? Math.round((occupied.length / units.length) * 100) : 0,
            monthlyRevenue: revenue,
        };
    });
}

/** Revenue breakdown for the last N months */
export function computeRevenueHistory(data: EntityMap, monthsBack: number = 12): RevenueBreakdown[] {
    const now = new Date();
    const result: RevenueBreakdown[] = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        const monthInvoices = data.invoices.filter(inv => inv.period === month);
        const monthPayments = data.payments.filter(p => p.date.startsWith(month));

        result.push({
            month,
            kaltmiete: monthInvoices.reduce((a, i) => a + (i.kaltmiete || 0), 0),
            nebenkosten: monthInvoices.reduce((a, i) => a + (i.nebenkostenVorauszahlung || 0), 0),
            totalInvoiced: monthInvoices.reduce((a, i) => a + i.totalAmount, 0),
            totalCollected: monthPayments.reduce((a, p) => a + p.amount, 0),
            outstanding: monthInvoices
                .filter(i => ['sent', 'partial', 'overdue'].includes(i.status))
                .reduce((a, i) => a + (i.totalAmount - i.paidAmount), 0),
        });
    }
    return result;
}

/** Tenant health overview */
export function computeTenantHealth(data: EntityMap): TenantHealth[] {
    const now = new Date();

    return data.tenants.map(t => {
        const prop = data.properties.find(p => p.id === t.propertyId);
        const tenantInvoices = data.invoices.filter(i => i.tenantId === t.id);
        const paidOnTime = tenantInvoices.filter(i => i.status === 'paid').length;
        const totalInvoices = tenantInvoices.length;
        const openTickets = data.tickets.filter(tk => tk.tenantId === t.id && tk.status !== 'Resolved').length;
        const leaseEnd = t.leaseEnd ? new Date(t.leaseEnd) : null;
        const daysRemaining = leaseEnd ? Math.max(0, Math.ceil((leaseEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 9999;

        const unit = prop?.units?.find(u => u.id === t.unitId);

        return {
            tenantId: t.id,
            tenantName: t.name,
            propertyName: prop?.name ?? 'Unknown',
            monthlyRent: unit?.rentMonthly ?? t.monthlyRent ?? 0,
            paymentRate: totalInvoices > 0 ? Math.round((paidOnTime / totalInvoices) * 100) : 100,
            openTickets,
            leaseDaysRemaining: daysRemaining,
            status: t.status,
        };
    });
}

/** Operating cost summary (year-to-date) */
export function computeOperatingCostSummary(data: EntityMap, year?: number): OperatingCostSummary {
    const targetYear = year ?? new Date().getFullYear();
    const yearCosts = data.costs.filter(c => c.year === targetYear);
    const totalYTD = yearCosts.reduce((a, c) => a + c.amount, 0);

    // By category
    const catMap = new Map<string, number>();
    for (const c of yearCosts) {
        catMap.set(c.category, (catMap.get(c.category) || 0) + c.amount);
    }
    const byCategory = Array.from(catMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

    // By property
    const propMap = new Map<string, number>();
    for (const c of yearCosts) {
        propMap.set(c.propertyId, (propMap.get(c.propertyId) || 0) + c.amount);
    }
    const byProperty = Array.from(propMap.entries()).map(([propertyId, amount]) => ({
        propertyId,
        propertyName: data.properties.find(p => p.id === propertyId)?.name ?? 'Unknown',
        amount,
    }));

    const totalUnits = data.properties.reduce((a, p) => a + (p.units?.length || 0), 0);

    return { totalYTD, byCategory, byProperty, avgPerUnit: totalUnits > 0 ? totalYTD / totalUnits : 0 };
}
