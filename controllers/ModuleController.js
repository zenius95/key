const db = require('../models');

const { Op } = require('sequelize');
const JavaScriptObfuscator = require('javascript-obfuscator');
const crypto = require('crypto');

const getModules = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const { search, category_id } = req.query;

        const whereClause = {};
        if (search) {
            whereClause.name = { [Op.like]: `%${search}%` };
        }
        if (category_id && category_id !== 'all') {
            whereClause.category_id = category_id;
        }

        const { count, rows } = await db.Module.findAndCountAll({
            where: whereClause,
            include: [{ model: db.Category, as: 'category' }],
            order: [['category_id', 'ASC'], ['createdAt', 'DESC']],
            limit,
            offset
        });

        const categories = await db.Category.findAll({ order: [['name', 'ASC']] });
        const totalPages = Math.ceil(count / limit);

        // API Response
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ success: true, modules: rows, categories, totalPages, currentPage: page });
        }

        res.render('admin/modules', {
            modules: rows,
            categories,
            currentPage: page,
            totalPages,
            search,
            categoryId: category_id,
            user: req.session,
            activeTab: 'modules',
            layout: 'layout',
            query: req.query
        });
    } catch (error) {
        console.error('Get Modules Error:', error);
        res.status(500).send('Lỗi máy chủ');
    }
};

const getCategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const { search } = req.query;

        const whereClause = {};
        if (search) {
            whereClause.name = { [Op.like]: `%${search}%` };
        }

        const { count, rows } = await db.Category.findAndCountAll({
            where: whereClause,
            include: [{ model: db.Module, as: 'modules', attributes: ['id'] }],
            order: [['name', 'ASC']],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        res.render('admin/categories', {
            categories: rows,
            currentPage: page,
            totalPages,
            search,
            user: req.session,
            activeTab: 'categories',
            layout: 'layout',
            query: req.query
        });
    } catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).send('Lỗi máy chủ');
    }
};

const createModule = async (req, res) => {
    try {
        const { name, description, icon, color, script, category_id, new_category_name } = req.body;
        let finalCategoryId = category_id;

        if (new_category_name) {
            const newCat = await db.Category.create({ name: new_category_name, slug: new_category_name.toLowerCase().replace(/ /g, '-') });
            finalCategoryId = newCat.id;
        }

        let protectedContent = null;
        if (script) {
            try {
                const obfuscationResult = JavaScriptObfuscator.obfuscate(script, {
                    compact: true,
                    controlFlowFlattening: true,
                    controlFlowFlatteningThreshold: 1,
                    numbersToExpressions: true,
                    simplify: true,
                    stringArrayShuffle: true,
                    splitStrings: true,
                    stringArrayThreshold: 1
                });
                protectedContent = obfuscationResult.getObfuscatedCode();
            } catch (err) {
                console.error("Obfuscation error:", err);
                // Fallback to raw script or handle error? For now, let's keep it null or raw?
                // Depending on requirement. "Hệ thống phải tự động tạo thêm một phiên bản Obfuscated".
                // If fails, maybe we should not fail the creation but log it.
            }
        }

        await db.Module.create({
            name,
            description,
            icon,
            color,
            script,
            protectedContent,
            category_id: finalCategoryId
        });

        res.redirect('/admin/modules');
    } catch (error) {
        console.error('Create Module Error:', error);
        res.status(500).send('Lỗi khi tạo Module');
    }
};

const updateModule = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon, color, script, category_id, new_category_name } = req.body;
        let finalCategoryId = category_id;

        if (new_category_name) {
            const newCat = await db.Category.create({ name: new_category_name, slug: new_category_name.toLowerCase().replace(/ /g, '-') });
            finalCategoryId = newCat.id;
        }

        let protectedContent = null;
        if (script) {
            try {
                const obfuscationResult = JavaScriptObfuscator.obfuscate(script, {
                    compact: true,
                    controlFlowFlattening: true,
                    controlFlowFlatteningThreshold: 1,
                    numbersToExpressions: true,
                    simplify: true,
                    stringArrayShuffle: true,
                    splitStrings: true,
                    stringArrayThreshold: 1
                });
                protectedContent = obfuscationResult.getObfuscatedCode();
            } catch (err) {
                console.error("Obfuscation error:", err);
            }
        }

        const updateData = {
            name,
            description,
            icon,
            color,
            script,
            category_id: finalCategoryId
        };

        if (protectedContent) {
            updateData.protectedContent = protectedContent;
        }

        await db.Module.update(updateData, { where: { id } });

        res.redirect('/admin/modules');
    } catch (error) {
        console.error('Update Module Error:', error);
        res.status(500).send('Lỗi khi cập nhật Module');
    }
};

const deleteModule = async (req, res) => {
    try {
        const { id } = req.params;
        await db.Module.destroy({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Module Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa Module' });
    }
};

const deleteBulkModules = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, message: 'Invalid IDs' });

        await db.Module.destroy({ where: { id: ids } });
        res.json({ success: true, count: ids.length });
    } catch (error) {
        console.error('Bulk Delete Modules Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa modules' });
    }
};

const createCategory = async (req, res) => {
    try {
        const { name, icon } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống' });

        const category = await db.Category.create({
            name,
            slug: name.toLowerCase().replace(/ /g, '-'),
            icon
        });

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ success: true, category });
        }
        res.redirect('/admin/categories');

    } catch (error) {
        console.error('Create Category Error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ success: false, message: 'Lỗi khi tạo danh mục' });
        }
        res.status(500).send('Lỗi khi tạo danh mục');
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, icon } = req.body;
        await db.Category.update({
            name,
            slug: name.toLowerCase().replace(/ /g, '-'),
            icon
        }, { where: { id } });
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Update Category Error:', error);
        res.status(500).send('Lỗi khi cập nhật danh mục');
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const modulesCount = await db.Module.count({ where: { category_id: id } });
        if (modulesCount > 0) {
            return res.status(400).json({ success: false, message: 'Danh mục này đang chứa modules. Vui lòng chuyển hoặc xóa modules trước.' });
        }
        await db.Category.destroy({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Category Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa danh mục' });
    }
};

const deleteBulkCategories = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, message: 'Invalid IDs' });

        await db.Category.destroy({ where: { id: ids } });
        res.json({ success: true, count: ids.length });
    } catch (error) {
        console.error('Bulk Delete Categories Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa danh mục' });
    }
};

const getAllModulesAPI = async (req, res) => {
    try {
        const categories = await db.Category.findAll({
            include: [{
                model: db.Module,
                as: 'modules',
                attributes: ['id', 'name', 'description', 'icon', 'color']
            }],
            order: [['name', 'ASC'], ['modules', 'name', 'ASC']]
        });

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Get All Modules API Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};

const getClientScript = async (req, res) => {
    try {
        const { id } = req.params;
        const moduleItem = await db.Module.findByPk(id);

        if (!moduleItem) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        const contentToEncrypt = moduleItem.protectedContent || moduleItem.script || '';

        // Dynamic Encryption
        const algorithm = 'aes-256-cbc';
        const key = process.env.CLIENT_SECRET_KEY; // Must be 32 chars
        if (!key) {
            console.error("Missing CLIENT_SECRET_KEY in env");
            return res.status(500).json({ success: false, message: 'Server configuration error' });
        }

        // Ensure key is 32 bytes via hashing
        const keyBuffer = crypto.createHash('sha256').update(String(key)).digest();

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
        let encrypted = cipher.update(contentToEncrypt, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        res.json({
            success: true,
            iv: iv.toString('hex'),
            content: encrypted
        });

    } catch (error) {
        console.error('Get Client Script Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    getModules,
    createModule,
    updateModule,
    deleteModule,
    deleteBulkModules,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    deleteBulkCategories,
    getAllModulesAPI,
    getClientScript
};
