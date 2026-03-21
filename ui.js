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
    const sel = ag.id === inspectedId ? ' class="selected"' : '';
    return `<tr${sel} data-agentid="${ag.id}" style="cursor:pointer">
      <td>${rank + 1}</td>
      <td>${ag.name} ${ag.surname}</td>
      <td class="tier-${ag.tier.name}">${ag.tier.name}</td>
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
  const tierColors = { elite: '#e85050', skilled: '#f0c040', lower: '#4fc4a0', normal: '#8899aa' };
  document.getElementById('agents-card-wrap').innerHTML = sorted.map((ag, rank) => {
    const lifePct  = Math.min(100, ag.ageYears / ag.lifespan * 100);
    const ageColor = lifePct > 85 ? '#e85050' : lifePct > 60 ? '#f0c040' : '#4fc4a0';
    const col  = tierColors[ag.tier.name] || '#8899aa';
    const pct  = total > 0 ? ((ag.wealth / total) * 100).toFixed(1) : '0';
    const wr   = ag.tradesWon + ag.tradesLost > 0
      ? ((ag.tradesWon / (ag.tradesWon + ag.tradesLost)) * 100).toFixed(0) + '%' : '—';
    const sel  = ag.id === inspectedId ? ' agent-card--selected' : '';
    const dying = lifePct > 85 ? ' agent-card--dying' : '';
    return `<div class="agent-card${sel}${dying}" data-agentid="${ag.id}">
      <div class="ac-rank">#${rank + 1}</div>
      <div class="ac-name" style="color:${col}">${ag.name}</div>
      <div class="ac-surname" style="color:${col};opacity:.7">${ag.surname}</div>
      <div class="ac-wealth">${ag.wealth >= 1000 ? (ag.wealth/1000).toFixed(1)+'k' : ag.wealth.toFixed(0)}</div>
      <div class="ac-share">${pct}% · ${ag.tier.name}</div>
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
  const alive   = agents.filter(a => a.alive);
  const total   = alive.reduce((s, a) => s + a.wealth, 0);
  const rank    = sortAgents(alive).findIndex(a => a.id === agent.id) + 1;
  const wr      = agent.tradesWon + agent.tradesLost > 0
    ? ((agent.tradesWon / (agent.tradesWon + agent.tradesLost)) * 100).toFixed(1) + '%' : '—';
  const lifePct = Math.min(100, agent.ageYears / agent.lifespan * 100);
  const tierColors = { elite: '#e85050', skilled: '#f0c040', lower: '#4fc4a0', normal: '#8899aa' };
  const col = tierColors[agent.tier.name] || '#8899aa';
  const html = `<strong>Name</strong> ${agent.name} ${agent.surname}<br>
<strong>Tier</strong> ${agent.tier.name}<br>
<strong>Wealth</strong> ${agent.wealth.toFixed(2)}<br>
<strong>Peak</strong> ${fmtW(agent.peakWealth || agent.wealth)}<br>
<strong>Rank</strong> #${rank > 0 ? rank : '—'} of ${alive.length}<br>
<strong>Share</strong> ${total > 0 && agent.alive ? ((agent.wealth / total) * 100).toFixed(2) : '—'}%<br>
<strong>Age</strong> ${agent.ageYears.toFixed(1)}y / ${agent.lifespan}y (${lifePct.toFixed(0)}%)<br>
<strong>Generation</strong> ${agent.generation}${agent.parentName ? ` (child of ${agent.parentName})` : ''}<br>
<strong>Win rate</strong> ${wr} (${agent.tradesWon}W / ${agent.tradesLost}L)<br>
<strong>Bankruptcies</strong> ${agent.bankruptcies}`;

  const titleEl = document.getElementById('inspector-title');
  if (titleEl) titleEl.textContent = `${agent.name} ${agent.surname} · #${agent.id}`;
  const sf = document.getElementById('inspectorStatsFloat');
  if (sf) sf.innerHTML = html;
  const cf = document.getElementById('inspectorChartFloat');
  if (cf) drawMiniHistory(cf, agent.history, col);
  const ph = document.getElementById('detail-placeholder');
  if (ph) ph.style.display = 'none';
  const ci = document.getElementById('inspectorChart');
  if (ci) { ci.style.display = 'block'; drawMiniHistory(ci, agent.history, col); }
  const si = document.getElementById('inspectorStats');
  if (si) { si.style.display = 'block'; si.innerHTML = html; }
}

// ── LOG ──
function renderLog(tradeLog) {
  const filter   = document.getElementById('log-filter')?.value.trim() || '';
  const filtered = filter
    ? tradeLog.filter(e => e.aId === +filter || e.bId === +filter ||
        e.aName?.toLowerCase().includes(filter.toLowerCase()) ||
        e.bName?.toLowerCase().includes(filter.toLowerCase()))
    : tradeLog;
  const el = document.getElementById('log-count');
  if (el) el.textContent = `${filtered.length} entries`;
  document.getElementById('logBody').innerHTML = filtered.map(e => {
    const aWon = e.winner === e.aId;
    return `<tr>
      <td>${e.round}</td>
      <td class="${aWon?'win-a':''}">${e.aName??'#'+e.aId}</td>
      <td class="${!aWon?'win-a':''}">${e.bName??'#'+e.bId}</td>
      <td>${e.stake}</td><td>${e.winnerName??'#'+e.winner}</td>
      <td>${e.aAfter}</td><td>${e.bAfter}</td>
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

  const tierColors = { elite: '#e85050', skilled: '#f0c040', lower: '#4fc4a0', normal: '#8899aa' };
  if (personsEl) {
    personsEl.innerHTML = [...family.members].reverse().map(ag => {
      const col   = tierColors[ag.tier.name] || '#8899aa';
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
        <div class="gpc-dates">${escHtml(ag.birthDateStr || '?')}</div>
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

  const tierColors = { elite: '#e85050', skilled: '#f0c040', lower: '#4fc4a0', normal: '#8899aa' };
  const col  = tierColors[ag.tier.name] || '#8899aa';
  const wr   = ag.tradesWon + ag.tradesLost > 0
    ? ((ag.tradesWon / (ag.tradesWon + ag.tradesLost)) * 100).toFixed(1) + '%' : '—';
  const pctChange = ag.initialWealth > 0
    ? ((ag.wealth - ag.initialWealth) / ag.initialWealth * 100).toFixed(0) : null;
  const chgColor = pctChange === null ? '#5a5e72' : +pctChange > 0 ? '#4fc4a0' : +pctChange < 0 ? '#e85050' : '#5a5e72';

  el.innerHTML = `
    <div class="hpd-name" style="color:${col}">${escHtml(ag.name)} ${escHtml(ag.surname)}</div>
    <div class="hpd-sub">
      <span class="tier-badge tier-${ag.tier.name}">${ag.tier.name}</span>
      ${ag.alive ? '<span class="status-alive">● Alive</span>' : '<span class="status-dead">✝ Deceased</span>'}
      · Generation ${ag.generation}
    </div>
    ${ag.parentName ? `<div class="hpd-parent hint">Child of ${escHtml(ag.parentName)} ${escHtml(ag.surname)}</div>` : ''}
    <div class="hpd-stats">
      <div class="hpd-row"><span class="hpd-label">Born</span><span class="hpd-value">${escHtml(ag.birthDateStr || '—')}</span></div>
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
  if (name === 'history') {
    initHistoryEvents();
    renderHistoryTab();
  }
  setTimeout(() => window._redraw && window._redraw(), 10);
}