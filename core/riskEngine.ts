// ===== AERA SCALE — Risk Score Engine =====
// Computes risk scores (0-100) per Property and Tenant.
// Pure functions — no side effects.

import type { EntityMap } from './entitySchema';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface RiskFactor {
    name: string;
    weight: number;      // 0-1
    score: number;       // 0-100 (100 = highest risk)
    detail: string;
}

export interface RiskScore {
    entityId: string;
    entityType: 'property' | 'tenant';
    entityName: string;
    score: number;       // 0-100 (weighted average)
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: RiskFactor[];
    trend: 'improving' | 'stable' | 'declining';
}

// ---------------------------------------------------------------------------
// RISK LEVEL THRESHOLDS
// ---------------------------------------------------------------------------

function riskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < 25) return 'low';
    if (score < 50) return 'medium';
    if (score < 75) return 'high';
    return 'critical';
}

// ---------------------------------------------------------------------------
// TENANT RISK SCORE
// ---------------------------------------------------------------------------

export function computeTenantRisk(data: EntityMap): RiskScore[] {
    const now = new Date();

    return data.tenants.map(tenant => {
        const factors: RiskFactor[] = [];

        // 1. Payment History (30%)
        const invoices = data.invoices.filter(i => i.tenantId === tenant.id);
        const totalInvoices = invoices.length;
        const overdueCount = invoices.filter(i => i.status === 'overdue').length;
        const lateCount = invoices.filter(i => i.status === 'partial').length;
        const paymentScore = totalInvoices > 0
            ? Math.min(100, ((overdueCount * 2 + lateCount) / totalInvoices) * 100)
            : 0;
        factors.push({
            name: 'Zahlungshistorie',
            weight: 0.30,
            score: paymentScore,
            detail: `${overdueCount} überfällig, ${lateCount} teilweise (von ${totalInvoices})`,
        });

        // 2. Outstanding Amount (20%)
        const outstanding = invoices
            .filter(i => ['sent', 'partial', 'overdue'].includes(i.status))
            .reduce((a, i) => a + (i.totalAmount - i.paidAmount), 0);
        const monthlyRent = tenant.monthlyRent || 1;
        const outstandingRatio = Math.min(100, (outstanding / monthlyRent) * 50);
        factors.push({
            name: 'Offene Forderungen',
            weight: 0.20,
            score: outstandingRatio,
            detail: `€${outstanding.toFixed(0)} offen (${(outstanding / monthlyRent * 100).toFixed(0)}% der Monatsmiete)`,
        });

        // 3. Maintenance Load (15%)
        const openTickets = data.tickets.filter(t => t.tenantId === tenant.id && t.status !== 'Resolved');
        const emergencyTickets = openTickets.filter(t => t.priority === 'Emergency').length;
        const ticketScore = Math.min(100, openTickets.length * 20 + emergencyTickets * 30);
        factors.push({
            name: 'Wartungsbelastung',
            weight: 0.15,
            score: ticketScore,
            detail: `${openTickets.length} offene Tickets (${emergencyTickets} Notfälle)`,
        });

        // 4. Lease Expiry (15%)
        const leaseEnd = tenant.leaseEnd ? new Date(tenant.leaseEnd) : null;
        const daysToExpiry = leaseEnd
            ? Math.max(0, Math.ceil((leaseEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : 9999;
        const leaseScore = daysToExpiry < 30 ? 100 :
            daysToExpiry < 90 ? 70 :
                daysToExpiry < 180 ? 40 :
                    daysToExpiry < 365 ? 15 : 0;
        factors.push({
            name: 'Vertragslaufzeit',
            weight: 0.15,
            score: leaseScore,
            detail: daysToExpiry < 9999 ? `${daysToExpiry} Tage bis Ablauf` : 'Unbefristet',
        });

        // 5. Document Compliance (10%)
        const tenantDocs = data.documents.filter(d => d.tenantId === tenant.id);
        const requiredTypes = ['Mietvertrag'];
        const missingDocs = requiredTypes.filter(type => !tenantDocs.some(d => d.type === type));
        const docScore = (missingDocs.length / requiredTypes.length) * 100;
        factors.push({
            name: 'Dokumentation',
            weight: 0.10,
            score: docScore,
            detail: missingDocs.length > 0 ? `Fehlend: ${missingDocs.join(', ')}` : 'Vollständig',
        });

        // 6. Communication (10%)
        const tenantMessages = data.messages.filter(m => m.senderId === tenant.id || m.receiverId === tenant.id);
        const unreadMessages = tenantMessages.filter(m => !m.isRead && m.receiverId !== tenant.id).length;
        const commScore = Math.min(100, unreadMessages * 25);
        factors.push({
            name: 'Kommunikation',
            weight: 0.10,
            score: commScore,
            detail: `${unreadMessages} ungelesene Nachrichten`,
        });

        // Weighted average
        const score = Math.round(factors.reduce((a, f) => a + f.score * f.weight, 0));
        const prop = data.properties.find(p => p.id === tenant.propertyId);

        return {
            entityId: tenant.id,
            entityType: 'tenant' as const,
            entityName: tenant.name,
            score,
            level: riskLevel(score),
            factors,
            trend: 'stable' as const, // TODO: compare with previous period
        };
    });
}

// ---------------------------------------------------------------------------
// PROPERTY RISK SCORE
// ---------------------------------------------------------------------------

export function computePropertyRisk(data: EntityMap): RiskScore[] {
    const tenantRisks = computeTenantRisk(data);
    const now = new Date();

    return data.properties.map(property => {
        const factors: RiskFactor[] = [];
        const units = property.units || [];
        const propertyTenants = data.tenants.filter(t => t.propertyId === property.id);

        // 1. Occupancy Risk (25%)
        const occupied = units.filter(u => u.status === 'Occupied').length;
        const occupancyRate = units.length > 0 ? occupied / units.length : 0;
        const occupancyScore = Math.round((1 - occupancyRate) * 100);
        factors.push({
            name: 'Belegungsquote',
            weight: 0.25,
            score: occupancyScore,
            detail: `${occupied}/${units.length} Einheiten belegt (${Math.round(occupancyRate * 100)}%)`,
        });

        // 2. Average Tenant Risk (25%)
        const tenantScores = tenantRisks.filter(r => propertyTenants.some(t => t.id === r.entityId));
        const avgTenantRisk = tenantScores.length > 0
            ? Math.round(tenantScores.reduce((a, r) => a + r.score, 0) / tenantScores.length)
            : 0;
        factors.push({
            name: 'Mieter-Risiko (Ø)',
            weight: 0.25,
            score: avgTenantRisk,
            detail: `Durchschnitt aus ${tenantScores.length} Mieter(n)`,
        });

        // 3. Maintenance Burden (20%)
        const propTickets = data.tickets.filter(t => t.propertyId === property.id && t.status !== 'Resolved');
        const emergencyCount = propTickets.filter(t => t.priority === 'Emergency').length;
        const maintScore = Math.min(100, propTickets.length * 15 + emergencyCount * 25);
        factors.push({
            name: 'Wartungslast',
            weight: 0.20,
            score: maintScore,
            detail: `${propTickets.length} offene Tickets (${emergencyCount} Notfälle)`,
        });

        // 4. Revenue Stability (15%)
        const propInvoices = data.invoices.filter(i => i.propertyId === property.id);
        const overdueInv = propInvoices.filter(i => i.status === 'overdue').length;
        const revScore = propInvoices.length > 0
            ? Math.min(100, (overdueInv / propInvoices.length) * 200)
            : 0;
        factors.push({
            name: 'Einnahmenstabilität',
            weight: 0.15,
            score: revScore,
            detail: `${overdueInv} überfällige Rechnungen (von ${propInvoices.length})`,
        });

        // 5. Document Compliance (15%)
        const propDocs = data.documents.filter(d => d.propertyId === property.id);
        const requiredPropDocs = ['Energieausweis', 'Grundbuchauszug'];
        const missing = requiredPropDocs.filter(type => !propDocs.some(d => d.type === type));
        const docScore = (missing.length / requiredPropDocs.length) * 100;
        factors.push({
            name: 'Dokumentation',
            weight: 0.15,
            score: docScore,
            detail: missing.length > 0 ? `Fehlend: ${missing.join(', ')}` : 'Vollständig',
        });

        const score = Math.round(factors.reduce((a, f) => a + f.score * f.weight, 0));

        return {
            entityId: property.id,
            entityType: 'property' as const,
            entityName: property.name,
            score,
            level: riskLevel(score),
            factors,
            trend: 'stable' as const,
        };
    });
}

/** Portfolio-wide risk score (average of all properties) */
export function computePortfolioRisk(data: EntityMap): number {
    const propRisks = computePropertyRisk(data);
    if (propRisks.length === 0) return 0;
    return Math.round(propRisks.reduce((a, r) => a + r.score, 0) / propRisks.length);
}
