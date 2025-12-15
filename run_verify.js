const { sequelize, License } = require('./models/License');
const { signData } = require('./utils/crypto');
const axios = require('axios');

async function runTest() {
    await sequelize.sync();

    const TEST_KEY = 'TEST-KEY-' + Date.now();
    const HWID_1 = 'HWID-OLD';
    const HWID_2 = 'HWID-NEW';

    console.log(`\n--- TEST START: ${TEST_KEY} ---`);

    try {
        // 1. Create License directly in DB
        const license = await License.create({
            key: TEST_KEY,
            client_name: 'Tester',
            status: 'active',
            expiry_date: '2030-01-01',
            reset_count: 0
        });
        console.log('1. Created License in DB.');

        // 2. First Verify (Bind HWID)
        try {
            const res1 = await axios.post('http://localhost:3000/api/verify', {
                key: TEST_KEY,
                hwid: HWID_1
            });
            if (res1.data.success && res1.data.data.hwid === HWID_1) {
                console.log('2. [PASS] First Bind Successful.');
            } else {
                console.error('2. [FAIL] First Bind:', res1.data);
            }
        } catch (e) { console.error('2. [ERR]', e.message); }

        // 3. Verify Again (Same HWID)
        try {
            const res2 = await axios.post('http://localhost:3000/api/verify', {
                key: TEST_KEY,
                hwid: HWID_1
            });
            if (res2.data.success) {
                console.log('3. [PASS] Same HWID Allowed.');
            } else {
                console.error('3. [FAIL] Same HWID:', res2.data);
            }
        } catch (e) { console.error('3. [ERR]', e.message); }

        // 4. Verify Different HWID (Mismatch)
        try {
            const res3 = await axios.post('http://localhost:3000/api/verify', {
                key: TEST_KEY,
                hwid: HWID_2
            });
            if (!res3.data.success && res3.data.message === 'Hardware Mismatch') {
                console.log('4. [PASS] Mismatch Blocked.');
            } else {
                console.error('4. [FAIL] Mismatch:', res3.data);
            }
        } catch (e) { console.error('4. [ERR]', e.message); }

        // 5. Reset HWID
        try {
            const res4 = await axios.post('http://localhost:3000/api/reset-hwid', {
                key: TEST_KEY
            });
            if (res4.data.success) {
                console.log('5. [PASS] Reset Successful.');
            } else {
                console.error('5. [FAIL] Reset:', res4.data);
            }
        } catch (e) { console.error('5. [ERR]', e.message); }

        // 6. Verify with New HWID (Bind New)
        try {
            const res5 = await axios.post('http://localhost:3000/api/verify', {
                key: TEST_KEY,
                hwid: HWID_2
            });
            if (res5.data.success && res5.data.data.hwid === HWID_2) {
                console.log('6. [PASS] Re-bind Successful.');
            } else {
                console.error('6. [FAIL] Re-bind:', res5.data);
            }
        } catch (e) { console.error('6. [ERR]', e.message); }

        // 7. Test Reset Limit (Loop 5 times)
        console.log('7. Testing Limits...');
        for (let i = 0; i < 6; i++) {
            // Force cooldown bypass by hacking DB because we can't wait 30 days
            await License.update({ last_reset_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31) }, { where: { key: TEST_KEY } });

            const res = await axios.post('http://localhost:3000/api/reset-hwid', { key: TEST_KEY });
            if (i < 4) { // We already did 1 reset at step 5. limit is 5. So 1+4 = 5. The 5th loop (6th reset) should fail.
                if (res.data.success) console.log(`   Reset ${i + 2} OK.`);
            } else {
                if (!res.data.success) console.log(`   Reset ${i + 2} Blocked as expected: ${res.data.message}`);
                else console.error(`   Reset ${i + 2} SHOULD FAIL but passed.`);
            }
        }

    } catch (error) {
        console.error('Test Error:', error);
    }
}

runTest();
