# Wealth Inequality Simulator

An agent-based simulation that models how wealth concentrates across generations. Each agent trades, ages, dies, and passes wealth to a child. A shared tax pool funds redistribution and bankruptcy payouts. Watch the Gini coefficient, Lorenz curve, and family lineages evolve in real time.

**[Live demo →](https://renshoek.github.io/wealth-inequality-sim/)**

---

## What it simulates

Agents trade against random opponents each round. Outcomes are shaped by tier-based win probabilities — small edges compound dramatically over time. Agents age and die naturally, passing wealth to children who inherit the family name and optionally switch tiers. A government tax pool collects wealth tax once per year, redistributes it by wealth bracket, funds bankruptcy payouts, and can go into debt.

---

## Parameters

### Population
| Parameter | What it does |
|---|---|
| Agents | Population size |
| Starting wealth | Baseline wealth for normal-tier agents |
| Trades / round | Economic activity per time step — higher means faster concentration |
| Max bet % | Max fraction of the poorer agent's wealth at stake per trade |

### Timeline
| Parameter | What it does |
|---|---|
| 1 round = | Day / week / month — controls how fast agents age |
| Mortality after 30 | Annual chance of dying after age 30; set to 0 to disable |

### Skill tiers
Agents are split into **Lower**, **Normal**, **Skilled**, and **Elite**. Each tier has a configurable share of the population and a win rate (probability of winning a trade). Elite agents also get double the trade frequency. Normal auto-adjusts to keep the total at 100%.

### Tax & redistribution
| Parameter | What it does |
|---|---|
| Tax system | Wealth flat / bracket, or income flat / bracket |
| Tax rate | Collected once per year as a % of total wealth |
| Redistribution % | % of the tax pool paid out annually, one round after collection |
| Redistribution share | Per-quartile weights — model progressive or regressive spending |

### Inheritance & bankruptcy
| Parameter | What it does |
|---|---|
| Child inherits % | Fraction passed to the next generation; remainder is estate tax |
| Bankruptcy payout | Welfare payment drawn from the tax pool when an agent hits zero |

### Other forces
| Parameter | What it does |
|---|---|
| Luck % | Annual random wealth shock — windfalls or medical bills |
| Recession chance | % per 100 rounds; triggers a 20–40% wealth shock + slow erosion |
| Tier mobility | 25% chance each generation switches to a different tier |
| Money printing | Fixed amount added to the tax pool every 10 rounds |

---

## Metrics

- **Gini coefficient** — 0 = perfect equality, 1 = one person owns everything
- **Lorenz curve** — the gap between actual distribution and the equality diagonal
- **Top 10% share** — fraction of total wealth held by the wealthiest decile
- **Wealth by percentile** — breakdown across bottom 50%, 50–90%, 90–99%, top 1%
- **Wealth by age group** — distribution across four life-stage cohorts
- **Tax pool** — government balance; goes negative when payouts exceed revenue

---

## Tabs

**Simulation** — live wealth distribution bar chart, Lorenz curve, Gini history, and economy panel.

**Agents** — sortable card or table view of all living agents with full stats. Click any agent to inspect their wealth history.

**Trade log** — filterable record of the last 500 trades.

**History** — family lineage browser. Select a family to see all generations, a wealth chart across members, and individual profiles with birth/death dates, cause of death, peak wealth, win rate, and bankruptcy count.

---

## Tech

Pure HTML / CSS / JS. No dependencies, no build step. Canvas-rendered charts. Starts at **6 December 1999** and tracks real calendar dates.

## Run locally

```bash
git clone https://github.com/renshoek/wealth-inequality-sim.git
cd wealth-inequality-sim
open index.html
# or:
npx serve .
```
