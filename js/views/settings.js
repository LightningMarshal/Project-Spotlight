/* Settings view: taxonomy reference notes, performance review export,
 * archive management, full backup, restore.
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;
  const landing = window.Uptrack.views && window.Uptrack.views.landing;
  const filters = window.Uptrack.filters;

  const BACKUP_NAG_DAYS = 14;

  async function render(root) {
    ui.clear(root);

    const [notes, allEntries, archivedEntries, lastBackupAt] = await Promise.all([
      db.getAllTaxonomyNotes(),
      db.getAllEntries(),
      db.getAllEntries({ includeArchived: true }).then(function (a) { return a.filter(function (e) { return e.archived; }); }),
      db.getSetting('lastBackupAt')
    ]);

    root.appendChild(ui.el('div', { class: 'page-header' }, [
      ui.el('div', null, [
        ui.el('h1', { class: 'page-title' }, 'Settings'),
        ui.el('div', { class: 'page-sub' }, 'Reference notes, archive, backup, review export')
      ])
    ]));

    /* Backup nag — surfaces when backup is missing or stale. */
    const nag = renderBackupNag(lastBackupAt, function () { render(root); });
    if (nag) root.appendChild(nag);

    /* Performance Review export */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Performance review export'));
    root.appendChild(renderReviewCard(allEntries));

    /* Full backup */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Backup & restore'));
    root.appendChild(renderBackupCard(function () { render(root); }));

    /* Taxonomy notes */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Taxonomy reference notes'));
    root.appendChild(ui.el('div', { class: 'text-faint mb', style: { fontSize: '12px' } },
      'Capture personal context for any taxonomy item (examples, meaning, how you interpret it).'));
    root.appendChild(renderNotesPanel(notes));

    /* Archive management */
    root.appendChild(ui.el('h2', { class: 'section-title' }, 'Entry archive — ' + archivedEntries.length));
    root.appendChild(renderArchivePanel(allEntries, archivedEntries, function () { render(root); }));
  }

  function renderReviewCard(allEntries) {
    let pickState = {
      filters: (function () {
        const f = filters.emptyFilterState();
        f.status = 'complete';
        return f;
      })()
    };

    const statusLabel = ui.el('div', { class: 'text-faint', style: { fontSize: '12px' } }, '0 entries selected');

    function recount() {
      const matched = filters.apply(allEntries, pickState.filters);
      statusLabel.textContent = matched.length + ' entries matched';
      return matched;
    }

    const panel = filters.renderPanel({
      initial: pickState.filters,
      showDateRange: true,
      showStatus: true,
      onChange: function (f) { pickState.filters = f; recount(); }
    });

    const card = ui.el('div', { class: 'form' }, [
      ui.el('div', { class: 'text-dim mb', style: { fontSize: '13px' } },
        'Produces a pre-structured text document grouped by company value, then by culture tenet. Use it as the input to a performance review questionnaire.'),
      panel.node,
      statusLabel,
      ui.el('div', { class: 'form-actions' }, [
        ui.el('div', null),
        ui.el('div', { class: 'btn-row' }, [
          ui.el('button', { class: 'btn', onclick: function () {
            const matched = recount();
            const text = window.Uptrack.export.reviewText(matched, pickState.filters);
            previewText('Review export preview', text);
          } }, 'Preview'),
          ui.el('button', { class: 'btn primary', onclick: function () {
            const matched = recount();
            if (!matched.length) { ui.toast('No entries matched', 'warn'); return; }
            window.Uptrack.export.runReviewExport(matched, pickState.filters);
          } }, 'Download review export')
        ])
      ])
    ]);
    recount();
    return card;
  }

  function renderBackupCard(onChange) {
    const note = ui.el('div', { class: 'text-faint', style: { fontSize: '12px', marginTop: '8px' } });

    const restoreInput = ui.el('input', {
      type: 'file',
      accept: '.json',
      style: { display: 'none' },
      onchange: async function (e) {
        const f = e.target.files[0];
        if (!f) return;
        const text = await f.text();
        let payload;
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
        'Export a single JSON file containing every entry, people management log, and reference note. Use it for safekeeping or for migrating to a new machine.'),
      ui.el('div', { class: 'form-actions' }, [
        note,
        ui.el('div', { class: 'btn-row' }, [
          ui.el('button', { class: 'btn primary', onclick: async function () {
            await window.Uptrack.export.runFullBackup();
            const now = new Date();
            await db.setSetting('lastBackupAt', now.toISOString());
            note.textContent = 'Backup generated ' + now.toLocaleString();
            ui.toast('Backup downloaded');
            /* Re-render the parent Settings view so the 14-day nag clears. */
            onChange();
          } }, 'Download full backup'),
          ui.el('button', { class: 'btn', onclick: function () { restoreInput.click(); } }, 'Restore from backup'),
          restoreInput
        ])
      ])
    ]);
  }

  /* 14-day backup nag card. Returns null if not needed. */
  function renderBackupNag(lastBackupAt, onBackupDone) {
    let message;
    if (!lastBackupAt) {
      message = 'You have never backed up. On file:// origins, browser storage can be cleared unexpectedly — download a backup now to protect your data.';
    } else {
      const ageMs = Date.now() - new Date(lastBackupAt).getTime();
      const ageDays = Math.floor(ageMs / 86400000);
      if (ageDays < BACKUP_NAG_DAYS) return null;
      message = 'Your last backup was ' + ageDays + ' days ago. On file:// origins, browser storage can be cleared unexpectedly — download a fresh backup now.';
    }

    return ui.el('div', {
      class: 'form',
      style: {
        borderLeft: '3px solid var(--draft)',
        marginBottom: '20px',
        background: 'linear-gradient(to right, rgba(201,161,90,0.06), var(--surface) 30%)'
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

  function renderNotesPanel(notes) {
    const container = ui.el('div', { class: 'form' });
    for (const taxKey of tax.TAXONOMY_KEYS) {
      const spec = tax.TAXONOMIES[taxKey];
      container.appendChild(ui.el('div', { class: 'group-heading' }, spec.label));
      const grid = ui.el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' } });
      for (const item of spec.items) {
        const key = taxKey + ':' + item;
        const textarea = ui.el('textarea', {
          placeholder: 'Your notes for "' + item + '"…',
          style: { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 10px', minHeight: '58px', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' },
          onblur: async function (e) {
            await db.setTaxonomyNote(key, e.target.value);
            ui.toast('Notes saved');
          }
        }, notes[key] || '');
        grid.appendChild(ui.el('div', null, [
          ui.el('div', { class: 'chip tax-' + taxKey, style: { marginBottom: '6px' } }, item),
          textarea
        ]));
      }
      container.appendChild(grid);
    }
    return container;
  }

  function renderArchivePanel(activeEntries, archivedEntries, onChange) {
    const container = ui.el('div', { class: 'form' });

    container.appendChild(ui.el('div', { class: 'text-dim', style: { fontSize: '13px' } },
      'Archive removes an entry from active views (landing, weekly, monthly, annual, exports) while keeping it fully available in full backups.'));

    /* Active entries with archive buttons */
    container.appendChild(ui.el('div', { class: 'group-heading' }, 'Active entries — ' + activeEntries.length));
    if (!activeEntries.length) {
      container.appendChild(ui.el('div', { class: 'empty' }, 'No active entries.'));
    } else {
      const list = ui.el('div', { class: 'entry-list' });
      activeEntries.slice(0, 50).forEach(function (e) {
        list.appendChild(entryRow(e, false, onChange));
      });
      if (activeEntries.length > 50) {
        list.appendChild(ui.el('div', { class: 'text-faint', style: { fontSize: '11px', padding: '8px 4px' } },
          '…and ' + (activeEntries.length - 50) + ' more. Use the Annual view to browse everything.'));
      }
      container.appendChild(list);
    }

    /* Archived list */
    container.appendChild(ui.el('div', { class: 'group-heading' }, 'Archived — ' + archivedEntries.length));
    if (!archivedEntries.length) {
      container.appendChild(ui.el('div', { class: 'empty' }, 'No archived entries.'));
    } else {
      const list = ui.el('div', { class: 'entry-list' });
      archivedEntries.forEach(function (e) {
        list.appendChild(entryRow(e, true, onChange));
      });
      container.appendChild(list);
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
    const body = ui.el('div', null, [
      ui.el('pre', { class: 'code' }, text),
      ui.el('div', { class: 'form-actions' }, [
        ui.el('button', { class: 'btn', onclick: async function () {
          try { await navigator.clipboard.writeText(text); ui.toast('Copied to clipboard'); }
          catch (e) { ui.toast('Clipboard unavailable', 'error'); }
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
