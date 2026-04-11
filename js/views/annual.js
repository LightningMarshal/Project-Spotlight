/* Annual view — full calendar year with charts, stats, monthly rollup,
 * and people management log summary across the year.
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const filters = window.Uptrack.filters;
  const charts  = window.Uptrack.charts;

  let state = {
    year: new Date().getFullYear(),
    filters: filters.emptyFilterState()
  };

  async function render(root) {
    ui.clear(root);

    const [allEntries, allLogs] = await Promise.all([
      db.getAllEntries(),
      db.getAllPeopleLogs()
    ]);

    const yearStart = new Date(state.year, 0, 1);
    const yearEnd   = new Date(state.year, 11, 31);
    const fromIso = ui.toIso(yearStart);
    const toIso   = ui.toIso(yearEnd);

    const yearFilters = Object.assign({}, state.filters, { dateFrom: fromIso, dateTo: toIso });
    const yearEntries = filters.apply(allEntries, yearFilters);
    const yearLogs = allLogs.filter(function (l) { return l.month.startsWith(state.year + '-'); });

    /* Header */
    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, state.year + ' — annual overview'),
        ui.el('div', { class: 'page-sub' }, 'Full calendar year')
      ]),
      ui.el('div', { class: 'btn-row' }, [
        ui.el('button', { class: 'btn small', onclick: function () { state.year -= 1; render(root); } }, '← ' + (state.year - 1)),
        ui.el('button', { class: 'btn small', onclick: function () { state.year = new Date().getFullYear(); render(root); } }, 'This year'),
        ui.el('button', { class: 'btn small', onclick: function () { state.year += 1; render(root); } }, (state.year + 1) + ' →')
      ])
    ]));

    /* Stats */
    const complete = yearEntries.filter(function (e) { return e.status === 'complete'; });
    const criticals = yearEntries.filter(function (e) { return e.impact === 'Critical'; });
    const highs     = yearEntries.filter(function (e) { return e.impact === 'High'; });
    root.appendChild(ui.el('div', { class: 'stats-row' }, [
      stat('Total entries', yearEntries.length),
      stat('Completed', complete.length),
      stat('Critical impact', criticals.length),
      stat('High impact', highs.length),
      stat('People logs', yearLogs.length)
    ]));

    /* Filters */
    const panel = filters.renderPanel({
      initial: state.filters,
      showStatus: true,
      onChange: function (f) { state.filters = f; render(root); }
    });
    root.appendChild(panel.node);

    /* Charts */
    const grid = ui.el('div', { class: 'charts-grid' });
    grid.appendChild(chartCard('Volume by month', charts.lineChart(charts.volumeOverTime(yearEntries, 'month'))));
    grid.appendChild(chartCard('Entries by domain', charts.barChart(charts.byDomain(yearEntries))));
    grid.appendChild(chartCard('Impact by domain (stacked)', charts.stackedBarChart(charts.impactByDomain(yearEntries))));
    grid.appendChild(chartCard('Impact distribution', charts.barChart(charts.byImpact(yearEntries))));
    grid.appendChild(chartCard('Company values — frequency', charts.horizontalBarChart(charts.tagFrequency(yearEntries, 'values'))));
    grid.appendChild(chartCard('Culture tenets — frequency', charts.horizontalBarChart(charts.tagFrequency(yearEntries, 'tenets'))));
    grid.appendChild(chartCard('Principles — frequency', charts.horizontalBarChart(charts.tagFrequency(yearEntries, 'principles'))));
    grid.appendChild(chartCard('Taxonomy gap indicator', charts.gapIndicator(charts.gapData(yearEntries))));
    root.appendChild(grid);

    /* Monthly rollup */
    const rollup = ui.el('section', { class: 'section' }, [ui.el('h2', { class: 'section-title' }, 'Month by month')]);
    const monthly = rollupByMonth(yearEntries);
    for (let m = 0; m < 12; m++) {
      const label = new Date(state.year, m, 1).toLocaleDateString(undefined, { month: 'long' });
      const items = monthly[m] || [];
      rollup.appendChild(ui.el('div', { class: 'group-heading' }, label + '  (' + items.length + ')'));
      if (!items.length) {
        rollup.appendChild(ui.el('div', { class: 'text-faint', style: { fontSize: '12px', paddingLeft: '4px' } }, 'no entries'));
      } else {
        for (const d of tax.DOMAINS) {
          const dItems = items.filter(function (e) { return e.domain === d; });
          if (!dItems.length) continue;
          rollup.appendChild(ui.el('div', { class: 'subgroup-heading' }, d + ' — ' + dItems.length));
        }
      }
    }
    root.appendChild(rollup);

    /* People logs summary */
    if (yearLogs.length) {
      const pls = ui.el('section', { class: 'section' }, [ui.el('h2', { class: 'section-title' }, 'People management — ' + state.year)]);
      const totals = {};
      tax.PEOPLE_METRICS.forEach(function (m) { totals[m.key] = 0; });
      yearLogs.forEach(function (l) {
        Object.keys(l.metrics || {}).forEach(function (k) {
          totals[k] = (totals[k] || 0) + ((l.metrics[k] && l.metrics[k].count) || 0);
        });
      });
      const data = tax.PEOPLE_METRICS.map(function (m) {
        return { label: m.label, value: totals[m.key] || 0 };
      });
      pls.appendChild(chartCard('Year totals', charts.horizontalBarChart(data, { rowH: 24 })));
      root.appendChild(pls);
    }

    /* Export */
    root.appendChild(ui.el('div', { class: 'btn-row', style: { marginTop: '20px' } }, [
      ui.el('button', { class: 'btn', onclick: function () {
        window.Uptrack.export.runGeneralTextExport(yearEntries, yearFilters, state.year + ' (full year)');
      } }, 'Export year (text)'),
      ui.el('button', { class: 'btn', onclick: function () {
        window.Uptrack.export.runGeneralCsvExport(yearEntries);
      } }, 'Export year (CSV)')
    ]));
  }

  function rollupByMonth(entries) {
    const byMonth = {};
    entries.forEach(function (e) {
      const d = ui.parseIso(e.date);
      const m = d.getMonth();
      (byMonth[m] = byMonth[m] || []).push(e);
    });
    return byMonth;
  }

  function stat(label, value) {
    return ui.el('div', { class: 'stat-card' }, [
      ui.el('div', { class: 'label' }, label),
      ui.el('div', { class: 'value' }, value)
    ]);
  }

  function chartCard(title, content) {
    return ui.el('div', { class: 'chart-card' }, [
      ui.el('h4', null, title),
      content
    ]);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.views = window.Uptrack.views || {};
  window.Uptrack.views.annual = { render: render };
})();
