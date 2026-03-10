"use strict";
// ===== AERA SCALE — Tink Open Banking API Proxy =====
// Tink (Visa) Bank Account Data — 3,500+ European banks.
// https://docs.tink.com/api
//
// Tink Link delegated client ID (constant — identifies Tink Link itself as actor):
//   https://docs.tink.com/resources/transactions/transactions-connect-banks-using-tink-link
//
// Env vars (Firebase Secret Manager or Functions config):
//   TINK_CLIENT_ID     — from Tink Console
//   TINK_CLIENT_SECRET — from Tink Console
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tinkSyncTransactions = exports.tinkHandleCallback = exports.tinkCreateLink = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importStar(require("axios"));
const cors_1 = __importDefault(require("cors"));
const TINK_API = 'https://api.tink.com';
const TINK_LINK = 'https://link.tink.com/1.0';
const REGION = 'europe-west1';
// Tink Link's own OAuth client ID — required as actor_client_id for delegated authorization.
// This is a public constant from Tink docs, not a secret.
const TINK_LINK_CLIENT_ID = 'df05e4b379934cd09963197cc855bfe9';
const httpsRegion = functions.region(REGION).https;
// CORS middleware — allows all origins (API is protected by Firebase Auth)
const _cors = (0, cors_1.default)({ origin: true, methods: ['GET', 'POST', 'OPTIONS'] });
function withCors(handler) {
    return (req, res) => new Promise((resolve, reject) => _cors(req, res, (err) => err ? reject(err) : resolve())).then(() => handler(req, res));
}
// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
async function verifyAuth(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        throw new functions.https.HttpsError('unauthenticated', 'Missing auth token');
    const decoded = await admin.auth().verifyIdToken(auth.slice(7));
    return decoded.uid;
}
async function verifyOrgMember(uid, orgId) {
    const snap = await admin.firestore()
        .collection('orgMembers').doc(orgId)
        .collection('members').doc(uid).get();
    if (!snap.exists || snap.data()?.status !== 'active') {
        throw new functions.https.HttpsError('permission-denied', 'Not an active org member');
    }
}
function handleError(error, res) {
    if (error instanceof axios_1.AxiosError) {
        const data = error.response?.data;
        const errMsg = typeof data === 'object' ? JSON.stringify(data) : (data ?? error.message);
        console.error('[Tink] API error:', JSON.stringify(data));
        res.status(error.response?.status ?? 502).json({ error: errMsg });
    }
    else if (error instanceof functions.https.HttpsError) {
        res.status(401).json({ error: error.message });
    }
    else {
        res.status(500).json({ error: String(error) });
    }
}
// ---------------------------------------------------------------------------
// Tink token helpers
// ---------------------------------------------------------------------------
async function getClientToken(scope) {
    const clientId = process.env.TINK_CLIENT_ID;
    const clientSecret = process.env.TINK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new functions.https.HttpsError('internal', 'Tink credentials not configured. Add TINK_CLIENT_ID and TINK_CLIENT_SECRET to functions/.env');
    }
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope,
    });
    const resp = await axios_1.default.post(`${TINK_API}/api/v1/oauth/token`, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return resp.data.access_token;
}
async function getUserToken(code) {
    const clientId = process.env.TINK_CLIENT_ID;
    const clientSecret = process.env.TINK_CLIENT_SECRET;
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
    });
    const resp = await axios_1.default.post(`${TINK_API}/api/v1/oauth/token`, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return { accessToken: resp.data.access_token, refreshToken: resp.data.refresh_token };
}
// ---------------------------------------------------------------------------
// 1. tinkCreateLink — generate Tink Link URL for bank connection
// ---------------------------------------------------------------------------
// POST { orgId, redirectUri, market?, propertyId? }
exports.tinkCreateLink = httpsRegion.onRequest(withCors(async (req, res) => {
    try {
        const uid = await verifyAuth(req);
        const { orgId, redirectUri, market = 'DE', propertyId } = req.body;
        if (!orgId || !redirectUri) {
            res.status(400).json({ error: 'Missing required fields: orgId, redirectUri' });
            return;
        }
        await verifyOrgMember(uid, orgId);
        const clientId = process.env.TINK_CLIENT_ID;
        if (!clientId)
            throw new functions.https.HttpsError('internal', 'TINK_CLIENT_ID not set');
        const externalUserId = `${orgId}-${uid}`;
        // Step 1a: Get token for user creation
        const userCreateToken = await getClientToken('user:create');
        console.log('[Tink] Got client token for user:create');
        // Step 1b: Create user in Tink (idempotent — returns same user if external_user_id exists)
        // This is REQUIRED before calling authorization-grant/delegate.
        // Tink returns the same user if the external_user_id already exists.
        let tinkUserId;
        try {
            const userResp = await axios_1.default.post(`${TINK_API}/api/v1/user/create`, { external_user_id: externalUserId, market, locale: 'de_DE' }, { headers: { Authorization: `Bearer ${userCreateToken}`, 'Content-Type': 'application/json' } });
            tinkUserId = userResp.data.user_id;
            console.log('[Tink] User created/retrieved, tinkUserId:', tinkUserId);
        }
        catch (userErr) {
            // If user already exists, a 409 may be returned — extract user_id from error or proceed
            if (userErr?.response?.data?.errorCode === 'USER_ALREADY_EXISTS' ||
                userErr?.response?.status === 409) {
                // User exists — we can still proceed without user_id for delegation via external_user_id
                tinkUserId = userErr?.response?.data?.user_id ?? '';
                console.log('[Tink] User already exists, continuing with external_user_id delegation');
            }
            else {
                throw userErr;
            }
        }
        // Step 2: Get token for authorization:grant
        const clientToken = await getClientToken('authorization:grant');
        console.log('[Tink] Got client token for authorization:grant');
        // Step 3: Create delegated authorization → get auth code.
        // actor_client_id = Tink Link's own client ID (required for delegated auth).
        // IMPORTANT: Always use external_user_id here (not internal user_id).
        // Tink Link resolves users by external_user_id, not the internal Tink UUID.
        const grantParams = new URLSearchParams({
            external_user_id: externalUserId,
            scope: 'accounts:read,transactions:read,credentials:read',
            actor_client_id: TINK_LINK_CLIENT_ID,
            id_hint: orgId,
        });
        console.log('[Tink] Calling authorization-grant/delegate with params:', grantParams.toString());
        const authResp = await axios_1.default.post(`${TINK_API}/api/v1/oauth/authorization-grant/delegate`, grantParams.toString(), { headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
        const authCode = authResp.data.code;
        console.log('[Tink] Got authorization code:', authCode?.slice(0, 8) + '...');
        // Step 4: Build Tink Link URL
        const linkUrl = `${TINK_LINK}/transactions/connect-accounts` +
            `?client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&authorization_code=${encodeURIComponent(authCode)}` +
            `&market=${market}` +
            `&locale=de_DE` +
            `&state=${encodeURIComponent(orgId)}`;
        console.log('[Tink] Tink Link URL generated successfully');
        // Embed propertyId in state so callback can retrieve it
        const fullState = propertyId ? `${orgId}|${propertyId}` : orgId;
        const linkUrlWithProperty = `${TINK_LINK}/transactions/connect-accounts` +
            `?client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&authorization_code=${encodeURIComponent(authCode)}` +
            `&market=${market}` +
            `&locale=de_DE` +
            `&state=${encodeURIComponent(fullState)}`;
        res.json({ linkUrl: linkUrlWithProperty, authCode, propertyId: propertyId || null });
    }
    catch (e) {
        handleError(e, res);
    }
}));
// ---------------------------------------------------------------------------
// 2. tinkHandleCallback — exchange auth code after Tink Link redirect
// ---------------------------------------------------------------------------
// POST { orgId, code, propertyId? }
exports.tinkHandleCallback = httpsRegion.onRequest(withCors(async (req, res) => {
    try {
        const uid = await verifyAuth(req);
        const { orgId, code, propertyId } = req.body;
        await verifyOrgMember(uid, orgId);
        // Exchange code for user access token
        const { accessToken, refreshToken } = await getUserToken(code);
        // Fetch accounts
        const accountsResp = await axios_1.default.get(`${TINK_API}/data/v2/accounts`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const accounts = accountsResp.data.accounts ?? [];
        // Store connection in Firestore (with optional propertyId linkage)
        const connectionId = `${orgId}-${Date.now()}`;
        const connectionData = {
            connectionId,
            provider: 'tink',
            status: 'linked',
            accessToken,
            refreshToken,
            accounts: accounts.map((a) => ({ id: a.id, name: a.name, iban: a.identifiers?.iban?.iban })),
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
            linkedBy: uid,
        };
        if (propertyId)
            connectionData.propertyId = propertyId;
        await admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('bankConnections').doc(connectionId)
            .set(connectionData);
        res.json({ connected: true, accounts: accounts.length, connectionId, propertyId: propertyId || null });
    }
    catch (e) {
        handleError(e, res);
    }
}));
// ---------------------------------------------------------------------------
// 3. tinkSyncTransactions — fetch + store + auto-reconcile transactions
// ---------------------------------------------------------------------------
// POST { orgId, connectionId }
exports.tinkSyncTransactions = httpsRegion.onRequest(withCors(async (req, res) => {
    try {
        const uid = await verifyAuth(req);
        const { orgId, connectionId } = req.body;
        await verifyOrgMember(uid, orgId);
        // propertyId is read from the stored connection doc, not the request
        // Get stored access token
        const connSnap = await admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('bankConnections').doc(connectionId).get();
        if (!connSnap.exists)
            throw new functions.https.HttpsError('not-found', 'Connection not found');
        const { accessToken, propertyId: connPropertyId } = connSnap.data();
        // Fetch transactions (last 90 days)
        const from = new Date();
        from.setDate(from.getDate() - 90);
        const txResp = await axios_1.default.get(`${TINK_API}/data/v2/transactions`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { bookedDateGte: from.toISOString().slice(0, 10), pageSize: 200 },
        });
        const transactions = txResp.data.transactions ?? [];
        // Fetch open invoices for reconciliation — scope to property if available
        let invoicesQuery = admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('rentInvoices')
            .where('status', '==', 'offen');
        if (connPropertyId) {
            invoicesQuery = invoicesQuery.where('propertyId', '==', connPropertyId);
        }
        const invoicesSnap = await invoicesQuery.get();
        const openInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const db = admin.firestore();
        const batch = db.batch();
        let synced = 0, reconciled = 0;
        for (const tx of transactions) {
            const txId = tx.id;
            const amount = tx.amount?.value?.unscaledValue
                ? parseInt(tx.amount.value.unscaledValue) / Math.pow(10, tx.amount.value.scale ?? 2)
                : 0;
            const date = tx.dates?.booked ?? tx.dates?.value ?? '';
            const description = tx.descriptions?.display ?? tx.descriptions?.original ?? '';
            const currency = tx.amount?.currencyCode ?? 'EUR';
            const txRef = db.collection('organizations').doc(orgId)
                .collection('bankTransactions').doc(txId);
            const existing = await txRef.get();
            if (existing.exists)
                continue;
            let matchedInvoiceId;
            let matchStatus = 'unmatched';
            if (amount > 0) {
                const txMonth = date.slice(0, 7);
                const match = openInvoices.find(inv => Math.abs(inv.amount - amount) < 0.01 &&
                    (inv.period ?? '').startsWith(txMonth));
                if (match) {
                    matchedInvoiceId = match.id;
                    matchStatus = 'matched';
                    batch.update(db.collection('organizations').doc(orgId).collection('rentInvoices').doc(match.id), { status: 'bezahlt', paidAt: date, paidViaBank: true });
                    reconciled++;
                }
            }
            const txData = {
                accountId: tx.accountId,
                amount,
                currency,
                date,
                description,
                matchedInvoiceId: matchedInvoiceId ?? null,
                matchStatus,
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (connPropertyId)
                txData.propertyId = connPropertyId;
            batch.set(txRef, txData);
            synced++;
        }
        await batch.commit();
        res.json({ synced, reconciled });
    }
    catch (e) {
        handleError(e, res);
    }
}));
//# sourceMappingURL=tink.js.map