/**
 * Migration script using Firestore REST API with gcloud access token.
 * Updates all documents with timestamp-based orgIds to use deterministic format.
 */
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_ID = 'aera-scale';
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();

// Users to migrate (from auth export)
const USERS = [
    { uid: '7HpXNsjTyHOWRpCcyAMjBhWXzEr2', email: 'wolf@center-capital.com' },
    { uid: 'YxaTeL0YNsdU9IjImgeKvjaE5lp2', email: 'sk@sk-businesspark.de' },
    { uid: 'ff3JdqKPJugQDPvIc4KIIeU6aiE2', email: 'testdiag2026@gmail.com' },
];

const DATA_COLLECTIONS = [
    'properties', 'tenants', 'tickets', 'messages', 'documents',
    'operatingCosts', 'settlements', 'rentInvoices', 'payments',
    'contracts', 'rentLineItems', 'assetConfig', 'auditLogs', 'settings',
];

function firestoreRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-goog-user-project': PROJECT_ID,
            },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function listDocuments(collection) {
    const results = [];
    let pageToken = null;

    do {
        const path = `${collection}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
        const res = await firestoreRequest('GET', path);
        if (res.data.documents) results.push(...res.data.documents);
        pageToken = res.data.nextPageToken;
    } while (pageToken);

    return results;
}

function getFieldValue(doc, fieldName) {
    if (!doc.fields || !doc.fields[fieldName]) return null;
    const field = doc.fields[fieldName];
    return field.stringValue || field.integerValue || null;
}

async function updateField(docPath, fieldName, newValue) {
    // Extract relative path from full document name
    const relPath = docPath.replace(`projects/${PROJECT_ID}/databases/(default)/documents/`, '');
    const body = {
        fields: { [fieldName]: { stringValue: newValue } }
    };
    const path = `${relPath}?updateMask.fieldPaths=${fieldName}`;
    return firestoreRequest('PATCH', path, body);
}

async function migrate() {
    console.log('🔄 Starting orgId migration via REST API...\n');

    // Step 1: List all organizations
    const orgs = await listDocuments('organizations');
    console.log(`Found ${orgs.length} organizations:`);
    for (const org of orgs) {
        const orgId = org.name.split('/').pop();
        const createdBy = getFieldValue(org, 'createdBy');
        console.log(`  - ${orgId} (created by: ${createdBy})`);
    }

    // Step 2: For each user, find their old orgIds and migrate data
    for (const user of USERS) {
        const newOrgId = `org_${user.uid}`;
        console.log(`\n👤 ${user.email} (uid: ${user.uid})`);
        console.log(`   Target orgId: ${newOrgId}`);

        // Find all orgs created by this user
        const userOrgs = orgs.filter(o => getFieldValue(o, 'createdBy') === user.uid);
        const oldOrgIds = userOrgs.map(o => o.name.split('/').pop()).filter(id => id !== newOrgId);

        if (oldOrgIds.length === 0) {
            console.log('   ✅ No old orgs to migrate');
        } else {
            console.log(`   Old orgIds: ${oldOrgIds.join(', ')}`);
        }

        // Step 3: Ensure target org exists (create from first old org if needed)
        const targetOrgExists = userOrgs.some(o => o.name.split('/').pop() === newOrgId);
        if (!targetOrgExists && userOrgs.length > 0) {
            console.log('   📝 Creating target org document...');
            const sourceOrg = userOrgs[0];
            const body = {
                fields: {
                    ...sourceOrg.fields,
                    id: { stringValue: newOrgId },
                }
            };
            await firestoreRequest('PATCH', `organizations/${newOrgId}`, body);
        }

        // Step 4: Copy membership to new org
        for (const oldOrgId of oldOrgIds) {
            try {
                const members = await listDocuments(`orgMembers/${oldOrgId}/members`);
                for (const member of members) {
                    const memberId = member.name.split('/').pop();
                    const body = { fields: member.fields };
                    await firestoreRequest('PATCH', `orgMembers/${newOrgId}/members/${memberId}`, body);
                    console.log(`   📝 Copied membership: ${memberId} → ${newOrgId}`);
                }
            } catch (e) {
                console.warn(`   ⚠️ Could not read members from ${oldOrgId}`);
            }
        }

        // Step 5: Migrate data in collections
        let totalMigrated = 0;
        for (const collName of DATA_COLLECTIONS) {
            try {
                const docs = await listDocuments(collName);
                for (const doc of docs) {
                    const docOrgId = getFieldValue(doc, 'orgId');
                    if (oldOrgIds.includes(docOrgId)) {
                        await updateField(doc.name, 'orgId', newOrgId);
                        totalMigrated++;
                    }
                }
            } catch (e) {
                // Collection might not exist yet
            }
        }
        if (totalMigrated > 0) {
            console.log(`   ✅ Migrated ${totalMigrated} documents to ${newOrgId}`);
        }
    }

    console.log('\n✅ Migration complete!');
}

migrate().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e); process.exit(1); });
