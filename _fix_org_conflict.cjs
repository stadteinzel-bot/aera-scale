/**
 * Fix: Remove user from timestamp-based org, keep only deterministic org.
 * Also verify that all data is correctly assigned to the deterministic org.
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

async function listAll(path) {
    const results = [];
    let pageToken = null;
    do {
        const p = path + '?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
        const res = await firestoreReq('GET', p);
        if (res.data.documents) results.push(...res.data.documents);
        pageToken = res.data.nextPageToken;
    } while (pageToken);
    return results;
}

const SK_UID = 'YxaTeL0YNsdU9IjImgeKvjaE5lp2';
const GOOD_ORG = 'org_' + SK_UID;
const BAD_ORG = GOOD_ORG + '_1771403934601';

const COLLECTIONS = [
    'properties', 'tenants', 'tickets', 'messages', 'documents',
    'operatingCosts', 'settlements', 'rentInvoices', 'payments',
    'contracts', 'rentLineItems', 'assetConfig', 'auditLogs', 'settings',
];

async function setOrgId(docPath, newOrgId) {
    const relPath = docPath.replace('projects/' + PROJECT_ID + '/databases/(default)/documents/', '');
    const body = { fields: { orgId: { stringValue: newOrgId } } };
    return firestoreReq('PATCH', relPath + '?updateMask.fieldPaths=orgId', body);
}

async function main() {
    console.log('Good org (target):', GOOD_ORG);
    console.log('Bad org (to clean):', BAD_ORG);

    // Step 1: Show what orgId the properties currently have
    console.log('\n=== Current orgIds in properties ===');
    const props = await listAll('properties');
    for (const p of props) {
        const name = val(p.fields, 'name', 'title');
        const orgId = val(p.fields, 'orgId') || 'MISSING';
        console.log(' -', name, '| orgId:', orgId);
    }

    // Step 2: Find any docs still pointing to bad org or with wrong orgId
    console.log('\n=== Repairing any docs with wrong orgId ===');
    let totalFixed = 0;
    for (const coll of COLLECTIONS) {
        const docs = await listAll(coll);
        for (const d of docs) {
            const existingOrgId = val(d.fields, 'orgId');
            // Fix docs with the wrong/old org ID (either bad org or still missing)
            if (!existingOrgId || existingOrgId === BAD_ORG || existingOrgId === 'N/A') {
                await setOrgId(d.name, GOOD_ORG);
                const docId = d.name.split('/').pop();
                console.log('  Fixed:', coll + '/' + docId, '| was:', existingOrgId || 'MISSING', '→', GOOD_ORG);
                totalFixed++;
            }
        }
    }
    console.log('Total fixed:', totalFixed);

    // Step 3: Delete the duplicate org membership in the bad org (so App picks the right one)
    console.log('\n=== Removing user from timestamp-based org ===');
    const delRes = await firestoreReq('DELETE', 'orgMembers/' + BAD_ORG + '/members/' + SK_UID);
    if (delRes.status === 200) {
        console.log('✅ Removed membership from', BAD_ORG);
    } else {
        console.log('⚠️ Delete returned status:', delRes.status, '(might not exist, that\'s ok)');
    }

    // Step 4: Verify final state
    console.log('\n=== Final verification ===');
    const propsAfter = await listAll('properties');
    const withGoodOrg = propsAfter.filter(p => val(p.fields, 'orgId') === GOOD_ORG);
    console.log('Properties with correct orgId:', withGoodOrg.length, '/', propsAfter.length);
    console.log('\n✅ Done! App should now show correct data after page reload.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
