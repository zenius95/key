const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'license_manager',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: process.env.DB_DIALECT || 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import Models
// Import Models
// db.License = require('./License')(sequelize, DataTypes);
db.User = require('./User')(sequelize, DataTypes);
db.Product = require('./Product')(sequelize, DataTypes); // Add Product
db.Package = require('./Package')(sequelize, DataTypes);
db.Order = require('./Order')(sequelize, DataTypes);
db.ActivityLog = require('./ActivityLog')(sequelize, DataTypes);
db.Setting = require('./Setting')(sequelize, DataTypes);

// Associations
db.User.hasMany(db.Order, { foreignKey: 'user_id', as: 'orders' });
db.Order.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

db.Product.hasMany(db.Package, { foreignKey: 'product_id', as: 'packages' });
db.Package.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });

db.User.hasMany(db.ActivityLog, { foreignKey: 'userId', as: 'activities' });
db.ActivityLog.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });

module.exports = db;
