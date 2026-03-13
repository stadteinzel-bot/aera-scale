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

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios, { AxiosError } from 'axios';
import corsLib from 'cors';

const TINK_API = 'https://api.tink.com';
const TINK_LINK = 'https://link.tink.com/1.0';
const REGION = 'europe-west1';

// Tink Link's own OAuth client ID — required as actor_client_id for delegated authorization.
// This is a public constant from Tink docs, not a secret.
const TINK_LINK_CLIENT_ID = 'df05e4b379934cd09963197cc855bfe9';
const httpsRegion = functions.region(REGION).https;

// CORS middleware — restricted to AERA SCALE domains
const ALLOWED_ORIGINS = [
    'https://aera-scale-983360724436.europe-west1.run.app',
    'http://localhost:5173',   // Vite dev server
    'http://localhost:4173',   // Vite preview
];
const _cors = corsLib({ origin: ALLOWED_ORIGINS, methods: ['GET', 'POST', 'OPTIONS'] });
function withCors(
    handler: (req: functions.https.Request, res: functions.Response) => Promise<void>
) {
    return (req: functions.https.Request, res: functions.Response) =>
        new Promise<void>((resolve, reject) =>
            _cors(req as any, res as any, (err?: any) => err ? reject(err) : resolve())
        ).then(() => handler(req, res));
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function verifyAuth(req: functions.https.Request): Promise<string> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new functions.https.HttpsError('unauthenticated', 'Missing auth token');
    const decoded = await admin.auth().verifyIdToken(auth.slice(7));
    return decoded.uid;
}

async function verifyOrgMember(uid: string, orgId: string): Promise<void> {
    const snap = await admin.firestore()
        .collection('orgMembers').doc(orgId)
        .collection('members').doc(uid).get();
    if (!snap.exists || snap.data()?.status !== 'active') {
        throw new functions.https.HttpsError('permission-denied', 'Not an active org member');
    }
}

function handleError(error: unknown, res: functions.Response): void {
    if (error instanceof AxiosError) {
        const data = error.response?.data;
        const errMsg = typeof data === 'object' ? JSON.stringify(data) : (data ?? error.message);
        console.error('[Tink] API error:', JSON.stringify(data));
        res.status(error.response?.status ?? 502).json({ error: errMsg });
    } else if (error instanceof functions.https.HttpsError) {
        res.status(401).json({ error: error.message });
    } else {
        res.status(500).json({ error: String(error) });
    }
}



// ---------------------------------------------------------------------------
// Tink token helpers
// ---------------------------------------------------------------------------

async function getClientToken(scope: string): Promise<string> {
    const clientId = process.env.TINK_CLIENT_ID;
    const clientSecret = process.env.TINK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new functions.https.HttpsError(
            'internal',
            'Tink credentials not configured. Add TINK_CLIENT_ID and TINK_CLIENT_SECRET to functions/.env'
        );
    }
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope,
    });
    const resp = await axios.post(`${TINK_API}/api/v1/oauth/token`, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return resp.data.access_token as string;
}

async function getUserToken(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const clientId = process.env.TINK_CLIENT_ID;
    const clientSecret = process.env.TINK_CLIENT_SECRET;
    const params = new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: 'authorization_code',
        code,
    });
    const resp = await axios.post(`${TINK_API}/api/v1/oauth/token`, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return { accessToken: resp.data.access_token, refreshToken: resp.data.refresh_token };
}

/**
 * Refresh an expired Tink user access token using the stored refresh token.
 * Updates the bankConnection doc in Firestore with the new tokens.
 */
async function refreshUserToken(
    orgId: string, connectionId: string, storedRefreshToken: string
): Promise<string> {
    const clientId = process.env.TINK_CLIENT_ID;
    const clientSecret = process.env.TINK_CLIENT_SECRET;
    const params = new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: 'refresh_token',
        refresh_token: storedRefreshToken,
    });
    const resp = await axios.post(`${TINK_API}/api/v1/oauth/token`, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const newAccessToken = resp.data.access_token as string;
    const newRefreshToken = resp.data.refresh_token as string | undefined;

    // Persist new tokens
    const updateData: Record<string, any> = { accessToken: newAccessToken };
    if (newRefreshToken) updateData.refreshToken = newRefreshToken;
    await admin.firestore()
        .collection('organizations').doc(orgId)
        .collection('bankConnections').doc(connectionId)
        .update(updateData);

    console.log('[Tink] Token refreshed for connection:', connectionId);
    return newAccessToken;
}


// ---------------------------------------------------------------------------
// 1. tinkCreateLink — generate Tink Link URL for bank connection
// ---------------------------------------------------------------------------
// POST { orgId, redirectUri, market?, propertyId? }
export const tinkCreateLink = httpsRegion.onRequest(withCors(async (req, res) => {
    try {
        const uid = await verifyAuth(req);
        const { orgId, redirectUri, market = 'DE', propertyId } = req.body as Record<string, string>;

        if (!orgId || !redirectUri) {
            res.status(400).json({ error: 'Missing required fields: orgId, redirectUri' });
            return;
        }

        await verifyOrgMember(uid, orgId);

        const clientId = process.env.TINK_CLIENT_ID;
        if (!clientId) throw new functions.https.HttpsError('internal', 'TINK_CLIENT_ID not set');

        const externalUserId = `${orgId}-${uid}`;

        // Step 1a: Get token for user creation
        const userCreateToken = await getClientToken('user:create');
        console.log('[Tink] Got client token for user:create');

        // Step 1b: Create user in Tink (idempotent — returns same user if external_user_id exists)
        // This is REQUIRED before calling authorization-grant/delegate.
        // Tink returns the same user if the external_user_id already exists.
        let tinkUserId: string;
        try {
            const userResp = await axios.post(
                `${TINK_API}/api/v1/user/create`,
                { external_user_id: externalUserId, market, locale: 'de_DE' },
                { headers: { Authorization: `Bearer ${userCreateToken}`, 'Content-Type': 'application/json' } }
            );
            tinkUserId = userResp.data.user_id;
            console.log('[Tink] User created/retrieved, tinkUserId:', tinkUserId);
        } catch (userErr: any) {
            // If user already exists, a 409 may be returned — extract user_id from error or proceed
            if (userErr?.response?.data?.errorCode === 'USER_ALREADY_EXISTS' ||
                userErr?.response?.status === 409) {
                // User exists — we can still proceed without user_id for delegation via external_user_id
                tinkUserId = userErr?.response?.data?.user_id ?? '';
                console.log('[Tink] User already exists, continuing with external_user_id delegation');
            } else {
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
        const authResp = await axios.post(
            `${TINK_API}/api/v1/oauth/authorization-grant/delegate`,
            grantParams.toString(),
            { headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const authCode: string = authResp.data.code;
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
    } catch (e) { handleError(e, res); }
}));

// ---------------------------------------------------------------------------
// 2. tinkHandleCallback — exchange auth code after Tink Link redirect
// ---------------------------------------------------------------------------
// POST { orgId, code, propertyId? }
export const tinkHandleCallback = httpsRegion.onRequest(withCors(async (req, res) => {
    try {
        const uid = await verifyAuth(req);
        const { orgId, code, propertyId } = req.body as Record<string, string>;
        await verifyOrgMember(uid, orgId);

        // Exchange code for user access token
        const { accessToken, refreshToken } = await getUserToken(code);

        // Fetch accounts
        const accountsResp = await axios.get(`${TINK_API}/data/v2/accounts`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const accounts = accountsResp.data.accounts ?? [];

        // Store connection in Firestore (with optional propertyId linkage)
        const connectionId = `${orgId}-${Date.now()}`;
        const connectionData: Record<string, any> = {
            connectionId,
            provider: 'tink',
            status: 'linked',
            accessToken,
            refreshToken,
            accounts: accounts.map((a: any) => ({ id: a.id, name: a.name, iban: a.identifiers?.iban?.iban })),
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
            linkedBy: uid,
        };
        if (propertyId) connectionData.propertyId = propertyId;

        await admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('bankConnections').doc(connectionId)
            .set(connectionData);

        res.json({ connected: true, accounts: accounts.length, connectionId, propertyId: propertyId || null });
    } catch (e) { handleError(e, res); }
}));

// ---------------------------------------------------------------------------
// 3. tinkSyncTransactions — fetch + store + auto-reconcile transactions
// ---------------------------------------------------------------------------
// POST { orgId, connectionId }
export const tinkSyncTransactions = httpsRegion.onRequest(withCors(async (req, res) => {
    try {
        const uid = await verifyAuth(req);
        const { orgId, connectionId } = req.body as Record<string, string>;
        await verifyOrgMember(uid, orgId);
        // propertyId is read from the stored connection doc, not the request

        // Get stored access token
        const connSnap = await admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('bankConnections').doc(connectionId).get();
        if (!connSnap.exists) throw new functions.https.HttpsError('not-found', 'Connection not found');

        const { accessToken, refreshToken: storedRefreshToken, propertyId: connPropertyId } = connSnap.data() as any;

        // Fetch transactions with auto-refresh on 401
        const from = new Date(); from.setDate(from.getDate() - 90);
        const txParams = { bookedDateGte: from.toISOString().slice(0, 10), pageSize: 200 };

        let transactions: any[];
        try {
            const txResp = await axios.get(`${TINK_API}/data/v2/transactions`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: txParams,
            });
            transactions = txResp.data.transactions ?? [];
        } catch (tokenErr: any) {
            // If 401 → token expired, try refresh
            if (tokenErr?.response?.status === 401 && storedRefreshToken) {
                console.log('[Tink] Access token expired, refreshing...');
                const freshToken = await refreshUserToken(orgId, connectionId, storedRefreshToken);
                const txResp = await axios.get(`${TINK_API}/data/v2/transactions`, {
                    headers: { Authorization: `Bearer ${freshToken}` },
                    params: txParams,
                });
                transactions = txResp.data.transactions ?? [];
            } else {
                throw tokenErr;
            }
        }

        // Fetch open invoices for reconciliation — scope to property if available
        let invoicesQuery = admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('rentInvoices')
            .where('status', '==', 'offen');
        if (connPropertyId) {
            invoicesQuery = invoicesQuery.where('propertyId', '==', connPropertyId) as any;
        }
        const invoicesSnap = await invoicesQuery.get();
        const openInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        const db = admin.firestore();
        const batch = db.batch();
        let synced = 0, reconciled = 0;

        for (const tx of transactions) {
            const txId = tx.id;
            const amount = tx.amount?.value?.unscaledValue
                ? parseInt(tx.amount.value.unscaledValue) / Math.pow(10, tx.amount.value.scale ?? 2)
                : 0;
            const date: string = tx.dates?.booked ?? tx.dates?.value ?? '';
            const description: string = tx.descriptions?.display ?? tx.descriptions?.original ?? '';
            const currency: string = tx.amount?.currencyCode ?? 'EUR';

            const txRef = db.collection('organizations').doc(orgId)
                .collection('bankTransactions').doc(txId);
            const existing = await txRef.get();
            if (existing.exists) continue;

            let matchedInvoiceId: string | undefined;
            let matchStatus = 'unmatched';

            if (amount > 0) {
                const txMonth = date.slice(0, 7);
                const match = openInvoices.find(inv =>
                    Math.abs(inv.amount - amount) < 0.01 &&
                    (inv.period ?? '').startsWith(txMonth)
                );
                if (match) {
                    matchedInvoiceId = match.id;
                    matchStatus = 'matched';
                    batch.update(
                        db.collection('organizations').doc(orgId).collection('rentInvoices').doc(match.id),
                        { status: 'bezahlt', paidAt: date, paidViaBank: true }
                    );
                    reconciled++;
                }
            }

            const txData: Record<string, any> = {
                accountId: tx.accountId,
                amount,
                currency,
                date,
                description,
                matchedInvoiceId: matchedInvoiceId ?? null,
                matchStatus,
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (connPropertyId) txData.propertyId = connPropertyId;
            batch.set(txRef, txData);
            synced++;
        }

        await batch.commit();
        res.json({ synced, reconciled });
    } catch (e) { handleError(e, res); }
}));
