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

module.exports = { signData };
