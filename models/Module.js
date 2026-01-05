module.exports = (sequelize, DataTypes) => {
    const Module = sequelize.define('Module', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: true
        },
        color: {
            type: DataTypes.STRING,
            allowNull: true
        },
        script: {
            type: DataTypes.TEXT('long'), // Use LONGTEXT for scripts to avoid size limits
            allowNull: true
        },
        category_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    });

    Module.associate = (models) => {
        Module.belongsTo(models.Category, {
            foreignKey: 'category_id',
            as: 'category'
        });
    };

    return Module;
};
