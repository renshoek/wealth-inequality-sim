'use strict';
// ─────────────────────────────────────────────────
// CANVAS — drawing functions
// ─────────────────────────────────────────────────

function dpr() { return window.devicePixelRatio || 1; }
function lerp(a, b, t) { return a + (b - a) * t; }

function resizeCanvas(c) {
  const d = dpr();
  const r = c.getBoundingClientRect();
  if (!r.width || !r.height) return;
  c.width  = r.width  * d;
  c.height = r.height * d;
}

// ── BAR CHART ──
// Target [r,g,b] by wealth percentile rank (0=poorest, 1=richest)
function _targetBarColor(pct) {
  if (pct >= 0.90) return [232, 80,  80];   // red  — top 10%
  if (pct >= 0.75) return [240, 192, 64];   // gold — 75–90%
  if (pct >= 0.50) return [80,  120, 170];  // blue — 50–75%
  return                   [50,  85,  140]; // muted blue — bottom 50%
}
const _COLOR_STEP = 0.035; // ~300ms fade at 60fps

function drawBars(canvas, agents, inspectedId, roundsPerYear) {
  const d = dpr(), ctx = canvas.getContext('2d');
  const W = canvas.width / d, H = canvas.height / d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = '#15171e'; ctx.fillRect(0, 0, W, H);

  const alive  = agents.filter(a => a.alive);
  if (!alive.length) return;

  const MIN_BAR_PX = 1;
  const neededH = alive.length * MIN_BAR_PX;
  if (canvas.getBoundingClientRect().height < neededH) {
    canvas.style.height = neededH + 'px';
    resizeCanvas(canvas);
  }

  const sorted = [...alive].sort((a, b) => a.wealth - b.wealth);
  const maxW   = Math.max(...sorted.map(a => a.wealth), 1);
  const n      = sorted.length;
  const barH   = Math.max(1, H / n);

  for (let i = 0; i < n; i++) {
    const ag  = sorted[i];
    const pct = i / Math.max(n - 1, 1);
    const w   = (ag.wealth / maxW) * W;
    const y   = H - (i + 1) * barH;

    // Lerp displayColor toward target — slow enough to see movement
    const tgt = _targetBarColor(pct);
    if (!ag.displayColor) ag.displayColor = [...tgt];
    const dc = ag.displayColor;
    dc[0] += (tgt[0] - dc[0]) * _COLOR_STEP;
    dc[1] += (tgt[1] - dc[1]) * _COLOR_STEP;
    dc[2] += (tgt[2] - dc[2]) * _COLOR_STEP;

    const lifePct = ag.ageYears / ag.lifespan;
    ctx.globalAlpha = lifePct > 0.85 ? lerp(1, 0.35, (lifePct - 0.85) / 0.15) : 1;
    ctx.fillStyle = `rgb(${dc[0]|0},${dc[1]|0},${dc[2]|0})`;
    ctx.fillRect(0, y, w, barH - 0.5);
    ctx.globalAlpha = 1;

    if (ag.id === inspectedId) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(w + 2, y + barH * 0.2, 3, barH * 0.6);
    }
  }

  const top10y = H - Math.floor(n * 0.9) * barH;
  ctx.strokeStyle = 'rgba(240,192,64,0.35)'; ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(0, top10y); ctx.lineTo(W, top10y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(240,192,64,0.5)';
  ctx.font = `9px 'DM Mono', monospace`;
  ctx.fillText('top 10%', 5, top10y - 3);
}

// ── LORENZ CURVE ──
function drawLorenz(canvas, agents) {
  const d = dpr(), ctx = canvas.getContext('2d');
  const W = canvas.width / d, H = canvas.height / d;
  const pad = 22;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = '#15171e'; ctx.fillRect(0, 0, W, H);

  const iW = W - pad * 2, iH = H - pad * 2;
  const toX = x => pad + x * iW;
  const toY = y => pad + (1 - y) * iH;

  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(v => {
    ctx.beginPath(); ctx.moveTo(toX(v), toY(0)); ctx.lineTo(toX(v), toY(1)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), toY(v)); ctx.lineTo(toX(1), toY(v)); ctx.stroke();
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(toX(0), toY(0)); ctx.lineTo(toX(1), toY(1)); ctx.stroke();
  ctx.setLineDash([]);

  const vals = agents.filter(a => a.alive).map(a => a.wealth);
  const pts  = lorenzPoints(vals);
  if (pts.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(0));
  pts.forEach(p => ctx.lineTo(toX(p.x), toY(p.y)));
  ctx.lineTo(toX(1), toY(1)); ctx.closePath();
  ctx.fillStyle = 'rgba(232,80,80,0.10)'; ctx.fill();

  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(toX(p.x), toY(p.y)) : ctx.lineTo(toX(p.x), toY(p.y)));
  ctx.strokeStyle = '#e85050'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = 'rgba(90,94,114,0.7)'; ctx.font = `9px 'DM Mono', monospace`;
  ctx.fillText('0%',   toX(0) - 4, toY(0) + 11);
  ctx.fillText('100%', toX(1) - 20, toY(0) + 11);
}

// ── GENERIC LINE CHART ──
function drawLineChart(canvas, series, opts = {}) {
  const d = dpr(), ctx = canvas.getContext('2d');
  const W = canvas.width / d, H = canvas.height / d;
  const pad = { t: 10, r: 10, b: 22, l: opts.leftPad ?? 44 };
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = '#15171e'; ctx.fillRect(0, 0, W, H);

  const allVals = series.flatMap(s => s.values).filter(isFinite);
  if (!allVals.length) return;

  const minV = opts.minY ?? Math.min(...allVals);
  const maxV = opts.maxY ?? Math.max(...allVals, minV + 0.001);
  const range = maxV - minV || 1;
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const toX = (i, len) => pad.l + (i / Math.max(len - 1, 1)) * iW;
  const toY = v => pad.t + (1 - (v - minV) / range) * iH;

  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  const steps = 4;
  ctx.font = `9px 'DM Mono', monospace`; ctx.fillStyle = 'rgba(90,94,114,0.8)'; ctx.textAlign = 'right';
  for (let i = 0; i <= steps; i++) {
    const v = minV + (range * i / steps);
    const y = toY(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    const lbl = opts.yFormat ? opts.yFormat(v) : v.toFixed(opts.yDecimals ?? 1) + (opts.yLabel ?? '');
    ctx.fillText(lbl, pad.l - 4, y + 3);
  }

  for (const s of series) {
    if (!s.values.length) continue;
    ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = toX(i, s.values.length), y = toY(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width ?? 1.5; ctx.stroke();
  }

  if (opts.xLabel) {
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(90,94,114,0.5)';
    ctx.fillText(opts.xLabel, pad.l + iW / 2, H - 4);
  }
}

// ── ECONOMY PANEL ──
// ── ECONOMY PANEL ──
function drawEconomy(canvas, agents, taxPool, totalDeaths, bankruptTotal) {
  const d = dpr(), ctx = canvas.getContext('2d');
  const W = canvas.width / d, H = canvas.height / d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = '#15171e'; ctx.fillRect(0, 0, W, H);

  const alive  = agents.filter(a => a.alive);
  if (!alive.length) return;
  const vals   = alive.map(a => a.wealth);
  const total  = vals.reduce((s, v) => s + v, 0);
  const avg    = total / vals.length;
  const sortedV = [...vals].sort((a, b) => a - b);
  const median = sortedV[Math.floor(sortedV.length / 2)] ?? 0;

  const fmt = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0);
  const pxPad = 10;

  // ── 1. STAT TILES ──
  const tiles = [
    { label: 'Total wealth', value: fmt(total),     color: '#e2e4ed' },
    { label: 'Tax pool',     value: (taxPool?.amount < 0 ? '-' : '') + fmt(Math.abs(taxPool?.amount ?? 0)), color: taxPool?.amount < 0 ? '#e85050' : '#f0c040' },
    { label: 'Avg wealth',   value: fmt(avg),        color: '#8899aa' },
    { label: 'Median',       value: fmt(median),     color: '#8899aa' },
    { label: 'Deaths',       value: String(totalDeaths),      color: '#e85050' },
    { label: 'Bankruptcies', value: String(bankruptTotal),    color: '#e85050' },
  ];
  const cols = 2, tileRows = Math.ceil(tiles.length / cols);
  const tilesH = H * 0.38;
  const tw = W / cols, th = tilesH / tileRows;
  tiles.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const tx = col * tw + tw * 0.08, ty = row * th + th * 0.1;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath(); ctx.roundRect(tx, ty, tw * 0.84, th * 0.82, 4); ctx.fill();
    ctx.fillStyle = 'rgba(90,94,114,0.8)'; ctx.font = `9px 'DM Mono', monospace`; ctx.textAlign = 'left';
    ctx.fillText(t.label, tx + 6, ty + 13);
    ctx.fillStyle = t.color; ctx.font = `500 14px 'DM Mono', monospace`;
    ctx.fillText(t.value, tx + 6, ty + 28);
  });

  // helper: draw a segmented horizontal bar
  function drawSegBar(y, barH2, segments) {
    // segments: [{ pct, color, label }]  pct = fraction of width
    const bW = W - pxPad * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(pxPad, y, bW, barH2);
    let bx = pxPad;
    for (const seg of segments) {
      const sw = seg.pct * bW;
      if (sw < 0.5) { bx += sw; continue; }
      ctx.fillStyle = seg.color; ctx.fillRect(bx, y, sw, barH2);
      // label inside if wide enough
      if (sw > 30) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `8px 'DM Mono', monospace`; ctx.textAlign = 'center';
        ctx.fillText(seg.label, bx + sw / 2, y + barH2 - 3);
      }
      bx += sw;
    }
  }

  // helper: section label
  function sectionLabel(text, y) {
    ctx.fillStyle = 'rgba(90,94,114,0.7)'; ctx.font = `9px 'DM Mono', monospace`; ctx.textAlign = 'left';
    ctx.fillText(text, pxPad, y);
  }

  const barH2 = 13;
  const gap   = 5;
  let curY    = tilesH + 6;

  // ── 2. WEALTH BY CITY ──
  const cityTotals = new Map();
  for (const ag of alive) {
    const k = ag.location?.city ?? 'Unknown';
    cityTotals.set(k, (cityTotals.get(k) || 0) + ag.wealth);
  }
  // Sort cities by total wealth desc, keep top 6
  const topCities = [...cityTotals.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 6);
  const cityPalette = ['#5588cc','#44aa88','#f0c040','#e85050','#aa88dd','#dd8844'];
  sectionLabel('wealth by city (top 6)', curY + barH2 + 1);
  const citySegs = topCities.map(([city, tv], ci) => ({
    pct: total > 0 ? tv / total : 0,
    color: cityPalette[ci],
    label: `${city} ${total > 0 ? ((tv/total)*100).toFixed(0) : 0}%`,
  }));
  drawSegBar(curY, barH2, citySegs);
  curY += barH2 + gap + 11;

  // city legend
  let lx = pxPad;
  for (let ci = 0; ci < topCities.length; ci++) {
    const [city] = topCities[ci];
    ctx.fillStyle = cityPalette[ci]; ctx.fillRect(lx, curY, 7, 7);
    ctx.fillStyle = 'rgba(90,94,114,0.8)'; ctx.font = `9px 'DM Mono', monospace`; ctx.textAlign = 'left';
    ctx.fillText(city, lx + 9, curY + 7);
    lx += Math.max(54, city.length * 5.5 + 14);
    if (lx > W - 60) break;
  }
  curY += 7 + gap + 4;

  // ── 3. WEALTH BY PERCENTILE GROUP ──
  // Bottom 50%, next 40% (50-90), next 9% (90-99), top 1%
  const sortedA = [...alive].sort((a, b) => a.wealth - b.wealth);
  const n = sortedA.length;
  const i50  = Math.floor(n * 0.50);
  const i90  = Math.floor(n * 0.90);
  const i99  = Math.floor(n * 0.99);

  function sumWealth(arr, from, to) {
    return arr.slice(from, to).reduce((s, a) => s + a.wealth, 0);
  }
  const w50  = sumWealth(sortedA, 0,    i50);
  const w40  = sumWealth(sortedA, i50,  i90);
  const w9   = sumWealth(sortedA, i90,  i99);
  const w1   = sumWealth(sortedA, i99,  n);

  const pctColors = ['#4fc4a0','#5a7a8a','#f0c040','#e85050'];
  const pctGroups = [
    { label: `Bot 50% ${total > 0 ? ((w50/total)*100).toFixed(0) : 0}%`, w: w50, color: pctColors[0] },
    { label: `50-90% ${total > 0 ? ((w40/total)*100).toFixed(0) : 0}%`,  w: w40, color: pctColors[1] },
    { label: `90-99% ${total > 0 ? ((w9/total)*100).toFixed(0)  : 0}%`,  w: w9,  color: pctColors[2] },
    { label: `Top 1% ${total > 0 ? ((w1/total)*100).toFixed(0)  : 0}%`,  w: w1,  color: pctColors[3] },
  ];
  sectionLabel('wealth by percentile', curY + barH2 + 1);
  drawSegBar(curY, barH2, pctGroups.map(g => ({ pct: total > 0 ? g.w / total : 0, color: g.color, label: g.label })));
  curY += barH2 + gap + 11;

  // percentile legend
  lx = pxPad;
  for (const g of pctGroups) {
    ctx.fillStyle = g.color; ctx.fillRect(lx, curY, 7, 7);
    ctx.fillStyle = 'rgba(90,94,114,0.8)'; ctx.font = `9px 'DM Mono', monospace`; ctx.textAlign = 'left';
    const shortLbl = g.label.split(' ')[0] + ' ' + g.label.split(' ')[1];
    ctx.fillText(shortLbl, lx + 9, curY + 7);
    lx += 64;
  }
  curY += 7 + gap + 4;

  // ── 4. WEALTH BY AGE GROUP ──
  const ageBuckets = [
    { label: '20–35',  min: 0,  max: 35  },
    { label: '35–50',  min: 35, max: 50  },
    { label: '50–65',  min: 50, max: 65  },
    { label: '65+',    min: 65, max: Infinity },
  ];
  const ageColors = ['#7799cc','#aa88dd','#dd9966','#cc5577'];
  const ageTotals = ageBuckets.map(b =>
    alive.filter(a => a.ageYears >= b.min && a.ageYears < b.max)
         .reduce((s, a) => s + a.wealth, 0)
  );
  const ageTotal = ageTotals.reduce((s, v) => s + v, 0);

  sectionLabel('wealth by age group', curY + barH2 + 1);
  const ageSegs = ageBuckets.map((b, i) => ({
    pct: ageTotal > 0 ? ageTotals[i] / ageTotal : 0,
    color: ageColors[i],
    label: `${b.label} ${ageTotal > 0 ? ((ageTotals[i]/ageTotal)*100).toFixed(0) : 0}%`,
  }));
  drawSegBar(curY, barH2, ageSegs);
  curY += barH2 + gap + 11;

  // age legend
  lx = pxPad;
  for (let i = 0; i < ageBuckets.length; i++) {
    ctx.fillStyle = ageColors[i]; ctx.fillRect(lx, curY, 7, 7);
    ctx.fillStyle = 'rgba(90,94,114,0.8)'; ctx.font = `9px 'DM Mono', monospace`; ctx.textAlign = 'left';
    ctx.fillText(ageBuckets[i].label, lx + 9, curY + 7);
    lx += 50;
  }
}

// ── MINI HISTORY ──
function drawMiniHistory(canvas, history, color) {
  if (!canvas) return;
  const d = dpr(), ctx = canvas.getContext('2d');
  const W = canvas.width / d, H = canvas.height / d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = '#0e0f13'; ctx.fillRect(0, 0, W, H);
  if (!history || history.length < 2) return;
  const maxV = Math.max(...history, 1);
  const pad = 4, iW = W - pad * 2, iH = H - pad * 2;
  ctx.beginPath();
  history.forEach((v, i) => {
    const x = pad + (i / (history.length - 1)) * iW;
    const y = pad + (1 - v / maxV) * iH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color || '#f0c040'; ctx.lineWidth = 1.5; ctx.stroke();
}

// ── HELPERS ──
function lorenzPoints(vals) {
  const s = [...vals].sort((a, b) => a - b);
  const total = s.reduce((a, v) => a + v, 0);
  if (!total) return [];
  let cum = 0;
  const pts = [{ x: 0, y: 0 }];
  s.forEach((v, i) => { cum += v; pts.push({ x: (i+1)/s.length, y: cum/total }); });
  return pts;
}

function gini(vals) {
  const s = [...vals].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return 0;
  let num = 0;
  for (let i = 0; i < n; i++) num += (2 * (i + 1) - n - 1) * s[i];
  const denom = n * s.reduce((a, v) => a + v, 0);
  return denom === 0 ? 0 : num / denom;
}
// ── GEOGRAPHY TREEMAP ──
// Squarified treemap: regions top-left→bottom-right by total wealth,
// cities within each region sized by their total wealth share.
function drawGeography(canvas, agents) {
  const d = dpr(), ctx = canvas.getContext('2d');
  const W = canvas.width / d, H = canvas.height / d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = '#0e0f13'; ctx.fillRect(0, 0, W, H);

  const alive = agents.filter(a => a.alive && a.location);
  if (!alive.length) return;

  // Aggregate by region → city
  const regionMap = new Map();
  for (const ag of alive) {
    const r = ag.location.region, c = ag.location.city;
    if (!regionMap.has(r)) regionMap.set(r, new Map());
    const cm = regionMap.get(r);
    if (!cm.has(c)) cm.set(c, { city: c, region: r, total: 0, count: 0 });
    cm.get(c).total += ag.wealth;
    cm.get(c).count++;
  }

  const globalTotal = alive.reduce((s, a) => s + a.wealth, 0);
  const globalAvg   = globalTotal / alive.length;

  const regions = [...regionMap.entries()].map(([rName, cm]) => {
    const cities = [...cm.values()].sort((a, b) => b.total - a.total);
    const rTotal  = cities.reduce((s, c) => s + c.total, 0);
    const rCount  = cities.reduce((s, c) => s + c.count, 0);
    cities.forEach(c => c.avg = c.total / c.count);
    return { region: rName, cities, total: rTotal, count: rCount, avg: rTotal / rCount };
  }).sort((a, b) => b.total - a.total); // richest top-left

  const regionColors = {
    'Europe':   '#4477bb',
    'Americas': '#339966',
    'Asia':     '#cc7733',
    'Africa':   '#aa4455',
  };

  const PAD  = 3; // gap between cells
  const fmtV = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0);

  // Color by avg wealth relative to global avg: poor=blue, mid=grey-blue, above=gold, rich=red
  function cellColor(avg, alpha) {
    const r = avg / Math.max(globalAvg, 1);
    let R, G, B;
    if      (r >= 2.0) { R=220; G=70;  B=70;  }
    else if (r >= 1.3) { R=210; G=170; B=50;  }
    else if (r >= 0.7) { R=80;  G=115; B=160; }
    else               { R=50;  G=75;  B=130; }
    return `rgba(${R},${G},${B},${alpha})`;
  }

  // Simple horizontal/vertical slice treemap
  // rect: {x,y,w,h}, items with .weight
  function treemapSlice(rect, items) {
    const totalW = items.reduce((s, it) => s + it.weight, 0);
    if (!totalW) return;
    // choose split axis based on rect shape
    const horiz = rect.w >= rect.h;
    let cursor = horiz ? rect.x : rect.y;
    items.forEach(it => {
      const frac = it.weight / totalW;
      const size = frac * (horiz ? rect.w : rect.h);
      it._rect = horiz
        ? { x: cursor, y: rect.y, w: size, h: rect.h }
        : { x: rect.x, y: cursor, w: rect.w, h: size };
      cursor += size;
    });
  }

  // Layout regions across the full canvas
  const regionItems = regions.map(r => ({ ...r, weight: r.total }));
  treemapSlice({ x: 0, y: 0, w: W, h: H }, regionItems);

  for (const rItem of regionItems) {
    const rRect = rItem._rect;
    if (!rRect || rRect.w < 2 || rRect.h < 2) continue;
    const rc = regionColors[rItem.region] || '#5a6080';

    // Region background
    ctx.fillStyle = `rgba(${hexToRgb(rc)},0.08)`;
    ctx.fillRect(rRect.x, rRect.y, rRect.w, rRect.h);

    // Layout cities within region rect (with padding)
    const inner = { x: rRect.x + PAD, y: rRect.y + PAD + 14, w: rRect.w - PAD*2, h: rRect.h - PAD*2 - 14 };
    const cityItems = rItem.cities.map(c => ({ ...c, weight: c.total }));
    treemapSlice(inner, cityItems);

    for (const cItem of cityItems) {
      const cr = cItem._rect;
      if (!cr || cr.w < 4 || cr.h < 4) continue;
      const cx = cr.x + PAD/2, cy = cr.y + PAD/2;
      const cw = cr.w - PAD,   ch = cr.h - PAD;
      if (cw < 2 || ch < 2) continue;

      // City fill
      ctx.fillStyle = cellColor(cItem.avg, 0.85);
      ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 3); ctx.fill();

      // Subtle border
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 3); ctx.stroke();

      // Labels — only if cell is big enough
      if (cw > 30 && ch > 18) {
        const nameSize = Math.max(7, Math.min(11, Math.min(cw, ch) * 0.18));
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `500 ${nameSize}px 'DM Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(cItem.city, cx + cw/2, cy + ch * 0.44, cw - 6);
        if (ch > 28) {
          const valSize = Math.max(6, nameSize * 0.82);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = `${valSize}px 'DM Mono', monospace`;
          ctx.fillText(fmtV(cItem.avg) + ' avg', cx + cw/2, cy + ch * 0.68, cw - 4);
        }
        if (ch > 40) {
          const valSize = Math.max(6, nameSize * 0.75);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = `${valSize}px 'DM Mono', monospace`;
          ctx.fillText(cItem.count + ' agents', cx + cw/2, cy + ch * 0.86, cw - 4);
        }
      }
    }

    // Region label bar at top of region block
    ctx.fillStyle = rc;
    ctx.fillRect(rRect.x, rRect.y, rRect.w, 14);
    const lblSize = Math.max(8, Math.min(11, rRect.w * 0.07));
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `500 ${lblSize}px 'DM Mono', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(rItem.region + '  ' + fmtV(rItem.avg) + ' avg  ' + rItem.count + ' agents',
      rRect.x + 6, rRect.y + 10, rRect.w - 8);
  }
}

function hexToRgb(hex) {
  // handles #rrggbb → 'r,g,b'
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}