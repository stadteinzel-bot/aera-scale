// ===== AERA SCALE — Data Core Engine Tests =====
import { describe, it, expect, beforeEach } from 'vitest';
import {
    ENTITY_SCHEMA, STATUS_MAP, toUnifiedStatus,
    resolveFK, getChildren, validateFKIntegrity,
    EntityMap,
} from '../core/entitySchema';
import { eventBus } from '../core/eventBus';
import { computeOccupancyByProperty, computeTenantHealth } from '../core/kpiEngine';
import { computeTenantRisk, computePropertyRisk, computePortfolioRisk } from '../core/riskEngine';
import { generateCashflowForecast, summarizeForecast } from '../core/cashflowEngine';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

function createTestData(): EntityMap {
    return {
        properties: [
            {
                id: 'p1', name: 'Büropark Alpha', address: 'Musterstr. 1', type: 'Office',
                sizeSqFt: 500, status: 'Occupied', rentPerSqFt: 10, image: '',
                units: [
                    { id: 'u1', unitNumber: 'A-101', sizeSqFt: 200, rentMonthly: 2000, status: 'Occupied' },
                    { id: 'u2', unitNumber: 'A-102', sizeSqFt: 150, rentMonthly: 1500, status: 'Vacant' },
                    { id: 'u3', unitNumber: 'A-103', sizeSqFt: 150, rentMonthly: 1500, status: 'Maintenance' },
                ],
            },
        ],
        tenants: [
            {
                id: 't1', name: 'Firma Schmidt', contactName: 'Hans Schmidt', email: 'h@s.de', phone: '123',
                propertyId: 'p1', unitId: 'u1', leaseStart: '2024-01-01', leaseEnd: '2027-12-31',
                monthlyRent: 2000, status: 'Good Standing',
            },
        ],
        tickets: [
            { id: 'tk1', tenantId: 't1', propertyId: 'p1', title: 'Heizung defekt', description: 'Heizung kaputt', priority: 'High', status: 'Open', dateCreated: '2026-02-01' },
        ],
        invoices: [
            { id: 'inv1', tenantId: 't1', propertyId: 'p1', invoiceNumber: 'RE-2026-001', period: '2026-01', dueDate: '2026-01-05', kaltmiete: 2000, nebenkostenVorauszahlung: 200, totalAmount: 2200, status: 'paid', paidAmount: 2200, remindersSent: 0, createdAt: '2026-01-01' },
            { id: 'inv2', tenantId: 't1', propertyId: 'p1', invoiceNumber: 'RE-2026-002', period: '2026-02', dueDate: '2026-02-05', kaltmiete: 2000, nebenkostenVorauszahlung: 200, totalAmount: 2200, status: 'overdue', paidAmount: 0, remindersSent: 1, createdAt: '2026-02-01' },
        ],
        payments: [
            { id: 'pay1', invoiceId: 'inv1', tenantId: 't1', amount: 2200, date: '2026-01-03', method: 'Überweisung', isAutoMatched: false, createdAt: '2026-01-03' },
        ],
        costs: [
            { id: 'c1', propertyId: 'p1', category: 'Heizung', amount: 500, period: '2026-01', year: 2026, createdAt: '2026-01-15' },
        ],
        settlements: [],
        contracts: [],
        lineItems: [],
        documents: [],
        messages: [],
    };
}

// ---------------------------------------------------------------------------
// ENTITY SCHEMA TESTS
// ---------------------------------------------------------------------------

describe('Entity Schema', () => {
    it('should have FK definitions for all entities', () => {
        expect(Object.keys(ENTITY_SCHEMA)).toHaveLength(11);
        expect(ENTITY_SCHEMA.tenants.fk).toHaveLength(2);
        expect(ENTITY_SCHEMA.invoices.fk).toHaveLength(2);
        expect(ENTITY_SCHEMA.properties.fk).toHaveLength(0);
    });

    it('should map domain statuses to unified statuses', () => {
        expect(toUnifiedStatus('Occupied')).toBe('closed');
        expect(toUnifiedStatus('Vacant')).toBe('open');
        expect(toUnifiedStatus('Late')).toBe('pending');
        expect(toUnifiedStatus('Notice Given')).toBe('critical');
        expect(toUnifiedStatus('overdue')).toBe('critical');
        expect(toUnifiedStatus('paid')).toBe('closed');
        expect(toUnifiedStatus('unknown')).toBe('open'); // default
    });

    it('should resolve foreign keys', () => {
        const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        expect(resolveFK(pool, 'b')?.id).toBe('b');
        expect(resolveFK(pool, 'missing')).toBeUndefined();
        expect(resolveFK(pool, undefined)).toBeUndefined();
    });

    it('should get children by FK', () => {
        const items = [{ fk: 'p1', val: 1 }, { fk: 'p2', val: 2 }, { fk: 'p1', val: 3 }];
        expect(getChildren(items, 'fk', 'p1')).toHaveLength(2);
        expect(getChildren(items, 'fk', 'p2')).toHaveLength(1);
        expect(getChildren(items, 'fk', 'p3')).toHaveLength(0);
    });

    it('should validate FK integrity', () => {
        const data = createTestData();
        // tickets have top-level FKs (tenantId→tenants, propertyId→properties)
        const ticketIssues = validateFKIntegrity(data, 'tickets');
        expect(ticketIssues).toHaveLength(0);

        // Break a FK
        data.tickets[0].propertyId = 'nonexistent';
        const broken = validateFKIntegrity(data, 'tickets');
        expect(broken.length).toBeGreaterThan(0);
        expect(broken[0].brokenIds).toContain('nonexistent');
    });
});

// ---------------------------------------------------------------------------
// EVENT BUS TESTS
// ---------------------------------------------------------------------------

describe('Event Bus', () => {
    beforeEach(() => eventBus.reset());

    it('should deliver events to specific listeners', () => {
        const received: any[] = [];
        eventBus.on('invoice:created', (e) => received.push(e));
        eventBus.emit({ type: 'invoice:created', payload: { id: 'inv1' } as any });
        eventBus.emit({ type: 'payment:received', payload: { id: 'pay1' } as any }); // should not be received
        expect(received).toHaveLength(1);
        expect(received[0].type).toBe('invoice:created');
    });

    it('should deliver events to global listeners', () => {
        const received: any[] = [];
        eventBus.onAny((e) => received.push(e));
        eventBus.emit({ type: 'invoice:created', payload: { id: 'inv1' } as any });
        eventBus.emit({ type: 'payment:received', payload: { id: 'pay1' } as any });
        expect(received).toHaveLength(2);
    });

    it('should support unsubscribe', () => {
        const received: any[] = [];
        const unsub = eventBus.on('invoice:created', (e) => received.push(e));
        eventBus.emit({ type: 'invoice:created', payload: { id: '1' } as any });
        unsub();
        eventBus.emit({ type: 'invoice:created', payload: { id: '2' } as any });
        expect(received).toHaveLength(1);
    });

    it('should maintain event history', () => {
        eventBus.emit({ type: 'invoice:created', payload: { id: '1' } as any });
        eventBus.emit({ type: 'payment:received', payload: { id: '2' } as any });
        expect(eventBus.getHistory()).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// KPI ENGINE TESTS
// ---------------------------------------------------------------------------

describe('KPI Engine', () => {
    it('should compute occupancy by property', () => {
        const data = createTestData();
        const result = computeOccupancyByProperty(data);
        expect(result).toHaveLength(1);
        expect(result[0].totalUnits).toBe(3);
        expect(result[0].occupiedUnits).toBe(1);
        expect(result[0].vacantUnits).toBe(1);
        expect(result[0].maintenanceUnits).toBe(1);
        expect(result[0].occupancyRate).toBe(33);
        expect(result[0].monthlyRevenue).toBe(2000);
    });

    it('should compute tenant health', () => {
        const data = createTestData();
        const result = computeTenantHealth(data);
        expect(result).toHaveLength(1);
        expect(result[0].tenantName).toBe('Firma Schmidt');
        expect(result[0].monthlyRent).toBe(2000);
        expect(result[0].paymentRate).toBe(50); // 1 paid, 1 overdue
        expect(result[0].openTickets).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// RISK ENGINE TESTS
// ---------------------------------------------------------------------------

describe('Risk Engine', () => {
    it('should compute tenant risk scores', () => {
        const data = createTestData();
        const result = computeTenantRisk(data);
        expect(result).toHaveLength(1);
        expect(result[0].entityType).toBe('tenant');
        expect(result[0].score).toBeGreaterThanOrEqual(0);
        expect(result[0].score).toBeLessThanOrEqual(100);
        expect(result[0].factors.length).toBeGreaterThanOrEqual(5);
        expect(['low', 'medium', 'high', 'critical']).toContain(result[0].level);
    });

    it('should compute property risk scores', () => {
        const data = createTestData();
        const result = computePropertyRisk(data);
        expect(result).toHaveLength(1);
        expect(result[0].entityType).toBe('property');
        expect(result[0].score).toBeGreaterThanOrEqual(0);
        expect(result[0].score).toBeLessThanOrEqual(100);
    });

    it('should compute portfolio risk (average)', () => {
        const data = createTestData();
        const propRisk = computePropertyRisk(data);
        const portfolioRisk = computePortfolioRisk(data);
        expect(portfolioRisk).toBe(propRisk[0].score);
    });

    it('should return 0 risk for empty data', () => {
        const empty: EntityMap = {
            properties: [], tenants: [], tickets: [], invoices: [], payments: [],
            costs: [], settlements: [], contracts: [], lineItems: [], documents: [], messages: [],
        };
        expect(computePortfolioRisk(empty)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// CASHFLOW ENGINE TESTS
// ---------------------------------------------------------------------------

describe('Cashflow Engine', () => {
    it('should generate 12-month forecast', () => {
        const data = createTestData();
        const result = generateCashflowForecast(data, 12);
        expect(result).toHaveLength(12);
        expect(result[0].month).toBeTruthy();
        expect(result[0].expectedRevenue).toBeGreaterThanOrEqual(0);
        expect(result[0].confidence).toBeGreaterThan(0);
        expect(result[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should flag expiring leases', () => {
        const data = createTestData();
        // Set lease to expire in 2 months
        const future = new Date();
        future.setMonth(future.getMonth() + 2);
        data.tenants[0].leaseEnd = future.toISOString().split('T')[0];

        const result = generateCashflowForecast(data, 12);
        const hasRisks = result.some(m => m.risks.length > 0);
        // The month when lease expires or after should have risks
        expect(hasRisks).toBe(true);
    });

    it('should summarize forecast', () => {
        const data = createTestData();
        const forecast = generateCashflowForecast(data, 12);
        const summary = summarizeForecast(forecast);
        expect(summary.totalExpectedRevenue).toBeGreaterThanOrEqual(0);
        expect(summary.worstMonth).toBeTruthy();
        expect(summary.bestMonth).toBeTruthy();
    });

    it('should handle empty data', () => {
        const empty: EntityMap = {
            properties: [], tenants: [], tickets: [], invoices: [], payments: [],
            costs: [], settlements: [], contracts: [], lineItems: [], documents: [], messages: [],
        };
        const result = generateCashflowForecast(empty, 6);
        expect(result).toHaveLength(6);
        result.forEach(m => {
            expect(m.expectedRevenue).toBe(0);
            expect(m.expectedCosts).toBe(0);
        });
    });
});
