/**
 * sample-collections.js — First-visit sample data.
 *
 * Seeds a set of ready-made collections built around the free DummyJSON API
 * (https://dummyjson.com) so the app is never an empty screen on first open.
 *
 * Behaviour ("flexible with localStorage"):
 *   - Seeded ONCE, the first time the app loads (tracked by a `pl.seeded` flag).
 *   - After that the collections behave like any user data: editable, deletable,
 *     and persistent. If the user deletes them, they stay deleted — they are
 *     NOT forced back on the next reload.
 */

import { uid } from '../core/utils.js';
import { loadCollections, saveCollections, isSeeded, markSeeded } from '../core/storage.js';

const BASE = 'https://dummyjson.com';

/** A fresh, empty auth object (each request gets its own copy). */
const noAuth = () => ({
  type: 'none',
  bearerToken: '',
  basicUser: '',
  basicPass: '',
  apiKeyName: '',
  apiKeyValue: '',
  apiKeyIn: 'header',
});

/**
 * Builds one saved-request object in the shape the builder expects.
 * @param {string} name
 * @param {string} method
 * @param {string} path   appended to the DummyJSON base URL
 * @param {object} [opts] { json: <object>, auth: <authObject> }
 */
function req(name, method, path, opts = {}) {
  const hasJson = opts.json !== undefined;
  return {
    id: uid(),
    name,
    method,
    url: `${BASE}${path}`,
    params: [],
    headers: [],
    bodyType: hasJson ? 'json' : 'none',
    body: hasJson ? JSON.stringify(opts.json, null, 2) : '',
    formData: [],
    auth: opts.auth || noAuth(),
  };
}

const collection = (name, requests) => ({ id: uid(), name, requests });

/** The full set of sample collections (rebuilt fresh each call). */
export function buildSampleCollections() {
  return [
    collection('Products', [
      req('Get All Products', 'GET', '/products'),
      req('Get Single Product', 'GET', '/products/1'),
      req('Search Products', 'GET', '/products/search?q=phone'),
      req('Get Categories', 'GET', '/products/categories'),
      req('Add Product', 'POST', '/products/add', {
        json: { title: 'Postman Lite Mug', price: 12.99, brand: 'Acme' },
      }),
      req('Update Product', 'PUT', '/products/1', { json: { price: 999 } }),
      req('Delete Product', 'DELETE', '/products/1'),
    ]),

    collection('Carts', [
      req('Get All Carts', 'GET', '/carts'),
      req('Get Single Cart', 'GET', '/carts/1'),
      req('Get Carts by User', 'GET', '/carts/user/5'),
      req('Add Cart', 'POST', '/carts/add', {
        json: { userId: 1, products: [{ id: 144, quantity: 2 }] },
      }),
    ]),

    collection('Users', [
      req('Get All Users', 'GET', '/users'),
      req('Get Single User', 'GET', '/users/1'),
      req('Search Users', 'GET', '/users/search?q=John'),
      req('Login (get token)', 'POST', '/auth/login', {
        json: { username: 'emilys', password: 'emilyspass' },
      }),
      // Paste the accessToken from "Login" into the Auth tab (Bearer Token) before sending.
      req('Current User (Bearer)', 'GET', '/auth/me', {
        auth: { ...noAuth(), type: 'bearer' },
      }),
      req('Add User', 'POST', '/users/add', {
        json: { firstName: 'Abdul', lastName: 'Khalid', age: 22 },
      }),
    ]),

    collection('Posts', [
      req('Get All Posts', 'GET', '/posts'),
      req('Get Single Post', 'GET', '/posts/1'),
      req('Get Post Comments', 'GET', '/posts/1/comments'),
      req('Search Posts', 'GET', '/posts/search?q=love'),
      req('Add Post', 'POST', '/posts/add', {
        json: { title: 'Hello from Postman Lite', userId: 1 },
      }),
    ]),

    collection('Comments', [
      req('Get All Comments', 'GET', '/comments'),
      req('Get Single Comment', 'GET', '/comments/1'),
      req('Add Comment', 'POST', '/comments/add', {
        json: { body: 'Nice one!', postId: 1, userId: 1 },
      }),
    ]),

    collection('Quotes', [
      req('Get All Quotes', 'GET', '/quotes'),
      req('Get Random Quote', 'GET', '/quotes/random'),
      req('Get Single Quote', 'GET', '/quotes/1'),
    ]),

    collection('Todos', [
      req('Get All Todos', 'GET', '/todos'),
      req('Get Random Todo', 'GET', '/todos/random'),
      req('Add Todo', 'POST', '/todos/add', {
        json: { todo: 'Ship the hackathon project', completed: false, userId: 1 },
      }),
      req('Update Todo', 'PUT', '/todos/1', { json: { completed: true } }),
      req('Delete Todo', 'DELETE', '/todos/1'),
    ]),

    collection('Recipes', [
      req('Get All Recipes', 'GET', '/recipes'),
      req('Get Single Recipe', 'GET', '/recipes/1'),
      req('Search Recipes', 'GET', '/recipes/search?q=pizza'),
      req('Get Recipes by Tag', 'GET', '/recipes/tag/Italian'),
    ]),
  ];
}

/**
 * Loads the sample collections on the very first visit only. Safe to call on
 * every boot: it no-ops once the seed flag is set, so user edits/deletions
 * are never overwritten.
 */
export function seedSampleCollections() {
  if (isSeeded()) return;

  const existing = loadCollections();
  const existingNames = new Set(existing.map((c) => c.name));
  const fresh = buildSampleCollections().filter((c) => !existingNames.has(c.name));

  saveCollections([...existing, ...fresh]);
  markSeeded();
}
