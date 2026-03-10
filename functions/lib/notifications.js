"use strict";
// ===== AERA SCALE — Notification Cloud Functions =====
// Scheduled function: runs daily at 08:00 UTC.
// Reads all active contracts, checks expiry dates against org notification
// settings, and writes to the `mail` collection (picked up by Trigger Email extension).
//
// Setup required:
//   - Firebase Extension "Trigger Email" installed in the project
//   - SMTP credentials configured in the extension
//   - `mail` collection allowed in Firestore rules
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
exports.sendExpiryReminders = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const REGION = 'europe-west1';
const db = () => admin.firestore();
// ---------------------------------------------------------------------------
// sendExpiryReminders — daily at 08:00 UTC
// ---------------------------------------------------------------------------
exports.sendExpiryReminders = functions
    .region(REGION)
    .pubsub
    .schedule('0 8 * * *') // every day at 08:00 UTC
    .timeZone('Europe/Berlin')
    .onRun(async (_context) => {
    const firestore = db();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('[sendExpiryReminders] Running at:', today.toISOString());
    // 1. Load all organizations
    const orgsSnap = await firestore.collection('organizations').get();
    let totalSent = 0;
    for (const orgDoc of orgsSnap.docs) {
        const orgId = orgDoc.id;
        const orgData = orgDoc.data();
        const settings = orgData.notificationSettings || {};
        const reminderDays = settings.reminderDays ?? [30, 14, 7];
        const recipientEmail = settings.notificationEmail || orgData.email || '';
        if (!recipientEmail) {
            console.log(`[sendExpiryReminders] Skipping org ${orgId}: no notification email configured`);
            continue;
        }
        // 2. Load active contracts for this org
        let contractsSnap;
        try {
            contractsSnap = await firestore
                .collection('contracts')
                .where('orgId', '==', orgId)
                .where('status', '==', 'active')
                .get();
        }
        catch (e) {
            console.warn(`[sendExpiryReminders] Failed to query contracts for org ${orgId}:`, e);
            continue;
        }
        const contracts = contractsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // 3. Check each contract
        for (const contract of contracts) {
            if (!contract.endDate)
                continue;
            const endDate = new Date(contract.endDate);
            endDate.setHours(0, 0, 0, 0);
            const daysUntilExpiry = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (!reminderDays.includes(daysUntilExpiry))
                continue;
            // 4. Write to `mail` collection → picked up by Firebase Trigger Email extension
            const subject = daysUntilExpiry === 0
                ? `⚠️ Vertrag läuft heute ab`
                : `Erinnerung: Vertrag läuft in ${daysUntilExpiry} Tagen ab`;
            const html = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                        <h2 style="color: #1a6b47;">AERA SCALE — Vertragserinnerung</h2>
                        <p>Der folgende Mietvertrag läuft bald ab:</p>
                        <ul>
                            <li><strong>Vertrags-ID:</strong> ${contract.id}</li>
                            <li><strong>Ablaufdatum:</strong> ${endDate.toLocaleDateString('de-DE')}</li>
                            <li><strong>Verbleibende Tage:</strong> ${daysUntilExpiry}</li>
                        </ul>
                        <p>Bitte prüfen Sie den Vertrag und leiten Sie die Vertragsverlängerung ein.</p>
                        <a href="https://aera-scale-983360724436.europe-west1.run.app/"
                           style="display: inline-block; margin-top: 16px; background: #1a6b47; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            In AERA SCALE öffnen
                        </a>
                        <p style="color: #888; font-size: 12px; margin-top: 24px;">AERA SCALE Immobilienverwaltung · Diese E-Mail wurde automatisch versandt.</p>
                    </div>
                `;
            await firestore.collection('mail').add({
                to: [recipientEmail],
                message: {
                    subject,
                    html,
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                orgId,
                contractId: contract.id,
                daysUntilExpiry,
            });
            totalSent++;
            console.log(`[sendExpiryReminders] Queued reminder for contract ${contract.id} (org: ${orgId}, days: ${daysUntilExpiry})`);
        }
    }
    console.log(`[sendExpiryReminders] Done. Queued ${totalSent} reminders.`);
    return null;
});
//# sourceMappingURL=notifications.js.map