module.exports = (sequelize, DataTypes) => {
    const Product = sequelize.define('Product', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
        },
        discount_config: {
            type: DataTypes.JSON,
            defaultValue: { month3: 5, month6: 8, year1: 15 }
        }
    });

    return Product;
};
