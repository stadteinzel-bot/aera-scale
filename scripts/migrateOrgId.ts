/**
 * ===== AERA SCALE — Data Migration Script =====
 * 
 * Adds `orgId` field to all existing Firestore documents that don't have one.
 * 
 * Usage:
 *   1. Run from project root:  npx tsx scripts/migrateOrgId.ts
 *   2. The script will:
 *      - Find all organizations in Firestore
 *      - If exactly 1 org exists, tag all untagged documents with that orgId
 *      - If multiple orgs exist, ask which org to use as default
 *      - Process all 12 data collections in batches of 500
 *   3. Dry-run by default — set DRY_RUN=false below to apply changes
 * 
 * Requirements:
 *   - Firebase Admin SDK (npm install firebase-admin)
 *   - Service account key JSON (see DEPLOY.md)
 */

import * as admin from 'firebase-admin';

// ── Configuration ──
const DRY_RUN = true; // Set to false to actually write changes
const PROJECT_ID = 'aera-scale';

// Initialize Firebase Admin
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// All data collections that need orgId
const DATA_COLLECTIONS = [
    'properties',
    'tenants',
    'tickets',
    'messages',
    'documents',
    'operatingCosts',
    'settlements',
    'rentInvoices',
    'payments',
    'contracts',
    'rentLineItems',
    'assetConfig',
    'auditLogs',
];

async function getOrganizations(): Promise<{ id: string; name: string }[]> {
    const snap = await db.collection('organizations').get();
    return snap.docs.map(d => ({ id: d.id, name: d.data().name || d.id }));
}

async function migrateCollection(collectionName: string, orgId: string): Promise<{ total: number; migrated: number; skipped: number }> {
    const snapshot = await db.collection(collectionName).get();
    let migrated = 0;
    let skipped = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.orgId) {
            skipped++;
            continue;
        }

        if (!DRY_RUN) {
            batch.update(doc.ref, { orgId });
            batchCount++;

            // Firestore batch limit is 500
            if (batchCount >= 500) {
                await batch.commit();
                batchCount = 0;
            }
        }
        migrated++;
    }

    if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
    }

    return { total: snapshot.size, migrated, skipped };
}

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  AERA SCALE — Data Migration: Add orgId');
    console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE (writing changes)'}`);
    console.log('═══════════════════════════════════════════════════\n');

    // 1. Find organizations
    const orgs = await getOrganizations();

    if (orgs.length === 0) {
        console.error('❌ No organizations found in Firestore!');
        console.error('   Register a new account first to create an org, then run this script.');
        process.exit(1);
    }

    let targetOrgId: string;

    if (orgs.length === 1) {
        targetOrgId = orgs[0].id;
        console.log(`🏢 Using sole org: ${orgs[0].name} (${targetOrgId})\n`);
    } else {
        console.log('🏢 Multiple organizations found:');
        orgs.forEach((o, i) => console.log(`   ${i + 1}. ${o.name} (${o.id})`));
        console.log('\n⚠️  Please set targetOrgId manually in the script for multi-org scenarios.');
        process.exit(1);
    }

    // 2. Migrate each collection
    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const collName of DATA_COLLECTIONS) {
        try {
            const result = await migrateCollection(collName, targetOrgId);
            const status = result.migrated > 0 ? '✅' : '⏭️';
            console.log(`${status} ${collName.padEnd(20)} — ${result.total} docs total, ${result.migrated} to migrate, ${result.skipped} already tagged`);
            totalMigrated += result.migrated;
            totalSkipped += result.skipped;
        } catch (e: any) {
            console.error(`❌ ${collName.padEnd(20)} — Error: ${e.message}`);
        }
    }

    console.log('\n───────────────────────────────────────────────────');
    console.log(`📊 Summary: ${totalMigrated} docs ${DRY_RUN ? 'would be' : 'were'} migrated, ${totalSkipped} already had orgId`);

    if (DRY_RUN && totalMigrated > 0) {
        console.log('\n💡 To apply changes, set DRY_RUN = false and run again.');
    } else if (!DRY_RUN && totalMigrated > 0) {
        console.log('\n✅ Migration complete! All documents now have orgId.');
    } else {
        console.log('\n✅ Nothing to migrate — all documents already have orgId.');
    }
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
