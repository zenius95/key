const express = require('express');
const session = require('express-session');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();
const db = require('./models');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup View Engine
app.use(expressLayouts);
app.set('layout', './layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Config
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Global Helpers (Optional: Make user available to all views)
app.use((req, res, next) => {
    res.locals.user = req.session;
    next();
});

// Routes
app.use('/', routes);

// Sync Database
db.sequelize.sync().then(() => {
    console.log('Database synced successfully');

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to sync database:', err);
});
