'use strict';
// ─────────────────────────────────────────────────
// AGENTS
// ─────────────────────────────────────────────────

const NAMES = [
  'Aaliya','Aaron','Abel','Abena','Abigail','Adam','Adela','Aditi','Adrian','Aiko',
  'Aiyana','Akira','Alana','Alec','Aleksei','Alena','Alessia','Alex','Alexis','Ali',
  'Alicia','Alina','Alinta','Aliyah','Amara','Amelia','Amina','Amir','Amira','Ana',
  'Anaya','Andre','Andrea','Andrei','Andres','Andy','Anita','Anja','Anna','Annie',
  'Anton','Anya','Arash','Aria','Arjun','Arne','Arno','Arthur','Asel','Asel',
  'Ashley','Astrid','Atousa','Aurélie','Ava','Ayaan','Ayesha','Aylin','Aziz','Beatrix',
  'Benjamin','Bente','Bjorn','Boris','Brigitte','Bruno','Camille','Carlos','Carmen','Catarina',
  'Celine','Chayton','Chen','Chiara','Clara','Claudio','Clement','Cora','Dag','Dalia',
  'Damian','Daniel','Daria','David','Diego','Dina','Dominik','Dylan','Elena','Elias',
  'Elina','Elisa','Emma','Erik','Esme','Esteban','Eva','Evelyn','Fabian','Fatima',
  'Felix','Finn','Flora','Florian','Freya','Gabriel','Giulia','Grace','Hana','Hannah',
  'Hans','Hassan','Heidi','Helena','Henrik','Hugo','Ibrahim','Ida','Ilya','Ingrid',
  'Isabel','Ivan','Jade','Jakob','Jana','Jasmine','Javier','Jean','Johan','Jonas',
  'Jonathan','Josef','Julia','Julian','Karin','Karl','Katya','Kenji','Kevin','Kira',
  'Klaus','Kofi','Lars','Laura','Layla','Lea','Leon','Leoni','Lila','Lior',
  'Lisa','Lola','Luca','Lucas','Luna','Luuk','Lyra','Mads','Magnus','Maike',
  'Malek','Mali','Malia','Malin','Mara','Marco','Maria','Marit','Markus','Mateo',
  'Mats','Max','Maya','Mehmet','Milan','Mila','Mira','Mohamed','Monika','Naomi',
  'Nathalie','Nia','Niels','Nikita','Niko','Nils','Nina','Noah','Nora','Olga',
  'Oliver','Omar','Ona','Oskar','Osman','Otto','Pablo','Parveen','Paul','Petra',
  'Pieter','Pia','Rafael','Rami','Rana','Rashida','Ravi','Remy','Rina','Robin',
  'Rodrigo','Rosa','Ruben','Ryo','Saanvi','Sabine','Said','Sara','Sarah','Sebastian',
  'Selma','Seo','Signe','Simon','Sina','Sofia','Soren','Stefan','Stella','Sven',
  'Tadashi','Talia','Tariq','Tea','Teodora','Thijs','Thomas','Tia','Tina','Tomas',
];

// Shuffle so agents don't always get names in order
function shuffleNames() {
  const a = [...NAMES];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let _nextId   = 0;
let _namePool = shuffleNames();
let _nameIdx  = 0;

function pickName() {
  if (_nameIdx >= _namePool.length) { _namePool = shuffleNames(); _nameIdx = 0; }
  return _namePool[_nameIdx++];
}

function resetAgentIds() {
  _nextId   = 0;
  _namePool = shuffleNames();
  _nameIdx  = 0;
}

// ── TIER DEFS — winRate is absolute % (adjusted by sliders) ──
// tradeBonus and startMult are fixed per tier.
// winRate is passed in from params so it's dynamic.
const TIER_FIXED = {
  poor:    { tradeBonus: 1, startMult: 0.5 },
  normal:  { tradeBonus: 1, startMult: 1.0 },
  skilled: { tradeBonus: 1, startMult: 1.0 },
  elite:   { tradeBonus: 2, startMult: 3.0 },
};

function createAgent(tierName, startWealth, startAgeYears, generation = 0, parentId = null, parentName = null) {
  const id   = _nextId++;
  const name = pickName();
  const fixed = TIER_FIXED[tierName] || TIER_FIXED.normal;
  return {
    id, name, generation, parentId, parentName,
    tier: { name: tierName, ...fixed },
    wealth: startWealth,
    ageYears: startAgeYears,   // float, in simulated years
    lifespan: 70 + Math.floor(Math.random() * 26), // natural death age: 70–95
    tradesWon: 0, tradesLost: 0,
    bankruptcies: 0, naturalDeaths: 0,
    history: [+startWealth.toFixed(1)],
    alive: true,
  };
}

function buildInitialAgents(count, baseWealth, tierConfig) {
  resetAgentIds();
  const tierList = buildTierList(count, tierConfig);
  return tierList.map(t => {
    const fixed = TIER_FIXED[t] || TIER_FIXED.normal;
    const startAge = 20 + Math.floor(Math.random() * 21); // random 20–40
    return createAgent(t, baseWealth * fixed.startMult, startAge);
  });
}

function buildTierList(n, tierConfig) {
  const { poor, normal, skilled, elite } = tierConfig;
  const sum   = poor + normal + skilled + elite;
  const scale = sum > 0 ? 100 / sum : 1;
  const counts = {
    poor:    Math.round(n * poor    * scale / 100),
    normal:  Math.round(n * normal  * scale / 100),
    skilled: Math.round(n * skilled * scale / 100),
    elite:   0,
  };
  counts.elite = Math.max(0, n - counts.poor - counts.normal - counts.skilled);
  const list = [];
  for (const [tier, cnt] of Object.entries(counts))
    for (let i = 0; i < cnt; i++) list.push(tier);
  while (list.length < n) list.push('normal');
  return list.slice(0, n);
}

// ── TICK — returns list of naturally-dead agents ──
// mortalityRate: annual % chance after age 40 (0 = off, 1.0 = 1% per year)
function tickLifespans(agents, roundsPerYear, mortalityRate) {
  const dead = [];
  const yearPerRound = 1 / roundsPerYear;
  for (const ag of agents) {
    if (!ag.alive) continue;
    ag.ageYears += yearPerRound;

    // Natural death by lifespan
    if (ag.ageYears >= ag.lifespan) {
      ag.alive = false;
      dead.push(ag);
      continue;
    }

    // Random early mortality after age 40 (if enabled)
    if (mortalityRate > 0 && ag.ageYears >= 40) {
      const annualProb  = mortalityRate / 100;               // e.g. 0.005 for 0.5%
      const roundProb   = 1 - Math.pow(1 - annualProb, yearPerRound);
      if (Math.random() < roundProb) {
        ag.alive = false;
        dead.push(ag);
      }
    }
  }
  return dead;
}

// Natural death: child gets inheritPct%, rest → tax pool
// Returns { successor, taxContribution }
function spawnSuccessor(deceased, inheritPct, baseWealth) {
  const childShare   = deceased.wealth * (inheritPct / 100);
  const taxShare     = deceased.wealth - childShare;
  const startWealth  = Math.max(childShare, baseWealth * 0.01);
  const successor    = createAgent(
    deceased.tier.name, startWealth, 20,
    deceased.generation + 1, deceased.id, deceased.name
  );
  successor.naturalDeaths = deceased.naturalDeaths + 1;
  return { successor, taxContribution: taxShare };
}

// Bankruptcy: does NOT die — gets money from tax pool
// Returns amount pulled from pool
function resolveBankruptcy(agent, taxPool, bankruptcyPayout, baseWealth) {
  const payout = Math.max(bankruptcyPayout, baseWealth * 0.05);
  agent.wealth += payout;
  agent.bankruptcies++;
  taxPool.amount -= payout; // can go negative — government goes into debt
  return payout;
}