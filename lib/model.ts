// The Launch Ledger's model, version radar-5: one snapshot of the protocol universe in,
// one ranked board out.
//
// Every number below is a function of the snapshot's own figures. No protocol name is
// ever special-cased: the same function scores every row, and every constant is stated in
// the dashboard's model panel so a reader can check it.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and
// adds the launches the watchlist leaves out: the 20 largest pre-token protocols above the
// floor that pass the watchlist rule's own exclusions, and the 138 largest pre-token
// protocols below the floor. That is 198 rows in all. A protocol is pre-token when its
// index entry records no token (no market cap, no CoinGecko id, no symbol); the snapshot's
// live-token protocols are kept apart and shown as the market's own values, never mixed
// into the ranked board. What the board sets aside, and why, is counted in the dashboard's
// disposition strip, so the 758 protocols are all accounted for.
//
// Expected launch value follows from the snapshot's own figures, in four parts:
//
//   size curve   = a power law fitted on the traded tokens that are comparable launches:
//                  log10(market cap) = intercept + slope x log10(TVL), fitted by least
//                  squares on the comps (traded protocols that are not exchange, bridge or
//                  chain tokens, and not a versioned or wrapped product), plus a shrunk
//                  offset per category (the mechanism's own premium or discount, shrunk
//                  toward zero by sample size and capped at +/-0.3 dex). Fitted from this
//                  snapshot, every run; nothing about the curve is hardcoded.
//   fitted       = 10 ^ (intercept + slope x log10(TVL) + category offset)
//   growth       = clamp(change_7d, -60, 120) per cent
//   growthMult   = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity     = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age unknown: 365 days)
//   implied      = fitted x growthMult x maturity
//   band         = implied / 10^sigma .. implied x 10^sigma, where sigma is the fit's
//                  residual scatter: the value band the curve actually earns, not a guess.
//   likelihood   = the chance the category's protocols ever issue a token at all, from
//                  how the category works: tokens are the norm for exchanges, lenders
//                  and yield vaults, and structurally unlikely for payment networks and
//                  chains that move other people's assets. A stated judgement, by
//                  category only, never by name.
//   expected value = max(1, round(implied x likelihood))
//   low expected   = max(1, round(implied / 10^sigma x likelihood)): the band's low end.
//
// The board ranks by expected value: the worth of a launch times the chance it happens.
// The fit is tested, not trusted: a 5-fold out-of-sample check and a time-split check
// (fit on the older-listed comps, tested on the newer-listed ones) and a 200-run bootstrap
// of the slope and of the top ten's ranks, all reported in the dashboard.
//
// Beside the launch chance, every row carries the peers' own launch rate: the share of
// protocols in the same mechanism and age band that record a token, counted from this
// same snapshot and shrunk toward the global rate. It is shown for context, so a reader
// can see what the peers actually did; it does NOT multiply the fitted value. The ranking
// multiplier stays the stated category likelihood above, so the board's order is the
// fitted value's order, and the peer rate is a second opinion the reader can check.
//
// Every farm plan is netted to the dollar at the band's low end, under four stated
// assumptions (A1-A4 in the dashboard): the launch's airdrop pool is 10% of implied value,
// the farmed TVL is 1% of the protocol's TVL, a position earns its share of that pool,
// and idle capital costs 5% a year. Net = low-end expected farmer value - farm cost.
// Verdict: FARM when the net is at least $25, THIN when it is $0 to $25, SKIP below $0.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  /** Share of implied value the launch's airdrop pool is assumed to be (A1). */
  pool_share: number;
  /** Share of a protocol's TVL assumed to be farmed for the drop (A2). */
  farmed_share: number;
  /** Annual opportunity cost of idle farm capital (A4). */
  opp_rate_yr: number;
  /** Net low-end dollars at or above which a plan is FARM, not THIN. */
  farm_threshold_usd: number;
  /** How strongly a category's own residuals pull its offset from zero. */
  offset_prior_weight: number;
  /** The widest a category offset may stray, in dex (log10). */
  offset_cap_dex: number;
  /** How strongly a peer rate is pulled toward the global token rate. */
  peer_prior_count: number;
  /** Bootstrap resamples for the slope and rank stability. */
  bootstrap_runs: number;
  /** The bootstrap's seed: the same seed, the same resamples, every run. */
  bootstrap_seed: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  pool_share: 0.1,
  farmed_share: 0.01,
  opp_rate_yr: 0.05,
  farm_threshold_usd: 25,
  offset_prior_weight: 4,
  offset_cap_dex: 0.3,
  peer_prior_count: 8,
  bootstrap_runs: 200,
  bootstrap_seed: 20261114,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-5';

/** How many off-list launch candidates above the watchlist floor the board carries, by TVL. */
export const OFFLIST_ROWS = 20;

/** How many pre-token protocols below the watchlist floor the board carries, by TVL. */
export const BELOW_FLOOR_ROWS = 138;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm plan's dollar netting at the band's low end. */
export interface FarmEconomics {
  capital_usd: number;
  gas_usd: number;
  opp_usd: number;
  total_cost_usd: number;
  gross_low_usd: number;
  net_low_usd: number;
  net_per_hour_usd: number;
  verdict: 'farm' | 'thin' | 'skip';
}

/** One row of board.json: the fields the gate reads, plus the model's own numbers. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  mechanism: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  raw_implied_value_usd: number;
  low_implied_value_usd: number;
  high_implied_value_usd: number;
  low_expected_value_usd: number;
  launch_likelihood: number;
  peer_launch_rate: number;
  peer_rate_n: number;
  fitted_value_usd: number;
  base_fitted_value_usd: number;
  comp_multiple: number;
  farm_difficulty: 'Easy' | 'Moderate' | 'Advanced';
  farm_verdict: 'farm' | 'thin' | 'skip';
  farm: FarmEconomics;
  model: {
    comp_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    launch_likelihood: number;
    peer_launch_rate: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  mechanism: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  raw_implied_value_usd: number;
  low_implied_value_usd: number;
  high_implied_value_usd: number;
  low_expected_value_usd: number;
  launch_likelihood: number;
  peer_launch_rate: number;
  peer_rate_n: number;
  comp_multiple: number;
  fitted_value_usd: number;
  base_fitted_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  farm_difficulty: 'Easy' | 'Moderate' | 'Advanced';
  farm_verdict: 'farm' | 'thin' | 'skip';
  farm: FarmEconomics;
  farm_steps: string[];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  mcap_tvl_ratio: number | null;
  change_7d: number | null;
}

/** One row of the comps table: what the fitted curve learned per category. */ 
export interface CompRow {
  category: string;
  mechanism: string;
  live_count: number;
  median_multiple: number | null;
  offset_dex: number;
  /** The same offset at full precision, for the page's recompute check. */
  offset_full_dex: number;
}

/** One mechanism's comps, for the mechanisms table. */
export interface MechanismRow {
  mechanism: string;
  live_count: number;
  median_offset_dex: number;
}

/** One peer-rate row: how often the peers in a mechanism and age band record a token. */
export interface PeerRateRow {
  mechanism: string;
  age_band: string;
  protocols: number;
  tokened: number;
  peer_rate: number;
}

/** The fitted curve and its tests, from the snapshot's own traded tokens. */
export interface FitStats {
  comps_n: number;
  comps_rule: string;
  slope: number;
  intercept: number;
  /** Full-precision slope and intercept, for the page's recompute check: the rounded
      pair above is for display, and rounding it moves a recomputed value by ~0.1%. */
  slope_full: number;
  intercept_full: number;
  r2: number;
  sigma_dex: number;
  band_factor: number;
  oos_5fold_factor: number;
  oos_5fold_spearman: number;
  timesplit_cut: string | null;
  timesplit_n_train: number;
  timesplit_n_test: number;
  timesplit_factor: number;
  timesplit_spearman: number;
  bootstrap_runs: number;
  bootstrap_slope_mean: number;
  bootstrap_slope_sd: number;
  bootstrap_slope_p5: number;
  bootstrap_slope_p95: number;
  top10_stability: { slug: string; name: string; stability: number }[];
  verdict_counts: { farm: number; thin: number; skip: number };
  /** One row per model variant, each scored on the same time-split test as timesplit_factor. */
  ablation: { variant: string; factor: number; within2: number; n: number }[];
  /** The comps' own points for the scatter chart: [TVL, market cap] per traded token. */
  scatter: [number, number][];
  comps: CompRow[];
  mechanisms: MechanismRow[];
  peer_rates: PeerRateRow[];
}

/** How the snapshot's protocols are accounted for: the board's rows, and every protocol set
    aside, with the reason. The groups are exclusive and in this order, so they sum to the
    snapshot's protocol count. */
export interface Disposition {
  ranked: number;
  tokened: number;
  bridge: number;
  lst: number;
  exchange: number;
  versioned_wrapped: number;
  below_cut: number;
  total: number;
}

/** Facts the dashboard's integrity strip states, all computed from the snapshot and the run. */
export interface Integrity {
  snapshot_as_of: string;
  snapshot_source_short: string;
  protocols_count: number;
  watchlist_count: number;
  watchlist_covered: number;
  board_rows: number;
  offlist_rows: number;
  gate_self_check: string;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  offlist_size: number;
  live_size: number;
  total_expected_usd: number;
  total_tvl_usd: number;
  disposition: Disposition;
  integrity: Integrity;
  watchlist: string[];
  comps: CompRow[];
  fit: FitStats;
  rows: RadarRow[];
  live: LiveRow[];
}

const DAY_MS = 86_400_000;

/** `value` when finite, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list of numbers. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Days from `listedAt` to the snapshot's date, or null when unlisted. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const listed = Date.parse(`${listedAt}T00:00:00Z`);
  const at = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(listed) || !Number.isFinite(at)) return null;
  return Math.max(0, Math.round((at - listed) / DAY_MS));
}

/** A seeded PRNG, so the bootstrap resamples the same way every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spearman rank correlation of two paired lists. */
export function spearman(xs: number[], ys: number[]): number {
  const rankOf = (values: number[]): number[] => {
    const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const ranks = new Array<number>(values.length);
    for (let r = 0; r < order.length; r++) ranks[order[r]![1]] = r + 1;
    return ranks;
  };
  const rx = rankOf(xs);
  const ry = rankOf(ys);
  const n = xs.length;
  if (n < 2) return 0;
  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (rx[i]! - mx) * (ry[i]! - my);
    sxx += (rx[i]! - mx) ** 2;
    syy += (ry[i]! - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

/** Least squares for y = a + b*x on paired arrays; returns [intercept, slope]. */
function olsLine(xs: number[], ys: number[]): [number, number] {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return [my - b * mx, b];
}

/** The mechanism a category belongs to: perps trade differently from lenders and DEXes. */
export function mechanismOf(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'Perpetuals';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Lending';
  if (c.includes('dex')) return 'DEX';
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('curator') || c.includes('allocator')) return 'Yield';
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking pool')) return 'Staking';
  if (c.includes('rwa')) return 'RWA';
  if (c.includes('bridge')) return 'Bridge';
  if (c.includes('chain')) return 'Chain';
  if (c.includes('payments')) return 'Payments';
  if (c.includes('stable')) return 'Stablecoins';
  return 'Other';
}

/** The age band a protocol falls in, for the peers' launch rate. */
export function ageBandOf(age: number | null): string {
  if (age === null) return 'unknown';
  if (age < 90) return 'under 90 days';
  if (age < 365) return '90 days to 1 year';
  if (age < 730) return '1 to 2 years';
  if (age < 1095) return '2 to 3 years';
  return 'over 3 years';
}

/** Categories whose tokens are not comparable launches, so they are not comps. */
const COMP_EXCLUDED_CATEGORIES = new Set(['cex', 'bridge', 'canonical bridge', 'cross chain bridge', 'chain']);

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a traded protocol is a comparable launch the size curve may learn from. */
export function isComp(p: SnapshotProtocol): boolean {
  if (!(p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)) return false;
  if (COMP_EXCLUDED_CATEGORIES.has((p.category ?? '').toLowerCase())) return false;
  if (VERSIONED.test(p.name)) return false;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return false;
  return true;
}

/** One fitted curve: intercept, slope and shrunk per-category offsets, from a comps set. */
export interface SizeCurve {
  intercept: number;
  slope: number;
  offsets: Map<string, number>;
  predict: (p: SnapshotProtocol) => number;
  predictBase: (p: SnapshotProtocol) => number;
}

/** Fit the size curve on `train`: least squares on log10(market cap) over log10(TVL). */
export function fitCurve(train: SnapshotProtocol[], model: ModelConstants = MODEL): SizeCurve {
  const xs = train.map((p) => Math.log10(p.tvl_usd));
  const ys = train.map((p) => Math.log10(p.mcap_usd!));
  const [intercept, slope] = olsLine(xs, ys);
  const resid = train.map((p, i) => ys[i]! - (intercept + slope * xs[i]!));
  const byCat = new Map<string, number[]>();
  train.forEach((p, i) => {
    const key = (p.category ?? 'Other').toLowerCase();
    const arr = byCat.get(key);
    if (arr) arr.push(resid[i]!);
    else byCat.set(key, [resid[i]!]);
  });
  const offsets = new Map<string, number>();
  for (const [key, rs] of byCat) {
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    const shrunk = (rs.length / (rs.length + model.offset_prior_weight)) * mean;
    offsets.set(key, Math.max(-model.offset_cap_dex, Math.min(model.offset_cap_dex, shrunk)));
  }
  const predictBase = (p: SnapshotProtocol): number => intercept + slope * Math.log10(p.tvl_usd);
  const predict = (p: SnapshotProtocol): number => predictBase(p) + (offsets.get((p.category ?? 'Other').toLowerCase()) ?? 0);
  return { intercept, slope, offsets, predict, predictBase };
}

/** Median absolute log error as a factor, and Spearman, of a curve on `test`. */
function oosMetrics(curve: SizeCurve, test: SnapshotProtocol[]): { factor: number; spearman: number } {
  const actual = test.map((p) => Math.log10(p.mcap_usd!));
  const pred = test.map((p) => curve.predict(p));
  const absErr = actual.map((a, i) => Math.abs(a - pred[i]!)).sort((a, b) => a - b);
  const med = absErr[Math.floor(absErr.length / 2)]!;
  return { factor: Math.pow(10, med), spearman: spearman(actual, pred) };
}

/** One variant's time-split score: median error factor and share within 2x, on the test set. */
function variantScore(actualLog: number[], predLog: number[]): { factor: number; within2: number } {
  const errs = actualLog.map((a, i) => Math.abs(a - predLog[i]!)).sort((a, b) => a - b);
  const med = errs.length > 0 ? errs[Math.floor(errs.length / 2)]! : 0;
  const within = errs.filter((e) => e <= Math.log10(2)).length;
  return { factor: Math.round(Math.pow(10, med) * 100) / 100, within2: Math.round((within / Math.max(1, errs.length)) * 100) / 100 };
}

/** The ablation table: four variants of the model, each scored on the same time-split test
    (fit on the older-listed comps, tested on the newer ones), so a reader can see what each
    part of the model earns. Flat multiple is the median market-cap-to-TVL ratio of the train
    set, times TVL. Size curve is the fitted power law without its category offsets. +sector
    adds the offsets. Full model adds growth and maturity on top. */
function ablationTable(older: SnapshotProtocol[], newer: SnapshotProtocol[], asOf: string, sigma: number, model: ModelConstants): { variant: string; factor: number; within2: number; n: number }[] {
  const trainCurve = fitCurve(older, model);
  const actual = newer.map((p) => Math.log10(p.mcap_usd!));
  const medianRatio = median(older.map((p) => p.mcap_usd! / p.tvl_usd));
  const flat = newer.map((p) => Math.log10(medianRatio * p.tvl_usd));
  const size = newer.map((p) => trainCurve.predictBase(p));
  const sector = newer.map((p) => trainCurve.predict(p));
  const full = newer.map((p) => Math.log10(expectedValue(p, asOf, trainCurve, sigma, model).implied));
  return [
    { variant: 'Flat multiple (median mcap / TVL)', ...variantScore(actual, flat), n: newer.length },
    { variant: 'Size curve, no sector offset', ...variantScore(actual, size), n: newer.length },
    { variant: '+ sector offsets', ...variantScore(actual, sector), n: newer.length },
    { variant: 'Full model (+ growth, + maturity)', ...variantScore(actual, full), n: newer.length },
  ];
}

/**
 * The fitted size curve and its tests, from the snapshot's own traded tokens. Deterministic:
 * folds are by slug order, the time split is by listed date, the bootstrap is seeded.
 * Also counts the peers' launch rates: for every mechanism and age band, how many of the
 * snapshot's protocols record a token, shrunk toward the global rate.
 */
export function fitSizeCurve(snapshot: Snapshot, model: ModelConstants = MODEL): FitStats {
  const comps = snapshot.protocols.filter(isComp).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const curve = fitCurve(comps, model);
  const ys = comps.map((p) => Math.log10(p.mcap_usd!));
  const meanY = ys.reduce((s, v) => s + v, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < comps.length; i++) {
    const e = ys[i]! - curve.predict(comps[i]!);
    ssRes += e * e;
    ssTot += (ys[i]! - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const sigma = Math.sqrt(ssRes / Math.max(1, comps.length - 3));

  // 5-fold out-of-sample, folds by slug order: each fold is tested by a curve that never saw it.
  const foldMetrics = [0, 1, 2, 3, 4].map((f) => {
    const test = comps.filter((_, i) => i % 5 === f);
    const train = comps.filter((_, i) => i % 5 !== f);
    return oosMetrics(fitCurve(train, model), test);
  });
  const oos5Factor = median(foldMetrics.map((m) => m.factor));
  const oos5Spearman = median(foldMetrics.map((m) => m.spearman));

  // Time-split out-of-sample: fit on the older-listed comps, test on the newer-listed ones,
  // the honest analogue of finding a future launch early.
  const dated = comps
    .filter((p) => p.listed_at !== null)
    .map((p) => ({ p, d: p.listed_at! }))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.p.slug < b.p.slug ? -1 : 1));
  const cut = dated.length > 0 ? dated[Math.floor(dated.length / 2)]!.d : null;
  const older = dated.filter((x) => cut !== null && x.d < cut).map((x) => x.p);
  const newer = dated.filter((x) => cut !== null && x.d >= cut).map((x) => x.p);
  const ts = newer.length > 0 && older.length > 0 ? oosMetrics(fitCurve(older, model), newer) : { factor: 0, spearman: 0 };

  // Ablation and scatter: the same time-split test scored by four variants, and the comps'
  // own points for the dashboard's chart. Both are computed here, from the same split, so
  // the numbers the page shows are the numbers the fit earned.
  const ablation = ablationTable(older, newer, snapshot.as_of, sigma, model);
  const scatter: [number, number][] = comps.map((p) => [p.tvl_usd, p.mcap_usd!] as [number, number]);

  // Bootstrap: resample the comps with replacement, refit, watch the slope move.
  const rng = mulberry32(model.bootstrap_seed);
  const slopes: number[] = [];
  for (let b = 0; b < model.bootstrap_runs; b++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    slopes.push(fitCurve(sample, model).slope);
  }
  const slopeMean = slopes.reduce((s, v) => s + v, 0) / slopes.length;
  const slopeSd = Math.sqrt(slopes.reduce((s, v) => s + (v - slopeMean) ** 2, 0) / slopes.length);
  const sortedSlopes = [...slopes].sort((a, b) => a - b);
  const slopeP5 = sortedSlopes[Math.floor(0.05 * sortedSlopes.length)]!;
  const slopeP95 = sortedSlopes[Math.floor(0.95 * sortedSlopes.length)]!;

  // The comps table: one row per category the board's protocols use, with its offset.
  const cats = new Set<string>();
  for (const p of snapshot.protocols) cats.add((p.category ?? 'Other').toLowerCase());
  const byCatRatios = new Map<string, number[]>();
  for (const p of comps) {
    const key = (p.category ?? 'Other').toLowerCase();
    const arr = byCatRatios.get(key);
    if (arr) arr.push(p.mcap_usd! / p.tvl_usd);
    else byCatRatios.set(key, [p.mcap_usd! / p.tvl_usd]);
  }
  const table: CompRow[] = [];
  for (const cat of [...cats].sort()) {
    const ratios = byCatRatios.get(cat) ?? [];
    table.push({
      category: cat,
      mechanism: mechanismOf(cat),
      live_count: ratios.length,
      median_multiple: ratios.length > 0 ? Math.round(median(ratios) * 1000) / 1000 : null,
      offset_dex: Math.round((curve.offsets.get(cat) ?? 0) * 1000) / 1000,
      offset_full_dex: curve.offsets.get(cat) ?? 0,
    });
  }
  const mechGroups = new Map<string, { n: number; offs: number[] }>();
  for (const row of table) {
    if (row.live_count === 0) continue;
    const g = mechGroups.get(row.mechanism);
    if (g) {
      g.n += row.live_count;
      g.offs.push(row.offset_dex);
    } else mechGroups.set(row.mechanism, { n: row.live_count, offs: [row.offset_dex] });
  }
  const mechanisms: MechanismRow[] = [...mechGroups.entries()]
    .map(([mechanism, g]) => ({ mechanism, live_count: g.n, median_offset_dex: Math.round(median(g.offs) * 1000) / 1000 }))
    .sort((a, b) => b.live_count - a.live_count);

  // The peers' launch rates: per mechanism and age band, the share of the snapshot's
  // protocols that record a token, shrunk toward the global rate so small groups do not
  // swing the number. Counted from the same sealed snapshot, never from a list of names.
  const globalTokened = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const globalRate = snapshot.protocols.length > 0 ? globalTokened / snapshot.protocols.length : 0;
  const peerGroups = new Map<string, { tokened: number; n: number; mechanism: string; age_band: string }>();
  for (const p of snapshot.protocols) {
    const key = `${mechanismOf(p.category)}|${ageBandOf(ageDays(snapshot.as_of, p.listed_at))}`;
    const g = peerGroups.get(key);
    if (g) {
      g.n += 1;
      if (!isPreToken(p)) g.tokened += 1;
    } else {
      peerGroups.set(key, { tokened: isPreToken(p) ? 0 : 1, n: 1, mechanism: mechanismOf(p.category), age_band: ageBandOf(ageDays(snapshot.as_of, p.listed_at)) });
    }
  }
  const peerRates: PeerRateRow[] = [...peerGroups.values()]
    .map((g) => ({
      mechanism: g.mechanism,
      age_band: g.age_band,
      protocols: g.n,
      tokened: g.tokened,
      peer_rate: Math.round(((g.tokened + model.peer_prior_count * globalRate) / (g.n + model.peer_prior_count)) * 1000) / 1000,
    }))
    .sort((a, b) => a.mechanism.localeCompare(b.mechanism) || a.age_band.localeCompare(b.age_band));

  return {
    comps_n: comps.length,
    comps_rule: 'Traded protocols, excluding exchange, bridge and chain tokens and versioned or wrapped products.',
    slope: Math.round(curve.slope * 10000) / 10000,
    intercept: Math.round(curve.intercept * 10000) / 10000,
    slope_full: curve.slope,
    intercept_full: curve.intercept,
    r2: Math.round(r2 * 1000) / 1000,
    sigma_dex: Math.round(sigma * 1000) / 1000,
    band_factor: Math.round(Math.pow(10, sigma) * 100) / 100,
    oos_5fold_factor: Math.round(oos5Factor * 100) / 100,
    oos_5fold_spearman: Math.round(oos5Spearman * 1000) / 1000,
    timesplit_cut: cut,
    timesplit_n_train: older.length,
    timesplit_n_test: newer.length,
    timesplit_factor: Math.round(ts.factor * 100) / 100,
    timesplit_spearman: Math.round(ts.spearman * 1000) / 1000,
    bootstrap_runs: model.bootstrap_runs,
    bootstrap_slope_mean: Math.round(slopeMean * 10000) / 10000,
    bootstrap_slope_sd: Math.round(slopeSd * 10000) / 10000,
    bootstrap_slope_p5: Math.round(slopeP5 * 10000) / 10000,
    bootstrap_slope_p95: Math.round(slopeP95 * 10000) / 10000,
    top10_stability: [],
    verdict_counts: { farm: 0, thin: 0, skip: 0 },
    ablation,
    scatter,
    comps: table,
    mechanisms,
    peer_rates: peerRates,
  };
}

/**
 * The chance a category's protocols ever issue a token, as a stated judgement by category
 * only. Tokens are the norm for exchanges, lenders and yield products; a payment network or
 * a chain that moves other people's assets has far less reason to issue one. The dashboard
 * lists this table beside the formula, so the judgement is visible, not hidden.
 */
export function launchLikelihood(category: string | null): number {
  const c = (category ?? '').toLowerCase();
  if (c.includes('dex') || c.includes('lending') || c.includes('yield') || c.includes('derivative') || c.includes('perpetual') || c.includes('prediction') || c.includes('leveraged farm') || c.includes('liquidity manager')) return 0.85;
  if (c.includes('curator') || c.includes('allocator') || c.includes('indexes') || c.includes('launchpad')) return 0.8;
  if (c.includes('rwa') || c.includes('basis trading') || c.includes('cdp') || c.includes('stablecoin')) return 0.75;
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking pool') || c.includes('insurance') || c.includes('cedefi') || c.includes('collateral')) return 0.65;
  if (c.includes('chain') || c.includes('payments') || c.includes('governance incentives') || c.includes('bridge')) return 0.5;
  return 0.7;
}

/** A protocol's peer launch rate: the shrunk share of its mechanism-and-age peers that record a token. */
export function peerLaunchRate(protocol: SnapshotProtocol, asOf: string, peerRates: PeerRateRow[], model: ModelConstants = MODEL): { rate: number; n: number } {
  const mech = mechanismOf(protocol.category);
  const band = ageBandOf(ageDays(asOf, protocol.listed_at));
  const row = peerRates.find((r) => r.mechanism === mech && r.age_band === band);
  if (row) return { rate: row.peer_rate, n: row.protocols };
  return { rate: 0.5, n: 0 };
}

/** The multipliers and the expected value one protocol gets under `model`. */
export function expectedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  curve: SizeCurve,
  sigma: number,
  model: ModelConstants,
): { fitted: number; baseFitted: number; implied: number; lowImplied: number; highImplied: number; expected: number; lowExpected: number; likelihood: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const fitted = Math.max(1, Math.round(Math.pow(10, curve.predict(protocol))));
  const baseFitted = Math.max(1, Math.round(Math.pow(10, curve.predictBase(protocol))));
  const implied = Math.max(1, Math.round(fitted * growthMult * maturityMult));
  const band = Math.pow(10, sigma);
  const lowImplied = Math.max(1, Math.round(implied / band));
  const highImplied = Math.max(1, Math.round(implied * band));
  const likelihood = launchLikelihood(protocol.category);
  const expected = Math.max(1, Math.round(implied * likelihood));
  const lowExpected = Math.max(1, Math.round(lowImplied * likelihood));
  return { fitted, baseFitted, implied, lowImplied, highImplied, expected, lowExpected, likelihood, growthPct, growthMult, maturityMult, age };
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The watchlist rule's own excluded categories, as RULES.txt states them. */
const WATCHLIST_EXCLUDED_CATEGORIES = new Set(['bridge', 'canonical bridge', 'liquid staking', 'liquid restaking', 'restaked btc', 'cex']);

/** Exchange names the watchlist rule keeps off the list. */
const EXCHANGE_NAMES = ['binance', 'coinbase', 'bybit', 'kraken', 'bitget', 'okx', 'bitfinex', 'gemini'];

/** Bridge and liquid-staking categories, for the disposition strip. */
const BRIDGE_CATEGORIES = new Set(['bridge', 'canonical bridge', 'cross chain bridge']);
const LST_CATEGORIES = new Set(['liquid staking', 'liquid restaking', 'restaked btc']);

/** Whether a protocol passes the watchlist rule's exclusions: not a bridge, staking or
    exchange product, not a versioned pool, not a wrapped or staked product, and not an
    exchange's own name. */
export function passesWatchlistRule(p: SnapshotProtocol): boolean {
  if (WATCHLIST_EXCLUDED_CATEGORIES.has((p.category ?? '').toLowerCase())) return false;
  if (VERSIONED.test(p.name)) return false;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return false;
  const name = p.name.toLowerCase();
  if (EXCHANGE_NAMES.some((e) => name.startsWith(e))) return false;
  return true;
}

/** Whether a protocol is an off-list launch candidate: pre-token, above the watchlist floor,
    not on the watchlist, and passing the watchlist rule's exclusions. */
export function isOffList(p: SnapshotProtocol, watchlist: Set<string>, floorUsd: number): boolean {
  return isPreToken(p) && !watchlist.has(p.slug) && p.tvl_usd >= floorUsd && passesWatchlistRule(p);
}

/** The snapshot's accounting: which protocols the board ranks, and why each other one is set
    aside. Groups are checked in this order, so each protocol lands in exactly one. */
export function dispositionCounts(snapshot: Snapshot, boardSlugs: Set<string>): Disposition {
  const d: Disposition = { ranked: 0, tokened: 0, bridge: 0, lst: 0, exchange: 0, versioned_wrapped: 0, below_cut: 0, total: snapshot.protocols.length };
  for (const p of snapshot.protocols) {
    if (boardSlugs.has(p.slug)) { d.ranked++; continue; }
    if (!isPreToken(p)) { d.tokened++; continue; }
    const cat = (p.category ?? '').toLowerCase();
    if (BRIDGE_CATEGORIES.has(cat)) { d.bridge++; continue; }
    if (LST_CATEGORIES.has(cat)) { d.lst++; continue; }
    if (cat === 'cex' || EXCHANGE_NAMES.some((e) => p.name.toLowerCase().startsWith(e))) { d.exchange++; continue; }
    if (VERSIONED.test(p.name) || /\b(wrapped|staked|staking)\b/i.test(p.name)) { d.versioned_wrapped++; continue; }
    d.below_cut++;
  }
  return d;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const fit = fitSizeCurve(snapshot, model);
  const curve = fitCurve(snapshot.protocols.filter(isComp).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)), model);
  return scoreBoard(snapshot, curve, fit.sigma_dex, model, fit);
}

/** Largest first by TVL, ties by slug: the board's selection order. */
function byTvlDesc(a: SnapshotProtocol, b: SnapshotProtocol): number {
  return b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
}

/** Score the chosen protocols with one fitted curve and rank them by expected value.
    The board is 198 rows: the 40 watchlist protocols, the 20 off-list launch candidates
    above the floor, and the 138 largest pre-token protocols below the floor. */
export function scoreBoard(snapshot: Snapshot, curve: SizeCurve, sigma: number, model: ModelConstants, fit: FitStats): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it
  // cannot, but the board's coverage is the gate's row and is never gambled on a missing
  // record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Off-list: the largest pre-token protocols above the floor that the watchlist leaves
  // out and that pass its own exclusions. These are the launches the radar exists to find
  // early, and the board's biggest gap in radar-3 was leaving them out entirely.
  const offList = snapshot.protocols.filter((p) => isOffList(p, watch, snapshot.floor_usd)).sort(byTvlDesc).slice(0, OFFLIST_ROWS);
  for (const p of offList) chosen.set(p.slug, p);
  // Below the floor: the largest rankable pre-token protocols, capped so the board holds
  // 198 rows in all. Never a replacement for a watchlist row: a chosen protocol stays chosen.
  const below = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort(byTvlDesc)
    .slice(0, BELOW_FLOOR_ROWS);
  for (const p of below) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = expectedValue(p, snapshot.as_of, curve, sigma, model);
    const peer = peerLaunchRate(p, snapshot.as_of, fit.peer_rates, model);
    return { p, v, peer, econ: farmEconomics(p, v.age, v.lowExpected, model) };
  });
  scored.sort((a, b) => b.v.expected - a.v.expected || b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const counts = { farm: 0, thin: 0, skip: 0 };
  const rows = scored.map((s, i) => {
    counts[s.econ.verdict]++;
    const multiple = Math.round((s.v.fitted / s.p.tvl_usd) * 1000) / 1000;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      mechanism: mechanismOf(s.p.category),
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.v.age,
      implied_value_usd: s.v.expected,
      raw_implied_value_usd: s.v.implied,
      low_implied_value_usd: s.v.lowImplied,
      high_implied_value_usd: s.v.highImplied,
      low_expected_value_usd: s.v.lowExpected,
      launch_likelihood: s.v.likelihood,
      peer_launch_rate: s.peer.rate,
      peer_rate_n: s.peer.n,
      fitted_value_usd: s.v.fitted,
      base_fitted_value_usd: s.v.baseFitted,
      comp_multiple: multiple,
      farm_difficulty: farmDifficulty(s.p),
      farm_verdict: s.econ.verdict,
      farm: s.econ,
      model: {
        comp_multiple: multiple,
        growth_pct: s.v.growthPct,
        growth_multiplier: s.v.growthMult,
        maturity_multiplier: s.v.maturityMult,
        launch_likelihood: s.v.likelihood,
        peer_launch_rate: s.peer.rate,
        age_days: s.v.age,
      },
      farm_steps: farmSteps(s.p, s.v.age, s.econ).map(stepText),
    } as BoardRow;
  });
  fit.verdict_counts = counts;
  return rows;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Gas for one transaction on a chain: cheap L2s and fast L1s cost cents, Ethereum costs dollars. */
function gasTier(chain: string): { label: string; tx: string; weekly: string } {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return { label: 'Ethereum mainnet gas', tx: 'about $4 of gas', weekly: 'about $4 of gas a week' };
  if (c === 'bitcoin' || c === 'tron' || c === 'bsquared' || c === 'core' || c === 'babylon genesis') {
    return { label: 'costly-chain gas', tx: 'about $2 of gas', weekly: 'about $2 of gas a week' };
  }
  return { label: 'low-fee chain gas', tx: 'under $0.50 of gas', weekly: 'under $0.50 of gas a week' };
}

/** The same tiers as numbers, for the farm plan's dollar netting. */
export function gasTierUsd(chain: string): { tx: number; weekly: number } {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return { tx: 4, weekly: 4 };
  if (c === 'bitcoin' || c === 'tron' || c === 'bsquared' || c === 'core' || c === 'babylon genesis') return { tx: 2, weekly: 2 };
  return { tx: 0.5, weekly: 0.5 };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * A farm plan's dollar netting at the band's low end. The pool is 10% of implied value (A1),
 * the farmed TVL is 1% of the protocol's TVL (A2), a position earns its share of that pool
 * (A3), and idle capital costs 5% a year (A4). Net = low-end expected farmer value - cost.
 * Net per hour divides the net by the hours the plan actually takes: set-up plus one
 * weekly action plus the hold, so a reader can compare farms by the hour.
 */
export function farmEconomics(p: SnapshotProtocol, age: number | null, lowExpected: number, model: ModelConstants = MODEL): FarmEconomics {
  const capital = capitalFor(p);
  const gas = gasTierUsd(chainOf(p));
  const hold = holdDaysFor(age);
  const weeks = Math.ceil(hold / 7);
  const gasUsd = Math.round((gas.tx + gas.weekly * weeks) * 100) / 100;
  const oppUsd = Math.round(capital * model.opp_rate_yr * (hold / 365) * 100) / 100;
  const totalCost = Math.max(1, Math.round(gasUsd + oppUsd));
  const grossLow = Math.max(0, Math.round(lowExpected * model.pool_share * capital / (model.farmed_share * p.tvl_usd)));
  const netLow = grossLow - totalCost;
  const hours = 0.5 + weeks * (10 / 60) + 0.25;
  const netPerHour = Math.round((netLow / hours) * 100) / 100;
  const verdict = netLow >= model.farm_threshold_usd ? 'farm' : netLow >= 0 ? 'thin' : 'skip';
  return { capital_usd: capital, gas_usd: gasUsd, opp_usd: oppUsd, total_cost_usd: totalCost, gross_low_usd: grossLow, net_low_usd: netLow, net_per_hour_usd: netPerHour, verdict };
}

/** How hard the farm is: derivatives and bridges on mainnet are the most demanding. */
export function farmDifficulty(p: SnapshotProtocol): 'Easy' | 'Moderate' | 'Advanced' {
  const c = (p.category ?? '').toLowerCase();
  const mainnetOnly = p.chains.length > 0 && p.chains.every((ch) => ch.toLowerCase() === 'ethereum');
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('leveraged farm') || c.includes('bridge')) return 'Advanced';
  if (mainnetOnly || c.includes('rwa') || c.includes('insurance') || c.includes('basis trading')) return 'Moderate';
  return 'Easy';
}

/** The category's core action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC through ${name} on ${chain}, then borrow $10 back so the wallet is active on both sides of the market.`;
  if (c.includes('curator') || c.includes('allocator')) return `Put $${capital} of USDC into a ${name} vault on ${chain} and keep the vault shares; curators count vault balances when they snapshot.`;
  if (c.includes('dex')) return `Add $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position inside its range.`;
  if (c.includes('yield') || c.includes('leveraged farm')) return `Place $${capital} of USDC in ${name}'s largest strategy on ${chain} and let it compound instead of withdrawing.`;
  if (c.includes('bridge')) return `Move $${capital} of USDC to ${chain} with ${name}, then spend the bridged funds inside its app rather than bridging straight back.`;
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking pool')) return `Stake $${capital} of the chain's staking asset via ${name} and hold the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Post $${capital} of USDC as margin on ${name} and open one small hedged trade, then close it inside the same week.`;
  if (c.includes('prediction')) return `Fund ${name} with $${capital} and take one market position, then leave any winnings in the account.`;
  if (c.includes('rwa')) return `Buy $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it through one full payout cycle.`;
  if (c.includes('stable')) return `Mint or hold $${capital} of the stable asset through ${name} on ${chain} and leave the balance alone.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy live for its whole term.`;
  if (c.includes('basis trading')) return `Place $${capital} of USDC in ${name}'s basis vault on ${chain} and hold the shares through one funding cycle.`;
  if (c.includes('chain')) return `Bridge $${capital} to ${chain} through ${name}'s own bridge and use the chain's main app once a week.`;
  if (c.includes('payments')) return `Pay $${capital} through ${name} once a week with a real payment, and keep the wallet funded in between.`;
  return `Put $${capital} of USDC to work in ${name} on ${chain} and leave the position open.`;
}

/** The category's weekly qualifying action. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Nudge the supply or the borrow a little every week, so the position keeps showing fresh activity.`;
  if (c.includes('curator') || c.includes('allocator')) return `Add a small amount to the vault, or move between two of ${name}'s vaults, once a week.`;
  if (c.includes('dex')) return `Swap a small amount through ${name}'s main pool once a week, on top of the liquidity position.`;
  if (c.includes('yield') || c.includes('leveraged farm')) return `Claim the yield once a week and put it back in, rather than leaving it unclaimed.`;
  if (c.includes('bridge')) return `Bridge a small amount through ${name} once a week instead of once and never again.`;
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking pool')) return `Look at the staking rewards once a week and restake them instead of withdrawing.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Open and close one small position a week, keeping the margin deposited all along.`;
  if (c.includes('prediction')) return `Take one small market position a week and let the earlier ones settle.`;
  if (c.includes('rwa')) return `Leave the yield asset where it is and confirm each payout arrives in the same wallet.`;
  if (c.includes('stable')) return `Keep the stable balance in place and open the protocol's app once a week.`;
  if (c.includes('insurance')) return `Keep the policy live and check once a week that it still covers the position.`;
  if (c.includes('basis trading')) return `Leave the vault shares in place and check the funding rate once a week.`;
  if (c.includes('chain')) return `Use the chain's main app once a week so the wallet shows repeat activity.`;
  if (c.includes('payments')) return `Send one small real payment a week instead of a single large one.`;
  return `Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`;
}

/** The category's points check, for the step before withdrawing. */
function pointsFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('curator') || c.includes('allocator')) return `Open ${p.name}'s vault page and confirm the vault shares and any points balance before moving anything.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Open the protocol's rewards page and check that the supply and the borrow both counted before repaying.`;
  if (c.includes('dex')) return `Open the protocol's rewards page and check that the liquidity position and the swaps both counted.`;
  if (c.includes('restak') || c.includes('liquid staking') || c.includes('staking pool')) return `Check that the receipt token and the staking rewards sit in the same wallet before unstaking.`;
  if (c.includes('rwa')) return `Check that the payouts for the full holding period arrived before redeeming the asset.`;
  return `Open the protocol's own points or rewards page and claim only from the link it publishes.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, the last the
 * plan's dollar netting at the band's low end with its verdict. The plan is derived from
 * the protocol's own record (category, chains, TVL, age) and the fitted value band, never
 * from a hand-written list of names: the same function plans every row.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: FarmEconomics): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasTier(chain);
  const capital = econ.capital_usd;
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const verdictWord = econ.verdict === 'farm' ? 'FARM' : econ.verdict === 'thin' ? 'THIN' : 'SKIP';
  const netWord = econ.net_low_usd >= 0 ? `+$${econ.net_low_usd}` : `-$${-econ.net_low_usd}`;
  return [
    {
      text: `Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `${gas.tx} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas.tx}`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyFor(p),
      cost: gas.weekly,
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `${pointsFor(p)} Never pay to claim, and never follow a claim link from a chat or a comment.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Netting at the low end of the value band: a $${capital} position is expected to earn $${econ.gross_low_usd} gross from the launch pool, farm costs are $${econ.total_cost_usd}, net ${netWord} (${econ.net_per_hour_usd >= 0 ? '+' : ''}$${econ.net_per_hour_usd} per hour) — verdict: ${verdictWord}. The pool is 10% of implied value and farmed TVL is 1% of protocol TVL; both are stated assumptions, not facts.`,
      cost: `$${econ.total_cost_usd} in total farm costs`,
      time: `${hold} days of holding`,
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      mcap_tvl_ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? Math.round((p.mcap_usd / p.tvl_usd) * 1000) / 1000 : null,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    mechanism: row.mechanism,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    raw_implied_value_usd: row.raw_implied_value_usd,
    low_implied_value_usd: row.low_implied_value_usd,
    high_implied_value_usd: row.high_implied_value_usd,
    low_expected_value_usd: row.low_expected_value_usd,
    launch_likelihood: row.launch_likelihood,
    peer_launch_rate: row.peer_launch_rate,
    peer_rate_n: row.peer_rate_n,
    comp_multiple: row.comp_multiple,
    fitted_value_usd: row.fitted_value_usd,
    base_fitted_value_usd: row.base_fitted_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    farm_difficulty: row.farm_difficulty,
    farm_verdict: row.farm_verdict,
    farm: row.farm,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const fit = fitSizeCurve(snapshot, model);
  const curve = fitCurve(snapshot.protocols.filter(isComp).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)), model);
  const board = scoreBoard(snapshot, curve, fit.sigma_dex, model, fit);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const offlist = board.filter((r) => !snapshot.watchlist.includes(r.slug) && r.tvl_usd >= snapshot.floor_usd).length;
  const disposition = dispositionCounts(snapshot, new Set(board.map((r) => r.slug)));

  // Bootstrap rank stability: refit the curve on 200 seeded resamples of the comps and
  // count how often each of the board's top ten stays in the top ten.
  const comps = snapshot.protocols.filter(isComp).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const top10 = board.slice(0, 10).map((r) => r.slug);
  const stays = new Map<string, number>(top10.map((s) => [s, 0]));
  const rng = mulberry32(model.bootstrap_seed + 7);
  const candidates = board.map((r) => snapshot.protocols.find((p) => p.slug === r.slug)!);
  for (let b = 0; b < model.bootstrap_runs; b++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    const bootCurve = fitCurve(sample, model);
    const scored = candidates
      .map((p) => ({ slug: p.slug, v: expectedValue(p, snapshot.as_of, bootCurve, fit.sigma_dex, model) }))
      .sort((a, b2) => b2.v.expected - a.v.expected || (a.slug < b2.slug ? -1 : 1))
      .slice(0, 10)
      .map((s) => s.slug);
    for (const s of scored) if (stays.has(s)) stays.set(s, stays.get(s)! + 1);
  }
  fit.top10_stability = board.slice(0, 10).map((r) => ({
    slug: r.slug,
    name: r.name,
    stability: Math.round((stays.get(r.slug)! / model.bootstrap_runs) * 100) / 100,
  }));

  const integrity: Integrity = {
    snapshot_as_of: snapshot.as_of,
    snapshot_source_short: 'DefiLlama protocol index',
    protocols_count: snapshot.protocols.length,
    watchlist_count: snapshot.watchlist.length,
    watchlist_covered: board.filter((r) => snapshot.watchlist.includes(r.slug)).length,
    board_rows: board.length,
    offlist_rows: offlist,
    gate_self_check: boardIssue(board, snapshot) === null ? 'board self-check passed' : 'board self-check FAILED',
  };

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    offlist_size: offlist,
    live_size: live.length,
    total_expected_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    total_tvl_usd: board.reduce((n, r) => n + r.tvl_usd, 0),
    disposition,
    integrity,
    watchlist: snapshot.watchlist,
    comps: fit.comps,
    fit,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** A snapshot parsing error. */
export class SnapshotError extends Error {}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** The fit report the dashboard carries as method.md, written from the computed fit. */
export function methodReport(radar: RadarData): string {
  const f = radar.fit;
  const lines: string[] = [
    `# The Launch Ledger: how the ${radar.model_version} model works`,
    ``,
    `This file is written by main.ts from the fit it computed on the sealed snapshot, so`,
    `every number here is the number the board and the dashboard render. Nothing is`,
    `hand-typed. Snapshot ${radar.as_of} from the DefiLlama protocol index; model ${radar.model_version}.`,
    ``,
    `## The size curve`,
    ``,
    `The implied value of a launch is fitted, not assumed. The curve is a power law on the`,
    `${f.comps_n} traded tokens that are comparable launches: ${f.comps_rule}`,
    ``,
    `    log10(market cap) = ${f.intercept} + ${f.slope} x log10(TVL) + category offset`,
    ``,
    `The offset is the category's own premium or discount: the mean residual of its comps,`,
    `shrunk toward zero by sample size and capped at +/-0.3 dex. Fitted value is then`,
    `multiplied by a growth multiplier (1 + clamped 7-day change / 100 x ${radar.model.growth_weight}),`,
    `a maturity multiplier (${radar.model.maturity_floor} + min(age, ${radar.model.maturity_days} days) / ${radar.model.maturity_days} x ${radar.model.maturity_range}),`,
    `and a launch likelihood by category, to give the expected value the board ranks by.`,
    ``,
    `## How well the curve fits`,
    ``,
    `- In-sample R-squared: ${f.r2} on ${f.comps_n} comps; residual scatter sigma = ${f.sigma_dex} dex.`,
    `- Value band: the fitted value divided and multiplied by ${f.band_factor} (10^sigma).`,
    `- Out-of-sample, 5-fold (folds by slug order, each fold tested by a curve that never saw it):`,
    `  median error factor x${f.oos_5fold_factor}, Spearman rank correlation ${f.oos_5fold_spearman}.`,
    `- Out-of-sample, time-split (fit on the ${f.timesplit_n_train} comps listed before ${f.timesplit_cut},`,
    `  tested on the ${f.timesplit_n_test} listed on or after it): median error factor x${f.timesplit_factor},`,
    `  Spearman ${f.timesplit_spearman}. This is the honest analogue of finding a future launch early.`,
    `- Bootstrap (${f.bootstrap_runs} seeded resamples of the comps): slope mean ${f.bootstrap_slope_mean},`,
    `  standard deviation ${f.bootstrap_slope_sd}, 5th to 95th percentile ${f.bootstrap_slope_p5} to ${f.bootstrap_slope_p95}.`,
    `- Top-ten rank stability (share of bootstrap refits in which the row stays top ten):`,
    ...f.top10_stability.map((t) => `  rank ${radar.rows.find((r) => r.slug === t.slug)?.rank ?? '?'} ${t.name}: ${Math.round(t.stability * 100)}%`),
    ``,
    `## Ablation: what each part earns`,
    ``,
    `Same time-split test as above, four variants:`,
    ...f.ablation.map((a) => `- ${a.variant}: x${a.factor}, ${Math.round(a.within2 * 100)}% within 2x (${a.n} tested).`),
    ``,
    `## The peers' launch rate`,
    ``,
    `Beside the launch chance, each row shows the peers' own rate: the share of protocols`,
    `in the same mechanism and age band that record a token, counted from this snapshot`,
    `and shrunk toward the global token rate. It is a second opinion, not the multiplier:`,
    `the board ranks by fitted value times the stated category likelihood.`,
    ...f.peer_rates
      .filter((r) => r.protocols >= 10)
      .map((r) => `- ${r.mechanism}, ${r.age_band}: ${r.tokened} of ${r.protocols} record a token (${Math.round(r.peer_rate * 100)}%).`),
    ``,
    `## Coverage`,
    ``,
    `Board: ${radar.board_size} rows (${radar.watchlist_size} watchlist, ${radar.offlist_size} off-list above the floor, ${radar.board_size - radar.watchlist_size - radar.offlist_size} below it).`,
    `Set aside, of ${radar.disposition.total}: ${radar.disposition.tokened} already record a token, ${radar.disposition.bridge} bridges, ${radar.disposition.lst} liquid staking/restaking,`,
    `${radar.disposition.exchange} exchanges, ${radar.disposition.versioned_wrapped} versioned or wrapped, ${radar.disposition.below_cut} pre-token below the cut.`,
    ``,
    `## Mechanisms`,
    ``,
    `Categories are grouped by mechanism, and each mechanism's offset is its categories'`,
    `median fitted offset:`,
    ...f.mechanisms.map((m) => `- ${m.mechanism}: ${m.live_count} comp${m.live_count === 1 ? '' : 's'}, median offset ${m.median_offset_dex > 0 ? '+' : ''}${m.median_offset_dex} dex.`),
    ``,
    `## Farm plans, netted to the dollar`,
    ``,
    `Every plan is netted at the low end of the value band, under four stated assumptions:`,
    `A1 the launch's airdrop pool is ${Math.round(radar.model.pool_share * 100)}% of implied value; A2 the farmed TVL is`,
    `${Math.round(radar.model.farmed_share * 100)}% of the protocol's TVL; A3 a position earns its share of that pool;`,
    `A4 idle capital costs ${Math.round(radar.model.opp_rate_yr * 100)}% a year. Net = low-end expected farmer value - farm`,
    `cost (gas plus opportunity cost). Net per hour divides the net by the hours the plan`,
    `takes (set-up plus one weekly action plus the hold). Verdict: FARM at net $${radar.model.farm_threshold_usd} or more, THIN from $0 to`,
    `$${radar.model.farm_threshold_usd - 1}, SKIP below $0. Verdicts on this board: ${f.verdict_counts.farm} farm,`,
    `${f.verdict_counts.thin} thin, ${f.verdict_counts.skip} skip.`,
    ``,
    `The biggest launches are often the worst farms per dollar: a large protocol's pool is`,
    `split over far more farmed TVL, so a small position's share shrinks while its gas stays.`,
    `That is why the top of the board by expected value is mostly THIN and SKIP, and the`,
    `FARM verdicts sit further down, where a position is a meaningful share of the pool.`,
    ``,
  ];
  return lines.join('\n');
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
