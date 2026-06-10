/* Landing view: quick capture + active drafts (prominent) + recent entries. */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const charts = window.Uptrack.charts;
  const entryMod = window.Uptrack.entry;

  async function render(root) {
    ui.clear(root);

    const [allEntries, drafts, lastBackupAt] = await Promise.all([
      db.getAllEntries(),
      db.getDrafts(),
      db.getSetting('lastBackupAt')
    ]);

    /* Header */
    const header = ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Today'),
        ui.el('div', { class: 'page-sub' }, ui.longDate(new Date()))
      ]),
      ui.el('div', { class: 'btn-row' }, [
        ui.el('button', { class: 'btn primary', onclick: function () {
          entryMod.open(null, { onChange: function () { render(root); } });
        } }, [ui.icon('plus'), 'New full entry'])
      ])
    ]);
    root.appendChild(header);

    /* Backup nag — shown when overdue or never taken */
    const nag = window.Uptrack.export.renderBackupNag(lastBackupAt, function () { render(root); });
    if (nag) root.appendChild(nag);

    /* Quick capture */
    const input = ui.el('input', {
      type: 'text',
      placeholder: 'Title a new entry and press Enter…',
      onkeydown: async function (e) {
        if (e.key === 'Enter' && input.value.trim()) {
          const saved = await entryMod.quickCreate(input.value);
          /* Keep the typed title on storage failure so nothing is lost. */
          if (saved) { input.value = ''; render(root); }
        }
      }
    });
    const qc = ui.el('div', { class: 'quick-capture' }, [
      ui.el('label', null, 'Quick capture'),
      ui.el('div', { class: 'quick-capture-row' }, [
        ui.el('div', { class: 'qc-input-wrap' }, [
          input,
          ui.el('span', { class: 'qc-kbd', 'aria-hidden': 'true' }, '/')
        ]),
        ui.el('button', { class: 'btn', onclick: async function () {
          if (!input.value.trim()) { input.focus(); return; }
          const saved = await entryMod.quickCreate(input.value);
          if (saved) { input.value = ''; render(root); }
        } }, 'Save draft'),
        ui.el('button', { class: 'btn primary', onclick: function () {
          entryMod.open({ title: input.value || '' }, { onChange: function () { input.value = ''; render(root); } });
        } }, 'Open full form')
      ]),
      ui.el('div', { class: 'hint' }, 'Drafts save immediately. Add metadata any time.')
    ]);
    root.appendChild(qc);

    setTimeout(function () { input.focus(); }, 20);

    /* Drafts — prominent */
    const draftSection = ui.el('section', { class: 'section' }, [
      ui.el('h2', { class: 'section-title' }, 'Active drafts — ' + drafts.length)
    ]);
    if (drafts.length) {
      const list = ui.el('div', { class: 'entry-list' });
      drafts.forEach(function (e) { list.appendChild(renderCard(e, function () { render(root); })); });
      draftSection.appendChild(list);
    } else {
      draftSection.appendChild(ui.el('div', { class: 'empty' }, 'No active drafts. Quick captures will appear here.'));
    }
    root.appendChild(draftSection);

    /* Recent — drafts are excluded here because they already have their own
     * (more prominent) section above; listing them twice just adds noise. */
    const today = ui.today();
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
    const recent = allEntries.filter(function (e) {
      const d = ui.parseIso(e.date);
      return e.status !== 'draft' && d >= sevenDaysAgo && d <= today;
    });
    const recentSection = ui.el('section', { class: 'section' }, [
      ui.el('h2', { class: 'section-title' }, 'Last 7 days — ' + recent.length)
    ]);
    if (recent.length) {
      const list = ui.el('div', { class: 'entry-list' });
      recent.forEach(function (e) { list.appendChild(renderCard(e, function () { render(root); })); });
      recentSection.appendChild(list);
    } else {
      recentSection.appendChild(ui.el('div', { class: 'empty' }, 'No entries in the last 7 days yet.'));
    }
    root.appendChild(recentSection);

    /* Capture streak heatmap */
    const streak = charts.captureStreak(allEntries);
    root.appendChild(ui.el('div', { class: 'chart-card', style: { marginBottom: '22px' } }, [
      ui.el('h4', null, 'Capture streak — last 13 weeks'),
      ui.el('div', { class: 'text-faint', style: { fontSize: '12px', marginBottom: '10px' } },
        streak > 0
          ? 'Current streak: ' + streak + (streak === 1 ? ' day' : ' days')
          : 'No current streak — capture something today to start one.'),
      charts.calendarHeatmap(allEntries)
    ]));

    /* Stats footer */
    const complete = allEntries.filter(function (e) { return e.status === 'complete'; });
    const clientFacing = allEntries.filter(function (e) { return e.domain === 'Client Facing'; });
    const hc = allEntries.filter(function (e) { return e.impact === 'High' || e.impact === 'Critical'; });
    const hcPct = allEntries.length > 0 ? Math.round((hc.length / allEntries.length) * 100) + '%' : '0%';
    const stats = ui.el('div', { class: 'stats-row' }, [
      ui.el('div', { class: 'stat-card accent' }, [ui.el('div', { class: 'label' }, 'Total entries'),  ui.el('div', { class: 'value' }, allEntries.length)]),
      ui.el('div', { class: 'stat-card' }, [ui.el('div', { class: 'label' }, 'Completed'),      ui.el('div', { class: 'value' }, complete.length)]),
      ui.el('div', { class: 'stat-card' }, [ui.el('div', { class: 'label' }, 'Drafts'),         ui.el('div', { class: 'value' }, drafts.length)]),
      ui.el('div', { class: 'stat-card' }, [ui.el('div', { class: 'label' }, 'Client facing'),  ui.el('div', { class: 'value' }, clientFacing.length)]),
      ui.el('div', { class: 'stat-card' }, [ui.el('div', { class: 'label' }, 'High + Critical'),ui.el('div', { class: 'value' }, hcPct)])
    ]);
    root.appendChild(stats);
  }

  function renderCard(e, onChange) {
    const card = ui.el('div', { class: 'entry-card' + (e.status === 'draft' ? ' draft' : ''), onclick: function () {
      window.Uptrack.entry.open(e.id, { onChange: onChange });
    } }, [
      ui.el('div', { class: 'row1' }, [
        ui.el('div', { class: 'title' }, e.title || '(untitled)'),
        ui.el('div', { class: 'date' }, ui.relativeDay(e.date))
      ]),
      e.description ? ui.el('div', { class: 'desc' }, e.description) : null,
      ui.el('div', { class: 'meta' }, [
        ui.statusBadge(e.status),
        ui.domainBadge(e.domain),
        ui.impactBadge(e.impact),
        ui.tagChips(e.tags)
      ])
    ]);
    return card;
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.views = window.Uptrack.views || {};
  window.Uptrack.views.landing = { render: render, renderCard: renderCard };
})();
