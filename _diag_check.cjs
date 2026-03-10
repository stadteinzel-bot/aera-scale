const { execSync } = require('child_process');
const https = require('https');

const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const PROJECT_ID = 'aera-scale';

function firestoreReq(path) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'firestore.googleapis.com',
            path: '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' + path,
            headers: { 'Authorization': 'Bearer ' + token }
        };
        const r = https.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
        });
        r.on('error', reject);
        r.end();
    });
}

function val(field) {
    if (!field) return 'N/A';
    return field.stringValue || field.integerValue || field.booleanValue || 'N/A';
}

async function main() {
    const collections = ['properties', 'tenants', 'organizations'];
    for (const coll of collections) {
        const res = await firestoreReq(coll + '?pageSize=20');
        const docs = res.documents || [];
        console.log('\n=== ' + coll + ' (' + docs.length + ' docs) ===');
        docs.slice(0, 5).forEach(d => {
            const id = d.name.split('/').pop();
            const orgId = val(d.fields && d.fields.orgId);
            const name = val(d.fields && (d.fields.name || d.fields.title || d.fields.firstName));
            console.log('  id:', id, '| orgId:', orgId, '| name/title:', name);
        });
    }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
