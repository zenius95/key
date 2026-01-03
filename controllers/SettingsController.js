const db = require('../models');

const getSettings = async (req, res) => {
    try {
        if (req.session.role !== 'admin') return res.status(403).send('Access Denied');

        const settingsRows = await db.Setting.findAll();
        const settings = {};
        settingsRows.forEach(s => settings[s.key] = s.value);

        res.render('admin/settings', {
            user: req.session,
            activeTab: 'settings',
            subTab: 'deposit',
            settings,
            message: req.query.message,
            layout: 'layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading settings');
    }
};

const saveSettings = async (req, res) => {
    try {
        if (req.session.role !== 'admin') return res.status(403).send('Access Denied');

        const { bank_code, bank_account_number, bank_account_name, transaction_endpoint, transaction_prefix } = req.body;

        await Promise.all([
            db.Setting.upsert({ key: 'bank_code', value: bank_code }),
            db.Setting.upsert({ key: 'bank_account_number', value: bank_account_number }),
            db.Setting.upsert({ key: 'bank_account_name', value: bank_account_name }),
            db.Setting.upsert({ key: 'transaction_endpoint', value: transaction_endpoint }),
            db.Setting.upsert({ key: 'transaction_prefix', value: transaction_prefix })
        ]);

        res.redirect('/admin/settings/deposit?message=Đã lưu cấu hình thành công!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error saving settings');
    }
};

const redirectSettings = (req, res) => {
    res.redirect('/admin/settings/deposit');
};

module.exports = { getSettings, saveSettings, redirectSettings };
