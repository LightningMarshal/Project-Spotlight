/* Data Review — widget-based dashboard.
 *
 * The page is composed of independently toggleable widgets. Each widget
 * responds to the shared filter bar at the top. Visibility preferences
 * persist to the `settings` object store under key `dataReviewWidgets`,
 * so the layout a user tunes survives reloads and machine migrations
 * (the settings store is included in full backups as of v2.12.0).
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const filters = window.Uptrack.filters;
  const charts  = window.Uptrack.charts;

  const SETTINGS_KEY = 'dataReviewWidgets';

  /* Widget registry — laid out in a two-column grid; `wide: true` widgets
   * span both columns (hero panels and anything with its own sub-layout).
   * `render(ctx)` returns a DOM node; ctx = { matched, allEntries, state, refresh }. */
  const WIDGETS = [
    { id: 'summary',      title: 'Summary statistics',                 render: renderSummary,            wide: true },
    { id: 'domainTime',   title: 'Domain distribution over time',      render: renderDomainOverTime },
    { id: 'impactDomain', title: 'Cross-dimensional: impact by domain', render: renderImpactByDomain },
    { id: 'values',       title: 'Company values alignment',           render: renderValuesAlignment },
    { id: 'tenets',       title: 'Culture tenets alignment',           render: renderTenetsAlignment },
    { id: 'principles',   title: 'Principles alignment',               render: renderPrinciplesAlignment },
    { id: 'impactTime',   title: 'Impact quality over time',           render: renderImpactQuality },
    { id: 'gap',          title: 'Taxonomy gap indicator',             render: renderGap },
    { id: 'visibility',   title: 'Visibility index',                   render: renderVisibility,         wide: true },
    { id: 'period',       title: 'Period comparison',                  render: renderPeriod,             wide: true },
    { id: 'individual',   title: 'Individual manager view',            render: renderIndividual,         wide: true }
  ];

  let state = {
    filters: filters.emptyFilterState(),
    widgetVisibility: null,  /* loaded from settings on first render */
    selectedPerson: '',
    periodA: { from: '', to: '' },
    periodB: { from: '', to: '' }
  };

  /* Current updateContent() closure — set by render() on each invocation.
   * Widget toggles call this to re-render the widget area without destroying
   * the filter panel or toggle bar (preserving scroll + focus). */
  let currentUpdate = null;

  function defaultVisibility() {
    const v = {};
    WIDGETS.forEach(function (w) { v[w.id] = true; });
    return v;
  }

  async function loadVisibility() {
    try {
      const saved = await db.getSetting(SETTINGS_KEY);
      if (saved && typeof saved === 'object') {
        /* merge with defaults so newly added widgets default to visible */
        const v = defaultVisibility();
        Object.keys(saved).forEach(function (k) { if (k in v) v[k] = !!saved[k]; });
        return v;
      }
    } catch (err) { /* fall through to defaults */ }
    return defaultVisibility();
  }

  async function saveVisibility(v) {
    try {
      await db.setSetting(SETTINGS_KEY, v);
    } catch (err) {
      ui.toast('Could not save widget layout: ' + err.message, 'error');
    }
  }

  async function render(root) {
    ui.clear(root);
    const allEntries = await db.getAllEntries();
    if (!state.widgetVisibility) state.widgetVisibility = await loadVisibility();

    /* Page header */
    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Data Review'),
        ui.el('div', { class: 'page-sub' }, 'Widget dashboard · toggle any panel to customize the view')
      ])
    ]));

    /* Shared filter bar */
    const panel = filters.renderPanel({
      initial: state.filters,
      showDateRange: true,
      showStatus: true,
      onChange: function (f) { state.filters = f; updateContent(); }
    });
    root.appendChild(panel.node);

    /* Widget visibility toggle panel */
    root.appendChild(renderTogglePanel());

    /* Dynamic content */
    const content = ui.el('div', null);
    root.appendChild(content);

    function updateContent() {
      ui.clear(content);
      const matched = filters.apply(allEntries, state.filters);
      const ctx = { matched: matched, allEntries: allEntries, state: state, refresh: updateContent };

      if (visibleCount() === 0) {
        content.appendChild(ui.el('div', { class: 'empty', style: { marginTop: '10px' } },
          'All widgets are hidden. Open the "Widgets" panel above and enable at least one.'));
        return;
      }

      const grid = ui.el('div', { class: 'dr-grid' });
      WIDGETS.forEach(function (w) {
        if (!state.widgetVisibility[w.id]) return;
        const body = w.render(ctx);
        const wrapper = ui.el('div', { class: 'dr-widget' + (w.wide ? ' dr-wide' : ''), 'data-widget': w.id }, [
          ui.el('h3', { class: 'dr-widget-title' }, w.title),
          body
        ]);
        grid.appendChild(wrapper);
      });
      content.appendChild(grid);

      if (!matched.length) {
        /* Friendly prompt if the filter produced zero results and every widget
         * ended up rendering an empty state. */
        content.appendChild(ui.el('div', { class: 'empty', style: { marginTop: '10px' } },
          'No entries match the current filter. Widen the date range or clear filters to see data.'));
      }
    }

    currentUpdate = updateContent;
    updateContent();
  }

  /* ---------- Widget visibility toggle panel ---------- */

  function renderTogglePanel() {
    const panel = ui.el('div', { class: 'dr-widget-toggle' });
    const open = { value: false };

    const listNode = ui.el('div', { class: 'dr-toggle-list', style: { display: 'none' } });

    WIDGETS.forEach(function (w) {
      const cb = ui.el('input', {
        type: 'checkbox',
        checked: !!state.widgetVisibility[w.id],
        onchange: function (e) {
          state.widgetVisibility[w.id] = e.target.checked;
          saveVisibility(state.widgetVisibility);
          triggerContentRefresh();
        }
      });
      const label = ui.el('label', null, [cb, ui.el('span', null, w.title)]);
      listNode.appendChild(label);
    });

    const actions = ui.el('div', { class: 'dr-toggle-actions' }, [
      ui.el('button', { class: 'btn small subtle', onclick: function () { setAll(true); } }, 'Show all'),
      ui.el('button', { class: 'btn small subtle', onclick: function () { setAll(false); } }, 'Hide all')
    ]);
    listNode.appendChild(actions);

    function setAll(v) {
      WIDGETS.forEach(function (w) { state.widgetVisibility[w.id] = v; });
      saveVisibility(state.widgetVisibility);
      /* refresh checkboxes */
      const boxes = listNode.querySelectorAll('input[type="checkbox"]');
      for (let i = 0; i < WIDGETS.length; i++) boxes[i].checked = v;
      triggerContentRefresh();
    }

    const header = ui.el('div', { class: 'dr-toggle-header', onclick: function () {
      open.value = !open.value;
      listNode.style.display = open.value ? 'grid' : 'none';
      chev.textContent = open.value ? '▾' : '▸';
    } }, [
      ui.el('span', null, 'Widgets · ' + visibleCount() + ' of ' + WIDGETS.length + ' visible'),
      ui.el('span', { class: 'chev' }, '▸')
    ]);
    const chev = header.querySelector('.chev');

    panel.appendChild(header);
    panel.appendChild(listNode);
    return panel;
  }

  function visibleCount() {
    let n = 0;
    WIDGETS.forEach(function (w) { if (state.widgetVisibility[w.id]) n++; });
    return n;
  }

  /* Re-render just the widget content area. The filter panel and toggle
   * panel stay mounted, so scroll position, checkbox focus, and filter-panel
   * state are all preserved. */
  function triggerContentRefresh() {
    /* Also refresh the toggle header's "N of M visible" label. */
    const hdr = document.querySelector('.dr-widget-toggle .dr-toggle-header span:first-child');
    if (hdr) hdr.textContent = 'Widgets · ' + visibleCount() + ' of ' + WIDGETS.length + ' visible';
    if (currentUpdate) currentUpdate();
  }

  /* ====================================================================
   * Widget renderers
   * Each takes ctx = { matched, allEntries, state, refresh }
   * and returns a single DOM node (the widget body, without the title).
   * ================================================================== */

  function renderSummary(ctx) {
    const m = ctx.matched;
    if (!m.length) return ui.el('div', { class: 'dr-empty' }, 'No entries match the current filter.');

    const complete = m.filter(function (e) { return e.status === 'complete'; }).length;
    const crit = m.filter(function (e) { return e.impact === 'Critical'; }).length;
    const high = m.filter(function (e) { return e.impact === 'High'; }).length;
    const cf = m.filter(function (e) { return e.domain === 'Client Facing'; }).length;
    const hcPct = m.length > 0 ? Math.round(((crit + high) / m.length) * 100) + '%' : '0%';
    const openFu = m.filter(function (e) {
      return e.followUpAction && !e.followUpDismissed;
    }).length;

    const body = ui.el('div', null, [
      widgetSub('Headline metrics across the ' + m.length + ' entries currently in scope.'),
      ui.el('div', { class: 'stats-row' }, [
        statCard('Total', m.length, 'accent'),
        statCard('Completed', complete),
        statCard('Critical', crit),
        statCard('High', high),
        statCard('Client facing', cf),
        statCard('High + Critical', hcPct),
        statCard('Open follow-ups', openFu, openFu ? 'danger' : '')
      ])
    ]);
    return body;
  }
  function renderDomainOverTime(ctx) {
    const m = ctx.matched;
    if (!m.length) return ui.el('div', { class: 'dr-empty' }, 'No entries in scope.');
    const data = charts.domainByMonth(m);
    if (!data.length) return ui.el('div', { class: 'dr-empty' }, 'Not enough data to bucket by month yet.');

    const C = charts.colors();
    const chart = charts.stackedBarChart(data, {
      keys: tax.DOMAINS,
      colorMap: C.domain
    });
    return ui.el('div', null, [
      widgetSub('Entries per month, stacked by domain. Shows how your tracked effort has shifted across Operations, Project, People Management, and Client Facing.'),
      chart
    ]);
  }
  function renderValuesAlignment(ctx) {
    return renderTaxAlignment(ctx, 'values',
      'Company values coverage across the filtered entries. Bars scale against total entries, so underrepresented values stay visually small.');
  }
  function renderTenetsAlignment(ctx) {
    return renderTaxAlignment(ctx, 'tenets',
      'Culture tenet coverage. Use this to check whether the narrative you are about to export reflects all three tenets.');
  }
  function renderPrinciplesAlignment(ctx) {
    return renderTaxAlignment(ctx, 'principles',
      'Principle-level coverage across the filtered entries. Underrepresented principles are candidates for the next reflection.');
  }

  function renderTaxAlignment(ctx, taxKey, subtitle) {
    const m = ctx.matched;
    if (!m.length) return ui.el('div', { class: 'dr-empty' }, 'No entries in scope.');
    const data = charts.tagFrequency(m, taxKey);
    return ui.el('div', null, [
      widgetSub(subtitle),
      charts.horizontalBarChart(data, { total: m.length })
    ]);
  }
  function renderGap(ctx) {
    const m = ctx.matched;
    if (!m.length) return ui.el('div', { class: 'dr-empty' }, 'No entries in scope.');
    return ui.el('div', null, [
      widgetSub('Taxonomy items ranked from least used to most used. NOT USED items surface first so they are easy to spot.'),
      charts.gapIndicator(charts.gapData(m), { total: m.length })
    ]);
  }

  function renderImpactQuality(ctx) {
    const m = ctx.matched;
    if (!m.length) return ui.el('div', { class: 'dr-empty' }, 'No entries in scope.');
    const data = charts.impactQualityByMonth(m);
    if (!data.length) return ui.el('div', { class: 'dr-empty' }, 'Not enough data to bucket by month yet.');

    const hc = m.filter(function (e) { return e.impact === 'High' || e.impact === 'Critical'; }).length;
    const overall = m.length > 0 ? Math.round((hc / m.length) * 100) + '%' : '0%';

    return ui.el('div', null, [
      widgetSub('Percentage of each month\u2019s entries at High or Critical impact. Overall in scope: ' + overall + ' (' + hc + ' of ' + m.length + ').'),
      charts.lineChart(data, { yMax: 100, yUnit: '%' })
    ]);
  }

  function renderImpactByDomain(ctx) {
    const m = ctx.matched;
    if (!m.length) return ui.el('div', { class: 'dr-empty' }, 'No entries in scope.');
    const categories = charts.impactByDomain(m);
    return ui.el('div', null, [
      widgetSub('Side-by-side impact levels within each domain. Surfaces whether high-impact work is concentrated in one area.'),
      charts.groupedBarChart(categories, {
        keys: tax.IMPACT_LEVELS,
        colorMap: charts.colors().impact
      })
    ]);
  }
  function renderVisibility(ctx) {
    const m = ctx.matched;
    if (!m.length) return ui.el('div', { class: 'dr-empty' }, 'No entries in scope.');

    const v = charts.visibilityIndex(m);
    const pct = v.total > 0 ? Math.round((v.unique / v.total) * 100) : 0;
    const b = v.breakdown;

    return ui.el('div', { class: 'dr-visibility-hero' }, [
      /* Score column */
      ui.el('div', { class: 'vh-score' }, [
        ui.el('div', { class: 'vh-pct' }, pct + '%'),
        ui.el('div', { class: 'vh-frac' }, v.unique + ' of ' + v.total)
      ]),
      /* Breakdown column */
      ui.el('div', { class: 'vh-breakdown' }, [
        ui.el('div', null, widgetSub(
          'Unique entries that demonstrate visibility beyond your immediate team. ' +
          'An entry counts once if it matches any of the three components below; components are ' +
          'summed for reference but do not double-count toward the headline figure.'
        )),
        vhRow('Client facing', 'Entries in the Client Facing domain', b.clientFacing),
        vhRow('Skip level interactions', 'People Management entries with interaction type Skip Level', b.skipLevel),
        vhRow('Leadership tenets', 'Entries tagged Lead The Way or Own The Outcome', b.leadership)
      ])
    ]);
  }

  function vhRow(label, hint, count) {
    return ui.el('div', { class: 'vh-row' }, [
      ui.el('div', null, [
        ui.el('div', { class: 'vh-label' }, label),
        ui.el('div', { class: 'vh-hint' }, hint)
      ]),
      ui.el('div', { class: 'vh-count' }, count)
    ]);
  }
  function renderPeriod(ctx) {
    /* The period comparison operates on allEntries (not matched), because the
     * explicit date inputs below supersede the global filter's date range.
     * Non-date filters (domain, impact, status, tags, search) still apply. */
    const body = ui.el('div', null);

    const table = ui.el('div', { class: 'dr-period-table-wrap' });

    function apply(period) {
      const f = Object.assign({}, ctx.state.filters);
      f.dateFrom = period.from || '';
      f.dateTo   = period.to || '';
      return filters.apply(ctx.allEntries, f);
    }

    function computeRow(label, fn, entriesA, entriesB) {
      const a = fn(entriesA);
      const b = fn(entriesB);
      return { label: label, a: a, b: b, delta: b - a };
    }

    function redraw() {
      ui.clear(table);

      const A = apply(ctx.state.periodA);
      const B = apply(ctx.state.periodB);

      const rows = [
        computeRow('Total entries',
          function (es) { return es.length; }, A, B),
        computeRow('Completed',
          function (es) { return es.filter(function (e) { return e.status === 'complete'; }).length; }, A, B),
        computeRow('Critical impact',
          function (es) { return es.filter(function (e) { return e.impact === 'Critical'; }).length; }, A, B),
        computeRow('High impact',
          function (es) { return es.filter(function (e) { return e.impact === 'High'; }).length; }, A, B),
        computeRow('Client facing',
          function (es) { return es.filter(function (e) { return e.domain === 'Client Facing'; }).length; }, A, B),
        computeRow('High + Critical %',
          function (es) {
            const hc = es.filter(function (e) { return e.impact === 'High' || e.impact === 'Critical'; }).length;
            return es.length > 0 ? Math.round((hc / es.length) * 100) : 0;
          }, A, B)
      ];

      const tbl = ui.el('table', { class: 'dr-period-table' }, [
        ui.el('thead', null, [
          ui.el('tr', null, [
            ui.el('th', null, 'Metric'),
            ui.el('th', null, 'Period A'),
            ui.el('th', null, 'Period B'),
            ui.el('th', null, 'Δ'),
            ui.el('th', null, 'Δ %')
          ])
        ]),
        ui.el('tbody', null, rows.map(function (r) {
          const isPct = r.label.indexOf('%') !== -1;
          const deltaRaw = r.delta;
          const deltaClass = deltaRaw > 0 ? 'delta-up' : (deltaRaw < 0 ? 'delta-down' : 'delta-zero');
          const deltaStr = (deltaRaw > 0 ? '+' : '') + deltaRaw + (isPct ? 'pp' : '');
          let deltaPctStr;
          if (r.a === 0 && r.b === 0) {
            deltaPctStr = '—';
          } else if (r.a === 0) {
            deltaPctStr = 'new';
          } else {
            const dp = Math.round(((r.b - r.a) / r.a) * 1000) / 10;
            deltaPctStr = (dp > 0 ? '+' : '') + dp + '%';
          }
          return ui.el('tr', null, [
            ui.el('td', null, r.label),
            ui.el('td', null, r.a + (isPct ? '%' : '')),
            ui.el('td', null, r.b + (isPct ? '%' : '')),
            ui.el('td', { class: deltaClass }, deltaStr),
            ui.el('td', { class: deltaClass }, deltaPctStr)
          ]);
        }))
      ]);
      table.appendChild(tbl);

      const aLabel = periodLabel(ctx.state.periodA);
      const bLabel = periodLabel(ctx.state.periodB);
      const scopeNote = ui.el('p', { class: 'dr-widget-sub' },
        'Period A: ' + aLabel + ' (' + A.length + ' entries)  ·  ' +
        'Period B: ' + bLabel + ' (' + B.length + ' entries). ' +
        'Non-date filters above still apply to both periods.');
      table.insertBefore(scopeNote, tbl);
    }

    function mkPeriodCol(title, period) {
      const fromInput = ui.el('input', {
        type: 'date',
        value: period.from || '',
        onchange: function (e) { period.from = e.target.value; redraw(); }
      });
      const toInput = ui.el('input', {
        type: 'date',
        value: period.to || '',
        onchange: function (e) { period.to = e.target.value; redraw(); }
      });
      return ui.el('div', { class: 'dr-period-col' }, [
        ui.el('h4', null, title),
        ui.el('div', { class: 'dr-period-inputs' }, [
          fromInput,
          ui.el('span', { style: { color: 'var(--text-faint)', fontSize: '12px' } }, '→'),
          toInput
        ])
      ]);
    }

    body.appendChild(widgetSub('Compare any two date ranges side by side. Leave a field blank for "open-ended".'));
    body.appendChild(ui.el('div', { class: 'dr-period' }, [
      mkPeriodCol('Period A', ctx.state.periodA),
      mkPeriodCol('Period B', ctx.state.periodB)
    ]));
    body.appendChild(table);
    redraw();
    return body;
  }

  function periodLabel(p) {
    if (!p.from && !p.to) return 'all dates';
    if (p.from && p.to)   return p.from + ' → ' + p.to;
    if (p.from)           return 'from ' + p.from;
    return 'through ' + p.to;
  }
  function renderIndividual(ctx) {
    const m = ctx.matched;

    /* Only entries with an individual attached count. Both People Management
     * and Client Facing domains are eligible. */
    const individuals = {};
    m.forEach(function (e) {
      if (e.individual && (e.domain === 'People Management' || e.domain === 'Client Facing')) {
        if (!individuals[e.individual]) individuals[e.individual] = [];
        individuals[e.individual].push(e);
      }
    });

    const names = Object.keys(individuals).sort();
    if (!names.length) {
      return ui.el('div', { class: 'dr-empty' },
        'No entries with individuals attached in the current filter. Use People Management or Client Facing entries and select an individual to populate this widget.');
    }

    const body = ui.el('div', null, [widgetSub('Per-person narrative: sentiment trajectory, development themes, interaction types, and follow-ups.')]);

    const personSelect = ui.el('select', {
      style: { marginBottom: '16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' },
      onchange: function (e) {
        ctx.state.selectedPerson = e.target.value;
        renderDetail();
      }
    }, [
      ui.el('option', { value: '' }, 'Select a person…'),
      ...names.map(function (n) {
        return ui.el('option', { value: n, selected: ctx.state.selectedPerson === n }, n + ' (' + individuals[n].length + ')');
      })
    ]);
    body.appendChild(personSelect);

    const detail = ui.el('div', null);
    body.appendChild(detail);

    function renderDetail() {
      ui.clear(detail);
      const person = ctx.state.selectedPerson;
      if (!person || !individuals[person]) return;

      const personEntries = individuals[person].slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });

      detail.appendChild(ui.el('div', { class: 'stats-row' }, [
        statCard('Interactions', personEntries.length),
        statCard('Follow-ups', personEntries.filter(function (e) { return e.followUpAction; }).length),
        statCard('Open actions', personEntries.filter(function (e) { return e.followUpAction && !e.followUpDismissed; }).length)
      ]));

      const grid = ui.el('div', { class: 'charts-grid' });

      /* Sentiment trajectory */
      const sentimentMap = {
        'Very Positive': 5, 'Positive': 4, 'Neutral': 3, 'Negative': 2, 'Very Negative': 1,
        'Very Satisfied': 5, 'Satisfied': 4, 'Dissatisfied': 2, 'Very Dissatisfied': 1
      };
      const sentimentData = personEntries
        .filter(function (e) { return e.sentiment || e.customerSentiment; })
        .slice().reverse()
        .map(function (e) {
          const s = e.sentiment || e.customerSentiment;
          return { label: ui.shortDate(e.date), value: sentimentMap[s] || 3 };
        });
      if (sentimentData.length) {
        grid.appendChild(chartCard('Sentiment trajectory', charts.lineChart(sentimentData, { height: 180, yMax: 5 })));
      }

      /* Development themes */
      const themeData = {};
      personEntries.forEach(function (e) {
        if (e.developmentTheme) themeData[e.developmentTheme] = (themeData[e.developmentTheme] || 0) + 1;
      });
      if (Object.keys(themeData).length) {
        const themeItems = Object.keys(themeData).map(function (k) { return { label: k, value: themeData[k] }; });
        themeItems.sort(function (a, b) { return b.value - a.value; });
        grid.appendChild(chartCard('Development themes', charts.horizontalBarChart(themeItems, { rowH: 22 })));
      }

      /* Interaction types */
      const typeData = {};
      personEntries.forEach(function (e) {
        if (e.interactionType) typeData[e.interactionType] = (typeData[e.interactionType] || 0) + 1;
      });
      if (Object.keys(typeData).length) {
        const typeItems = Object.keys(typeData).map(function (k) { return { label: k, value: typeData[k] }; });
        typeItems.sort(function (a, b) { return b.value - a.value; });
        grid.appendChild(chartCard('Interaction types', charts.horizontalBarChart(typeItems, { rowH: 22 })));
      }

      detail.appendChild(grid);

      /* Follow-ups */
      const followUps = personEntries.filter(function (e) { return e.followUpAction; });
      if (followUps.length) {
        detail.appendChild(ui.el('h4', { style: { margin: '20px 0 10px', fontSize: '13px', color: 'var(--text-dim)' } }, 'Follow-up actions — ' + followUps.length));
        const fuList = ui.el('div', { class: 'entry-list' });
        followUps.forEach(function (e) {
          const overdue = e.followUpTargetDate && e.followUpTargetDate < db.todayIso() && !e.followUpDismissed;
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
        detail.appendChild(fuList);
      }

      /* Recent entries */
      detail.appendChild(ui.el('h4', { style: { margin: '20px 0 10px', fontSize: '13px', color: 'var(--text-dim)' } }, 'Recent entries — ' + personEntries.length));
      const entryList = ui.el('div', { class: 'entry-list' });
      personEntries.slice(0, 20).forEach(function (e) {
        entryList.appendChild(window.Uptrack.views.landing.renderCard(e, function () {}));
      });
      if (personEntries.length > 20) {
        entryList.appendChild(ui.el('div', { class: 'text-faint', style: { fontSize: '11px', padding: '8px 4px' } },
          '…and ' + (personEntries.length - 20) + ' more'));
      }
      detail.appendChild(entryList);
    }

    if (ctx.state.selectedPerson && individuals[ctx.state.selectedPerson]) renderDetail();
    return body;
  }

  function chartCard(title, content) {
    return ui.el('div', { class: 'chart-card' }, [
      ui.el('h4', null, title),
      content
    ]);
  }

  /* ---------- shared widget helpers ---------- */

  function statCard(label, value, kind) {
    return ui.el('div', { class: 'stat-card' + (kind ? ' ' + kind : '') }, [
      ui.el('div', { class: 'label' }, label),
      ui.el('div', { class: 'value' }, value)
    ]);
  }

  function widgetSub(text) {
    return ui.el('p', { class: 'dr-widget-sub' }, text);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.views = window.Uptrack.views || {};
  window.Uptrack.views.datareview = { render: render };
})();
