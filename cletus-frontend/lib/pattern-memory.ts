/**
 * Pattern memory — self-learning signal weight engine.
 *
 * Signal weights start at the values configured in env vars (or sensible
 * defaults). After every closed trade, the weights of the signals that were
 * active at entry are updated via an exponential moving average:
 *
 *   new_weight = old_weight * (1 - ALPHA) + outcome * ALPHA
 *
 * where outcome = 1.0 for a win and 0.0 for a loss. This causes winning
 * signals to be amplified and losing signals to be dampened over time.
 *
 * Weights are normalised after each update so they always sum to 1.0.
 */

import type { SignalBreakdown } from '@/types';

// ── EMA smoothing factor ──────────────────────────────────────────────────────

const ALPHA = 0.05; // 5% weight toward each new outcome

// ── Signal names ──────────────────────────────────────────────────────────────

type SignalName = keyof SignalBreakdown;

const SIGNAL_NAMES: SignalName[] = [
  'volumeSpike',
  'momentum',
  'breakout',
  'rsiScore',
  'macdCross',
  'holderGrowth',
  'liquidityScore',
  'socialSentiment',
];

// ── Default weights (from env or hard-coded defaults) ─────────────────────────

function loadDefaultWeights(): Record<SignalName, number> {
  return {
    volumeSpike:     parseFloat(process.env.SIGNAL_VOLUME_SPIKE_WEIGHT ?? '0.15'),
    momentum:        parseFloat(process.env.SIGNAL_MOMENTUM_WEIGHT ?? '0.15'),
    breakout:        parseFloat(process.env.SIGNAL_BREAKOUT_WEIGHT ?? '0.12'),
    rsiScore:        parseFloat(process.env.SIGNAL_RSI_WEIGHT ?? '0.12'),
    macdCross:       parseFloat(process.env.SIGNAL_MACD_WEIGHT ?? '0.12'),
    holderGrowth:    parseFloat(process.env.SIGNAL_HOLDER_GROWTH_WEIGHT ?? '0.15'),
    liquidityScore:  parseFloat(process.env.SIGNAL_LIQUIDITY_BUILD_WEIGHT ?? '0.10'),
    socialSentiment: parseFloat(process.env.SIGNAL_SOCIAL_WEIGHT ?? '0.09'),
  };
}

// ── Mutable weight state ──────────────────────────────────────────────────────

let weights: Record<SignalName, number> = loadDefaultWeights();

// Running win-rate per signal for diagnostics
const signalWins: Record<SignalName, number> = Object.fromEntries(
  SIGNAL_NAMES.map((n) => [n, 0]),
) as Record<SignalName, number>;

const signalTrials: Record<SignalName, number> = Object.fromEntries(
  SIGNAL_NAMES.map((n) => [n, 0]),
) as Record<SignalName, number>;

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalise(w: Record<SignalName, number>): Record<SignalName, number> {
  const total = SIGNAL_NAMES.reduce((s, k) => s + w[k], 0);
  if (total === 0) return loadDefaultWeights();
  return Object.fromEntries(
    SIGNAL_NAMES.map((k) => [k, w[k] / total]),
  ) as Record<SignalName, number>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return the current (learned) signal weights. */
export function getWeights(): Record<SignalName, number> {
  return { ...weights };
}

/**
 * Compute a composite score for a signal breakdown using the learned weights.
 * Result is in [0, 1].
 */
export function applyWeights(breakdown: SignalBreakdown): number {
  const w = weights;
  return (
    breakdown.volumeSpike     * w.volumeSpike +
    breakdown.momentum        * w.momentum +
    breakdown.breakout        * w.breakout +
    breakdown.rsiScore        * w.rsiScore +
    breakdown.macdCross       * w.macdCross +
    breakdown.holderGrowth    * w.holderGrowth +
    breakdown.liquidityScore  * w.liquidityScore +
    breakdown.socialSentiment * w.socialSentiment
  );
}

/**
 * Update signal weights based on a trade outcome.
 *
 * @param breakdown - Signal breakdown at trade entry
 * @param won       - True if the trade was profitable
 */
export function recordOutcome(breakdown: SignalBreakdown, won: boolean): void {
  const outcome = won ? 1.0 : 0.0;

  for (const name of SIGNAL_NAMES) {
    const signalStrength = breakdown[name];
    // Only update for signals that were meaningfully active (>10%)
    if (signalStrength > 0.1) {
      weights[name] = weights[name] * (1 - ALPHA) + outcome * ALPHA;
      signalTrials[name]++;
      if (won) signalWins[name]++;
    }
  }

  weights = normalise(weights);
}

/** Return per-signal win-rate diagnostics (for monitoring). */
export function getSignalStats(): Array<{
  signal: string;
  weight: number;
  winRate: number | null;
  trials: number;
}> {
  return SIGNAL_NAMES.map((name) => ({
    signal: name,
    weight: parseFloat(weights[name].toFixed(4)),
    winRate:
      signalTrials[name] > 0
        ? parseFloat((signalWins[name] / signalTrials[name]).toFixed(3))
        : null,
    trials: signalTrials[name],
  }));
}

/** Reset weights back to env-configured defaults. */
export function resetWeights(): void {
  weights = loadDefaultWeights();
  for (const name of SIGNAL_NAMES) {
    signalWins[name] = 0;
    signalTrials[name] = 0;
  }
}
