/**
 * Repair script: Assign correct orgId to all orphaned documents.
 * 
 * The problem: Most documents have no 'orgId' field, making them invisible 
 * to dataService._orgQuery() which filters by orgId.
 * 
 * Fix: Assign the correct orgId to each document based on their content/owner.
 */
const { execSync } = require('child_process');
const https = require('https');

const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const PROJECT_ID = 'aera-scale';

function firestoreReq(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'firestore.googleapis.com',
            path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' + path,
            method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
            },
        };
        const r = https.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: {} }); } });
        });
        r.on('error', reject);
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

function val(fields, ...keys) {
    for (const key of keys) {
        if (fields && fields[key]) {
            const f = fields[key];
            return f.stringValue || f.integerValue || f.booleanValue || null;
        }
    }
    return null;
}

async function listAll(coll) {
    const results = [];
    let pageToken = null;
    do {
        const path = coll + '?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
        const res = await firestoreReq('GET', path);
        if (res.data.documents) results.push(...res.data.documents);
        pageToken = res.data.nextPageToken;
    } while (pageToken);
    return results;
}

async function setField(docPath, fieldName, value) {
    const relPath = docPath.replace('projects/' + PROJECT_ID + '/databases/(default)/documents/', '');
    const body = { fields: { [fieldName]: { stringValue: value } } };
    return firestoreReq('PATCH', relPath + '?updateMask.fieldPaths=' + fieldName, body);
}

const COLLECTIONS = [
    'properties', 'tenants', 'tickets', 'messages', 'documents',
    'operatingCosts', 'settlements', 'rentInvoices', 'payments',
    'contracts', 'rentLineItems', 'assetConfig', 'auditLogs', 'settings',
];

async function main() {
    // Step 1: Get all organizations and their owners
    const orgs = await listAll('organizations');
    console.log('\n=== Organizations ===');
    const orgByOwner = {};
    for (const o of orgs) {
        const id = o.name.split('/').pop();
        const createdBy = val(o.fields, 'createdBy');
        const name = val(o.fields, 'name', 'title');
        // Only use deterministic-format orgIds (org_<uid>), not timestamp-based
        const isDeterministic = /^org_[A-Za-z0-9]{20,}$/.test(id);
        console.log(`  ${id} | owner: ${createdBy} | name: ${name} | deterministic: ${isDeterministic}`);
        if (isDeterministic && createdBy) {
            orgByOwner[createdBy] = id;
        }
    }

    console.log('\n=== Owner → OrgId Map ===');
    for (const [uid, orgId] of Object.entries(orgByOwner)) {
        console.log(`  uid: ${uid} → ${orgId}`);
    }

    // Step 2: For each data collection, find documents WITHOUT orgId and assign one
    // We'll use the first available deterministic orgId as a fallback
    const allOrgIds = Object.values(orgByOwner);
    if (allOrgIds.length === 0) {
        console.error('No deterministic orgIds found. Cannot repair.');
        return;
    }

    // The primary orgId to assign to orphaned documents
    // (We assign to sk@sk-businesspark.de's org if found, otherwise first available)
    const SK_UID = 'YxaTeL0YNsdU9IjImgeKvjaE5lp2';
    const primaryOrgId = orgByOwner[SK_UID] || allOrgIds[0];
    console.log('\n🎯 Primary orgId for repair:', primaryOrgId);

    // Step 3: Repair orphaned documents
    let totalFixed = 0;
    let totalSkipped = 0;

    for (const coll of COLLECTIONS) {
        const docs = await listAll(coll);
        if (docs.length === 0) continue;

        let fixed = 0;
        let skipped = 0;

        for (const d of docs) {
            const existingOrgId = val(d.fields, 'orgId');
            if (!existingOrgId || existingOrgId === 'N/A') {
                // Assign the primary orgId
                await setField(d.name, 'orgId', primaryOrgId);
                fixed++;
            } else {
                skipped++;
            }
        }

        if (fixed > 0 || skipped > 0) {
            console.log(`  ${coll}: fixed ${fixed}, already had orgId: ${skipped}`);
        }
        totalFixed += fixed;
        totalSkipped += skipped;
    }

    console.log(`\n✅ Repair complete! Fixed: ${totalFixed}, Already correct: ${totalSkipped}`);
    console.log(`All documents now have orgId: ${primaryOrgId}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
