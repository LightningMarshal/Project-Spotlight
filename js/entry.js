/* Entry creation/editing. Renders a form inside a modal with domain-specific
 * conditional fields. Supports quick-capture, draft saves, and complete promotion.
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
      interactionType: '',
      meetingDirection: '',
      individual: '',
      sentiment: '',
      developmentTheme: '',
      followUpAction: '',
      followUpDescription: '',
      followUpTargetDate: '',
      followUpDismissed: false,
      companyName: '',
      customerSentiment: '',
      escalationNumber: '',
      escalationUrl: '',
      projectNumber: '',
      projectUrl: '',
      archived: false
    };
  }

  async function quickCreate(title) {
    if (!title || !title.trim()) return null;
    var e = Object.assign(newEntryTemplate(), { title: title.trim(), status: 'draft' });
    var saved = await db.addEntry(e);
    ui.toast('Draft saved: "' + saved.title + '"');
    return saved;
  }

  function open(entryOrId, opts) {
    opts = opts || {};
    if (typeof entryOrId === 'number' || (typeof entryOrId === 'string' && entryOrId)) {
      db.getEntry(entryOrId).then(function (e) { render(e || newEntryTemplate(), opts); });
    } else {
      render(entryOrId || newEntryTemplate(), opts);
    }
  }

  async function render(entry, opts) {
    var working = JSON.parse(JSON.stringify(entry));
    if (!working.tags) working.tags = tax.emptyTags();
    if (!working.date) working.date = db.todayIso();
    if (!working.status) working.status = 'draft';

    /* Load roster for individual dropdowns */
    var roster = (await db.getSetting('roster')) || {};
    var allPeople = [];
    ['direct', 'indirect', 'leadership'].forEach(function (cat) {
      (roster[cat] || []).forEach(function (name) {
        if (allPeople.indexOf(name) === -1) allPeople.push(name);
      });
    });
    allPeople.sort();

    var titleInput = ui.el('input', {
      type: 'text',
      value: working.title || '',
      placeholder: 'What did you accomplish?',
      oninput: function (e) { working.title = e.target.value; }
    });

    var descArea = ui.el('textarea', {
      placeholder: 'Freeform context — what happened, why it matters, outcomes, people involved…',
      oninput: function (e) { working.description = e.target.value; }
    }, working.description || '');

    var dateInput = ui.el('input', {
      type: 'date',
      value: working.date,
      onchange: function (e) { working.date = e.target.value || db.todayIso(); }
    });

    /* Domain segmented */
    function segButton(cls, label, onSelect, active) {
      return ui.el('button', {
        type: 'button',
        class: 'seg ' + (cls || '') + (active ? ' active' : ''),
        onclick: function (ev) {
          ev.currentTarget.parentNode.querySelectorAll('.seg').forEach(function (b) { b.classList.remove('active'); });
          ev.currentTarget.classList.add('active');
          onSelect(label);
        }
      }, label);
    }

    var domainFieldsContainer = ui.el('div', null);

    var domainSeg = ui.el('div', { class: 'segmented' },
      tax.DOMAINS.map(function (d) {
        return segButton('', d, function (v) {
          working.domain = v;
          renderDomainFields();
        }, working.domain === d);
      })
    );

    var impactSeg = ui.el('div', { class: 'segmented' },
      tax.IMPACT_LEVELS.map(function (i) {
        return segButton(tax.IMPACT_CLASS[i], i, function (v) { working.impact = v; }, working.impact === i);
      })
    );

    function tagGroup(taxKey) {
      var spec = tax.TAXONOMIES[taxKey];
      var chips = spec.items.map(function (item) {
        var active = working.tags[taxKey].indexOf(item) !== -1;
        return ui.el('button', {
          type: 'button',
          class: 'tag-toggle' + (active ? ' active' : ''),
          'data-tax': taxKey,
          onclick: function (ev) {
            var arr = working.tags[taxKey];
            var idx = arr.indexOf(item);
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

    function makeSelect(options, value, placeholder, onChange) {
      return ui.el('select', { onchange: onChange }, [
        ui.el('option', { value: '' }, placeholder),
        ...options.map(function (o) {
          return ui.el('option', { value: o, selected: value === o }, o);
        })
      ]);
    }

    /* ---------- Domain-specific fields ---------- */

    function renderDomainFields() {
      ui.clear(domainFieldsContainer);
      var dom = working.domain;

      if (dom === 'People Management') {
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row' }, [
          ui.el('label', null, 'People Management Details')
        ]));
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row form-row-triple' }, [
          ui.el('div', null, [
            ui.el('label', null, 'Interaction Type'),
            makeSelect(tax.INTERACTION_TYPES, working.interactionType, 'Select type…', function (e) { working.interactionType = e.target.value; })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Meeting Direction'),
            makeSelect(tax.MEETING_DIRECTIONS, working.meetingDirection, 'Select…', function (e) { working.meetingDirection = e.target.value; })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Individual'),
            allPeople.length
              ? makeSelect(allPeople, working.individual, 'Select person…', function (e) { working.individual = e.target.value; })
              : ui.el('input', { type: 'text', value: working.individual || '', placeholder: 'Name (add to roster in Settings)', oninput: function (e) { working.individual = e.target.value; } })
          ])
        ]));
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row form-row-split' }, [
          ui.el('div', null, [
            ui.el('label', null, 'Sentiment'),
            makeSelect(tax.SENTIMENTS, working.sentiment, 'Select…', function (e) { working.sentiment = e.target.value; })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Development Theme'),
            makeSelect(tax.DEVELOPMENT_THEMES, working.developmentTheme, 'Select…', function (e) { working.developmentTheme = e.target.value; })
          ])
        ]));
        /* Follow-up action */
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row' }, [
          ui.el('label', null, 'Follow-Up Action'),
          ui.el('input', { type: 'text', value: working.followUpAction || '', placeholder: 'Action item (leave blank if none)', oninput: function (e) { working.followUpAction = e.target.value; } })
        ]));
        if (working.followUpAction) {
          domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row form-row-split' }, [
            ui.el('div', null, [
              ui.el('label', null, 'Follow-Up Description'),
              ui.el('input', { type: 'text', value: working.followUpDescription || '', placeholder: 'Details…', oninput: function (e) { working.followUpDescription = e.target.value; } })
            ]),
            ui.el('div', null, [
              ui.el('label', null, 'Target Date'),
              ui.el('input', { type: 'date', value: working.followUpTargetDate || '', onchange: function (e) { working.followUpTargetDate = e.target.value; } })
            ])
          ]));
        }

      } else if (dom === 'Client Facing') {
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row' }, [
          ui.el('label', null, 'Client Facing Details')
        ]));
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row form-row-triple' }, [
          ui.el('div', null, [
            ui.el('label', null, 'Interaction Type'),
            makeSelect(tax.INTERACTION_TYPES, working.interactionType, 'Select type…', function (e) { working.interactionType = e.target.value; })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Company Name'),
            ui.el('input', { type: 'text', value: working.companyName || '', placeholder: 'Client company…', oninput: function (e) { working.companyName = e.target.value; } })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Individual'),
            allPeople.length
              ? makeSelect(allPeople, working.individual, 'Select person…', function (e) { working.individual = e.target.value; })
              : ui.el('input', { type: 'text', value: working.individual || '', placeholder: 'Contact name…', oninput: function (e) { working.individual = e.target.value; } })
          ])
        ]));
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row form-row-split' }, [
          ui.el('div', null, [
            ui.el('label', null, 'Customer Sentiment'),
            makeSelect(tax.CUSTOMER_SENTIMENTS, working.customerSentiment, 'Select…', function (e) {
              working.customerSentiment = e.target.value;
              renderDomainFields(); // re-render to show/hide escalation
            })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Follow-Up Action'),
            ui.el('input', { type: 'text', value: working.followUpAction || '', placeholder: 'Action item…', oninput: function (e) { working.followUpAction = e.target.value; } })
          ])
        ]));
        /* Conditional escalation fields — show when sentiment is Dissatisfied or Very Dissatisfied */
        if (working.customerSentiment === 'Dissatisfied' || working.customerSentiment === 'Very Dissatisfied') {
          domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row form-row-split' }, [
            ui.el('div', null, [
              ui.el('label', null, 'Escalation Number'),
              ui.el('input', { type: 'text', value: working.escalationNumber || '', placeholder: 'Ticket/case number…', oninput: function (e) { working.escalationNumber = e.target.value; } })
            ]),
            ui.el('div', null, [
              ui.el('label', null, 'Escalation URL'),
              ui.el('input', { type: 'url', value: working.escalationUrl || '', placeholder: 'https://…', oninput: function (e) { working.escalationUrl = e.target.value; } })
            ])
          ]));
        }

      } else if (dom === 'Project') {
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row' }, [
          ui.el('label', null, 'Project Details')
        ]));
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row form-row-split' }, [
          ui.el('div', null, [
            ui.el('label', null, 'Project Number'),
            ui.el('input', { type: 'text', value: working.projectNumber || '', placeholder: 'PRJ-001…', oninput: function (e) { working.projectNumber = e.target.value; } })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Project URL'),
            ui.el('input', { type: 'url', value: working.projectUrl || '', placeholder: 'https://…', oninput: function (e) { working.projectUrl = e.target.value; } })
          ])
        ]));
      }
      // Operations has no additional fields
    }

    /* Build form */
    var form = ui.el('div', { class: 'form', style: { border: 'none', padding: 0 } }, [
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
      domainFieldsContainer,
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
              var saved = await db.saveEntry(working);
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
              var saved = await db.saveEntry(working);
              working.id = saved.id;
              ui.toast('Entry saved as complete');
              if (window.Uptrack.rewards) window.Uptrack.rewards.fire();
              if (opts.onChange) opts.onChange(saved);
              ui.closeModal();
            }
          }, 'Save as complete')
        ])
      ])
    ]);

    /* Render initial domain fields */
    renderDomainFields();

    var title = working.id ? 'Edit entry' : 'New entry';
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
