/**
 * Deep diagnostic: Check orgMembers and what OrgContext would resolve.
 * Also checks which orgId is actually used by the app for the given user.
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

// UID for sk@sk-businesspark.de
const SK_UID = 'YxaTeL0YNsdU9IjImgeKvjaE5lp2';
const TARGET_ORG_ID = 'org_' + SK_UID;

async function main() {
    console.log('=== Checking orgMembers for target org ===');
    console.log('Target org:', TARGET_ORG_ID);
    console.log('User UID:', SK_UID);

    // Check if org exists
    const orgRes = await firestoreReq('GET', 'organizations/' + TARGET_ORG_ID);
    if (orgRes.status === 200 && orgRes.data.fields) {
        console.log('\n✅ Organization exists:', val(orgRes.data.fields, 'name', 'title'));
    } else {
        console.log('\n❌ Organization NOT found! Status:', orgRes.status);
    }

    // List all orgMembers sub-collections under the target org
    const membersRes = await firestoreReq('GET', 'orgMembers/' + TARGET_ORG_ID + '/members?pageSize=50');
    const members = membersRes.data.documents || [];
    console.log('\n=== Members in org ===');
    if (members.length === 0) {
        console.log('❌ NO MEMBERS FOUND in orgMembers/' + TARGET_ORG_ID + '/members');
        console.log('   This means OrgContext cannot find the user and the app shows NO_ORG!');
    } else {
        members.forEach(m => {
            const id = m.name.split('/').pop();
            const uid = val(m.fields, 'uid');
            const email = val(m.fields, 'email');
            const role = val(m.fields, 'role');
            const status = val(m.fields, 'status');
            console.log(`  uid:${uid || id} | email:${email} | role:${role} | status:${status}`);
        });
    }

    // Check if specific user has membership
    const userMemberRes = await firestoreReq('GET', 'orgMembers/' + TARGET_ORG_ID + '/members/' + SK_UID);
    if (userMemberRes.status === 200 && userMemberRes.data.fields) {
        console.log('\n✅ User membership exists:');
        const f = userMemberRes.data.fields;
        console.log('  role:', val(f, 'role'));
        console.log('  status:', val(f, 'status'));
    } else {
        console.log('\n❌ User membership MISSING in orgMembers/' + TARGET_ORG_ID + '/members/' + SK_UID);
        console.log('   → Will CREATE it now...');

        // Create missing membership
        const body = {
            fields: {
                uid: { stringValue: SK_UID },
                email: { stringValue: 'sk@sk-businesspark.de' },
                displayName: { stringValue: 'SK' },
                role: { stringValue: 'org_admin' },
                status: { stringValue: 'active' },
                orgId: { stringValue: TARGET_ORG_ID },
                joinedAt: { stringValue: new Date().toISOString() },
            }
        };

        const createRes = await firestoreReq('PATCH',
            'orgMembers/' + TARGET_ORG_ID + '/members/' + SK_UID + '?updateMask.fieldPaths=uid&updateMask.fieldPaths=email&updateMask.fieldPaths=displayName&updateMask.fieldPaths=role&updateMask.fieldPaths=status&updateMask.fieldPaths=orgId&updateMask.fieldPaths=joinedAt',
            body
        );
        if (createRes.status === 200) {
            console.log('   ✅ Membership CREATED: role=org_admin, status=active');
        } else {
            console.log('   ❌ Failed to create membership:', JSON.stringify(createRes.data).slice(0, 200));
        }
    }

    // Also check all existing orgMembers orgs (to see where user had membership before)
    console.log('\n=== Searching all orgMembers for user ===');
    const allOrgMembers = await listAll('orgMembers');
    // Can't easily list subcollections via REST, so check known orgs
    const orgs = await listAll('organizations');
    for (const o of orgs) {
        const orgId = o.name.split('/').pop();
        const memberDoc = await firestoreReq('GET', 'orgMembers/' + orgId + '/members/' + SK_UID);
        if (memberDoc.status === 200 && memberDoc.data.fields) {
            const f = memberDoc.data.fields;
            console.log(`  Found in org: ${orgId} | role: ${val(f, 'role')} | status: ${val(f, 'status')}`);
        }
    }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
