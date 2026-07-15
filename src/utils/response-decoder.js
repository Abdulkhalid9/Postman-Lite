/**
 * response-decoder.js — Buffers and decodes a proxied response stream.
 *
 * Responsible for two things:
 *   1. Safely collecting the response body with a hard size cap.
 *   2. Decompressing (gzip/deflate/br) and deciding whether the body is
 *      text (returned as-is) or binary (returned base64-encoded).
 */

const zlib = require('zlib');
const { MAX_RESPONSE_BYTES } = require('../config');

/** Buffers the response stream with a hard size cap. */
function collectResponse(stream, callback) {
  const chunks = [];
  let received = 0;

  stream.on('data', (chunk) => {
    received += chunk.length;
    if (received > MAX_RESPONSE_BYTES) {
      stream.destroy();
      return callback(new Error('Response exceeded the 10 MB size limit'));
    }
    chunks.push(chunk);
  });
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
  stream.on('error', (err) => callback(err));
}

/**
 * Decompresses (gzip/deflate/br) if needed and decides whether the body is
 * text (returned as-is) or binary (returned base64-encoded so the frontend
 * can still display metadata about it).
 */
function decodeBody(rawBody, responseHeaders) {
  let buffer = rawBody;

  const encoding = (responseHeaders['content-encoding'] || '').toLowerCase();
  try {
    if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
    else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
    else if (encoding === 'br') buffer = zlib.brotliDecompressSync(buffer);
  } catch {
    // If decompression fails, fall through with the raw bytes
  }

  const contentType = (responseHeaders['content-type'] || '').toLowerCase();
  const looksTextual =
    contentType.startsWith('text/') ||
    /json|xml|javascript|urlencoded|html|csv|yaml/.test(contentType) ||
    contentType === '';

  if (looksTextual) {
    return { text: buffer.toString('utf8'), isBase64: false, sizeBytes: buffer.length };
  }
  return { text: buffer.toString('base64'), isBase64: true, sizeBytes: buffer.length };
}

module.exports = { collectResponse, decodeBody };
