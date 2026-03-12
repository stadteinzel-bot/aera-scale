import { db, auth, storage } from "./firebaseConfig";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, writeBatch, setDoc, getDoc, orderBy, runTransaction, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { MOCK_PROPERTIES, MOCK_TENANTS, MOCK_TICKETS, MOCK_MESSAGES, DEFAULT_NOTIFICATION_SETTINGS } from "../constants";
import { Property, Tenant, MaintenanceTicket, Message, NotificationSettings, BankSettings, PropertyDocument, OperatingCostEntry, Settlement, RentInvoice, Payment, AssetConfig, AuditLogEntry } from "../types";
import { Contract, RentLineItem } from "../types/rentTypes";

// Production-safe logger — suppresses verbose logs in production
const IS_DEV = (import.meta as any).env?.DEV ?? false;
const log = {
    info: (...args: any[]) => IS_DEV && console.log(...args),
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args),
};


// Collection Names
const COLL_PROPERTIES = "properties";
const COLL_TENANTS = "tenants";
const COLL_TICKETS = "tickets";
const COLL_MESSAGES = "messages";
const COLL_SETTINGS = "settings";
const COLL_DOCUMENTS = "documents";
const COLL_COSTS = "operatingCosts";
const COLL_SETTLEMENTS = "settlements";
const COLL_INVOICES = "rentInvoices";
const COLL_PAYMENTS = "payments";
const COLL_CONTRACTS = "contracts";
const COLL_RENT_LINE_ITEMS = "rentLineItems";
const COLL_ASSET_CONFIG = "assetConfig";
const COLL_AUDIT_LOGS = "auditLogs";


// Utility: Recursively strip undefined values from objects (Firestore rejects undefined)
function stripUndefined(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(item => stripUndefined(item));
    if (typeof obj === 'object' && !(obj instanceof Date)) {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = stripUndefined(value);
            }
        }
        return cleaned;
    }
    return obj;
}

// Input sanitization for write operations
import { sanitizeObject } from '../utils/validation';
import { writeRateLimiter } from '../utils/rateLimiter';

// ── Audit Log Helper ──
// Silently logs all write operations for compliance tracking
async function _auditWrite(action: string, entityType: string, entityId: string, details?: string) {
    if (!db || !_orgId) return;
    try {
        const uid = auth?.currentUser?.uid || 'system';
        const email = auth?.currentUser?.email || '';
        await addDoc(collection(db!, COLL_AUDIT_LOGS), stripUndefined({
            action,
            propertyId: entityId,  // reuse propertyId field for entity reference
            field: entityType,
            details: details || `${action} on ${entityType}/${entityId}`,
            user: uid,
            userEmail: email,
            timestamp: new Date().toISOString(),
            orgId: _orgId,
            ownerId: uid,
        }));
    } catch (e) {
        // Audit log failure is non-critical — never block the primary operation
        log.warn('[Audit] Failed to write audit log:', e);
    }
}

// ── Multi-Tenant: Active org scope ──
let _orgId: string = '';

export const dataService = {

    // ── Org Scope Initializer ──
    init(orgId: string) {
        _orgId = orgId;
        log.info(`🏢 dataService scoped to org: ${orgId}`);
    },

    getOrgId(): string {
        return _orgId;
    },

    // Helper: build org-scoped query
    _orgQuery(collectionName: string, ...extraConstraints: any[]) {
        if (!_orgId) {
            log.warn('⚠️ dataService: no orgId set — queries are unscoped!');
            return query(collection(db!, collectionName), ...extraConstraints);
        }
        return query(collection(db!, collectionName), where('orgId', '==', _orgId), ...extraConstraints);
    },

    // Helper: inject orgId + ownerId into document data before write
    _withOrg(data: any): any {
        const uid = auth?.currentUser?.uid || '';
        return { ...data, orgId: _orgId, ownerId: uid };
    },

    // ── Pagination Config ──
    // PAGE_SIZE: Number of documents per page for paginated lists
    // MAX_FULL_FETCH: Safety cap for full-collection reads (properties, tenants are small enough)
    PAGE_SIZE: 100,
    MAX_FULL_FETCH: 500,

    // Helper: paginated fetch with limit — used for large collections
    async _paginatedGet<T>(collectionName: string, pageSize?: number, lastDoc?: QueryDocumentSnapshot<DocumentData>, ...extraConstraints: any[]): Promise<{ items: T[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
        if (!db) return { items: [], lastDoc: null, hasMore: false };
        const size = pageSize || this.PAGE_SIZE;
        const constraints = [...extraConstraints, limit(size)];
        if (lastDoc) constraints.push(startAfter(lastDoc));
        const q = this._orgQuery(collectionName, ...constraints);
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as T));
        const last = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
        return { items, lastDoc: last, hasMore: snapshot.docs.length === size };
    },

    // --- PROPERTIES ---

    async getProperties(): Promise<Property[]> {
        if (!db) {
            console.warn("⚠️ Firestore not initialized — returning MOCK_PROPERTIES");
            return MOCK_PROPERTIES;
        }
        try {
            const snapshot = await getDocs(this._orgQuery(COLL_PROPERTIES, limit(this.MAX_FULL_FETCH)));
            const props = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Property));
            log.info(`📦 Loaded ${props.length} properties from Firestore (org: ${_orgId})`);
            return props;
        } catch (e) {
            log.error("Error fetching properties:", e);
            return MOCK_PROPERTIES;
        }
    },

    async addProperty(property: Omit<Property, "id">): Promise<Property> {
        if (!db) {
            const newMock = { ...property, id: `mock-p-${Date.now()}` };
            MOCK_PROPERTIES.push(newMock);
            return newMock;
        }
        if (!_orgId) {
            throw new Error('Organisation not initialized — please reload the page.');
        }
        if (!writeRateLimiter.tryConsume()) throw new Error('Rate limit exceeded — please wait.');
        const payload = stripUndefined(this._withOrg(sanitizeObject(property as any)));
        log.info('📤 addProperty payload:', JSON.stringify(payload, null, 2));
        const docRef = await addDoc(collection(db, COLL_PROPERTIES), payload);
        _auditWrite('create', 'property', docRef.id, `Created property: ${(property as any).name || docRef.id}`);
        return { ...property, id: docRef.id };
    },

    async updateProperty(id: string, data: Partial<Property>): Promise<void> {
        if (!db) { log.warn("⚠️ No db — updateProperty skipped"); return; }
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        log.info(`💾 updateProperty(${id})`, Object.keys(updateData));
        await updateDoc(doc(db, COLL_PROPERTIES, id), stripUndefined(updateData));
        _auditWrite('update', 'property', id, `Updated fields: ${Object.keys(updateData).join(', ')}`);
        log.info(`✅ Property ${id} updated in Firestore`);
    },

    async deleteProperty(id: string): Promise<void> {
        if (!db) return;
        // Cascade delete: remove all child entities in a single batch
        const batch = writeBatch(db);

        // Collect all related documents
        // NOTE: auditLogs are intentionally kept (DSGVO compliance: allow delete: if false in rules)
        const childCollections = [
            { coll: COLL_TENANTS, field: 'propertyId' },
            { coll: COLL_TICKETS, field: 'propertyId' },
            { coll: COLL_INVOICES, field: 'propertyId' },
            { coll: COLL_CONTRACTS, field: 'propertyId' },
            { coll: COLL_DOCUMENTS, field: 'propertyId' },
            { coll: COLL_COSTS, field: 'propertyId' },
            { coll: COLL_SETTLEMENTS, field: 'propertyId' },
        ];

        for (const { coll, field } of childCollections) {
            const childSnap = await getDocs(this._orgQuery(coll, where(field, '==', id)));
            childSnap.docs.forEach(d => batch.delete(d.ref));
        }

        // Also cascade-delete payments linked to this property's invoices
        const invoiceSnap = await getDocs(this._orgQuery(COLL_INVOICES, where('propertyId', '==', id)));
        for (const invDoc of invoiceSnap.docs) {
            const paySnap = await getDocs(this._orgQuery(COLL_PAYMENTS, where('invoiceId', '==', invDoc.id)));
            paySnap.docs.forEach(d => batch.delete(d.ref));
        }

        // Delete the property itself
        batch.delete(doc(db, COLL_PROPERTIES, id));
        await batch.commit();
        log.info(`🗑️ Cascade-deleted property ${id} and all related entities`);
        _auditWrite('delete', 'property', id, 'Cascade-deleted property and all related entities');
    },

    // --- TENANTS ---

    async getTenants(): Promise<Tenant[]> {
        if (!db) return MOCK_TENANTS;
        try {
            const snapshot = await getDocs(this._orgQuery(COLL_TENANTS, limit(this.MAX_FULL_FETCH)));
            return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Tenant));
        } catch (e) {
            console.error("Error fetching tenants:", e);
            return MOCK_TENANTS;
        }
    },

    async addTenant(tenant: Omit<Tenant, "id">): Promise<Tenant> {
        if (!db) {
            const newMock = { ...tenant, id: `mock-t-${Date.now()}` };
            MOCK_TENANTS.push(newMock);
            return newMock;
        }
        const docRef = await addDoc(collection(db, COLL_TENANTS), stripUndefined(this._withOrg(sanitizeObject(tenant as any))));
        _auditWrite('create', 'tenant', docRef.id, `Created tenant: ${(tenant as any).name || docRef.id}`);
        return { ...tenant, id: docRef.id };
    },

    async updateTenant(id: string, data: Partial<Tenant>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_TENANTS, id), stripUndefined(updateData));
        _auditWrite('update', 'tenant', id, `Updated fields: ${Object.keys(updateData).join(', ')}`);
    },

    async deleteTenant(id: string): Promise<void> {
        if (!db) return;
        await deleteDoc(doc(db, COLL_TENANTS, id));
        _auditWrite('delete', 'tenant', id);
    },

    // --- TICKETS ---

    async getTickets(): Promise<MaintenanceTicket[]> {
        if (!db) return MOCK_TICKETS;
        try {
            const snapshot = await getDocs(this._orgQuery(COLL_TICKETS, limit(this.MAX_FULL_FETCH)));
            return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as MaintenanceTicket));
        } catch (e) {
            return MOCK_TICKETS;
        }
    },

    async addTicket(ticket: Omit<MaintenanceTicket, "id">): Promise<MaintenanceTicket> {
        if (!db) {
            const newMock = { ...ticket, id: `mock-mt-${Date.now()}` };
            MOCK_TICKETS.push(newMock);
            return newMock;
        }
        const docRef = await addDoc(collection(db, COLL_TICKETS), stripUndefined(this._withOrg(sanitizeObject(ticket as any))));
        _auditWrite('create', 'ticket', docRef.id, `Created ticket: ${(ticket as any).title || docRef.id}`);
        return { ...ticket, id: docRef.id };
    },

    async updateTicket(id: string, data: Partial<MaintenanceTicket>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_TICKETS, id), stripUndefined(updateData));
        _auditWrite('update', 'ticket', id, `Updated fields: ${Object.keys(updateData).join(', ')}`);
    },

    async deleteTicket(id: string): Promise<void> {
        if (!db) return;
        await deleteDoc(doc(db, COLL_TICKETS, id));
        _auditWrite('delete', 'ticket', id);
    },

    // --- MESSAGES ---

    async getMessages(): Promise<Message[]> {
        if (!db) return MOCK_MESSAGES;
        try {
            const snapshot = await getDocs(this._orgQuery(COLL_MESSAGES, limit(this.MAX_FULL_FETCH)));
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Message));
            return msgs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        } catch (e) {
            console.error("Error fetching messages:", e);
            return MOCK_MESSAGES;
        }
    },

    async addMessage(message: Omit<Message, "id">): Promise<Message> {
        if (!db) {
            const newMock = { ...message, id: `mock-m-${Date.now()}` };
            MOCK_MESSAGES.push(newMock);
            return newMock;
        }
        const docRef = await addDoc(collection(db, COLL_MESSAGES), stripUndefined(this._withOrg(message)));
        return { ...message, id: docRef.id };
    },

    async updateMessage(id: string, data: Partial<Message>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_MESSAGES, id), stripUndefined(updateData));
    },

    // --- SETTINGS (org-scoped: stored as settings/{orgId}) ---

    async getSettings(): Promise<NotificationSettings> {
        if (!db) return DEFAULT_NOTIFICATION_SETTINGS;
        try {
            const settingsDocId = _orgId || 'notifications';
            const docSnap = await getDoc(doc(db, COLL_SETTINGS, settingsDocId));
            if (docSnap.exists()) {
                return docSnap.data() as NotificationSettings;
            }
            return DEFAULT_NOTIFICATION_SETTINGS;
        } catch (e) {
            console.error("Error fetching settings:", e);
            return DEFAULT_NOTIFICATION_SETTINGS;
        }
    },

    async saveSettings(settings: NotificationSettings): Promise<void> {
        if (!db) return;
        const settingsDocId = _orgId || 'notifications';
        await setDoc(doc(db, COLL_SETTINGS, settingsDocId), stripUndefined(this._withOrg(settings)));
    },

    async getBankSettings(): Promise<BankSettings | null> {
        if (!db) return null;
        try {
            const bankDocId = (_orgId || 'default') + '_bank';
            const docSnap = await getDoc(doc(db, COLL_SETTINGS, bankDocId));
            if (docSnap.exists()) {
                return docSnap.data() as BankSettings;
            }
            return null;
        } catch (e) {
            console.error('Error fetching bank settings:', e);
            return null;
        }
    },

    async saveBankSettings(bank: BankSettings): Promise<void> {
        if (!db) return;
        const bankDocId = (_orgId || 'default') + '_bank';
        await setDoc(doc(db, COLL_SETTINGS, bankDocId), stripUndefined(this._withOrg(bank)));
    },

    // --- SEEDING ---
    async seedDatabase(forceOverwrite: boolean = false): Promise<boolean> {
        if (!db) return false;
        try {
            // Check if data already exists — only seed to empty collections
            if (!forceOverwrite) {
                const existingProps = await getDocs(this._orgQuery(COLL_PROPERTIES));
                if (existingProps.size > 0) {
                    log.info(`⚠️ Database already has ${existingProps.size} properties — skipping seed to preserve data.`);
                    return true; // Already has data, no need to seed
                }
            }

            log.info("🌱 Seeding database with demo data...");
            const batch = writeBatch(db);

            MOCK_PROPERTIES.forEach(p => {
                const ref = doc(db!, COLL_PROPERTIES, p.id);
                batch.set(ref, this._withOrg(p));
            });

            MOCK_TENANTS.forEach(t => {
                const ref = doc(db!, COLL_TENANTS, t.id);
                batch.set(ref, this._withOrg(t));
            });

            MOCK_TICKETS.forEach(t => {
                const ref = doc(db!, COLL_TICKETS, t.id);
                batch.set(ref, this._withOrg(t));
            });

            MOCK_MESSAGES.forEach(m => {
                const ref = doc(db!, COLL_MESSAGES, m.id);
                batch.set(ref, this._withOrg(m));
            });

            await batch.commit();
            log.info("✅ Database seeded successfully");
            return true;
        } catch (e) {
            console.error("Error seeding database:", e);
            return false;
        }
    },

    // --- AUTO-REPAIR: Sync tenant monthlyRent from property units ---
    async syncTenantRents(): Promise<number> {
        if (!db) return 0;
        try {
            const [tenantsSnap, propsSnap] = await Promise.all([
                getDocs(this._orgQuery(COLL_TENANTS)),
                getDocs(this._orgQuery(COLL_PROPERTIES)),
            ]);

            const properties = propsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Property[];
            const tenants = tenantsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Tenant[];
            const batch = writeBatch(db);
            let fixedCount = 0;

            for (const tenant of tenants) {
                const prop = properties.find(p => p.id === tenant.propertyId);
                const unit = prop?.units?.find(u => u.id === tenant.unitId);
                if (unit && unit.rentMonthly !== undefined && unit.rentMonthly !== tenant.monthlyRent) {
                    const ref = doc(db, COLL_TENANTS, tenant.id);
                    batch.update(ref, { monthlyRent: unit.rentMonthly });
                    fixedCount++;
                    log.info(`🔧 Syncing ${tenant.name}: ${tenant.monthlyRent} → ${unit.rentMonthly}`);
                }
            }

            if (fixedCount > 0) {
                await batch.commit();
                log.info(`✅ Auto-repaired ${fixedCount} tenant rent(s)`);
            }
            return fixedCount;
        } catch (e) {
            console.error("Error syncing tenant rents:", e);
            return 0;
        }
    },

    async getDocuments(): Promise<PropertyDocument[]> {
        if (!db) return [];
        try {
            const snapshot = await getDocs(this._orgQuery(COLL_DOCUMENTS));
            return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as PropertyDocument));
        } catch (e) {
            console.error("Error fetching documents:", e);
            return [];
        }
    },

    async getDocumentsByProperty(propertyId: string): Promise<PropertyDocument[]> {
        if (!db) return [];
        try {
            const q = this._orgQuery(COLL_DOCUMENTS, where('propertyId', '==', propertyId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as PropertyDocument));
        } catch (e) {
            console.error("Error fetching documents for property:", e);
            return [];
        }
    },

    async addDocument(document: Omit<PropertyDocument, 'id'>): Promise<PropertyDocument> {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = await addDoc(collection(db, COLL_DOCUMENTS), stripUndefined(this._withOrg(document)));
        return { ...document, id: docRef.id };
    },

    async updateDocument(id: string, data: Partial<PropertyDocument>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_DOCUMENTS, id), stripUndefined(updateData));
    },

    async deleteDocument(id: string, storagePath?: string): Promise<void> {
        if (!db) return;
        // Delete file from Firebase Storage if path provided
        if (storagePath && storage) {
            try {
                const fileRef = ref(storage, storagePath);
                await deleteObject(fileRef);
                log.info(`🗑️ Deleted file from Storage: ${storagePath}`);
            } catch (e: any) {
                // Ignore 'not found' errors — file may already be deleted
                if (e?.code !== 'storage/object-not-found') {
                    log.warn('Could not delete file from storage:', e);
                }
            }
        }
        // Delete metadata from Firestore
        await deleteDoc(doc(db, COLL_DOCUMENTS, id));
    },

    async uploadFile(file: File, path: string): Promise<{ url: string; storagePath: string }> {
        if (!storage) throw new Error('Firebase Storage nicht initialisiert');
        // Upload via Firebase Storage SDK — authenticated automatically
        const fileRef = ref(storage, path);
        const metadata = { contentType: file.type || 'application/octet-stream' };
        await uploadBytes(fileRef, file, metadata);
        // Get authenticated download URL
        const url = await getDownloadURL(fileRef);
        return { url, storagePath: path };
    },

    async deleteFile(path: string): Promise<void> {
        if (!storage) return;
        try {
            const fileRef = ref(storage, path);
            await deleteObject(fileRef);
        } catch (e: any) {
            if (e?.code !== 'storage/object-not-found') {
                throw new Error(`Löschen fehlgeschlagen: ${e.message}`);
            }
        }
    },

    // --- OPERATING COSTS ---

    async getOperatingCosts(): Promise<OperatingCostEntry[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_COSTS, orderBy('period', 'desc')));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as OperatingCostEntry));
    },

    async getOperatingCostsByProperty(propertyId: string): Promise<OperatingCostEntry[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_COSTS, where('propertyId', '==', propertyId), orderBy('period', 'desc')));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as OperatingCostEntry));
    },

    async addOperatingCost(entry: Omit<OperatingCostEntry, 'id'>): Promise<OperatingCostEntry> {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = await addDoc(collection(db, COLL_COSTS), stripUndefined(this._withOrg(entry)));
        return { ...entry, id: docRef.id };
    },

    async updateOperatingCost(id: string, data: Partial<OperatingCostEntry>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_COSTS, id), stripUndefined(updateData));
    },

    async deleteOperatingCost(id: string): Promise<void> {
        if (!db) return;
        await deleteDoc(doc(db, COLL_COSTS, id));
    },

    // --- SETTLEMENTS ---

    async getSettlements(): Promise<Settlement[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_SETTLEMENTS, orderBy('createdAt', 'desc')));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Settlement));
    },

    async addSettlement(settlement: Omit<Settlement, 'id'>): Promise<Settlement> {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = await addDoc(collection(db, COLL_SETTLEMENTS), stripUndefined(this._withOrg(settlement)));
        return { ...settlement, id: docRef.id };
    },

    async updateSettlement(id: string, data: Partial<Settlement>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_SETTLEMENTS, id), stripUndefined(updateData));
    },

    async deleteSettlement(id: string): Promise<void> {
        if (!db) return;
        await deleteDoc(doc(db, COLL_SETTLEMENTS, id));
    },

    // --- RENT INVOICES ---

    async getInvoices(): Promise<RentInvoice[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_INVOICES, orderBy('period', 'desc')));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as RentInvoice));
    },

    async getInvoicesByTenant(tenantId: string): Promise<RentInvoice[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_INVOICES, where('tenantId', '==', tenantId), orderBy('period', 'desc')));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as RentInvoice));
    },

    async addInvoice(invoice: Omit<RentInvoice, 'id'>): Promise<RentInvoice> {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = await addDoc(collection(db, COLL_INVOICES), stripUndefined(this._withOrg(invoice)));
        return { ...invoice, id: docRef.id };
    },

    async updateInvoice(id: string, data: Partial<RentInvoice>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_INVOICES, id), stripUndefined(updateData));
    },

    async deleteInvoice(id: string): Promise<void> {
        if (!db) return;
        await deleteDoc(doc(db, COLL_INVOICES, id));
    },

    async getNextInvoiceNumber(year: number): Promise<string> {
        if (!db) return `RE-${year}-0001`;
        // Use a counter document for atomic invoice number generation
        const counterRef = doc(db, 'settings', `${_orgId}_invoiceCounter_${year}`);
        try {
            const newNum = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                const currentNum = counterDoc.exists() ? (counterDoc.data().count || 0) : 0;
                const nextNum = currentNum + 1;
                transaction.set(counterRef, { count: nextNum, orgId: _orgId, year }, { merge: true });
                return nextNum;
            });
            return `RE-${year}-${String(newNum).padStart(4, '0')}`;
        } catch (e) {
            // Fallback to count-based if transaction fails
            log.warn('Invoice counter transaction failed, using count fallback:', e);
            const snapshot = await getDocs(this._orgQuery(COLL_INVOICES, where('invoiceNumber', '>=', `RE-${year}-`), where('invoiceNumber', '<=', `RE-${year}-9999`)));
            const num = snapshot.size + 1;
            return `RE-${year}-${String(num).padStart(4, '0')}`;
        }
    },

    async generateMonthlyInvoices(tenants: Tenant[], period: string): Promise<RentInvoice[]> {
        if (!db) return [];
        const year = parseInt(period.slice(0, 4));
        const month = parseInt(period.slice(5, 7));
        const dueDate = `${period}-05`; // Due 5th of month
        const created: RentInvoice[] = [];

        // Check which tenants already have invoices for this period
        const existing = await getDocs(this._orgQuery(COLL_INVOICES, where('period', '==', period)));
        const existingTenantIds = new Set(existing.docs.map(d => (d.data() as any).tenantId));

        for (const tenant of tenants) {
            // Skip if already invoiced or lease not active
            if (existingTenantIds.has(tenant.id)) continue;
            const leaseStart = new Date(tenant.leaseStart);
            const leaseEnd = tenant.leaseEnd ? new Date(tenant.leaseEnd) : new Date('2099-12-31');
            const periodDate = new Date(`${period}-01`);
            if (periodDate < leaseStart || periodDate > leaseEnd) continue;

            const invoiceNumber = await this.getNextInvoiceNumber(year);
            const nkVorauszahlung = Math.round(tenant.monthlyRent * 0.2 * 100) / 100;
            const invoice = await this.addInvoice({
                tenantId: tenant.id,
                propertyId: tenant.propertyId,
                invoiceNumber,
                period,
                dueDate,
                kaltmiete: tenant.monthlyRent,
                nebenkostenVorauszahlung: nkVorauszahlung,
                totalAmount: tenant.monthlyRent + nkVorauszahlung,
                status: 'sent',
                paidAmount: 0,
                remindersSent: 0,
                createdAt: new Date().toISOString(),
            });
            created.push(invoice);
        }
        return created;
    },

    // --- PAYMENTS ---

    async getPayments(): Promise<Payment[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_PAYMENTS, orderBy('date', 'desc')));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Payment));
    },

    async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_PAYMENTS, where('invoiceId', '==', invoiceId)));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Payment));
    },

    async addPayment(payment: Omit<Payment, 'id'>): Promise<Payment> {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = await addDoc(collection(db, COLL_PAYMENTS), stripUndefined(this._withOrg(payment)));
        return { ...payment, id: docRef.id };
    },

    async deletePayment(id: string): Promise<void> {
        if (!db) return;
        await deleteDoc(doc(db, COLL_PAYMENTS, id));
    },

    // --- CONTRACTS ---

    async getContracts(): Promise<Contract[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_CONTRACTS, orderBy('createdAt', 'desc')));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Contract));
    },

    async getContractsByProperty(propertyId: string): Promise<Contract[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_CONTRACTS, where('propertyId', '==', propertyId)));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Contract));
    },

    async getContractsByTenant(tenantId: string): Promise<Contract[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_CONTRACTS, where('tenantId', '==', tenantId)));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Contract));
    },

    async addContract(contract: Omit<Contract, 'id'>): Promise<Contract> {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = await addDoc(collection(db, COLL_CONTRACTS), stripUndefined(this._withOrg(contract)));
        return { ...contract, id: docRef.id };
    },

    async updateContract(id: string, data: Partial<Contract>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_CONTRACTS, id), stripUndefined(updateData));
    },

    async deleteContract(id: string): Promise<void> {
        if (!db) return;
        await deleteDoc(doc(db, COLL_CONTRACTS, id));
    },

    // --- RENT LINE ITEMS ---

    async getRentLineItems(): Promise<RentLineItem[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_RENT_LINE_ITEMS));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as RentLineItem));
    },

    async getRentLineItemsByContract(contractId: string): Promise<RentLineItem[]> {
        if (!db) return [];
        const snapshot = await getDocs(this._orgQuery(COLL_RENT_LINE_ITEMS, where('contractId', '==', contractId)));
        return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as RentLineItem));
    },

    async addRentLineItem(item: Omit<RentLineItem, 'id'>): Promise<RentLineItem> {
        if (!db) throw new Error('Firestore not initialized');
        const docRef = await addDoc(collection(db, COLL_RENT_LINE_ITEMS), stripUndefined(this._withOrg(item)));
        return { ...item, id: docRef.id };
    },

    async updateRentLineItem(id: string, data: Partial<RentLineItem>): Promise<void> {
        if (!db) return;
        const { id: _, orgId: _o, ownerId: _ow, ...updateData } = data as any;
        await updateDoc(doc(db, COLL_RENT_LINE_ITEMS, id), stripUndefined(updateData));
    },

    async deleteRentLineItem(id: string): Promise<void> {
        if (!db) return;
        await deleteDoc(doc(db, COLL_RENT_LINE_ITEMS, id));
    },

    // --- ASSET CONFIGURATION ---

    async getAssetConfig(propertyId: string): Promise<AssetConfig | null> {
        if (!db) return null;
        try {
            const key = _orgId ? `${_orgId}_${propertyId}` : propertyId;
            const docSnap = await getDoc(doc(db, COLL_ASSET_CONFIG, key));
            if (docSnap.exists()) {
                return docSnap.data() as AssetConfig;
            }
            return null;
        } catch (e) {
            console.error("Error fetching asset config:", e);
            return null;
        }
    },

    async saveAssetConfig(propertyId: string, config: AssetConfig): Promise<void> {
        if (!db) return;
        const key = _orgId ? `${_orgId}_${propertyId}` : propertyId;
        await setDoc(doc(db, COLL_ASSET_CONFIG, key), stripUndefined(this._withOrg({ ...config, updatedAt: new Date().toISOString() })));
    },

    async addAuditLog(entry: Omit<AuditLogEntry, 'id'>): Promise<void> {
        if (!db) return;
        await addDoc(collection(db, COLL_AUDIT_LOGS), stripUndefined(this._withOrg({ ...entry, timestamp: new Date().toISOString() })));
    },

    async getAuditLogs(propertyId: string): Promise<AuditLogEntry[]> {
        if (!db) return [];
        try {
            const q = this._orgQuery(COLL_AUDIT_LOGS, where('propertyId', '==', propertyId), orderBy('timestamp', 'desc'));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AuditLogEntry));
        } catch (e) {
            console.error("Error fetching audit logs:", e);
            return [];
        }
    },

    async getAllAuditLogs(maxEntries = 100): Promise<AuditLogEntry[]> {
        if (!db) return [];
        try {
            const q = this._orgQuery(COLL_AUDIT_LOGS, orderBy('timestamp', 'desc'), limit(maxEntries));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AuditLogEntry));
        } catch (e) {
            console.error("Error fetching all audit logs:", e);
            return [];
        }
    },


    // --- ORGANISATION MANAGEMENT ---

    async getOrgMembers(orgId: string): Promise<OrgMember[]> {
        if (!db) return [];
        if (!orgId) {
            console.warn('[dataService] getOrgMembers called with empty orgId');
            return [];
        }
        try {
            log.info(`[dataService] getOrgMembers reading orgMembers/${orgId}/members`);
            const snapshot = await getDocs(collection(db, 'orgMembers', orgId, 'members'));
            const result = snapshot.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as any as OrgMember));
            log.info(`[dataService] getOrgMembers found ${result.length} members for org ${orgId}`);
            return result;
        } catch (e) {
            log.error(`[dataService] getOrgMembers FAILED for org ${orgId}:`, e);
            return [];
        }
    },

    async updateOrgMember(orgId: string, uid: string, data: Partial<OrgMember>): Promise<void> {
        if (!db) return;
        await setDoc(doc(db, 'orgMembers', orgId, 'members', uid), data, { merge: true });
    },

    async createInvite(orgId: string, member: OrgMember): Promise<void> {
        if (!db) return;
        await setDoc(doc(db, 'orgMembers', orgId, 'members', member.uid), stripUndefined(member));
    },

    async updateOrganization(orgId: string, data: Partial<Organization>): Promise<void> {
        if (!db) return;
        await setDoc(doc(db, 'organizations', orgId), data, { merge: true });
    },
};

// Re-export OrgMember type needed by org management methods
import type { Organization, OrgMember } from '../types';
