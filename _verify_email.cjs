// Verify test user email via Firebase Auth REST API using gcloud access token
const https = require('https');
const { execSync } = require('child_process');

// Get access token from gcloud
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
console.log('Token obtained (length:', token.length, ')');

const data = JSON.stringify({
    localId: 'ff3JdqKPJugQDPvIc4KIIeU6aiE2',
    emailVerified: true,
});

const options = {
    hostname: 'identitytoolkit.googleapis.com',
    path: '/v1/projects/aera-scale/accounts:update',
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'x-goog-user-project': 'aera-scale',
    },
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
        process.exit(res.statusCode === 200 ? 0 : 1);
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
    process.exit(1);
});

req.write(data);
req.end();
