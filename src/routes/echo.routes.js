/**
 * echo.routes.js — Diagnostic echo endpoint.
 *
 * Reflects any incoming request back as JSON, for ANY HTTP method — including
 * the new HTTP QUERY method. Public APIs rarely implement QUERY yet, so this
 * endpoint lets the *deployed* app demonstrate a full QUERY round-trip
 * (send → receive → 200 OK) without depending on any external server.
 *
 * Mounted at /api/echo. To demo QUERY on the live site:
 *   method: QUERY   URL: https://<your-app>/api/echo   → 200 with "method":"QUERY"
 */

const express = require('express');

const router = express.Router();

// router.all() handles every HTTP method (GET, POST, …, and QUERY) on this path
router.all('/echo', (req, res) => {
  res.json({
    message: 'Echo OK — your request reached the server',
    method: req.method, // shows "QUERY" when a QUERY request is sent
    path: req.originalUrl,
    headers: req.headers,
    body: req.body && Object.keys(req.body).length ? req.body : null,
  });
});

module.exports = router;
