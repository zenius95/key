const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Setting = sequelize.define('Setting', {
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'settings',
        timestamps: true
    });

    return Setting;
};
