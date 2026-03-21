'use strict';
// ─────────────────────────────────────────────────
// AGENTS
// ─────────────────────────────────────────────────

const NAMES = [
  'Aaliya','Aaron','Abel','Abena','Abigail','Adam','Adela','Aditi','Adrian','Aiko',
  'Aiyana','Akira','Alana','Alec','Aleksei','Alena','Alessia','Alex','Alexis','Ali',
  'Alicia','Alina','Alinta','Aliyah','Amara','Amelia','Amina','Amir','Amira','Ana',
  'Anaya','Andre','Andrea','Andrei','Andres','Andy','Anita','Anja','Anna','Annie',
  'Anton','Anya','Arash','Aria','Arjun','Arne','Arno','Arthur','Asel','Ashley',
  'Astrid','Atousa','Aurélie','Ava','Ayaan','Ayesha','Aylin','Aziz','Beatrix',
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
  'Abebe','Adaeze','Adebayo','Adewale','Afia','Afolake','Ajay','Akbar','Akosua','Amari',
  'Amaru','Amaya','Anaïs','Andile','Andrés','Annalise','Anuli','Arjuna','Aroha','Aryan',
  'Ashanti','Asim','Astou','Awa','Ayasha','Ayodele','Aziza','Bafana','Bankole','Beatriz',
  'Benedikt','Bereket','Bethel','Blessing','Bora','Calixta','Caoimhe','Cassandra','Celestine',
  'Chanda','Chidi','Chidinma','Chisom','Clémentine','Dalmar','Damilola','Daniyar','Daunte',
  'Deepak','Devansh','Dhruv','Ebony','Ekene','Elara','Elif','Elika','Eloise','Emiliano',
  'Emilio','Emmanuel','Enitan','Ezra','Faisal','Fatou','Femi','Fernanda','Folake',
  'Folashade','Folu','Gao','Gareth','Gianluca','Goma','Greta','Guido','Gurpreet',
  'Hadija','Hamid','Hamza','Haruki','Hayato','Heloise','Hemi','Hideki','Ikenna',
  'Imelda','Ines','Ioana','Isadora','Jabir','Jameela','Jamila','Janelle','Jaylen',
  'Jazmin','Jelani','Jocasta','Kabelo','Kai','Kaito','Kalani','Kamil','Karabo',
  'Karan','Kareem','Kasimir','Keanu','Laboni','Laetitia','Laleh','Lanre','Lavinia',
  'Lazaro','Leandro','Leonora','Linh','Maciej','Maduabuchi','Mafalda','Mahsa','Maïmouna',
  'Majid','Makena','Malak','Malika','Mamadou','Natasha','Ndidi','Ngozi','Niamh',
  'Nikoletta','Nilufar','Nimrod','Nino','Nomvula','Nour','Obiageli','Obinna','Odessa',
  'Olabisi','Olumide','Omkar','Orla','Oumar','Ozlem','Parisa','Pavlos','Paz','Perla',
  'Philomena','Pita','Priya','Ragnhild','Rajesh','Ramona','Rangi','Ranya','Ronan',
  'Roshni','Roxana','Rudo','Rufus','Sahar','Salma','Salome','Sanaa','Seun','Shreya',
  'Sienna','Sindiso','Sipho','Sirine','Solange','Soraya','Sumire','Taiwo','Takoda',
  'Tamika','Tanya','Taraji','Temidayo','Tendai','Tesfaye','Thandi','Thabo',
  'Umar','Umaru','Usha','Valentina','Valeria','Vandana','Varsha','Veda','Vikram',
  'Wanjiru','Wemi','Weronika','Xiomara','Xochitl','Yael','Yara','Yasmin',
  'Yekaterina','Yewande','Yusuf','Zara','Zaynab','Zeynep','Zinnia','Zion','Zita',
];

const SURNAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Moore',
  'Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Lewis','Walker',
  'Hall','Allen','Young','King','Wright','Scott','Green','Baker','Adams','Nelson',
  'Carter','Mitchell','Roberts','Turner','Phillips','Campbell','Parker','Evans','Edwards','Collins',
  'Stewart','Morris','Rogers','Reed','Cook','Morgan','Bell','Bailey','Rivera','Cooper',
  'Richardson','Cox','Howard','Ward','Peterson','Gray','James','Watson','Brooks','Kelly',
  'Sanders','Price','Bennett','Wood','Barnes','Ross','Henderson','Coleman','Jenkins','Perry',
  'Powell','Long','Patterson','Hughes','Washington','Mason','Dixon','Foster','Simmons','Bryant',
  'Alexander','Russell','Griffin','Hayes','Myers','Ford','Hamilton','Graham','Sullivan','Wallace',
  'Woods','Cole','West','Jordan','Owens','Webster','Hunter','Pierce','Fuller','Grant',
  'van der Berg','Bakker','Jansen','de Vries','Visser','Smit','Meijer','de Boer','Mulder','de Groot',
  'Bos','Vos','Peters','Hendriks','van Dijk','Dijkstra','Brouwer','de Wit','Kok','Dekker',
  'van Leeuwen','Wolff','Prins','Hoekstra','Engel','van den Berg','Lammers','Bosch','Post','Otten',
  'Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann',
  'Schäfer','Koch','Bauer','Richter','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann',
  'Braun','Krüger','Hofmann','Hartmann','Lange','Schmitt','Werner','Krause','Huber','Gruber',
  'Steiner','Hofer','Fuchs','Günther','Ludwig','Berger','Brandt','Frank','Kaiser','Roth',
  'Dupont','Bernard','Dubois','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Bertrand',
  'Roux','Vincent','Fournier','Morel','Girard','André','Mercier','Dupuis','Blanc','Guerin',
  'Boyer','Chevalier','Faure','Garnier','Bonnet','Lemaire','Renard','Giraud','Dumont','Perrin',
  'García','Martínez','López','González','Rodríguez','Fernández','Sánchez','Pérez','Gómez','Díaz',
  'Torres','Vargas','Ramírez','Castro','Morales','Romero','Cruz','Herrera','Jiménez','Ortega',
  'Mendoza','Alvarez','Castillo','Vega','Ríos','Reyes','Guerrero','Contreras','Medina','Rojas',
  'Acosta','Pacheco','Fuentes','Espinoza','Ibarra','Vásquez','Delgado','Aguilar','Campos','Ramos',
  'Fernandes','Carvalho','Pereira','Alves','Cunha','Sousa','Oliveira','Costa','Ferreira','Santos',
  'Hansen','Nielsen','Larsen','Pedersen','Andersen','Christensen','Johansen','Olsen','Jensen','Carlsen',
  'Eriksson','Lindqvist','Strand','Holm','Berg','Dahl','Lund','Svensson','Lindberg','Johansson',
  'Magnusson','Gustafsson','Persson','Björk','Nygaard','Halvorsen','Martinsen','Haugen','Bakke','Lie',
  'Kowalski','Nowak','Wiśniewski','Wójcik','Kamiński','Lewandowski','Zieliński','Szymański','Woźniak','Kaczmarek',
  'Piotrowski','Grabowski','Novák','Kovář','Dvořák','Procházka','Kučera','Horák','Petrov','Ivanov',
  'Sokolov','Popov','Volkov','Fedorov','Kozlov','Nikolaev','Smirnov','Orlov','Medvedev','Morozov',
  'Marek','Blaha','Veselý','Pokorný','Novotný',
  'Okafor','Mensah','Diallo','Nkrumah','Osei','Adeola','Balogun','Abiodun','Diop','Traoré',
  'Coulibaly','Touré','Koné','Camara','Sow','Mbeki','Nkosi','Dlamini','Khumalo','Mthembu',
  'Boateng','Asante','Owusu','Mwangi','Kamau','Ochieng','Njoroge','Nwosu','Eze','Igwe',
  'Okonkwo','Adeyemi','Afolabi','Adebayo','Abdullahi','Diarra','Keita','Sangaré','Cissé','Kouyaté',
  'Dembélé','Fofana','Baldé','Sylla','Mané','Ndoye','Ndiaye','Fall','Seck','Ba',
  'Kim','Lee','Park','Zhang','Wang','Li','Liu','Chen','Wu','Yang',
  'Huang','Zhao','Zhou','Xu','Sun','Hu','Zhu','Lin','He','Gao',
  'Tanaka','Suzuki','Sato','Watanabe','Yamamoto','Ito','Nakamura','Kobayashi','Kato','Hayashi',
  'Yamada','Shimizu','Okamoto','Abe','Fujita','Ogawa','Mori','Ikeda','Hashimoto','Kimura',
  'Choi','Yoon','Shin','Lim','Oh','Kwon','Cho','Bae','Han','Jeon',
  'Sharma','Kumar','Singh','Patel','Gupta','Mehta','Joshi','Nair','Iyer','Pillai',
  'Reddy','Rao','Bose','Chatterjee','Mukherjee','Banerjee','Das','Ghosh','Roy','Malhotra',
  'Kapoor','Chandra','Verma','Mishra','Pandey','Tiwari','Shukla','Tripathi','Yadav','Dubey',
  'Hassan','Ibrahim','Khalil','Farouk','Mansour','Al-Rashid','Karimi','Rahimi','Ahmadi','Hosseini',
  'Rezaei','Mousavi','Soltani','Moradi','Taheri','Mustafa','Hussain','Ahmed','Khan','Malik',
  'Qureshi','Abboud','Nasser','Al-Amin','Al-Farsi','Al-Zahrani','Al-Harbi','Al-Otaibi','Saleh','Omar',
  "Murphy","O'Brien","Byrne","Kelly","O'Connor","Walsh","Kennedy","Dunne","Lynch","Flynn",
  "Doyle","Clarke","McCarthy","O'Sullivan","Healy","Doherty","Gallagher","Quinn","Ryan","Fitzpatrick",
  'Rossi','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno',
  'Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Morelli','Fontana',
  'Santoro','De Angelis','Ferrara','Russo','Leone','Barbieri','Marchetti','Galli','Villa','Cattaneo',
  'Papadopoulos','Georgiou','Nikolaou','Alexiou','Demetriou','Andreou','Petridis','Charalambous',
  'Yılmaz','Kaya','Demir','Çelik','Arslan','Şahin','Doğan','Aydın','Öztürk','Yıldız',
  'Nguyen','Tran','Le','Pham','Ngo','Vu','Hoang','Dang','Bui','Trinh',
  'Reyes','Santos','De La Cruz','Flores','Dizon','Tan','Sy','Go','Lim','Cruz',
];

function shuffleNames() {
  const a = [...NAMES];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleSurnames() {
  const a = [...SURNAMES];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let _nextId      = 0;
let _namePool    = shuffleNames();
let _nameIdx     = 0;
let _surnamePool = shuffleSurnames();
let _surnameIdx  = 0;

function pickName() {
  if (_nameIdx >= _namePool.length) { _namePool = shuffleNames(); _nameIdx = 0; }
  return _namePool[_nameIdx++];
}

function pickSurname() {
  if (_surnameIdx >= _surnamePool.length) { _surnamePool = shuffleSurnames(); _surnameIdx = 0; }
  return _surnamePool[_surnameIdx++];
}

function resetAgentIds() {
  _nextId      = 0;
  _namePool    = shuffleNames();
  _nameIdx     = 0;
  _surnamePool = shuffleSurnames();
  _surnameIdx  = 0;
}

const TIER_FIXED = {
  lower:   { tradeBonus: 1, startMult: 1.0 },
  normal:  { tradeBonus: 1, startMult: 1.0 },
  skilled: { tradeBonus: 1, startMult: 1.0 },
  elite:   { tradeBonus: 2, startMult: 1.0 },
};

const ALL_TIERS = ['lower', 'normal', 'skilled', 'elite'];

function createAgent(
  tierName, startWealth, startAgeYears,
  generation = 0, parentId = null, parentName = null,
  surname = '', birthDateStr = ''
) {
  const id    = _nextId++;
  const name  = pickName();
  const fixed = TIER_FIXED[tierName] || TIER_FIXED.normal;
  return {
    id, name, surname, generation, parentId, parentName,
    tier: { name: tierName, ...fixed },
    wealth:        startWealth,
    initialWealth: startWealth,
    peakWealth:    startWealth,
    ageYears:      startAgeYears,
    lifespan:      70 + Math.floor(Math.random() * 26),
    birthDateStr,
    deathDateStr:  null,
    deathCause:    null,
    tradesWon: 0, tradesLost: 0,
    bankruptcies: 0, naturalDeaths: 0,
    history: [+startWealth.toFixed(1)],
    alive: true,
  };
}

function buildInitialAgents(count, baseWealth, tierConfig, birthDateStr = '') {
  resetAgentIds();
  const tierList = buildTierList(count, tierConfig);
  return tierList.map(t => {
    const fixed    = TIER_FIXED[t] || TIER_FIXED.normal;
    const startAge = 20 + Math.floor(Math.random() * 21);
    const surname  = pickSurname();
    return createAgent(t, baseWealth * fixed.startMult, startAge, 0, null, null, surname, birthDateStr);
  });
}

function buildTierList(n, tierConfig) {
  const { lower, normal, skilled, elite } = tierConfig;
  const sum   = lower + normal + skilled + elite;
  const scale = sum > 0 ? 100 / sum : 1;
  const counts = {
    lower:   Math.round(n * lower   * scale / 100),
    normal:  Math.round(n * normal  * scale / 100),
    skilled: Math.round(n * skilled * scale / 100),
    elite:   0,
  };
  counts.elite = Math.max(0, n - counts.lower - counts.normal - counts.skilled);
  const list = [];
  for (const [tier, cnt] of Object.entries(counts))
    for (let i = 0; i < cnt; i++) list.push(tier);
  while (list.length < n) list.push('normal');
  return list.slice(0, n);
}

function tickLifespans(agents, roundsPerYear, mortalityRate) {
  const dead = [];
  const yearPerRound = 1 / roundsPerYear;
  for (const ag of agents) {
    if (!ag.alive) continue;
    ag.ageYears += yearPerRound;

    if (ag.ageYears >= ag.lifespan) {
      ag.alive      = false;
      ag.deathCause = 'old age';
      dead.push(ag);
      continue;
    }

    if (mortalityRate > 0 && ag.ageYears >= 30) {
      const annualProb = mortalityRate / 100;
      const roundProb  = 1 - Math.pow(1 - annualProb, yearPerRound);
      if (Math.random() < roundProb) {
        ag.alive      = false;
        ag.deathCause = 'early mortality';
        dead.push(ag);
      }
    }
  }
  return dead;
}

// tierMobility: when true, 25% chance the child switches to a different random tier
function spawnSuccessor(deceased, inheritPct, baseWealth, birthDateStr = '', tierMobility = false) {
  const childShare  = deceased.wealth * (inheritPct / 100);
  const taxShare    = deceased.wealth - childShare;
  const startWealth = Math.max(childShare, baseWealth * 0.01);

  let newTierName = deceased.tier.name;
  if (tierMobility && Math.random() < 0.25) {
    const others = ALL_TIERS.filter(t => t !== deceased.tier.name);
    newTierName  = others[Math.floor(Math.random() * others.length)];
  }

  const successor = createAgent(
    newTierName, startWealth, 20,
    deceased.generation + 1, deceased.id, deceased.name,
    deceased.surname, birthDateStr
  );
  successor.naturalDeaths = deceased.naturalDeaths + 1;
  return { successor, taxContribution: taxShare };
}

function resolveBankruptcy(agent, taxPool, bankruptcyPayout, baseWealth) {
  const payout = Math.max(bankruptcyPayout, baseWealth * 0.05);
  agent.wealth += payout;
  agent.bankruptcies++;
  taxPool.amount -= payout;
  return payout;
}