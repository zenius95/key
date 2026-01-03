const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ActivityLog = sequelize.define('ActivityLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false
        },
        transactionId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        balanceChange: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
            defaultValue: 0
        },
        newBalance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        ipAddress: {
            type: DataTypes.STRING,
            allowNull: true
        },
        userAgent: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'activity_logs',
        timestamps: true
    });

    return ActivityLog;
};
