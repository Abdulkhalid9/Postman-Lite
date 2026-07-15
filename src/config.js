/**
 * config.js — Central configuration constants for the backend.
 *
 * Kept in one place so limits and ports are easy to find and tune.
 */

module.exports = {
  // Port the server listens on (overridable via the PORT env var)
  PORT: process.env.PORT || 5000,

  // Abort a proxied request if the target takes longer than this
  REQUEST_TIMEOUT_MS: 30_000,

  // Hard cap on a proxied response body (protects server memory)
  MAX_RESPONSE_BYTES: 10 * 1024 * 1024, // 10 MB

  // Max size of the request definition the frontend may POST to /api/proxy
  JSON_BODY_LIMIT: '15mb',
};
