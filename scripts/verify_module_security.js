const db = require('../models');
const ModuleController = require('../controllers/ModuleController');
const crypto = require('crypto');
require('dotenv').config();

// Mock Req/Res
const mockReq = (params) => ({ params });
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const runVerification = async () => {
    try {
        console.log("1. Creating Test Module...");
        // Ensure category exists
        let category = await db.Category.findOne();
        if (!category) {
            category = await db.Category.create({ name: 'TestCat', slug: 'test-cat' });
        }

        const script = 'console.log("Hello Security World");';
        const mod = await db.Module.create({
            name: 'Test Security Module ' + Date.now(),
            script: script,
            category_id: category.id
        });

        // 2. Refresh from DB to check protectedContent (although create usually returns it)
        // But Module create logic in Controller was doing the obfuscation. 
        // Handles: The Controller `createModule` does the obfuscation before calling `Module.create`.
        // So valid test is testing the CONTROLLER `createModule`? 
        // OR checking if I manually trigger obfuscation?
        // Wait, the logic is in `ModuleController.createModule`.

        // I should verify `ModuleController.createModule`.
        // But that requires req.body and mocking redirects etc.
        // It's easier to verify the obfuscation library integration directly or verify via the controller with mocks.

        // Let's test calling `ModuleController.createModule` mock.
        console.log("2. Testing ModuleController.createModule (Obfuscation)...");
        const reqCreate = {
            body: {
                name: 'Controller Test Module ' + Date.now(),
                script: 'var x = 10; console.log(x);',
                category_id: category.id
            }
        };
        const resCreate = {
            redirect: (path) => console.log("Redirected to", path),
            status: (c) => ({ send: (m) => console.log("Status", c, m) })
        };

        await ModuleController.createModule(reqCreate, resCreate);

        // Find the module
        const createdMod = await db.Module.findOne({ where: { name: reqCreate.body.name } });
        if (createdMod && createdMod.protectedContent) {
            console.log("PASS: protectedContent created.");
            console.log("Preview:", createdMod.protectedContent.substring(0, 50) + "...");
        } else {
            console.error("FAIL: protectedContent missing.");
        }

        // 3. Test getClientScript (Encryption)
        console.log("3. Testing getClientScript (Encryption)...");
        // Ensure CLIENT_SECRET_KEY
        if (!process.env.CLIENT_SECRET_KEY) {
            console.log("NOTICE: CLIENT_SECRET_KEY not found in env, strictly. Setting temp key.");
            process.env.CLIENT_SECRET_KEY = "12345678901234567890123456789012";
        }

        const reqGet = mockReq({ id: createdMod.id });
        const resGet = mockRes();

        await ModuleController.getClientScript(reqGet, resGet);

        if (resGet.data && resGet.data.success) {
            console.log("PASS: API returned success.");
            const { iv, content } = resGet.data;
            console.log("IV:", iv);
            console.log("Encrypted Content:", content);

            // Decrypt
            const key = process.env.CLIENT_SECRET_KEY;
            const keyBuffer = crypto.createHash('sha256').update(String(key)).digest();
            const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, Buffer.from(iv, 'hex'));
            let decrypted = decipher.update(content, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            console.log("Decrypted Content Preview:", decrypted.substring(0, 50) + "...");

            if (decrypted === createdMod.protectedContent) {
                console.log("PASS: Decryption matches protectedContent.");
            } else {
                console.error("FAIL: Decryption mismatch.");
                console.log("Expected:", createdMod.protectedContent);
                console.log("Got:", decrypted);
            }

        } else {
            console.error("FAIL: API failed", resGet.data || resGet);
        }

    } catch (e) {
        console.error("Verification Error:", e);
    } finally {
        process.exit();
    }
};

runVerification();
