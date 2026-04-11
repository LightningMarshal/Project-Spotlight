/* Stakeholder visibility view — compile entries relevant to a specific person or context.
 * Output feeds the general export pipeline.
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const filters = window.Uptrack.filters;
  const tax = window.Uptrack.tax;
  const landing = window.Uptrack.views && window.Uptrack.views.landing;

  let state = {
    audience: '',
    filters: (function () {
      const f = filters.emptyFilterState();
      f.status = 'complete';
      return f;
    })()
  };

  async function render(root) {
    ui.clear(root);
    const allEntries = await db.getAllEntries();
    const matched = filters.apply(allEntries, state.filters);

    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Stakeholder view'),
        ui.el('div', { class: 'page-sub' }, 'Compile accomplishments relevant to a specific person or conversation.')
      ])
    ]));

    /* Audience label input */
    const audienceInput = ui.el('input', {
      type: 'text',
      placeholder: 'e.g. "1:1 with VP Eng" or "Peer sync with Security team"',
      value: state.audience || '',
      oninput: function (e) { state.audience = e.target.value; label.textContent = e.target.value || 'No label'; }
    });
    const label = ui.el('span', { class: 'text-faint', style: { fontSize: '12px' } }, state.audience || 'No label');

    root.appendChild(ui.el('div', { class: 'form', style: { padding: '18px 22px', marginBottom: '18px' } }, [
      ui.el('div', { class: 'form-row', style: { marginBottom: 0 } }, [
        ui.el('label', null, 'Audience / context'),
        audienceInput,
        ui.el('div', { class: 'text-faint', style: { fontSize: '11px', marginTop: '6px' } }, 'Used only as a header in the exported document.')
      ])
    ]));

    const panel = filters.renderPanel({
      initial: state.filters,
      showDateRange: true,
      showStatus: true,
      onChange: function (f) { state.filters = f; render(root); }
    });
    root.appendChild(panel.node);

    /* Stats */
    root.appendChild(ui.el('div', { class: 'stats-row' }, [
      stat('Matched', matched.length),
      stat('Critical', matched.filter(function (e) { return e.impact === 'Critical'; }).length),
      stat('High', matched.filter(function (e) { return e.impact === 'High'; }).length)
    ]));

    /* Preview */
    const preview = ui.el('section', { class: 'section' }, [ui.el('h2', { class: 'section-title' }, 'Preview — ' + matched.length)]);
    if (!matched.length) {
      preview.appendChild(ui.el('div', { class: 'empty' }, 'Adjust your filters to surface relevant entries.'));
    } else {
      const list = ui.el('div', { class: 'entry-list' });
      for (const d of tax.DOMAINS) {
        const inDom = matched.filter(function (e) { return e.domain === d; });
        if (!inDom.length) continue;
        list.appendChild(ui.el('div', { class: 'group-heading' }, d + ' — ' + inDom.length));
        inDom.sort(function (a, b) {
          const ra = tax.IMPACT_RANK[a.impact] || 0;
          const rb = tax.IMPACT_RANK[b.impact] || 0;
          if (rb !== ra) return rb - ra;
          return a.date < b.date ? 1 : -1;
        });
        inDom.forEach(function (e) { list.appendChild(landing.renderCard(e, function () { render(root); })); });
      }
      preview.appendChild(list);
    }
    root.appendChild(preview);

    /* Export actions */
    root.appendChild(ui.el('div', { class: 'btn-row', style: { marginTop: '22px' } }, [
      ui.el('button', { class: 'btn primary', onclick: function () {
        const rangeLabel = (state.audience ? 'Audience: ' + state.audience + '  |  ' : '') + filters.describe(state.filters);
        window.Uptrack.export.runGeneralTextExport(matched, state.filters, rangeLabel);
      } }, 'Export text (for AI / review)'),
      ui.el('button', { class: 'btn', onclick: function () {
        window.Uptrack.export.runGeneralCsvExport(matched);
      } }, 'Export CSV'),
      ui.el('button', { class: 'btn', onclick: function () {
        const text = window.Uptrack.export.generalText(matched, state.filters,
          (state.audience ? 'Audience: ' + state.audience : 'Stakeholder view'));
        previewText(text);
      } }, 'Preview text')
    ]));
  }

  function previewText(text) {
    const body = ui.el('div', null, [
      ui.el('pre', { class: 'code' }, text),
      ui.el('div', { class: 'form-actions' }, [
        ui.el('button', { class: 'btn', onclick: async function () {
          try { await navigator.clipboard.writeText(text); ui.toast('Copied to clipboard'); }
          catch (e) { ui.toast('Clipboard unavailable', 'error'); }
        } }, 'Copy to clipboard'),
        ui.el('button', { class: 'btn subtle', onclick: ui.closeModal }, 'Close')
      ])
    ]);
    ui.openModal('Stakeholder export preview', body);
  }

  function stat(label, value) {
    return ui.el('div', { class: 'stat-card' }, [
      ui.el('div', { class: 'label' }, label),
      ui.el('div', { class: 'value' }, value)
    ]);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.views = window.Uptrack.views || {};
  window.Uptrack.views.stakeholder = { render: render };
})();
