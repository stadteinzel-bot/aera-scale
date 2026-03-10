// ===== AERA SCALE — Per-Org Storage Quota Service =====
// Tracks storage used per organization and enforces plan-based limits.
// Usage is stored in Firestore at: organizations/{orgId}.storageUsedBytes
// Plans: basic = 1 GB | pro = 50 GB | enterprise = unlimited

import { db } from './firebaseConfig';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export type StoragePlan = 'basic' | 'pro' | 'enterprise';

export interface QuotaInfo {
    plan: StoragePlan;
    usedBytes: number;
    limitBytes: number;       // -1 = unlimited
    usedGB: number;
    limitGB: number;
    percentUsed: number;
    remaining: number;        // bytes remaining (-1 = unlimited)
    isNearLimit: boolean;     // > 80%
    isAtLimit: boolean;       // >= 100%
}

const PLAN_LIMITS: Record<StoragePlan, number> = {
    basic: 1 * 1024 * 1024 * 1024,       //  1 GB
    pro: 50 * 1024 * 1024 * 1024,        // 50 GB
    enterprise: -1,                       // unlimited
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGB(bytes: number): number {
    return parseFloat((bytes / (1024 ** 3)).toFixed(2));
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Reads the current quota state for an org from Firestore.
 */
export async function getQuotaInfo(orgId: string): Promise<QuotaInfo> {
    if (!db) throw new Error('Firestore not initialised');

    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);
    const data = orgSnap.data() || {};

    const plan: StoragePlan = (data.storagePlan as StoragePlan) || 'basic';
    const usedBytes: number = data.storageUsedBytes ?? 0;
    const limitBytes: number = PLAN_LIMITS[plan];

    const usedGB = toGB(usedBytes);
    const limitGB = limitBytes === -1 ? -1 : toGB(limitBytes);
    const percentUsed = limitBytes === -1 ? 0 : Math.min(100, (usedBytes / limitBytes) * 100);
    const remaining = limitBytes === -1 ? -1 : Math.max(0, limitBytes - usedBytes);

    return {
        plan,
        usedBytes,
        limitBytes,
        usedGB,
        limitGB,
        percentUsed,
        remaining,
        isNearLimit: percentUsed >= 80,
        isAtLimit: percentUsed >= 100,
    };
}

/**
 * Returns true if the org has room for `fileBytes` more bytes.
 * Always returns true for enterprise plans.
 */
export async function checkQuota(orgId: string, fileBytes: number): Promise<{ allowed: boolean; quota: QuotaInfo }> {
    const quota = await getQuotaInfo(orgId);
    if (quota.limitBytes === -1) return { allowed: true, quota };     // enterprise = unlimited
    const allowed = quota.remaining >= fileBytes;
    return { allowed, quota };
}

/**
 * Increments the org's used storage counter after a successful upload.
 * Call this after the file is confirmed uploaded.
 */
export async function recordUpload(orgId: string, fileBytes: number): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, 'organizations', orgId), {
        storageUsedBytes: increment(fileBytes),
    });
}

/**
 * Decrements the org's used storage counter after a file is deleted.
 * Call this after the file is confirmed deleted from Storage.
 */
export async function recordDelete(orgId: string, fileBytes: number): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, 'organizations', orgId), {
        storageUsedBytes: increment(-fileBytes),
    });
}

// ---------------------------------------------------------------------------
// Formatting helpers (for UI)
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const PLAN_LABELS: Record<StoragePlan, string> = {
    basic: 'Basic (1 GB)',
    pro: 'Pro (50 GB)',
    enterprise: 'Enterprise (∞)',
};
