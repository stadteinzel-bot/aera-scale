// ===== AERA SCALE — Entity Schema & Relationship Model =====
// Central ER definition with explicit foreign keys and unified status logic.
// This is the authoritative reference for all data relationships.

// ---------------------------------------------------------------------------
// UNIFIED STATUS
// ---------------------------------------------------------------------------

/** Einheitliche Status-Logik für alle Module */
export type UnifiedStatus = 'open' | 'pending' | 'critical' | 'closed';

/** Maps domain-specific statuses to unified statuses */
export const STATUS_MAP = {
    // Property / Unit
    Occupied: 'closed' as UnifiedStatus,
    Vacant: 'open' as UnifiedStatus,
    Maintenance: 'pending' as UnifiedStatus,

    // Tenant
    'Good Standing': 'open' as UnifiedStatus,
    'Late': 'pending' as UnifiedStatus,
    'Notice Given': 'critical' as UnifiedStatus,
    'Delinquent': 'critical' as UnifiedStatus,

    // Maintenance Ticket
    Open: 'open' as UnifiedStatus,
    'In Progress': 'pending' as UnifiedStatus,
    Resolved: 'closed' as UnifiedStatus,

    // Invoice
    draft: 'open' as UnifiedStatus,
    sent: 'open' as UnifiedStatus,
    partial: 'pending' as UnifiedStatus,
    overdue: 'critical' as UnifiedStatus,
    paid: 'closed' as UnifiedStatus,
    cancelled: 'closed' as UnifiedStatus,

    // Settlement
    validated: 'pending' as UnifiedStatus,

    // Contract
    active: 'open' as UnifiedStatus,
    terminated: 'closed' as UnifiedStatus,
    expired: 'closed' as UnifiedStatus,
} as const;

/** Resolve any domain status to a UnifiedStatus */
export function toUnifiedStatus(domainStatus: string): UnifiedStatus {
    return (STATUS_MAP as Record<string, UnifiedStatus>)[domainStatus] ?? 'open';
}

// ---------------------------------------------------------------------------
// FOREIGN KEY SCHEMA
// ---------------------------------------------------------------------------

/**
 * Explicit foreign key definitions per entity.
 * Used for validation, join resolution, and documentation.
 */
export interface ForeignKeyDef {
    field: string;        // field name on the entity
    referencesEntity: EntityName;
    referencesField: string;
    required: boolean;
}

export type EntityName =
    | 'properties'
    | 'tenants'
    | 'tickets'
    | 'invoices'
    | 'payments'
    | 'costs'
    | 'settlements'
    | 'contracts'
    | 'lineItems'
    | 'documents'
    | 'messages';

export const ENTITY_SCHEMA: Record<EntityName, { fk: ForeignKeyDef[]; statusField?: string }> = {
    properties: {
        fk: [],
        statusField: 'status',
    },
    tenants: {
        fk: [
            { field: 'propertyId', referencesEntity: 'properties', referencesField: 'id', required: true },
            { field: 'unitId', referencesEntity: 'properties', referencesField: 'units[].id', required: false },
        ],
        statusField: 'status',
    },
    tickets: {
        fk: [
            { field: 'tenantId', referencesEntity: 'tenants', referencesField: 'id', required: true },
            { field: 'propertyId', referencesEntity: 'properties', referencesField: 'id', required: true },
        ],
        statusField: 'status',
    },
    invoices: {
        fk: [
            { field: 'tenantId', referencesEntity: 'tenants', referencesField: 'id', required: true },
            { field: 'propertyId', referencesEntity: 'properties', referencesField: 'id', required: true },
        ],
        statusField: 'status',
    },
    payments: {
        fk: [
            { field: 'invoiceId', referencesEntity: 'invoices', referencesField: 'id', required: false },
            { field: 'tenantId', referencesEntity: 'tenants', referencesField: 'id', required: true },
        ],
    },
    costs: {
        fk: [
            { field: 'propertyId', referencesEntity: 'properties', referencesField: 'id', required: true },
        ],
    },
    settlements: {
        fk: [
            { field: 'propertyId', referencesEntity: 'properties', referencesField: 'id', required: true },
        ],
        statusField: 'status',
    },
    contracts: {
        fk: [
            { field: 'tenantId', referencesEntity: 'tenants', referencesField: 'id', required: true },
            { field: 'propertyId', referencesEntity: 'properties', referencesField: 'id', required: true },
        ],
        statusField: 'status',
    },
    lineItems: {
        fk: [
            { field: 'contractId', referencesEntity: 'contracts', referencesField: 'id', required: true },
        ],
    },
    documents: {
        fk: [
            { field: 'propertyId', referencesEntity: 'properties', referencesField: 'id', required: true },
            { field: 'tenantId', referencesEntity: 'tenants', referencesField: 'id', required: false },
        ],
    },
    messages: {
        fk: [
            { field: 'propertyId', referencesEntity: 'properties', referencesField: 'id', required: false },
            { field: 'tenantId', referencesEntity: 'tenants', referencesField: 'id', required: false },
        ],
    },
};

// ---------------------------------------------------------------------------
// ENTITY LOOKUP HELPERS
// ---------------------------------------------------------------------------

import type {
    Property, Tenant, MaintenanceTicket, RentInvoice,
    Payment, OperatingCostEntry, Settlement, PropertyDocument, Message,
} from '../types';
import type { Contract, RentLineItem } from '../types/rentTypes';

/** All entities in a single flat shape for generic operations */
export interface EntityMap {
    properties: Property[];
    tenants: Tenant[];
    tickets: MaintenanceTicket[];
    invoices: RentInvoice[];
    payments: Payment[];
    costs: OperatingCostEntry[];
    settlements: Settlement[];
    contracts: Contract[];
    lineItems: RentLineItem[];
    documents: PropertyDocument[];
    messages: Message[];
}

/** Resolve a FK: find the referenced entity */
export function resolveFK<T extends { id: string }>(
    pool: T[],
    foreignKey: string | undefined,
): T | undefined {
    if (!foreignKey) return undefined;
    return pool.find(item => item.id === foreignKey);
}

/** Get all children that reference a parent via a FK field */
export function getChildren<T extends Record<string, any>>(
    pool: T[],
    fkField: string,
    parentId: string,
): T[] {
    return pool.filter(item => item[fkField] === parentId);
}

/** Validate FK integrity: returns broken references */
export function validateFKIntegrity(
    data: EntityMap,
    entityName: EntityName,
): { field: string; brokenIds: string[] }[] {
    const schema = ENTITY_SCHEMA[entityName];
    const entities = data[entityName] as Record<string, any>[];
    const issues: { field: string; brokenIds: string[] }[] = [];

    for (const fk of schema.fk) {
        const refPool = data[fk.referencesEntity] as { id: string }[];
        const refIds = new Set(refPool.map(r => r.id));
        const broken: string[] = [];

        for (const entity of entities) {
            const val = entity[fk.field];
            if (val && !refIds.has(val)) {
                broken.push(val);
            } else if (fk.required && !val) {
                broken.push('(missing)');
            }
        }
        if (broken.length > 0) {
            issues.push({ field: fk.field, brokenIds: broken });
        }
    }
    return issues;
}
