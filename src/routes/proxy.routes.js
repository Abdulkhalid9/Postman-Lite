/**
 * proxy.routes.js — Routing for the proxy API.
 *
 * Mounted under /api by the server, so this exposes POST /api/proxy.
 */

const express = require('express');
const { handleProxy } = require('../controllers/proxy.controller');

const router = express.Router();

router.post('/proxy', handleProxy);

module.exports = router;
