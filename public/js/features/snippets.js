/**
 * snippets.js — Code snippet generator (bonus feature).
 *
 * Converts the current (already-built) request into ready-to-paste code:
 * a cURL command, a JavaScript fetch() call, or an axios call. Works on the
 * output of buildHttpRequest(), so environment variables and auth headers
 * are already resolved — the snippet reproduces the exact request sent.
 */

/** Wraps a string in single quotes with shell-safe escaping. */
function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

export function generateCurl({ url, method, headers, body }) {
  const lines = [`curl -X ${method} ${shellQuote(url)}`];
  for (const [name, value] of Object.entries(headers)) {
    lines.push(`  -H ${shellQuote(`${name}: ${value}`)}`);
  }
  if (body) lines.push(`  -d ${shellQuote(body)}`);
  return lines.join(' \\\n');
}

export function generateFetch({ url, method, headers, body }) {
  const options = { method };
  if (Object.keys(headers).length) options.headers = headers;
  if (body) options.body = body;

  return [
    `const response = await fetch(${JSON.stringify(url)}, ${JSON.stringify(options, null, 2)});`,
    '',
    'const data = await response.json();',
    'console.log(data);',
  ].join('\n');
}

export function generateAxios({ url, method, headers, body }) {
  const config = {
    method: method.toLowerCase(),
    url,
  };
  if (Object.keys(headers).length) config.headers = headers;
  if (body) {
    // Keep JSON bodies as objects in the snippet for idiomatic axios usage
    try { config.data = JSON.parse(body); }
    catch { config.data = body; }
  }

  return [
    `const response = await axios(${JSON.stringify(config, null, 2)});`,
    '',
    'console.log(response.data);',
  ].join('\n');
}

/** Dispatch table used by the snippet modal. */
export const generators = {
  curl: generateCurl,
  fetch: generateFetch,
  axios: generateAxios,
};
