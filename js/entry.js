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
      interactionTypeOther: '',
      meetingDirection: '',
      individual: '',
      sentiment: '',
      developmentTheme: '',
      developmentThemeOther: '',
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
    try {
      var saved = await db.addEntry(e);
      ui.toast('Draft saved: "' + saved.title + '"');
      return saved;
    } catch (err) {
      ui.toast('Storage error — draft not saved: ' + (err && err.message || 'unknown'), 'error');
      return null;
    }
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
      placeholder: 'What happened, why it matters, outcomes, people involved…',
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

    var domainSeg = ui.el('div', { class: 'segmented domain-grid' },
      tax.DOMAINS.map(function (d) {
        return segButton('', d, function (v) {
          working.domain = v;
          /* interactionType is shared between People Management and Client
           * Facing but each uses its own enum — drop a value that isn't
           * valid for the newly selected domain so it can't be saved into
           * the wrong bucket. ("Other" exists in both lists and survives.) */
          var validTypes = v === 'People Management' ? tax.INTERACTION_TYPES_PEOPLE
            : (v === 'Client Facing' ? tax.INTERACTION_TYPES_CLIENT : []);
          if (working.interactionType && validTypes.indexOf(working.interactionType) === -1) {
            working.interactionType = '';
            working.interactionTypeOther = '';
          }
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

    /* Select whose enum contains an "Other" option. When "Other" is the
     * current value, a companion text input is revealed so the user can
     * specify what the "Other" actually is. The main select continues to
     * store the raw enum value — this preserves chart bucketing — while
     * the custom label lives in a companion field. */
    function makeSelectWithOther(options, value, otherValue, placeholder, onSelect, onOtherChange) {
      var textInput = ui.el('input', {
        type: 'text',
        value: otherValue || '',
        placeholder: 'Specify…',
        style: { marginTop: '6px' },
        oninput: function (e) { onOtherChange(e.target.value); }
      });
      if (value !== 'Other') textInput.style.display = 'none';

      var select = ui.el('select', {
        onchange: function (e) {
          onSelect(e.target.value);
          if (e.target.value === 'Other') {
            textInput.style.display = '';
            setTimeout(function () { textInput.focus(); }, 20);
          } else {
            textInput.style.display = 'none';
          }
        }
      }, [
        ui.el('option', { value: '' }, placeholder),
        ...options.map(function (o) {
          return ui.el('option', { value: o, selected: value === o }, o);
        })
      ]);

      return ui.el('div', null, [select, textInput]);
    }

    /* Individual select with "Other…" synthesized onto the end of the
     * roster. Typed name writes directly to `working.individual`, since
     * Individual is free-form by nature. On re-edit, a stored value that
     * isn't in the roster is treated as an "Other…" selection with the
     * stored value pre-filled. */
    function makeIndividualField(roster, current, placeholder, onChange) {
      var isOther = !!current && roster.indexOf(current) === -1;
      var displayVal = isOther ? 'Other…' : current;
      var rosterWithOther = roster.concat(['Other…']);

      var textInput = ui.el('input', {
        type: 'text',
        value: isOther ? current : '',
        placeholder: 'Name…',
        style: { marginTop: '6px' },
        oninput: function (e) { onChange(e.target.value); }
      });
      if (!isOther) textInput.style.display = 'none';

      var select = ui.el('select', {
        onchange: function (e) {
          var v = e.target.value;
          if (v === 'Other…') {
            textInput.style.display = '';
            onChange(textInput.value || '');
            setTimeout(function () { textInput.focus(); }, 20);
          } else {
            textInput.style.display = 'none';
            onChange(v);
          }
        }
      }, [
        ui.el('option', { value: '' }, placeholder),
        ...rosterWithOther.map(function (o) {
          return ui.el('option', { value: o, selected: displayVal === o }, o);
        })
      ]);

      return ui.el('div', null, [select, textInput]);
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
            makeSelectWithOther(
              tax.INTERACTION_TYPES_PEOPLE,
              working.interactionType,
              working.interactionTypeOther,
              'Select type…',
              function (v) { working.interactionType = v; if (v !== 'Other') working.interactionTypeOther = ''; },
              function (v) { working.interactionTypeOther = v; }
            )
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Meeting Direction'),
            makeSelect(tax.MEETING_DIRECTIONS, working.meetingDirection, 'Select…', function (e) { working.meetingDirection = e.target.value; })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Individual'),
            makeIndividualField(allPeople, working.individual, allPeople.length ? 'Select person…' : 'Name…', function (v) { working.individual = v; })
          ])
        ]));
        domainFieldsContainer.appendChild(ui.el('div', { class: 'form-row form-row-split' }, [
          ui.el('div', null, [
            ui.el('label', null, 'Sentiment'),
            makeSelect(tax.SENTIMENTS, working.sentiment, 'Select…', function (e) { working.sentiment = e.target.value; })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Development Theme'),
            makeSelectWithOther(
              tax.DEVELOPMENT_THEMES,
              working.developmentTheme,
              working.developmentThemeOther,
              'Select…',
              function (v) { working.developmentTheme = v; if (v !== 'Other') working.developmentThemeOther = ''; },
              function (v) { working.developmentThemeOther = v; }
            )
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
            makeSelectWithOther(
              tax.INTERACTION_TYPES_CLIENT,
              working.interactionType,
              working.interactionTypeOther,
              'Select type…',
              function (v) { working.interactionType = v; if (v !== 'Other') working.interactionTypeOther = ''; },
              function (v) { working.interactionTypeOther = v; }
            )
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Company Name'),
            ui.el('input', { type: 'text', value: working.companyName || '', placeholder: 'Client company…', oninput: function (e) { working.companyName = e.target.value; } })
          ]),
          ui.el('div', null, [
            ui.el('label', null, 'Individual'),
            makeIndividualField(allPeople, working.individual, allPeople.length ? 'Select person…' : 'Contact name…', function (v) { working.individual = v; })
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
        ui.el('div', null, [
          ui.el('label', null, 'Impact'), impactSeg,
          ui.el('label', { style: { marginTop: '14px' } }, 'Date'), dateInput
        ])
      ]),
      domainFieldsContainer,
      ui.el('div', { class: 'form-row' }, [
        ui.el('label', null, 'Tags'),
        tagGroup('values'),
        tagGroup('tenets'),
        tagGroup('principles')
      ]),
      ui.el('div', { class: 'form-actions' }, [
        ui.el('div', { class: 'btn-row' }, working.id ? [
          ui.el('button', {
            class: 'btn small',
            onclick: function () {
              /* Duplicate what's on screen, including unsaved edits. Close
               * via ui.closeModal() directly (like the save buttons) so the
               * unsaved-changes guard doesn't fire — nothing is discarded,
               * it's carried into the copy. */
              var copy = JSON.parse(JSON.stringify(working));
              delete copy.id;
              delete copy.createdAt; /* fresh timestamps — normalizeEntry keeps createdAt when present */
              delete copy.updatedAt;
              copy.date = db.todayIso();
              copy.status = 'draft';
              copy.followUpDismissed = false;
              ui.closeModal();
              open(copy, { onChange: opts.onChange });
            }
          }, 'Duplicate'),
          ui.el('button', {
            class: 'btn danger small',
            onclick: function () {
              ui.confirmDialog('Delete this entry? This cannot be undone.', async function () {
                try {
                  await db.deleteEntry(working.id);
                  ui.toast('Entry deleted', 'warn');
                  if (window.Uptrack.app) window.Uptrack.app.refreshNavBadge();
                  if (opts.onChange) opts.onChange();
                } catch (err) {
                  ui.toast('Storage error — could not delete: ' + (err && err.message || 'unknown'), 'error');
                }
              });
            }
          }, 'Delete')
        ] : null),
        ui.el('div', { class: 'btn-row' }, [
          ui.el('button', {
            class: 'btn subtle',
            onclick: function () { if (confirmDiscard()) ui.closeModal(); }
          }, 'Cancel'),
          ui.el('button', {
            class: 'btn',
            onclick: async function () {
              if (!working.title.trim()) { ui.toast('Title is required', 'warn'); return; }
              working.status = 'draft';
              try {
                var saved = await db.saveEntry(working);
                working.id = saved.id;
                ui.toast('Draft saved');
                if (window.Uptrack.app) window.Uptrack.app.refreshNavBadge();
                if (opts.onChange) opts.onChange(saved);
                ui.closeModal();
              } catch (err) {
                ui.toast('Storage error — draft not saved: ' + (err && err.message || 'unknown'), 'error');
              }
            }
          }, 'Save draft'),
          ui.el('button', {
            class: 'btn primary',
            onclick: async function () {
              if (!working.title.trim()) { ui.toast('Title is required', 'warn'); return; }
              if (!working.domain) { ui.toast('Choose a domain before completing', 'warn'); return; }
              if (!working.impact) { ui.toast('Choose an impact level before completing', 'warn'); return; }
              working.status = 'complete';
              try {
                var saved = await db.saveEntry(working);
                working.id = saved.id;
                ui.toast('Entry saved as complete');
                if (window.Uptrack.rewards) window.Uptrack.rewards.fire();
                if (window.Uptrack.app) window.Uptrack.app.refreshNavBadge();
                if (opts.onChange) opts.onChange(saved);
                ui.closeModal();
              } catch (err) {
                ui.toast('Storage error — entry not saved: ' + (err && err.message || 'unknown'), 'error');
              }
            }
          }, 'Save as complete')
        ])
      ])
    ]);

    /* Render initial domain fields */
    renderDomainFields();

    /* Unsaved-changes guard: snapshot the working copy once the form is
     * fully initialized; any dismissal (Cancel, ×, backdrop, Escape) while
     * the entry differs from the snapshot asks before discarding. Saves
     * close via ui.closeModal() directly and bypass the guard. */
    var initialSnapshot = JSON.stringify(working);
    function confirmDiscard() {
      if (JSON.stringify(working) === initialSnapshot) return true;
      return window.confirm('Discard unsaved changes to this entry?');
    }

    var title = working.id ? 'Edit entry' : 'New entry';
    ui.openModal(title, form, { beforeClose: confirmDiscard });
    setTimeout(function () { titleInput.focus(); }, 40);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.entry = {
    open: open,
    quickCreate: quickCreate,
    newEntryTemplate: newEntryTemplate
  };
})();
