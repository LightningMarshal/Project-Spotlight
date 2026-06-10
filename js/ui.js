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

  /* ---------- inline SVG icons ----------
   * Hand-rolled 24×24 stroke icons, same zero-asset approach as the
   * charts: no icon fonts, no external files, CSP-safe. Each icon is a
   * list of path `d` strings drawn with currentColor strokes.
   */
  const ICON_PATHS = {
    home:            ['M3 10.75 12 4l9 6.75', 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5'],
    calendar:        ['M4.5 5.5h15a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z', 'M3.5 9.5h17', 'M8 3v4', 'M16 3v4', 'M8 13.5h.01', 'M12 13.5h.01', 'M16 13.5h.01', 'M8 17h.01', 'M12 17h.01'],
    'calendar-week': ['M4.5 5.5h15a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z', 'M3.5 9.5h17', 'M8 3v4', 'M16 3v4', 'M7.5 14h9'],
    'trending-up':   ['M3 17l6-6 4 4 8-8', 'M14.5 7H21v6.5'],
    'bar-chart':     ['M5 20v-9', 'M12 20V5', 'M19 20v-5'],
    'check-circle':  ['M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z', 'M8.5 12.2l2.4 2.4 4.8-5'],
    sliders:         ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M2 14h4', 'M10 8h4', 'M18 16h4'],
    plus:            ['M12 5v14', 'M5 12h14'],
    search:          ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z', 'M16.2 16.2 21 21'],
    copy:            ['M9.5 9.5h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z', 'M5.5 15h-1a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1H14a1 1 0 0 1 1 1v1']
  };

  function icon(name, size) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const paths = ICON_PATHS[name];
    if (!paths) return document.createTextNode('');
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'icon icon-' + name);
    s.setAttribute('width', size || 15);
    s.setAttribute('height', size || 15);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      s.appendChild(p);
    }
    return s;
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

    const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('div', { class: 'modal-header' }, [
        el('h3', null, title),
        el('button', { class: 'modal-close', title: 'Close', 'aria-label': 'Close dialog', onclick: requestClose }, '×')
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
      if (e.key === 'Escape' && !opts.persistent) { requestClose(); return; }
      /* Focus trap — Tab cycles within the modal instead of escaping to
       * the page underneath. */
      if (e.key === 'Tab') {
        const focusables = modal.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      }
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
    el, clear, icon,
    toIso, parseIso, today, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
    monthKey, monthLabel, shortDate, longDate, relativeDay, pad,
    openModal, closeModal, toast, confirmDialog,
    statusBadge, domainBadge, impactBadge, tagChips
  };
})();
