/**
 * response.js — Response viewer.
 *
 * Renders the proxy result: status pill, time, size, headers table, and the
 * body in three switchable views:
 *   Pretty — indented + syntax-highlighted JSON (falls back to plain text)
 *   Tree   — collapsible JSON tree for exploring large payloads
 *   Raw    — the body exactly as received
 */

import { $, $$, escapeHtml, formatBytes, formatTime } from '../core/utils.js';

let lastBodyText = ''; // kept for the Copy button

/** Switches the response area between empty / loading / content states. */
export function setResponseUiState(state) {
  $('#response-empty').classList.toggle('hidden', state !== 'empty');
  $('#response-loading').classList.toggle('hidden', state !== 'loading');
  $('#response-content').classList.toggle('hidden', state !== 'content');
  if (state !== 'content') $('#response-meta').classList.add('hidden');
}

/** Renders a successful proxy result. */
export function renderResponse(result) {
  setResponseUiState('content');

  // --- Meta line: status, time, size ---
  const meta = $('#response-meta');
  meta.classList.remove('hidden');

  const statusEl = $('#res-status');
  statusEl.textContent = `${result.status} ${result.statusText}`.trim();
  statusEl.className = `pill pill-${Math.floor(result.status / 100)}xx`;

  $('#res-time').innerHTML = `Time: <strong>${formatTime(result.timeMs)}</strong>`;
  $('#res-size').innerHTML = `Size: <strong>${formatBytes(result.sizeBytes)}</strong>`;

  // --- Headers tab ---
  const headerEntries = Object.entries(result.headers || {});
  $('#res-headers-count').textContent = headerEntries.length;
  $('#res-headers-body').innerHTML = headerEntries
    .map(([name, value]) =>
      `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(Array.isArray(value) ? value.join(', ') : value)}</td></tr>`)
    .join('');

  // --- Body tab ---
  renderBody(result);
}

/** Renders a failed request (network error, timeout, invalid URL...). */
export function renderError(message) {
  setResponseUiState('content');

  const meta = $('#response-meta');
  meta.classList.remove('hidden');
  const statusEl = $('#res-status');
  statusEl.textContent = 'Error';
  statusEl.className = 'pill pill-err';
  $('#res-time').textContent = '';
  $('#res-size').textContent = '';

  $('#res-headers-count').textContent = 0;
  $('#res-headers-body').innerHTML = '';

  lastBodyText = message;
  $('#res-body-pretty').textContent = message;
  $('#res-body-tree').innerHTML = '';
  $('#res-body-raw').textContent = message;
}

function renderBody(result) {
  if (result.isBase64) {
    const note = `[binary response — ${formatBytes(result.sizeBytes)}]\nContent-Type: ${result.headers['content-type'] || 'unknown'}`;
    lastBodyText = note;
    $('#res-body-pretty').textContent = note;
    $('#res-body-tree').innerHTML = '';
    $('#res-body-raw').textContent = note;
    return;
  }

  lastBodyText = result.body;
  $('#res-body-raw').textContent = result.body;

  // Try JSON first — most API responses are JSON
  let parsed = null;
  try {
    parsed = JSON.parse(result.body);
  } catch {
    /* not JSON — fall back to plain text views */
  }

  if (parsed !== null && typeof parsed === 'object') {
    lastBodyText = JSON.stringify(parsed, null, 2);
    $('#res-body-pretty').innerHTML = highlightJson(lastBodyText);
    $('#res-body-tree').innerHTML = `<ul>${buildTree(parsed, 'root')}</ul>`;
    attachTreeToggles();
  } else {
    $('#res-body-pretty').textContent = result.body;
    $('#res-body-tree').innerHTML = '<p class="tree-meta">Response is not JSON — use Pretty or Raw view.</p>';
  }
}

/** Returns the body text currently shown (for the Copy button). */
export const getLastBodyText = () => lastBodyText;

/**
 * Lightweight JSON syntax highlighter. Works on already-indented JSON:
 * tokenizes strings / numbers / booleans / null with a single regex and
 * wraps each token in a colored span. Keys are detected by a trailing ':'.
 */
export function highlightJson(json) {
  const tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  return escapeHtml(json).replace(
    /(&quot;(?:\\.|[^&])*?&quot;)(\s*:)?|\b(true|false)\b|\bnull\b|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
    (match, string, colon, bool, number) => {
      if (string) {
        return colon
          ? `<span class="j-key">${string}</span>${colon}`
          : `<span class="j-str">${string}</span>`;
      }
      if (bool) return `<span class="j-bool">${bool}</span>`;
      if (number) return `<span class="j-num">${number}</span>`;
      return `<span class="j-null">${match}</span>`;
    }
  );
}

/**
 * Recursively builds <li> markup for the collapsible tree view.
 * Objects/arrays get a toggle caret and an item-count hint.
 */
function buildTree(value, key) {
  const label = `<span class="j-key">${escapeHtml(key)}</span>: `;

  if (value === null) return `<li>${label}<span class="j-null">null</span></li>`;

  if (Array.isArray(value)) {
    const children = value.map((item, i) => buildTree(item, i)).join('');
    return `<li class="tree-node">${caret()}${label}<span class="tree-meta">Array(${value.length})</span><ul>${children}</ul></li>`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    const children = entries.map(([k, v]) => buildTree(v, k)).join('');
    return `<li class="tree-node">${caret()}${label}<span class="tree-meta">Object{${entries.length}}</span><ul>${children}</ul></li>`;
  }
  if (typeof value === 'string') return `<li>${label}<span class="j-str">"${escapeHtml(value)}"</span></li>`;
  if (typeof value === 'boolean') return `<li>${label}<span class="j-bool">${value}</span></li>`;
  return `<li>${label}<span class="j-num">${value}</span></li>`;
}

const caret = () => `<span class="tree-toggle">▼</span>`;

/** Wires expand/collapse clicks on the tree carets. */
function attachTreeToggles() {
  $$('#res-body-tree .tree-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const node = toggle.parentElement;
      node.classList.toggle('tree-collapsed');
      toggle.textContent = node.classList.contains('tree-collapsed') ? '▶' : '▼';
    });
  });
}
