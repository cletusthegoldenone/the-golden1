import { NextResponse } from 'next/server';
import { applyWeights } from '@/lib/pattern-memory';

// ── DexScreener types ─────────────────────────────────────────────────────────

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

// ── Signal building ───────────────────────────────────────────────────────────

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

// ── GET /api/trade/scan ───────────────────────────────────────────────────────

export async function GET() {
  const minScore = parseFloat(process.env.MIN_COMPOSITE_SCORE ?? '0.65');
  const minMcap  = parseInt(process.env.MIN_MARKET_CAP ?? '25000', 10);
  const maxMcap  = parseInt(process.env.MAX_MARKET_CAP ?? '1000000000', 10);

  try {
    // Step 1: Top boosted Solana tokens
    const boostRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!boostRes.ok) throw new Error(`Boosts ${boostRes.status}`);

    const boosts: DexBoost[] = await boostRes.json();
    const solanaBoosts = boosts.filter((b) => b.chainId === 'solana').slice(0, 15);
    if (solanaBoosts.length === 0) throw new Error('No Solana boosts');

    const addresses = solanaBoosts.map((b) => b.tokenAddress).join(',');

    // Step 2: Pair details
    const detailRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addresses}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5_000) },
    );
    if (!detailRes.ok) throw new Error(`Details ${detailRes.status}`);

    const { pairs }: { pairs: DexPair[] } = await detailRes.json();
    const solPairs = (pairs ?? []).filter((p) => p.chainId === 'solana' && (p.liquidity?.usd ?? 0) > 5_000);

    // Step 3: Apply market-cap filter + score with learned weights
    const seen = new Set<string>();
    const opportunities = solPairs
      .filter((p) => {
        const mcap = p.marketCap ?? p.fdv ?? 0;
        const addr = p.baseToken.address;
        if (mcap > 0 && (mcap < minMcap || mcap > maxMcap)) return false;
        if (seen.has(addr)) return false;
        seen.add(addr);
        return true;
      })
      .map((p) => {
        const breakdown = buildBreakdown(p);
        const compositeScore = applyWeights(breakdown); // uses learned weights
        return {
          tokenAddress: p.baseToken.address,
          tokenSymbol: p.baseToken.symbol.toUpperCase(),
          tokenName: p.baseToken.name,
          currentPrice: parseFloat(p.priceUsd ?? '0'),
          marketCap: p.marketCap ?? p.fdv ?? 0,
          volume5m: p.volume?.m5 ?? 0,
          liquidity: p.liquidity?.usd ?? 0,
          priceChange5m: p.priceChange?.m5 ?? 0,
          priceChange1h: p.priceChange?.h1 ?? 0,
          compositeScore: parseFloat(compositeScore.toFixed(4)),
          breakdown,
          readyToTrade: compositeScore >= minScore,
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);

    const tradeReady = opportunities.filter((o) => o.readyToTrade);

    return NextResponse.json({
      opportunities,
      tradeReady,
      scannedTokens: solPairs.length,
      minScoreThreshold: minScore,
      lastUpdated: Date.now(),
      isLive: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Scan failed: ${String(err)}`, opportunities: [], tradeReady: [], scannedTokens: 0, isLive: false },
      { status: 502 },
    );
  }
}
