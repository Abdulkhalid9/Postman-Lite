/**
 * utils.js — Small shared helpers used across the app.
 */

/** Shorthand for document.querySelector */
export const $ = (selector) => document.querySelector(selector);

/** Shorthand for document.querySelectorAll (returns a real array) */
export const $$ = (selector) => [...document.querySelectorAll(selector)];

/** Generates a short unique id (good enough for client-side records). */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Escapes HTML special characters to prevent markup injection when rendering. */
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Formats a byte count as B / KB / MB with sensible precision. */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Formats milliseconds as "245 ms" or "1.32 s". */
export function formatTime(ms) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

let toastTimer = null;

/** Shows a temporary toast message at the bottom of the screen. */
export function toast(message, duration = 2200) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

/** Copies text to the clipboard and confirms with a toast. */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch {
    toast('Could not copy — clipboard blocked by browser');
  }
}
