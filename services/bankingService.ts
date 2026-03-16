// ===== AERA SCALE — Tink Open Banking Frontend Service =====
// Calls our Cloud Functions proxy — Tink API keys stay server-side.
// Tink docs: https://docs.tink.com/api

import { auth } from './firebaseConfig';

const FUNCTIONS_BASE =
    import.meta.env.VITE_FUNCTIONS_URL ||
    'https://europe-west1-aera-scale.cloudfunctions.net';

async function authHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function cfPost(fn: string, body: Record<string, string>): Promise<any> {
    const headers = await authHeaders();
    const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
        method: 'POST', headers, body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
    }
    return res.json();
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Generate Tink Link URL → redirect user to connect their bank */
export async function createTinkLink(
    orgId: string,
    redirectUri: string,
    market = 'DE',
    propertyId?: string
): Promise<{ linkUrl: string; propertyId?: string }> {
    const body: Record<string, string> = { orgId, redirectUri, market };
    if (propertyId) body.propertyId = propertyId;
    return cfPost('tinkCreateLink', body);
}

/** Exchange Tink auth code after redirect → stores accounts in Firestore */
export async function handleTinkCallback(
    orgId: string,
    code: string,
    propertyId?: string
): Promise<{ connected: boolean; accounts: number; connectionId: string; propertyId?: string }> {
    const body: Record<string, string> = { orgId, code };
    if (propertyId) body.propertyId = propertyId;
    return cfPost('tinkHandleCallback', body);
}

/** Sync transactions from Tink → Firestore + auto-reconcile invoices */
export async function syncTinkTransactions(
    orgId: string,
    connectionId: string
): Promise<{ synced: number; reconciled: number }> {
    return cfPost('tinkSyncTransactions', { orgId, connectionId });
    // Note: propertyId is read server-side from the bankConnection doc
}

// ---------------------------------------------------------------------------
// Account Management
// ---------------------------------------------------------------------------

/**
 * Permanently deletes the authenticated user's Firebase Auth account.
 * Uses Firebase Auth SDK directly (no Cloud Function — avoids CORS issues).
 * @param confirmEmail  Must match the user's current email as a safety check
 */
export async function deleteAccount(confirmEmail: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Nicht angemeldet.');
    if (user.email?.toLowerCase() !== confirmEmail.toLowerCase()) {
        throw new Error('E-Mail-Adresse stimmt nicht überein.');
    }
    // Firebase Auth: user can delete their own account directly
    const { deleteUser } = await import('firebase/auth');
    await deleteUser(user);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BankConnection {
    connectionId: string;
    provider: 'tink';
    status: 'linked' | 'expired' | 'pending';
    accounts: { id: string; name: string; iban?: string }[];
    institutionName?: string;
    linkedAt?: any;
    /** Optional: scoped to a specific property */
    propertyId?: string;
    propertyName?: string; // resolved client-side
}

export interface StoredTransaction {
    id: string;
    accountId: string;
    amount: number;
    currency: string;
    date: string;
    description: string;
    matchedInvoiceId: string | null;
    matchStatus: 'unmatched' | 'matched' | 'manual';
    /** Optional: scoped to a specific property */
    propertyId?: string;
}
