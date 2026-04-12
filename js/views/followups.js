/* Follow-Up Action Tracker — dedicated view for open follow-up actions
 * sorted by target date, with dismiss controls and toggle for dismissed items.
 */
(function () {
  'use strict';

  const ui = window.Uptrack.ui;
  const db = window.Uptrack.db;

  let state = {
    showDismissed: false
  };

  async function render(root) {
    ui.clear(root);
    var allEntries = await db.getAllEntries();

    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Follow-Up Actions'),
        ui.el('div', { class: 'page-sub' }, 'Open action items sorted by target date')
      ])
    ]));

    /* Toggle dismissed */
    var toggleRow = ui.el('div', { class: 'toggle-row', style: { marginBottom: '18px' } }, [
      ui.el('span', null, 'Show dismissed'),
      ui.el('label', { class: 'toggle-switch' }, [
        ui.el('input', {
          type: 'checkbox',
          checked: state.showDismissed,
          onchange: function (e) {
            state.showDismissed = e.target.checked;
            updateContent();
          }
        }),
        ui.el('span', { class: 'toggle-slider' })
      ])
    ]);
    root.appendChild(toggleRow);

    var content = ui.el('div', null);
    root.appendChild(content);

    function updateContent() {
      ui.clear(content);

      /* Collect all entries with follow-up actions */
      var followUps = allEntries.filter(function (e) {
        return e.followUpAction;
      });

      var open = followUps.filter(function (e) { return !e.followUpDismissed; });
      var dismissed = followUps.filter(function (e) { return e.followUpDismissed; });

      var todayIso = db.todayIso();
      var overdue = open.filter(function (e) {
        return e.followUpTargetDate && e.followUpTargetDate < todayIso;
      });
      var upcoming = open.filter(function (e) {
        return e.followUpTargetDate && e.followUpTargetDate >= todayIso;
      });
      var noDate = open.filter(function (e) {
        return !e.followUpTargetDate;
      });

      /* Stats */
      content.appendChild(ui.el('div', { class: 'stats-row' }, [
        stat('Total', followUps.length),
        stat('Open', open.length),
        stat('Overdue', overdue.length),
        stat('Dismissed', dismissed.length)
      ]));

      if (!open.length && !state.showDismissed) {
        content.appendChild(ui.el('div', { class: 'empty' }, 'No open follow-up actions. Create entries with follow-up actions in People Management or Client Facing domains.'));
        return;
      }

      /* Overdue section */
      if (overdue.length) {
        overdue.sort(function (a, b) { return a.followUpTargetDate < b.followUpTargetDate ? -1 : 1; });
        content.appendChild(ui.el('h2', { class: 'section-title', style: { color: 'var(--impact-critical)' } }, 'Overdue — ' + overdue.length));
        content.appendChild(renderActionList(overdue, root));
      }

      /* Upcoming section */
      if (upcoming.length) {
        upcoming.sort(function (a, b) { return a.followUpTargetDate < b.followUpTargetDate ? -1 : 1; });
        content.appendChild(ui.el('h2', { class: 'section-title' }, 'Upcoming — ' + upcoming.length));
        content.appendChild(renderActionList(upcoming, root));
      }

      /* No target date */
      if (noDate.length) {
        noDate.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        content.appendChild(ui.el('h2', { class: 'section-title' }, 'No target date — ' + noDate.length));
        content.appendChild(renderActionList(noDate, root));
      }

      /* Dismissed section */
      if (state.showDismissed && dismissed.length) {
        dismissed.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        content.appendChild(ui.el('h2', { class: 'section-title', style: { opacity: '0.6' } }, 'Dismissed — ' + dismissed.length));
        content.appendChild(renderActionList(dismissed, root));
      }
    }

    function renderActionList(items, root) {
      var list = ui.el('div', { class: 'entry-list' });
      items.forEach(function (e) {
        var todayIso = db.todayIso();
        var isOverdue = e.followUpTargetDate && e.followUpTargetDate < todayIso && !e.followUpDismissed;
        var isDismissed = e.followUpDismissed;

        var card = ui.el('div', { class: 'followup-card' + (isOverdue ? ' overdue' : '') + (isDismissed ? ' dismissed' : '') }, [
          ui.el('div', { class: 'fu-header' }, [
            ui.el('div', { class: 'fu-title' }, e.followUpAction),
            ui.el('div', { class: 'fu-date' }, e.followUpTargetDate ? ui.shortDate(e.followUpTargetDate) : 'No target date')
          ]),
          e.followUpDescription ? ui.el('div', { class: 'fu-meta' }, e.followUpDescription) : null,
          ui.el('div', { class: 'fu-meta' }, [
            e.individual ? ui.el('span', { style: { fontWeight: '600' } }, e.individual + '  ·  ') : null,
            ui.el('span', null, e.title),
            ui.el('span', null, '  —  ' + ui.relativeDay(e.date))
          ]),
          ui.el('div', { class: 'fu-meta' }, [
            ui.domainBadge(e.domain),
            e.companyName ? ui.el('span', { style: { marginLeft: '8px', fontSize: '11px', color: 'var(--text-faint)' } }, e.companyName) : null
          ]),
          ui.el('div', { style: { marginTop: '8px', display: 'flex', gap: '8px' } }, [
            isDismissed
              ? ui.el('button', {
                  class: 'btn small',
                  onclick: async function () {
                    e.followUpDismissed = false;
                    await db.updateEntry(e);
                    ui.toast('Action reopened');
                    render(root);
                  }
                }, 'Reopen')
              : ui.el('button', {
                  class: 'btn small',
                  onclick: async function () {
                    e.followUpDismissed = true;
                    await db.updateEntry(e);
                    ui.toast('Action dismissed');
                    render(root);
                  }
                }, 'Dismiss'),
            ui.el('button', {
              class: 'btn small subtle',
              onclick: function () {
                window.Uptrack.entry.open(e.id, { onChange: function () { render(root); } });
              }
            }, 'Edit entry')
          ])
        ]);
        list.appendChild(card);
      });
      return list;
    }

    updateContent();
  }

  function stat(label, value) {
    return ui.el('div', { class: 'stat-card' }, [
      ui.el('div', { class: 'label' }, label),
      ui.el('div', { class: 'value' }, value)
    ]);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.views = window.Uptrack.views || {};
  window.Uptrack.views.followups = { render: render };
})();
