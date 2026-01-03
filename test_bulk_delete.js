const axios = require('axios');
const { License } = require('./models/License');

async function testBulkDelete() {
    console.log('--- STARTING BULK DELETE TEST ---');

    // 1. Seed some licenses
    const ids = [];
    for (let i = 0; i < 5; i++) {
        const lic = await License.create({
            key: `BULK-TEST-${i}-${Date.now()}`,
            client_name: `Bulk User ${i}`,
            status: 'inactive'
        });
        ids.push(lic.id);
    }
    console.log(`1. Seeded ${ids.length} licenses:`, ids);

    // 2. Call API
    try {
        const res = await axios.post('http://localhost:3000/delete-bulk', { ids }, {
            auth: { username: 'admin', password: 'password' }
        });

        if (res.data.success) {
            console.log('2. [PASS] API returned success.');
        } else {
            console.error('2. [FAIL] API returned:', res.data);
        }

        // 3. Verify in DB
        const count = await License.count({ where: { id: ids } });
        if (count === 0) {
            console.log('3. [PASS] Licenses removed from DB.');
        } else {
            console.error(`3. [FAIL] Found ${count} licenses remaining in DB.`);
        }

    } catch (e) {
        console.error('Test Error:', e.response ? e.response.data : e.message);
    }
}

testBulkDelete();
