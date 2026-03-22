'use strict';
// ─────────────────────────────────────────────────
// ENGINE — one simulation step
// ─────────────────────────────────────────────────

// Used only for flat and income-bracket modes
function calcTax(amount, taxMode, flatRate, brackets) {
  if (taxMode === 'none') return 0;
  if (taxMode === 'wealth-flat' || taxMode === 'income-flat')
    return amount * (flatRate / 100);
  // income-bracket: fixed gain thresholds (0-50, 50-200, 200-500, >500)
  const thresholds = [
    { from: 0,   to: 50,   rate: brackets[0] / 100 },
    { from: 50,  to: 200,  rate: brackets[1] / 100 },
    { from: 200, to: 500,  rate: brackets[2] / 100 },
    { from: 500, to: 1e9,  rate: brackets[3] / 100 },
  ];
  let tax = 0;
  for (const b of thresholds) {
    if (amount <= b.from) break;
    tax += (Math.min(amount, b.to) - b.from) * b.rate;
  }
  return tax;
}

function runStep(agents, params, tradeLogBuf, recessionState, taxPool) {
  const {
    trades, maxbet, taxMode, flatTax, brackets,
    redist, luck, baseWealth,
    redistWeights,
    bankruptcyPayout,
    moneyPrint,
    round, roundsPerYear,
    yearChanged,
    redistPending,
  } = params;

  const alive = agents.filter(a => a.alive);
  const n = alive.length;
  if (!n) return { bankruptciesThisStep: 0 };

  // ── 0. Money printing — every 10 rounds ──
  if (moneyPrint > 0 && round > 0 && round % 10 === 0) {
    taxPool.amount += moneyPrint;
  }

  // ── 1. Annual luck — fires on year rollover ──
  if (luck > 0 && yearChanged) {
    const lf = luck / 100;
    for (const ag of alive)
      ag.wealth = Math.max(0, ag.wealth + (Math.random() * 2 - 1) * ag.wealth * lf);
  }

  // ── 2. Annual wealth tax — fires on year rollover ──
  if (yearChanged && (taxMode === 'wealth-flat' || taxMode === 'wealth-bracket')) {
    if (taxMode === 'wealth-flat') {
      for (const ag of alive) {
        const tax = ag.wealth * (flatTax / 100);
        ag.wealth = Math.max(0, ag.wealth - tax);
        taxPool.amount += tax;
      }
    } else {
      const sorted = [...alive].map(a => a.wealth).sort((a, b) => a - b);
      const len    = sorted.length;
      const q25    = sorted[Math.max(0, Math.ceil(len * 0.25) - 1)] ?? 0;
      const q50    = sorted[Math.max(0, Math.ceil(len * 0.50) - 1)] ?? 0;
      const q75    = sorted[Math.max(0, Math.ceil(len * 0.75) - 1)] ?? 0;
      for (const ag of alive) {
        let rate;
        if      (ag.wealth <= q25) rate = brackets[0] / 100;
        else if (ag.wealth <= q50) rate = brackets[1] / 100;
        else if (ag.wealth <= q75) rate = brackets[2] / 100;
        else                        rate = brackets[3] / 100;
        const tax = ag.wealth * rate;
        ag.wealth = Math.max(0, ag.wealth - tax);
        taxPool.amount += tax;
      }
    }
  }

  // ── 3. Annual redistribution — one round after tax ──
  if (redistPending && redist > 0 && taxPool.amount > 0) {
    const redistAmt = taxPool.amount * (redist / 100);
    taxPool.amount -= redistAmt;

    const sorted4 = [...alive].sort((a, b) => a.wealth - b.wealth);
    const cnt = sorted4.length;
    const q = [
      sorted4.slice(0,                     Math.ceil(cnt * 0.25)),
      sorted4.slice(Math.ceil(cnt * 0.25), Math.ceil(cnt * 0.50)),
      sorted4.slice(Math.ceil(cnt * 0.50), Math.ceil(cnt * 0.75)),
      sorted4.slice(Math.ceil(cnt * 0.75)),
    ];
    const qKeys = ['q1', 'q2', 'q3', 'q4'];
    const totalWeight = qKeys.reduce((s, k) => s + (redistWeights[k] ?? 1), 0);
    if (totalWeight > 0) {
      for (let i = 0; i < 4; i++) {
        const bracket  = q[i];
        if (!bracket.length) continue;
        const share    = (redistWeights[qKeys[i]] ?? 1) / totalWeight;
        const perAgent = (share * redistAmt) / bracket.length;
        for (const ag of bracket) ag.wealth += perAgent;
      }
    }
  }

  // ── 4. Trades — 50/50 pure luck, recession drops volume to 25% ──
  const activeTrades = recessionState.active
    ? Math.max(1, Math.round(trades * 0.25))
    : trades;

  for (let t = 0; t < activeTrades; t++) {
    const a = alive[Math.floor(Math.random() * alive.length)];
    const b = alive[Math.floor(Math.random() * alive.length)];
    if (!a || !b || a === b) continue;

    const poorer = Math.min(a.wealth, b.wealth);
    if (poorer < 0.001) continue;
    const stake = Math.random() * poorer * (maxbet / 100);
    if (stake < 0.001) continue;

    const aWins = Math.random() < 0.5;

    if (aWins) {
      a.wealth += stake; b.wealth -= stake; a.tradesWon++; b.tradesLost++;
      if (taxMode === 'income-flat' || taxMode === 'income-bracket') {
        const tx   = calcTax(stake, taxMode, flatTax, brackets);
        const paid = Math.min(tx, a.wealth);
        a.wealth -= paid; taxPool.amount += paid;
      }
    } else {
      a.wealth -= stake; b.wealth += stake; b.tradesWon++; a.tradesLost++;
      if (taxMode === 'income-flat' || taxMode === 'income-bracket') {
        const tx   = calcTax(stake, taxMode, flatTax, brackets);
        const paid = Math.min(tx, b.wealth);
        b.wealth -= paid; taxPool.amount += paid;
      }
    }

    if (a.wealth < 0) a.wealth = 0;
    if (b.wealth < 0) b.wealth = 0;

    // Per-agent history — always recorded, capped at 200 per agent
    const aCity   = a.location?.city   ?? '?';
    const bCity   = b.location?.city   ?? '?';
    const aRegion = a.location?.region ?? '?';
    const bRegion = b.location?.region ?? '?';
    const scope   = aCity === bCity ? 'local' : aRegion === bRegion ? 'regional' : 'global';
    const entry = {
      round,
      aId: a.id, aName: a.name, aSurname: a.surname, aCity, aRegion,
      bId: b.id, bName: b.name, bSurname: b.surname, bCity, bRegion,
      scope,
      stake: +stake.toFixed(2),
      winner: aWins ? a.id : b.id,
      winnerName: aWins ? a.name : b.name,
      aAfter: +a.wealth.toFixed(2), bAfter: +b.wealth.toFixed(2),
    };
    a.tradeHistory.unshift(entry);
    if (a.tradeHistory.length > 200) a.tradeHistory.pop();
    b.tradeHistory.unshift(entry);
    if (b.tradeHistory.length > 200) b.tradeHistory.pop();

    // Global log — capped at 500
    if (tradeLogBuf.length < 500) {
      tradeLogBuf.unshift(entry);
    }
  }

  // ── 5. Recession erosion ──
  if (recessionState.active) {
    for (const ag of alive) {
      const erosion   = ag.wealth * 0.003;
      ag.wealth      -= erosion;
      taxPool.amount += erosion;
    }
    recessionState.roundsLeft--;
    if (recessionState.roundsLeft <= 0) recessionState.active = false;
  }

  // ── 6. Bankruptcy check ──
  let bankruptciesThisStep = 0;
  for (const ag of alive) {
    if (ag.wealth < 0.1) {
      resolveBankruptcy(ag, taxPool, bankruptcyPayout, baseWealth);
      bankruptciesThisStep++;
    }
  }

  // ── 7. History snapshot ──
  if (round % 5 === 0) {
    for (const ag of alive) {
      ag.history.push(+ag.wealth.toFixed(1));
      if (ag.history.length > 200) ag.history.shift();
    }
  }

  return { bankruptciesThisStep };
}

function applyRecessionShock(agents, recessionState, taxPool) {
  recessionState.active     = true;
  recessionState.roundsLeft = 80 + Math.floor(Math.random() * 60);
  const shock = 0.20 + Math.random() * 0.20;
  for (const ag of agents.filter(a => a.alive)) {
    const loss      = ag.wealth * shock;
    ag.wealth      -= loss;
    if (taxPool) taxPool.amount += loss;
  }
}