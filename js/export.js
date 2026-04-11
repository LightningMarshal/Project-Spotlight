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
    const str = String(s);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
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

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.export = {
    generalText, generalCsv, reviewText, fullBackup,
    runGeneralTextExport, runGeneralCsvExport, runReviewExport, runFullBackup,
    download
  };
})();
