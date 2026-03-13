// ===== AERA SCALE — Account Management Cloud Functions =====
// Handles server-side account deletion (requires Firebase Admin SDK).
// Clients cannot delete Firebase Auth users by themselves — must go via backend.

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import corsLib from 'cors';

const REGION = 'europe-west1';
const httpsRegion = functions.region(REGION).https;

// CORS middleware — restricted to AERA SCALE domains
const ALLOWED_ORIGINS = [
    'https://aera-scale-983360724436.europe-west1.run.app',
    'http://localhost:5173',
    'http://localhost:4173',
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

async function verifyAuth(req: functions.https.Request): Promise<string> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new functions.https.HttpsError('unauthenticated', 'Missing auth token');
    const decoded = await admin.auth().verifyIdToken(auth.slice(7));
    return decoded.uid;
}

// ---------------------------------------------------------------------------
// deleteAccount — permanently deletes the calling user's Firebase Auth account
// and deactivates their org membership.
//
// The org data (Immobilien, Mieter, etc.) is RETAINED for 30 days per DSGVO
// data retention requirements (could later be purged by a scheduled function).
//
// Body:  { confirmEmail: string }   — must match the authenticated user's email
// ---------------------------------------------------------------------------
export const deleteAccount = httpsRegion.onRequest(
    withCors(async (req, res) => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

        try {
            const uid = await verifyAuth(req);
            const { confirmEmail } = req.body as { confirmEmail?: string };

            // Get the user from Firebase Auth
            const userRecord = await admin.auth().getUser(uid);
            const userEmail = userRecord.email || '';

            // Safety check: confirmation email must match
            if (!confirmEmail || confirmEmail.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
                res.status(400).json({ error: 'E-Mail stimmt nicht überein. Konto wird nicht gelöscht.' });
                return;
            }

            const db = admin.firestore();

            // 1. Find the user's org membership via collection group
            const memberSnap = await db.collectionGroup('members')
                .where('uid', '==', uid)
                .get();

            // 2. Mark membership as deactivated (keeps org data intact)
            const deletionPromises = memberSnap.docs.map(async (doc) => {
                await doc.ref.update({
                    status: 'deactivated',
                    deactivatedAt: new Date().toISOString(),
                    deletionReason: 'user_self_deletion',
                });
            });
            await Promise.all(deletionPromises);

            // 3. Write audit log
            if (!memberSnap.empty) {
                const pathSegments = memberSnap.docs[0].ref.path.split('/');
                const orgId = pathSegments[1];
                await db.collection('auditLogs').add({
                    orgId,
                    action: 'account_deleted',
                    user: userEmail,
                    uid,
                    details: 'User hat eigenen Account gelöscht (Selbstlöschung)',
                    timestamp: new Date().toISOString(),
                });
            }

            // 4. Delete the Firebase Auth user (point of no return)
            await admin.auth().deleteUser(uid);

            res.json({ success: true, message: 'Account wurde erfolgreich gelöscht.' });
        } catch (err: any) {
            console.error('[deleteAccount] error:', err);
            const isHttp = err instanceof functions.https.HttpsError;
            res.status(isHttp ? 401 : 500).json({
                error: err.message || 'Interner Fehler beim Löschen des Accounts.',
            });
        }
    })
);
