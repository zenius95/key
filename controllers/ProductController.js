const db = require('../models');
const logActivity = require('../utils/logActivity');

const listProducts = async (req, res) => {
    try {
        const products = await db.Product.findAll({
            include: [{ model: db.Package, as: 'packages' }],
            order: [['createdAt', 'DESC']]
        });
        res.render('admin/products', { products, user: req.session, activeTab: 'products', layout: 'layout' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
};

const saveProduct = async (req, res) => {
    const t = await db.sequelize.transaction();
    try {
        const { id, name, description, status, discount_config, packages } = req.body;

        let product;
        let action = '';
        if (id) {
            // Update existing Product
            product = await db.Product.findByPk(id, { transaction: t });
            if (!product) throw new Error('Product not found');
            await product.update({ name, description, status, discount_config }, { transaction: t });
            action = 'UPDATE_PRODUCT';
        } else {
            // Create new Product
            product = await db.Product.create({ name, description, status, discount_config }, { transaction: t });
            action = 'CREATE_PRODUCT';
        }

        // Handle Packages
        // 1. Get existing package IDs for this product
        const existingPackages = await db.Package.findAll({
            where: { product_id: product.id },
            attributes: ['id'],
            transaction: t
        });
        const existingIds = existingPackages.map(p => p.id);

        const incomingPackages = packages || [];
        const incomingIds = incomingPackages.filter(p => p.id).map(p => parseInt(p.id));

        // 2. Determine Create, Update, Delete
        const packagesToDelete = existingIds.filter(eid => !incomingIds.includes(eid));

        // Delete removed packages
        if (packagesToDelete.length > 0) {
            await db.Package.destroy({
                where: { id: packagesToDelete },
                transaction: t
            });
        }

        // Upsert incoming packages
        for (const pkg of incomingPackages) {
            const original_price = parseFloat(pkg.original_price || pkg.price);
            const max_uids = parseInt(pkg.max_uids) || 1;

            if (pkg.id) {
                // Update
                await db.Package.update({
                    name: pkg.name,
                    max_uids: max_uids,
                    original_price: original_price
                }, {
                    where: { id: pkg.id },
                    transaction: t
                });
            } else {
                // Create
                // Ensure product_id is set for new packages
                await db.Package.create({
                    name: pkg.name,
                    max_uids: max_uids,
                    original_price: original_price,
                    product_id: product.id
                }, { transaction: t });
            }
        }

        await t.commit();

        await logActivity(req.session.userId, action, 0, null, req, product.id.toString());

        res.json({ success: true, message: 'Product saved successfully' });

    } catch (error) {
        await t.rollback();
        console.error(error);
        res.status(500).json({ success: false, message: 'Error saving product' });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await db.Product.findByPk(id);
        const name = product ? product.name : 'Unknown';

        // Delete associated packages first
        await db.Package.destroy({ where: { product_id: id } });

        await db.Product.destroy({ where: { id } });

        await logActivity(req.session.userId, 'DELETE_PRODUCT', 0, null, req, id.toString());

        res.redirect('/admin/products');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting product');
    }
};

module.exports = { listProducts, saveProduct, deleteProduct };
