/* Filter engine — central place to apply search / domain / impact / tags / date filters
 * to an entry list. Used by every view and the export pipeline.
 */
(function () {
  'use strict';

  function emptyFilterState() {
    return {
      search: '',
      domain: '',           // '' = all, otherwise one of DOMAINS
      impact: '',           // '' = all, otherwise one of IMPACT_LEVELS
      status: 'all',        // 'all' | 'draft' | 'complete'
      values: [],           // active company values
      tenets: [],           // active culture tenets
      principles: [],       // active principles
      dateFrom: '',         // ISO 'YYYY-MM-DD' inclusive
      dateTo: ''            // ISO 'YYYY-MM-DD' inclusive
    };
  }

  function matches(entry, f) {
    if (!f) return true;

    if (f.domain && entry.domain !== f.domain) return false;
    if (f.impact && entry.impact !== f.impact) return false;

    if (f.status && f.status !== 'all' && entry.status !== f.status) return false;

    if (f.dateFrom && entry.date < f.dateFrom) return false;
    if (f.dateTo && entry.date > f.dateTo) return false;

    if (f.search && f.search.trim()) {
      const q = f.search.trim().toLowerCase();
      const hay = (entry.title + ' ' + (entry.description || '') + ' ' +
        (entry.individual || '') + ' ' + (entry.companyName || '') + ' ' +
        (entry.followUpAction || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }

    // Tag filters: AND across taxonomies, OR within each taxonomy.
    // (i.e. entry must have at least one of the selected values, AND at least one of the selected tenets, etc.)
    const tags = entry.tags || { values: [], tenets: [], principles: [] };
    if (f.values && f.values.length) {
      if (!f.values.some(function (t) { return (tags.values || []).indexOf(t) !== -1; })) return false;
    }
    if (f.tenets && f.tenets.length) {
      if (!f.tenets.some(function (t) { return (tags.tenets || []).indexOf(t) !== -1; })) return false;
    }
    if (f.principles && f.principles.length) {
      if (!f.principles.some(function (t) { return (tags.principles || []).indexOf(t) !== -1; })) return false;
    }

    return true;
  }

  function apply(entries, filters) {
    return (entries || []).filter(function (e) { return matches(e, filters); });
  }

  function isActive(filters) {
    if (!filters) return false;
    const f = filters;
    return !!(
      (f.search && f.search.trim()) ||
      f.domain || f.impact ||
      (f.status && f.status !== 'all') ||
      (f.values && f.values.length) ||
      (f.tenets && f.tenets.length) ||
      (f.principles && f.principles.length) ||
      f.dateFrom || f.dateTo
    );
  }

  function describe(filters) {
    if (!isActive(filters)) return 'No filters active';
    const parts = [];
    if (filters.search)    parts.push('search="' + filters.search + '"');
    if (filters.domain)    parts.push('domain=' + filters.domain);
    if (filters.impact)    parts.push('impact=' + filters.impact);
    if (filters.status && filters.status !== 'all') parts.push('status=' + filters.status);
    if (filters.values && filters.values.length)       parts.push('values=[' + filters.values.join(', ') + ']');
    if (filters.tenets && filters.tenets.length)       parts.push('tenets=[' + filters.tenets.join(', ') + ']');
    if (filters.principles && filters.principles.length) parts.push('principles=[' + filters.principles.join(', ') + ']');
    if (filters.dateFrom)  parts.push('from=' + filters.dateFrom);
    if (filters.dateTo)    parts.push('to=' + filters.dateTo);
    return parts.join(' · ');
  }

  /* ---------- Renders a reusable filter panel and returns the current state. ----------
   * opts:
   *   initial         — initial filter state
   *   showDateRange   — bool, show date range inputs
   *   showStatus      — bool, show status selector
   *   onChange(state) — callback whenever filters change
   */
  function renderPanel(opts) {
    opts = opts || {};
    const ui = window.Uptrack.ui;
    const tax = window.Uptrack.tax;
    const state = Object.assign(emptyFilterState(), opts.initial || {});

    function emit() { if (opts.onChange) opts.onChange(Object.assign({}, state)); }

    const searchInput = ui.el('input', {
      type: 'text',
      placeholder: 'Search titles, descriptions, people, companies…',
      value: state.search || '',
      oninput: function (e) { state.search = e.target.value; emit(); }
    });

    const domainSel = ui.el('select', {
      onchange: function (e) { state.domain = e.target.value; emit(); }
    }, [
      ui.el('option', { value: '' }, 'All domains'),
      ...tax.DOMAINS.map(function (d) {
        return ui.el('option', { value: d, selected: state.domain === d }, d);
      })
    ]);

    const impactSel = ui.el('select', {
      onchange: function (e) { state.impact = e.target.value; emit(); }
    }, [
      ui.el('option', { value: '' }, 'All impact'),
      ...tax.IMPACT_LEVELS.map(function (i) {
        return ui.el('option', { value: i, selected: state.impact === i }, i);
      })
    ]);

    const statusSel = opts.showStatus ? ui.el('select', {
      onchange: function (e) { state.status = e.target.value; emit(); }
    }, [
      ui.el('option', { value: 'all',      selected: state.status === 'all' }, 'All statuses'),
      ui.el('option', { value: 'complete', selected: state.status === 'complete' }, 'Complete'),
      ui.el('option', { value: 'draft',    selected: state.status === 'draft' }, 'Drafts')
    ]) : null;

    const dateRow = opts.showDateRange ? ui.el('div', null, [
      ui.el('label', null, 'From'),
      ui.el('input', {
        type: 'date',
        value: state.dateFrom || '',
        onchange: function (e) { state.dateFrom = e.target.value; emit(); }
      }),
      ui.el('label', null, 'To'),
      ui.el('input', {
        type: 'date',
        value: state.dateTo || '',
        onchange: function (e) { state.dateTo = e.target.value; emit(); }
      })
    ]) : null;

    function tagRow(taxKey) {
      const spec = tax.TAXONOMIES[taxKey];
      const chips = spec.items.map(function (item) {
        const active = (state[taxKey] || []).indexOf(item) !== -1;
        return ui.el('button', {
          type: 'button',
          class: 'tag-toggle' + (active ? ' active' : ''),
          'data-tax': taxKey,
          onclick: function (e) {
            const arr = state[taxKey] = (state[taxKey] || []).slice();
            const idx = arr.indexOf(item);
            if (idx === -1) arr.push(item); else arr.splice(idx, 1);
            e.currentTarget.classList.toggle('active');
            emit();
          }
        }, item);
      });
      return ui.el('div', { class: 'filter-tag-row' }, [
        ui.el('span', { class: 'fl-label' }, spec.short),
        ...chips
      ]);
    }

    const resetBtn = ui.el('button', {
      class: 'btn small subtle',
      onclick: function () {
        Object.assign(state, emptyFilterState());
        if (opts.onChange) opts.onChange(state);
        // re-render by calling back out to the host view — here we just refresh the panel inputs:
        searchInput.value = '';
        domainSel.value = '';
        impactSel.value = '';
        if (statusSel) statusSel.value = 'all';
        if (dateRow) {
          const [fromInput, toInput] = dateRow.querySelectorAll('input');
          fromInput.value = ''; toInput.value = '';
        }
        panel.querySelectorAll('.tag-toggle.active').forEach(function (b) { b.classList.remove('active'); });
      }
    }, 'Reset');

    const row1Children = [
      ui.el('div', null, [ui.el('label', null, 'Search'), searchInput]),
      ui.el('div', null, [ui.el('label', null, 'Domain'), domainSel]),
      ui.el('div', null, [ui.el('label', null, 'Impact'), impactSel])
    ];
    if (statusSel) row1Children.push(ui.el('div', null, [ui.el('label', null, 'Status'), statusSel]));
    if (dateRow) row1Children.push(dateRow);
    row1Children.push(ui.el('div', { class: 'grow', style: { textAlign: 'right' } }, resetBtn));

    const panel = ui.el('div', { class: 'filters' }, [
      ui.el('div', { class: 'filters-row' }, row1Children),
      ui.el('div', { class: 'filter-tag-rows' }, [
        tagRow('values'),
        tagRow('tenets'),
        tagRow('principles')
      ])
    ]);

    return { node: panel, state: state };
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.filters = {
    emptyFilterState, matches, apply, isActive, describe, renderPanel
  };
})();
