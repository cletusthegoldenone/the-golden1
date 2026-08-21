import { NextResponse } from 'next/server';

// ── Shared DexScreener types ───────────────────────────────────────────────────
interface DexPair {
  chainId: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  priceChange: { m5?: number; h1?: number; h24?: number };
  volume: { m5?: number; h1?: number; h24?: number };
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  txns?: { m5?: { buys: number; sells: number } };
}

interface DexBoost {
  chainId: string;
  tokenAddress: string;
}

// ── Simple in-memory cache ────────────────────────────────────────────────────
let cachedSignals: ReturnType<typeof buildSignals> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 20_000;

// ── Signal construction ────────────────────────────────────────────────────────
function buildBreakdown(pair: DexPair) {
  const change5m = Math.max(0, pair.priceChange?.m5 ?? 0) / 20;
  const change1h = Math.max(0, pair.priceChange?.h1 ?? 0) / 50;
  const vol5m = pair.volume?.m5 ?? 0;
  const mcap = pair.marketCap ?? pair.fdv ?? 0;
  const liq = pair.liquidity?.usd ?? 0;
  const m5txns = pair.txns?.m5;

  const volumeSpike = mcap > 0 ? Math.min(1, (vol5m / mcap) * 5) : 0.3;
  const momentum = Math.min(1, change5m + change1h * 0.5);
  const breakout = Math.min(1, (pair.priceChange?.h1 ?? 0) > 10 ? 0.8 : (pair.priceChange?.h1 ?? 0) > 5 ? 0.55 : 0.3);
  const liquidityScore = Math.min(1, liq / 200_000);
  const buyRatio =
    m5txns && m5txns.buys + m5txns.sells > 0
      ? m5txns.buys / (m5txns.buys + m5txns.sells)
      : 0.5;
  const holderGrowth = buyRatio > 0.65 ? 0.75 : buyRatio > 0.5 ? 0.5 : 0.3;

  return {
    volumeSpike: parseFloat(volumeSpike.toFixed(3)),
    momentum: parseFloat(momentum.toFixed(3)),
    breakout: parseFloat(breakout.toFixed(3)),
    rsiScore: parseFloat(Math.min(1, Math.max(0, 0.3 + momentum * 0.7)).toFixed(3)),
    macdCross: parseFloat(Math.min(1, breakout * 0.8 + volumeSpike * 0.2).toFixed(3)),
    holderGrowth: parseFloat(holderGrowth.toFixed(3)),
    liquidityScore: parseFloat(liquidityScore.toFixed(3)),
    socialSentiment: parseFloat((0.4 + holderGrowth * 0.4 + volumeSpike * 0.2).toFixed(3)),
  };
}

function pairToSignal(pair: DexPair, index: number) {
  const breakdown = buildBreakdown(pair);
  const compositeScore =
    breakdown.volumeSpike * 0.25 +
    breakdown.momentum * 0.2 +
    breakdown.breakout * 0.15 +
    breakdown.rsiScore * 0.1 +
    breakdown.macdCross * 0.1 +
    breakdown.holderGrowth * 0.1 +
    breakdown.liquidityScore * 0.05 +
    breakdown.socialSentiment * 0.05;

  let strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME';
  if (compositeScore >= 0.75) strength = 'EXTREME';
  else if (compositeScore >= 0.55) strength = 'STRONG';
  else if (compositeScore >= 0.4) strength = 'MODERATE';
  else strength = 'WEAK';

  const mcap = pair.marketCap ?? pair.fdv ?? 0;
  const direction: 'LONG' | 'SHORT' =
    (pair.priceChange?.m5 ?? 0) >= 0 && (pair.priceChange?.h1 ?? 0) >= 0 ? 'LONG' : 'SHORT';

  return {
    id: `live-${pair.baseToken.address}-${index}`,
    tokenName: pair.baseToken.symbol.toUpperCase(),
    tokenAddress: pair.baseToken.address,
    marketCap: mcap,
    volume24h: pair.volume?.h24 ?? 0,
    compositeScore: parseFloat(compositeScore.toFixed(4)),
    priceChange24h: pair.priceChange?.h24 ?? 0,
    currentPrice: parseFloat(pair.priceUsd ?? '0'),
    breakdown,
    riskReward: parseFloat((1.5 + compositeScore * 3).toFixed(2)),
    direction,
    strength,
    timestamp: Date.now() - index * 60_000,
    isLive: true,
  };
}

function buildSignals(pairs: DexPair[]) {
  const solanaPairs = pairs
    .filter((p) => p.chainId === 'solana' && (p.liquidity?.usd ?? 0) > 5_000)
    .slice(0, 8);

  const signals = solanaPairs
    .map((p, i) => pairToSignal(p, i))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    signals,
    scannedTokens: pairs.filter((p) => p.chainId === 'solana').length,
    lastUpdated: Date.now(),
    isLive: true,
  };
}

// ── Fallback: generated signals when DexScreener is unavailable ───────────────
const FALLBACK_TOKENS = [
  { name: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { name: 'WIF', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { name: 'JTO', address: 'jtojtomepa8bdoa1lvfuv42y5k5yblxeqiqv9dgb1b' },
  { name: 'PYTH', address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3' },
  { name: 'RAY', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { name: 'ORCA', address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
];

function fallbackSignals() {
  return {
    signals: Array.from({ length: 8 }, (_, i) => {
      const token = FALLBACK_TOKENS[i % FALLBACK_TOKENS.length];
      const score = 0.45 + Math.random() * 0.5;
      return {
        id: Math.random().toString(36).slice(2),
        tokenName: token.name,
        tokenAddress: token.address,
        marketCap: 25_000 + Math.random() * (1_000_000_000 - 25_000),
        volume24h: 5_000 + Math.random() * 300_000,
        compositeScore: score,
        priceChange24h: -5 + Math.random() * 25,
        currentPrice: 0.00001 + Math.random() * 5,
        breakdown: {
          volumeSpike: Math.random(),
          momentum: Math.random(),
          breakout: Math.random(),
          rsiScore: Math.random(),
          macdCross: Math.random(),
          holderGrowth: Math.random(),
          liquidityScore: Math.random(),
          socialSentiment: Math.random(),
        },
        riskReward: 1.5 + Math.random() * 3.5,
        direction: (Math.random() > 0.3 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
        strength: (
          score >= 0.75 ? 'EXTREME' : score >= 0.55 ? 'STRONG' : score >= 0.4 ? 'MODERATE' : 'WEAK'
        ) as 'WEAK' | 'MODERATE' | 'STRONG' | 'EXTREME',
        timestamp: Date.now() - Math.random() * 3_600_000,
        isLive: false,
      };
    }).sort((a, b) => b.compositeScore - a.compositeScore),
    scannedTokens: Math.floor(400 + Math.random() * 200),
    lastUpdated: Date.now(),
    isLive: false,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET() {
  const now = Date.now();
  if (cachedSignals && now - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedSignals);
  }

  try {
    // Step 1: Top boosted Solana tokens
    const boostRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!boostRes.ok) throw new Error(`Boosts ${boostRes.status}`);

    const boosts: DexBoost[] = await boostRes.json();
    const solanaBoosts = boosts.filter((b) => b.chainId === 'solana').slice(0, 10);
    if (solanaBoosts.length === 0) throw new Error('No Solana boosts');

    const addresses = solanaBoosts.map((b) => b.tokenAddress).join(',');

    // Step 2: Pair details
    const detailRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addresses}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!detailRes.ok) throw new Error(`Details ${detailRes.status}`);

    const { pairs }: { pairs: DexPair[] } = await detailRes.json();
    const result = buildSignals(pairs ?? []);
    cachedSignals = result;
    cacheTimestamp = now;
    return NextResponse.json(result);
  } catch {
    // Return fallback signals so the UI stays functional
    return NextResponse.json(fallbackSignals());
  }
}

