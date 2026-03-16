'use strict';
// ─────────────────────────────────────────────────
// SIM — orchestration, loop, controls
// ─────────────────────────────────────────────────

let agents       = [];
let tradeLog     = [];
let round        = 0;
let totalDeaths        = 0;
let totalBankruptcies  = 0;
let playing      = false;
let started      = false;
let rafId        = null;
let lastFrame    = 0;
let inspectedId  = null;
let giniHistory  = [];   // rolling last 300 values
let taxPoolHistory = []; // rolling last 300 values

const recessionState = { active: false, roundsLeft: 0 };
const taxPool        = { amount: 0 };

// ── DEFAULTS ──
const DEFAULTS = {
  agentCount:       250,
  startWealth:      100,
  trades:           10,
  maxbet:           50,
  taxMode:          'flat',
  flatTax:          0,
  brackets:         [0, 10, 25, 45],
  redist:           50,
  luck:             0,
  inheritPct:       90,
  bankruptcyPayout: 10,
  recessionChance:  0,
  mortalityRate:    0,      // annual % after age 40, 0 = off
  timeUnit:         'week',
  speed:            60,
  tiers:       { poor: 0, normal: 100, skilled: 0, elite: 0 },
  winRates:    { poor: 48, normal: 50, skilled: 51, elite: 53 },
  redistWeights: { poor: 1.5, normal: 1.0, skilled: 0.7, elite: 0.4 },
};

const p = JSON.parse(JSON.stringify(DEFAULTS));

function roundsPerYear() {
  return p.timeUnit === 'day' ? 365 : p.timeUnit === 'week' ? 52 : 12;
}

// ── INIT ──
function init() {
  agents         = buildInitialAgents(p.agentCount, p.startWealth, p.tiers);
  tradeLog       = [];
  round          = 0;
  totalDeaths        = 0;
  totalBankruptcies  = 0;
  taxPool.amount = 0;
  giniHistory    = [];
  taxPoolHistory = [];
  recessionState.active     = false;
  recessionState.roundsLeft = 0;
  inspectedId    = null;
  closeInspector();
  redraw();
  updateHeader(agents, round, roundsPerYear(), totalDeaths, totalBankruptcies);
}

// ── STEP ──
function step() {
  const rpy = roundsPerYear();
  const stepResult = runStep(agents, {
    trades: p.trades, maxbet: p.maxbet,
    taxMode: p.taxMode, flatTax: p.flatTax, brackets: p.brackets,
    redist: p.redist, luck: p.luck,
    winRates: p.winRates,
    redistWeights: p.redistWeights,
    bankruptcyPayout: p.bankruptcyPayout,
    baseWealth: p.startWealth,
    round, roundsPerYear: rpy,
  }, tradeLog, recessionState, taxPool);
  if (stepResult) totalBankruptcies += stepResult.bankruptciesThisStep;

  // Natural death + random mortality
  const dead = tickLifespans(agents, rpy, p.mortalityRate);
  for (const deceased of dead) {
    totalDeaths++;
    const { successor, taxContribution } = spawnSuccessor(deceased, p.inheritPct, p.startWealth);
    taxPool.amount += taxContribution;
    agents[agents.indexOf(deceased)] = successor;
  }

  // Random recession
  if (p.recessionChance > 0 && !recessionState.active && round > 0 && round % 100 === 0) {
    if (Math.random() * 100 < p.recessionChance) {
      applyRecessionShock(agents, recessionState);
      document.getElementById('pill-recession').style.display = '';
    }
  }
  if (!recessionState.active) document.getElementById('pill-recession').style.display = 'none';

  // Record histories every 10 rounds
  if (round % 10 === 0) {
    const vals = agents.filter(a => a.alive).map(a => a.wealth);
    giniHistory.push(gini(vals));
    taxPoolHistory.push(taxPool.amount);
    if (giniHistory.length > 300)    giniHistory.shift();
    if (taxPoolHistory.length > 300) taxPoolHistory.shift();
  }

  round++;
}

// ── DRAW ──
function redraw() {
  const bc = document.getElementById('barCanvas');
  const lc = document.getElementById('lorenzCanvas');
  const gc = document.getElementById('giniCanvas');
  const ec = document.getElementById('economyCanvas');
  resizeCanvas(bc); resizeCanvas(lc); resizeCanvas(gc); resizeCanvas(ec);
  drawBars(bc, agents, inspectedId, roundsPerYear());
  drawLorenz(lc, agents);
  drawLineChart(gc, [
    { values: giniHistory, color: '#e85050', width: 1.5, label: 'Gini' }
  ], { minY: 0, maxY: 1, yDecimals: 2, xLabel: '← last 300 snapshots' });
  drawEconomy(ec, agents, taxPool, totalDeaths, totalBankruptcies);
}
window._redraw = redraw;

// ── LOOP ──
function loop(ts) {
  const interval = p.speed === 0 ? 0 : p.speed;
  if (ts - lastFrame >= interval) {
    step();
    redraw();
    updateHeader(agents, round, roundsPerYear(), totalDeaths, totalBankruptcies);
    const active = document.querySelector('.tab-panel.active');
    if (active) {
      if (active.id === 'panel-agents') renderAgentsView(agents, roundsPerYear(), inspectedId);
      if (active.id === 'panel-log')    renderLog(tradeLog);
    }
    // Always update inspector if open (fix: works regardless of play state)
    if (inspectedId !== null) {
      const ag = agents.find(a => a.id === inspectedId && a.alive);
      if (ag) renderInspector(ag, agents, roundsPerYear());
      else    closeInspector();
    }
    lastFrame = ts;
  }
  if (playing) rafId = requestAnimationFrame(loop);
}

function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  lastFrame = 0;
  rafId = requestAnimationFrame(loop);
}

// ── CONTROLS ──
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
  applyRecessionShock(agents, recessionState);
  document.getElementById('pill-recession').style.display = '';
}

function closeInspector() {
  inspectedId = null;
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
  const ag = agents.find(a => a.id === id && a.alive);
  if (!ag) return;
  document.getElementById('inspector').style.display = '';
  renderInspector(ag, agents, roundsPerYear());
};

function clearLog() { tradeLog = []; renderLog(tradeLog); }

// ── RESET PARAMS ──
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
  ];
  sliders.forEach(([sid, did, val]) => {
    const sl = document.getElementById(sid), dp = document.getElementById(did);
    if (sl) sl.value = val;
    if (dp) dp.textContent = val;
  });

  document.getElementById('sel-speed').value    = p.speed;
  document.getElementById('sel-timeunit').value = p.timeUnit;
  document.getElementById('sel-taxmode').value  = p.taxMode;
  document.getElementById('flat-tax-ctrl').style.display    = p.taxMode === 'flat'    ? '' : 'none';
  document.getElementById('bracket-tax-ctrl').style.display = p.taxMode === 'bracket' ? '' : 'none';

  p.brackets.forEach((v, i) => { const el = document.getElementById(`br-${i+1}`); if (el) el.value = v; });

  Object.entries(p.tiers).forEach(([tier, val]) => {
    const el = document.getElementById(`tier-${tier}`); if (el) el.value = val;
  });
  Object.entries(p.winRates).forEach(([tier, val]) => {
    const sl = document.getElementById(`wr-${tier}`), dp = document.getElementById(`disp-wr-${tier}`);
    if (sl) sl.value = val; if (dp) dp.textContent = val + '%';
  });
  Object.entries(p.redistWeights).forEach(([tier, val]) => {
    const sl = document.getElementById(`rw-${tier}`), dp = document.getElementById(`disp-rw-${tier}`);
    if (sl) sl.value = val; if (dp) dp.textContent = val + '×';
  });
  document.getElementById('tier-warn').style.display = 'none';
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
  if (ag) { window._selectAgent(ag.id); switchTab('agents'); }
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

bs('sl-agents',     'disp-agents',    v => p.agentCount       = v, true);
bs('sl-start',      'disp-start',     v => p.startWealth      = v, true);
bs('sl-trades',     'disp-trades',    v => p.trades           = v);
bs('sl-maxbet',     'disp-maxbet',    v => p.maxbet           = v);
bs('sl-tax',        'disp-tax',       v => p.flatTax          = v);
bs('sl-redist',     'disp-redist',    v => p.redist           = v);
bs('sl-luck',       'disp-luck',      v => p.luck             = v);
bs('sl-inherit',    'disp-inherit',   v => p.inheritPct       = v);
bs('sl-bankruptcy', 'disp-bankruptcy',v => p.bankruptcyPayout = v);
bs('sl-recession',  'disp-recession', v => p.recessionChance  = v);
bs('sl-mortality',  'disp-mortality', v => p.mortalityRate    = v);

document.getElementById('sel-speed').addEventListener('change',   e => { p.speed    = +e.target.value; });
document.getElementById('sel-timeunit').addEventListener('change', e => { p.timeUnit = e.target.value;  });

document.getElementById('sel-taxmode').addEventListener('change', e => {
  p.taxMode = e.target.value;
  document.getElementById('flat-tax-ctrl').style.display    = e.target.value === 'flat'    ? '' : 'none';
  document.getElementById('bracket-tax-ctrl').style.display = e.target.value === 'bracket' ? '' : 'none';
});

['br-1','br-2','br-3','br-4'].forEach((id, i) => {
  document.getElementById(id)?.addEventListener('input', e => { p.brackets[i] = +e.target.value; });
});

['poor','normal','skilled','elite'].forEach(tier => {
  document.getElementById(`tier-${tier}`)?.addEventListener('input', e => {
    p.tiers[tier] = +e.target.value;
    // Auto-balance: keep normal = 100 - (poor + skilled + elite)
    if (tier !== 'normal') {
      const others = p.tiers.poor + p.tiers.skilled + p.tiers.elite;
      p.tiers.normal = Math.max(0, 100 - others);
      const normalEl = document.getElementById('tier-normal');
      if (normalEl) normalEl.value = p.tiers.normal;
    }
    const sum = Object.values(p.tiers).reduce((s, v) => s + v, 0);
    document.getElementById('tier-warn').style.display = Math.abs(sum - 100) > 1 ? '' : 'none';
    if (started && Math.abs(sum - 100) <= 1) reset();
  });
  document.getElementById(`wr-${tier}`)?.addEventListener('input', e => {
    p.winRates[tier] = +e.target.value;
    const dp = document.getElementById(`disp-wr-${tier}`);
    if (dp) dp.textContent = e.target.value + '%';
  });
  document.getElementById(`rw-${tier}`)?.addEventListener('input', e => {
    p.redistWeights[tier] = +e.target.value;
    const dp = document.getElementById(`disp-rw-${tier}`);
    if (dp) dp.textContent = (+e.target.value).toFixed(1) + '×';
  });
});

document.getElementById('log-filter')?.addEventListener('input', () => renderLog(tradeLog));

// ── RESIZE ──
const ro = new ResizeObserver(() => redraw());
['barCanvas','lorenzCanvas','giniCanvas','economyCanvas'].forEach(id => {
  const el = document.getElementById(id);
  if (el) ro.observe(el);
});

// ── BOOT ──
init();