/* Monthly view: auto-aggregated people management summary, charts, and entries. */
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
    reflectionTimer: null
  };

  async function render(root) {
    ui.clear(root);
    const allEntries = await db.getAllEntries();

    const monthStart = ui.startOfMonth(state.anchor);
    const monthEnd   = ui.endOfMonth(state.anchor);
    const monthK = ui.monthKey(state.anchor);
    const fromIso = ui.toIso(monthStart);
    const toIso   = ui.toIso(monthEnd);

    /* Get all entries for this month (unfiltered) for aggregation */
    const monthAllEntries = allEntries.filter(function (e) {
      return e.date >= fromIso && e.date <= toIso;
    });

    /* Header */
    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, ui.monthLabel(monthStart)),
        ui.el('div', { class: 'page-sub' }, 'Monthly view with auto-aggregated people management summary')
      ]),
      ui.el('div', { class: 'btn-row' }, [
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = offsetMonth(state.anchor, -1); render(root); } }, '← Previous'),
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = ui.startOfMonth(ui.today()); render(root); } }, 'This month'),
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = offsetMonth(state.anchor, 1); render(root); } }, 'Next →')
      ])
    ]));

    /* Auto-aggregated people management summary */
    const existing = await db.getPeopleLog(monthK);
    root.appendChild(renderPeopleAggregate(monthAllEntries, existing, monthK));

    /* Filters for entries */
    const panel = filters.renderPanel({
      initial: state.filters,
      showStatus: true,
      onChange: function (f) { state.filters = f; updateContent(); }
    });
    root.appendChild(panel.node);

    /* Dynamic content container */
    const content = ui.el('div', null);
    root.appendChild(content);

    function updateContent() {
      ui.clear(content);
      var ms = ui.startOfMonth(state.anchor);
      var me = ui.endOfMonth(state.anchor);
      var fi = ui.toIso(ms);
      var ti = ui.toIso(me);
      var monthFilters = Object.assign({}, state.filters, { dateFrom: fi, dateTo: ti });
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

  /* Auto-aggregate People Management entries for the month */
  function renderPeopleAggregate(monthEntries, existingLog, monthK) {
    var pmEntries = monthEntries.filter(function (e) { return e.domain === 'People Management'; });

    /* Aggregate stats */
    var stats = {
      totalInteractions: pmEntries.length,
      byType: {},
      byIndividual: {},
      bySentiment: {},
      byTheme: {},
      followUps: 0,
      followUpsOpen: 0
    };

    pmEntries.forEach(function (e) {
      if (e.interactionType) stats.byType[e.interactionType] = (stats.byType[e.interactionType] || 0) + 1;
      if (e.individual) stats.byIndividual[e.individual] = (stats.byIndividual[e.individual] || 0) + 1;
      if (e.sentiment) stats.bySentiment[e.sentiment] = (stats.bySentiment[e.sentiment] || 0) + 1;
      if (e.developmentTheme) stats.byTheme[e.developmentTheme] = (stats.byTheme[e.developmentTheme] || 0) + 1;
      if (e.followUpAction) {
        stats.followUps++;
        if (!e.followUpDismissed) stats.followUpsOpen++;
      }
    });

    var container = ui.el('div', { class: 'pml' });
    container.appendChild(ui.el('h3', null, 'People management — ' + ui.monthLabel(new Date(monthK + '-01'))));
    container.appendChild(ui.el('div', { class: 'pml-sub' }, 'Auto-aggregated from ' + pmEntries.length + ' People Management entries this month.'));

    if (!pmEntries.length) {
      container.appendChild(ui.el('div', { class: 'empty', style: { margin: '12px 0' } }, 'No People Management entries this month. Tag entries with the People Management domain to populate this summary.'));
    } else {
      /* Stats row */
      container.appendChild(ui.el('div', { class: 'stats-row', style: { marginBottom: '16px' } }, [
        aggStat('Interactions', stats.totalInteractions),
        aggStat('Individuals', Object.keys(stats.byIndividual).length),
        aggStat('Follow-ups', stats.followUps),
        aggStat('Open actions', stats.followUpsOpen)
      ]));

      /* Breakdowns in a grid */
      var grid = ui.el('div', { class: 'charts-grid', style: { marginBottom: '16px' } });
      if (Object.keys(stats.byType).length) {
        grid.appendChild(aggChartCard('By interaction type', stats.byType));
      }
      if (Object.keys(stats.byIndividual).length) {
        grid.appendChild(aggChartCard('By individual', stats.byIndividual));
      }
      if (Object.keys(stats.bySentiment).length) {
        grid.appendChild(aggChartCard('By sentiment', stats.bySentiment));
      }
      if (Object.keys(stats.byTheme).length) {
        grid.appendChild(aggChartCard('By development theme', stats.byTheme));
      }
      container.appendChild(grid);
    }

    /* Monthly reflection textarea — persisted in peopleLogs */
    var reflection = (existingLog && existingLog.reflection) || '';
    var reflectionArea = ui.el('textarea', {
      placeholder: 'Monthly reflection — themes, patterns, priorities for next month…',
      style: { width: '100%', minHeight: '80px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '10px 12px', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px' },
      oninput: function (e) {
        if (state.reflectionTimer) clearTimeout(state.reflectionTimer);
        state.reflectionTimer = setTimeout(async function () {
          var log = (await db.getPeopleLog(monthK)) || tax.emptyPeopleLog(monthK);
          log.reflection = e.target.value;
          log.month = monthK;
          await db.savePeopleLog(log);
        }, 700);
      }
    }, reflection);

    container.appendChild(ui.el('div', { style: { marginTop: '12px' } }, [
      ui.el('label', { style: { display: 'block', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: '7px' } }, 'Monthly Reflection'),
      reflectionArea
    ]));

    return container;
  }

  function aggStat(label, value) {
    return ui.el('div', { class: 'stat-card' }, [
      ui.el('div', { class: 'label' }, label),
      ui.el('div', { class: 'value' }, value)
    ]);
  }

  function aggChartCard(title, data) {
    var items = Object.keys(data).map(function (k) { return { label: k, value: data[k] }; });
    items.sort(function (a, b) { return b.value - a.value; });
    return ui.el('div', { class: 'chart-card' }, [
      ui.el('h4', null, title),
      charts.horizontalBarChart(items, { rowH: 22 })
    ]);
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
