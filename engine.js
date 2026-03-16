'use strict';
// ─────────────────────────────────────────────────
// ENGINE — one simulation step
// ─────────────────────────────────────────────────

// amount  = wealth (for wealth-*) or trade gain (for income-*)
function calcTax(amount, taxMode, flatRate, brackets) {
  if (taxMode === 'none') return 0;
  if (taxMode === 'wealth-flat' || taxMode === 'income-flat')
    return amount * (flatRate / 100);
  // bracket (wealth-bracket or income-bracket)
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
    winRates,          // { poor, normal, skilled, elite } — absolute % (e.g. 50)
    redistWeights,     // { poor, normal, skilled, elite } — multiplier for redistrib share
    bankruptcyPayout,
    round, roundsPerYear,
  } = params;

  const alive = agents.filter(a => a.alive);
  const n = alive.length;
  if (!n) return;

  // ── 1. Trades ──
  const pool = [];
  for (const ag of alive)
    for (let k = 0; k < ag.tier.tradeBonus; k++) pool.push(ag);

  for (let t = 0; t < trades; t++) {
    const a = pool[Math.floor(Math.random() * pool.length)];
    const b = pool[Math.floor(Math.random() * pool.length)];
    if (!a || !b || a === b) continue;

    const poorer = Math.min(a.wealth, b.wealth);
    if (poorer < 0.001) continue;
    const stake = Math.random() * poorer * (maxbet / 100);
    if (stake < 0.001) continue;

    // Win prob: average of a's win rate and (1 - b's win rate)
    const aWin = winRates[a.tier.name] / 100;
    const bWin = winRates[b.tier.name] / 100;
    const aWinProb = (aWin + (1 - bWin)) / 2;
    const aWins = Math.random() < aWinProb;

    if (aWins) {
      a.wealth += stake; b.wealth -= stake; a.tradesWon++; b.tradesLost++;
      // Income tax: deduct from winner's gain at source
      if (taxMode === 'income-flat' || taxMode === 'income-bracket') {
        const t = calcTax(stake, taxMode, flatTax, brackets);
        const paid = Math.min(t, a.wealth);
        a.wealth -= paid;
        taxPool.amount += paid;
      }
    } else {
      a.wealth -= stake; b.wealth += stake; b.tradesWon++; a.tradesLost++;
      if (taxMode === 'income-flat' || taxMode === 'income-bracket') {
        const t = calcTax(stake, taxMode, flatTax, brackets);
        const paid = Math.min(t, b.wealth);
        b.wealth -= paid;
        taxPool.amount += paid;
      }
    }

    if (a.wealth < 0) a.wealth = 0;
    if (b.wealth < 0) b.wealth = 0;

    if (tradeLogBuf.length < 500) {
      tradeLogBuf.unshift({
        round, aId: a.id, aName: a.name, bId: b.id, bName: b.name,
        stake: +stake.toFixed(2),
        winner: aWins ? a.id : b.id, winnerName: aWins ? a.name : b.name,
        aAfter: +a.wealth.toFixed(2), bAfter: +b.wealth.toFixed(2),
      });
    }
  }

  // ── 2. Luck ──
  if (luck > 0) {
    const lf = luck / 100 * 0.05;
    for (const ag of alive)
      ag.wealth = Math.max(0, ag.wealth + (Math.random() * 2 - 1) * ag.wealth * lf);
  }

  // ── 3. Recession erosion ──
  if (recessionState.active) {
    for (const ag of alive) ag.wealth *= 0.997;
    recessionState.roundsLeft--;
    if (recessionState.roundsLeft <= 0) recessionState.active = false;
  }

  // ── 4. Wealth tax → pool (per-round sweep on total wealth) ──
  if (taxMode === 'wealth-flat' || taxMode === 'wealth-bracket') {
    for (const ag of alive) {
      const t = calcTax(ag.wealth, taxMode, flatTax, brackets);
      ag.wealth = Math.max(0, ag.wealth - t);
      taxPool.amount += t;
    }
  }

  // ── 5. Redistribution (tier-weighted) ──
  if (redist > 0 && taxPool.amount > 0) {
    const redistAmt = taxPool.amount * (redist / 100);
    taxPool.amount -= redistAmt;

    // Compute weighted total
    const totalWeight = alive.reduce((s, ag) => s + (redistWeights[ag.tier.name] ?? 1), 0);
    if (totalWeight > 0) {
      for (const ag of alive) {
        const w = redistWeights[ag.tier.name] ?? 1;
        ag.wealth += (w / totalWeight) * redistAmt;
      }
    }
  }

  // ── 6. Bankruptcy check — pull from tax pool, don't die ──
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

function applyRecessionShock(agents, recessionState) {
  recessionState.active     = true;
  recessionState.roundsLeft = 80 + Math.floor(Math.random() * 60);
  const shock = 0.20 + Math.random() * 0.20;
  for (const ag of agents.filter(a => a.alive)) ag.wealth *= (1 - shock);
}