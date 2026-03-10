// ===== AERA SCALE — Rent Data Types =====
// Authoritative type definitions for contracts, rent line items,
// indexation, validation, and reconciliation.

// --- ENUMS & LITERAL TYPES ---

export type Cadence = 'monthly' | 'quarterly' | 'yearly' | 'one-time';

export type VatRule = 'standard_19' | 'reduced_7' | 'exempt' | 'reverse_charge';

export type LineItemType =
    | 'base_rent'              // Kaltmiete
    | 'ancillary_prepayment'   // NK-Vorauszahlung
    | 'service_fee'            // Service Fee / Verwaltungskosten
    | 'parking'                // Stellplatz
    | 'storage'                // Lagerfläche
    | 'discount'               // Rabatt (negative)
    | 'credit_note'            // Gutschrift (negative)
    | 'other';

export type ContractStatus = 'active' | 'terminated' | 'draft' | 'expired';

export type ValidationFlag =
    | 'CALC_MISMATCH'
    | 'DUPLICATE_LINEITEM'
    | 'ANOMALY'
    | 'NEGATIVE_AMOUNT'
    | 'CURRENCY_MIX'
    | 'MISSING_CONTRACT';

export type ValidationSeverity = 'error' | 'warning' | 'info';

// --- INDEXATION ---

export interface IndexAdjustment {
    effectiveDate: string;     // ISO date
    previousAmount: number;
    newAmount: number;
    reason: string;            // "CPI +2.3%" or "Vereinbarung"
}

export interface IndexationRule {
    type: 'fixed_percent' | 'cpi' | 'custom';
    percentPerYear?: number;   // e.g. 2.5 for 2.5%
    baseDate: string;          // ISO date when indexation started
    nextAdjustmentDate?: string;
    adjustmentHistory: IndexAdjustment[];
}

// --- RENT LINE ITEM ---

export interface RentLineItem {
    id: string;
    contractId: string;
    label: string;              // Human-readable: "Kaltmiete Büro 301"
    type: LineItemType;
    amount: number;             // EUR. Positive = charge, negative only for discount/credit_note
    currency: string;           // "EUR" (enforced)
    cadence: Cadence;
    startDate: string;          // ISO date
    endDate?: string;           // null/undefined = open-ended
    indexationRule?: IndexationRule;
    vatRule?: VatRule;
    isActive: boolean;          // false = cancelled/deactivated
    notes?: string;
    createdAt: string;
}

// --- CONTRACT ---

export interface Contract {
    id: string;
    tenantId: string;
    propertyId: string;
    unitIds: string[];          // one or more PropertyUnit IDs
    contractNumber: string;     // "MV-2025-001"
    startDate: string;          // ISO date
    endDate?: string;           // null = unbefristet
    status: ContractStatus;
    expectedMonthlyTotal?: number; // Optional cross-check field
    notes?: string;
    createdAt: string;
}

// --- VALIDATION ---

export interface ValidationIssue {
    flag: ValidationFlag;
    severity: ValidationSeverity;
    contractId?: string;
    lineItemId?: string;
    propertyId?: string;
    message: string;
    details: Record<string, unknown>;
}

export interface ContractValidation {
    contractId: string;
    contractNumber: string;
    tenantId: string;
    propertyId: string;
    computedMRR: number;
    expectedMRR?: number;
    oneTimeRevenue: number;
    issues: ValidationIssue[];
}

export interface ValidationReport {
    month: string;             // "2025-01"
    generatedAt: string;       // ISO timestamp
    isClean: boolean;
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    issues: ValidationIssue[];
    contractReports: ContractValidation[];
}

// --- KPI RESULTS ---

export interface MonthlyKPIs {
    month: string;             // "2025-01"
    mrr: number;               // Monthly Recurring Rent (excl. one-time)
    oneTimeRevenue: number;    // One-time payments this month
    grossRent: number;         // MRR + One-Time
    netRent: number;           // Base rent only (excl. NK)
    ancillaryPrepayments: number; // NK-Vorauszahlungen
    validationReport: ValidationReport;
    byProperty: PropertyKPI[];
    byCurrency: CurrencyKPI[];
}

export interface PropertyKPI {
    propertyId: string;
    propertyName: string;
    mrr: number;
    oneTimeRevenue: number;
    contractCount: number;
    unitCount: number;
}

export interface CurrencyKPI {
    currency: string;
    mrr: number;
    oneTimeRevenue: number;
}

// --- RECONCILIATION ---

export interface ReconciliationEntry {
    contractId: string;
    contractNumber: string;
    tenantName: string;
    propertyName: string;
    unitLabels: string[];
    computedMRR: number;
    expectedMRR?: number;
    oneTimeRevenue: number;
    lineItemCount: number;
    issues: ValidationIssue[];
}

export interface ReconciliationReport {
    month: string;
    generatedAt: string;
    isClean: boolean;
    totalMRR: number;
    totalOneTime: number;
    totalGrossRent: number;
    entries: ReconciliationEntry[];
    byProperty: {
        propertyId: string;
        propertyName: string;
        totalMRR: number;
        contracts: ReconciliationEntry[];
    }[];
    issues: ValidationIssue[];
}

// --- CONFIGURATION ---

export interface ValidationConfig {
    /** Max relative deviation for CALC_MISMATCH (0.005 = 0.5%) */
    percentThreshold: number;
    /** Max absolute deviation for CALC_MISMATCH in EUR */
    absoluteThreshold: number;
    /** Max month-over-month MRR change before ANOMALY flag (0.25 = 25%) */
    maxMonthlyDelta: number;
    /** Allowed currencies (items with other currencies get CURRENCY_MIX flag) */
    allowedCurrencies: string[];
}

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
    percentThreshold: 0.005,
    absoluteThreshold: 5,
    maxMonthlyDelta: 0.25,
    allowedCurrencies: ['EUR'],
};
