// ===== AERA SCALE — Rent Calculation Engine =====
// Pure, deterministic functions with NO side effects.
// All functions receive data as parameters — no Firestore calls.

import {
    RentLineItem, Contract, Cadence, MonthlyKPIs, PropertyKPI,
    CurrencyKPI, IndexationRule,
} from '../types/rentTypes';

// --- HELPERS ---

/** Parse "2025-01" into { year, month } */
export function parseMonth(targetMonth: string): { year: number; month: number } {
    const [y, m] = targetMonth.split('-').map(Number);
    return { year: y, month: m };
}

/** Get the first day of a month as Date */
function monthStart(targetMonth: string): Date {
    const { year, month } = parseMonth(targetMonth);
    return new Date(year, month - 1, 1);
}

/** Get the last day of a month as Date */
function monthEnd(targetMonth: string): Date {
    const { year, month } = parseMonth(targetMonth);
    return new Date(year, month, 0); // day 0 of next month = last day of current
}

/** Check if a date string (ISO) falls within a target month */
function isDateInMonth(dateStr: string, targetMonth: string): boolean {
    const d = new Date(dateStr);
    const start = monthStart(targetMonth);
    const end = monthEnd(targetMonth);
    return d >= start && d <= end;
}

/** Check if a line item is active during a given month */
export function isActiveInMonth(item: RentLineItem, targetMonth: string): boolean {
    if (!item.isActive) return false;

    const mStart = monthStart(targetMonth);
    const mEnd = monthEnd(targetMonth);

    const itemStart = new Date(item.startDate);
    if (itemStart > mEnd) return false; // hasn't started yet

    if (item.endDate) {
        const itemEnd = new Date(item.endDate);
        if (itemEnd < mStart) return false; // already ended
    }

    return true;
}

// --- CORE CALCULATIONS ---

/**
 * Filter line items to those active in the target month.
 * This is the single source of truth for "which items count this month".
 */
export function getActiveLineItems(
    items: RentLineItem[],
    targetMonth: string
): RentLineItem[] {
    return items.filter(item => isActiveInMonth(item, targetMonth));
}

/**
 * Normalize any cadence to a monthly equivalent amount.
 * - monthly → amount
 * - quarterly → amount / 3
 * - yearly → amount / 12
 * - one-time → 0 (excluded from MRR; handled separately)
 */
export function normalizeToMonthly(item: RentLineItem): number {
    switch (item.cadence) {
        case 'monthly': return item.amount;
        case 'quarterly': return Math.round((item.amount / 3) * 100) / 100;
        case 'yearly': return Math.round((item.amount / 12) * 100) / 100;
        case 'one-time': return 0; // one-time items are NOT part of MRR
        default: return item.amount;
    }
}

/**
 * Compute the effective amount for a line item in a given month,
 * applying indexation if applicable.
 *
 * Strategy: If there's an indexation rule with adjustmentHistory,
 * find the most recent adjustment that's effective on or before the target month.
 * If found, use its newAmount. Otherwise, use the base amount.
 *
 * This ensures we NEVER count both old and new values simultaneously.
 */
export function computeEffectiveAmount(
    item: RentLineItem,
    targetMonth: string
): number {
    if (!item.indexationRule || !item.indexationRule.adjustmentHistory?.length) {
        return item.amount;
    }

    const mEnd = monthEnd(targetMonth);

    // Find the most recent adjustment effective on or before end of target month
    const applicableAdjustments = item.indexationRule.adjustmentHistory
        .filter(adj => new Date(adj.effectiveDate) <= mEnd)
        .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

    if (applicableAdjustments.length > 0) {
        return applicableAdjustments[0].newAmount;
    }

    return item.amount;
}

/**
 * Compute MRR for a single contract: sum of all active recurring line items,
 * normalized to monthly, with indexation applied.
 *
 * EXCLUDES one-time items.
 */
export function computeContractMRR(
    lineItems: RentLineItem[],
    targetMonth: string
): number {
    const active = getActiveLineItems(lineItems, targetMonth);

    let total = 0;
    for (const item of active) {
        if (item.cadence === 'one-time') continue;

        const effectiveAmount = computeEffectiveAmount(item, targetMonth);
        // Replace base amount with effective for normalization
        const normalizedItem = { ...item, amount: effectiveAmount };
        total += normalizeToMonthly(normalizedItem);
    }

    return Math.round(total * 100) / 100;
}

/**
 * Compute one-time revenue for a contract in a specific month.
 * A one-time item counts in the month its startDate falls in.
 */
export function computeContractOneTime(
    lineItems: RentLineItem[],
    targetMonth: string
): number {
    const active = getActiveLineItems(lineItems, targetMonth);
    let total = 0;

    for (const item of active) {
        if (item.cadence !== 'one-time') continue;
        // One-time counts if its startDate is in this month
        if (isDateInMonth(item.startDate, targetMonth)) {
            total += item.amount;
        }
    }

    return Math.round(total * 100) / 100;
}

/**
 * Compute net rent (base_rent only) for a contract.
 */
export function computeContractNetRent(
    lineItems: RentLineItem[],
    targetMonth: string
): number {
    const active = getActiveLineItems(lineItems, targetMonth);
    let total = 0;

    for (const item of active) {
        if (item.cadence === 'one-time') continue;
        if (item.type !== 'base_rent') continue;

        const effectiveAmount = computeEffectiveAmount(item, targetMonth);
        const normalizedItem = { ...item, amount: effectiveAmount };
        total += normalizeToMonthly(normalizedItem);
    }

    return Math.round(total * 100) / 100;
}

/**
 * Compute ancillary prepayments (NK-Vorauszahlung) for a contract.
 */
export function computeContractAncillary(
    lineItems: RentLineItem[],
    targetMonth: string
): number {
    const active = getActiveLineItems(lineItems, targetMonth);
    let total = 0;

    for (const item of active) {
        if (item.cadence === 'one-time') continue;
        if (item.type !== 'ancillary_prepayment') continue;

        const effectiveAmount = computeEffectiveAmount(item, targetMonth);
        const normalizedItem = { ...item, amount: effectiveAmount };
        total += normalizeToMonthly(normalizedItem);
    }

    return Math.round(total * 100) / 100;
}

// --- PROPERTY-LEVEL AGGREGATION ---

/**
 * Compute MRR for a property by aggregating across its contracts.
 * Ensures no double-counting: aggregates by contract, not by unit.
 */
export function computePropertyMRR(
    contracts: Contract[],
    lineItemsByContract: Map<string, RentLineItem[]>,
    propertyId: string,
    targetMonth: string
): number {
    const propertyContracts = contracts.filter(
        c => c.propertyId === propertyId && c.status === 'active'
    );

    let total = 0;
    for (const contract of propertyContracts) {
        const items = lineItemsByContract.get(contract.id) || [];
        total += computeContractMRR(items, targetMonth);
    }

    return Math.round(total * 100) / 100;
}

// --- PORTFOLIO-LEVEL KPI COMPUTATION ---

/**
 * Compute all KPIs for the entire portfolio for a given month.
 * This is the top-level function called by the Dashboard.
 *
 * @param contracts All contracts in the system
 * @param allLineItems All rent line items
 * @param properties Property metadata (for names)
 * @param targetMonth "2025-01"
 */
export function computePortfolioKPIs(
    contracts: Contract[],
    allLineItems: RentLineItem[],
    properties: { id: string; name: string }[],
    targetMonth: string
): Omit<MonthlyKPIs, 'validationReport'> {
    // Group line items by contract
    const lineItemsByContract = new Map<string, RentLineItem[]>();
    for (const item of allLineItems) {
        const existing = lineItemsByContract.get(item.contractId) || [];
        existing.push(item);
        lineItemsByContract.set(item.contractId, existing);
    }

    const activeContracts = contracts.filter(c => c.status === 'active');

    let totalMRR = 0;
    let totalOneTime = 0;
    let totalNetRent = 0;
    let totalAncillary = 0;

    // Per-property aggregation
    const propertyMap = new Map<string, PropertyKPI>();
    for (const prop of properties) {
        propertyMap.set(prop.id, {
            propertyId: prop.id,
            propertyName: prop.name,
            mrr: 0,
            oneTimeRevenue: 0,
            contractCount: 0,
            unitCount: 0,
        });
    }

    // Per-currency aggregation
    const currencyMap = new Map<string, CurrencyKPI>();

    // Process each active contract
    for (const contract of activeContracts) {
        const items = lineItemsByContract.get(contract.id) || [];
        const contractMRR = computeContractMRR(items, targetMonth);
        const contractOneTime = computeContractOneTime(items, targetMonth);
        const contractNet = computeContractNetRent(items, targetMonth);
        const contractAncillary = computeContractAncillary(items, targetMonth);

        totalMRR += contractMRR;
        totalOneTime += contractOneTime;
        totalNetRent += contractNet;
        totalAncillary += contractAncillary;

        // Property aggregation
        const propKPI = propertyMap.get(contract.propertyId);
        if (propKPI) {
            propKPI.mrr += contractMRR;
            propKPI.oneTimeRevenue += contractOneTime;
            propKPI.contractCount += 1;
            propKPI.unitCount += contract.unitIds.length;
        }

        // Currency aggregation (from line items)
        for (const item of getActiveLineItems(items, targetMonth)) {
            const curr = item.currency || 'EUR';
            const existing = currencyMap.get(curr) || { currency: curr, mrr: 0, oneTimeRevenue: 0 };
            if (item.cadence === 'one-time') {
                if (isDateInMonth(item.startDate, targetMonth)) {
                    existing.oneTimeRevenue += item.amount;
                }
            } else {
                const eff = computeEffectiveAmount(item, targetMonth);
                existing.mrr += normalizeToMonthly({ ...item, amount: eff });
            }
            currencyMap.set(curr, existing);
        }
    }

    return {
        month: targetMonth,
        mrr: Math.round(totalMRR * 100) / 100,
        oneTimeRevenue: Math.round(totalOneTime * 100) / 100,
        grossRent: Math.round((totalMRR + totalOneTime) * 100) / 100,
        netRent: Math.round(totalNetRent * 100) / 100,
        ancillaryPrepayments: Math.round(totalAncillary * 100) / 100,
        byProperty: Array.from(propertyMap.values()).map(p => ({
            ...p,
            mrr: Math.round(p.mrr * 100) / 100,
            oneTimeRevenue: Math.round(p.oneTimeRevenue * 100) / 100,
        })),
        byCurrency: Array.from(currencyMap.values()).map(c => ({
            ...c,
            mrr: Math.round(c.mrr * 100) / 100,
            oneTimeRevenue: Math.round(c.oneTimeRevenue * 100) / 100,
        })),
    };
}
