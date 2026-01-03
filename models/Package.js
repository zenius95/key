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
        max_uids: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: 'Maximum number of UIDs (sessions)'
        },
        original_price: {
            type: DataTypes.DECIMAL(15, 0),
            allowNull: false,
            comment: 'Price per month'
        },
        currency: {
            type: DataTypes.STRING,
            defaultValue: 'VND'
        }
    });

    return Package;
};
