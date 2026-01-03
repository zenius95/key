const db = require('../models');
const { hashPassword } = require('../utils/auth');
const logActivity = require('../utils/logActivity');

const dashboard = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.session.userId);

        // Use a client-specific layout
        res.render('client/dashboard', {
            layout: 'layout_client',
            user: user,
            activeTab: 'dashboard'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading dashboard');
    }
};

const profile = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.session.userId);

        res.render('client/profile', {
            layout: 'layout_client',
            user: user,
            activeTab: 'profile',
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading profile');
    }
};

const updateProfile = async (req, res) => {
    try {
        const { full_name, phone, password, confirm_password } = req.body;
        const user = await db.User.findByPk(req.session.userId);

        const updates = {
            full_name,
            phone
        };

        // Validate Password Change
        if (password && password.trim() !== '') {
            if (password !== confirm_password) {
                return res.redirect('/client/profile?error=Mật khẩu xác nhận không khớp');
            }
            updates.password = await hashPassword(password);

            await logActivity(user.id, 'USER_UPDATE', 0, null, req, 'Tự thay đổi mật khẩu');
        }

        await user.update(updates);

        // Update session info if needed
        req.session.full_name = full_name;

        await logActivity(user.id, 'USER_UPDATE', 0, null, req, 'Cập nhật thông tin cá nhân');

        res.redirect('/client/profile?success=Cập nhật thông tin thành công');
    } catch (error) {
        console.error(error);
        res.redirect('/client/profile?error=Lỗi hệ thống');
    }
};

module.exports = {
    dashboard,
    profile,
    updateProfile
};
