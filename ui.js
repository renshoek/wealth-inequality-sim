'use strict';
// ─────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────

let uiThrottle = 0;
let agentsView = 'cards';
let agentsSort = 'wealth';

let selectedFamilySurname  = null;
let selectedHistoryAgentId = null;
let historyEventsReady     = false;
let historyFamilySort      = 'wealth';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s) {
  return String(s ?? '').replace(/"/g,'&quot;');
}
function fmtW(v) {
  return v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'k' : (+v).toFixed(0);
}

// Color agent by wealth percentile rank among alive agents
// bottom 50% = muted blue, 50-75% = grey-blue, 75-90% = gold, top 10% = red
function wealthColor(agent, alive) {
  const sorted = [...alive].sort((a, b) => a.wealth - b.wealth);
  const idx = sorted.findIndex(a => a.id === agent.id);
  const pct = alive.length > 1 ? idx / (alive.length - 1) : 0.5;
  if (pct >= 0.90) return '#e85050';
  if (pct >= 0.75) return '#f0c040';
  if (pct >= 0.50) return '#7799bb';
  return '#5a6e82';
}

// ── HEADER ──
function updateHeader(agents, simDate, totalDeaths, totalBankruptcies) {
  const now = Date.now();
  if (now - uiThrottle < 80) return;
  uiThrottle = now;

  const alive  = agents.filter(a => a.alive);
  const vals   = alive.map(a => a.wealth);
  const g      = gini(vals);
  const total  = vals.reduce((s, v) => s + v, 0);
  const sorted = [...vals].sort((a, b) => b - a);
  const top10  = sorted.slice(0, Math.ceil(alive.length * 0.1)).reduce((s, v) => s + v, 0);

  document.getElementById('val-gini').textContent     = g.toFixed(2);
  document.getElementById('val-round').textContent    = fmtDate(simDate);
  document.getElementById('val-top10').textContent    = total > 0 ? ((top10 / total) * 100).toFixed(0) + '%' : '—';
  document.getElementById('val-bankrupt').textContent = totalBankruptcies;
  document.getElementById('val-deaths').textContent   = totalDeaths;
  document.getElementById('val-gini').style.color = g < 0.3 ? '#4fc4a0' : g < 0.5 ? '#f0c040' : '#e85050';
}

// ── VIEW TOGGLE ──
function setAgentsView(mode) {
  agentsView = mode;
  document.getElementById('btn-view-cards').classList.toggle('active', mode === 'cards');
  document.getElementById('btn-view-table').classList.toggle('active', mode === 'table');
  document.getElementById('agents-card-wrap').style.display  = mode === 'cards' ? '' : 'none';
  document.getElementById('agents-table-wrap').style.display = mode === 'table' ? '' : 'none';
}

function setAgentsSort(s) { agentsSort = s; }

function sortAgents(alive) {
  const s = [...alive];
  switch (agentsSort) {
    case 'name':         return s.sort((a, b) => a.name.localeCompare(b.name));
    case 'age':          return s.sort((a, b) => b.ageYears - a.ageYears);
    case 'winrate':      return s.sort((a, b) => {
      const wa = a.tradesWon + a.tradesLost > 0 ? a.tradesWon / (a.tradesWon + a.tradesLost) : 0;
      const wb = b.tradesWon + b.tradesLost > 0 ? b.tradesWon / (b.tradesWon + b.tradesLost) : 0;
      return wb - wa;
    });
    case 'generation':   return s.sort((a, b) => b.generation - a.generation);
    case 'bankruptcies': return s.sort((a, b) => b.bankruptcies - a.bankruptcies);
    default:             return s.sort((a, b) => b.wealth - a.wealth);
  }
}

// ── AGENTS RENDER ──
// Note: onclick removed — event delegation in sim.js handles all card/row clicks
function renderAgentsView(agents, roundsPerYear, inspectedId) {
  if (agentsView === 'table') renderAgentsTable(agents, roundsPerYear, inspectedId);
  else                        renderAgentsCards(agents, roundsPerYear, inspectedId);
}

function renderAgentsTable(agents, roundsPerYear, inspectedId) {
  const alive  = agents.filter(a => a.alive);
  const total  = alive.reduce((s, a) => s + a.wealth, 0);
  const sorted = sortAgents(alive);
  document.getElementById('agentsBody').innerHTML = sorted.map((ag, rank) => {
    const wr  = ag.tradesWon + ag.tradesLost > 0
      ? ((ag.tradesWon / (ag.tradesWon + ag.tradesLost)) * 100).toFixed(1) + '%' : '—';
    const pct = total > 0 ? ((ag.wealth / total) * 100).toFixed(2) + '%' : '—';
    const ageY    = ag.ageYears.toFixed(1);
    const lifePct = Math.min(100, ag.ageYears / ag.lifespan * 100);
    const ageColor = lifePct > 85 ? '#e85050' : lifePct > 60 ? '#f0c040' : '#4fc4a0';
    const col = wealthColor(ag, alive);
    const sel = ag.id === inspectedId ? ' class="selected"' : '';
    return `<tr${sel} data-agentid="${ag.id}" style="cursor:pointer">
      <td>${rank + 1}</td>
      <td style="color:${col}">${ag.name} ${ag.surname}</td>
      <td>${ag.location ? escHtml(ag.location.city) : '—'}</td>
      <td>${ag.location ? escHtml(ag.location.region) : '—'}</td>
      <td>${ag.wealth.toFixed(1)}</td>
      <td>${pct}</td>
      <td><span class="age-bar-wrap"><span class="age-bar" style="width:${lifePct.toFixed(0)}%;background:${ageColor}"></span><span class="age-text">${ageY}y</span></span></td>
      <td>${ag.lifespan}y</td>
      <td>${ag.tradesWon}</td><td>${ag.tradesLost}</td><td>${wr}</td>
      <td>${ag.bankruptcies}</td><td>${ag.generation}</td>
    </tr>`;
  }).join('');
}

function renderAgentsCards(agents, roundsPerYear, inspectedId) {
  const alive  = agents.filter(a => a.alive);
  const total  = alive.reduce((s, a) => s + a.wealth, 0);
  const sorted = sortAgents(alive);
  document.getElementById('agents-card-wrap').innerHTML = sorted.map((ag, rank) => {
    const lifePct  = Math.min(100, ag.ageYears / ag.lifespan * 100);
    const ageColor = lifePct > 85 ? '#e85050' : lifePct > 60 ? '#f0c040' : '#4fc4a0';
    const col  = wealthColor(ag, alive);
    const pct  = total > 0 ? ((ag.wealth / total) * 100).toFixed(1) : '0';
    const wr   = ag.tradesWon + ag.tradesLost > 0
      ? ((ag.tradesWon / (ag.tradesWon + ag.tradesLost)) * 100).toFixed(0) + '%' : '—';
    const sel  = ag.id === inspectedId ? ' agent-card--selected' : '';
    const dying = lifePct > 85 ? ' agent-card--dying' : '';
    return `<div class="agent-card${sel}${dying}" data-agentid="${ag.id}">
      <div class="ac-rank">#${rank + 1}</div>
      <div class="ac-name" style="color:${col}">${ag.name}</div>
      <div class="ac-surname" style="color:${col};opacity:.7">${ag.surname}</div>
      <div class="ac-location">${ag.location ? ag.location.city + ' · ' + ag.location.region : '—'}</div>
      <div class="ac-wealth">${ag.wealth >= 1000 ? (ag.wealth/1000).toFixed(1)+'k' : ag.wealth.toFixed(0)}</div>
      <div class="ac-share">${pct}% of total</div>
      <div class="ac-age-bar" title="${ag.ageYears.toFixed(1)}y / ${ag.lifespan}y">
        <div class="ac-age-fill" style="width:${lifePct.toFixed(0)}%;background:${ageColor}"></div>
      </div>
      <div class="ac-meta">${ag.ageYears.toFixed(0)}y · G${ag.generation} · ${wr}</div>
    </div>`;
  }).join('');
}

// ── INSPECTOR ──
function renderInspector(agent, agents, roundsPerYear) {
  if (!agent) return;
  const alive    = agents.filter(a => a.alive);
  const total    = alive.reduce((s, a) => s + a.wealth, 0);
  const byWealth = [...alive].sort((a, b) => b.wealth - a.wealth);
  const rank     = byWealth.findIndex(a => a.id === agent.id) + 1;
  const wr       = agent.tradesWon + agent.tradesLost > 0
    ? ((agent.tradesWon / (agent.tradesWon + agent.tradesLost)) * 100).toFixed(1) + '%' : '—';
  const lifePct   = Math.min(100, agent.ageYears / agent.lifespan * 100);
  const col = wealthColor(agent, alive);
  const pctChange = agent.initialWealth > 0
    ? ((agent.wealth - agent.initialWealth) / agent.initialWealth * 100).toFixed(0) : null;
  const chgColor = pctChange === null ? '#5a5e72' : +pctChange > 0 ? '#4fc4a0' : +pctChange < 0 ? '#e85050' : '#5a5e72';

  const html = `
    <div class="hpd-name" style="color:${col}">${escHtml(agent.name)} ${escHtml(agent.surname)}</div>
    <div class="hpd-sub">
      ${agent.alive ? '<span class="status-alive">● Alive</span>' : '<span class="status-dead">✝ Deceased</span>'}
      · Generation ${agent.generation}
      · ${agent.location ? escHtml(agent.location.city) : '—'}
    </div>
    ${agent.parentName ? `<div class="hpd-parent hint">Child of ${escHtml(agent.parentName)} ${escHtml(agent.surname)}</div>` : ''}
    <div class="hpd-stats">
      <div class="hpd-row"><span class="hpd-label">Wealth rank</span><span class="hpd-value">#${rank > 0 ? rank : '—'} of ${alive.length}</span></div>
      <div class="hpd-row"><span class="hpd-label">Location</span><span class="hpd-value">${agent.location ? escHtml(agent.location.city) + ' · ' + escHtml(agent.location.region) : '—'}</span></div>
      <div class="hpd-row"><span class="hpd-label">Born</span><span class="hpd-value">${escHtml(agent.birthDateStr || '—')}</span></div>
      <div class="hpd-row"><span class="hpd-label">Age</span><span class="hpd-value">${agent.ageYears.toFixed(1)}y / ${agent.lifespan}y (${lifePct.toFixed(0)}%)</span></div>
      <div class="hpd-row"><span class="hpd-label">Starting wealth</span><span class="hpd-value">${fmtW(agent.initialWealth)}</span></div>
      <div class="hpd-row"><span class="hpd-label">${agent.alive ? 'Current' : 'Final'} wealth</span><span class="hpd-value">${fmtW(agent.wealth)}</span></div>
      <div class="hpd-row"><span class="hpd-label">Peak wealth</span><span class="hpd-value">${fmtW(agent.peakWealth || agent.wealth)}</span></div>
      <div class="hpd-row"><span class="hpd-label">Share of total</span><span class="hpd-value">${total > 0 ? ((agent.wealth / total) * 100).toFixed(2) : '—'}%</span></div>
      <div class="hpd-row"><span class="hpd-label">vs starting</span><span class="hpd-value" style="color:${chgColor}">${pctChange !== null ? (+pctChange > 0 ? '+' : '') + pctChange + '%' : '—'}</span></div>
      <div class="hpd-row"><span class="hpd-label">Trades won</span><span class="hpd-value">${agent.tradesWon}</span></div>
      <div class="hpd-row"><span class="hpd-label">Trades lost</span><span class="hpd-value">${agent.tradesLost}</span></div>
      <div class="hpd-row"><span class="hpd-label">Win rate</span><span class="hpd-value">${wr}</span></div>
      <div class="hpd-row"><span class="hpd-label">Bankruptcies</span><span class="hpd-value">${agent.bankruptcies}</span></div>
    </div>`;

  const titleEl = document.getElementById('inspector-title');
  if (titleEl) titleEl.textContent = `${agent.name} ${agent.surname}`;
  const sf = document.getElementById('inspectorStatsFloat');
  if (sf) sf.innerHTML = html;
  const cf = document.getElementById('inspectorChartFloat');
  if (cf) { resizeCanvas(cf); drawMiniHistory(cf, agent.history, col); }
  const ph = document.getElementById('detail-placeholder');
  if (ph) ph.style.display = 'none';
  const ci = document.getElementById('inspectorChart');
  if (ci) { ci.style.display = 'block'; resizeCanvas(ci); drawMiniHistory(ci, agent.history, col); }
  const si = document.getElementById('inspectorStats');
  if (si) { si.style.display = 'block'; si.innerHTML = html; }
}

// ── LOG ──
function renderLog(tradeLog) {
  const filter   = document.getElementById('log-filter')?.value.trim() || '';
  const filtered = filter
    ? tradeLog.filter(e => e.aId === +filter || e.bId === +filter ||
        e.aName?.toLowerCase().includes(filter.toLowerCase()) ||
        e.bName?.toLowerCase().includes(filter.toLowerCase()) ||
        e.aCity?.toLowerCase().includes(filter.toLowerCase()) ||
        e.bCity?.toLowerCase().includes(filter.toLowerCase()))
    : tradeLog;
  const el = document.getElementById('log-count');
  if (el) el.textContent = `${filtered.length} entries`;

  const scopeColor = { local: '#4fc4a0', regional: '#f0c040', global: '#e85050' };
  const scopeTitle = { local: 'Same city', regional: 'Same region', global: 'Cross-region' };

  document.getElementById('logBody').innerHTML = filtered.map(e => {
    const aWon  = e.winner === e.aId;
    const scope = e.scope || 'local';
    const sc    = scopeColor[scope] || '#5a6080';
    const aCity = e.aCity ? `<span class="log-city">${escHtml(e.aCity)}</span>` : '';
    const bCity = e.bCity ? `<span class="log-city">${escHtml(e.bCity)}</span>` : '';
    const crossCity = e.aCity && e.bCity && e.aCity !== e.bCity
      ? `<span class="log-cross">↔ ${escHtml(e.aCity)} → ${escHtml(e.bCity)}</span>` : '';
    return `<tr>
      <td class="log-round">${e.round}</td>
      <td><span class="log-scope" style="color:${sc};border-color:${sc}">${scope}</span></td>
      <td class="${aWon ? 'win-a' : ''}">${escHtml(e.aName ?? '#' + e.aId)} ${escHtml(e.aSurname ?? '')}${aCity}</td>
      <td class="${!aWon ? 'win-a' : ''}">${escHtml(e.bName ?? '#' + e.bId)} ${escHtml(e.bSurname ?? '')}${bCity}</td>
      <td class="log-stake">${e.stake}</td>
      <td class="log-winner">${escHtml(e.winnerName ?? '#' + e.winner)}</td>
      <td class="log-after">${e.aAfter}</td>
      <td class="log-after">${e.bAfter}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════
// HISTORY TAB
// ══════════════════════════════════════════════

function initHistoryEvents() {
  if (historyEventsReady) return;
  historyEventsReady = true;

  document.getElementById('family-list')?.addEventListener('click', e => {
    const card = e.target.closest('[data-surname]');
    if (!card) return;
    selectedFamilySurname  = card.dataset.surname;
    selectedHistoryAgentId = null;
    renderFamilyList();
    renderGenealogy();
    renderHistoryPersonDetail();
  });

  document.getElementById('genealogy-persons')?.addEventListener('click', e => {
    const card = e.target.closest('[data-agentid]');
    if (!card) return;
    selectedHistoryAgentId = +card.dataset.agentid;
    renderHistoryPersonDetail();
    // highlight selected card
    document.querySelectorAll('#genealogy-persons [data-agentid]').forEach(el => {
      el.classList.toggle('gpc--selected', +el.dataset.agentid === selectedHistoryAgentId);
    });
  });

  document.getElementById('family-search')?.addEventListener('input', () => renderFamilyList());

  document.getElementById('history-sort')?.addEventListener('change', e => {
    historyFamilySort = e.target.value;
    renderFamilyList();
    renderGenealogy();
  });
}

function getFamilies() {
  const map = new Map();
  for (const ag of allAgentsMap.values()) {
    const key = ag.surname || '?';
    if (!map.has(key)) map.set(key, { surname: key, members: [] });
    map.get(key).members.push(ag);
  }
  const families = [];
  for (const f of map.values()) {
    f.members.sort((a, b) => a.generation - b.generation || a.id - b.id);
    f.maxGen       = Math.max(...f.members.map(m => m.generation));
    f.livingCount  = f.members.filter(m => m.alive).length;
    f.livingWealth = f.members.filter(m => m.alive).reduce((s, m) => s + m.wealth, 0);
    f.peakWealth   = Math.max(...f.members.map(m => m.peakWealth || m.wealth));
    f.totalCount   = f.members.length;
    const g0wealth = f.members[0]?.initialWealth ?? 1;
    const lastW    = f.members[f.members.length - 1]?.wealth ?? 0;
    f.wealthTrend  = lastW / Math.max(g0wealth, 1);
    families.push(f);
  }

  families.sort((a, b) => {
    switch (historyFamilySort) {
      case 'wealth':      return b.livingWealth - a.livingWealth;
      case 'peak':        return b.peakWealth   - a.peakWealth;
      case 'members':     return b.totalCount   - a.totalCount;
      case 'trend':       return b.wealthTrend  - a.wealthTrend;
      case 'generations':
      default:
        return b.maxGen !== a.maxGen ? b.maxGen - a.maxGen : b.livingWealth - a.livingWealth;
    }
  });
  return families;
}

function renderFamilyList() {
  const el = document.getElementById('family-list');
  if (!el) return;
  const search = (document.getElementById('family-search')?.value || '').toLowerCase();
  let fams = getFamilies();
  if (search) fams = fams.filter(f =>
    f.surname.toLowerCase().includes(search) ||
    f.members.some(m => (m.name + ' ' + m.surname).toLowerCase().includes(search))
  );

  el.innerHTML = fams.slice(0, 200).map(f => {
    const sel   = f.surname === selectedFamilySurname ? ' family-card--selected' : '';
    const trend = f.wealthTrend > 1.05 ? '▲' : f.wealthTrend < 0.95 ? '▼' : '→';
    const tCol  = f.wealthTrend > 1.05 ? '#4fc4a0' : f.wealthTrend < 0.95 ? '#e85050' : '#5a5e72';
    return `<div class="family-card${sel}" data-surname="${escAttr(f.surname)}">
      <div class="family-card-name">${escHtml(f.surname)}</div>
      <div class="family-card-meta">${f.maxGen + 1} gen · ${f.totalCount} ppl · <span style="color:${tCol}">${trend} ${fmtW(f.livingWealth)}</span></div>
    </div>`;
  }).join('');
}

function renderGenealogy() {
  const headerEl  = document.getElementById('genealogy-header');
  const personsEl = document.getElementById('genealogy-persons');
  const emptyEl   = document.getElementById('genealogy-empty');
  const chartEl   = document.getElementById('genealogyChart');

  if (!selectedFamilySurname) {
    if (emptyEl)   emptyEl.style.display   = '';
    if (headerEl)  { headerEl.innerHTML = ''; headerEl.style.display = 'none'; }
    if (chartEl)   chartEl.style.display   = 'none';
    if (personsEl) personsEl.style.display = 'none';
    return;
  }

  if (emptyEl)   emptyEl.style.display   = 'none';
  if (headerEl)  headerEl.style.display  = '';
  if (chartEl)   chartEl.style.display   = '';
  if (personsEl) personsEl.style.display = '';

  const family = getFamilies().find(f => f.surname === selectedFamilySurname);
  if (!family) return;

  const totalBankr  = family.members.reduce((s, m) => s + m.bankruptcies, 0);
  const totalTrades = family.members.reduce((s, m) => s + m.tradesWon + m.tradesLost, 0);

  if (headerEl) {
    headerEl.innerHTML = `
      <div class="family-title">${escHtml(family.surname)}</div>
      <div class="family-stats-grid">
        <span class="fsg-item"><span class="fsg-label">Generations</span><span class="fsg-value">${family.maxGen + 1}</span></span>
        <span class="fsg-item"><span class="fsg-label">Total members</span><span class="fsg-value">${family.totalCount}</span></span>
        <span class="fsg-item"><span class="fsg-label">Alive</span><span class="fsg-value">${family.livingCount}</span></span>
        <span class="fsg-item"><span class="fsg-label">Peak wealth</span><span class="fsg-value">${fmtW(family.peakWealth)}</span></span>
        <span class="fsg-item"><span class="fsg-label">Trades</span><span class="fsg-value">${totalTrades}</span></span>
        <span class="fsg-item"><span class="fsg-label">Bankruptcies</span><span class="fsg-value">${totalBankr}</span></span>
      </div>
      <div class="genealogy-legend">
        <span class="legend-line" style="background:#f0c040"></span> peak wealth per member &nbsp;
        <span class="legend-line" style="background:#4fc4a0"></span> starting wealth per member &nbsp;·&nbsp;
        <span style="color:#4fc4a0">▲</span> wealth grew &nbsp;
        <span style="color:#e85050">▼</span> declined &nbsp;
        <span style="color:#5a5e72">→</span> stable
      </div>`;
  }

  if (chartEl) {
    resizeCanvas(chartEl);
    drawLineChart(chartEl, [
      { values: family.members.map(m => m.peakWealth || m.wealth), color: '#f0c040', width: 1.5 },
      { values: family.members.map(m => m.initialWealth || m.wealth), color: '#4fc4a0', width: 1 },
    ], { minY: 0, yDecimals: 0, xLabel: 'generations (oldest → newest)', leftPad: 38 });
  }

  const ACCENT = '#7799bb';
  if (personsEl) {
    personsEl.innerHTML = [...family.members].reverse().map(ag => {
      const col   = ag.alive ? '#8fb8d8' : '#5a6e82';
      const sel   = ag.id === selectedHistoryAgentId ? ' gpc--selected' : '';
      const dead  = !ag.alive ? ' gpc--dead' : '';
      const wr    = ag.tradesWon + ag.tradesLost > 0
        ? ((ag.tradesWon / (ag.tradesWon + ag.tradesLost)) * 100).toFixed(0) + '%' : '—';
      const status = ag.alive
        ? `<span class="status-alive">alive</span>`
        : `<span class="status-dead">✝ ${escHtml(ag.deathDateStr || '?')}</span>`;
      return `<div class="gen-person-card${sel}${dead}" data-agentid="${ag.id}">
        <div class="gpc-top">
          <span class="gpc-gen" style="color:${col}">G${ag.generation}</span>
          <span class="gpc-name" style="color:${col}">${escHtml(ag.name)} ${escHtml(ag.surname)}</span>
          ${status}
        </div>
        <div class="gpc-dates">${escHtml(ag.birthDateStr || '?')}${ag.location ? ' · ' + escHtml(ag.location.city) : ''}</div>
        <div class="gpc-wealth">${fmtW(ag.peakWealth || ag.wealth)} peak · ${fmtW(ag.wealth)} ${ag.alive ? 'now' : 'final'}</div>
        <div class="gpc-stats">${ag.tradesWon}W ${ag.tradesLost}L (${wr}) · ${ag.bankruptcies} bankrupt</div>
      </div>`;
    }).join('');
  }
}

function renderHistoryPersonDetail() {
  const el      = document.getElementById('history-person-detail');
  const emptyEl = document.getElementById('history-person-empty');
  const chartEl = document.getElementById('historyPersonChart');

  if (selectedHistoryAgentId === null) {
    if (el)      el.style.display      = 'none';
    if (emptyEl) emptyEl.style.display = '';
    if (chartEl) chartEl.style.display = 'none';
    return;
  }

  const ag = allAgentsMap.get(selectedHistoryAgentId);
  if (!ag) return;

  if (emptyEl) emptyEl.style.display = 'none';
  if (el)      el.style.display      = '';

  const col  = ag.alive ? '#8fb8d8' : '#5a6e82';
  const wr   = ag.tradesWon + ag.tradesLost > 0
    ? ((ag.tradesWon / (ag.tradesWon + ag.tradesLost)) * 100).toFixed(1) + '%' : '—';
  const pctChange = ag.initialWealth > 0
    ? ((ag.wealth - ag.initialWealth) / ag.initialWealth * 100).toFixed(0) : null;
  const chgColor = pctChange === null ? '#5a5e72' : +pctChange > 0 ? '#4fc4a0' : +pctChange < 0 ? '#e85050' : '#5a5e72';

  el.innerHTML = `
    <div class="hpd-name" style="color:${col}">${escHtml(ag.name)} ${escHtml(ag.surname)}</div>
    <div class="hpd-sub">
      ${ag.alive ? '<span class="status-alive">● Alive</span>' : '<span class="status-dead">✝ Deceased</span>'}
      · Generation ${ag.generation}
      ${ag.location ? '· ' + escHtml(ag.location.city) : ''}
    </div>
    ${ag.parentName ? `<div class="hpd-parent hint">Child of ${escHtml(ag.parentName)} ${escHtml(ag.surname)}</div>` : ''}
    <div class="hpd-stats">
      <div class="hpd-row"><span class="hpd-label">Born</span><span class="hpd-value">${escHtml(ag.birthDateStr || '—')}</span></div>
      <div class="hpd-row"><span class="hpd-label">Location</span><span class="hpd-value">${ag.location ? escHtml(ag.location.city) + ' · ' + escHtml(ag.location.region) : '—'}</span></div>
      <div class="hpd-row"><span class="hpd-label">Died</span><span class="hpd-value">${ag.alive ? '—' : escHtml(ag.deathDateStr || '?')}</span></div>
      <div class="hpd-row"><span class="hpd-label">Age</span><span class="hpd-value">${ag.ageYears.toFixed(1)}y / ${ag.lifespan}y</span></div>
      <div class="hpd-row"><span class="hpd-label">Cause of death</span><span class="hpd-value">${ag.alive ? '—' : escHtml(ag.deathCause || '?')}</span></div>
      <div class="hpd-row"><span class="hpd-label">Starting wealth</span><span class="hpd-value">${fmtW(ag.initialWealth)}</span></div>
      <div class="hpd-row"><span class="hpd-label">Peak wealth</span><span class="hpd-value">${fmtW(ag.peakWealth || ag.wealth)}</span></div>
      <div class="hpd-row"><span class="hpd-label">${ag.alive ? 'Current' : 'Final'} wealth</span><span class="hpd-value">${fmtW(ag.wealth)}</span></div>
      <div class="hpd-row"><span class="hpd-label">vs starting</span><span class="hpd-value" style="color:${chgColor}">${pctChange !== null ? (pctChange > 0 ? '+' : '') + pctChange + '%' : '—'}</span></div>
      <div class="hpd-row"><span class="hpd-label">Trades won</span><span class="hpd-value">${ag.tradesWon}</span></div>
      <div class="hpd-row"><span class="hpd-label">Trades lost</span><span class="hpd-value">${ag.tradesLost}</span></div>
      <div class="hpd-row"><span class="hpd-label">Win rate</span><span class="hpd-value">${wr}</span></div>
      <div class="hpd-row"><span class="hpd-label">Bankruptcies</span><span class="hpd-value">${ag.bankruptcies}</span></div>
    </div>`;

  if (chartEl && ag.history && ag.history.length > 1) {
    chartEl.style.display = 'block';
    resizeCanvas(chartEl);
    drawMiniHistory(chartEl, ag.history, col);
  } else if (chartEl) {
    chartEl.style.display = 'none';
  }
}

function renderHistoryTab() {
  renderFamilyList();
  renderGenealogy();
  renderHistoryPersonDetail();
}

// ── TAB SWITCH ──
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  if (name === 'history') { initHistoryEvents(); renderHistoryTab(); }
  if (name === 'geo')     renderGeographyTab();
  if (name === 'detail')  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  setTimeout(() => window._redraw && window._redraw(), 10);
}
// ══════════════════════════════════════════════
// GEOGRAPHY TAB
// ══════════════════════════════════════════════

let geoView = 'tiles'; // 'tiles' | 'ranked'

function setGeoView(v) {
  geoView = v;
  document.getElementById('btn-geo-tiles')?.classList.toggle('active', v === 'tiles');
  document.getElementById('btn-geo-ranked')?.classList.toggle('active', v === 'ranked');
  renderGeographyTab();
}

function renderGeographyTab() {
  const alive = agents.filter(a => a.alive && a.location);
  if (!alive.length) return;

  const globalTotal = alive.reduce((s, a) => s + a.wealth, 0);
  const globalAvg   = globalTotal / alive.length;

  // Aggregate by city then region
  const cityMap = new Map();
  for (const ag of alive) {
    const ck = ag.location.city;
    if (!cityMap.has(ck)) cityMap.set(ck, { city: ck, region: ag.location.region, agents: [] });
    cityMap.get(ck).agents.push(ag);
  }
  const cities = [...cityMap.values()].map(c => {
    const ws  = c.agents.map(a => a.wealth);
    const tot = ws.reduce((s, v) => s + v, 0);
    return { city: c.city, region: c.region, count: c.agents.length, avg: tot / ws.length, total: tot };
  }).sort((a, b) => b.avg - a.avg);

  // Aggregate by region
  const regionMap = new Map();
  for (const c of cities) {
    if (!regionMap.has(c.region)) regionMap.set(c.region, { region: c.region, cities: [], total: 0, count: 0 });
    const r = regionMap.get(c.region);
    r.cities.push(c); r.total += c.total; r.count += c.count;
  }
  const regions = [...regionMap.values()].map(r => ({ ...r, avg: r.total / r.count }))
    .sort((a, b) => b.avg - a.avg);

  const fmtW2 = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0);
  const regionColors = { 'Europe': '#5588cc', 'Americas': '#44aa88', 'Asia': '#dd8844', 'Africa': '#bb5566' };

  // ── TILES VIEW (canvas heatmap) ──
  const gc = document.getElementById('geoCanvas');
  const tilesSection = document.getElementById('geo-canvas-section');
  const rankedSection = document.getElementById('geo-ranked-section');

  if (geoView === 'tiles') {
    if (tilesSection) tilesSection.style.display = '';
    if (rankedSection) rankedSection.style.display = 'none';
    if (gc) { resizeCanvas(gc); drawGeography(gc, agents); }
  } else {
    if (tilesSection) tilesSection.style.display = 'none';
    if (rankedSection) rankedSection.style.display = '';
    renderGeoRanked(cities, regions, globalAvg, globalTotal, fmtW2, regionColors);
  }

  // ── RIGHT SIDEBAR: region breakdown (always visible) ──
  const el = document.getElementById('geo-region-list');
  if (!el) return;
  const maxAvg = Math.max(...cities.map(c => c.avg), 1);

  el.innerHTML = regions.map(r => {
    const rc = regionColors[r.region] || '#5a6080';
    const rShare = globalTotal > 0 ? ((r.total / globalTotal) * 100).toFixed(1) : '0';
    const cityRows = r.cities.map(c => {
      const barW  = Math.round((c.avg / maxAvg) * 100);
      const ratio = c.avg / Math.max(globalAvg, 1);
      const valCol = ratio > 1.3 ? '#f0c040' : ratio < 0.7 ? '#5a8aaa' : '#8899aa';
      return `<div class="geo-city-row">
        <div class="geo-city-name">${escHtml(c.city)}</div>
        <div class="geo-city-bar"><div class="geo-city-fill" style="width:${barW}%;background:${valCol}"></div></div>
        <div class="geo-city-val">${fmtW2(c.avg)} · ${c.count}</div>
      </div>`;
    }).join('');
    return `<div class="geo-region-section">
      <div class="geo-region-header" style="border-left-color:${rc}">
        <span class="geo-region-name">${escHtml(r.region)}</span>
        <span class="geo-region-meta">${r.count} agents · avg ${fmtW2(r.avg)} · ${rShare}% wealth</span>
      </div>
      ${cityRows}
    </div>`;
  }).join('');
}

function renderGeoRanked(cities, regions, globalAvg, globalTotal, fmtW2, regionColors) {
  const el = document.getElementById('geo-ranked-section');
  if (!el) return;
  const maxAvg = Math.max(...cities.map(c => c.avg), 1);

  const rows = cities.map((c, i) => {
    const rc    = regionColors[c.region] || '#5a6080';
    const ratio = c.avg / Math.max(globalAvg, 1);
    const barW  = Math.round((c.avg / maxAvg) * 100);
    const valCol = ratio > 1.5 ? '#e85050' : ratio > 1.15 ? '#f0c040' : ratio < 0.7 ? '#5a8aaa' : '#7799aa';
    const share  = globalTotal > 0 ? ((c.total / globalTotal) * 100).toFixed(1) : '0';
    const aboveBelow = ratio >= 1.0
      ? `<span style="color:#4fc4a0">+${((ratio - 1) * 100).toFixed(0)}%</span>`
      : `<span style="color:#e85050">${((ratio - 1) * 100).toFixed(0)}%</span>`;
    return `<div class="geo-ranked-row">
      <div class="geo-ranked-num">${i + 1}</div>
      <div class="geo-ranked-city">
        <span class="geo-ranked-name">${escHtml(c.city)}</span>
        <span class="geo-ranked-region" style="color:${rc}">${escHtml(c.region)}</span>
      </div>
      <div class="geo-ranked-bar-wrap">
        <div class="geo-ranked-bar" style="width:${barW}%;background:${valCol}"></div>
        <div class="geo-ranked-refline"></div>
      </div>
      <div class="geo-ranked-stats">
        <span class="geo-ranked-avg" style="color:${valCol}">${fmtW2(c.avg)}</span>
        <span class="geo-ranked-meta">${aboveBelow} avg · ${share}% wealth · ${c.count} agents</span>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="geo-ranked-header">
    <span>City</span><span>Avg wealth vs global avg →</span><span>Stats</span>
  </div>${rows}`;
}
// ══════════════════════════════════════════════
// AGENT DETAIL PAGE (invisible tab panel-detail)
// ══════════════════════════════════════════════

let _detailBuiltForId = null; // track which agent the structure was built for
window._resetDetailBuild = () => { _detailBuiltForId = null; };

function renderAgentDetail(agent, agents, tradeLog, roundsPerYear) {
  const panel = document.getElementById('panel-detail');
  if (!panel) return;

  const col = agent.alive ? '#8fb8d8' : '#5a6e82';

  // ── Build structure only when agent changes ──
  if (_detailBuiltForId !== agent.id) {
    _detailBuiltForId = agent.id;
    panel.innerHTML = `<div class="detail-page">
      <div class="detail-page-header">
        <button class="detail-back-btn" id="detail-back-btn">← Back</button>
        <div>
          <div class="detail-page-title" id="dp-title" style="color:${col}">${escHtml(agent.name)} ${escHtml(agent.surname)}</div>
          <div class="detail-page-sub" id="dp-sub"></div>
        </div>
      </div>
      <div class="detail-page-body">
        <div class="detail-col-left">
          <div class="canvas-label" style="margin-bottom:4px">wealth history</div>
          <canvas id="detailChart" style="width:100%;height:88px;border-radius:3px;display:block"></canvas>
          <div class="detail-stat-section">
            <div class="detail-stat-title">Wealth</div>
            <div id="dp-wealth-rows"></div>
          </div>
          <div class="detail-stat-section">
            <div class="detail-stat-title">Life</div>
            <div id="dp-life-rows"></div>
          </div>
          <div class="detail-stat-section">
            <div class="detail-stat-title">Trading</div>
            <div id="dp-trade-rows"></div>
          </div>
        </div>
        <div class="detail-col-right">
          <div class="canvas-label" id="dp-log-label" style="margin-bottom:6px"></div>
          <div class="detail-tradelog-wrap">
            <table class="log-table">
              <thead><tr><th>Round</th><th>Scope</th><th>Result</th><th>Opponent</th><th>Stake</th><th>After</th></tr></thead>
              <tbody id="dp-log-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

    // Back button — use addEventListener so it survives innerHTML build
    document.getElementById('detail-back-btn').addEventListener('pointerdown', () => closeInspector());

    // Draw chart once (it won't change shape, just extend)
    setTimeout(() => {
      const chartEl = document.getElementById('detailChart');
      if (chartEl && agent.history?.length > 1) { resizeCanvas(chartEl); drawMiniHistory(chartEl, agent.history, col); }
    }, 0);
  }

  // ── Update dynamic values every frame ──
  const alive    = agents.filter(a => a.alive);
  const total    = alive.reduce((s, a) => s + a.wealth, 0);
  const byWealth = [...alive].sort((a, b) => b.wealth - a.wealth);
  const rank     = agent.alive ? byWealth.findIndex(a => a.id === agent.id) + 1 : null;
  const wr       = agent.tradesWon + agent.tradesLost > 0
    ? ((agent.tradesWon / (agent.tradesWon + agent.tradesLost)) * 100).toFixed(1) + '%' : '—';
  const lifePct   = Math.min(100, agent.ageYears / agent.lifespan * 100);
  const pctChange = agent.initialWealth > 0
    ? ((agent.wealth - agent.initialWealth) / agent.initialWealth * 100).toFixed(0) : null;
  const chgColor  = pctChange === null ? '#5a5e72' : +pctChange > 0 ? '#4fc4a0' : +pctChange < 0 ? '#e85050' : '#5a5e72';

  const sub = document.getElementById('dp-sub');
  if (sub) sub.innerHTML = `${agent.alive ? '<span class="status-alive">● Alive</span>' : '<span class="status-dead">✝ Deceased</span>'}
    · Gen ${agent.generation}
    ${agent.location ? '· ' + escHtml(agent.location.city) + ', ' + escHtml(agent.location.region) : ''}
    ${rank ? '· Rank #' + rank + ' of ' + alive.length : ''}`;

  const wRows = document.getElementById('dp-wealth-rows');
  if (wRows) wRows.innerHTML =
    `<div class="hpd-row"><span class="hpd-label">${agent.alive?'Current':'Final'}</span><span class="hpd-value">${fmtW(agent.wealth)}</span></div>
     <div class="hpd-row"><span class="hpd-label">Peak</span><span class="hpd-value">${fmtW(agent.peakWealth||agent.wealth)}</span></div>
     <div class="hpd-row"><span class="hpd-label">Starting</span><span class="hpd-value">${fmtW(agent.initialWealth)}</span></div>
     <div class="hpd-row"><span class="hpd-label">vs starting</span><span class="hpd-value" style="color:${chgColor}">${pctChange!==null?(+pctChange>0?'+':'')+pctChange+'%':'—'}</span></div>
     ${agent.alive?`<div class="hpd-row"><span class="hpd-label">Share of total</span><span class="hpd-value">${total>0?((agent.wealth/total)*100).toFixed(2):'—'}%</span></div>`:''}
     ${rank?`<div class="hpd-row"><span class="hpd-label">Wealth rank</span><span class="hpd-value">#${rank} of ${alive.length}</span></div>`:''}`;

  const lRows = document.getElementById('dp-life-rows');
  if (lRows) lRows.innerHTML =
    `<div class="hpd-row"><span class="hpd-label">Born</span><span class="hpd-value">${escHtml(agent.birthDateStr||'—')}</span></div>
     <div class="hpd-row"><span class="hpd-label">Age</span><span class="hpd-value">${agent.ageYears.toFixed(1)}y / ${agent.lifespan}y (${lifePct.toFixed(0)}%)</span></div>
     ${!agent.alive?`<div class="hpd-row"><span class="hpd-label">Died</span><span class="hpd-value">${escHtml(agent.deathDateStr||'?')}</span></div>`:''}
     ${!agent.alive?`<div class="hpd-row"><span class="hpd-label">Cause</span><span class="hpd-value">${escHtml(agent.deathCause||'?')}</span></div>`:''}
     <div class="hpd-row"><span class="hpd-label">Location</span><span class="hpd-value">${agent.location?escHtml(agent.location.city)+' · '+escHtml(agent.location.region):'—'}</span></div>
     <div class="hpd-row"><span class="hpd-label">Family</span><span class="hpd-value">${escHtml(agent.surname)}</span></div>
     ${agent.parentName?`<div class="hpd-row"><span class="hpd-label">Parent</span><span class="hpd-value">${escHtml(agent.parentName)} ${escHtml(agent.surname)}</span></div>`:''}`;

  const tRows = document.getElementById('dp-trade-rows');
  if (tRows) tRows.innerHTML =
    `<div class="hpd-row"><span class="hpd-label">Won</span><span class="hpd-value" style="color:#4fc4a0">${agent.tradesWon}</span></div>
     <div class="hpd-row"><span class="hpd-label">Lost</span><span class="hpd-value" style="color:#e85050">${agent.tradesLost}</span></div>
     <div class="hpd-row"><span class="hpd-label">Win rate</span><span class="hpd-value">${wr}</span></div>
     <div class="hpd-row"><span class="hpd-label">Total</span><span class="hpd-value">${agent.tradesWon+agent.tradesLost}</span></div>
     <div class="hpd-row"><span class="hpd-label">Bankruptcies</span><span class="hpd-value" style="color:${agent.bankruptcies>0?'#e85050':'inherit'}">${agent.bankruptcies}</span></div>`;

  // ── Trade log — uses per-agent tradeHistory for completeness ──
  const agTrades   = agent.tradeHistory || [];
  const scopeColor = { local: '#4fc4a0', regional: '#f0c040', global: '#e85050' };
  const lbl = document.getElementById('dp-log-label');
  if (lbl) lbl.textContent = `personal trade log · ${agTrades.length} trades recorded`;

  const tbody = document.getElementById('dp-log-body');
  if (tbody) {
    tbody.innerHTML = agTrades.length === 0
      ? `<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:14px">No trades yet</td></tr>`
      : agTrades.map(e => {
          const isA   = e.aId === agent.id;
          const won   = e.winner === agent.id;
          const oName = isA
            ? `${escHtml(e.bName??'')} ${escHtml(e.bSurname??'')}`.trim()
            : `${escHtml(e.aName??'')} ${escHtml(e.aSurname??'')}`.trim();
          const oCity = escHtml(isA ? (e.bCity??'—') : (e.aCity??'—'));
          const after = isA ? e.aAfter : e.bAfter;
          const sc    = scopeColor[e.scope||'local'] || '#5a6080';
          return `<tr>
            <td class="log-round">${e.round}</td>
            <td><span class="log-scope" style="color:${sc};border-color:${sc}">${e.scope||'local'}</span></td>
            <td style="color:${won?'#4fc4a0':'#e85050'}">${won?'▲ Won':'▼ Lost'}</td>
            <td>${oName}<span class="log-city"> ${oCity}</span></td>
            <td class="log-stake">${e.stake}</td>
            <td class="log-after">${after}</td>
          </tr>`;
        }).join('');
  }

  // Redraw wealth chart on each update
  const chartEl = document.getElementById('detailChart');
  if (chartEl && agent.history?.length > 1) {
    resizeCanvas(chartEl);
    drawMiniHistory(chartEl, agent.history, col);
  }
}