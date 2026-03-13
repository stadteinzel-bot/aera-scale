// ===== AERA SCALE — Invoice Scheduler Cloud Function =====
// Scheduled function: runs on the 1st of every month at 06:00 UTC.
// Reads all active contracts and generates rent invoices for the current month.
// Uses idempotent writes: will NOT create duplicate invoices if run multiple times.

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const REGION = 'europe-west1';
const db = () => admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentMonth(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;  // e.g. "2026-03"
}

function invoiceNumber(orgId: string, contractId: string, month: string): string {
    // Deterministic invoice number: prevents duplicates
    return `INV-${month}-${contractId.slice(-6).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// generateMonthlyInvoices — 1st of every month, 06:00 UTC
// ---------------------------------------------------------------------------

export const generateMonthlyInvoices = functions
    .region(REGION)
    .pubsub
    .schedule('0 6 1 * *')         // 1st of month at 06:00 UTC
    .timeZone('Europe/Berlin')
    .onRun(async (_context) => {
        const firestore = db();
        const targetMonth = currentMonth();

        console.log('[generateMonthlyInvoices] Generating invoices for month:', targetMonth);

        // 1. Load all active contracts across all orgs
        let contractsSnap;
        try {
            contractsSnap = await firestore
                .collection('contracts')
                .where('status', '==', 'active')
                .get();
        } catch (e) {
            console.error('[generateMonthlyInvoices] Failed to query contracts:', e);
            return null;
        }

        let created = 0;
        let skipped = 0;

        const batch = firestore.batch();
        const batchOps: Promise<void>[] = [];

        for (const contractDoc of contractsSnap.docs) {
            const contract = contractDoc.data();
            const contractId = contractDoc.id;
            const orgId = contract.orgId as string;
            const tenantId = contract.tenantId as string | undefined;
            const propertyId = contract.propertyId as string | undefined;

            if (!orgId) continue;

            // Calculate invoice amount from line items
            const lineItemsSnap = await firestore
                .collection('contracts')
                .doc(contractId)
                .collection('lineItems')
                .where('active', '==', true)
                .get();

            // Sum up all recurring monthly amounts
            let totalAmount = 0;
            let netRent = 0;
            let ancillary = 0;

            for (const liDoc of lineItemsSnap.docs) {
                const li = liDoc.data();
                const amount = Number(li.amount) || 0;
                const cadence: string = li.cadence || 'monthly';
                const type: string = li.type || 'base_rent';

                // Normalize to monthly
                let monthlyAmount = 0;
                if (cadence === 'monthly') monthlyAmount = amount;
                else if (cadence === 'quarterly') monthlyAmount = amount / 3;
                else if (cadence === 'yearly') monthlyAmount = amount / 12;
                // one-time items are excluded from recurring invoices

                totalAmount += monthlyAmount;
                if (type === 'base_rent') netRent += monthlyAmount;
                else if (type === 'nk_advance') ancillary += monthlyAmount;
            }

            // Skip if no amount calculable
            if (totalAmount <= 0) {
                skipped++;
                continue;
            }

            // Idempotency: derive unique invoice number for this contract + month
            const invNumber = invoiceNumber(orgId, contractId, targetMonth);

            // Check if invoice already exists
            const existingSnap = await firestore
                .collection('rentInvoices')
                .where('orgId', '==', orgId)
                .where('invoiceNumber', '==', invNumber)
                .limit(1)
                .get();

            if (!existingSnap.empty) {
                console.log(`[generateMonthlyInvoices] Already exists: ${invNumber} — skipping`);
                skipped++;
                continue;
            }

            // Create invoice document
            const dueDate = new Date();
            dueDate.setDate(5); // Due on the 5th of the month by convention
            const dueDateStr = dueDate.toISOString().slice(0, 10);

            const invoiceRef = firestore.collection('rentInvoices').doc();
            batchOps.push(
                invoiceRef.set({
                    orgId,
                    contractId,
                    tenantId: tenantId || '',
                    propertyId: propertyId || '',
                    period: targetMonth,
                    invoiceNumber: invNumber,
                    totalAmount,
                    netRent,
                    ancillary,
                    status: 'offen',
                    autoGenerated: true,
                    dueDate: dueDateStr,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }).then(() => { created++; })
            );
        }

        // Flush all writes
        await Promise.all(batchOps);

        console.log(`[generateMonthlyInvoices] Done. Created: ${created}, Skipped: ${skipped}`);
        return null;
    });
