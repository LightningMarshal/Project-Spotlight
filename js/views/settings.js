/* Settings view: roster management, appearance & reward toggles,
 * performance review export, archive management, full backup/restore.
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const filters = window.Uptrack.filters;

  const BACKUP_NAG_DAYS = 14;

  const ROSTER_CATEGORIES = [
    { key: 'direct',     label: 'Direct Managers' },
    { key: 'indirect',   label: 'Indirect Managers' },
    { key: 'leadership', label: 'Leadership' }
  ];

  async function render(root) {
    ui.clear(root);

    const [allEntries, archivedEntries, lastBackupAt, roster, audioEnabled, confettiEnabled, theme] = await Promise.all([
      db.getAllEntries(),
      db.getAllEntries({ includeArchived: true }).then(function (a) { return a.filter(function (e) { return e.archived; }); }),
      db.getSetting('lastBackupAt'),
      db.getSetting('roster'),
      db.getSetting('audioEnabled'),
      db.getSetting('confettiEnabled'),
      db.getSetting('theme')
    ]);

    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Settings'),
        ui.el('div', { class: 'page-sub' }, 'Roster, appearance, backup, review export, archive')
      ])
    ]));

    /* Backup nag */
    const nag = renderBackupNag(lastBackupAt, function () { render(root); });
    if (nag) root.appendChild(nag);

    /* Appearance & reward toggles */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Appearance & rewards'));
    root.appendChild(renderToggles(
      { audio: audioEnabled, confetti: confettiEnabled, theme: theme || 'dark' },
      function () { render(root); }
    ));

    /* Roster management */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Roster'));
    root.appendChild(ui.el('div', { class: 'text-faint mb', style: { fontSize: '12px' } },
      'Manage the people you interact with. These names populate the Individual dropdown in the entry form.'));
    root.appendChild(renderRosterPanel(roster || {}, function () { render(root); }));

    /* Performance Review export */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Performance review export'));
    root.appendChild(renderReviewCard(allEntries));

    /* Full backup */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Backup & restore'));
    root.appendChild(renderBackupCard(function () { render(root); }));

    /* Archive management */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Entry archive — ' + archivedEntries.length));
    root.appendChild(renderArchivePanel(allEntries, archivedEntries, function () { render(root); }));
  }

  /* ---------- Toggles ---------- */

  function renderToggles(state, onChange) {
    function toggle(label, desc, active, onToggle) {
      var sw = ui.el('div', {
        class: 'toggle-switch' + (active ? ' active' : ''),
        onclick: function () {
          var next = !sw.classList.contains('active');
          sw.classList.toggle('active');
          onToggle(next);
        }
      });
      return ui.el('div', { class: 'toggle-row' }, [
        ui.el('div', null, [
          ui.el('div', { class: 'toggle-label' }, label),
          desc ? ui.el('div', { class: 'toggle-desc' }, desc) : null
        ]),
        sw
      ]);
    }

    var container = ui.el('div', { class: 'form' }, [
      toggle('Dark mode', 'Switch between dark and light theme', state.theme === 'dark', async function (on) {
        var t = on ? 'dark' : 'light';
        await db.setSetting('theme', t);
        document.documentElement.setAttribute('data-theme', t);
      }),
      toggle('Audio chime', 'Play a chime when saving an entry as complete', state.audio !== false, async function (on) {
        await db.setSetting('audioEnabled', on);
      }),
      toggle('Confetti', 'Show confetti animation when saving an entry as complete', state.confetti !== false, async function (on) {
        await db.setSetting('confettiEnabled', on);
      })
    ]);
    return container;
  }

  /* ---------- Roster ---------- */

  function renderRosterPanel(roster, onChange) {
    var container = ui.el('div', { class: 'form' });

    ROSTER_CATEGORIES.forEach(function (cat) {
      var people = (roster[cat.key] || []).slice();

      var listEl = ui.el('div', { class: 'roster-list' });
      function rebuildList() {
        ui.clear(listEl);
        people.forEach(function (name, idx) {
          listEl.appendChild(ui.el('div', { class: 'roster-item' }, [
            ui.el('span', { class: 'name' }, name),
            ui.el('button', { class: 'btn small danger', onclick: async function () {
              people.splice(idx, 1);
              roster[cat.key] = people;
              await db.setSetting('roster', roster);
              rebuildList();
            } }, 'Remove')
          ]));
        });
      }
      rebuildList();

      var addInput = ui.el('input', {
        type: 'text',
        placeholder: 'Add a name…',
        onkeydown: function (e) {
          if (e.key === 'Enter' && addInput.value.trim()) {
            addPerson();
          }
        }
      });

      async function addPerson() {
        var name = addInput.value.trim();
        if (!name) return;
        if (people.indexOf(name) !== -1) { ui.toast('Already in list', 'warn'); return; }
        people.push(name);
        people.sort();
        roster[cat.key] = people;
        await db.setSetting('roster', roster);
        addInput.value = '';
        rebuildList();
      }

      container.appendChild(ui.el('div', { class: 'roster-group' }, [
        ui.el('div', { class: 'group-heading' }, cat.label + ' — ' + people.length),
        listEl,
        ui.el('div', { class: 'roster-add-row' }, [
          addInput,
          ui.el('button', { class: 'btn small', onclick: addPerson }, 'Add')
        ])
      ]));
    });

    return container;
  }

  /* ---------- Review export ---------- */

  function renderReviewCard(allEntries) {
    var pickState = {
      filters: (function () {
        var f = filters.emptyFilterState();
        f.status = 'complete';
        return f;
      })()
    };

    var statusLabel = ui.el('div', { class: 'text-faint', style: { fontSize: '12px' } }, '0 entries selected');

    function recount() {
      var matched = filters.apply(allEntries, pickState.filters);
      statusLabel.textContent = matched.length + ' entries matched';
      return matched;
    }

    var panel = filters.renderPanel({
      initial: pickState.filters,
      showDateRange: true,
      showStatus: true,
      onChange: function (f) { pickState.filters = f; recount(); }
    });

    var card = ui.el('div', { class: 'form' }, [
      ui.el('div', { class: 'text-dim mb', style: { fontSize: '13px' } },
        'Produces a pre-structured text document grouped by company value, then by culture tenet. Use it as the input to a performance review questionnaire.'),
      panel.node,
      statusLabel,
      ui.el('div', { class: 'form-actions' }, [
        ui.el('div', null),
        ui.el('div', { class: 'btn-row' }, [
          ui.el('button', { class: 'btn', onclick: function () {
            var matched = recount();
            var text = window.Uptrack.export.reviewText(matched, pickState.filters);
            previewText('Review export preview', text);
          } }, 'Preview'),
          ui.el('button', { class: 'btn primary', onclick: function () {
            var matched = recount();
            if (!matched.length) { ui.toast('No entries matched', 'warn'); return; }
            window.Uptrack.export.runReviewExport(matched, pickState.filters);
          } }, 'Download review export')
        ])
      ])
    ]);
    recount();
    return card;
  }

  /* ---------- Backup ---------- */

  function renderBackupCard(onChange) {
    var note = ui.el('div', { class: 'text-faint', style: { fontSize: '12px', marginTop: '8px' } });

    var restoreInput = ui.el('input', {
      type: 'file',
      accept: '.json',
      style: { display: 'none' },
      onchange: async function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var text = await f.text();
        var payload;
        try { payload = JSON.parse(text); }
        catch (err) { ui.toast('Not a valid JSON file', 'error'); return; }
        ui.confirmDialog('Restore will REPLACE every entry and people log in the database with the contents of the backup. Continue?', async function () {
          try {
            await db.restoreAll(payload);
            ui.toast('Backup restored');
            onChange();
          } catch (err) {
            ui.toast('Restore failed: ' + err.message, 'error');
          }
        });
      }
    });

    return ui.el('div', { class: 'form' }, [
      ui.el('div', { class: 'text-dim', style: { fontSize: '13px' } },
        'Export a single JSON file containing every entry, people management log, and setting. Use it for safekeeping or for migrating to a new machine.'),
      ui.el('div', { class: 'form-actions' }, [
        note,
        ui.el('div', { class: 'btn-row' }, [
          ui.el('button', { class: 'btn primary', onclick: async function () {
            await window.Uptrack.export.runFullBackup();
            var now = new Date();
            await db.setSetting('lastBackupAt', now.toISOString());
            note.textContent = 'Backup generated ' + now.toLocaleString();
            ui.toast('Backup downloaded');
            onChange();
          } }, 'Download full backup'),
          ui.el('button', { class: 'btn', onclick: function () { restoreInput.click(); } }, 'Restore from backup'),
          restoreInput
        ])
      ])
    ]);
  }

  /* ---------- Backup nag ---------- */

  function renderBackupNag(lastBackupAt, onBackupDone) {
    var message;
    if (!lastBackupAt) {
      message = 'You have never backed up. On file:// origins, browser storage can be cleared unexpectedly — download a backup now to protect your data.';
    } else {
      var ageMs = Date.now() - new Date(lastBackupAt).getTime();
      var ageDays = Math.floor(ageMs / 86400000);
      if (ageDays < BACKUP_NAG_DAYS) return null;
      message = 'Your last backup was ' + ageDays + ' days ago. On file:// origins, browser storage can be cleared unexpectedly — download a fresh backup now.';
    }

    return ui.el('div', {
      class: 'form',
      style: {
        borderLeft: '3px solid var(--accent)',
        marginBottom: '20px',
        background: 'linear-gradient(to right, var(--accent-bg), var(--surface) 30%)'
      }
    }, [
      ui.el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } }, [
        ui.el('span', { class: 'badge draft' }, 'Backup overdue'),
        ui.el('span', { class: 'text-faint', style: { fontSize: '11px' } },
          lastBackupAt ? 'Last backup ' + new Date(lastBackupAt).toLocaleString() : 'Never backed up')
      ]),
      ui.el('div', { class: 'text-dim', style: { fontSize: '13px', marginBottom: '14px' } }, message),
      ui.el('button', { class: 'btn primary', onclick: async function () {
        await window.Uptrack.export.runFullBackup();
        await db.setSetting('lastBackupAt', new Date().toISOString());
        ui.toast('Backup downloaded');
        onBackupDone();
      } }, 'Download backup now')
    ]);
  }

  /* ---------- Archive ---------- */

  function renderArchivePanel(activeEntries, archivedEntries, onChange) {
    var container = ui.el('div', { class: 'form' });

    container.appendChild(ui.el('div', { class: 'text-dim', style: { fontSize: '13px' } },
      'Archive removes an entry from active views (landing, weekly, monthly, annual, exports) while keeping it fully available in full backups.'));

    container.appendChild(ui.el('div', { class: 'group-heading' }, 'Active entries — ' + activeEntries.length));
    if (!activeEntries.length) {
      container.appendChild(ui.el('div', { class: 'empty' }, 'No active entries.'));
    } else {
      var list = ui.el('div', { class: 'entry-list' });
      activeEntries.slice(0, 50).forEach(function (e) {
        list.appendChild(entryRow(e, false, onChange));
      });
      if (activeEntries.length > 50) {
        list.appendChild(ui.el('div', { class: 'text-faint', style: { fontSize: '11px', padding: '8px 4px' } },
          '…and ' + (activeEntries.length - 50) + ' more. Use the Annual view to browse everything.'));
      }
      container.appendChild(list);
    }

    container.appendChild(ui.el('div', { class: 'group-heading' }, 'Archived — ' + archivedEntries.length));
    if (!archivedEntries.length) {
      container.appendChild(ui.el('div', { class: 'empty' }, 'No archived entries.'));
    } else {
      var list2 = ui.el('div', { class: 'entry-list' });
      archivedEntries.forEach(function (e) {
        list2.appendChild(entryRow(e, true, onChange));
      });
      container.appendChild(list2);
    }

    return container;
  }

  function entryRow(e, isArchived, onChange) {
    return ui.el('div', { class: 'entry-card' + (e.status === 'draft' ? ' draft' : '') }, [
      ui.el('div', { class: 'row1' }, [
        ui.el('div', { class: 'title' }, e.title || '(untitled)'),
        ui.el('div', { class: 'date' }, e.date)
      ]),
      ui.el('div', { class: 'meta' }, [
        ui.statusBadge(e.status),
        ui.domainBadge(e.domain),
        ui.impactBadge(e.impact)
      ]),
      ui.el('div', { style: { marginTop: '8px', display: 'flex', gap: '6px' } }, [
        ui.el('button', { class: 'btn small subtle', onclick: function () {
          window.Uptrack.entry.open(e.id, { onChange: onChange });
        } }, 'Edit'),
        ui.el('button', { class: 'btn small', onclick: async function () {
          await db.archiveEntry(e.id, !isArchived);
          ui.toast(isArchived ? 'Entry restored' : 'Entry archived');
          onChange();
        } }, isArchived ? 'Restore' : 'Archive')
      ])
    ]);
  }

  function previewText(title, text) {
    var body = ui.el('div', null, [
      ui.el('pre', { class: 'code' }, text),
      ui.el('div', { class: 'form-actions' }, [
        ui.el('button', { class: 'btn', onclick: async function () {
          try { await navigator.clipboard.writeText(text); ui.toast('Copied to clipboard'); }
          catch (err) { ui.toast('Clipboard unavailable', 'error'); }
        } }, 'Copy to clipboard'),
        ui.el('button', { class: 'btn subtle', onclick: ui.closeModal }, 'Close')
      ])
    ]);
    ui.openModal(title, body);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.views = window.Uptrack.views || {};
  window.Uptrack.views.settings = { render: render };
})();
