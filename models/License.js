const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Setup DB Connection
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database/database.sqlite'),
    logging: false
});

const License = sequelize.define('License', {
    client_name: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'trial'),
        defaultValue: 'trial'
    },
    expiry_date: {
        type: DataTypes.DATEONLY, // Chỉ cần ngày
        allowNull: true
    }
});

module.exports = { sequelize, License };
