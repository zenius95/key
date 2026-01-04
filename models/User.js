module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        full_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        role: {
            type: DataTypes.ENUM('admin', 'user'),
            defaultValue: 'admin'
        },
        license_key: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        balance: {
            type: DataTypes.DECIMAL(15, 0),
            allowNull: false,
            defaultValue: 0
        },
        last_login: {
            type: DataTypes.DATE,
            allowNull: true
        },
        db_secret_key: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    });

    return User;
};
