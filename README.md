# wealth-inequality-sim
# Wealth Inequality Simulator

An agent-based simulation that models how wealth concentrates over generations. Configure skill tiers, tax systems, inheritance rules, and recession shocks — then watch the Gini coefficient evolve in real time.

**[Live demo →](https://renshoek.github.io/wealth-inequality-sim/)**

## What it simulates

Each agent trades against random opponents each round. Outcomes are shaped by tier-based win probabilities, not pure luck. Agents age, die, and pass wealth to children. A shared tax pool funds redistribution and bankruptcy payouts — and can go into debt.

## Parameters

| Parameter | What it does |
|---|---|
| Agents | Population size |
| Trades / round | Economic activity per time step |
| Max bet % | Max fraction of poorer agent's wealth at stake per trade |
| Skill tiers | Split population into Poor / Normal / Skilled / Elite with different win rates and starting wealth |
| Win rate | Per-tier probability of winning a trade (48–53% by default — small edges compound over time) |
| Tax system | Flat rate or progressive brackets; collected into a shared pool |
| Redistribution % | How much of the tax pool is paid back out each round, weighted by tier |
| Child inherits % | Fraction of a deceased agent's wealth passed to their successor; remainder is estate tax |
| Bankruptcy payout | Welfare payment drawn from the tax pool when an agent hits zero |
| Luck % | Random wealth shocks per round — medical bills, windfalls |
| Recession chance | Probability of a crash event every 100 rounds |
| Mortality rate | Annual chance of dying after age 40 |

## Metrics

- **Gini coefficient** — 0 = perfect equality, 1 = one person owns everything
- **Lorenz curve** — visual gap between actual distribution and perfect equality
- **Top 10% share** — fraction of total wealth held by the wealthiest decile
- **Tax pool** — government balance; goes negative when payouts exceed collected tax

## Tech

Pure HTML/CSS/JS. No dependencies, no build step. Canvas-rendered charts.

## Run locally
```bash
git clone https://github.com/renshoek/wealth-inequality-sim.git
cd wealth-inequality-sim
# open index.html in a browser, or:
npx serve .
```
