/**
 * collections.js — Saved request collections.
 *
 * A collection is a named folder of saved requests, e.g.:
 *   User APIs ── Login / Register / Profile / Logout
 * Collections and their requests persist in localStorage. Clicking a saved
 * request loads it into the builder; "Save" writes the builder state back.
 */

import { $, uid, escapeHtml, toast } from '../core/utils.js';
import { loadCollections, saveCollections } from '../core/storage.js';

let activeRequestId = null; // highlights the request currently open
let onOpenRequest = () => {};
// Which collections are expanded. Empty by default → all collapsed on first load.
// Tracked here (not in the DOM) so the open/closed state survives re-renders.
const openCollections = new Set();

/** @param {(request: object) => void} openHandler called when a saved request is clicked */
export function initCollections(openHandler) {
  onOpenRequest = openHandler;

  $('#btn-new-collection').addEventListener('click', () => {
    const name = prompt('Collection name:', 'New Collection');
    if (!name || !name.trim()) return;
    const collections = loadCollections();
    collections.push({ id: uid(), name: name.trim(), requests: [] });
    saveCollections(collections);
    renderCollections();
  });

  renderCollections();
}

/** Saves (or updates) a request into a collection. Returns the request id. */
export function saveRequestToCollection(collectionId, name, state) {
  const collections = loadCollections();
  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) return null;

  // Same name inside the same collection = update instead of duplicate
  const existing = collection.requests.find((r) => r.name === name);
  if (existing) {
    Object.assign(existing, state, { name });
    saveCollections(collections);
    renderCollections();
    return existing.id;
  }

  const request = { id: uid(), name, ...state };
  collection.requests.push(request);
  saveCollections(collections);
  renderCollections();
  return request.id;
}

/** Marks a request as the one currently open in the builder. */
export function setActiveRequest(id) {
  activeRequestId = id;
  renderCollections();
}

export function renderCollections() {
  const container = $('#collections-tree');
  const collections = loadCollections();

  if (!collections.length) {
    container.innerHTML = `<p class="empty-note">No collections yet.<br>Create one to group related requests.</p>`;
    return;
  }

  container.innerHTML = collections.map(collectionHtml).join('');
  attachEvents(container);
}

function collectionHtml(collection) {
  const requests = collection.requests.map((request) => `
    <div class="request-item ${request.id === activeRequestId ? 'active' : ''}"
         data-col="${collection.id}" data-req="${request.id}">
      <span class="method-tag method-${escapeHtml(request.method)}">${escapeHtml(request.method)}</span>
      <span class="req-name" title="${escapeHtml(request.url)}">${escapeHtml(request.name)}</span>
      <span class="row-actions">
        <button class="icon-btn act-rename-req" title="Rename"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="icon-btn act-delete-req" title="Delete"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </span>
    </div>`).join('');

  return `
    <div class="collection ${openCollections.has(collection.id) ? 'open' : ''}" data-col="${collection.id}">
      <div class="collection-header">
        <span class="caret">▶</span>
        <span class="col-name">${escapeHtml(collection.name)}</span>
        <span class="row-actions">
          <button class="icon-btn act-rename-col" title="Rename"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="icon-btn act-delete-col" title="Delete collection"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </span>
      </div>
      <div class="collection-requests">
        ${requests || '<p class="empty-note">Empty — save a request here</p>'}
      </div>
    </div>`;
}

function attachEvents(container) {
  // Expand / collapse a collection (remembering the state so re-renders keep it)
  container.querySelectorAll('.collection-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.icon-btn')) return; // ignore action buttons
      const collectionEl = header.parentElement;
      const id = collectionEl.dataset.col;
      if (openCollections.has(id)) openCollections.delete(id);
      else openCollections.add(id);
      collectionEl.classList.toggle('open');
    });
  });

  // Open a saved request in the builder
  container.querySelectorAll('.request-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.icon-btn')) return;
      const request = findRequest(item.dataset.col, item.dataset.req);
      if (request) {
        activeRequestId = request.id;
        onOpenRequest(request);
        renderCollections();
      }
    });
  });

  // Rename / delete actions
  container.querySelectorAll('.act-rename-col').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.collection').dataset.col;
      const collections = loadCollections();
      const collection = collections.find((c) => c.id === id);
      const name = prompt('Rename collection:', collection.name);
      if (name && name.trim()) {
        collection.name = name.trim();
        saveCollections(collections);
        renderCollections();
      }
    });
  });

  container.querySelectorAll('.act-delete-col').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.collection').dataset.col;
      const collections = loadCollections();
      const collection = collections.find((c) => c.id === id);
      if (!confirm(`Delete collection "${collection.name}" and its ${collection.requests.length} request(s)?`)) return;
      saveCollections(collections.filter((c) => c.id !== id));
      renderCollections();
      toast('Collection deleted');
    });
  });

  container.querySelectorAll('.act-rename-req').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.request-item');
      const collections = loadCollections();
      const request = collections
        .find((c) => c.id === item.dataset.col)
        ?.requests.find((r) => r.id === item.dataset.req);
      if (!request) return;
      const name = prompt('Rename request:', request.name);
      if (name && name.trim()) {
        request.name = name.trim();
        saveCollections(collections);
        renderCollections();
      }
    });
  });

  container.querySelectorAll('.act-delete-req').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.request-item');
      const collections = loadCollections();
      const collection = collections.find((c) => c.id === item.dataset.col);
      if (!collection) return;
      collection.requests = collection.requests.filter((r) => r.id !== item.dataset.req);
      saveCollections(collections);
      renderCollections();
      toast('Request deleted');
    });
  });
}

function findRequest(collectionId, requestId) {
  return loadCollections()
    .find((c) => c.id === collectionId)
    ?.requests.find((r) => r.id === requestId);
}
