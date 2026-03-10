// ===== AERA SCALE — Global Event Bus =====
// Type-safe pub/sub system for cross-module communication.
// When any module mutates data, it emits an event.
// Other modules (especially Dashboard) react automatically.

import type {
    Property, Tenant, MaintenanceTicket, RentInvoice,
    Payment, OperatingCostEntry, Settlement, PropertyDocument,
} from '../types';
import type { Contract, RentLineItem } from '../types/rentTypes';
import type { EntityName } from './entitySchema';

// ---------------------------------------------------------------------------
// EVENT TYPE DEFINITIONS
// ---------------------------------------------------------------------------

export type DataCoreEvent =
    // Entity CRUD
    | { type: 'entity:created'; entity: EntityName; payload: any }
    | { type: 'entity:updated'; entity: EntityName; id: string; payload: Partial<any> }
    | { type: 'entity:deleted'; entity: EntityName; id: string }

    // Domain-specific high-level events
    | { type: 'invoice:created'; payload: RentInvoice }
    | { type: 'invoice:statusChanged'; payload: { id: string; from: string; to: string } }
    | { type: 'payment:received'; payload: Payment }
    | { type: 'ticket:created'; payload: MaintenanceTicket }
    | { type: 'ticket:statusChanged'; payload: { id: string; from: string; to: string } }
    | { type: 'tenant:rentSynced'; payload: { tenantId: string; oldRent: number; newRent: number } }
    | { type: 'tenant:statusChanged'; payload: { id: string; from: string; to: string } }
    | { type: 'property:updated'; payload: Property }
    | { type: 'contract:statusChanged'; payload: { id: string; from: string; to: string } }
    | { type: 'settlement:created'; payload: Settlement }
    | { type: 'document:uploaded'; payload: PropertyDocument }

    // System-level events
    | { type: 'data:reloaded'; payload: { collections: EntityName[] } }
    | { type: 'kpis:invalidated'; payload?: undefined }
    | { type: 'kpis:recomputed'; payload?: undefined };

// ---------------------------------------------------------------------------
// EVENT BUS IMPLEMENTATION
// ---------------------------------------------------------------------------

type Listener = (event: DataCoreEvent) => void;
type Unsubscribe = () => void;

class EventBus {
    private listeners: Map<string, Set<Listener>> = new Map();
    private globalListeners: Set<Listener> = new Set();
    private history: DataCoreEvent[] = [];
    private maxHistory = 100;

    /**
     * Subscribe to a specific event type.
     * Returns an unsubscribe function.
     */
    on(eventType: DataCoreEvent['type'], listener: Listener): Unsubscribe {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(listener);
        return () => { this.listeners.get(eventType)?.delete(listener); };
    }

    /**
     * Subscribe to ALL events (used by DataCore for KPI invalidation).
     */
    onAny(listener: Listener): Unsubscribe {
        this.globalListeners.add(listener);
        return () => { this.globalListeners.delete(listener); };
    }

    /**
     * Emit an event to all matching listeners.
     */
    emit(event: DataCoreEvent): void {
        // Record in history
        this.history.push(event);
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }

        // Notify specific listeners
        const specific = this.listeners.get(event.type);
        if (specific) {
            specific.forEach(fn => {
                try { fn(event); } catch (e) { console.error(`[EventBus] Error in listener for ${event.type}:`, e); }
            });
        }

        // Notify global listeners
        this.globalListeners.forEach(fn => {
            try { fn(event); } catch (e) { console.error(`[EventBus] Error in global listener:`, e); }
        });
    }

    /** Get recent event history (for debugging / reconciliation) */
    getHistory(): readonly DataCoreEvent[] {
        return this.history;
    }

    /** Clear all listeners (for tests) */
    reset(): void {
        this.listeners.clear();
        this.globalListeners.clear();
        this.history = [];
    }
}

// Singleton instance
export const eventBus = new EventBus();
