module.exports = (sequelize, DataTypes) => {
    const Category = sequelize.define('Category', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: true
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: true
        }
    });

    Category.associate = (models) => {
        Category.hasMany(models.Module, {
            foreignKey: 'category_id',
            as: 'modules'
        });
    };

    return Category;
};
