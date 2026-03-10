// ===== AERA SCALE — Rent Engine Tests =====
import { describe, it, expect } from 'vitest';
import {
    getActiveLineItems, normalizeToMonthly, computeEffectiveAmount,
    computeContractMRR, computeContractOneTime, computeContractNetRent,
    computeContractAncillary, computePortfolioKPIs, isActiveInMonth,
} from '../services/rentEngine';
import { RentLineItem, Contract } from '../types/rentTypes';

// --- HELPERS TO CREATE TEST DATA ---

function makeLineItem(overrides: Partial<RentLineItem> = {}): RentLineItem {
    return {
        id: 'li-1',
        contractId: 'c-1',
        label: 'Kaltmiete',
        type: 'base_rent',
        amount: 1000,
        currency: 'EUR',
        cadence: 'monthly',
        startDate: '2024-01-01',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        ...overrides,
    };
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
    return {
        id: 'c-1',
        tenantId: 't-1',
        propertyId: 'p-1',
        unitIds: ['u-1'],
        contractNumber: 'MV-2024-001',
        startDate: '2024-01-01',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        ...overrides,
    };
}

// ============================
// TEST SUITE
// ============================

describe('rentEngine', () => {
    // --- Test 1: Basic MRR ---
    describe('1 contract, 1 unit, 3 line items', () => {
        const items: RentLineItem[] = [
            makeLineItem({ id: 'li-1', amount: 1000, type: 'base_rent' }),
            makeLineItem({ id: 'li-2', amount: 200, type: 'ancillary_prepayment', label: 'NK-Vorauszahlung' }),
            makeLineItem({ id: 'li-3', amount: 50, type: 'parking', label: 'Stellplatz' }),
        ];

        it('computes correct MRR', () => {
            expect(computeContractMRR(items, '2024-06')).toBe(1250);
        });

        it('computes correct net rent (base_rent only)', () => {
            expect(computeContractNetRent(items, '2024-06')).toBe(1000);
        });

        it('computes correct ancillary', () => {
            expect(computeContractAncillary(items, '2024-06')).toBe(200);
        });
    });

    // --- Test 2: Multi-unit, no double-counting ---
    describe('1 contract, 5 units (no double-counting)', () => {
        const contract = makeContract({ unitIds: ['u-1', 'u-2', 'u-3', 'u-4', 'u-5'] });
        const items: RentLineItem[] = [
            makeLineItem({ id: 'li-1', amount: 5000, type: 'base_rent' }),
        ];

        it('computes MRR once per contract, not per unit', () => {
            const kpis = computePortfolioKPIs(
                [contract],
                items,
                [{ id: 'p-1', name: 'Prop 1' }],
                '2024-06'
            );
            expect(kpis.mrr).toBe(5000);
            // unitCount reflects total units in contracts
            expect(kpis.byProperty[0].unitCount).toBe(5);
        });
    });

    // --- Test 3: Indexation mid-month ---
    describe('indexation mid-month', () => {
        const items: RentLineItem[] = [
            makeLineItem({
                id: 'li-1',
                amount: 1000,
                indexationRule: {
                    type: 'fixed_percent',
                    percentPerYear: 3,
                    baseDate: '2024-01-01',
                    adjustmentHistory: [
                        {
                            effectiveDate: '2024-07-15',
                            previousAmount: 1000,
                            newAmount: 1030,
                            reason: 'CPI +3%',
                        },
                    ],
                },
            }),
        ];

        it('uses adjusted amount after effective date', () => {
            expect(computeEffectiveAmount(items[0], '2024-07')).toBe(1030);
        });

        it('uses original amount before effective date', () => {
            expect(computeEffectiveAmount(items[0], '2024-06')).toBe(1000);
        });

        it('uses adjusted amount in MRR calculation', () => {
            expect(computeContractMRR(items, '2024-08')).toBe(1030);
        });
    });

    // --- Test 4: One-time vs recurring ---
    describe('one-time vs recurring KPI separation', () => {
        const items: RentLineItem[] = [
            makeLineItem({ id: 'li-1', amount: 1000, cadence: 'monthly' }),
            makeLineItem({ id: 'li-2', amount: 500, cadence: 'one-time', startDate: '2024-06-15', label: 'Maklerprovision', type: 'other' }),
        ];

        it('MRR excludes one-time', () => {
            expect(computeContractMRR(items, '2024-06')).toBe(1000);
        });

        it('one-time captured separately', () => {
            expect(computeContractOneTime(items, '2024-06')).toBe(500);
        });

        it('one-time not counted in wrong month', () => {
            expect(computeContractOneTime(items, '2024-07')).toBe(0);
        });
    });

    // --- Test 5: Contract ends mid-month ---
    describe('contract ends mid-month', () => {
        const items: RentLineItem[] = [
            makeLineItem({ id: 'li-1', amount: 1000, startDate: '2024-01-01', endDate: '2024-06-15' }),
        ];

        it('item still active in the month it ends', () => {
            expect(isActiveInMonth(items[0], '2024-06')).toBe(true);
        });

        it('item inactive the next month', () => {
            expect(isActiveInMonth(items[0], '2024-07')).toBe(false);
        });
    });

    // --- Test 6: Discount / credit_note ---
    describe('discount / credit_note', () => {
        const items: RentLineItem[] = [
            makeLineItem({ id: 'li-1', amount: 1000 }),
            makeLineItem({ id: 'li-2', amount: -100, type: 'discount', label: 'Rabatt' }),
        ];

        it('negative discount reduces MRR', () => {
            expect(computeContractMRR(items, '2024-06')).toBe(900);
        });
    });

    // --- Test 7: Cadence normalization ---
    describe('cadence normalization', () => {
        it('monthly stays the same', () => {
            expect(normalizeToMonthly(makeLineItem({ amount: 1200, cadence: 'monthly' }))).toBe(1200);
        });

        it('quarterly divides by 3', () => {
            expect(normalizeToMonthly(makeLineItem({ amount: 3000, cadence: 'quarterly' }))).toBe(1000);
        });

        it('yearly divides by 12', () => {
            expect(normalizeToMonthly(makeLineItem({ amount: 12000, cadence: 'yearly' }))).toBe(1000);
        });

        it('one-time returns 0', () => {
            expect(normalizeToMonthly(makeLineItem({ amount: 5000, cadence: 'one-time' }))).toBe(0);
        });
    });

    // --- Test 8: getActiveLineItems filtering ---
    describe('getActiveLineItems', () => {
        const items: RentLineItem[] = [
            makeLineItem({ id: 'li-1', startDate: '2024-01-01', isActive: true }),
            makeLineItem({ id: 'li-2', startDate: '2025-01-01', isActive: true }), // future
            makeLineItem({ id: 'li-3', startDate: '2024-01-01', isActive: false }), // deactivated
            makeLineItem({ id: 'li-4', startDate: '2024-01-01', endDate: '2024-05-31', isActive: true }), // expired
        ];

        it('filters correctly for June 2024', () => {
            const active = getActiveLineItems(items, '2024-06');
            expect(active.map(i => i.id)).toEqual(['li-1']);
        });
    });

    // --- Test 9: Full portfolio KPIs ---
    describe('portfolio KPIs', () => {
        const contracts: Contract[] = [
            makeContract({ id: 'c-1', propertyId: 'p-1' }),
            makeContract({ id: 'c-2', propertyId: 'p-2', tenantId: 't-2' }),
        ];
        const items: RentLineItem[] = [
            makeLineItem({ id: 'li-1', contractId: 'c-1', amount: 1000 }),
            makeLineItem({ id: 'li-2', contractId: 'c-1', amount: 200, type: 'ancillary_prepayment' }),
            makeLineItem({ id: 'li-3', contractId: 'c-2', amount: 800 }),
        ];
        const properties = [
            { id: 'p-1', name: 'Building A' },
            { id: 'p-2', name: 'Building B' },
        ];

        it('aggregates MRR across contracts', () => {
            const kpis = computePortfolioKPIs(contracts, items, properties, '2024-06');
            expect(kpis.mrr).toBe(2000); // 1000+200+800
        });

        it('breaks down by property', () => {
            const kpis = computePortfolioKPIs(contracts, items, properties, '2024-06');
            const propA = kpis.byProperty.find(p => p.propertyId === 'p-1')!;
            const propB = kpis.byProperty.find(p => p.propertyId === 'p-2')!;
            expect(propA.mrr).toBe(1200);
            expect(propB.mrr).toBe(800);
        });

        it('computes net rent (base_rent only)', () => {
            const kpis = computePortfolioKPIs(contracts, items, properties, '2024-06');
            expect(kpis.netRent).toBe(1800); // 1000+800
        });
    });

    // --- Test 10: Currency guard ---
    describe('EUR-only enforcement', () => {
        const items: RentLineItem[] = [
            makeLineItem({ id: 'li-1', amount: 1000, currency: 'EUR' }),
            makeLineItem({ id: 'li-2', amount: 500, currency: 'USD' }), // should still compute
        ];

        it('computeContractMRR sums all currencies (validation flags non-EUR)', () => {
            // The engine computes regardless; the validator flags it
            expect(computeContractMRR(items, '2024-06')).toBe(1500);
        });
    });
});
