const { DataTypes } = require('sequelize');
const { uid } = require('uid');

module.exports = (sequelize) => {
    const Order = sequelize.define('Order', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        package_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(15, 0),
            allowNull: false
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Duration in days'
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'expired'),
            defaultValue: 'pending'
        },
        transaction_id: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true
        },
        product_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        package_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        expiry_date: {
            type: DataTypes.DATE,
            allowNull: true
        },
        hwid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        product_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        payment_method: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        hooks: {
            beforeCreate: (order) => {
                if (!order.transaction_id) {
                    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    order.transaction_id = `ORD-${date}-${uid(4).toUpperCase()}`;
                }
            }
        }
    });

    return Order;
};
