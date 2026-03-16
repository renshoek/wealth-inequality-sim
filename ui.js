'use strict';
// ─────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────

let uiThrottle = 0;
let agentsView = 'cards';
let agentsSort = 'wealth'; // 'wealth'|'name'|'age'|'winrate'|'generation'|'bankruptcies'

// ── HEADER ──
function updateHeader(agents, round, roundsPerYear, totalDeaths, totalBankruptcies) {
  const now = Date.now();
  if (now - uiThrottle < 80) return;
  uiThrottle = now;

  const alive  = agents.filter(a => a.alive);
  const vals   = alive.map(a => a.wealth);
  const g      = gini(vals);
  const total  = vals.reduce((s, v) => s + v, 0);
  const sorted = [...vals].sort((a, b) => b - a);
  const top10  = sorted.slice(0, Math.ceil(alive.length * 0.1)).reduce((s, v) => s + v, 0);
  const bankruptTotal = totalBankruptcies ?? agents.reduce((s, a) => s + a.bankruptcies, 0);
  const simYears = (round / roundsPerYear).toFixed(1);

  document.getElementById('val-gini').textContent     = g.toFixed(2);
  document.getElementById('val-round').textContent    = `Y${simYears}`;
  document.getElementById('val-top10').textContent    = total > 0 ? ((top10 / total) * 100).toFixed(0) + '%' : '—';
  document.getElementById('val-bankrupt').textContent  = bankruptTotal;
  document.getElementById('val-deaths').textContent    = totalDeaths;

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

function setAgentsSort(s) {
  agentsSort = s;
}

function sortAgents(alive) {
  const s = [...alive];
  switch (agentsSort) {
    case 'name':        return s.sort((a, b) => a.name.localeCompare(b.name));
    case 'age':         return s.sort((a, b) => b.ageYears - a.ageYears);
    case 'winrate':     return s.sort((a, b) => {
      const wa = a.tradesWon + a.tradesLost > 0 ? a.tradesWon / (a.tradesWon + a.tradesLost) : 0;
      const wb = b.tradesWon + b.tradesLost > 0 ? b.tradesWon / (b.tradesWon + b.tradesLost) : 0;
      return wb - wa;
    });
    case 'generation':  return s.sort((a, b) => b.generation - a.generation);
    case 'bankruptcies':return s.sort((a, b) => b.bankruptcies - a.bankruptcies);
    case 'wealth':
    default:            return s.sort((a, b) => b.wealth - a.wealth);
  }
}

// ── RENDER ──
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
    const ageY = ag.ageYears.toFixed(1);
    const lifePct = Math.min(100, ag.ageYears / ag.lifespan * 100);
    const ageColor = lifePct > 85 ? '#e85050' : lifePct > 60 ? '#f0c040' : '#4fc4a0';
    const sel = ag.id === inspectedId ? ' class="selected"' : '';

    return `<tr${sel} onclick="window._selectAgent(${ag.id})">
      <td>${rank + 1}</td>
      <td>${ag.name}</td>
      <td class="tier-${ag.tier.name}">${ag.tier.name}</td>
      <td>${ag.wealth.toFixed(1)}</td>
      <td>${pct}</td>
      <td><span class="age-bar-wrap"><span class="age-bar" style="width:${lifePct.toFixed(0)}%;background:${ageColor}"></span><span class="age-text">${ageY}y</span></span></td>
      <td>${ag.lifespan}y</td>
      <td>${ag.tradesWon}</td>
      <td>${ag.tradesLost}</td>
      <td>${wr}</td>
      <td>${ag.bankruptcies}</td>
      <td>${ag.generation}</td>
    </tr>`;
  }).join('');
}

function renderAgentsCards(agents, roundsPerYear, inspectedId) {
  const alive  = agents.filter(a => a.alive);
  const total  = alive.reduce((s, a) => s + a.wealth, 0);
  const sorted = sortAgents(alive);
  const tierColors = { elite: '#e85050', skilled: '#f0c040', poor: '#4fc4a0', normal: '#8899aa' };

  document.getElementById('agents-card-wrap').innerHTML = sorted.map((ag, rank) => {
    const lifePct  = Math.min(100, ag.ageYears / ag.lifespan * 100);
    const ageColor = lifePct > 85 ? '#e85050' : lifePct > 60 ? '#f0c040' : '#4fc4a0';
    const col      = tierColors[ag.tier.name] || '#8899aa';
    const pct      = total > 0 ? ((ag.wealth / total) * 100).toFixed(1) : '0';
    const wr       = ag.tradesWon + ag.tradesLost > 0
      ? ((ag.tradesWon / (ag.tradesWon + ag.tradesLost)) * 100).toFixed(0) + '%' : '—';
    const sel   = ag.id === inspectedId ? ' agent-card--selected' : '';
    const dying = lifePct > 85 ? ' agent-card--dying' : '';

    return `<div class="agent-card${sel}${dying}" onclick="window._selectAgent(${ag.id})" title="Agent: ${ag.name}">
      <div class="ac-rank">#${rank + 1}</div>
      <div class="ac-name" style="color:${col}">${ag.name}</div>
      <div class="ac-wealth">${ag.wealth >= 1000 ? (ag.wealth/1000).toFixed(1)+'k' : ag.wealth.toFixed(0)}</div>
      <div class="ac-share">${pct}% · ${ag.tier.name}</div>
      <div class="ac-age-bar" title="${ag.ageYears.toFixed(1)}y / ${ag.lifespan}y">
        <div class="ac-age-fill" style="width:${lifePct.toFixed(0)}%;background:${ageColor}"></div>
      </div>
      <div class="ac-meta">${ag.ageYears.toFixed(0)}y · G${ag.generation} · ${wr}</div>
    </div>`;
  }).join('');
}

// ── INSPECTOR — always works regardless of play state ──
function renderInspector(agent, agents, roundsPerYear) {
  if (!agent) return;
  const alive   = agents.filter(a => a.alive);
  const total   = alive.reduce((s, a) => s + a.wealth, 0);
  const rank    = sortAgents(alive).findIndex(a => a.id === agent.id) + 1;
  const wr      = agent.tradesWon + agent.tradesLost > 0
    ? ((agent.tradesWon / (agent.tradesWon + agent.tradesLost)) * 100).toFixed(1) + '%' : '—';
  const lifePct = Math.min(100, agent.ageYears / agent.lifespan * 100);
  const tierColors = { elite: '#e85050', skilled: '#f0c040', poor: '#4fc4a0', normal: '#8899aa' };
  const col = tierColors[agent.tier.name] || '#8899aa';

  const html = `<strong>Name</strong> ${agent.name}<br>
<strong>Tier</strong> ${agent.tier.name}<br>
<strong>Wealth</strong> ${agent.wealth.toFixed(2)}<br>
<strong>Rank</strong> #${rank} of ${alive.length}<br>
<strong>Share</strong> ${total > 0 ? ((agent.wealth / total) * 100).toFixed(2) : 0}%<br>
<strong>Age</strong> ${agent.ageYears.toFixed(1)}y / ${agent.lifespan}y (${lifePct.toFixed(0)}%)<br>
<strong>Generation</strong> ${agent.generation}${agent.parentName ? ` (child of ${agent.parentName})` : ''}<br>
<strong>Win rate</strong> ${wr} (${agent.tradesWon}W / ${agent.tradesLost}L)<br>
<strong>Bankruptcies</strong> ${agent.bankruptcies}`;

  const titleEl = document.getElementById('inspector-title');
  if (titleEl) titleEl.textContent = `${agent.name} · #${agent.id}`;
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
      <td>${e.stake}</td>
      <td>${e.winnerName??'#'+e.winner}</td>
      <td>${e.aAfter}</td>
      <td>${e.bAfter}</td>
    </tr>`;
  }).join('');
}

// ── TAB SWITCH ──
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  setTimeout(() => window._redraw && window._redraw(), 10);
}