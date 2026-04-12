/* Monthly view: people management log (persistent + always open), charts, and entries. */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const filters = window.Uptrack.filters;
  const charts  = window.Uptrack.charts;
  const landing = window.Uptrack.views && window.Uptrack.views.landing;

  let state = {
    anchor: ui.startOfMonth(ui.today()),
    filters: filters.emptyFilterState(),
    pmlSaveTimer: null
  };

  async function render(root) {
    ui.clear(root);
    const allEntries = await db.getAllEntries();

    const monthStart = ui.startOfMonth(state.anchor);
    const monthEnd   = ui.endOfMonth(state.anchor);
    const monthK = ui.monthKey(state.anchor);

    /* Header */
    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, ui.monthLabel(monthStart)),
        ui.el('div', { class: 'page-sub' }, 'Monthly view with people management log')
      ]),
      ui.el('div', { class: 'btn-row' }, [
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = offsetMonth(state.anchor, -1); render(root); } }, '← Previous'),
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = ui.startOfMonth(ui.today()); render(root); } }, 'This month'),
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = offsetMonth(state.anchor, 1); render(root); } }, 'Next →')
      ])
    ]));

    /* People management log — always open, prominent at the top of the month view */
    const existing = await db.getPeopleLog(monthK);
    const pml = existing || tax.emptyPeopleLog(monthK);
    root.appendChild(renderPeopleLog(pml, monthK));

    /* Filters for entries */
    const panel = filters.renderPanel({
      initial: state.filters,
      showStatus: true,
      onChange: function (f) { state.filters = f; updateContent(); }
    });
    root.appendChild(panel.node);

    /* Dynamic content container — rebuilt on filter change without destroying the filter panel */
    const content = ui.el('div', null);
    root.appendChild(content);

    function updateContent() {
      ui.clear(content);
      var ms = ui.startOfMonth(state.anchor);
      var me = ui.endOfMonth(state.anchor);
      var fromIso = ui.toIso(ms);
      var toIso   = ui.toIso(me);
      var monthFilters = Object.assign({}, state.filters, { dateFrom: fromIso, dateTo: toIso });
      var monthEntries = filters.apply(allEntries, monthFilters);

      /* Charts */
      content.appendChild(ui.el('h2', { class: 'section-title' }, 'This month at a glance'));
      content.appendChild(renderMonthCharts(monthEntries));

      /* Export controls */
      content.appendChild(ui.el('div', { class: 'btn-row', style: { margin: '18px 0' } }, [
        ui.el('button', { class: 'btn', onclick: function () {
          window.Uptrack.export.runGeneralTextExport(monthEntries, monthFilters, ui.monthLabel(ms));
        } }, 'Export month (text)'),
        ui.el('button', { class: 'btn', onclick: function () {
          window.Uptrack.export.runGeneralCsvExport(monthEntries);
        } }, 'Export month (CSV)')
      ]));

      /* Entries list grouped */
      var section = ui.el('section', { class: 'section' }, [
        ui.el('h2', { class: 'section-title' }, 'Entries — ' + monthEntries.length)
      ]);
      if (!monthEntries.length) {
        section.appendChild(ui.el('div', { class: 'empty' }, 'No entries this month.'));
      } else {
        for (var di = 0; di < tax.DOMAINS.length; di++) {
          var d = tax.DOMAINS[di];
          var inDom = monthEntries.filter(function (e) { return e.domain === d; });
          if (!inDom.length) continue;
          section.appendChild(ui.el('div', { class: 'group-heading' }, d + '  (' + inDom.length + ')'));
          var list = ui.el('div', { class: 'entry-list' });
          inDom.forEach(function (e) { list.appendChild(landing.renderCard(e, function () { render(root); })); });
          section.appendChild(list);
        }
      }
      content.appendChild(section);
    }

    updateContent();
  }

  function offsetMonth(d, months) {
    return new Date(d.getFullYear(), d.getMonth() + months, 1);
  }

  function renderPeopleLog(pml, monthK) {
    const container = ui.el('div', { class: 'pml' });
    container.appendChild(ui.el('h3', null, 'People management log — ' + ui.monthLabel(new Date(monthK + '-01'))));
    container.appendChild(ui.el('div', { class: 'pml-sub' }, 'Stays open throughout the month. Save progressively as you go — no need to finish in one sitting.'));

    const grid = ui.el('div', { class: 'pml-grid' });
    tax.PEOPLE_METRICS.forEach(function (m) {
      const metric = pml.metrics[m.key] || { count: 0, notes: '' };
      const countInput = ui.el('input', {
        type: 'number',
        min: '0',
        value: metric.count || 0,
        oninput: function (e) {
          pml.metrics[m.key] = pml.metrics[m.key] || { count: 0, notes: '' };
          pml.metrics[m.key].count = parseInt(e.target.value, 10) || 0;
          scheduleAutosave(pml, monthK);
        }
      });
      const notesInput = ui.el('textarea', {
        placeholder: 'Qualitative context, names, outcomes…',
        oninput: function (e) {
          pml.metrics[m.key] = pml.metrics[m.key] || { count: 0, notes: '' };
          pml.metrics[m.key].notes = e.target.value;
          scheduleAutosave(pml, monthK);
        }
      }, metric.notes || '');
      grid.appendChild(ui.el('div', { class: 'pml-metric' }, [
        ui.el('label', null, m.label),
        ui.el('div', { class: 'pml-metric-row' }, [
          ui.el('span', { class: 'text-faint', style: { fontSize: '10px' } }, 'COUNT'),
          countInput
        ]),
        notesInput
      ]));
    });
    container.appendChild(grid);

    container.appendChild(ui.el('div', { class: 'pml-actions' }, [
      ui.el('span', { class: 'text-faint', style: { fontSize: '11px' } }, pml.updatedAt ? 'Last saved ' + new Date(pml.updatedAt).toLocaleString() : 'Not yet saved'),
      ui.el('button', { class: 'btn', onclick: async function () {
        pml.month = monthK;
        await db.savePeopleLog(pml);
        ui.toast('People log saved');
      } }, 'Save now')
    ]));
    return container;
  }

  function scheduleAutosave(pml, monthK) {
    if (state.pmlSaveTimer) clearTimeout(state.pmlSaveTimer);
    state.pmlSaveTimer = setTimeout(async function () {
      pml.month = monthK;
      await db.savePeopleLog(pml);
    }, 700);
  }

  function renderMonthCharts(entries) {
    const grid = ui.el('div', { class: 'charts-grid' });

    grid.appendChild(chartCard('Volume by day', charts.lineChart(charts.volumeOverTime(entries, 'day'))));
    grid.appendChild(chartCard('Entries by domain', charts.barChart(charts.byDomain(entries))));
    grid.appendChild(chartCard('Impact by domain (stacked)', charts.stackedBarChart(charts.impactByDomain(entries))));
    grid.appendChild(chartCard('Impact distribution', charts.barChart(charts.byImpact(entries))));
    grid.appendChild(chartCard('Company values — frequency', charts.horizontalBarChart(charts.tagFrequency(entries, 'values'))));
    grid.appendChild(chartCard('Culture tenets — frequency', charts.horizontalBarChart(charts.tagFrequency(entries, 'tenets'))));
    grid.appendChild(chartCard('Principles — frequency', charts.horizontalBarChart(charts.tagFrequency(entries, 'principles'))));
    grid.appendChild(chartCard('Taxonomy gap indicator', charts.gapIndicator(charts.gapData(entries))));

    return grid;
  }

  function chartCard(title, content) {
    return ui.el('div', { class: 'chart-card' }, [
      ui.el('h4', null, title),
      content
    ]);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.views = window.Uptrack.views || {};
  window.Uptrack.views.monthly = { render: render };
})();
