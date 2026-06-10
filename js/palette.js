/* Command palette — Ctrl/Cmd+K.
 * One overlay to jump to any view, run common actions, or open an entry
 * by fuzzy title/person/company match. Keyboard-first: arrows + Enter,
 * Escape closes. Built entirely with ui.el; no dependencies.
 */
(function () {
  'use strict';

  const ui = window.Uptrack.ui;
  const db = window.Uptrack.db;

  const VIEWS = [
    { label: 'Today',            hash: '#/',            icon: 'home' },
    { label: 'Weekly',           hash: '#/weekly',      icon: 'calendar-week' },
    { label: 'Monthly',          hash: '#/monthly',     icon: 'calendar' },
    { label: 'Annual',           hash: '#/annual',      icon: 'trending-up' },
    { label: 'Data Review',      hash: '#/datareview',  icon: 'bar-chart' },
    { label: 'Follow-Ups',       hash: '#/followups',   icon: 'check-circle' },
    { label: 'Stakeholder view', hash: '#/stakeholder', icon: 'bar-chart' },
    { label: 'Settings',         hash: '#/settings',    icon: 'sliders' }
  ];

  /* Re-renders the current view without a hash change — the router
   * listens for 'hashchange' on window. */
  function rerenderCurrentView() {
    window.dispatchEvent(new Event('hashchange'));
  }

  const ACTIONS = [
    {
      label: 'New entry',
      icon: 'plus',
      run: function () {
        window.Uptrack.entry.open(null, { onChange: rerenderCurrentView });
      }
    },
    {
      label: 'Download full backup',
      icon: 'copy',
      run: async function () {
        try {
          await window.Uptrack.export.runFullBackup();
          await db.setSetting('lastBackupAt', new Date().toISOString());
          ui.toast('Backup downloaded');
        } catch (err) {
          ui.toast('Backup failed: ' + (err && err.message || 'unknown'), 'error');
        }
      }
    }
  ];

  let _root = null;

  function isOpen() { return !!_root; }

  function close() {
    if (_root && _root.parentNode) _root.parentNode.removeChild(_root);
    _root = null;
  }

  async function open() {
    if (_root) { close(); return; }

    let entries = [];
    try { entries = await db.getAllEntries(); } catch (err) { /* palette still works for views/actions */ }

    const state = { query: '', selected: 0, results: [] };

    function computeResults() {
      const q = state.query.trim().toLowerCase();
      const out = [];
      VIEWS.forEach(function (v) {
        if (!q || v.label.toLowerCase().indexOf(q) !== -1) {
          out.push({ kind: 'view', label: v.label, icon: v.icon, run: function () { window.location.hash = v.hash; } });
        }
      });
      ACTIONS.forEach(function (a) {
        if (!q || a.label.toLowerCase().indexOf(q) !== -1) {
          out.push({ kind: 'action', label: a.label, icon: a.icon, run: a.run });
        }
      });
      if (q.length >= 2) {
        const matched = [];
        for (const e of entries) {
          const hay = (e.title + ' ' + (e.individual || '') + ' ' + (e.companyName || '')).toLowerCase();
          if (hay.indexOf(q) !== -1) matched.push(e);
          if (matched.length >= 8) break;
        }
        matched.forEach(function (e) {
          out.push({
            kind: 'entry',
            label: e.title || '(untitled)',
            hint: e.date + (e.individual ? ' · ' + e.individual : '') + (e.companyName ? ' · ' + e.companyName : ''),
            run: function () {
              window.Uptrack.entry.open(e.id, { onChange: rerenderCurrentView });
            }
          });
        });
      }
      state.results = out;
      if (state.selected >= out.length) state.selected = Math.max(0, out.length - 1);
    }

    function pick(idx) {
      const item = state.results[idx];
      if (!item) return;
      close();
      item.run();
    }

    const list = ui.el('div', { class: 'palette-list' });

    function renderList() {
      ui.clear(list);
      if (!state.results.length) {
        list.appendChild(ui.el('div', { class: 'palette-empty' }, 'No matches'));
        return;
      }
      state.results.forEach(function (item, i) {
        const row = ui.el('div', {
          class: 'palette-item' + (i === state.selected ? ' selected' : ''),
          onclick: function () { pick(i); },
          onmousemove: function () {
            if (state.selected !== i) {
              state.selected = i;
              renderList();
            }
          }
        }, [
          item.icon ? ui.icon(item.icon) : ui.el('span', { class: 'palette-dot' }),
          ui.el('span', { class: 'palette-label' }, item.label),
          item.hint ? ui.el('span', { class: 'palette-hint' }, item.hint) : null,
          ui.el('span', { class: 'palette-kind' }, item.kind)
        ]);
        list.appendChild(row);
      });
      const sel = list.children[state.selected];
      if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
    }

    const input = ui.el('input', {
      type: 'text',
      placeholder: 'Jump to a view, run an action, or find an entry…',
      oninput: function (e) {
        state.query = e.target.value;
        state.selected = 0;
        computeResults();
        renderList();
      },
      onkeydown: function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          state.selected = Math.min(state.selected + 1, state.results.length - 1);
          renderList();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          state.selected = Math.max(state.selected - 1, 0);
          renderList();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          pick(state.selected);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }
    });

    const panel = ui.el('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, [
      ui.el('div', { class: 'palette-input-row' }, [ui.icon('search'), input]),
      list
    ]);

    _root = ui.el('div', {
      class: 'palette-backdrop',
      onclick: function (e) { if (e.target === _root) close(); }
    }, panel);

    document.body.appendChild(_root);
    computeResults();
    renderList();
    setTimeout(function () { input.focus(); }, 10);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.palette = { open: open, close: close, isOpen: isOpen };
})();
