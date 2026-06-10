/* Export pipeline:
 *   - generalText(entries, filters, range)   — plain text, grouped by domain → impact desc → chronological
 *   - generalCsv(entries)                    — structured CSV of all fields
 *   - reviewText(entries, filters)           — grouped by value, then culture tenet
 *   - fullBackup()                           — JSON dump of entire database
 *
 * All export functions return a string. A helper `download(filename, text, mime)`
 * triggers a browser download.
 */
(function () {
  'use strict';

  const tax = window.Uptrack.tax;
  const ui  = window.Uptrack.ui;
  const db  = window.Uptrack.db;
  const filters = window.Uptrack.filters;

  /* Prefer the custom "Other" label when the main enum value is 'Other'
   * and a companion label is present. Used by all display-facing exports
   * so charts/aggregations continue to see the raw enum while humans see
   * the specific label. */
  function labelOrOther(main, other) {
    if (main === 'Other' && other && other.trim()) return other.trim();
    return main;
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function ts() {
    const d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function tagsFlat(e) {
    const t = e.tags || {};
    const parts = [];
    if ((t.values || []).length)     parts.push('Values: ' + t.values.join(', '));
    if ((t.tenets || []).length)     parts.push('Tenets: ' + t.tenets.join(', '));
    if ((t.principles || []).length) parts.push('Principles: ' + t.principles.join(', '));
    return parts.join(' | ');
  }

  /* ---------- general export (plain text) ---------- */

  function generalText(entries, filterState, rangeLabel) {
    const lines = [];
    const now = new Date();
    lines.push('UPTRACK EXPORT — GENERAL');
    lines.push('========================');
    lines.push('Generated: ' + now.toISOString());
    if (rangeLabel) lines.push('Time range: ' + rangeLabel);
    lines.push('Filters: ' + filters.describe(filterState || {}));
    lines.push('Total entries: ' + entries.length);
    lines.push('');

    /* Group by domain → impact desc → chronological */
    const byDom = {};
    tax.DOMAINS.forEach(function (d) { byDom[d] = []; });
    entries.forEach(function (e) {
      if (!byDom[e.domain]) byDom[e.domain] = [];
      byDom[e.domain].push(e);
    });

    for (const d of Object.keys(byDom)) {
      const items = byDom[d];
      if (!items.length) continue;
      items.sort(function (a, b) {
        const ra = tax.IMPACT_RANK[a.impact] || 0;
        const rb = tax.IMPACT_RANK[b.impact] || 0;
        if (rb !== ra) return rb - ra;
        return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
      });

      lines.push('');
      lines.push('### DOMAIN: ' + d.toUpperCase());
      lines.push('-'.repeat(60));

      let lastImpact = null;
      items.forEach(function (e) {
        if (e.impact !== lastImpact) {
          lines.push('');
          lines.push('— Impact: ' + (e.impact || 'Unspecified') + ' —');
          lastImpact = e.impact;
        }
        lines.push('');
        lines.push('• ' + e.title + '   [' + e.date + ']   (' + e.status + ')');
        if (e.description && e.description.trim()) {
          e.description.split('\n').forEach(function (l) { lines.push('    ' + l); });
        }
        const tagLine = tagsFlat(e);
        if (tagLine) lines.push('    Tags: ' + tagLine);
      });
    }
    lines.push('');
    lines.push('=== end of export ===');
    return lines.join('\n');
  }

  /* ---------- general export (CSV) ---------- */

  function csvEscape(s) {
    if (s == null) return '';
    var str = String(s);
    /* Neutralize spreadsheet formula prefixes on the RAW value, before any
     * quoting. Quoting first hides the prefix from this test (the string
     * then starts with `"`), so a value like `=HYPERLINK(...),x` would
     * reach the spreadsheet as a live formula. */
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function generalCsv(entries) {
    const header = ['id', 'date', 'status', 'domain', 'impact', 'title', 'description', 'values', 'tenets', 'principles', 'createdAt', 'updatedAt'];
    const rows = [header.join(',')];
    entries.forEach(function (e) {
      const t = e.tags || {};
      rows.push([
        e.id || '',
        e.date || '',
        e.status || '',
        e.domain || '',
        e.impact || '',
        e.title || '',
        e.description || '',
        (t.values || []).join('; '),
        (t.tenets || []).join('; '),
        (t.principles || []).join('; '),
        e.createdAt || '',
        e.updatedAt || ''
      ].map(csvEscape).join(','));
    });
    return rows.join('\n');
  }

  /* ---------- review export (value → tenet) ---------- */

  function reviewText(entries, filterState) {
    const lines = [];
    const now = new Date();
    lines.push('UPTRACK EXPORT — PERFORMANCE REVIEW');
    lines.push('====================================');
    lines.push('Generated: ' + now.toISOString());
    lines.push('Filters: ' + filters.describe(filterState || {}));
    lines.push('Total entries included: ' + entries.length);
    lines.push('');
    lines.push('Entries are grouped by COMPANY VALUE, then by CULTURE TENET. An entry');
    lines.push('tagged with multiple values or tenets is listed under each applicable');
    lines.push('grouping for reviewer convenience.');
    lines.push('');

    for (const value of tax.TAXONOMIES.values.items) {
      const underValue = entries.filter(function (e) {
        return (e.tags && (e.tags.values || []).indexOf(value) !== -1);
      });
      lines.push('');
      lines.push('================================================================');
      lines.push('COMPANY VALUE: ' + value.toUpperCase());
      lines.push('================================================================');
      if (!underValue.length) {
        lines.push('(no entries tagged with this value)');
        continue;
      }
      for (const tenet of tax.TAXONOMIES.tenets.items) {
        const inTenet = underValue.filter(function (e) {
          return (e.tags && (e.tags.tenets || []).indexOf(tenet) !== -1);
        });
        lines.push('');
        lines.push('  > CULTURE TENET: ' + tenet);
        lines.push('  ' + '-'.repeat(58));
        if (!inTenet.length) {
          lines.push('    (no entries)');
          continue;
        }
        inTenet.sort(function (a, b) {
          const ra = tax.IMPACT_RANK[a.impact] || 0;
          const rb = tax.IMPACT_RANK[b.impact] || 0;
          if (rb !== ra) return rb - ra;
          return a.date < b.date ? 1 : -1;
        });
        inTenet.forEach(function (e) {
          lines.push('');
          lines.push('    • ' + e.title + '   [' + e.date + ']   ' + (e.impact || '') + ' | ' + (e.domain || ''));
          if (e.description && e.description.trim()) {
            e.description.split('\n').forEach(function (l) { lines.push('        ' + l); });
          }
          const princ = (e.tags && e.tags.principles || []);
          if (princ.length) lines.push('        Principles: ' + princ.join(', '));
        });
      }

      // Catch entries tagged with the value but with no tenet tags
      const uncategorized = underValue.filter(function (e) {
        return !e.tags || !(e.tags.tenets || []).length;
      });
      if (uncategorized.length) {
        lines.push('');
        lines.push('  > (no culture tenet tag)');
        lines.push('  ' + '-'.repeat(58));
        uncategorized.forEach(function (e) {
          lines.push('    • ' + e.title + '   [' + e.date + ']   ' + (e.impact || '') + ' | ' + (e.domain || ''));
        });
      }
    }

    /* Culture-tenet summary section  */
    lines.push('');
    lines.push('');
    lines.push('================================================================');
    lines.push('CULTURE TENET SUMMARY');
    lines.push('================================================================');
    for (const tenet of tax.TAXONOMIES.tenets.items) {
      const inTenet = entries.filter(function (e) {
        return (e.tags && (e.tags.tenets || []).indexOf(tenet) !== -1);
      });
      lines.push('');
      lines.push('> ' + tenet + '  — ' + inTenet.length + ' entries');
      inTenet.slice(0, 20).forEach(function (e) {
        lines.push('    • ' + e.title + '   [' + e.date + ']');
      });
      if (inTenet.length > 20) lines.push('    … and ' + (inTenet.length - 20) + ' more');
    }
    lines.push('');
    lines.push('=== end of review export ===');
    return lines.join('\n');
  }

  /* ---------- Obsidian-compatible markdown ---------- */

  function obsidianMarkdown(entries, filterState, rangeLabel) {
    var lines = [];

    entries.forEach(function (e, idx) {
      if (idx > 0) lines.push('', '---', '');

      /* YAML frontmatter */
      lines.push('---');
      lines.push('title: "' + yamlEscape(e.title) + '"');
      lines.push('date: ' + (e.date || ''));
      lines.push('status: ' + (e.status || 'draft'));
      if (e.domain) lines.push('domain: ' + e.domain);
      if (e.impact) lines.push('impact: ' + e.impact);
      if (e.individual) lines.push('individual: "' + yamlEscape(e.individual) + '"');
      if (e.interactionType) lines.push('interaction_type: "' + yamlEscape(labelOrOther(e.interactionType, e.interactionTypeOther)) + '"');
      if (e.sentiment) lines.push('sentiment: ' + e.sentiment);
      if (e.customerSentiment) lines.push('customer_sentiment: ' + e.customerSentiment);
      if (e.developmentTheme) lines.push('development_theme: "' + yamlEscape(labelOrOther(e.developmentTheme, e.developmentThemeOther)) + '"');
      if (e.companyName) lines.push('company: "' + yamlEscape(e.companyName) + '"');
      if (e.projectNumber) lines.push('project_number: "' + yamlEscape(e.projectNumber) + '"');
      if (e.followUpAction) {
        lines.push('follow_up: "' + yamlEscape(e.followUpAction) + '"');
        if (e.followUpTargetDate) lines.push('follow_up_target: ' + e.followUpTargetDate);
        lines.push('follow_up_dismissed: ' + (e.followUpDismissed ? 'true' : 'false'));
      }

      /* Tags as YAML arrays */
      var t = e.tags || {};
      if ((t.values || []).length) {
        lines.push('values:');
        t.values.forEach(function (v) { lines.push('  - ' + v); });
      }
      if ((t.tenets || []).length) {
        lines.push('tenets:');
        t.tenets.forEach(function (v) { lines.push('  - ' + v); });
      }
      if ((t.principles || []).length) {
        lines.push('principles:');
        t.principles.forEach(function (v) { lines.push('  - ' + v); });
      }
      lines.push('---');
      lines.push('');

      /* Heading */
      lines.push('# ' + e.title);
      lines.push('');

      /* Metadata line */
      var meta = [];
      if (e.date) meta.push('**Date:** ' + e.date);
      if (e.domain) meta.push('**Domain:** ' + e.domain);
      if (e.impact) meta.push('**Impact:** ' + e.impact);
      if (e.status) meta.push('**Status:** ' + e.status);
      if (meta.length) lines.push(meta.join(' · '));
      lines.push('');

      /* Description */
      if (e.description && e.description.trim()) {
        lines.push('## Description');
        lines.push('');
        lines.push(e.description.trim());
        lines.push('');
      }

      /* Domain-specific details */
      var details = [];
      if (e.individual) details.push('- **Individual:** ' + e.individual);
      if (e.interactionType) details.push('- **Interaction Type:** ' + labelOrOther(e.interactionType, e.interactionTypeOther));
      if (e.meetingDirection) details.push('- **Meeting Direction:** ' + e.meetingDirection);
      if (e.sentiment) details.push('- **Sentiment:** ' + e.sentiment);
      if (e.developmentTheme) details.push('- **Development Theme:** ' + labelOrOther(e.developmentTheme, e.developmentThemeOther));
      if (e.companyName) details.push('- **Company:** ' + e.companyName);
      if (e.customerSentiment) details.push('- **Customer Sentiment:** ' + e.customerSentiment);
      if (e.escalationNumber) details.push('- **Escalation Number:** ' + e.escalationNumber);
      if (e.projectNumber) details.push('- **Project Number:** ' + e.projectNumber);

      if (details.length) {
        lines.push('## Details');
        lines.push('');
        details.forEach(function (d) { lines.push(d); });
        lines.push('');
      }

      /* Follow-up */
      if (e.followUpAction) {
        lines.push('## Follow-Up');
        lines.push('');
        lines.push('- **Action:** ' + e.followUpAction);
        if (e.followUpDescription) lines.push('- **Description:** ' + e.followUpDescription);
        if (e.followUpTargetDate) lines.push('- **Target Date:** ' + e.followUpTargetDate);
        lines.push('- **Status:** ' + (e.followUpDismissed ? 'Dismissed' : 'Open'));
        lines.push('');
      }

      /* Hash tags for Obsidian */
      var hashTags = [];
      if (e.domain) hashTags.push('#domain/' + slugify(e.domain));
      if (e.impact) hashTags.push('#impact/' + slugify(e.impact));
      if (e.status) hashTags.push('#status/' + e.status);
      (t.values || []).forEach(function (v) { hashTags.push('#value/' + slugify(v)); });
      (t.tenets || []).forEach(function (v) { hashTags.push('#tenet/' + slugify(v)); });
      (t.principles || []).forEach(function (v) { hashTags.push('#principle/' + slugify(v)); });
      if (hashTags.length) {
        lines.push(hashTags.join(' '));
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /* Escape a string for inclusion in a double-quoted YAML scalar.
   * Double-quoted YAML treats `\` as an escape character, so any unescaped
   * backslash in user input (e.g. a Windows path `C:\Users\foo`) is read as
   * the start of an escape sequence (`\U` = 8-digit Unicode escape) and the
   * whole frontmatter block fails to parse in Obsidian and other consumers.
   * Likewise, raw newlines break double-quoted scalars across line boundaries.
   * Order matters: backslash MUST be escaped first so subsequent replacements
   * aren't double-escaped. */
  function yamlEscape(s) {
    if (!s) return '';
    return String(s)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
  }

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function runObsidianExport(entries, filterState, rangeLabel) {
    var md = obsidianMarkdown(entries, filterState, rangeLabel);
    download('uptrack-obsidian-' + ts() + '.md', md, 'text/markdown;charset=utf-8');
    return md;
  }

  /* ---------- full backup ---------- */

  async function fullBackup() {
    const payload = await db.exportAll();
    return JSON.stringify(payload, null, 2);
  }

  function backupFilename() {
    return 'uptrack-backup-' + ts() + '.json';
  }

  /* ---------- helpers to run & save in one shot ---------- */

  async function runGeneralTextExport(entries, filterState, rangeLabel) {
    const text = generalText(entries, filterState, rangeLabel);
    download('uptrack-general-' + ts() + '.txt', text);
    return text;
  }
  async function runGeneralCsvExport(entries) {
    const csv = generalCsv(entries);
    download('uptrack-general-' + ts() + '.csv', csv, 'text/csv;charset=utf-8');
    return csv;
  }
  async function runReviewExport(entries, filterState) {
    const text = reviewText(entries, filterState);
    download('uptrack-review-' + ts() + '.txt', text);
    return text;
  }
  async function runFullBackup() {
    const json = await fullBackup();
    download(backupFilename(), json, 'application/json');
    return json;
  }

  /* ---------- backup nag banner ---------- */

  var BACKUP_NAG_DAYS = 14;

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
        try {
          await runFullBackup();
          await db.setSetting('lastBackupAt', new Date().toISOString());
          ui.toast('Backup downloaded');
          onBackupDone();
        } catch (err) {
          ui.toast('Backup failed: ' + (err && err.message || 'unknown'), 'error');
        }
      } }, 'Download backup now')
    ]);
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.export = {
    generalText, generalCsv, reviewText, obsidianMarkdown, fullBackup,
    runGeneralTextExport, runGeneralCsvExport, runReviewExport, runObsidianExport, runFullBackup,
    download, renderBackupNag
  };
})();
