// ===== AERA SCALE — Cloud Functions Entry Point =====

import * as admin from 'firebase-admin';

admin.initializeApp();

// Tink Open Banking integration (replaces GoCardless — new signups disabled)
export {
    tinkCreateLink,
    tinkHandleCallback,
    tinkSyncTransactions,
} from './tink';

// Account management (self-service account deletion)
export { deleteAccount } from './account';

// Scheduled: daily expiry reminders → writes to `mail` collection (Trigger Email extension)
export { sendExpiryReminders } from './notifications';

// Scheduled: 1st of every month → auto-generates rent invoices from active contracts
export { generateMonthlyInvoices } from './invoiceScheduler';

