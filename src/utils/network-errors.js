/**
 * network-errors.js — Turns low-level networking details into friendly text
 * and measures elapsed time with nanosecond precision.
 */

/** Converts low-level network errors into human-friendly messages. */
function describeNetworkError(err, target) {
  switch (err.code) {
    case 'ENOTFOUND':
      return `Could not resolve host "${target.hostname}". Check the URL.`;
    case 'ECONNREFUSED':
      return `Connection refused by ${target.host}. Is the server running?`;
    case 'ECONNRESET':
      return 'Connection was reset by the server.';
    case 'CERT_HAS_EXPIRED':
      return 'The server\'s SSL certificate has expired.';
    default:
      return err.message;
  }
}

/** Nanosecond-precision elapsed time in milliseconds. */
function elapsedMs(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

module.exports = { describeNetworkError, elapsedMs };
