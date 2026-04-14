/* Data Review view — consolidated visualizations with Individual Manager View.
 * Shows sentiment trajectory, development themes, and follow-up actions per person.
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const filters = window.Uptrack.filters;
  const charts  = window.Uptrack.charts;

  let state = {
    selectedPerson: '',
    filters: filters.emptyFilterState()
  };

  async function render(root) {
    ui.clear(root);
    var allEntries = await db.getAllEntries();

    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Data Review'),
        ui.el('div', { class: 'page-sub' }, 'Consolidated visualizations and individual manager view')
      ])
    ]));

    /* Filters */
    var panel = filters.renderPanel({
      initial: state.filters,
      showDateRange: true,
      showStatus: true,
      onChange: function (f) { state.filters = f; updateContent(); }
    });
    root.appendChild(panel.node);

    var content = ui.el('div', null);
    root.appendChild(content);

    function updateContent() {
      ui.clear(content);
      var matched = filters.apply(allEntries, state.filters);

      /* Global stats */
      var complete = matched.filter(function (e) { return e.status === 'complete'; });
      var criticals = matched.filter(function (e) { return e.impact === 'Critical'; });
      var highs = matched.filter(function (e) { return e.impact === 'High'; });
      var pmCount = matched.filter(function (e) { return e.domain === 'People Management'; });

      content.appendChild(ui.el('div', { class: 'stats-row' }, [
        stat('Total', matched.length),
        stat('Completed', complete.length),
        stat('Critical', criticals.length),
        stat('High', highs.length),
        stat('People Mgmt', pmCount.length)
      ]));

      /* Charts grid */
      content.appendChild(ui.el('h2', { class: 'section-title' }, 'Overview charts'));
      var grid = ui.el('div', { class: 'charts-grid' });
      grid.appendChild(chartCard('Volume over time', charts.lineChart(charts.volumeOverTime(matched, 'month'))));
      grid.appendChild(chartCard('Entries by domain', charts.barChart(charts.byDomain(matched))));
      grid.appendChild(chartCard('Impact by domain', charts.stackedBarChart(charts.impactByDomain(matched))));
      grid.appendChild(chartCard('Impact distribution', charts.barChart(charts.byImpact(matched))));
      grid.appendChild(chartCard('Company values', charts.horizontalBarChart(charts.tagFrequency(matched, 'values'))));
      grid.appendChild(chartCard('Culture tenets', charts.horizontalBarChart(charts.tagFrequency(matched, 'tenets'))));
      grid.appendChild(chartCard('Principles', charts.horizontalBarChart(charts.tagFrequency(matched, 'principles'))));
      grid.appendChild(chartCard('Taxonomy gaps', charts.gapIndicator(charts.gapData(matched))));
      content.appendChild(grid);

      /* Individual Manager View */
      content.appendChild(ui.el('h2', { class: 'section-title', style: { marginTop: '30px' } }, 'Individual Manager View'));
      content.appendChild(renderIndividualView(matched));
    }

    updateContent();
  }

  function renderIndividualView(entries) {
    /* Collect all individuals from entries */
    var individuals = {};
    entries.forEach(function (e) {
      if (e.individual && (e.domain === 'People Management' || e.domain === 'Client Facing')) {
        if (!individuals[e.individual]) individuals[e.individual] = [];
        individuals[e.individual].push(e);
      }
    });

    var names = Object.keys(individuals).sort();
    if (!names.length) {
      return ui.el('div', { class: 'empty' }, 'No entries with individuals assigned. Use the People Management or Client Facing domain and select an individual to populate this view.');
    }

    var container = ui.el('div', null);

    /* Person selector */
    var personSelect = ui.el('select', {
      style: { marginBottom: '18px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' },
      onchange: function (e) {
        state.selectedPerson = e.target.value;
        renderPersonDetail();
      }
    }, [
      ui.el('option', { value: '' }, 'Select a person…'),
      ...names.map(function (n) {
        return ui.el('option', { value: n, selected: state.selectedPerson === n }, n + ' (' + individuals[n].length + ')');
      })
    ]);
    container.appendChild(personSelect);

    var detailContainer = ui.el('div', null);
    container.appendChild(detailContainer);

    function renderPersonDetail() {
      ui.clear(detailContainer);
      var person = state.selectedPerson;
      if (!person || !individuals[person]) return;

      var personEntries = individuals[person].slice();
      personEntries.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

      /* Stats */
      detailContainer.appendChild(ui.el('div', { class: 'stats-row' }, [
        stat('Interactions', personEntries.length),
        stat('Follow-ups', personEntries.filter(function (e) { return e.followUpAction; }).length),
        stat('Open actions', personEntries.filter(function (e) { return e.followUpAction && !e.followUpDismissed; }).length)
      ]));

      var grid = ui.el('div', { class: 'charts-grid' });

      /* Sentiment trajectory */
      var sentimentMap = { 'Very Positive': 5, 'Positive': 4, 'Neutral': 3, 'Negative': 2, 'Very Negative': 1,
                           'Very Satisfied': 5, 'Satisfied': 4, 'Dissatisfied': 2, 'Very Dissatisfied': 1 };
      var sentimentData = personEntries
        .filter(function (e) { return e.sentiment || e.customerSentiment; })
        .reverse()
        .map(function (e) {
          var s = e.sentiment || e.customerSentiment;
          return { label: ui.shortDate(e.date), value: sentimentMap[s] || 3 };
        });

      if (sentimentData.length) {
        grid.appendChild(chartCard('Sentiment trajectory', charts.lineChart(sentimentData, { height: 180 })));
      }

      /* Development themes */
      var themeData = {};
      personEntries.forEach(function (e) {
        if (e.developmentTheme) themeData[e.developmentTheme] = (themeData[e.developmentTheme] || 0) + 1;
      });
      if (Object.keys(themeData).length) {
        var themeItems = Object.keys(themeData).map(function (k) { return { label: k, value: themeData[k] }; });
        themeItems.sort(function (a, b) { return b.value - a.value; });
        grid.appendChild(chartCard('Development themes', charts.horizontalBarChart(themeItems, { rowH: 22 })));
      }

      /* Interaction types */
      var typeData = {};
      personEntries.forEach(function (e) {
        if (e.interactionType) typeData[e.interactionType] = (typeData[e.interactionType] || 0) + 1;
      });
      if (Object.keys(typeData).length) {
        var typeItems = Object.keys(typeData).map(function (k) { return { label: k, value: typeData[k] }; });
        typeItems.sort(function (a, b) { return b.value - a.value; });
        grid.appendChild(chartCard('Interaction types', charts.horizontalBarChart(typeItems, { rowH: 22 })));
      }

      detailContainer.appendChild(grid);

      /* Follow-up actions list */
      var followUps = personEntries.filter(function (e) { return e.followUpAction; });
      if (followUps.length) {
        detailContainer.appendChild(ui.el('h3', { style: { margin: '20px 0 10px', fontSize: '13px', color: 'var(--text-dim)' } }, 'Follow-up actions — ' + followUps.length));
        var fuList = ui.el('div', { class: 'entry-list' });
        followUps.forEach(function (e) {
          var overdue = e.followUpTargetDate && e.followUpTargetDate < db.todayIso() && !e.followUpDismissed;
          fuList.appendChild(ui.el('div', { class: 'followup-card' + (overdue ? ' overdue' : '') + (e.followUpDismissed ? ' dismissed' : '') }, [
            ui.el('div', { class: 'fu-header' }, [
              ui.el('div', { class: 'fu-title' }, e.followUpAction),
              ui.el('div', { class: 'fu-date' }, e.followUpTargetDate || 'No target date')
            ]),
            e.followUpDescription ? ui.el('div', { class: 'fu-meta' }, e.followUpDescription) : null,
            ui.el('div', { class: 'fu-meta' }, [
              ui.el('span', null, 'From: ' + e.title),
              ui.el('span', null, ' — ' + e.date)
            ])
          ]));
        });
        detailContainer.appendChild(fuList);
      }

      /* Recent entries */
      detailContainer.appendChild(ui.el('h3', { style: { margin: '20px 0 10px', fontSize: '13px', color: 'var(--text-dim)' } }, 'Recent entries — ' + personEntries.length));
      var entryList = ui.el('div', { class: 'entry-list' });
      personEntries.slice(0, 20).forEach(function (e) {
        entryList.appendChild(window.Uptrack.views.landing.renderCard(e, function () {}));
      });
      if (personEntries.length > 20) {
        entryList.appendChild(ui.el('div', { class: 'text-faint', style: { fontSize: '11px', padding: '8px 4px' } },
          '…and ' + (personEntries.length - 20) + ' more'));
      }
      detailContainer.appendChild(entryList);
    }

    if (state.selectedPerson && individuals[state.selectedPerson]) {
      renderPersonDetail();
    }

    return container;
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
  window.Uptrack.views.datareview = { render: render };
})();
