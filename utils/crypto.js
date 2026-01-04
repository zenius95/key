const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY_PATH = path.join(__dirname, '../private_key.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '../public_key.pem');

// Initial Keys Generation
function getOrCreateKeys() {
    if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
        return {
            privateKey: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
            publicKey: fs.readFileSync(PUBLIC_KEY_PATH, 'utf8')
        };
    }

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

    console.log('New RSA Key Pair Generated.');

    return { privateKey, publicKey };
}

const { privateKey } = getOrCreateKeys();

function signData(data) {
    // Sort keys to ensure consistency
    const sortedKeys = Object.keys(data).sort();
    const sortedData = {};
    sortedKeys.forEach(key => {
        sortedData[key] = data[key];
    });

    const dataString = JSON.stringify(sortedData);

    const sign = crypto.createSign('SHA256');
    sign.update(dataString);
    sign.end();

    return sign.sign(privateKey, 'base64');
}

// AES Helpers for DB Key Storage
const ALGORITHM = 'aes-256-cbc';
const MASTER_SECRET = process.env.MASTER_SECRET || 'default_master_secret_PLEASE_CHANGE_IN_ENV'; // Fallback for dev

function generateUserDbKey() {
    return crypto.randomBytes(32).toString('hex');
}

function encryptKeyForStorage(plainKey) {
    if (!plainKey) return null;
    const iv = crypto.randomBytes(16);
    // Use the MD5 of MASTER_SECRET to ensure 32 bytes key for AES-256 (simple approach) or use scrypt/pbkdf2
    // For simplicity here, we assume MASTER_SECRET is strong or we hash it.
    // Let's hash MASTER_SECRET to get 32 bytes.
    const key = crypto.createHash('sha256').update(MASTER_SECRET).digest();

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV:EncryptedData
    return iv.toString('hex') + ':' + encrypted;
}

function decryptKeyFromStorage(encryptedData) {
    if (!encryptedData) return null;
    const parts = encryptedData.split(':');
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = crypto.createHash('sha256').update(MASTER_SECRET).digest();

    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('Decryption failed:', err);
        return null;
    }
}

// Encrypt data using Private Key (So only Public Key holder can decrypt)
// Note: This is essentially 'signing' with encryption intent (Confidentiality relative to Public Key)
function encryptWithPrivateKey(data) {
    try {
        const buffer = Buffer.from(data, 'utf8');
        const encrypted = crypto.privateEncrypt({
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING
        }, buffer);
        return encrypted.toString('base64');
    } catch (err) {
        console.error('RSA Private Encrypt Error:', err);
        return null;
    }
}

module.exports = { signData, generateUserDbKey, encryptKeyForStorage, decryptKeyFromStorage, encryptWithPrivateKey };
