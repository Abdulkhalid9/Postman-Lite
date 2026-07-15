/**
 * kv-editor.js — Reusable key/value row editor.
 *
 * Used for query params, headers, form-data fields, and environment
 * variables. Rows have an enable checkbox, key input, value input, and a
 * remove button. A "ghost" row always sits at the bottom: typing into it
 * turns it into a real row and spawns a fresh ghost, so users never need
 * an explicit "add row" button.
 */

import { escapeHtml } from '../core/utils.js';

export class KvEditor {
  /**
   * @param {HTMLElement} container   where rows are rendered
   * @param {object}      options     { keyPlaceholder, valuePlaceholder, onChange }
   */
  constructor(container, options = {}) {
    this.container = container;
    this.keyPlaceholder = options.keyPlaceholder || 'Key';
    this.valuePlaceholder = options.valuePlaceholder || 'Value';
    this.onChange = options.onChange || (() => {});
    this.rows = []; // [{ key, value, enabled }]
    this.render();
  }

  /** Replaces all rows with the given data. */
  setRows(rows) {
    this.rows = (rows || []).map((r) => ({
      key: r.key ?? '',
      value: r.value ?? '',
      enabled: r.enabled !== false,
    }));
    this.render();
  }

  /** Returns rows that have at least a key or value typed in. */
  getRows() {
    return this.rows.filter((r) => r.key !== '' || r.value !== '');
  }

  /** Returns only enabled, non-empty-key rows (what actually gets sent). */
  getActiveRows() {
    return this.getRows().filter((r) => r.enabled && r.key !== '');
  }

  render() {
    const rowsHtml = this.rows
      .map((row, i) => this.rowHtml(row, i, false))
      .join('');
    // The ghost row at the end lets the user start typing a new entry
    this.container.innerHTML = rowsHtml + this.rowHtml({ key: '', value: '', enabled: true }, this.rows.length, true);
    this.attachEvents();
  }

  rowHtml(row, index, isGhost) {
    return `
      <div class="kv-row ${isGhost ? 'kv-ghost' : ''}" data-index="${index}">
        <input type="checkbox" ${row.enabled ? 'checked' : ''} ${isGhost ? 'disabled' : ''} title="Enable/disable" />
        <input type="text" class="kv-key" placeholder="${this.keyPlaceholder}" value="${escapeHtml(row.key)}" spellcheck="false" />
        <input type="text" class="kv-value" placeholder="${this.valuePlaceholder}" value="${escapeHtml(row.value)}" spellcheck="false" />
        <button class="kv-remove" title="Remove" ${isGhost ? 'style="visibility:hidden"' : ''}>×</button>
      </div>`;
  }

  attachEvents() {
    this.container.querySelectorAll('.kv-row').forEach((rowEl) => {
      const index = Number(rowEl.dataset.index);
      const isGhost = index >= this.rows.length;
      const [checkbox, keyInput, valueInput] = rowEl.querySelectorAll('input');

      const handleInput = () => {
        if (isGhost) {
          // First keystroke in the ghost row promotes it to a real row
          this.rows.push({ key: keyInput.value, value: valueInput.value, enabled: true });
          this.render();
          // Restore focus to the same logical field in the new real row
          const newRow = this.container.querySelectorAll('.kv-row')[index];
          const target = document.activeElement === valueInput ? '.kv-value' : '.kv-key';
          const focusEl = newRow?.querySelector(target);
          if (focusEl) {
            focusEl.focus();
            focusEl.setSelectionRange(focusEl.value.length, focusEl.value.length);
          }
        } else {
          this.rows[index].key = keyInput.value;
          this.rows[index].value = valueInput.value;
        }
        this.onChange();
      };

      keyInput.addEventListener('input', handleInput);
      valueInput.addEventListener('input', handleInput);

      if (!isGhost) {
        checkbox.addEventListener('change', () => {
          this.rows[index].enabled = checkbox.checked;
          this.onChange();
        });
        rowEl.querySelector('.kv-remove').addEventListener('click', () => {
          this.rows.splice(index, 1);
          this.render();
          this.onChange();
        });
      }
    });
  }
}
