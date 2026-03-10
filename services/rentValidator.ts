// ===== AERA SCALE — Rent Validation Engine =====
// Implements checks A–D from the spec. Runs BEFORE Dashboard render.
// Pure functions — no side effects.

import {
    RentLineItem, Contract, ValidationReport, ValidationIssue,
    ContractValidation, ValidationConfig, DEFAULT_VALIDATION_CONFIG,
    ReconciliationReport, ReconciliationEntry,
} from '../types/rentTypes';
import {
    computeContractMRR, computeContractOneTime, getActiveLineItems,
} from './rentEngine';

// --- CHECK A: Sum check per Contract ---

function checkContractSums(
    contract: Contract,
    lineItems: RentLineItem[],
    targetMonth: string,
    config: ValidationConfig
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (contract.expectedMonthlyTotal == null) return issues;

    const computedMRR = computeContractMRR(lineItems, targetMonth);
    const expected = contract.expectedMonthlyTotal;
    const absoluteDiff = Math.abs(computedMRR - expected);
    const relativeDiff = expected !== 0 ? absoluteDiff / Math.abs(expected) : (absoluteDiff > 0 ? 1 : 0);

    if (absoluteDiff > config.absoluteThreshold || relativeDiff > config.percentThreshold) {
        issues.push({
            flag: 'CALC_MISMATCH',
            severity: 'error',
            contractId: contract.id,
            propertyId: contract.propertyId,
            message: `Vertrag ${contract.contractNumber}: Berechnete MRR (${computedMRR.toFixed(2)}€) weicht vom Erwartungswert (${expected.toFixed(2)}€) ab. Differenz: ${absoluteDiff.toFixed(2)}€ (${(relativeDiff * 100).toFixed(1)}%)`,
            details: { computedMRR, expected, absoluteDiff, relativeDiff },
        });
    }

    return issues;
}

// --- CHECK B: Duplicate line item detector ---

function checkDuplicateLineItems(
    allLineItems: RentLineItem[],
    targetMonth: string
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const active = getActiveLineItems(allLineItems, targetMonth);
    const seenIds = new Set<string>();

    for (const item of active) {
        if (seenIds.has(item.id)) {
            issues.push({
                flag: 'DUPLICATE_LINEITEM',
                severity: 'error',
                lineItemId: item.id,
                contractId: item.contractId,
                message: `RentLineItem "${item.label}" (ID: ${item.id}) kommt mehrfach im Aggregationsergebnis vor.`,
                details: { lineItemId: item.id, label: item.label },
            });
        }
        seenIds.add(item.id);
    }

    return issues;
}

// --- CHECK C: Plausibility ---

function checkPlausibility(
    allLineItems: RentLineItem[],
    targetMonth: string,
    config: ValidationConfig
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const active = getActiveLineItems(allLineItems, targetMonth);

    // C1: Negative amounts without discount/credit_note type
    for (const item of active) {
        if (item.amount < 0 && item.type !== 'discount' && item.type !== 'credit_note') {
            issues.push({
                flag: 'NEGATIVE_AMOUNT',
                severity: 'warning',
                lineItemId: item.id,
                contractId: item.contractId,
                message: `Negativer Betrag (${item.amount.toFixed(2)}€) bei "${item.label}" ohne Typ "discount" oder "credit_note".`,
                details: { amount: item.amount, type: item.type },
            });
        }
    }

    // C2: Currency check
    for (const item of active) {
        if (!config.allowedCurrencies.includes(item.currency)) {
            issues.push({
                flag: 'CURRENCY_MIX',
                severity: 'error',
                lineItemId: item.id,
                contractId: item.contractId,
                message: `Unerlaubte Währung "${item.currency}" bei "${item.label}". Erlaubt: ${config.allowedCurrencies.join(', ')}.`,
                details: { currency: item.currency, allowed: config.allowedCurrencies },
            });
        }
    }

    return issues;
}

// C3: Anomaly detection (month-over-month MRR jump)
function checkAnomalies(
    contracts: Contract[],
    lineItemsByContract: Map<string, RentLineItem[]>,
    targetMonth: string,
    previousMonth: string,
    config: ValidationConfig
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const contract of contracts) {
        if (contract.status !== 'active') continue;

        const items = lineItemsByContract.get(contract.id) || [];
        const currentMRR = computeContractMRR(items, targetMonth);
        const previousMRR = computeContractMRR(items, previousMonth);

        if (previousMRR === 0) continue; // skip if contract wasn't active before

        const delta = Math.abs(currentMRR - previousMRR) / Math.abs(previousMRR);

        if (delta > config.maxMonthlyDelta) {
            // Check if it's due to indexation — if so, it's expected
            const hasIndexation = items.some(item =>
                item.indexationRule?.adjustmentHistory?.some(adj => {
                    const adjDate = new Date(adj.effectiveDate);
                    const mStart = new Date(targetMonth + '-01');
                    const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
                    return adjDate >= mStart && adjDate <= mEnd;
                })
            );

            if (!hasIndexation) {
                issues.push({
                    flag: 'ANOMALY',
                    severity: 'warning',
                    contractId: contract.id,
                    propertyId: contract.propertyId,
                    message: `Vertrag ${contract.contractNumber}: MRR-Sprung von ${previousMRR.toFixed(2)}€ auf ${currentMRR.toFixed(2)}€ (+${(delta * 100).toFixed(1)}%) ohne Indexierung.`,
                    details: { currentMRR, previousMRR, delta, contractNumber: contract.contractNumber },
                });
            }
        }
    }

    return issues;
}

// --- MAIN VALIDATION FUNCTION ---

/**
 * Get the previous month string ("2025-01" → "2024-12")
 */
export function getPreviousMonth(targetMonth: string): string {
    const [y, m] = targetMonth.split('-').map(Number);
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Run all validation checks and produce a ValidationReport.
 *
 * @param contracts All contracts
 * @param allLineItems All rent line items
 * @param targetMonth "2025-01"
 * @param config Validation thresholds (uses defaults if omitted)
 */
export function validate(
    contracts: Contract[],
    allLineItems: RentLineItem[],
    targetMonth: string,
    config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): ValidationReport {
    const allIssues: ValidationIssue[] = [];
    const contractReports: ContractValidation[] = [];
    const previousMonth = getPreviousMonth(targetMonth);

    // Group line items by contract
    const lineItemsByContract = new Map<string, RentLineItem[]>();
    for (const item of allLineItems) {
        const existing = lineItemsByContract.get(item.contractId) || [];
        existing.push(item);
        lineItemsByContract.set(item.contractId, existing);
    }

    // B: Duplicate detection (global)
    const dupIssues = checkDuplicateLineItems(allLineItems, targetMonth);
    allIssues.push(...dupIssues);

    // C: Plausibility (global)
    const plausIssues = checkPlausibility(allLineItems, targetMonth, config);
    allIssues.push(...plausIssues);

    // C3: Anomalies (per contract)
    const anomalyIssues = checkAnomalies(contracts, lineItemsByContract, targetMonth, previousMonth, config);
    allIssues.push(...anomalyIssues);

    // A: Per-contract sum check + contract-level reports
    for (const contract of contracts) {
        if (contract.status !== 'active') continue;

        const items = lineItemsByContract.get(contract.id) || [];
        const contractIssues: ValidationIssue[] = [];

        // A: Sum check
        const sumIssues = checkContractSums(contract, items, targetMonth, config);
        contractIssues.push(...sumIssues);

        // Collect all issues relevant to this contract
        const relevantGlobalIssues = allIssues.filter(
            i => i.contractId === contract.id
        );

        const report: ContractValidation = {
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            tenantId: contract.tenantId,
            propertyId: contract.propertyId,
            computedMRR: computeContractMRR(items, targetMonth),
            expectedMRR: contract.expectedMonthlyTotal,
            oneTimeRevenue: computeContractOneTime(items, targetMonth),
            issues: [...contractIssues, ...relevantGlobalIssues],
        };

        contractReports.push(report);
        allIssues.push(...contractIssues);
    }

    const errorCount = allIssues.filter(i => i.severity === 'error').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;

    return {
        month: targetMonth,
        generatedAt: new Date().toISOString(),
        isClean: allIssues.length === 0,
        totalIssues: allIssues.length,
        errorCount,
        warningCount,
        issues: allIssues,
        contractReports,
    };
}

// --- RECONCILIATION REPORT ---

/**
 * Generate a full reconciliation report for a given month.
 * This is the admin-facing detailed breakdown.
 */
export function generateReconciliationReport(
    contracts: Contract[],
    allLineItems: RentLineItem[],
    properties: { id: string; name: string }[],
    tenants: { id: string; name: string }[],
    targetMonth: string,
    config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): ReconciliationReport {
    const validationReport = validate(contracts, allLineItems, targetMonth, config);

    // Group line items by contract
    const lineItemsByContract = new Map<string, RentLineItem[]>();
    for (const item of allLineItems) {
        const existing = lineItemsByContract.get(item.contractId) || [];
        existing.push(item);
        lineItemsByContract.set(item.contractId, existing);
    }

    const propertyNameMap = new Map(properties.map(p => [p.id, p.name]));
    const tenantNameMap = new Map(tenants.map(t => [t.id, t.name]));

    // Build entries per contract
    const entries: ReconciliationEntry[] = [];
    let totalMRR = 0;
    let totalOneTime = 0;

    for (const contract of contracts.filter(c => c.status === 'active')) {
        const items = lineItemsByContract.get(contract.id) || [];
        const activeItems = getActiveLineItems(items, targetMonth);
        const mrr = computeContractMRR(items, targetMonth);
        const oneTime = computeContractOneTime(items, targetMonth);

        totalMRR += mrr;
        totalOneTime += oneTime;

        const contractIssues = validationReport.issues.filter(
            i => i.contractId === contract.id
        );

        entries.push({
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            tenantName: tenantNameMap.get(contract.tenantId) || 'Unbekannt',
            propertyName: propertyNameMap.get(contract.propertyId) || 'Unbekannt',
            unitLabels: contract.unitIds,
            computedMRR: mrr,
            expectedMRR: contract.expectedMonthlyTotal,
            oneTimeRevenue: oneTime,
            lineItemCount: activeItems.length,
            issues: contractIssues,
        });
    }

    // Group by property
    const byPropertyMap = new Map<string, {
        propertyId: string;
        propertyName: string;
        totalMRR: number;
        contracts: ReconciliationEntry[];
    }>();

    for (const entry of entries) {
        const propId = contracts.find(c => c.id === entry.contractId)?.propertyId || '';
        const existing = byPropertyMap.get(propId) || {
            propertyId: propId,
            propertyName: propertyNameMap.get(propId) || 'Unbekannt',
            totalMRR: 0,
            contracts: [],
        };
        existing.totalMRR += entry.computedMRR;
        existing.contracts.push(entry);
        byPropertyMap.set(propId, existing);
    }

    return {
        month: targetMonth,
        generatedAt: new Date().toISOString(),
        isClean: validationReport.isClean,
        totalMRR: Math.round(totalMRR * 100) / 100,
        totalOneTime: Math.round(totalOneTime * 100) / 100,
        totalGrossRent: Math.round((totalMRR + totalOneTime) * 100) / 100,
        entries,
        byProperty: Array.from(byPropertyMap.values()).map(p => ({
            ...p,
            totalMRR: Math.round(p.totalMRR * 100) / 100,
        })),
        issues: validationReport.issues,
    };
}
