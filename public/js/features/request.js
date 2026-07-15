/**
 * request.js — Request state and sending.
 *
 * Owns the "current request" shown in the builder UI. Provides:
 *   - getRequestState() / setRequestState() to move requests in and out of
 *     the UI (used by collections, history, and cURL import)
 *   - buildHttpRequest() which turns the raw state into the final
 *     { url, method, headers, body } — applying environment variables,
 *     query params, auth, and body serialization
 *   - sendRequest() which posts the built request to the backend proxy
 */

import { $ } from '../core/utils.js';
import { KvEditor } from '../components/kv-editor.js';
import { getActiveVariables, substituteVariables } from './environments.js';

// Key/value editors for the three request tabs (created in initRequestUI)
export let paramsEditor;
export let headersEditor;
export let formEditor;

let onStateChange = () => {};

/** Creates the KV editors and wires body/auth controls. */
export function initRequestUI(handleChange) {
  onStateChange = handleChange;

  paramsEditor = new KvEditor($('#params-rows'), {
    keyPlaceholder: 'page', valuePlaceholder: '2', onChange: onStateChange,
  });
  headersEditor = new KvEditor($('#headers-rows'), {
    keyPlaceholder: 'Content-Type', valuePlaceholder: 'application/json', onChange: onStateChange,
  });
  formEditor = new KvEditor($('#form-rows'), {
    keyPlaceholder: 'key', valuePlaceholder: 'value', onChange: onStateChange,
  });

  // Body type radios show/hide the text editor vs. the form-data grid
  document.querySelectorAll('input[name="body-type"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      updateBodyVisibility();
      onStateChange();
    });
  });

  // Live JSON validation + line numbers while typing a JSON body
  $('#body-editor').addEventListener('input', () => {
    validateJsonIndicator();
    updateBodyGutter();
    onStateChange();
  });
  // Keep the line-number gutter aligned when the textarea scrolls
  $('#body-editor').addEventListener('scroll', () => {
    $('#body-gutter').scrollTop = $('#body-editor').scrollTop;
  });

  $('#btn-beautify-json').addEventListener('click', beautifyJsonBody);

  updateBodyGutter(); // seed the gutter (shows "1" when empty)

  // Auth type selector shows the matching field group
  $('#auth-type').addEventListener('change', () => {
    updateAuthVisibility();
    onStateChange();
  });
  ['#auth-bearer-token', '#auth-basic-user', '#auth-basic-pass',
   '#auth-apikey-name', '#auth-apikey-value', '#auth-apikey-in']
    .forEach((sel) => $(sel).addEventListener('input', onStateChange));

  $('#method-select').addEventListener('change', onStateChange);
  $('#url-input').addEventListener('input', onStateChange);
}

/** Returns the currently selected body type radio value. */
function getBodyType() {
  return document.querySelector('input[name="body-type"]:checked').value;
}

/** Shows the correct body editor for the selected body type. */
export function updateBodyVisibility() {
  const type = getBodyType();
  const isText = type === 'json' || type === 'raw';
  const isForm = type === 'form-data' || type === 'urlencoded';
  $('#body-editor-wrap').classList.toggle('hidden', !isText);
  $('#body-form-wrap').classList.toggle('hidden', !isForm);
  $('#btn-beautify-json').classList.toggle('hidden', type !== 'json');
  validateJsonIndicator();
}

/** Shows the field group for the selected auth type. */
export function updateAuthVisibility() {
  const type = $('#auth-type').value;
  $('#auth-bearer').classList.toggle('hidden', type !== 'bearer');
  $('#auth-basic').classList.toggle('hidden', type !== 'basic');
  $('#auth-apikey').classList.toggle('hidden', type !== 'apikey');
}

/** Green/red "valid JSON" hint under the body editor. */
function validateJsonIndicator() {
  const indicator = $('#json-validity');
  if (getBodyType() !== 'json' || !$('#body-editor').value.trim()) {
    indicator.textContent = '';
    return;
  }
  try {
    JSON.parse($('#body-editor').value);
    indicator.textContent = '✓ Valid JSON';
    indicator.className = 'json-validity valid';
  } catch (err) {
    indicator.textContent = `✗ ${err.message}`;
    indicator.className = 'json-validity invalid';
  }
}

/** Pretty-prints the JSON body in place (no-op if invalid). */
function beautifyJsonBody() {
  const editor = $('#body-editor');
  try {
    editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
    validateJsonIndicator();
    updateBodyGutter();
  } catch {
    /* leave invalid JSON untouched so the user can fix it */
  }
}

/** Rebuilds the left line-number gutter to match the body editor's line count. */
function updateBodyGutter() {
  const editor = $('#body-editor');
  const gutter = $('#body-gutter');
  if (!gutter) return;
  const lineCount = editor.value.split('\n').length || 1;
  let out = '1';
  for (let i = 2; i <= lineCount; i++) out += '\n' + i;
  gutter.textContent = out;
  gutter.scrollTop = editor.scrollTop;
}

/** Snapshot of everything the user has configured in the builder. */
export function getRequestState() {
  return {
    method: $('#method-select').value,
    url: $('#url-input').value.trim(),
    params: paramsEditor.getRows(),
    headers: headersEditor.getRows(),
    bodyType: getBodyType(),
    body: $('#body-editor').value,
    formData: formEditor.getRows(),
    auth: {
      type: $('#auth-type').value,
      bearerToken: $('#auth-bearer-token').value,
      basicUser: $('#auth-basic-user').value,
      basicPass: $('#auth-basic-pass').value,
      apiKeyName: $('#auth-apikey-name').value,
      apiKeyValue: $('#auth-apikey-value').value,
      apiKeyIn: $('#auth-apikey-in').value,
    },
  };
}

/** Loads a saved request state back into the builder UI. */
export function setRequestState(state) {
  $('#method-select').value = state.method || 'GET';
  $('#url-input').value = state.url || '';
  paramsEditor.setRows(state.params || []);
  headersEditor.setRows(state.headers || []);
  formEditor.setRows(state.formData || []);
  $('#body-editor').value = state.body || '';

  const bodyType = state.bodyType || 'none';
  document.querySelector(`input[name="body-type"][value="${bodyType}"]`).checked = true;

  const auth = state.auth || { type: 'none' };
  $('#auth-type').value = auth.type || 'none';
  $('#auth-bearer-token').value = auth.bearerToken || '';
  $('#auth-basic-user').value = auth.basicUser || '';
  $('#auth-basic-pass').value = auth.basicPass || '';
  $('#auth-apikey-name').value = auth.apiKeyName || '';
  $('#auth-apikey-value').value = auth.apiKeyValue || '';
  $('#auth-apikey-in').value = auth.apiKeyIn || 'header';

  updateBodyVisibility();
  updateBodyGutter();
  updateAuthVisibility();
  onStateChange();
}

/**
 * Builds the final HTTP request from a state object:
 *  1. substitute {{ENV_VARS}} everywhere
 *  2. append enabled query params (and API-key-in-query auth) to the URL
 *  3. add auth + content-type headers
 *  4. serialize the body for the chosen body type
 */
export function buildHttpRequest(state) {
  const vars = getActiveVariables();
  const sub = (text) => substituteVariables(text, vars);

  let url = sub(state.url);
  // Default to http:// when the user omits the protocol
  if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;

  // --- Query parameters ---
  const queryParts = state.params
    .filter((p) => p.enabled && p.key)
    .map((p) => `${encodeURIComponent(sub(p.key))}=${encodeURIComponent(sub(p.value))}`);

  // --- Headers (user-defined first, then auth/body can add more) ---
  const headers = {};
  for (const h of state.headers) {
    if (h.enabled && h.key) headers[sub(h.key)] = sub(h.value);
  }

  // --- Authentication ---
  const auth = state.auth || { type: 'none' };
  if (auth.type === 'bearer' && auth.bearerToken) {
    headers['Authorization'] = `Bearer ${sub(auth.bearerToken)}`;
  } else if (auth.type === 'basic') {
    const credentials = `${sub(auth.basicUser)}:${sub(auth.basicPass)}`;
    headers['Authorization'] = `Basic ${btoa(credentials)}`;
  } else if (auth.type === 'apikey' && auth.apiKeyName) {
    if (auth.apiKeyIn === 'query') {
      queryParts.push(
        `${encodeURIComponent(sub(auth.apiKeyName))}=${encodeURIComponent(sub(auth.apiKeyValue))}`
      );
    } else {
      headers[sub(auth.apiKeyName)] = sub(auth.apiKeyValue);
    }
  }

  if (queryParts.length) {
    url += (url.includes('?') ? '&' : '?') + queryParts.join('&');
  }

  // --- Body ---
  let body = null;
  const hasHeader = (name) =>
    Object.keys(headers).some((h) => h.toLowerCase() === name.toLowerCase());

  switch (state.bodyType) {
    case 'json':
      body = sub(state.body);
      if (!hasHeader('content-type')) headers['Content-Type'] = 'application/json';
      break;
    case 'raw':
      body = sub(state.body);
      if (!hasHeader('content-type')) headers['Content-Type'] = 'text/plain';
      break;
    case 'form-data': {
      // multipart/form-data built manually so the proxy can forward it as-is
      const boundary = `----PostmanLiteBoundary${Date.now().toString(16)}`;
      const fields = state.formData.filter((f) => f.enabled && f.key);
      body = fields
        .map((f) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="${sub(f.key)}"\r\n\r\n${sub(f.value)}\r\n`)
        .join('') + `--${boundary}--\r\n`;
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      break;
    }
    case 'urlencoded':
      body = state.formData
        .filter((f) => f.enabled && f.key)
        .map((f) => `${encodeURIComponent(sub(f.key))}=${encodeURIComponent(sub(f.value))}`)
        .join('&');
      if (!hasHeader('content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      break;
    default:
      body = null; // 'none'
  }

  return { url, method: state.method, headers, body };
}

/**
 * Sends the built request through the backend proxy.
 * Returns the proxy's result object, or throws with a readable message.
 */
export async function sendRequest(built) {
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(built),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Proxy error (HTTP ${response.status})`);
  }
  return result;
}
