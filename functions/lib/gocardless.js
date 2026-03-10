"use strict";
// ===== AERA SCALE — GoCardless Bank Account Data API Proxy =====
// All GoCardless API calls go through here — secrets never leave the backend.
//
// GoCardless Bank Account Data API (formerly Nordigen):
//   https://bankaccountdata.gocardless.com/api/v2/
//
// Env vars (set via Firebase Secret Manager or .env.local for emulator):
//   GOCARDLESS_SECRET_ID  — GoCardless API Secret ID
//   GOCARDLESS_SECRET_KEY — GoCardless API Secret Key
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.gcSyncTransactions = exports.gcGetTransactions = exports.gcActivateRequisition = exports.gcCreateRequisition = exports.gcListInstitutions = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importStar(require("axios"));
const BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';
const REGION = 'europe-west1';
const httpsRegion = functions.region(REGION).https;
// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
/** Verify Firebase ID token and return uid + custom claims */
async function verifyAuth(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        throw new functions.https.HttpsError('unauthenticated', 'Missing auth token');
    const token = auth.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
}
/** Verify the caller is an active member of orgId */
async function verifyOrgMember(uid, orgId) {
    const snap = await admin.firestore()
        .collection('organizations').doc(orgId)
        .collection('members').doc(uid)
        .get();
    if (!snap.exists || snap.data()?.status !== 'active') {
        throw new functions.https.HttpsError('permission-denied', 'Not an active org member');
    }
}
// ---------------------------------------------------------------------------
// GoCardless token cache (in-memory per function instance)
// ---------------------------------------------------------------------------
let _gcToken = null;
let _gcTokenExpiry = 0;
async function getGCToken() {
    if (_gcToken && Date.now() < _gcTokenExpiry - 30000)
        return _gcToken;
    const secretId = process.env.GOCARDLESS_SECRET_ID;
    const secretKey = process.env.GOCARDLESS_SECRET_KEY;
    if (!secretId || !secretKey) {
        throw new functions.https.HttpsError('internal', 'GoCardless credentials not configured');
    }
    const resp = await axios_1.default.post(`${BASE_URL}/token/new/`, {
        secret_id: secretId,
        secret_key: secretKey,
    });
    _gcToken = resp.data.access;
    _gcTokenExpiry = Date.now() + resp.data.access_expires * 1000;
    return _gcToken;
}
function gcHeaders(token) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
function handleGcError(error, res) {
    if (error instanceof axios_1.AxiosError) {
        console.error('[GoCardless] API error:', error.response?.data);
        res.status(error.response?.status ?? 502).json({ error: error.response?.data ?? error.message });
    }
    else if (error instanceof functions.https.HttpsError) {
        res.status(401).json({ error: error.message });
    }
    else {
        res.status(500).json({ error: String(error) });
    }
}
// ---------------------------------------------------------------------------
// 1. gcListInstitutions — list banks for a country
// ---------------------------------------------------------------------------
// GET ?orgId=...&country=DE
exports.gcListInstitutions = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
        res.sendStatus(204);
        return;
    }
    try {
        const uid = await verifyAuth(req);
        const { orgId, country = 'DE' } = req.query;
        await verifyOrgMember(uid, orgId);
        const token = await getGCToken();
        const resp = await axios_1.default.get(`${BASE_URL}/institutions/?country=${country}`, { headers: gcHeaders(token) });
        res.json(resp.data);
    }
    catch (e) {
        handleGcError(e, res);
    }
});
// ---------------------------------------------------------------------------
// 2. gcCreateRequisition — start OAuth bank link, return redirect URL
// ---------------------------------------------------------------------------
// POST { orgId, institutionId, redirectUrl }
exports.gcCreateRequisition = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
        res.sendStatus(204);
        return;
    }
    try {
        const uid = await verifyAuth(req);
        const { orgId, institutionId, redirectUrl } = req.body;
        await verifyOrgMember(uid, orgId);
        const token = await getGCToken();
        const resp = await axios_1.default.post(`${BASE_URL}/requisitions/`, {
            redirect: redirectUrl,
            institution_id: institutionId,
            reference: `${orgId}-${Date.now()}`,
            user_language: 'DE',
        }, { headers: gcHeaders(token) });
        const { id: requisitionId, link } = resp.data;
        // Persist pending connection in Firestore
        await admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('bankConnections').doc(requisitionId)
            .set({
            requisitionId,
            institutionId,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: uid,
            accounts: [],
        });
        res.json({ requisitionId, link });
    }
    catch (e) {
        handleGcError(e, res);
    }
});
// ---------------------------------------------------------------------------
// 3. gcActivateRequisition — call after OAuth redirect to fetch account IDs
// ---------------------------------------------------------------------------
// POST { orgId, requisitionId }
exports.gcActivateRequisition = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
        res.sendStatus(204);
        return;
    }
    try {
        const uid = await verifyAuth(req);
        const { orgId, requisitionId } = req.body;
        await verifyOrgMember(uid, orgId);
        const token = await getGCToken();
        const resp = await axios_1.default.get(`${BASE_URL}/requisitions/${requisitionId}/`, { headers: gcHeaders(token) });
        const { accounts, status, institution_id } = resp.data;
        // Fetch institution name
        let institutionName = institution_id;
        try {
            const instResp = await axios_1.default.get(`${BASE_URL}/institutions/${institution_id}/`, { headers: gcHeaders(token) });
            institutionName = instResp.data.name;
        }
        catch { /* silent */ }
        await admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('bankConnections').doc(requisitionId)
            .update({
            accounts: accounts ?? [],
            institutionId: institution_id,
            institutionName,
            status: status === 'LN' ? 'linked' : 'pending',
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ accounts, status, institutionName });
    }
    catch (e) {
        handleGcError(e, res);
    }
});
// ---------------------------------------------------------------------------
// 4. gcGetTransactions — fetch last 90 days of transactions for an account
// ---------------------------------------------------------------------------
// GET ?orgId=...&accountId=...
exports.gcGetTransactions = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
        res.sendStatus(204);
        return;
    }
    try {
        const uid = await verifyAuth(req);
        const { orgId, accountId } = req.query;
        await verifyOrgMember(uid, orgId);
        const token = await getGCToken();
        const resp = await axios_1.default.get(`${BASE_URL}/accounts/${accountId}/transactions/`, { headers: gcHeaders(token) });
        res.json(resp.data.transactions ?? { booked: [], pending: [] });
    }
    catch (e) {
        handleGcError(e, res);
    }
});
// ---------------------------------------------------------------------------
// 5. gcSyncTransactions — save to Firestore + auto-reconcile against invoices
// ---------------------------------------------------------------------------
// POST { orgId, accountId }
exports.gcSyncTransactions = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
        res.sendStatus(204);
        return;
    }
    try {
        const uid = await verifyAuth(req);
        const { orgId, accountId } = req.body;
        await verifyOrgMember(uid, orgId);
        const token = await getGCToken();
        const txResp = await axios_1.default.get(`${BASE_URL}/accounts/${accountId}/transactions/`, { headers: gcHeaders(token) });
        const booked = txResp.data.transactions?.booked ?? [];
        // Fetch open invoices for reconciliation
        const invoicesSnap = await admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('rentInvoices')
            .where('status', '==', 'offen')
            .get();
        const openInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const db = admin.firestore();
        const batch = db.batch();
        let synced = 0;
        let reconciled = 0;
        for (const tx of booked) {
            const amount = parseFloat(tx.transactionAmount?.amount ?? '0');
            const date = tx.bookingDate ?? tx.valueDate ?? '';
            const description = tx.remittanceInformationUnstructured ?? tx.creditorName ?? '';
            const txId = tx.transactionId ?? `${accountId}-${date}-${amount}`;
            const txRef = db.collection('organizations').doc(orgId)
                .collection('bankTransactions').doc(txId);
            // Skip if already saved
            const existing = await txRef.get();
            if (existing.exists)
                continue;
            // Auto-reconcile: match by amount (credit) within same month
            let matchedInvoiceId;
            let matchStatus = 'unmatched';
            if (amount > 0) {
                const txMonth = date.slice(0, 7); // YYYY-MM
                const match = openInvoices.find(inv => Math.abs(inv.amount - amount) < 0.01 &&
                    (inv.period ?? '').startsWith(txMonth));
                if (match) {
                    matchedInvoiceId = match.id;
                    matchStatus = 'matched';
                    // Mark invoice as paid
                    batch.update(db.collection('organizations').doc(orgId).collection('rentInvoices').doc(match.id), { status: 'bezahlt', paidAt: date, paidViaBank: true });
                    reconciled++;
                }
            }
            batch.set(txRef, {
                accountId,
                amount,
                currency: tx.transactionAmount?.currency ?? 'EUR',
                date,
                description,
                matchedInvoiceId: matchedInvoiceId ?? null,
                matchStatus,
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            synced++;
        }
        await batch.commit();
        res.json({ synced, reconciled });
    }
    catch (e) {
        handleGcError(e, res);
    }
});
//# sourceMappingURL=gocardless.js.map