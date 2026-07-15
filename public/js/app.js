/**
 * app.js — Application entry point.
 *
 * Wires all modules together: tab navigation, the send/save flow, modals
 * (save, snippet, cURL import, environment editor), theme toggle, and
 * draft auto-save so a page refresh never loses work.
 */

import { $, $$, uid, toast, copyToClipboard, escapeHtml } from './core/utils.js';
import { loadCollections, saveCollections, loadTheme, saveTheme, loadDraft, saveDraft } from './core/storage.js';
import { KvEditor } from './components/kv-editor.js';
import {
  initRequestUI, getRequestState, setRequestState,
  buildHttpRequest, sendRequest, paramsEditor, headersEditor,
} from './features/request.js';
import { renderResponse, renderError, setResponseUiState, getLastBodyText } from './features/response.js';
import { initCollections, saveRequestToCollection, setActiveRequest } from './features/collections.js';
import { initHistory, recordHistory } from './features/history.js';
import {
  getEnvironments, getActiveEnvironment, setActiveEnvironment,
  upsertEnvironment, deleteEnvironment,
} from './features/environments.js';
import { generators } from './features/snippets.js';
import { parseCurl } from './features/curl-parser.js';
import { seedSampleCollections } from './features/sample-collections.js';

/* ==================== Sidebar tabs ==================== */

$$('.sidebar-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.sidebar-tab').forEach((t) => t.classList.toggle('active', t === tab));
    $$('.sidebar-panel').forEach((panel) =>
      panel.classList.toggle('active', panel.id === `panel-${tab.dataset.panel}`));
  });
});

/* ==================== Mobile sidebar drawer ==================== */

// Below 860px the sidebar slides in as a drawer over the main area.
// The hamburger toggles it; the backdrop (or opening a request) closes it.
const sidebarEl = $('.sidebar');
const sidebarBackdrop = $('#sidebar-backdrop');

function openSidebar() {
  sidebarEl.classList.add('open');
  sidebarBackdrop.classList.remove('hidden');
}

function closeSidebar() {
  sidebarEl.classList.remove('open');
  sidebarBackdrop.classList.add('hidden');
}

$('#btn-menu').addEventListener('click', () => {
  sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar();
});
sidebarBackdrop.addEventListener('click', closeSidebar);

/* ==================== Request config tabs ==================== */

$$('.req-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.req-tab').forEach((t) => t.classList.toggle('active', t === tab));
    $$('.req-panel').forEach((panel) =>
      panel.classList.toggle('active', panel.id === `tab-${tab.dataset.tab}`));
  });
});

/* ==================== Response tabs & view modes ==================== */

$$('.res-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.res-tab').forEach((t) => t.classList.toggle('active', t === tab));
    $$('.res-panel').forEach((panel) =>
      panel.classList.toggle('active', panel.id === `restab-${tab.dataset.restab}`));
  });
});

$$('.view-mode').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.view-mode').forEach((b) => b.classList.toggle('active', b === button));
    $('#res-body-pretty').classList.toggle('hidden', button.dataset.view !== 'pretty');
    $('#res-body-tree').classList.toggle('hidden', button.dataset.view !== 'tree');
    $('#res-body-raw').classList.toggle('hidden', button.dataset.view !== 'raw');
  });
});

$('#btn-copy-response').addEventListener('click', () => copyToClipboard(getLastBodyText()));

/* ==================== Theme ==================== */

const MOON_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
const SUN_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  // Show the icon for the theme you'd switch TO
  $('#btn-theme-toggle').innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
  saveTheme(theme);
}

$('#btn-theme-toggle').addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* ==================== Draft auto-save & badges ==================== */

/**
 * Called on every builder change: persists the draft and refreshes the
 * little count badges on the Params/Headers tabs.
 */
function handleStateChange() {
  saveDraft(getRequestState());
  updateBadge('#badge-params', paramsEditor.getActiveRows().length);
  updateBadge('#badge-headers', headersEditor.getActiveRows().length);
}

function updateBadge(selector, count) {
  const badge = $(selector);
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

/* ==================== Send flow ==================== */

async function handleSend() {
  const state = getRequestState();
  if (!state.url) {
    toast('Enter a request URL first');
    $('#url-input').focus();
    return;
  }

  const built = buildHttpRequest(state);
  setResponseUiState('loading');
  $('#btn-send').disabled = true;

  try {
    const result = await sendRequest(built);
    renderResponse(result);
    recordHistory(state, result.status);
  } catch (err) {
    renderError(err.message);
    recordHistory(state, 'ERR');
  } finally {
    $('#btn-send').disabled = false;
  }
}

$('#btn-send').addEventListener('click', handleSend);
// Ctrl+Enter / Cmd+Enter anywhere sends the request (productivity shortcut)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend();
});
$('#url-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSend();
});

/* ==================== Modal helpers ==================== */

function openModal(id) {
  $('#modal-overlay').classList.remove('hidden');
  $$('.modal').forEach((modal) => modal.classList.toggle('hidden', modal.id !== id));
}

function closeModal() {
  $('#modal-overlay').classList.add('hidden');
}

$$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
$('#modal-overlay').addEventListener('click', (e) => {
  if (e.target === $('#modal-overlay')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeSidebar(); }
});

/* ==================== Save request modal ==================== */

const NEW_COLLECTION_OPTION = '__new__';

$('#btn-save').addEventListener('click', () => {
  const select = $('#save-collection-select');
  const collections = loadCollections();
  select.innerHTML =
    collections.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') +
    `<option value="${NEW_COLLECTION_OPTION}">+ Create new collection…</option>`;
  $('#save-new-collection-name').classList.toggle('hidden', select.value !== NEW_COLLECTION_OPTION);
  openModal('modal-save');
  $('#save-request-name').focus();
});

$('#save-collection-select').addEventListener('change', (e) => {
  $('#save-new-collection-name').classList.toggle('hidden', e.target.value !== NEW_COLLECTION_OPTION);
});

$('#btn-confirm-save').addEventListener('click', () => {
  const name = $('#save-request-name').value.trim();
  if (!name) { toast('Give the request a name'); return; }

  let collectionId = $('#save-collection-select').value;

  // Create the collection on the fly if requested
  if (collectionId === NEW_COLLECTION_OPTION || !collectionId) {
    const newName = $('#save-new-collection-name').value.trim() || 'My Collection';
    const collections = loadCollections();
    const collection = { id: uid(), name: newName, requests: [] };
    collections.push(collection);
    saveCollections(collections);
    collectionId = collection.id;
  }

  const requestId = saveRequestToCollection(collectionId, name, getRequestState());
  setActiveRequest(requestId);
  showRequestTitle(name);
  closeModal();
  toast(`Saved "${name}"`);
});

function showRequestTitle(name) {
  const el = $('#request-title');
  el.innerHTML = `Saved request: <strong>${escapeHtml(name)}</strong>`;
  el.classList.remove('hidden');
}

/* ==================== Snippet modal ==================== */

let snippetLang = 'curl';

function renderSnippet() {
  const built = buildHttpRequest(getRequestState());
  $('#snippet-output').textContent = generators[snippetLang](built);
}

$('#btn-snippet').addEventListener('click', () => {
  if (!getRequestState().url) { toast('Enter a request URL first'); return; }
  renderSnippet();
  openModal('modal-snippet');
});

$$('.snippet-lang').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.snippet-lang').forEach((b) => b.classList.toggle('active', b === button));
    snippetLang = button.dataset.lang;
    renderSnippet();
  });
});

$('#btn-copy-snippet').addEventListener('click', () =>
  copyToClipboard($('#snippet-output').textContent));

/* ==================== cURL import modal ==================== */

$('#btn-curl-import').addEventListener('click', () => {
  $('#curl-input').value = '';
  $('#curl-error').classList.add('hidden');
  openModal('modal-curl');
  $('#curl-input').focus();
});

$('#btn-confirm-curl').addEventListener('click', () => {
  try {
    const state = parseCurl($('#curl-input').value);
    setRequestState(state);
    setActiveRequest(null);
    $('#request-title').classList.add('hidden');
    closeModal();
    toast('cURL imported into the builder');
  } catch (err) {
    const errorEl = $('#curl-error');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
});

/* ==================== Environments UI ==================== */

let envVarsEditor = null;   // KV editor inside the environment modal
let editingEnvId = null;    // null = creating a new environment

function renderEnvironmentsPanel() {
  const container = $('#env-list');
  const environments = getEnvironments();
  const activeId = getActiveEnvironment()?.id;

  if (!environments.length) {
    container.innerHTML = `<p class="empty-note">No environments yet.<br>Create one to reuse variables like <code>{{BASE_URL}}</code>.</p>`;
  } else {
    container.innerHTML = environments.map((env) => `
      <div class="env-item ${env.id === activeId ? 'active-env' : ''}" data-env="${env.id}">
        <span class="env-name">${env.id === activeId ? '✓ ' : ''}${escapeHtml(env.name)}</span>
        <span class="var-count">${(env.vars || []).filter((v) => v.key).length} vars</span>
        <span class="row-actions">
          <button class="icon-btn act-edit-env" title="Edit"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="icon-btn act-delete-env" title="Delete"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </span>
      </div>`).join('');

    // Click an environment to make it active (click again to deactivate)
    container.querySelectorAll('.env-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.icon-btn')) return;
        const id = item.dataset.env;
        setActiveEnvironment(getActiveEnvironment()?.id === id ? '' : id);
        refreshEnvUi();
      });
    });

    container.querySelectorAll('.act-edit-env').forEach((btn) => {
      btn.addEventListener('click', () => {
        openEnvModal(btn.closest('.env-item').dataset.env);
      });
    });

    container.querySelectorAll('.act-delete-env').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.env-item').dataset.env;
        const env = getEnvironments().find((e) => e.id === id);
        if (confirm(`Delete environment "${env.name}"?`)) {
          deleteEnvironment(id);
          refreshEnvUi();
        }
      });
    });
  }

  // Keep the header dropdown in sync with the panel
  const selector = $('#env-selector');
  selector.innerHTML =
    '<option value="">No Environment</option>' +
    environments.map((env) =>
      `<option value="${env.id}" ${env.id === activeId ? 'selected' : ''}>${escapeHtml(env.name)}</option>`).join('');
}

function refreshEnvUi() {
  renderEnvironmentsPanel();
}

$('#env-selector').addEventListener('change', (e) => {
  setActiveEnvironment(e.target.value);
  refreshEnvUi();
});

function openEnvModal(envId = null) {
  editingEnvId = envId;
  const env = envId ? getEnvironments().find((e) => e.id === envId) : null;

  $('#env-modal-title').textContent = env ? 'Edit Environment' : 'New Environment';
  $('#env-name-input').value = env?.name || '';

  envVarsEditor = new KvEditor($('#env-var-rows'), {
    keyPlaceholder: 'VARIABLE_NAME', valuePlaceholder: 'https://dummyjson.com',
  });
  envVarsEditor.setRows(env?.vars || []);

  openModal('modal-env');
  $('#env-name-input').focus();
}

$('#btn-new-env').addEventListener('click', () => openEnvModal());

$('#btn-confirm-env').addEventListener('click', () => {
  const name = $('#env-name-input').value.trim();
  if (!name) { toast('Give the environment a name'); return; }

  upsertEnvironment({
    id: editingEnvId || uid(),
    name,
    vars: envVarsEditor.getRows(),
  });
  closeModal();
  refreshEnvUi();
  toast(`Environment "${name}" saved`);
});

/* ==================== Boot ==================== */

function boot() {
  applyTheme(loadTheme());
  initRequestUI(handleStateChange);

  // On first visit only, load the ready-made DummyJSON sample collections
  seedSampleCollections();

  // Opening a saved request or history entry loads it into the builder
  initCollections((request) => {
    setRequestState(request);
    showRequestTitle(request.name);
    closeSidebar(); // on mobile, get out of the way once a request is loaded
  });
  initHistory((entry) => {
    setRequestState(entry);
    setActiveRequest(null);
    $('#request-title').classList.add('hidden');
    closeSidebar();
  });

  refreshEnvUi();

  // Restore the draft from the previous session (or start clean)
  const draft = loadDraft();
  if (draft) setRequestState(draft);
  else setRequestState({ method: 'GET', url: '' });

  setResponseUiState('empty');
}

boot();
