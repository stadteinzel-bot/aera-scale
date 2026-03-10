// ===== AERA SCALE — Cashflow Forecast Engine =====
// 12-month forward projection based on current contracts, payment patterns,
// lease expiries, and operating costs.
// Pure functions — no side effects.

import type { EntityMap } from './entitySchema';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface MonthlyForecast {
    month: string;          // "2026-03"
    label: string;          // "Mär 2026"
    expectedRevenue: number;
    expectedCosts: number;
    netCashflow: number;
    confidence: number;     // 0-1
    risks: string[];
    breakdown: {
        kaltmiete: number;
        nebenkosten: number;
        vacancyLoss: number;
        maintenanceReserve: number;
        operatingCosts: number;
    };
}

export interface CashflowSummary {
    totalExpectedRevenue: number;
    totalExpectedCosts: number;
    totalNetCashflow: number;
    averageMonthlyNet: number;
    worstMonth: MonthlyForecast | null;
    bestMonth: MonthlyForecast | null;
    riskCount: number;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Maintenance reserve as % of monthly revenue (industry standard 5-10%)
const MAINTENANCE_RESERVE_PCT = 0.05;

// ---------------------------------------------------------------------------
// FORECAST ENGINE
// ---------------------------------------------------------------------------

/**
 * Generate 12-month cashflow forecast.
 * Uses current tenant data, lease dates, payment history, and operating costs.
 */
export function generateCashflowForecast(data: EntityMap, monthsAhead: number = 12): MonthlyForecast[] {
    const now = new Date();
    const forecasts: MonthlyForecast[] = [];

    // Pre-compute base monthly revenue per tenant
    const tenantRevenues = data.tenants.map(t => {
        const prop = data.properties.find(p => p.id === t.propertyId);
        const unit = prop?.units?.find(u => u.id === t.unitId);
        return {
            tenant: t,
            monthlyRent: unit?.rentMonthly ?? t.monthlyRent ?? 0,
            leaseEnd: t.leaseEnd ? new Date(t.leaseEnd) : null,
            // Payment reliability: % of invoices fully paid
            paymentRate: computePaymentRate(data, t.id),
        };
    });

    // Average monthly operating costs (from last 12 months)
    const avgMonthlyCosts = computeAvgMonthlyCosts(data);

    for (let i = 0; i < monthsAhead; i++) {
        const forecastDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
        const monthStr = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
        const label = `${MONTH_LABELS[forecastDate.getMonth()]} ${forecastDate.getFullYear()}`;
        const risks: string[] = [];

        let kaltmiete = 0;
        let nebenkosten = 0;
        let vacancyLoss = 0;
        let confidenceSum = 0;
        let tenantCount = 0;

        for (const tr of tenantRevenues) {
            // Check if lease is active in this month
            const leaseActive = !tr.leaseEnd || tr.leaseEnd >= forecastDate;

            if (leaseActive) {
                // Estimate kaltmiete vs nebenkosten split (use invoice data if available)
                const lastInvoice = data.invoices
                    .filter(inv => inv.tenantId === tr.tenant.id)
                    .sort((a, b) => b.period.localeCompare(a.period))[0];

                if (lastInvoice) {
                    kaltmiete += lastInvoice.kaltmiete;
                    nebenkosten += lastInvoice.nebenkostenVorauszahlung;
                } else {
                    kaltmiete += tr.monthlyRent;
                }

                // Confidence based on payment reliability
                confidenceSum += tr.paymentRate;
                tenantCount++;
            } else {
                // Lease expired → vacancy loss
                vacancyLoss += tr.monthlyRent;
                risks.push(`Vertrag ${tr.tenant.name} läuft aus am ${tr.leaseEnd!.toLocaleDateString('de-DE')}`);
            }

            // Warn if lease expires within this forecast month
            if (tr.leaseEnd) {
                const expiryMonth = `${tr.leaseEnd.getFullYear()}-${String(tr.leaseEnd.getMonth() + 1).padStart(2, '0')}`;
                if (expiryMonth === monthStr) {
                    risks.push(`⚠️ Vertrag ${tr.tenant.name} endet in ${MONTH_LABELS[forecastDate.getMonth()]}`);
                }
            }
        }

        const maintenanceReserve = (kaltmiete + nebenkosten) * MAINTENANCE_RESERVE_PCT;
        const expectedRevenue = kaltmiete + nebenkosten;
        const expectedCosts = avgMonthlyCosts + maintenanceReserve;
        const confidence = tenantCount > 0 ? confidenceSum / tenantCount : 0.5;

        // Lower confidence for months further out
        const timeDecay = Math.max(0.5, 1 - (i * 0.03));

        forecasts.push({
            month: monthStr,
            label,
            expectedRevenue,
            expectedCosts,
            netCashflow: expectedRevenue - expectedCosts,
            confidence: Math.round(confidence * timeDecay * 100) / 100,
            risks,
            breakdown: {
                kaltmiete,
                nebenkosten,
                vacancyLoss,
                maintenanceReserve,
                operatingCosts: avgMonthlyCosts,
            },
        });
    }

    return forecasts;
}

/** Summarize the 12-month forecast */
export function summarizeForecast(forecasts: MonthlyForecast[]): CashflowSummary {
    if (forecasts.length === 0) {
        return {
            totalExpectedRevenue: 0, totalExpectedCosts: 0, totalNetCashflow: 0,
            averageMonthlyNet: 0, worstMonth: null, bestMonth: null, riskCount: 0,
        };
    }

    const totalExpectedRevenue = forecasts.reduce((a, f) => a + f.expectedRevenue, 0);
    const totalExpectedCosts = forecasts.reduce((a, f) => a + f.expectedCosts, 0);
    const totalNetCashflow = totalExpectedRevenue - totalExpectedCosts;
    const riskCount = forecasts.reduce((a, f) => a + f.risks.length, 0);

    const sorted = [...forecasts].sort((a, b) => a.netCashflow - b.netCashflow);

    return {
        totalExpectedRevenue,
        totalExpectedCosts,
        totalNetCashflow,
        averageMonthlyNet: totalNetCashflow / forecasts.length,
        worstMonth: sorted[0],
        bestMonth: sorted[sorted.length - 1],
        riskCount,
    };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Payment rate for a tenant: % of invoices fully paid */
function computePaymentRate(data: EntityMap, tenantId: string): number {
    const invoices = data.invoices.filter(i => i.tenantId === tenantId);
    if (invoices.length === 0) return 0.85; // default for new tenants
    const paid = invoices.filter(i => i.status === 'paid').length;
    return paid / invoices.length;
}

/** Average monthly operating costs over last 12 months */
function computeAvgMonthlyCosts(data: EntityMap): number {
    if (data.costs.length === 0) return 0;
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const recentCosts = data.costs.filter(c => {
        const costDate = new Date(`${c.year}-${c.period.split('-')[1] || '01'}-01`);
        return costDate >= twelveMonthsAgo;
    });
    const total = recentCosts.reduce((a, c) => a + c.amount, 0);
    const months = Math.max(1, new Set(recentCosts.map(c => c.period)).size);
    return total / months;
}
