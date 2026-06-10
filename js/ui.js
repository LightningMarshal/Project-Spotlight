/* Shared UI helpers: element builders, dates, formatters, modals, toasts. */
(function () {
  'use strict';

  /* ---------- element creation ---------- */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v);
      }
    }
    if (children != null) {
      const arr = Array.isArray(children) ? children : [children];
      for (const c of arr) {
        if (c == null || c === false) continue;
        if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
        else node.appendChild(c);
      }
    }
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- dates ---------- */

  function pad(n) { return String(n).padStart(2, '0'); }

  function toIso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseIso(s) {
    // Local-time parse; 'YYYY-MM-DD' -> Date at local midnight (avoid TZ shifting).
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function today() {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }

  function startOfWeek(d) {
    // Week = Monday..Sunday.
    const date = new Date(d); date.setHours(0, 0, 0, 0);
    const day = date.getDay(); // 0 = Sun, 1 = Mon, ...
    const diff = (day === 0 ? -6 : 1 - day);
    date.setDate(date.getDate() + diff);
    return date;
  }

  function endOfWeek(d) {
    const s = startOfWeek(d);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return e;
  }

  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function startOfYear(d)  { return new Date(d.getFullYear(), 0, 1); }
  function endOfYear(d)    { return new Date(d.getFullYear(), 11, 31); }

  function monthKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function monthLabel(d) {
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function shortDate(s) {
    const d = typeof s === 'string' ? parseIso(s) : s;
    if (!d) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function longDate(s) {
    const d = typeof s === 'string' ? parseIso(s) : s;
    if (!d) return '';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function relativeDay(isoStr) {
    const d = parseIso(isoStr);
    if (!d) return '';
    const t = today();
    const diff = Math.round((d - t) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    if (diff < 0 && diff > -7) return -diff + ' days ago';
    return shortDate(isoStr);
  }

  /* ---------- modal ---------- */

  /* The active modal's Escape handler. Tracked module-wide so closeModal()
   * can always detach it — previously the listener was only removed when
   * Escape itself closed the modal, so closing via the × button or backdrop
   * leaked one document-level listener per modal opened. */
  let _modalKeyHandler = null;

  /* opts:
   *   persistent  — backdrop click / Escape do not close the modal
   *   beforeClose — called before any dismissal (×, backdrop, Escape);
   *                 return false to keep the modal open. Direct calls to
   *                 closeModal() (e.g. after a successful save) bypass it.
   */
  function openModal(title, bodyNode, opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    clear(root);
    if (_modalKeyHandler) {
      document.removeEventListener('keydown', _modalKeyHandler);
      _modalKeyHandler = null;
    }

    function requestClose() {
      if (opts.beforeClose && !opts.beforeClose()) return;
      closeModal();
    }

    const modal = el('div', { class: 'modal' }, [
      el('div', { class: 'modal-header' }, [
        el('h3', null, title),
        el('button', { class: 'modal-close', title: 'Close', onclick: requestClose }, '×')
      ]),
      el('div', { class: 'modal-body' }, bodyNode)
    ]);
    const backdrop = el('div', {
      class: 'modal-backdrop',
      onclick: function (e) { if (e.target === backdrop && !opts.persistent) requestClose(); }
    }, modal);

    root.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    _modalKeyHandler = function (e) {
      if (e.key === 'Escape' && !opts.persistent) requestClose();
    };
    document.addEventListener('keydown', _modalKeyHandler);
    return { modal: modal, backdrop: backdrop };
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    clear(root);
    document.body.style.overflow = '';
    if (_modalKeyHandler) {
      document.removeEventListener('keydown', _modalKeyHandler);
      _modalKeyHandler = null;
    }
  }

  /* ---------- toast ---------- */

  function toast(message, kind) {
    const root = document.getElementById('toast-root');
    const node = el('div', { class: 'toast' + (kind ? ' ' + kind : '') }, message);
    root.appendChild(node);
    setTimeout(function () {
      node.style.opacity = '0';
      node.style.transition = 'opacity 0.3s';
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 300);
    }, 2800);
  }

  /* ---------- badges / chips / tag builders ---------- */

  function statusBadge(status) {
    return el('span', { class: 'badge ' + status }, status);
  }

  function domainBadge(domain) {
    return domain ? el('span', { class: 'badge domain' }, domain) : null;
  }

  function impactBadge(impact) {
    if (!impact) return null;
    const cls = window.Uptrack.tax.IMPACT_CLASS[impact] || 'impact-low';
    return el('span', { class: 'badge impact ' + cls }, impact);
  }

  function tagChips(tags) {
    const frag = document.createDocumentFragment();
    if (!tags) return frag;
    const groups = [
      { key: 'values',     list: tags.values     || [] },
      { key: 'tenets',     list: tags.tenets     || [] },
      { key: 'principles', list: tags.principles || [] }
    ];
    for (const g of groups) {
      for (const t of g.list) {
        frag.appendChild(el('span', { class: 'chip tax-' + g.key }, t));
      }
    }
    return frag;
  }

  /* ---------- confirm ---------- */

  function confirmDialog(message, onOk) {
    const body = el('div', null, [
      el('p', { style: { marginTop: 0, color: 'var(--text-dim)' } }, message),
      el('div', { class: 'form-actions' }, [
        el('div', null),
        el('div', { class: 'btn-row' }, [
          el('button', { class: 'btn subtle', onclick: closeModal }, 'Cancel'),
          el('button', {
            class: 'btn danger',
            onclick: function () { closeModal(); onOk(); }
          }, 'Confirm')
        ])
      ])
    ]);
    openModal('Confirm', body);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.ui = {
    el, clear, escapeHtml,
    toIso, parseIso, today, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
    monthKey, monthLabel, shortDate, longDate, relativeDay, pad,
    openModal, closeModal, toast, confirmDialog,
    statusBadge, domainBadge, impactBadge, tagChips
  };
})();
