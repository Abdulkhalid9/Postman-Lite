/**
 * echo-server.js — Tiny local echo server for demoing HTTP methods.
 *
 * Accepts ANY method (including the new HTTP QUERY method) on any path and
 * replies 200 with a JSON summary of the request it received. Public APIs
 * mostly don't implement QUERY yet, so this lets you show Postman Lite sending
 * a QUERY request and getting a successful, readable response back.
 *
 * Run in a SECOND terminal:  node tools/echo-server.js
 *   → listens on http://localhost:4000
 * Then in the app: method QUERY, URL http://localhost:4000, Send → 200.
 */

const http = require('http');

const PORT = 4000;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      message: 'Echo OK — your request reached this server',
      method: req.method,   // will show "QUERY" when you send a QUERY request
      path: req.url,
      headers: req.headers,
      body: body || null,
    }, null, 2));
  });
});

server.listen(PORT, () => {
  console.log(`Echo server running at http://localhost:${PORT} (accepts any method, incl. QUERY)`);
});
