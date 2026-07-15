/**
 * storage.js — Persistence layer.
 *
 * The hackathon forbids databases, so ALL user data is stored in the
 * browser's localStorage under namespaced keys. This module is the single
 * place that touches localStorage, which keeps the rest of the codebase
 * storage-agnostic (swapping to a file/API later would only change this file).
 */

const KEYS = {
  collections: 'pl.collections',
  environments: 'pl.environments',
  activeEnv: 'pl.activeEnv',
  history: 'pl.history',
  theme: 'pl.theme',
  draft: 'pl.draft', // the in-progress request, restored on reload
  seeded: 'pl.seeded', // marks that first-visit sample data has been loaded once
};

/** Safely reads and parses a JSON value; returns fallback on any failure. */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Serializes and writes a value. */
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- Collections ----
export const loadCollections = () => read(KEYS.collections, []);
export const saveCollections = (collections) => write(KEYS.collections, collections);

// ---- Environments ----
export const loadEnvironments = () => read(KEYS.environments, []);
export const saveEnvironments = (envs) => write(KEYS.environments, envs);
export const loadActiveEnvId = () => read(KEYS.activeEnv, '');
export const saveActiveEnvId = (id) => write(KEYS.activeEnv, id);

// ---- History (capped so localStorage never fills up) ----
const HISTORY_LIMIT = 60;
export const loadHistory = () => read(KEYS.history, []);
export function pushHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  write(KEYS.history, history.slice(0, HISTORY_LIMIT));
}
export const clearHistory = () => write(KEYS.history, []);

// ---- Theme ----
export const loadTheme = () => read(KEYS.theme, 'dark');
export const saveTheme = (theme) => write(KEYS.theme, theme);

// ---- Draft request (auto-restore work in progress) ----
export const loadDraft = () => read(KEYS.draft, null);
export const saveDraft = (state) => write(KEYS.draft, state);

// ---- One-time seed flag ----
// True once the first-visit sample collections have been loaded. Kept separate
// from the collections themselves so that if the user later deletes the samples,
// they are NOT re-added on the next reload (their choice is respected).
export const isSeeded = () => read(KEYS.seeded, false);
export const markSeeded = () => write(KEYS.seeded, true);
