/**
 * proxy.controller.js — Request handler for POST /api/proxy.
 *
 * Validates the incoming payload, delegates the actual HTTP call to the
 * proxy service, and shapes the HTTP response (or error) sent back to the
 * frontend. Deliberately thin: no networking logic lives here.
 */

const { validateProxyInput } = require('../utils/validation');
const { performProxyRequest } = require('../services/http-proxy.service');

async function handleProxy(req, res) {
  const { url, method, headers = {}, body = null } = req.body || {};

  const validationError = validateProxyInput(url, method);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const result = await performProxyRequest({ url, method, headers, body });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 502).json({ error: err.message || 'Proxy request failed' });
  }
}

module.exports = { handleProxy };
