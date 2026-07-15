/**
 * server.js — Application bootstrap.
 *
 * Wires the pieces together and starts listening. All real logic lives in
 * the modules under src/:
 *
 *   config.js                     limits, port, body size
 *   routes/proxy.routes.js        POST /api/proxy
 *   controllers/proxy.controller  validate + shape the HTTP response
 *   services/http-proxy.service   performs the real outbound HTTP(S) call
 *   utils/validation.js           input checks + header hygiene
 *   utils/response-decoder.js     buffering, gzip/br decode, size cap
 *   utils/network-errors.js       friendly error text + timing
 *
 * The server also serves the static frontend from ../public.
 *
 * NOTE: No database is used anywhere (hackathon restriction). All user data
 * (collections, environments, history) lives in the browser's localStorage.
 */

const express = require('express');
const path = require('path');

const { PORT, JSON_BODY_LIMIT } = require('./config');
const proxyRoutes = require('./routes/proxy.routes');
const echoRoutes = require('./routes/echo.routes');

const app = express();

// Parse JSON payloads from the frontend (request definitions can be large)
app.use(express.json({ limit: JSON_BODY_LIMIT }));

// Serve the frontend (public/ lives one level above src/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api', proxyRoutes);
app.use('/api', echoRoutes); // GET/POST/…/QUERY → /api/echo (reflects the request)

app.listen(PORT, () => {
  console.log(`⚡ Postman Lite running at http://localhost:${PORT}`);
});
