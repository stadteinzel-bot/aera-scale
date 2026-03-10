// ===== AERA SCALE — GoCardless Bank Account Data API Proxy =====
// All GoCardless API calls go through here — secrets never leave the backend.
//
// GoCardless Bank Account Data API (formerly Nordigen):
//   https://bankaccountdata.gocardless.com/api/v2/
//
// Env vars (set via Firebase Secret Manager or .env.local for emulator):
//   GOCARDLESS_SECRET_ID  — GoCardless API Secret ID
//   GOCARDLESS_SECRET_KEY — GoCardless API Secret Key

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios, { AxiosError } from 'axios';

const BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';
const REGION = 'europe-west1';
const httpsRegion = functions.region(REGION).https;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Verify Firebase ID token and return uid + custom claims */
async function verifyAuth(req: functions.https.Request): Promise<string> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new functions.https.HttpsError('unauthenticated', 'Missing auth token');
    const token = auth.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
}

/** Verify the caller is an active member of orgId */
async function verifyOrgMember(uid: string, orgId: string): Promise<void> {
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

let _gcToken: string | null = null;
let _gcTokenExpiry = 0;

async function getGCToken(): Promise<string> {
    if (_gcToken && Date.now() < _gcTokenExpiry - 30_000) return _gcToken;

    const secretId = process.env.GOCARDLESS_SECRET_ID;
    const secretKey = process.env.GOCARDLESS_SECRET_KEY;
    if (!secretId || !secretKey) {
        throw new functions.https.HttpsError('internal', 'GoCardless credentials not configured');
    }

    const resp = await axios.post(`${BASE_URL}/token/new/`, {
        secret_id: secretId,
        secret_key: secretKey,
    });

    _gcToken = resp.data.access as string;
    _gcTokenExpiry = Date.now() + (resp.data.access_expires as number) * 1000;
    return _gcToken;
}

function gcHeaders(token: string) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function handleGcError(error: unknown, res: functions.Response): void {
    if (error instanceof AxiosError) {
        console.error('[GoCardless] API error:', error.response?.data);
        res.status(error.response?.status ?? 502).json({ error: error.response?.data ?? error.message });
    } else if (error instanceof functions.https.HttpsError) {
        res.status(401).json({ error: error.message });
    } else {
        res.status(500).json({ error: String(error) });
    }
}

// ---------------------------------------------------------------------------
// 1. gcListInstitutions — list banks for a country
// ---------------------------------------------------------------------------
// GET ?orgId=...&country=DE
export const gcListInstitutions = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type'); res.sendStatus(204); return; }
    try {
        const uid = await verifyAuth(req);
        const { orgId, country = 'DE' } = req.query as Record<string, string>;
        await verifyOrgMember(uid, orgId);

        const token = await getGCToken();
        const resp = await axios.get(`${BASE_URL}/institutions/?country=${country}`, { headers: gcHeaders(token) });
        res.json(resp.data);
    } catch (e) { handleGcError(e, res); }
});

// ---------------------------------------------------------------------------
// 2. gcCreateRequisition — start OAuth bank link, return redirect URL
// ---------------------------------------------------------------------------
// POST { orgId, institutionId, redirectUrl }
export const gcCreateRequisition = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type'); res.sendStatus(204); return; }
    try {
        const uid = await verifyAuth(req);
        const { orgId, institutionId, redirectUrl } = req.body as Record<string, string>;
        await verifyOrgMember(uid, orgId);

        const token = await getGCToken();
        const resp = await axios.post(`${BASE_URL}/requisitions/`, {
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
    } catch (e) { handleGcError(e, res); }
});

// ---------------------------------------------------------------------------
// 3. gcActivateRequisition — call after OAuth redirect to fetch account IDs
// ---------------------------------------------------------------------------
// POST { orgId, requisitionId }
export const gcActivateRequisition = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type'); res.sendStatus(204); return; }
    try {
        const uid = await verifyAuth(req);
        const { orgId, requisitionId } = req.body as Record<string, string>;
        await verifyOrgMember(uid, orgId);

        const token = await getGCToken();
        const resp = await axios.get(`${BASE_URL}/requisitions/${requisitionId}/`, { headers: gcHeaders(token) });
        const { accounts, status, institution_id } = resp.data;

        // Fetch institution name
        let institutionName = institution_id;
        try {
            const instResp = await axios.get(`${BASE_URL}/institutions/${institution_id}/`, { headers: gcHeaders(token) });
            institutionName = instResp.data.name;
        } catch { /* silent */ }

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
    } catch (e) { handleGcError(e, res); }
});

// ---------------------------------------------------------------------------
// 4. gcGetTransactions — fetch last 90 days of transactions for an account
// ---------------------------------------------------------------------------
// GET ?orgId=...&accountId=...
export const gcGetTransactions = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type'); res.sendStatus(204); return; }
    try {
        const uid = await verifyAuth(req);
        const { orgId, accountId } = req.query as Record<string, string>;
        await verifyOrgMember(uid, orgId);

        const token = await getGCToken();
        const resp = await axios.get(`${BASE_URL}/accounts/${accountId}/transactions/`, { headers: gcHeaders(token) });
        res.json(resp.data.transactions ?? { booked: [], pending: [] });
    } catch (e) { handleGcError(e, res); }
});

// ---------------------------------------------------------------------------
// 5. gcSyncTransactions — save to Firestore + auto-reconcile against invoices
// ---------------------------------------------------------------------------
// POST { orgId, accountId }
export const gcSyncTransactions = httpsRegion.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type'); res.sendStatus(204); return; }
    try {
        const uid = await verifyAuth(req);
        const { orgId, accountId } = req.body as Record<string, string>;
        await verifyOrgMember(uid, orgId);

        const token = await getGCToken();
        const txResp = await axios.get(`${BASE_URL}/accounts/${accountId}/transactions/`, { headers: gcHeaders(token) });
        const booked: any[] = txResp.data.transactions?.booked ?? [];

        // Fetch open invoices for reconciliation
        const invoicesSnap = await admin.firestore()
            .collection('organizations').doc(orgId)
            .collection('rentInvoices')
            .where('status', '==', 'offen')
            .get();

        const openInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        const db = admin.firestore();
        const batch = db.batch();
        let synced = 0;
        let reconciled = 0;

        for (const tx of booked) {
            const amount = parseFloat(tx.transactionAmount?.amount ?? '0');
            const date: string = tx.bookingDate ?? tx.valueDate ?? '';
            const description: string = tx.remittanceInformationUnstructured ?? tx.creditorName ?? '';
            const txId = tx.transactionId ?? `${accountId}-${date}-${amount}`;

            const txRef = db.collection('organizations').doc(orgId)
                .collection('bankTransactions').doc(txId);

            // Skip if already saved
            const existing = await txRef.get();
            if (existing.exists) continue;

            // Auto-reconcile: match by amount (credit) within same month
            let matchedInvoiceId: string | undefined;
            let matchStatus = 'unmatched';

            if (amount > 0) {
                const txMonth = date.slice(0, 7); // YYYY-MM
                const match = openInvoices.find(inv =>
                    Math.abs(inv.amount - amount) < 0.01 &&
                    (inv.period ?? '').startsWith(txMonth)
                );
                if (match) {
                    matchedInvoiceId = match.id;
                    matchStatus = 'matched';
                    // Mark invoice as paid
                    batch.update(
                        db.collection('organizations').doc(orgId).collection('rentInvoices').doc(match.id),
                        { status: 'bezahlt', paidAt: date, paidViaBank: true }
                    );
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
    } catch (e) { handleGcError(e, res); }
});
