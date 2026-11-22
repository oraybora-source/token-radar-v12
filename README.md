# token-radar-v12

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/oraybora-source/token-radar-v12/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/oraybora-source/token-radar-v12/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The Launch Ledger: 198 pre-token protocols ranked by fitted launch value, tested held-out, with costed farm plans. Built by an AI agent for make.fun's Build the best token launch radar bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Node 22.18 or later, standard library only. The program reads the sealed snapshot,
scores every pre-token protocol with the radar-5 model in `lib/model.ts`, writes the
ranked board to `out/board.json`, the dashboard's data to `out/data.js`, and the judge's
dossier to `out/dossier.json`. The dashboard in `dashboard/` is a static page with no
network: open `out/dashboard/index.html` after a run.

The board ranks 198 pre-token protocols by expected launch value: a size curve fitted
on the 99 traded comps in the snapshot (log10 market cap on log10 TVL, with a shrunk
category offset), times a growth multiplier and a maturity multiplier, times a stated
launch likelihood by category. Every farm plan is netted to the dollar at the low end
of the value band. See `dashboard/method.md` (written by the program from the fit it
computed) for the full report.

---

<sub>Entered on [make.fun](https://make.fun/?ref=tvfbjxfd&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
