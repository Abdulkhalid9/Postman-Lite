/**
 * history.js — Automatic request history.
 *
 * Every sent request is logged (with its status and timing) and grouped by
 * day in the History sidebar tab. Clicking an entry restores the full
 * request into the builder — handy for "what did I send 10 minutes ago?".
 */

import { $, escapeHtml, toast } from '../core/utils.js';
import { loadHistory, pushHistory, clearHistory } from '../core/storage.js';

let onOpenEntry = () => {};

export function initHistory(openHandler) {
  onOpenEntry = openHandler;

  $('#btn-clear-history').addEventListener('click', () => {
    if (!loadHistory().length) return;
    if (!confirm('Clear all request history?')) return;
    clearHistory();
    renderHistory();
    toast('History cleared');
  });

  renderHistory();
}

/** Logs a sent request. `status` is the HTTP status or 'ERR' on failure. */
export function recordHistory(state, status) {
  pushHistory({ ...state, status, sentAt: Date.now() });
  renderHistory();
}

export function renderHistory() {
  const container = $('#history-list');
  const history = loadHistory();

  if (!history.length) {
    container.innerHTML = `<p class="empty-note">No history yet.<br>Sent requests show up here.</p>`;
    return;
  }

  // Group entries by calendar day for readability
  let html = '';
  let lastDay = '';
  history.forEach((entry, index) => {
    const day = new Date(entry.sentAt).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    if (day !== lastDay) {
      html += `<div class="history-date">${day}</div>`;
      lastDay = day;
    }
    html += `
      <div class="history-item" data-index="${index}" title="${escapeHtml(entry.url)}">
        <span class="method-tag method-${escapeHtml(entry.method)}">${escapeHtml(entry.method)}</span>
        <span class="hist-url">${escapeHtml(entry.url)}</span>
        <span class="hist-status ${statusClass(entry.status)}">${escapeHtml(String(entry.status))}</span>
      </div>`;
  });
  container.innerHTML = html;

  container.querySelectorAll('.history-item').forEach((item) => {
    item.addEventListener('click', () => {
      const entry = loadHistory()[Number(item.dataset.index)];
      if (entry) onOpenEntry(entry);
    });
  });
}

function statusClass(status) {
  if (typeof status !== 'number') return 'hist-err';
  if (status < 300) return 'hist-ok';
  if (status < 500) return 'hist-warn';
  return 'hist-err';
}
