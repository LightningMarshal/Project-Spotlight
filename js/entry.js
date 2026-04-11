/* Entry creation/editing. Renders a form inside a modal, supports quick-capture,
 * draft saves, and complete promotion.
 */
(function () {
  'use strict';

  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const tax = window.Uptrack.tax;

  function newEntryTemplate() {
    return {
      title: '',
      description: '',
      status: 'draft',
      domain: '',
      impact: '',
      date: db.todayIso(),
      tags: tax.emptyTags(),
      archived: false
    };
  }

  /* Quick capture: creates a draft with just a title and the defaults. */
  async function quickCreate(title) {
    if (!title || !title.trim()) return null;
    const e = Object.assign(newEntryTemplate(), { title: title.trim(), status: 'draft' });
    const saved = await db.addEntry(e);
    ui.toast('Draft saved: "' + saved.title + '"');
    return saved;
  }

  /* Open the full entry form modal. entry may be null for new, or an existing record. */
  function open(entryOrId, opts) {
    opts = opts || {};
    if (typeof entryOrId === 'number' || (typeof entryOrId === 'string' && entryOrId)) {
      db.getEntry(entryOrId).then(function (e) { render(e || newEntryTemplate(), opts); });
    } else {
      render(entryOrId || newEntryTemplate(), opts);
    }
  }

  function render(entry, opts) {
    const working = JSON.parse(JSON.stringify(entry));
    if (!working.tags) working.tags = tax.emptyTags();
    if (!working.date) working.date = db.todayIso();
    if (!working.status) working.status = 'draft';

    const titleInput = ui.el('input', {
      type: 'text',
      value: working.title || '',
      placeholder: 'What did you accomplish?',
      oninput: function (e) { working.title = e.target.value; }
    });

    const descArea = ui.el('textarea', {
      placeholder: 'Freeform context — what happened, why it matters, outcomes, people involved…',
      oninput: function (e) { working.description = e.target.value; }
    }, working.description || '');

    const dateInput = ui.el('input', {
      type: 'date',
      value: working.date,
      onchange: function (e) { working.date = e.target.value || db.todayIso(); }
    });

    /* domain segmented */
    function segButton(cls, label, onSelect, active) {
      return ui.el('button', {
        type: 'button',
        class: 'seg ' + (cls || '') + (active ? ' active' : ''),
        onclick: function (ev) {
          const parent = ev.currentTarget.parentNode;
          parent.querySelectorAll('.seg').forEach(function (b) { b.classList.remove('active'); });
          ev.currentTarget.classList.add('active');
          onSelect(label);
        }
      }, label);
    }

    const domainSeg = ui.el('div', { class: 'segmented' },
      tax.DOMAINS.map(function (d) {
        return segButton('', d, function (v) { working.domain = v; }, working.domain === d);
      })
    );

    const impactSeg = ui.el('div', { class: 'segmented' },
      tax.IMPACT_LEVELS.map(function (i) {
        return segButton(tax.IMPACT_CLASS[i], i, function (v) { working.impact = v; }, working.impact === i);
      })
    );

    function tagGroup(taxKey) {
      const spec = tax.TAXONOMIES[taxKey];
      const chips = spec.items.map(function (item) {
        const active = working.tags[taxKey].indexOf(item) !== -1;
        return ui.el('button', {
          type: 'button',
          class: 'tag-toggle' + (active ? ' active' : ''),
          'data-tax': taxKey,
          onclick: function (ev) {
            const arr = working.tags[taxKey];
            const idx = arr.indexOf(item);
            if (idx === -1) arr.push(item); else arr.splice(idx, 1);
            ev.currentTarget.classList.toggle('active');
          }
        }, item);
      });
      return ui.el('div', { class: 'tag-group' }, [
        ui.el('div', { class: 'tag-group-label' }, spec.label),
        ui.el('div', { class: 'tag-grid' }, chips)
      ]);
    }

    const form = ui.el('div', { class: 'form', style: { border: 'none', padding: 0 } }, [
      ui.el('div', { class: 'form-row' }, [
        ui.el('label', null, 'Title'),
        titleInput
      ]),
      ui.el('div', { class: 'form-row' }, [
        ui.el('label', null, 'Description'),
        descArea
      ]),
      ui.el('div', { class: 'form-row form-row-split' }, [
        ui.el('div', null, [ui.el('label', null, 'Domain'), domainSeg]),
        ui.el('div', null, [ui.el('label', null, 'Impact'), impactSeg])
      ]),
      ui.el('div', { class: 'form-row' }, [
        ui.el('label', null, 'Date'),
        dateInput
      ]),
      ui.el('div', { class: 'form-row' }, [
        ui.el('label', null, 'Tags'),
        tagGroup('values'),
        tagGroup('tenets'),
        tagGroup('principles')
      ]),
      ui.el('div', { class: 'form-actions' }, [
        ui.el('div', null,
          working.id ? ui.el('button', {
            class: 'btn danger small',
            onclick: function () {
              ui.confirmDialog('Delete this entry? This cannot be undone.', async function () {
                await db.deleteEntry(working.id);
                ui.toast('Entry deleted', 'warn');
                if (opts.onChange) opts.onChange();
              });
            }
          }, 'Delete') : null
        ),
        ui.el('div', { class: 'btn-row' }, [
          ui.el('button', {
            class: 'btn subtle',
            onclick: ui.closeModal
          }, 'Cancel'),
          ui.el('button', {
            class: 'btn',
            onclick: async function () {
              if (!working.title.trim()) { ui.toast('Title is required', 'warn'); return; }
              working.status = 'draft';
              const saved = await db.saveEntry(working);
              working.id = saved.id;
              ui.toast('Draft saved');
              if (opts.onChange) opts.onChange(saved);
              ui.closeModal();
            }
          }, 'Save draft'),
          ui.el('button', {
            class: 'btn primary',
            onclick: async function () {
              if (!working.title.trim()) { ui.toast('Title is required', 'warn'); return; }
              if (!working.domain) { ui.toast('Choose a domain before completing', 'warn'); return; }
              if (!working.impact) { ui.toast('Choose an impact level before completing', 'warn'); return; }
              working.status = 'complete';
              const saved = await db.saveEntry(working);
              working.id = saved.id;
              ui.toast('Entry saved as complete');
              if (opts.onChange) opts.onChange(saved);
              ui.closeModal();
            }
          }, 'Save as complete')
        ])
      ])
    ]);

    const title = working.id ? 'Edit entry' : 'New entry';
    ui.openModal(title, form, { persistent: false });
    setTimeout(function () { titleInput.focus(); }, 40);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.entry = {
    open: open,
    quickCreate: quickCreate,
    newEntryTemplate: newEntryTemplate
  };
})();
