/* SVG-based chart primitives. No dependencies. */
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

  const GRID_COLOR   = '#2a3142';
  const AXIS_COLOR   = '#3a4256';
  const LABEL_COLOR  = '#6b7386';
  const BAR_COLOR    = '#6ba39a';
  const EMPTY_COLOR  = '#3a4256';

  const TAX_COLORS = {
    values: '#6b8e7b',
    tenets: '#8b7ba8',
    principles: '#a89478'
  };
  const IMPACT_COLORS = {
    Low:      '#5c7a8f',
    Medium:   '#6b94a8',
    High:     '#c89158',
    Critical: '#c66a5c'
  };
  const DOMAIN_COLORS = {
    'Operations':        '#6ba39a',
    'Project':           '#8b9fc4',
    'People Management': '#c4a45f'
  };

  function empty(message) {
    return ui.el('div', { class: 'chart-empty' }, message || 'No data to display');
  }

  /* ---------- bar chart (vertical) ----------
   * data: [{ label, value, color? }]
   */
  function barChart(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty();
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
      children.push(sn('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: GRID_COLOR, 'stroke-width': 1 }));
      children.push(sn('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', fill: LABEL_COLOR, 'font-size': 10, 'font-family': 'monospace' }, v));
    }

    data.forEach(function (d, i) {
      const x = padL + (i * (barW + gap)) + gap / 2;
      const h = (d.value / max) * innerH;
      const y = padT + innerH - h;
      const color = d.color || BAR_COLOR;
      children.push(sn('rect', { x: x, y: y, width: barW, height: h, fill: color, rx: 2 }));
      children.push(sn('text', { x: x + barW / 2, y: H - padB + 16, 'text-anchor': 'middle', fill: LABEL_COLOR, 'font-size': 10 }, truncateLabel(d.label, 14)));
      if (d.value > 0) {
        children.push(sn('text', { x: x + barW / 2, y: y - 4, 'text-anchor': 'middle', fill: '#9aa3b4', 'font-size': 10, 'font-family': 'monospace' }, d.value));
      }
    });

    children.push(sn('line', { x1: padL, x2: W - padR, y1: padT + innerH, y2: padT + innerH, stroke: AXIS_COLOR, 'stroke-width': 1 }));
    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- horizontal bar chart ----------
   * data: [{ label, value, color? }]
   * shows full labels — preferred when labels are long.
   */
  function horizontalBarChart(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty();
    const W = opts.width || 520;
    const rowH = opts.rowH || 22;
    const padL = 150, padR = 34, padT = 8, padB = 8;
    const innerW = W - padL - padR;
    const H = padT + padB + data.length * rowH;
    const max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;

    const children = [];
    data.forEach(function (d, i) {
      const y = padT + i * rowH + 4;
      const barW = (d.value / max) * innerW;
      const color = d.color || BAR_COLOR;
      children.push(sn('text', { x: padL - 8, y: y + rowH / 2 + 1, 'text-anchor': 'end', fill: LABEL_COLOR, 'font-size': 11 }, truncateLabel(d.label, 24)));
      children.push(sn('rect', { x: padL, y: y, width: Math.max(barW, 2), height: rowH - 8, fill: color, rx: 2 }));
      children.push(sn('text', { x: padL + Math.max(barW, 2) + 6, y: y + rowH / 2 + 1, fill: '#9aa3b4', 'font-size': 11, 'font-family': 'monospace' }, d.value));
    });
    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- line chart ----------
   * data: [{ label, value }]
   */
  function lineChart(data, opts) {
    opts = opts || {};
    if (!data || !data.length) return empty();
    const W = opts.width || 520;
    const H = opts.height || 220;
    const padL = 34, padR = 14, padT = 14, padB = 36;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const max = Math.max.apply(null, data.map(function (d) { return d.value; }));
    const yMax = max || 1;
    const ticks = 4;
    const children = [];

    for (let i = 0; i <= ticks; i++) {
      const y = padT + innerH - (innerH * i / ticks);
      const v = Math.round(yMax * i / ticks);
      children.push(sn('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: GRID_COLOR, 'stroke-width': 1 }));
      children.push(sn('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', fill: LABEL_COLOR, 'font-size': 10, 'font-family': 'monospace' }, v));
    }

    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    let pathD = '';
    const points = data.map(function (d, i) {
      const x = padL + i * stepX;
      const y = padT + innerH - (d.value / yMax) * innerH;
      pathD += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
      return { x: x, y: y, d: d };
    });

    // Area fill
    if (points.length) {
      const areaD = pathD + 'L' + points[points.length - 1].x + ' ' + (padT + innerH) +
                    ' L' + points[0].x + ' ' + (padT + innerH) + ' Z';
      children.push(sn('path', { d: areaD, fill: BAR_COLOR, 'fill-opacity': 0.12 }));
    }
    children.push(sn('path', { d: pathD, stroke: BAR_COLOR, 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round' }));
    points.forEach(function (p) {
      children.push(sn('circle', { cx: p.x, cy: p.y, r: 3, fill: '#141821', stroke: BAR_COLOR, 'stroke-width': 1.5 }));
    });

    // X labels — thin them out if crowded
    const labelEvery = Math.max(1, Math.ceil(points.length / 10));
    points.forEach(function (p, i) {
      if (i % labelEvery !== 0 && i !== points.length - 1) return;
      children.push(sn('text', { x: p.x, y: H - padB + 16, 'text-anchor': 'middle', fill: LABEL_COLOR, 'font-size': 10 }, truncateLabel(p.d.label, 8)));
    });

    children.push(sn('line', { x1: padL, x2: W - padR, y1: padT + innerH, y2: padT + innerH, stroke: AXIS_COLOR, 'stroke-width': 1 }));
    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- stacked bar chart ----------
   * categories: [{ label, values: { Low, Medium, High, Critical } }]
   */
  function stackedBarChart(categories, opts) {
    opts = opts || {};
    if (!categories || !categories.length) return empty();
    const W = opts.width || 520;
    const H = opts.height || 220;
    const padL = 34, padR = 14, padT = 14, padB = 44;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const totals = categories.map(function (c) {
      return (c.values.Low || 0) + (c.values.Medium || 0) + (c.values.High || 0) + (c.values.Critical || 0);
    });
    const max = Math.max.apply(null, totals) || 1;
    const barW = innerW / categories.length * 0.58;
    const gap  = innerW / categories.length * 0.42;
    const children = [];
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = padT + innerH - (innerH * i / ticks);
      const v = Math.round(max * i / ticks);
      children.push(sn('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: GRID_COLOR, 'stroke-width': 1 }));
      children.push(sn('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', fill: LABEL_COLOR, 'font-size': 10, 'font-family': 'monospace' }, v));
    }

    categories.forEach(function (c, i) {
      const x = padL + i * (barW + gap) + gap / 2;
      let yCursor = padT + innerH;
      ['Low', 'Medium', 'High', 'Critical'].forEach(function (level) {
        const v = c.values[level] || 0;
        if (!v) return;
        const h = (v / max) * innerH;
        yCursor -= h;
        children.push(sn('rect', { x: x, y: yCursor, width: barW, height: h, fill: IMPACT_COLORS[level] }));
      });
      children.push(sn('text', { x: x + barW / 2, y: H - padB + 16, 'text-anchor': 'middle', fill: LABEL_COLOR, 'font-size': 10 }, truncateLabel(c.label, 14)));
      const total = totals[i];
      if (total) {
        children.push(sn('text', { x: x + barW / 2, y: padT + innerH - (total / max) * innerH - 4, 'text-anchor': 'middle', fill: '#9aa3b4', 'font-size': 10, 'font-family': 'monospace' }, total));
      }
    });

    // legend
    const legendY = H - 12;
    let lx = padL;
    ['Low', 'Medium', 'High', 'Critical'].forEach(function (level) {
      children.push(sn('rect', { x: lx, y: legendY - 8, width: 10, height: 10, fill: IMPACT_COLORS[level] }));
      children.push(sn('text', { x: lx + 14, y: legendY + 1, fill: LABEL_COLOR, 'font-size': 10 }, level));
      lx += 70;
    });

    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  /* ---------- gap indicator ----------
   * items: [{ label, value, max, color }]
   * Shows a list of values/tenets/principles and how underrepresented they are
   * relative to the heaviest one in the same taxonomy. Items below 50% of the
   * taxonomy max are visually flagged as "gaps".
   */
  function gapIndicator(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return empty('No usage yet');
    const W = opts.width || 520;
    const rowH = 22;
    const padL = 140, padR = 60, padT = 6, padB = 6;
    const innerW = W - padL - padR;
    const H = padT + padB + items.length * rowH;
    const children = [];

    items.forEach(function (it, i) {
      const y = padT + i * rowH + 4;
      const ratio = it.max > 0 ? it.value / it.max : 0;
      const barW = innerW * Math.max(ratio, 0.02);
      const isGap = it.max > 0 && ratio < 0.5;

      children.push(sn('text', { x: padL - 8, y: y + rowH / 2 + 1, 'text-anchor': 'end', fill: isGap ? '#c89158' : LABEL_COLOR, 'font-size': 11 }, truncateLabel(it.label, 22)));
      children.push(sn('rect', { x: padL, y: y, width: innerW, height: rowH - 8, fill: '#1e2430', rx: 2 }));
      children.push(sn('rect', { x: padL, y: y, width: barW, height: rowH - 8, fill: it.color || BAR_COLOR, rx: 2, opacity: isGap ? 0.5 : 0.95 }));
      children.push(sn('text', { x: padL + innerW + 6, y: y + rowH / 2 + 1, fill: isGap ? '#c89158' : '#9aa3b4', 'font-size': 11, 'font-family': 'monospace' }, it.value));
    });
    return svg({ viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' }, children);
  }

  function truncateLabel(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ---------- data aggregators ---------- */

  function byDomain(entries) {
    const counts = {};
    tax.DOMAINS.forEach(function (d) { counts[d] = 0; });
    entries.forEach(function (e) { if (counts[e.domain] != null) counts[e.domain]++; });
    return tax.DOMAINS.map(function (d) { return { label: d, value: counts[d], color: DOMAIN_COLORS[d] }; });
  }

  function byImpact(entries) {
    const counts = {};
    tax.IMPACT_LEVELS.forEach(function (i) { counts[i] = 0; });
    entries.forEach(function (e) { if (counts[e.impact] != null) counts[e.impact]++; });
    return tax.IMPACT_LEVELS.map(function (i) { return { label: i, value: counts[i], color: IMPACT_COLORS[i] }; });
  }

  function tagFrequency(entries, taxKey) {
    const counts = {};
    tax.TAXONOMIES[taxKey].items.forEach(function (i) { counts[i] = 0; });
    entries.forEach(function (e) {
      (e.tags && e.tags[taxKey] || []).forEach(function (t) {
        if (counts[t] != null) counts[t]++;
      });
    });
    return tax.TAXONOMIES[taxKey].items.map(function (i) {
      return { label: i, value: counts[i], color: TAX_COLORS[taxKey] };
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

  function gapData(entries) {
    /* Returns items across all three taxonomies with per-taxonomy max. */
    const out = [];
    ['values', 'tenets', 'principles'].forEach(function (taxKey) {
      const data = tagFrequency(entries, taxKey);
      const max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 0;
      data.forEach(function (d) {
        out.push({ label: tax.TAXONOMIES[taxKey].short + ': ' + d.label, value: d.value, max: max, color: TAX_COLORS[taxKey] });
      });
    });
    return out;
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.charts = {
    barChart, horizontalBarChart, lineChart, stackedBarChart, gapIndicator,
    byDomain, byImpact, tagFrequency, impactByDomain, volumeOverTime, gapData,
    TAX_COLORS, IMPACT_COLORS, DOMAIN_COLORS
  };
})();
