/* Settings view: roster management, appearance & reward toggles,
 * performance review export, archive management, full backup/restore.
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const filters = window.Uptrack.filters;

  const ROSTER_CATEGORIES = [
    { key: 'direct',     label: 'Direct Managers' },
    { key: 'indirect',   label: 'Indirect Managers' },
    { key: 'leadership', label: 'Leadership' }
  ];

  async function render(root) {
    ui.clear(root);

    const [allEntries, archivedEntries, lastBackupAt, roster, audioEnabled, confettiEnabled, themePack, themeMode, soundTheme] = await Promise.all([
      db.getAllEntries(),
      db.getAllEntries({ includeArchived: true }).then(function (a) { return a.filter(function (e) { return e.archived; }); }),
      db.getSetting('lastBackupAt'),
      db.getSetting('roster'),
      db.getSetting('audioEnabled'),
      db.getSetting('confettiEnabled'),
      db.getSetting('themePack'),
      db.getSetting('themeMode'),
      db.getSetting('soundTheme')
    ]);

    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Settings'),
        ui.el('div', { class: 'page-sub' }, 'Roster, appearance, backup, review export, archive')
      ])
    ]));

    /* Backup nag */
    const nag = window.Uptrack.export.renderBackupNag(lastBackupAt, function () { render(root); });
    if (nag) root.appendChild(nag);

    /* Appearance & reward toggles */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Appearance & rewards'));
    root.appendChild(renderToggles(
      {
        audio: audioEnabled,
        confetti: confettiEnabled,
        themePack: themePack || 'arctic',
        themeMode: themeMode || 'dark',
        soundTheme: soundTheme || 'chime'
      },
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

    /* Sound theme selector + preview button */
    var rewards = window.Uptrack.rewards || {};
    var themes = rewards.SOUND_THEMES || {};
    var themeKeys = Object.keys(themes);

    var soundSelect = ui.el('select', {
      style: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' },
      onchange: async function (e) {
        if (rewards.playTheme) rewards.playTheme(e.target.value);
        try {
          await db.setSetting('soundTheme', e.target.value);
        } catch (err) {
          ui.toast('Storage error — sound theme not saved: ' + (err && err.message || 'unknown'), 'error');
        }
      }
    }, themeKeys.map(function (k) {
      return ui.el('option', { value: k, selected: state.soundTheme === k }, themes[k].label);
    }));

    var previewSoundBtn = ui.el('button', {
      class: 'btn small',
      onclick: function () {
        if (rewards.playTheme) rewards.playTheme(soundSelect.value);
      }
    }, 'Preview');

    var soundRow = ui.el('div', { class: 'toggle-row' }, [
      ui.el('div', null, [
        ui.el('div', { class: 'toggle-label' }, 'Reward sound'),
        ui.el('div', { class: 'toggle-desc' }, 'Choose the audio chime theme played when saving as complete')
      ]),
      ui.el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
        soundSelect,
        previewSoundBtn
      ])
    ]);

    /* Confetti preview button */
    var previewConfettiBtn = ui.el('button', {
      class: 'btn small',
      onclick: function () {
        if (rewards.burstConfetti) rewards.burstConfetti();
      }
    }, 'Preview confetti');

    /* Theme pack dropdown */
    var THEME_PACKS = [
      { key: 'arctic',     label: 'Arctic Wolf — amber on deep navy' },
      { key: 'futuristic', label: 'Futuristic — cyan neon on near-black' },
      { key: 'minimal',    label: 'Minimal — clean typography, restrained' }
    ];
    var packSelect = ui.el('select', {
      style: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' },
      onchange: async function (e) {
        /* Apply immediately even if persistence fails — it works for the
         * session; the toast tells the user the preference won't stick. */
        document.documentElement.setAttribute('data-theme-pack', e.target.value);
        try {
          await db.setSetting('themePack', e.target.value);
        } catch (err) {
          ui.toast('Storage error — theme not saved: ' + (err && err.message || 'unknown'), 'error');
        }
      }
    }, THEME_PACKS.map(function (p) {
      return ui.el('option', { value: p.key, selected: state.themePack === p.key }, p.label);
    }));

    /* Theme mode dropdown */
    var THEME_MODES = [
      { key: 'dark',   label: 'Dark' },
      { key: 'light',  label: 'Light' },
      { key: 'system', label: 'Follow system' }
    ];
    var modeSelect = ui.el('select', {
      style: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' },
      onchange: async function (e) {
        document.documentElement.setAttribute('data-theme-mode', e.target.value);
        try {
          await db.setSetting('themeMode', e.target.value);
        } catch (err) {
          ui.toast('Storage error — mode not saved: ' + (err && err.message || 'unknown'), 'error');
        }
      }
    }, THEME_MODES.map(function (m) {
      return ui.el('option', { value: m.key, selected: state.themeMode === m.key }, m.label);
    }));

    var themePackRow = ui.el('div', { class: 'toggle-row' }, [
      ui.el('div', null, [
        ui.el('div', { class: 'toggle-label' }, 'Theme pack'),
        ui.el('div', { class: 'toggle-desc' }, 'Visual identity — takes effect immediately')
      ]),
      packSelect
    ]);

    var themeModeRow = ui.el('div', { class: 'toggle-row' }, [
      ui.el('div', null, [
        ui.el('div', { class: 'toggle-label' }, 'Mode'),
        ui.el('div', { class: 'toggle-desc' }, 'Light / dark, or follow the OS preference')
      ]),
      modeSelect
    ]);

    var container = ui.el('div', { class: 'form' }, [
      themePackRow,
      themeModeRow,
      toggle('Audio chime', 'Play a chime when saving an entry as complete', state.audio !== false, async function (on) {
        try {
          await db.setSetting('audioEnabled', on);
        } catch (err) {
          ui.toast('Storage error — setting not saved: ' + (err && err.message || 'unknown'), 'error');
        }
      }),
      soundRow,
      toggle('Confetti', 'Show confetti animation when saving an entry as complete', state.confetti !== false, async function (on) {
        try {
          await db.setSetting('confettiEnabled', on);
        } catch (err) {
          ui.toast('Storage error — setting not saved: ' + (err && err.message || 'unknown'), 'error');
        }
      }),
      ui.el('div', { class: 'toggle-row' }, [
        ui.el('div', null, [
          ui.el('div', { class: 'toggle-label' }, 'Preview effects'),
          ui.el('div', { class: 'toggle-desc' }, 'Test the confetti animation without saving an entry')
        ]),
        previewConfettiBtn
      ])
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
              var removed = people.splice(idx, 1);
              roster[cat.key] = people;
              try {
                await db.setSetting('roster', roster);
              } catch (err) {
                people.splice(idx, 0, removed[0]); /* roll back so UI matches storage */
                ui.toast('Storage error — roster not saved: ' + (err && err.message || 'unknown'), 'error');
                return;
              }
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
        try {
          await db.setSetting('roster', roster);
        } catch (err) {
          people.splice(people.indexOf(name), 1); /* roll back; keep the typed name */
          ui.toast('Storage error — roster not saved: ' + (err && err.message || 'unknown'), 'error');
          return;
        }
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
            try {
              await window.Uptrack.export.runFullBackup();
              var now = new Date();
              await db.setSetting('lastBackupAt', now.toISOString());
              note.textContent = 'Backup generated ' + now.toLocaleString();
              ui.toast('Backup downloaded');
              onChange();
            } catch (err) {
              ui.toast('Backup failed: ' + (err && err.message || 'unknown'), 'error');
            }
          } }, 'Download full backup'),
          ui.el('button', { class: 'btn', onclick: function () { restoreInput.click(); } }, 'Restore from backup'),
          restoreInput
        ])
      ])
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
          try {
            await db.archiveEntry(e.id, !isArchived);
            ui.toast(isArchived ? 'Entry restored' : 'Entry archived');
            onChange();
          } catch (err) {
            ui.toast('Storage error — could not update: ' + (err && err.message || 'unknown'), 'error');
          }
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
