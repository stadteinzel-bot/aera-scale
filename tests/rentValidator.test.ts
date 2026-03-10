// ===== AERA SCALE — Rent Validator Tests =====
import { describe, it, expect } from 'vitest';
import { validate, getPreviousMonth, generateReconciliationReport } from '../services/rentValidator';
import { RentLineItem, Contract, DEFAULT_VALIDATION_CONFIG } from '../types/rentTypes';

// --- TEST DATA HELPERS ---

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

describe('rentValidator', () => {
    // --- getPreviousMonth helper ---
    describe('getPreviousMonth', () => {
        it('handles normal months', () => {
            expect(getPreviousMonth('2024-06')).toBe('2024-05');
        });

        it('handles January → December rollover', () => {
            expect(getPreviousMonth('2024-01')).toBe('2023-12');
        });
    });

    // --- Check A: CALC_MISMATCH ---
    describe('Check A: CALC_MISMATCH', () => {
        it('flags when computed MRR deviates from expectedMonthlyTotal', () => {
            const contracts = [makeContract({ expectedMonthlyTotal: 1500 })];
            const items = [makeLineItem({ amount: 1000 })]; // MRR = 1000 vs expected 1500

            const report = validate(contracts, items, '2024-06');
            expect(report.isClean).toBe(false);
            const mismatch = report.issues.find(i => i.flag === 'CALC_MISMATCH');
            expect(mismatch).toBeDefined();
            expect(mismatch!.severity).toBe('error');
        });

        it('passes when difference is within threshold', () => {
            const contracts = [makeContract({ expectedMonthlyTotal: 1002 })]; // within 5€
            const items = [makeLineItem({ amount: 1000 })];

            const report = validate(contracts, items, '2024-06');
            const mismatch = report.issues.find(i => i.flag === 'CALC_MISMATCH');
            expect(mismatch).toBeUndefined(); // 2€ diff is within 5€ absolute, but 0.2% > 0.5%? No, 2/1002 = 0.1996% < 0.5% AND 2 < 5. Hmm, actually both thresholds must be exceeded...
            // Wait: logic is absoluteDiff > config.absoluteThreshold || relativeDiff > config.percentThreshold
            // 2 > 5 = false, 0.001996 > 0.005 = false → no flag. Good.
        });

        it('no flag when expectedMonthlyTotal is not set', () => {
            const contracts = [makeContract()]; // no expectedMonthlyTotal
            const items = [makeLineItem()];

            const report = validate(contracts, items, '2024-06');
            const mismatch = report.issues.find(i => i.flag === 'CALC_MISMATCH');
            expect(mismatch).toBeUndefined();
        });
    });

    // --- Check B: DUPLICATE_LINEITEM ---
    describe('Check B: DUPLICATE_LINEITEM', () => {
        it('flags duplicate line item IDs in input', () => {
            const contracts = [makeContract()];
            const items = [
                makeLineItem({ id: 'li-dup', amount: 1000 }),
                makeLineItem({ id: 'li-dup', amount: 1000 }), // exact same ID
            ];

            const report = validate(contracts, items, '2024-06');
            const dup = report.issues.find(i => i.flag === 'DUPLICATE_LINEITEM');
            expect(dup).toBeDefined();
            expect(dup!.severity).toBe('error');
        });

        it('no flag when IDs are unique', () => {
            const contracts = [makeContract()];
            const items = [
                makeLineItem({ id: 'li-1' }),
                makeLineItem({ id: 'li-2', label: 'NK' }),
            ];

            const report = validate(contracts, items, '2024-06');
            const dup = report.issues.find(i => i.flag === 'DUPLICATE_LINEITEM');
            expect(dup).toBeUndefined();
        });
    });

    // --- Check C: NEGATIVE_AMOUNT ---
    describe('Check C: NEGATIVE_AMOUNT', () => {
        it('warning when negative amount without discount/credit_note type', () => {
            const contracts = [makeContract()];
            const items = [
                makeLineItem({ id: 'li-1', amount: -100, type: 'base_rent' }), // unexpected negative
            ];

            const report = validate(contracts, items, '2024-06');
            const neg = report.issues.find(i => i.flag === 'NEGATIVE_AMOUNT');
            expect(neg).toBeDefined();
            expect(neg!.severity).toBe('warning');
        });

        it('no flag for discount type with negative amount', () => {
            const contracts = [makeContract()];
            const items = [
                makeLineItem({ id: 'li-1', amount: -100, type: 'discount' }),
            ];

            const report = validate(contracts, items, '2024-06');
            const neg = report.issues.find(i => i.flag === 'NEGATIVE_AMOUNT');
            expect(neg).toBeUndefined();
        });
    });

    // --- Check C: CURRENCY_MIX ---
    describe('Check C: CURRENCY_MIX', () => {
        it('flags non-EUR currency', () => {
            const contracts = [makeContract()];
            const items = [
                makeLineItem({ id: 'li-1', currency: 'USD' }),
            ];

            const report = validate(contracts, items, '2024-06');
            const currMix = report.issues.find(i => i.flag === 'CURRENCY_MIX');
            expect(currMix).toBeDefined();
        });
    });

    // --- Check C: ANOMALY ---
    describe('Check C: ANOMALY (MRR jump)', () => {
        it('flags >25% MRR jump without indexation', () => {
            const contracts = [makeContract()];
            // Item starts at 1000 in May, but we simulate a jump by having two items
            // where one starts in June
            const items = [
                makeLineItem({ id: 'li-1', amount: 1000, startDate: '2024-01-01' }),
                makeLineItem({ id: 'li-2', amount: 500, startDate: '2024-06-01', label: 'Extra', type: 'other' }),
            ];

            const report = validate(contracts, items, '2024-06');
            const anomaly = report.issues.find(i => i.flag === 'ANOMALY');
            expect(anomaly).toBeDefined();
            expect(anomaly!.severity).toBe('warning');
        });

        it('no anomaly flag when jump is due to indexation', () => {
            const contracts = [makeContract()];
            const items = [
                makeLineItem({
                    id: 'li-1',
                    amount: 1000,
                    indexationRule: {
                        type: 'fixed_percent',
                        percentPerYear: 30,
                        baseDate: '2024-01-01',
                        adjustmentHistory: [{
                            effectiveDate: '2024-06-01',
                            previousAmount: 1000,
                            newAmount: 1300,
                            reason: 'CPI +30%',
                        }],
                    },
                }),
            ];

            const report = validate(contracts, items, '2024-06');
            const anomaly = report.issues.find(i => i.flag === 'ANOMALY');
            expect(anomaly).toBeUndefined();
        });
    });

    // --- Clean report ---
    describe('clean report', () => {
        it('returns isClean=true when no issues', () => {
            const contracts = [makeContract()];
            const items = [makeLineItem()];

            const report = validate(contracts, items, '2024-06');
            expect(report.isClean).toBe(true);
            expect(report.totalIssues).toBe(0);
        });
    });

    // --- Reconciliation report ---
    describe('reconciliation report generation', () => {
        it('generates a report with property breakdown', () => {
            const contracts = [
                makeContract({ id: 'c-1', propertyId: 'p-1' }),
                makeContract({ id: 'c-2', propertyId: 'p-1', tenantId: 't-2', contractNumber: 'MV-2024-002' }),
            ];
            const items = [
                makeLineItem({ id: 'li-1', contractId: 'c-1', amount: 1000 }),
                makeLineItem({ id: 'li-2', contractId: 'c-2', amount: 800 }),
            ];

            const report = generateReconciliationReport(
                contracts, items,
                [{ id: 'p-1', name: 'Building A' }],
                [{ id: 't-1', name: 'Tenant 1' }, { id: 't-2', name: 'Tenant 2' }],
                '2024-06'
            );

            expect(report.totalMRR).toBe(1800);
            expect(report.byProperty).toHaveLength(1);
            expect(report.byProperty[0].contracts).toHaveLength(2);
            expect(report.entries).toHaveLength(2);
        });
    });
});
