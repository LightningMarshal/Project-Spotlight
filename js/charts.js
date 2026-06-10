/* SVG-based chart primitives. No dependencies.
 *
 * Colors resolve from CSS custom properties at render time so charts follow
 * whichever theme pack/mode is active. Hard-coded hex fallbacks match the
 * Arctic dark defaults and are only used if the CSS variable is not set.
 */
(function () {
  'use strict';

  const ui = window.Uptrack.ui;
  const tax = window.Uptrack.tax;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svg(attrs, children) {
    const n = document.createElementNS(SVG_NS, 'svg');
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (children) for (const c of children) if (c) n.appendChild(c);
    return n;
  }
  function sn(name, attrs, children) {
    const n = document.createElementNS(SVG_NS, name);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (children) {
      const arr = Array.isArray(children) ? children : [children];
      for (const c of arr) {
        if (c == null) continue;
        if (typeof c === 'string' || typeof c === 'number') n.appendChild(document.createTextNode(String(c)));
        else n.appendChild(c);
      }
    }
    return n;
  }

  /* ---------- theme-aware color resolution ---------- */

  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (err) { return fallback; }
  }

  /* Called once per chart render so theme changes apply on next paint. */
  function colors() {
    return {
      grid:       cssVar('--border',        '#252d3d'),
      axis:       cssVar('--border-strong', '#323c50'),
      label:      cssVar('--text-faint',    '#5c6578'),
      valueLabel: cssVar('--text-dim',      '#a0a8b8'),
      bar:        cssVar('--accent',        '#e8923e'),
      surface2:   cssVar('--surface-2',     '#1a2030'),
      accentBg:   cssVar('--accent-bg',     '#2d1f0e'),
      impact: {
        Low:      cssVar('--impact-low',      '#7a8594'),
        Medium:   cssVar('--impact-medium',   '#d4a054'),
        High:     cssVar('--impact-high',     '#e8883a'),
        Critical: cssVar('--impact-critical', '#d95535')
      },
      tax: {
        values:     cssVar('--tax-values', '#d4a054'),
        tenets:     cssVar('--tax-tenets', '#c48940'),
        principles: cssVar('--tax-princ',  '#b87a30')
      },
      domain: {
        'Operations':        cssVar('--domain-operations',        '#e8923e'),
        'Project':           cssVar('--domain-project',           '#d4a054'),
        'People Management': cssVar('--domain-people-management', '#c48940'),
        'Client Facing':     cssVar('--domain-client-facing',     '#b87a30')
      },
      /* semantic */
      zero:     cssVar('--impact-critical', '#d95535'),
      good:     cssVar('--impact-medium',   '#d4a054'),
      trackBg:  cssVar('--surface-2',       '#1a2030')
    };
  }

  /* ---------- empty state ---------- */

  function empty(message) {
    return ui.el('div', { class: 'chart-empty' }, message || 'No data to display');
  }

  function truncateLabel(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function formatPct(pct) {
    if (!isFinite(pct)) return '0%';
    if (pct >= 10) return Math.round(pct) + '%';
    return (Math.round(pct * 10) / 10) + '%';
  }

  /* ---------- bar chart (vertical) ----------
   * data: [{ label, value, color? }]
   */
  function barChart(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty();
    const C = colors();
    const W = opts.width || 520;
    const H = opts.height || 220;
    const padL = 34, padR = 10, padT = 14, padB = 40;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    const barW = innerW / data.length * 0.62;
    const gap  = innerW / data.length * 0.38;
    const ticks = 4;

    const children = [];

    for (let i = 0; i <= ticks; i++) {
      const y = padT + innerH - (innerH * i / ticks);
      const v = Math.round(max * i / ticks);
      children.push(sn('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: C.grid, 'stroke-width': 1 }));
      children.push(sn('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', fill: C.label, 'font-size': 10, 'font-family': 'monospace' }, v));
    }

    data.forEach(function (d, i) {
      const x = padL + (i * (barW + gap)) + gap / 2;
      const h = (d.value / max) * innerH;
      const y = padT + innerH - h;
      const color = d.color || C.bar;
      children.push(sn('rect', { x: x, y: y, width: barW, height: h, fill: color, rx: 2 }));
      children.push(sn('text', { x: x + barW / 2, y: H - padB + 16, 'text-anchor': 'middle', fill: C.label, 'font-size': 10 }, truncateLabel(d.label, 14)));
      if (d.value > 0) {
        children.push(sn('text', { x: x + barW / 2, y: y - 4, 'text-anchor': 'middle', fill: C.valueLabel, 'font-size': 10, 'font-family': 'monospace' }, d.value));
      }
    });

    children.push(sn('line', { x1: padL, x2: W - padR, y1: padT + innerH, y2: padT + innerH, stroke: C.axis, 'stroke-width': 1 }));
    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- horizontal bar chart ----------
   * data: [{ label, value, color? }]
   * opts.total     — if set, bars scale relative to total (not max) AND
   *                  label shows "count (pct%)". This makes underrepresented
   *                  values visually obvious instead of relatively inflating
   *                  the largest one.
   * opts.rowH      — per-row height (default 22)
   * Backwards compatible: if opts.total is omitted, old max-scaled behavior.
   */
  function horizontalBarChart(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty();
    const C = colors();
    const W = opts.width || 520;
    const rowH = opts.rowH || 22;
    const proportional = typeof opts.total === 'number' && opts.total > 0;
    const total = proportional ? opts.total : 0;

    /* Wider right gutter when we show "N  (pp%)" instead of just "N". */
    const padL = 150, padR = proportional ? 86 : 34, padT = 8, padB = 8;
    const innerW = W - padL - padR;
    const H = padT + padB + data.length * rowH;

    const denom = proportional
      ? total
      : (Math.max.apply(null, data.map(function (d) { return d.value; })) || 1);

    const children = [];
    data.forEach(function (d, i) {
      const y = padT + i * rowH + 4;
      const ratio = denom > 0 ? d.value / denom : 0;
      const barW  = innerW * Math.max(0, Math.min(1, ratio));
      const color = d.color || C.bar;
      const isZero = proportional && d.value === 0;

      /* track (full width) behind the bar when proportional, so empty
       * and underrepresented items read as "missing from N" not as "biggest". */
      if (proportional) {
        children.push(sn('rect', { x: padL, y: y, width: innerW, height: rowH - 8, fill: C.trackBg, rx: 2, opacity: 0.55 }));
      }

      children.push(sn('text', {
        x: padL - 8, y: y + rowH / 2 + 1,
        'text-anchor': 'end',
        fill: isZero ? C.zero : C.label,
        'font-size': 11,
        'font-weight': isZero ? 600 : 400
      }, truncateLabel(d.label, 24)));

      if (!isZero) {
        children.push(sn('rect', {
          x: padL, y: y,
          width: Math.max(barW, proportional ? 0 : 2),
          height: rowH - 8,
          fill: color,
          rx: 2,
          opacity: proportional && ratio < 0.05 ? 0.75 : 1
        }));
      }

      if (proportional) {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        const rightLabel = d.value + '  (' + formatPct(pct) + ')';
        children.push(sn('text', {
          x: padL + innerW + 6,
          y: y + rowH / 2 + 1,
          fill: isZero ? C.zero : C.valueLabel,
          'font-size': 11,
          'font-family': 'monospace',
          'font-weight': isZero ? 600 : 400
        }, rightLabel));
      } else {
        children.push(sn('text', {
          x: padL + Math.max(barW, 2) + 6,
          y: y + rowH / 2 + 1,
          fill: C.valueLabel,
          'font-size': 11,
          'font-family': 'monospace'
        }, d.value));
      }
    });
    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- line chart ----------
   * data: [{ label, value }]
   * opts.yMax — lock y-axis maximum (useful for percentages: pass 100)
   * opts.yUnit — suffix on y-axis tick labels ('%' etc.)
   */
  function lineChart(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty();
    const C = colors();
    const W = opts.width || 520;
    const H = opts.height || 220;
    const padL = 38, padR = 14, padT = 14, padB = 36;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const dataMax = Math.max.apply(null, data.map(function (d) { return d.value; }));
    const yMax = (typeof opts.yMax === 'number' && opts.yMax > 0) ? opts.yMax : (dataMax || 1);
    const yUnit = opts.yUnit || '';
    const ticks = 4;
    const children = [];

    for (let i = 0; i <= ticks; i++) {
      const y = padT + innerH - (innerH * i / ticks);
      const v = Math.round(yMax * i / ticks);
      children.push(sn('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: C.grid, 'stroke-width': 1 }));
      children.push(sn('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', fill: C.label, 'font-size': 10, 'font-family': 'monospace' }, v + yUnit));
    }

    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    let pathD = '';
    const points = data.map(function (d, i) {
      const x = padL + i * stepX;
      const ratio = yMax > 0 ? Math.max(0, Math.min(1, d.value / yMax)) : 0;
      const y = padT + innerH - ratio * innerH;
      pathD += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
      return { x: x, y: y, d: d };
    });

    if (points.length) {
      const areaD = pathD + 'L' + points[points.length - 1].x + ' ' + (padT + innerH) +
                    ' L' + points[0].x + ' ' + (padT + innerH) + ' Z';
      children.push(sn('path', { d: areaD, fill: C.bar, 'fill-opacity': 0.12 }));
    }
    children.push(sn('path', { d: pathD, stroke: C.bar, 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round' }));
    points.forEach(function (p) {
      children.push(sn('circle', { cx: p.x, cy: p.y, r: 3, fill: cssVar('--surface', '#131820'), stroke: C.bar, 'stroke-width': 1.5 }));
    });

    const labelEvery = Math.max(1, Math.ceil(points.length / 10));
    points.forEach(function (p, i) {
      if (i % labelEvery !== 0 && i !== points.length - 1) return;
      children.push(sn('text', { x: p.x, y: H - padB + 16, 'text-anchor': 'middle', fill: C.label, 'font-size': 10 }, truncateLabel(p.d.label, 8)));
    });

    children.push(sn('line', { x1: padL, x2: W - padR, y1: padT + innerH, y2: padT + innerH, stroke: C.axis, 'stroke-width': 1 }));
    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- stacked bar chart ----------
   * categories: [{ label, values: {<key>: n, ...} }]
   * opts.keys     — ordered list of stack keys (default: IMPACT_LEVELS)
   * opts.colorMap — map of key -> color (default: impact colors from theme)
   * opts.legendLabels — optional map of key -> display label
   */
  function stackedBarChart(categories, opts) {
    opts = opts || {};
    if (!categories || !categories.length) return empty();
    const C = colors();
    const keys = opts.keys || ['Low', 'Medium', 'High', 'Critical'];
    const colorMap = opts.colorMap || C.impact;
    const legendLabels = opts.legendLabels || null;
    const W = opts.width || 520;
    const H = opts.height || 230;
    const padL = 34, padR = 14, padT = 14, padB = 50;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const totals = categories.map(function (c) {
      let t = 0;
      for (let i = 0; i < keys.length; i++) t += (c.values[keys[i]] || 0);
      return t;
    });
    const max = Math.max.apply(null, totals) || 1;
    const barW = innerW / categories.length * 0.58;
    const gap  = innerW / categories.length * 0.42;
    const children = [];
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = padT + innerH - (innerH * i / ticks);
      const v = Math.round(max * i / ticks);
      children.push(sn('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: C.grid, 'stroke-width': 1 }));
      children.push(sn('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', fill: C.label, 'font-size': 10, 'font-family': 'monospace' }, v));
    }

    categories.forEach(function (c, i) {
      const x = padL + i * (barW + gap) + gap / 2;
      let yCursor = padT + innerH;
      keys.forEach(function (k) {
        const v = c.values[k] || 0;
        if (!v) return;
        const h = (v / max) * innerH;
        yCursor -= h;
        children.push(sn('rect', { x: x, y: yCursor, width: barW, height: h, fill: colorMap[k] || C.bar }));
      });
      children.push(sn('text', { x: x + barW / 2, y: H - padB + 16, 'text-anchor': 'middle', fill: C.label, 'font-size': 10 }, truncateLabel(c.label, 14)));
      const total = totals[i];
      if (total) {
        children.push(sn('text', { x: x + barW / 2, y: padT + innerH - (total / max) * innerH - 4, 'text-anchor': 'middle', fill: C.valueLabel, 'font-size': 10, 'font-family': 'monospace' }, total));
      }
    });

    /* legend — wrap across rows if needed */
    const legendY = H - 18;
    const legendItemW = Math.max(70, innerW / keys.length);
    keys.forEach(function (k, idx) {
      const lx = padL + idx * legendItemW;
      const label = legendLabels ? (legendLabels[k] || k) : k;
      children.push(sn('rect', { x: lx, y: legendY - 8, width: 10, height: 10, fill: colorMap[k] || C.bar }));
      children.push(sn('text', { x: lx + 14, y: legendY + 1, fill: C.label, 'font-size': 10 }, truncateLabel(label, 16)));
    });

    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- grouped bar chart ----------
   * Side-by-side bars for multiple series across categories.
   * categories: [{ label, values: {<groupKey>: n, ...} }]
   * opts.keys, opts.colorMap, opts.legendLabels — same shape as stackedBarChart
   */
  function groupedBarChart(categories, opts) {
    opts = opts || {};
    if (!categories || !categories.length) return empty();
    const C = colors();
    const keys = opts.keys || ['Low', 'Medium', 'High', 'Critical'];
    const colorMap = opts.colorMap || C.impact;
    const legendLabels = opts.legendLabels || null;
    const W = opts.width || 520;
    const H = opts.height || 240;
    const padL = 34, padR = 14, padT = 14, padB = 56;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    let max = 0;
    categories.forEach(function (c) {
      keys.forEach(function (k) { if ((c.values[k] || 0) > max) max = c.values[k] || 0; });
    });
    max = max || 1;

    const catW = innerW / categories.length;
    const catPad = catW * 0.18;
    const groupW = catW - catPad * 2;
    const barW = groupW / keys.length;

    const children = [];
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = padT + innerH - (innerH * i / ticks);
      const v = Math.round(max * i / ticks);
      children.push(sn('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: C.grid, 'stroke-width': 1 }));
      children.push(sn('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', fill: C.label, 'font-size': 10, 'font-family': 'monospace' }, v));
    }

    categories.forEach(function (c, ci) {
      const baseX = padL + ci * catW + catPad;
      keys.forEach(function (k, ki) {
        const v = c.values[k] || 0;
        const h = (v / max) * innerH;
        const x = baseX + ki * barW;
        const y = padT + innerH - h;
        children.push(sn('rect', { x: x + 1, y: y, width: Math.max(barW - 2, 1), height: h, fill: colorMap[k] || C.bar, rx: 1 }));
        if (v > 0) {
          children.push(sn('text', {
            x: x + barW / 2, y: y - 3,
            'text-anchor': 'middle',
            fill: C.valueLabel,
            'font-size': 9,
            'font-family': 'monospace'
          }, v));
        }
      });
      children.push(sn('text', { x: padL + ci * catW + catW / 2, y: H - padB + 16, 'text-anchor': 'middle', fill: C.label, 'font-size': 10 }, truncateLabel(c.label, 14)));
    });

    /* legend */
    const legendY = H - 20;
    const legendItemW = Math.max(70, innerW / keys.length);
    keys.forEach(function (k, idx) {
      const lx = padL + idx * legendItemW;
      const label = legendLabels ? (legendLabels[k] || k) : k;
      children.push(sn('rect', { x: lx, y: legendY - 8, width: 10, height: 10, fill: colorMap[k] || C.bar }));
      children.push(sn('text', { x: lx + 14, y: legendY + 1, fill: C.label, 'font-size': 10 }, truncateLabel(label, 16)));
    });

    children.push(sn('line', { x1: padL, x2: W - padR, y1: padT + innerH, y2: padT + innerH, stroke: C.axis, 'stroke-width': 1 }));
    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- gap indicator (redesigned) ----------
   * Ranks taxonomy items ascending by usage, flags zero-usage items, and
   * surfaces percentage-of-total so underrepresentation is immediately visible.
   *
   * items: [{ label, value, taxKey }]  (from charts.gapData)
   * opts.total — total entries in scope (required to render percentages)
   */
  function gapIndicator(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return empty('No usage yet');
    const C = colors();
    const total = (typeof opts.total === 'number' && opts.total > 0) ? opts.total : 0;

    /* Sort ascending by value — so zero and underrepresented items surface first. */
    const sorted = items.slice().sort(function (a, b) {
      if (a.value !== b.value) return a.value - b.value;
      return a.label.localeCompare(b.label);
    });

    const W = opts.width || 520;
    const rowH = 24;
    const padL = 170, padR = 90, padT = 6, padB = 6;
    const innerW = W - padL - padR;
    const H = padT + padB + sorted.length * rowH;
    const children = [];

    /* Scale bars against the MAX value in the set — a dense full-usage item
     * pins the scale so small counts read as small, but the zero / gap flags
     * are driven by absolute state, not by ratio-to-max. */
    const setMax = Math.max.apply(null, sorted.map(function (it) { return it.value; })) || 1;

    sorted.forEach(function (it, i) {
      const y = padT + i * rowH + 5;
      const barH = rowH - 10;
      const ratio = setMax > 0 ? it.value / setMax : 0;
      const barW = innerW * Math.max(ratio, 0.008);
      const isZero = it.value === 0;
      const pct = total > 0 ? (it.value / total) * 100 : 0;
      const color = (it.taxKey && C.tax[it.taxKey]) || C.bar;

      /* row label */
      children.push(sn('text', {
        x: padL - 10, y: y + barH / 2 + 3,
        'text-anchor': 'end',
        fill: isZero ? C.zero : C.label,
        'font-size': 11,
        'font-weight': isZero ? 600 : 400
      }, truncateLabel(it.label, 26)));

      /* track */
      children.push(sn('rect', { x: padL, y: y, width: innerW, height: barH, fill: C.trackBg, rx: 2 }));

      if (isZero) {
        /* zero indicator — dashed outline stripe so it reads as "missing" */
        children.push(sn('rect', {
          x: padL, y: y,
          width: innerW, height: barH,
          fill: 'none',
          stroke: C.zero,
          'stroke-width': 1,
          'stroke-dasharray': '3 3',
          rx: 2,
          opacity: 0.8
        }));
        children.push(sn('text', {
          x: padL + innerW / 2, y: y + barH / 2 + 3,
          'text-anchor': 'middle',
          fill: C.zero,
          'font-size': 10,
          'font-weight': 600,
          'font-family': 'monospace'
        }, 'NOT USED'));
      } else {
        children.push(sn('rect', {
          x: padL, y: y,
          width: barW, height: barH,
          fill: color, rx: 2,
          opacity: ratio < 0.25 ? 0.7 : 0.95
        }));
      }

      /* right-hand numeric readout: "N (pp%)" */
      const right = it.value + (total > 0 ? '  (' + formatPct(pct) + ')' : '');
      children.push(sn('text', {
        x: padL + innerW + 8, y: y + barH / 2 + 3,
        fill: isZero ? C.zero : C.valueLabel,
        'font-size': 11,
        'font-family': 'monospace',
        'font-weight': isZero ? 600 : 400
      }, right));
    });

    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- calendar heatmap ----------
   * GitHub-style capture grid: trailing N weeks (default 13) as columns,
   * Monday–Sunday rows (matching ui.startOfWeek), one cell per day, with
   * intensity = number of entries dated that day. Counts key off the raw
   * entry `date` string, so backfilled work lights up the day it happened.
   * Days after today are not drawn. Dates are handled exclusively with the
   * local-time ui helpers — never `new Date('YYYY-MM-DD')`, which parses
   * as UTC and shifts days in western timezones.
   */
  function calendarHeatmap(entries, opts) {
    opts = opts || {};
    const C = colors();
    const accent = cssVar('--accent', '#e8923e');
    const WEEKS = opts.weeks || 13;
    const cell = 14, gap = 3;
    const padL = 30, padT = 16, padR = 4, padB = 4;
    const W = padL + WEEKS * (cell + gap) - gap + padR;
    const H = padT + 7 * (cell + gap) - gap + padB;

    const counts = {};
    (entries || []).forEach(function (e) {
      if (e.date) counts[e.date] = (counts[e.date] || 0) + 1;
    });

    const todayD = ui.today();
    const gridStart = ui.startOfWeek(todayD);
    gridStart.setDate(gridStart.getDate() - (WEEKS - 1) * 7);

    const children = [];

    /* Row labels (Mon / Wed / Fri) */
    const rowLabels = { 0: 'Mon', 2: 'Wed', 4: 'Fri' };
    [0, 2, 4].forEach(function (r) {
      children.push(sn('text', {
        x: padL - 6,
        y: padT + r * (cell + gap) + cell / 2 + 3,
        'text-anchor': 'end',
        fill: C.label,
        'font-size': 9
      }, rowLabels[r]));
    });

    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const weekMonday = new Date(gridStart);
      weekMonday.setDate(gridStart.getDate() + w * 7);

      /* Month label above the first column whose Monday enters a new month */
      if (weekMonday.getMonth() !== lastMonth) {
        lastMonth = weekMonday.getMonth();
        children.push(sn('text', {
          x: padL + w * (cell + gap),
          y: padT - 5,
          fill: C.label,
          'font-size': 9
        }, weekMonday.toLocaleDateString(undefined, { month: 'short' })));
      }

      for (let r = 0; r < 7; r++) {
        const day = new Date(weekMonday);
        day.setDate(weekMonday.getDate() + r);
        if (day > todayD) continue;
        const iso = ui.toIso(day);
        const n = counts[iso] || 0;
        children.push(sn('rect', {
          x: padL + w * (cell + gap),
          y: padT + r * (cell + gap),
          width: cell,
          height: cell,
          rx: 2,
          fill: n === 0 ? C.trackBg : accent,
          opacity: n === 0 ? 1 : (n === 1 ? 0.35 : (n === 2 ? 0.65 : 1))
        }, sn('title', null, iso + ' — ' + n + (n === 1 ? ' entry' : ' entries'))));
      }
    }

    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* Current consecutive-day capture streak, by entry date. A day counts if
   * at least one entry is dated that day. Today not having an entry yet
   * does not break the streak — the count then starts from yesterday. */
  function captureStreak(entries) {
    const counts = {};
    (entries || []).forEach(function (e) {
      if (e.date) counts[e.date] = (counts[e.date] || 0) + 1;
    });
    const d = ui.today();
    if (!counts[ui.toIso(d)]) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (counts[ui.toIso(d)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  /* ---------- data aggregators ---------- */

  function byDomain(entries) {
    const C = colors();
    const counts = {};
    tax.DOMAINS.forEach(function (d) { counts[d] = 0; });
    entries.forEach(function (e) { if (counts[e.domain] != null) counts[e.domain]++; });
    return tax.DOMAINS.map(function (d) { return { label: d, value: counts[d], color: C.domain[d] }; });
  }

  function byImpact(entries) {
    const C = colors();
    const counts = {};
    tax.IMPACT_LEVELS.forEach(function (i) { counts[i] = 0; });
    entries.forEach(function (e) { if (counts[e.impact] != null) counts[e.impact]++; });
    return tax.IMPACT_LEVELS.map(function (i) { return { label: i, value: counts[i], color: C.impact[i] }; });
  }

  function tagFrequency(entries, taxKey) {
    const C = colors();
    const counts = {};
    tax.TAXONOMIES[taxKey].items.forEach(function (i) { counts[i] = 0; });
    entries.forEach(function (e) {
      (e.tags && e.tags[taxKey] || []).forEach(function (t) {
        if (counts[t] != null) counts[t]++;
      });
    });
    return tax.TAXONOMIES[taxKey].items.map(function (i) {
      return { label: i, value: counts[i], color: C.tax[taxKey] };
    });
  }

  function impactByDomain(entries) {
    return tax.DOMAINS.map(function (d) {
      const values = { Low: 0, Medium: 0, High: 0, Critical: 0 };
      entries.forEach(function (e) { if (e.domain === d && values[e.impact] != null) values[e.impact]++; });
      return { label: d, values: values };
    });
  }

  function volumeOverTime(entries, bucket) {
    /* bucket: 'day' | 'week' | 'month' */
    if (!entries.length) return [];
    const buckets = {};
    entries.forEach(function (e) {
      const d = ui.parseIso(e.date);
      let key;
      if (bucket === 'month') {
        key = ui.monthKey(d);
      } else if (bucket === 'week') {
        const s = ui.startOfWeek(d);
        key = ui.toIso(s);
      } else {
        key = e.date;
      }
      buckets[key] = (buckets[key] || 0) + 1;
    });
    const sorted = Object.keys(buckets).sort();
    return sorted.map(function (k) {
      let label = k;
      if (bucket === 'month') {
        const [y, m] = k.split('-');
        label = new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
      } else {
        label = ui.shortDate(k);
      }
      return { label: label, value: buckets[k] };
    });
  }

  /* Domain distribution bucketed by month.
   * Returns [{ label: 'Jan', values: { Operations: n, Project: n, ... } }]
   * with one entry per month that has data (sorted chronologically).
   */
  function domainByMonth(entries) {
    if (!entries || !entries.length) return [];
    const buckets = {};
    entries.forEach(function (e) {
      const d = ui.parseIso(e.date);
      const key = ui.monthKey(d);
      if (!buckets[key]) {
        buckets[key] = { Operations: 0, 'Project': 0, 'People Management': 0, 'Client Facing': 0 };
      }
      if (buckets[key][e.domain] != null) buckets[key][e.domain]++;
    });
    const sortedKeys = Object.keys(buckets).sort();
    return sortedKeys.map(function (k) {
      const [y, m] = k.split('-');
      const label = new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      return { label: label, values: buckets[k] };
    });
  }

  /* High+Critical percentage per month over the filtered set.
   * Returns [{ label, value (0-100), count, total }]
   */
  function impactQualityByMonth(entries) {
    if (!entries || !entries.length) return [];
    const buckets = {};
    entries.forEach(function (e) {
      const d = ui.parseIso(e.date);
      const key = ui.monthKey(d);
      if (!buckets[key]) buckets[key] = { total: 0, hc: 0 };
      buckets[key].total++;
      if (e.impact === 'High' || e.impact === 'Critical') buckets[key].hc++;
    });
    const sortedKeys = Object.keys(buckets).sort();
    return sortedKeys.map(function (k) {
      const [y, m] = k.split('-');
      const label = new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      const pct = buckets[k].total > 0 ? (buckets[k].hc / buckets[k].total) * 100 : 0;
      return { label: label, value: Math.round(pct * 10) / 10, count: buckets[k].hc, total: buckets[k].total };
    });
  }

  /* Flat list of every taxonomy item with its raw count and taxonomy key.
   * Consumed by the redesigned gapIndicator.
   */
  function gapData(entries) {
    const out = [];
    ['values', 'tenets', 'principles'].forEach(function (taxKey) {
      const data = tagFrequency(entries, taxKey);
      data.forEach(function (d) {
        out.push({
          label: tax.TAXONOMIES[taxKey].short + ': ' + d.label,
          value: d.value,
          taxKey: taxKey
        });
      });
    });
    return out;
  }

  /* Unique count of entries that contribute to the "Visibility Index":
   * entries that are
   *   (a) Client Facing domain, OR
   *   (b) Skip Level interaction, OR
   *   (c) tagged with "Lead The Way" or "Own The Outcome" tenets.
   * Returns { unique, breakdown: { clientFacing, skipLevel, leadership }, total }
   */
  function visibilityIndex(entries) {
    let cf = 0, skip = 0, leader = 0;
    const uniq = new Set();
    entries.forEach(function (e, idx) {
      let any = false;
      if (e.domain === 'Client Facing') { cf++; any = true; }
      if (e.interactionType === 'Skip Level') { skip++; any = true; }
      const tenets = (e.tags && e.tags.tenets) || [];
      if (tenets.indexOf('Lead The Way') !== -1 || tenets.indexOf('Own The Outcome') !== -1) {
        leader++; any = true;
      }
      if (any) uniq.add(idx);
    });
    return {
      unique: uniq.size,
      breakdown: { clientFacing: cf, skipLevel: skip, leadership: leader },
      total: entries.length
    };
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.charts = {
    /* primitives */
    barChart, horizontalBarChart, lineChart, stackedBarChart, groupedBarChart, gapIndicator,
    calendarHeatmap,
    /* aggregators */
    byDomain, byImpact, tagFrequency, impactByDomain, volumeOverTime,
    domainByMonth, impactQualityByMonth, gapData, visibilityIndex, captureStreak,
    /* theme */
    colors,
    /* empty state helper (exposed for widgets that build their own DOM) */
    empty
  };
})();
