const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const express = require('express');
const path = require('path');

/**
 * Setup security middleware for the API server
 * @param {express.Application} app - Express application instance
 */
function setupSecurity(app) {
    // Simplified security for localhost-only use
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(cors({
        origin: ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));
}

/**
 * Setup general middleware for the API server
 * @param {express.Application} app - Express application instance
 */
function setupMiddleware(app) {
    app.use(compression());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
}

module.exports = {
    setupSecurity,
    setupMiddleware
};
