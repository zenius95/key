// scripts/rotate_master_key.js
require('dotenv').config();
const db = require('../models');
const crypto = require('crypto');

// 1. CẤU HÌNH (Sếp điền 2 cái này vào đây khi chạy script)
const OLD_MASTER = process.env.MASTER_SECRET; // Key hiện tại đang chạy
const NEW_MASTER = 'Chuoi_Bi_Mat_Moi_Cuc_Manh_Dai_32_Ky_Tu_!!!'; // Key mới định đổi

if (!OLD_MASTER || !NEW_MASTER) {
    console.error("Thiếu Master Key cũ hoặc mới!");
    process.exit(1);
}

// Hàm giải mã bằng Key Cũ
function decryptOld(encryptedKey) {
    if (!encryptedKey) return null;
    try {
        const textParts = encryptedKey.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const key = crypto.scryptSync(OLD_MASTER, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error("Lỗi giải mã (Có thể data rác hoặc sai key cũ):", e.message);
        return null;
    }
}

// Hàm mã hóa bằng Key Mới
function encryptNew(plainKey) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(NEW_MASTER, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

async function rotateKeys() {
    try {
        await db.sequelize.authenticate();
        console.log('Connected to DB. Starting rotation...');
        console.log(`OLD MASTER: ${OLD_MASTER.substring(0, 5)}...`);
        console.log(`NEW MASTER: ${NEW_MASTER.substring(0, 5)}...`);

        const users = await db.User.findAll({
            where: {
                db_secret_key: { [db.Sequelize.Op.ne]: null }
            }
        });

        console.log(`Found ${users.length} users with encrypted keys.`);

        let successCount = 0;
        let failCount = 0;

        for (const user of users) {
            // 1. Lấy ra key gốc bằng Master cũ
            const rawKey = decryptOld(user.db_secret_key);

            if (rawKey) {
                // 2. Mã hóa lại bằng Master mới
                const newEncryptedKey = encryptNew(rawKey);

                // 3. Lưu lại
                await user.update({ db_secret_key: newEncryptedKey });
                successCount++;
                // console.log(`> Rotated key for User ${user.id}`);
            } else {
                console.error(`> FAILED to decrypt User ${user.id}. Data corruption?`);
                failCount++;
            }
        }

        console.log('-----------------------------------');
        console.log(`Migration Completed.`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);
        console.log('-----------------------------------');
        console.log('QUAN TRỌNG: Bây giờ hãy cập nhật file .env của sếp thành:');
        console.log(`MASTER_SECRET=${NEW_MASTER}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

rotateKeys();