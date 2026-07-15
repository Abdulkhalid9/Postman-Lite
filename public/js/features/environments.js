/**
 * environments.js — Environment variables.
 *
 * An environment is a named set of variables (e.g. "Local Dev" with
 * BASE_URL=http://localhost:5000). Exactly one environment can be active.
 * Anywhere in a request — URL, params, headers, body, auth fields — the
 * token {{VAR_NAME}} is replaced with the active environment's value just
 * before the request is sent, so saved requests stay portable.
 */

import {
  loadEnvironments, saveEnvironments,
  loadActiveEnvId, saveActiveEnvId,
} from '../core/storage.js';

export const getEnvironments = () => loadEnvironments();

export function getActiveEnvironment() {
  const id = loadActiveEnvId();
  return getEnvironments().find((env) => env.id === id) || null;
}

export function setActiveEnvironment(id) {
  saveActiveEnvId(id);
}

export function upsertEnvironment(env) {
  const envs = getEnvironments();
  const index = envs.findIndex((e) => e.id === env.id);
  if (index === -1) envs.push(env);
  else envs[index] = env;
  saveEnvironments(envs);
}

export function deleteEnvironment(id) {
  saveEnvironments(getEnvironments().filter((env) => env.id !== id));
  if (loadActiveEnvId() === id) saveActiveEnvId('');
}

/**
 * Returns the active environment's variables as a { NAME: value } map,
 * considering only enabled rows with a non-empty name.
 */
export function getActiveVariables() {
  const env = getActiveEnvironment();
  if (!env) return {};
  const vars = {};
  for (const row of env.vars || []) {
    if (row.enabled !== false && row.key) vars[row.key] = row.value;
  }
  return vars;
}

/**
 * Replaces every {{VAR}} token in a string with its value from the map.
 * Unknown variables are left untouched so the user can spot the typo in
 * the sent request instead of silently sending an empty string.
 */
export function substituteVariables(text, variables) {
  if (typeof text !== 'string' || !text.includes('{{')) return text;
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name) =>
    Object.hasOwn(variables, name) ? variables[name] : match
  );
}
