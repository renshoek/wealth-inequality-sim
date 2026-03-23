'use strict';
// ─────────────────────────────────────────────────
// SIM — orchestration, loop, controls
// ─────────────────────────────────────────────────

let agents            = [];
let tradeLog          = [];
let round             = 0;
let totalDeaths       = 0;
let totalBankruptcies = 0;
let playing           = false;
let started           = false;
let rafId             = null;
let lastFrame         = 0;
let inspectedId       = null;
let giniHistory       = [];
let taxPoolHistory    = [];

let simView = 'charts'; // 'charts' | 'bubbles'
const bubbleState = {
  positions: new Map(),
  flashes:   [],
  flashBuf:  [],        // drained each step, passed to runStep
  zones:     null,
  lastW:     0,
  lastH:     0,
};
// Physics knobs — exposed to debug panel
const bubblePhysics = {
  globalStr:  0.010,   // wealth-to-canvas-center force
  cityStr:    0.020,   // city cohesion force
  damping:    0.94,    // velocity damping per frame
  jitter:     0.12,    // random wiggle per frame
  spacing:    6,       // min px gap between bubble edges
  flashTTL:   1800,    // ms trade lines stay visible
};

// All agents ever created (alive + deceased) — used by History tab
let allAgentsMap = new Map();

const SIM_START   = new Date(1999, 11, 6);
let simDate       = new Date(SIM_START);
let redistPending = false;

const recessionState = { active: false, roundsLeft: 0 };
const taxPool        = { amount: 0 };

const DEFAULTS = {
  agentCount:       350,
  startWealth:      450,
  trades:           10,
  maxbet:           40,
  taxMode:          'wealth-flat',
  flatTax:          0,
  brackets:         [0, 10, 25, 45],
  redist:           1,
  luck:             1,
  inheritPct:       90,
  bankruptcyPayout: 10,
  recessionChance:  1,
  mortalityRate:    0.2,
  timeUnit:         'week',
  speed:            16,
  moneyPrint:       100,
  redistWeights: { q1: 1.0, q2: 1.0, q3: 1.0, q4: 1.0 },
  cityThreshold:     60,
  regionalThreshold: 90,
  tradeWeight:       0,   // 0 = uniform, 1 = fully wealth-weighted initiator & partner selection
};

const p = JSON.parse(JSON.stringify(DEFAULTS));

function roundsPerYear() {
  return p.timeUnit === 'day' ? 365 : p.timeUnit === 'week' ? 52 : 12;
}

function advanceDate() {
  const prevYear = simDate.getFullYear();
  if (p.timeUnit === 'day') {
    simDate = new Date(simDate.getFullYear(), simDate.getMonth(), simDate.getDate() + 1);
  } else if (p.timeUnit === 'week') {
    simDate = new Date(simDate.getFullYear(), simDate.getMonth(), simDate.getDate() + 7);
  } else {
    simDate = new Date(simDate.getFullYear(), simDate.getMonth() + 1, simDate.getDate());
  }
  return simDate.getFullYear() !== prevYear;
}

function init() {
  simDate       = new Date(SIM_START);
  redistPending = false;
  agents = buildInitialAgents(p.agentCount, p.startWealth, fmtDate(simDate));
  allAgentsMap  = new Map();
  for (const ag of agents) allAgentsMap.set(ag.id, ag);
  tradeLog           = [];
  round              = 0;
  totalDeaths        = 0;
  totalBankruptcies  = 0;
  taxPool.amount     = 0;
  giniHistory        = [];
  taxPoolHistory     = [];
  recessionState.active     = false;
  recessionState.roundsLeft = 0;
  inspectedId        = null;
  bubbleState.positions.clear();
  bubbleState.flashes.length   = 0;
  bubbleState.flashBuf.length  = 0;
  bubbleState.zones  = null;
  bubbleState.lastW  = 0;
  bubbleState.lastH  = 0;
  closeInspector();
  redraw();
  updateHeader(agents, simDate, totalDeaths, totalBankruptcies);
}

function step() {
  const rpy = roundsPerYear();
  const yearChanged = advanceDate();
  const doRedist    = redistPending;
  redistPending     = yearChanged;

  bubbleState.flashBuf.length = 0; // drain before step

  const stepResult = runStep(agents, {
    trades: p.trades, maxbet: p.maxbet,
    taxMode: p.taxMode, flatTax: p.flatTax, brackets: p.brackets,
    redist: p.redist, luck: p.luck,
    redistWeights: p.redistWeights,
    bankruptcyPayout: p.bankruptcyPayout,
    baseWealth: p.startWealth,
    moneyPrint: p.moneyPrint,
    cityThreshold: p.cityThreshold,
    regionalThreshold: p.regionalThreshold,
    tradeWeight: p.tradeWeight,
    round, roundsPerYear: rpy,
    yearChanged, redistPending: doRedist,
  }, tradeLog, recessionState, taxPool, bubbleState.flashBuf);

  // Convert flashBuf → screen-space flash lines (only if bubble view active)
  if (simView === 'bubbles' && bubbleState.zones && bubbleState.flashBuf.length) {
    const now = performance.now();
    for (const f of bubbleState.flashBuf) {
      const pa = bubbleState.positions.get(f.aId);
      const pb = bubbleState.positions.get(f.bId);
      if (pa && pb) {
        const col = f.scope === 'local' ? '#4fc4a0' : f.scope === 'regional' ? '#f0c040' : '#e85050';
        bubbleState.flashes.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, born: now, color: col });
        if (bubbleState.flashes.length > 800) bubbleState.flashes.shift();
      }
    }
  }

  if (stepResult) totalBankruptcies += stepResult.bankruptciesThisStep;

  for (const ag of agents) {
    if (ag.alive && ag.wealth > ag.peakWealth) ag.peakWealth = ag.wealth;
  }

  const dead = tickLifespans(agents, rpy, p.mortalityRate);
  for (const deceased of dead) {
    deceased.deathDateStr = fmtDate(simDate);
    totalDeaths++;
    const { successor, taxContribution } = spawnSuccessor(
      deceased, p.inheritPct, p.startWealth, fmtDate(simDate)
    );
    taxPool.amount += taxContribution;
    agents[agents.indexOf(deceased)] = successor;
    allAgentsMap.set(successor.id, successor);
  }

  if (p.recessionChance > 0 && !recessionState.active && round > 0 && round % 100 === 0) {
    if (Math.random() * 100 < p.recessionChance) {
      applyRecessionShock(agents, recessionState, taxPool);
      document.getElementById('pill-recession').style.display = '';
    }
  }
  if (!recessionState.active) document.getElementById('pill-recession').style.display = 'none';

  if (round % 10 === 0) {
    const vals = agents.filter(a => a.alive).map(a => a.wealth);
    giniHistory.push(gini(vals));
    taxPoolHistory.push(taxPool.amount);
    if (giniHistory.length > 300)    giniHistory.shift();
    if (taxPoolHistory.length > 300) taxPoolHistory.shift();
  }

  round++;
}

function redraw() {
  const bc = document.getElementById('barCanvas');
  const lc = document.getElementById('lorenzCanvas');
  const gc = document.getElementById('giniCanvas');
  const ec = document.getElementById('economyCanvas');
  resizeCanvas(bc); resizeCanvas(lc); resizeCanvas(gc); resizeCanvas(ec);
  drawBars(bc, agents, inspectedId, roundsPerYear());
  drawLorenz(lc, agents);
  drawLineChart(gc, [
    { values: giniHistory, color: '#e85050', width: 1.5 }
  ], { minY: 0, maxY: 1, yDecimals: 2, xLabel: '← last 300 snapshots' });
  drawEconomy(ec, agents, taxPool, totalDeaths, totalBankruptcies);
}
window._redraw = redraw;

function loop(ts) {
  const interval = p.speed === 0 ? 0 : p.speed;
  if (ts - lastFrame >= interval) {
    step();
    if (simView === 'charts') redraw();
    updateHeader(agents, simDate, totalDeaths, totalBankruptcies);
    const active = document.querySelector('.tab-panel.active');
    if (active) {
      if (active.id === 'panel-agents') {
        renderAgentsView(agents, roundsPerYear(), inspectedId);
        if (inspectedId !== null) {
          const _iag = agents.find(a => a.id === inspectedId && a.alive) || allAgentsMap.get(inspectedId);
          if (_iag) renderInspector(_iag, agents, roundsPerYear());
        }
      }
      if (active.id === 'panel-log'     && round % 25 === 0) renderLog(tradeLog);
      if (active.id === 'panel-history' && round % 30 === 0) renderHistoryTab();
      if (active.id === 'panel-geo')     renderGeographyTab();
      if (active.id === 'panel-detail' && inspectedId !== null && round % 5 === 0) {
        const _dag = agents.find(a => a.id === inspectedId && a.alive) || allAgentsMap.get(inspectedId);
        if (_dag) renderAgentDetail(_dag, agents, tradeLog, roundsPerYear());
        else      closeInspector();
      }
    }
    lastFrame = ts;
  }

  // Bubble physics + draw runs every rAF frame for smooth animation,
  // regardless of simulation step rate
  if (simView === 'bubbles') {
    const active = document.querySelector('.tab-panel.active');
    if (active?.id === 'panel-sim') _tickAndDrawBubbles();
  }

  if (playing) rafId = requestAnimationFrame(loop);
}

function _tickAndDrawBubbles() {
  const bc = document.getElementById('bubbleCanvas');
  if (!bc) return;
  const rect = bc.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  if (bubbleState.lastW !== rect.width || bubbleState.lastH !== rect.height) {
    resizeCanvas(bc);
    bubbleState.zones = computeBubbleZones(rect.width, rect.height);
    bubbleState.lastW = rect.width;
    bubbleState.lastH = rect.height;
  }
  ensureBubblePositions(agents, bubbleState.positions, bubbleState.zones);
  tickBubbles(agents, bubbleState.positions, bubbleState.zones, rect.width, rect.height, bubblePhysics);
  drawBubbles(bc, agents, bubbleState.positions, bubbleState.zones, bubbleState.flashes, performance.now(), bubblePhysics);
}

function setSimView(v) {
  simView = v;
  document.getElementById('btn-sim-charts').classList.toggle('active', v === 'charts');
  document.getElementById('btn-sim-bubbles').classList.toggle('active', v === 'bubbles');
  document.getElementById('sim-charts-left').style.display = v === 'charts' ? '' : 'none';
  document.getElementById('sim-charts-mid').style.display  = v === 'charts' ? '' : 'none';
  document.getElementById('bubbles-section').style.display = v === 'bubbles' ? 'flex' : 'none';
  if (v === 'charts') redraw();
  if (v === 'bubbles') {
    const bc = document.getElementById('bubbleCanvas');
    if (bc) {
      const rect = bc.getBoundingClientRect();
      if (rect.width && rect.height) {
        resizeCanvas(bc);
        bubbleState.zones = computeBubbleZones(rect.width, rect.height);
        bubbleState.lastW = rect.width;
        bubbleState.lastH = rect.height;
        ensureBubblePositions(agents, bubbleState.positions, bubbleState.zones);
      }
    }
  }
}
window.setSimView = setSimView;

function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  lastFrame = 0;
  rafId = requestAnimationFrame(loop);
}

function startSim() {
  started = true; playing = true;
  document.getElementById('startBlock').style.display  = 'none';
  document.getElementById('simControls').style.display = 'flex';
  init(); startLoop();
}

function togglePlay() {
  playing = !playing;
  document.querySelectorAll('.btn-play').forEach(b => b.textContent = playing ? '⏸ Pause' : '▶ Play');
  if (playing) startLoop();
}

function reset() {
  if (rafId) cancelAnimationFrame(rafId);
  init();
  if (playing) startLoop();
}

function triggerRecession() {
  if (!started) return;
  applyRecessionShock(agents, recessionState, taxPool);
  document.getElementById('pill-recession').style.display = '';
}

function closeInspector() {
  inspectedId = null;
  if (typeof _detailBuiltForId !== 'undefined') window._detailBuiltForId = null;
  // reset the module-level var in ui.js scope via a shared reset
  if (window._resetDetailBuild) window._resetDetailBuild();
  const active = document.querySelector('.tab-panel.active');
  if (active && active.id === 'panel-detail') switchTab('sim');
  document.getElementById('inspector').style.display = 'none';
  const ph = document.getElementById('detail-placeholder');
  if (ph) ph.style.display = '';
  const ci = document.getElementById('inspectorChart');
  if (ci) ci.style.display = 'none';
  const si = document.getElementById('inspectorStats');
  if (si) si.style.display = 'none';
}

window._selectAgent = function(id) {
  inspectedId = id;
  const ag = agents.find(a => a.id === id && a.alive) || allAgentsMap.get(id);
  if (!ag) return;
  // First step: show side panel in agents tab
  switchTab('agents');
  renderInspector(ag, agents, roundsPerYear());
};

window._openDetailPage = function(id) {
  inspectedId = id;
  const ag = agents.find(a => a.id === id && a.alive) || allAgentsMap.get(id);
  if (!ag) return;
  switchTab('detail');
  renderAgentDetail(ag, agents, tradeLog, roundsPerYear());
};

function clearLog() { tradeLog = []; renderLog(tradeLog); }

function resetParams() {
  Object.assign(p, JSON.parse(JSON.stringify(DEFAULTS)));
  syncAllControls();
  if (started) reset();
}

function syncAllControls() {
  const sliders = [
    ['sl-agents',      'disp-agents',      p.agentCount],
    ['sl-start',       'disp-start',       p.startWealth],
    ['sl-trades',      'disp-trades',      p.trades],
    ['sl-maxbet',      'disp-maxbet',      p.maxbet],
    ['sl-tax',         'disp-tax',         p.flatTax],
    ['sl-redist',      'disp-redist',      p.redist],
    ['sl-luck',        'disp-luck',        p.luck],
    ['sl-inherit',     'disp-inherit',     p.inheritPct],
    ['sl-bankruptcy',  'disp-bankruptcy',  p.bankruptcyPayout],
    ['sl-recession',   'disp-recession',   p.recessionChance],
    ['sl-mortality',   'disp-mortality',   p.mortalityRate],
    ['sl-moneyprint',  'disp-moneyprint',  p.moneyPrint],
    ['sl-city-threshold',     'disp-city-threshold',     p.cityThreshold],
    ['sl-regional-threshold', 'disp-regional-threshold', p.regionalThreshold],
    ['sl-trade-weight',       'disp-trade-weight',       p.tradeWeight],
  ];
  sliders.forEach(([sid, did, val]) => {
    const sl = document.getElementById(sid), dp = document.getElementById(did);
    if (sl) sl.value = val;
    if (dp) dp.textContent = val;
  });
  document.getElementById('sel-speed').value        = p.speed;
  document.getElementById('sel-timeunit').value     = p.timeUnit;
  document.getElementById('sel-taxmode').value      = p.taxMode;
  document.getElementById('flat-tax-ctrl').style.display    = (p.taxMode === 'wealth-flat'    || p.taxMode === 'income-flat')    ? '' : 'none';
  document.getElementById('bracket-tax-ctrl').style.display = (p.taxMode === 'wealth-bracket' || p.taxMode === 'income-bracket') ? '' : 'none';
  p.brackets.forEach((v, i) => { const el = document.getElementById(`br-${i+1}`); if (el) el.value = v; });
  Object.entries(p.redistWeights).forEach(([key, val]) => {
    const sl = document.getElementById(`rw-${key}`), dp = document.getElementById(`disp-rw-${key}`);
    if (sl) sl.value = val; if (dp) dp.textContent = (+val).toFixed(1) + '×';
  });
}

// ── BAR CANVAS CLICK ──
document.getElementById('barCanvas').addEventListener('click', e => {
  const canvas = document.getElementById('barCanvas');
  const rect   = canvas.getBoundingClientRect();
  const y      = e.clientY - rect.top;
  const H      = rect.height;
  const alive  = agents.filter(a => a.alive);
  if (!alive.length) return;
  const barH   = H / alive.length;
  const idx    = Math.floor((H - y) / barH);
  if (idx < 0 || idx >= alive.length) return;
  const sorted = [...alive].sort((a, b) => a.wealth - b.wealth);
  const ag = sorted[idx];
  if (ag) { window._selectAgent(ag.id); }
});

// ── AGENTS TAB EVENT DELEGATION ──
// pointerdown fires before the next rAF loop can replace innerHTML, unlike click
document.getElementById('agents-card-wrap')?.addEventListener('pointerdown', e => {
  const card = e.target.closest('[data-agentid]');
  if (card) window._selectAgent(+card.dataset.agentid);
});
document.getElementById('agentsBody')?.addEventListener('pointerdown', e => {
  const row = e.target.closest('[data-agentid]');
  if (row) window._selectAgent(+row.dataset.agentid);
});

// ── BIND SLIDERS ──
function bs(sid, did, setter, resetOnChange) {
  const sl = document.getElementById(sid);
  const dp = did ? document.getElementById(did) : null;
  if (!sl) return;
  sl.addEventListener('input', () => {
    setter(+sl.value);
    if (dp) dp.textContent = sl.value;
    if (resetOnChange && started) reset();
  });
}

bs('sl-agents',     'disp-agents',     v => p.agentCount       = v, true);
bs('sl-start',      'disp-start',      v => p.startWealth      = v, true);
bs('sl-trades',     'disp-trades',     v => p.trades           = v);
bs('sl-maxbet',     'disp-maxbet',     v => p.maxbet           = v);
bs('sl-tax',        'disp-tax',        v => p.flatTax          = v);
bs('sl-redist',     'disp-redist',     v => p.redist           = v);
bs('sl-luck',       'disp-luck',       v => p.luck             = v);
bs('sl-inherit',    'disp-inherit',    v => p.inheritPct       = v);
bs('sl-bankruptcy', 'disp-bankruptcy', v => p.bankruptcyPayout = v);
bs('sl-recession',  'disp-recession',  v => p.recessionChance  = v);
bs('sl-mortality',  'disp-mortality',  v => p.mortalityRate    = v);
bs('sl-moneyprint', 'disp-moneyprint', v => p.moneyPrint       = v);

// Market access threshold sliders — enforce city < regional
document.getElementById('sl-city-threshold')?.addEventListener('input', e => {
  p.cityThreshold = +e.target.value;
  const rd = document.getElementById('sl-regional-threshold');
  if (rd && p.cityThreshold >= p.regionalThreshold) {
    p.regionalThreshold = Math.min(99, p.cityThreshold + 1);
    rd.value = p.regionalThreshold;
    const dp = document.getElementById('disp-regional-threshold');
    if (dp) dp.textContent = p.regionalThreshold;
  }
  const dp = document.getElementById('disp-city-threshold');
  if (dp) dp.textContent = p.cityThreshold;
});
document.getElementById('sl-regional-threshold')?.addEventListener('input', e => {
  p.regionalThreshold = +e.target.value;
  const cd = document.getElementById('sl-city-threshold');
  if (cd && p.regionalThreshold <= p.cityThreshold) {
    p.cityThreshold = Math.max(1, p.regionalThreshold - 1);
    cd.value = p.cityThreshold;
    const dp = document.getElementById('disp-city-threshold');
    if (dp) dp.textContent = p.cityThreshold;
  }
  const dp = document.getElementById('disp-regional-threshold');
  if (dp) dp.textContent = p.regionalThreshold;
});

document.getElementById('sel-speed').addEventListener('change',   e => { p.speed    = +e.target.value; });
document.getElementById('sel-timeunit').addEventListener('change', e => { p.timeUnit = e.target.value; });

document.getElementById('sel-taxmode').addEventListener('change', e => {
  p.taxMode = e.target.value;
  const isFlat    = e.target.value === 'wealth-flat'    || e.target.value === 'income-flat';
  const isBracket = e.target.value === 'wealth-bracket' || e.target.value === 'income-bracket';
  document.getElementById('flat-tax-ctrl').style.display    = isFlat    ? '' : 'none';
  document.getElementById('bracket-tax-ctrl').style.display = isBracket ? '' : 'none';
  // Update bracket hint for the mode
  const hint = document.getElementById('bracket-hint');
  if (hint) hint.textContent = e.target.value === 'income-bracket'
    ? 'Rate per trade-gain bracket (fixed thresholds)'
    : 'Rate per wealth quartile (dynamic, recomputed each year)';
});

['br-1','br-2','br-3','br-4'].forEach((id, i) => {
  document.getElementById(id)?.addEventListener('input', e => { p.brackets[i] = +e.target.value; });
});

['q1','q2','q3','q4'].forEach(key => {
  document.getElementById(`rw-${key}`)?.addEventListener('input', e => {
    p.redistWeights[key] = +e.target.value;
    const dp = document.getElementById(`disp-rw-${key}`);
    if (dp) dp.textContent = (+e.target.value).toFixed(1) + '×';
  });
});

document.getElementById('sl-trade-weight')?.addEventListener('input', e => {
  p.tradeWeight = +e.target.value;
  const dp = document.getElementById('disp-trade-weight');
  if (dp) dp.textContent = (+e.target.value).toFixed(2);
});

document.getElementById('log-filter')?.addEventListener('input', () => renderLog(tradeLog));

const ro = new ResizeObserver(() => redraw());
['barCanvas','lorenzCanvas','giniCanvas','economyCanvas','geoCanvas'].forEach(id => {
  const el = document.getElementById(id);
  if (el) ro.observe(el);
});

// ── BUBBLE CANVAS INTERACTION ──
(function() {
  const bc = document.getElementById('bubbleCanvas');
  if (!bc) return;

  function hitTest(e) {
    const rect = bc.getBoundingClientRect();
    if (!rect.width) return null;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const alive = agents.filter(a => a.alive);
    const maxW  = Math.max(...alive.map(a => a.wealth), 1);
    for (const ag of alive) {
      const pos = bubbleState.positions.get(ag.id); if (!pos) continue;
      const r   = Math.max(3, Math.min(13, Math.sqrt(Math.max(ag.wealth,0)/maxW)*13));
      const dx  = pos.x - mx, dy = pos.y - my;
      if (dx*dx + dy*dy <= (r+3)*(r+3)) return ag;
    }
    return null;
  }

  bc.addEventListener('mousemove', e => {
    if (simView !== 'bubbles') return;
    const ag = hitTest(e);
    const tt = document.getElementById('tt');
    if (!tt) return;
    if (ag) {
      const w = ag.wealth >= 1000 ? (ag.wealth/1000).toFixed(1)+'k' : ag.wealth.toFixed(0);
      tt.textContent = `${ag.name} ${ag.surname} · ${ag.location?.city ?? '?'} · ${w}`;
      tt.style.display = 'block';
      tt.style.left    = (e.clientX + 14) + 'px';
      tt.style.top     = (e.clientY - 10) + 'px';
      bc.style.cursor  = 'pointer';
    } else {
      tt.style.display = 'none';
      bc.style.cursor  = '';
    }
  });

  bc.addEventListener('mouseleave', () => {
    const tt = document.getElementById('tt'); if (tt) tt.style.display = 'none';
    bc.style.cursor = '';
  });

  bc.addEventListener('click', e => {
    if (simView !== 'bubbles') return;
    const ag = hitTest(e);
    if (ag) window._selectAgent(ag.id);
  });
})();

init();

// ── BUBBLE PHYSICS DEBUG PANEL ──
(function() {
  function bp(id, valId, key, parse) {
    const sl = document.getElementById(id);
    const vl = document.getElementById(valId);
    if (!sl || !vl) return;
    sl.addEventListener('input', () => {
      bubblePhysics[key] = parse(sl.value);
      vl.textContent = sl.value;
    });
  }
  bp('bp-global',  'bp-global-v',  'globalStr', parseFloat);
  bp('bp-city',    'bp-city-v',    'cityStr',   parseFloat);
  bp('bp-damp',    'bp-damp-v',    'damping',   parseFloat);
  bp('bp-jitter',  'bp-jitter-v',  'jitter',    parseFloat);
  bp('bp-spacing', 'bp-spacing-v', 'spacing',   parseInt);
  bp('bp-ttl',     'bp-ttl-v',     'flashTTL',  parseInt);
})();