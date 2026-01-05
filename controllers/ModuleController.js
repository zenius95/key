const db = require('../models');

const { Op } = require('sequelize');

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

        await db.Module.create({
            name,
            description,
            icon,
            color,
            script,
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

        await db.Module.update({
            name,
            description,
            icon,
            color,
            script,
            category_id: finalCategoryId
        }, { where: { id } });

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

module.exports = {
    getModules,
    createModule,
    updateModule,
    deleteModule,
    deleteBulkModules,
    getCategories,
    createCategory,
    updateCategory,
    deleteBulkCategories,
    getAllModulesAPI
};
