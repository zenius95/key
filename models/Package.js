const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Package = sequelize.define('Package', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Duration in days'
        },
        original_price: {
            type: DataTypes.DECIMAL(15, 0), // Use Decimal for currency
            allowNull: false
        },
        discount_percent: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 100
            }
        },
        final_price: {
            type: DataTypes.DECIMAL(15, 0),
            allowNull: false
        },
        currency: {
            type: DataTypes.STRING,
            defaultValue: 'VND'
        }
    }, {
        hooks: {
            beforeSave: (package) => {
                if (package.original_price && package.discount_percent !== undefined) {
                    const discount = (package.original_price * package.discount_percent) / 100;
                    package.final_price = package.original_price - discount;
                } else if (package.original_price) {
                    // If only original price is set/changed and discount is potentially not passed but exists? 
                    // Hooks run on instances, so we can access current values.
                    const discount = (package.original_price * (package.discount_percent || 0)) / 100;
                    package.final_price = package.original_price - discount;
                }
            }
        }
    });

    return Package;
};
