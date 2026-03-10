"use strict";
// ===== AERA SCALE — Account Management Cloud Functions =====
// Handles server-side account deletion (requires Firebase Admin SDK).
// Clients cannot delete Firebase Auth users by themselves — must go via backend.
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
exports.deleteAccount = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const REGION = 'europe-west1';
const httpsRegion = functions.region(REGION).https;
// CORS middleware
const _cors = (0, cors_1.default)({ origin: true, methods: ['GET', 'POST', 'OPTIONS'] });
function withCors(handler) {
    return (req, res) => new Promise((resolve, reject) => _cors(req, res, (err) => err ? reject(err) : resolve())).then(() => handler(req, res));
}
async function verifyAuth(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        throw new functions.https.HttpsError('unauthenticated', 'Missing auth token');
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
exports.deleteAccount = httpsRegion.onRequest(withCors(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const uid = await verifyAuth(req);
        const { confirmEmail } = req.body;
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
    }
    catch (err) {
        console.error('[deleteAccount] error:', err);
        const isHttp = err instanceof functions.https.HttpsError;
        res.status(isHttp ? 401 : 500).json({
            error: err.message || 'Interner Fehler beim Löschen des Accounts.',
        });
    }
}));
//# sourceMappingURL=account.js.map