/* Weekly view — Friday review habit.
 * Produces a human-readable summary grouped by domain → impact.
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const filters = window.Uptrack.filters;
  const landing = window.Uptrack.views && window.Uptrack.views.landing;

  let state = {
    anchor: ui.today(),
    filters: filters.emptyFilterState()
  };

  async function render(root) {
    ui.clear(root);
    const allEntries = await db.getAllEntries();

    const weekStart = ui.startOfWeek(state.anchor);
    const weekEnd   = ui.endOfWeek(state.anchor);

    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Weekly Review'),
        ui.el('div', { class: 'page-sub' }, ui.longDate(weekStart) + '  →  ' + ui.longDate(weekEnd))
      ]),
      ui.el('div', { class: 'btn-row' }, [
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = offsetWeek(state.anchor, -1); render(root); } }, '← Previous'),
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = ui.today(); render(root); } }, 'This week'),
        ui.el('button', { class: 'btn small', onclick: function () { state.anchor = offsetWeek(state.anchor, 1); render(root); } }, 'Next →')
      ])
    ]));

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
      var ws = ui.startOfWeek(state.anchor);
      var we = ui.endOfWeek(state.anchor);
      var fromIso = ui.toIso(ws);
      var toIso   = ui.toIso(we);
      var weekFilters = Object.assign({}, state.filters, { dateFrom: fromIso, dateTo: toIso });
      var weekEntries = filters.apply(allEntries, weekFilters);

      /* Summary */
      var summary = buildSummary(weekEntries, ws, we);
      content.appendChild(ui.el('div', { class: 'summary-block' }, [
        ui.el('h3', null, 'Week at a glance'),
        summary
      ]));

      /* Export buttons */
      content.appendChild(ui.el('div', { class: 'btn-row', style: { marginBottom: '20px' } }, [
        ui.el('button', { class: 'btn', onclick: function () {
          window.Uptrack.export.runGeneralTextExport(weekEntries, weekFilters, ui.longDate(ws) + ' → ' + ui.longDate(we));
        } }, 'Export week (text)'),
        ui.el('button', { class: 'btn', onclick: function () {
          window.Uptrack.export.runGeneralCsvExport(weekEntries);
        } }, 'Export week (CSV)'),
        ui.el('button', { class: 'btn', onclick: function () {
          window.Uptrack.export.runObsidianExport(weekEntries, weekFilters, ui.longDate(ws) + ' → ' + ui.longDate(we));
        } }, 'Export week (Obsidian)')
      ]));

      /* Grouped entries */
      var grouped = ui.el('section', { class: 'section' }, [
        ui.el('h2', { class: 'section-title' }, 'Entries — ' + weekEntries.length)
      ]);

      if (!weekEntries.length) {
        grouped.appendChild(ui.el('div', { class: 'empty' }, 'No entries this week match your filters.'));
      } else {
        for (var di = 0; di < tax.DOMAINS.length; di++) {
          var d = tax.DOMAINS[di];
          var inDom = weekEntries.filter(function (e) { return e.domain === d; });
          if (!inDom.length) continue;
          grouped.appendChild(ui.el('div', { class: 'group-heading' }, d + '  (' + inDom.length + ')'));
          var levels = ['Critical', 'High', 'Medium', 'Low'];
          for (var li = 0; li < levels.length; li++) {
            var lvl = levels[li];
            var ins = inDom.filter(function (e) { return e.impact === lvl; });
            if (!ins.length) continue;
            grouped.appendChild(ui.el('div', { class: 'subgroup-heading' }, 'Impact — ' + lvl));
            var list = ui.el('div', { class: 'entry-list' });
            ins.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
            ins.forEach(function (e) { list.appendChild(landing.renderCard(e, function () { render(root); })); });
            grouped.appendChild(list);
          }
        }
        /* Any entries without domain */
        var uncat = weekEntries.filter(function (e) { return !e.domain; });
        if (uncat.length) {
          grouped.appendChild(ui.el('div', { class: 'group-heading' }, 'No domain'));
          var ulist = ui.el('div', { class: 'entry-list' });
          uncat.forEach(function (e) { ulist.appendChild(landing.renderCard(e, function () { render(root); })); });
          grouped.appendChild(ulist);
        }
      }
      content.appendChild(grouped);
    }

    updateContent();
  }

  function offsetWeek(d, weeks) {
    const n = new Date(d); n.setDate(n.getDate() + weeks * 7); return n;
  }

  function buildSummary(entries, weekStart, weekEnd) {
    if (!entries.length) return 'No entries this week.\n\nThis is your Friday review surface — add a few before end of day and the\nsummary will populate automatically, organized by domain and impact level.';

    const lines = [];
    lines.push('Total entries: ' + entries.length);
    const byStatus = { draft: 0, complete: 0 };
    entries.forEach(function (e) { byStatus[e.status] = (byStatus[e.status] || 0) + 1; });
    lines.push('  Complete: ' + (byStatus.complete || 0) + '    Drafts: ' + (byStatus.draft || 0));
    lines.push('');

    for (const d of tax.DOMAINS) {
      const inDom = entries.filter(function (e) { return e.domain === d; });
      if (!inDom.length) continue;
      lines.push('## ' + d + '  (' + inDom.length + ')');
      for (const lvl of ['Critical', 'High', 'Medium', 'Low']) {
        const ins = inDom.filter(function (e) { return e.impact === lvl; });
        if (!ins.length) continue;
        lines.push('  [' + lvl + ']');
        ins.forEach(function (e) {
          lines.push('    • ' + (e.title || '(untitled)') + '  — ' + e.date);
        });
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.views = window.Uptrack.views || {};
  window.Uptrack.views.weekly = { render: render };
})();
