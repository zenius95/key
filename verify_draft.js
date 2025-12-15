const axios = require('axios');

async function testVerification() {
    const baseURL = 'http://localhost:3000/api';
    const TEST_KEY = 'TEST-KEY-' + Date.now();
    const TEST_HWID_1 = 'HWID-1111';
    const TEST_HWID_2 = 'HWID-2222';

    console.log('--- STARTING VERIFICATION ---');

    // 0. Manual License Creation (to simulate admin action)
    // In a real scenario we'd use the admin route, but for this test we rely on existing logic or need to create it.
    // However, existing GET /license/:key auto-creates licenses. Let's use that for setup.
    // Note: GET /license/:key creates it as 'inactive' by default if new.
    // We will update it manually via DB or cheat by assuming we can update it via the admin route if we had auth.
    // SIMPLIFICATION: We will use the existing POST /create route which requires auth.
    // Since basic auth is enabled, we need to handle that or use the 'trial' status from GET /license/key if we modify the model default.
    // Actually, looking at the code, GET /license/:key creates a license if not found.
    // Let's create it via GET, then manually hack key to be 'active' via DB access if possible? 
    // OR: Use the admin `create` API.

    // Let's use the code's `GET /license/:key` behavior. New licenses are 'inactive'.
    // We need an active license to test verify properly?
    // The verify route checks `license.status === 'inactive'`.
    // So we need to make it active.
    // The existing code has auto-update status logic in GET /license/:key if expiry_date is set.
    // Let's try to use the admin /create route or just assume we have a key. 

    // For this test script to be simple and self-contained without mocking DB, we might hit a wall if we can't create ACTIVE licenses easily without admin credentials.
    // Let's assume default credentials admin:password

    const adminAuth = { username: 'admin', password: 'password' };

    try {
        console.log(`1. Creating Test License: ${TEST_KEY}`);
        // Create Active License via Admin Route
        // Route: POST /create, Body: { client_name, expiry_date }, Auth: Basic
        await axios.post('http://localhost:3000/create', new URLSearchParams({
            client_name: 'Test Client',
            expiry_date: '2099-12-31'
        }), {
            auth: adminAuth
        });

        // The above creates a random key. We can't specify the key easily in POST /create (it generates detailed UID).
        // Let's just grab the latest license or search for it? 
        // Or simpler: Use the `GET /license/:key` to create it (status=inactive), then use `POST /update` to activate it.

        await axios.get(`http://localhost:3000/license/${TEST_KEY}`); // Creates inactive

        // Find ID? Impossible via API easily without parsing HTML.
        // Let's try raw SQL update or sequelize since we are running locally?
        // No, we are "outside" the process.

        // RE-PLAN: Modify the POST /create in `server.js` temporarily? No.
        // USE ADMIN UI? No browser.

        // Let's use the `POST /create` which redirects to `/`.
        // We can parse the response to find the key? The dashboard lists them.
        // This is getting complicated for a simple verify script.

        // ALTERNATIVE: Use a known key that we insert directly via a helper script running INSIDE the server context?
        // OR: Just hardcode the test to run inside the same process as a utility?

        // Let's write a small script that USES the models directly to seed data.
        // Much easier.
    } catch (e) {
        console.error("Setup failed (ignored for now, moved to internal seeding):", e.message);
    }
}

// Ensure this runs in a context where it can require models
testVerification();
