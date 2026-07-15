/**
 * validation.js — Input validation and header hygiene for the proxy.
 */

/**
 * Validates the incoming proxy payload; returns an error string or null.
 */
function validateProxyInput(url, method) {
  if (!url || typeof url !== 'string') return 'Missing "url" field';
  if (!method || typeof method !== 'string') return 'Missing "method" field';

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `Invalid URL: "${url}". Did you forget http:// or https://?`;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return 'Only http:// and https:// URLs are supported';
  }
  // HTTP method tokens: letters/digits and a few symbols (RFC 9110)
  if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(method)) {
    return `Invalid HTTP method: "${method}"`;
  }
  return null;
}

/**
 * Removes headers the proxy must control itself (e.g. Host must match the
 * target server, and we handle encoding/length manually).
 */
function sanitizeHeaders(headers) {
  const blocked = new Set(['host', 'content-length', 'connection']);
  const clean = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name && !blocked.has(name.toLowerCase())) {
      clean[name] = value;
    }
  }
  return clean;
}

module.exports = { validateProxyInput, sanitizeHeaders };
