/**
 * http-proxy.service.js — The core proxy: performs the real outbound HTTP(S)
 * call on behalf of the browser (which cannot, due to CORS).
 *
 * Node's core http/https modules are used (instead of fetch/axios) because
 * they allow non-standard methods such as the new HTTP QUERY method, and give
 * precise control over timing and response-size measurement.
 *
 * Exposes a single Promise-based function so the controller stays thin.
 * On failure it rejects with an object shaped { statusCode, message }.
 */

const http = require('http');
const https = require('https');

const { REQUEST_TIMEOUT_MS } = require('../config');
const { sanitizeHeaders } = require('../utils/validation');
const { collectResponse, decodeBody } = require('../utils/response-decoder');
const { describeNetworkError, elapsedMs } = require('../utils/network-errors');

// Default User-Agent used when the user didn't set one. Node's http/https
// send no User-Agent by default, and some APIs (e.g. GitHub) reject requests
// without it — so we supply a sensible fallback that the user can still override.
const DEFAULT_USER_AGENT = 'PostmanLite/1.0';

/** Adds a default User-Agent header unless the caller already provided one. */
function withDefaultUserAgent(headers) {
  const hasUserAgent = Object.keys(headers).some((h) => h.toLowerCase() === 'user-agent');
  if (!hasUserAgent) headers['User-Agent'] = DEFAULT_USER_AGENT;
  return headers;
}

/**
 * Performs the proxied request.
 *
 * @param   {object} definition  { url, method, headers, body }
 * @returns {Promise<object>}    { status, statusText, headers, body,
 *                                 isBase64, timeMs, sizeBytes }
 */
function performProxyRequest({ url, method, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const startedAt = process.hrtime.bigint();

    const outgoingHeaders = withDefaultUserAgent(sanitizeHeaders(headers));

    const proxyReq = transport.request(
      target,
      {
        method: method.toUpperCase(),
        headers: outgoingHeaders,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (proxyRes) => {
        collectResponse(proxyRes, (err, rawBody) => {
          if (err) {
            return reject({ statusCode: 502, message: err.message });
          }

          const timeMs = elapsedMs(startedAt);
          const bodyInfo = decodeBody(rawBody, proxyRes.headers);

          resolve({
            status: proxyRes.statusCode,
            statusText: proxyRes.statusMessage || '',
            headers: proxyRes.headers,
            body: bodyInfo.text,
            isBase64: bodyInfo.isBase64,
            timeMs,
            sizeBytes: bodyInfo.sizeBytes,
          });
        });
      }
    );

    proxyReq.on('timeout', () => {
      proxyReq.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
    });

    proxyReq.on('error', (err) => {
      reject({ statusCode: 502, message: describeNetworkError(err, target) });
    });

    if (body !== null && body !== undefined && body !== '') {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}

module.exports = { performProxyRequest };
