/**
 * curl-parser.js — cURL import (bonus feature).
 *
 * Parses a pasted cURL command into a request state object the builder can
 * load. Handles the common flags produced by browsers' "Copy as cURL" and
 * API docs: -X/--request, -H/--header, -d/--data(-raw), -u/--user, -F/--form,
 * plus quoted arguments and line continuations.
 */

/**
 * Splits a shell command into tokens, respecting single/double quotes and
 * backslash escapes. This is the "complex" part: we walk the string char by
 * char, tracking which quote context we're inside.
 */
function tokenize(command) {
  const tokens = [];
  let current = '';
  let quote = null;       // ' or " while inside quotes
  let hasToken = false;   // distinguishes "" (empty arg) from no arg

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && quote === '"' && i + 1 < command.length) {
        current += command[++i]; // escaped char inside double quotes
      } else {
        current += char;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      hasToken = true;
    } else if (char === '\\' && command[i + 1] === '\n') {
      i++; // line continuation — skip
    } else if (/\s/.test(char)) {
      if (hasToken || current) tokens.push(current);
      current = '';
      hasToken = false;
    } else {
      current += char;
    }
  }
  if (hasToken || current) tokens.push(current);
  return tokens;
}

/**
 * Converts a cURL command string into a builder request state.
 * Throws with a helpful message when the input isn't valid cURL.
 */
export function parseCurl(command) {
  const trimmed = command.trim();
  if (!trimmed) throw new Error('Paste a cURL command first.');

  const tokens = tokenize(trimmed);
  if (tokens[0] !== 'curl') throw new Error('Command must start with "curl".');

  const state = {
    method: '',
    url: '',
    params: [],
    headers: [],
    bodyType: 'none',
    body: '',
    formData: [],
    auth: { type: 'none' },
  };

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    const next = () => tokens[++i]; // consumes the flag's argument

    switch (token) {
      case '-X': case '--request':
        state.method = next().toUpperCase();
        break;

      case '-H': case '--header': {
        const header = next();
        const sep = header.indexOf(':');
        if (sep > -1) {
          state.headers.push({
            key: header.slice(0, sep).trim(),
            value: header.slice(sep + 1).trim(),
            enabled: true,
          });
        }
        break;
      }

      case '-d': case '--data': case '--data-raw': case '--data-binary':
        state.body = next();
        if (!state.method) state.method = 'POST'; // curl's own default with -d
        break;

      case '-u': case '--user': {
        const [user, ...passParts] = next().split(':');
        state.auth = { type: 'basic', basicUser: user, basicPass: passParts.join(':') };
        break;
      }

      case '-F': case '--form': {
        const field = next();
        const eq = field.indexOf('=');
        if (eq > -1) {
          state.formData.push({ key: field.slice(0, eq), value: field.slice(eq + 1), enabled: true });
          state.bodyType = 'form-data';
        }
        break;
      }

      // Flags that take an argument we don't need — consume and ignore it
      case '-o': case '--output': case '-A': case '--user-agent':
      case '-e': case '--referer': case '-b': case '--cookie':
        next();
        break;

      // Boolean flags we can safely ignore
      case '-s': case '--silent': case '-k': case '--insecure':
      case '-L': case '--location': case '-i': case '--include':
      case '--compressed': case '-v': case '--verbose':
        break;

      default:
        // First non-flag token is the URL
        if (!token.startsWith('-') && !state.url) state.url = token;
    }
  }

  if (!state.url) throw new Error('No URL found in the command.');
  if (!state.method) state.method = 'GET';

  finalizeBody(state);
  extractQueryParams(state);
  detectAuthHeader(state);
  return state;
}

/** Decides the body type (JSON vs raw) for -d payloads. */
function finalizeBody(state) {
  if (!state.body || state.bodyType === 'form-data') return;

  const contentType = state.headers
    .find((h) => h.key.toLowerCase() === 'content-type')?.value || '';

  if (contentType.includes('x-www-form-urlencoded')) {
    // Show urlencoded bodies in the form editor for easy editing
    state.bodyType = 'urlencoded';
    state.formData = state.body.split('&').map((pair) => {
      const [key, ...rest] = pair.split('=');
      return {
        key: decodeURIComponent(key || ''),
        value: decodeURIComponent(rest.join('=') || ''),
        enabled: true,
      };
    });
    state.body = '';
    return;
  }

  let isJson = contentType.includes('json');
  if (!isJson) {
    try { JSON.parse(state.body); isJson = true; } catch { /* not JSON */ }
  }
  state.bodyType = isJson ? 'json' : 'raw';
}

/** Moves the URL's ?query=string into the Params tab. */
function extractQueryParams(state) {
  const qIndex = state.url.indexOf('?');
  if (qIndex === -1) return;

  const query = state.url.slice(qIndex + 1);
  state.url = state.url.slice(0, qIndex);
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, ...rest] = pair.split('=');
    state.params.push({
      key: decodeURIComponent(key),
      value: decodeURIComponent(rest.join('=')),
      enabled: true,
    });
  }
}

/** Converts an "Authorization: Bearer x" header into the Auth tab. */
function detectAuthHeader(state) {
  if (state.auth.type !== 'none') return;
  const index = state.headers.findIndex(
    (h) => h.key.toLowerCase() === 'authorization' && /^bearer\s/i.test(h.value)
  );
  if (index > -1) {
    state.auth = { type: 'bearer', bearerToken: state.headers[index].value.replace(/^bearer\s+/i, '') };
    state.headers.splice(index, 1);
  }
}
