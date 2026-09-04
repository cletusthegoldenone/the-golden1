import { NextResponse } from 'next/server';

interface DexScreenerPair {
  chainId: string;
  dexId?: string;
  pairAddress?: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd: string;
  priceChange: { m5?: number; h1?: number; h24?: number };
  volume: { m5?: number; h1?: number; h24?: number };
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  txns?: {
    m5?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
}

interface DexScreenerBoost {
  chainId: string;
  tokenAddress: string;
}

interface FormattedToken {
  rank: number;
  name: string;
  fullName: string;
  address: string;
  mcap: string;
  vol5m: string;
  change: string;
  changeRaw: number;
  score: number;
  signals: string;
  changePositive: boolean;
}

interface SearchTokenResult {
  id: string;
  symbol: string;
  name: string;
  address: string;
  priceUsd?: number;
  change24h?: number;
  volume24h?: number;
  mcap?: number;
  fdv?: number;
  liquidityUsd?: number;
  txns24h?: number;
  dex?: string;
  chain?: string;
  quoteSymbol?: string;
  pairAddress?: string;
}

// Simple in-memory cache
let cachedData: { tokens: FormattedToken[]; isLive: boolean; timestamp: number } | null = null;
const CACHE_TTL_MS = 15_000;
const SEARCH_CACHE_TTL_MS = 10_000;
const searchCache = new Map<string, { tokens: SearchTokenResult[]; isLive: boolean; timestamp: number }>();

const FALLBACK_TOKENS: FormattedToken[] = [
  {
    rank: 1,
    name: '$PEPU',
    fullName: 'Pepe Unlimited',
    address: '',
    mcap: '$1.85M',
    vol5m: '$124k',
    change: '+34.2%',
    changeRaw: 34.2,
    score: 92,
    signals: 'momentum · volume spike',
    changePositive: true,
  },
  {
    rank: 2,
    name: '$MOBY',
    fullName: 'Moby Whale',
    address: '',
    mcap: '$3.2M',
    vol5m: '$87k',
    change: '+18.7%',
    changeRaw: 18.7,
    score: 87,
    signals: 'liquidity locked · clean dev',
    changePositive: true,
  },
  {
    rank: 3,
    name: '$VRTX',
    fullName: 'Vortex Sol',
    address: '',
    mcap: '$4.4M',
    vol5m: '$56k',
    change: '+9.1%',
    changeRaw: 9.1,
    score: 78,
    signals: 'graduated · strong community',
    changePositive: true,
  },
  {
    rank: 4,
    name: '$BONK',
    fullName: 'Bonk',
    address: '',
    mcap: '$12.1M',
    vol5m: '$203k',
    change: '+5.3%',
    changeRaw: 5.3,
    score: 74,
    signals: 'high volume · community driven',
    changePositive: true,
  },
  {
    rank: 5,
    name: '$WIF',
    fullName: 'dogwifhat',
    address: '',
    mcap: '$8.9M',
    vol5m: '$91k',
    change: '-2.1%',
    changeRaw: -2.1,
    score: 71,
    signals: 'consolidating · watch for breakout',
    changePositive: false,
  },
];

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function computeScore(pair: DexScreenerPair): number {
  let score = 50;
  const change5m = pair.priceChange?.m5 ?? 0;
  const change1h = pair.priceChange?.h1 ?? 0;
  const vol5m = pair.volume?.m5 ?? 0;
  const mcap = pair.marketCap ?? pair.fdv ?? 0;
  const liq = pair.liquidity?.usd ?? 0;

  // Momentum scoring
  if (change5m > 5) score += 10;
  else if (change5m > 2) score += 5;

  if (change1h > 10) score += 8;
  else if (change1h > 5) score += 4;

  // Volume/mcap ratio
  if (mcap > 0 && vol5m > 0) {
    const ratio = vol5m / mcap;
    if (ratio > 0.1) score += 15;
    else if (ratio > 0.05) score += 8;
    else if (ratio > 0.02) score += 4;
  }

  // Liquidity score
  if (liq > 100_000) score += 10;
  else if (liq > 50_000) score += 6;
  else if (liq > 10_000) score += 3;

  // Buy/sell pressure
  const m5txns = pair.txns?.m5;
  if (m5txns && m5txns.buys + m5txns.sells > 0) {
    const buyRatio = m5txns.buys / (m5txns.buys + m5txns.sells);
    if (buyRatio > 0.7) score += 7;
    else if (buyRatio > 0.55) score += 3;
  }

  return Math.min(99, Math.max(40, score));
}

function buildSignals(pair: DexScreenerPair): string {
  const signals: string[] = [];
  const change5m = pair.priceChange?.m5 ?? 0;
  const change1h = pair.priceChange?.h1 ?? 0;
  const vol5m = pair.volume?.m5 ?? 0;
  const mcap = pair.marketCap ?? pair.fdv ?? 0;

  if (change5m > 5) signals.push('momentum breakout');
  if (vol5m > 0 && mcap > 0 && vol5m / mcap > 0.05) signals.push('volume spike');
  if (change1h > 15) signals.push('1h rally');
  if (mcap < 500_000 && mcap > 0) signals.push('nano-cap');
  else if (mcap < 2_000_000 && mcap > 0) signals.push('micro-cap');

  const m5txns = pair.txns?.m5;
  if (m5txns && m5txns.buys > m5txns.sells * 2) signals.push('buy pressure');

  if (signals.length === 0) signals.push('accumulation');
  return signals.slice(0, 3).join(' · ');
}

function getQuotePriority(pair: DexScreenerPair): number {
  const quote = pair.quoteToken?.symbol?.trim().toUpperCase();
  if (quote === 'USDC') return 4;
  if (quote === 'USDT') return 3;
  if (quote?.includes('USD')) return 2;
  return 1;
}

function compareSearchPairs(a: DexScreenerPair, b: DexScreenerPair): number {
  const quoteScore = getQuotePriority(b) - getQuotePriority(a);
  if (quoteScore !== 0) return quoteScore;
  return (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
}

function formatDexLabel(dexId?: string): string {
  if (!dexId) return 'Unknown';
  return dexId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function fetchLiveTokens(): Promise<FormattedToken[]> {
  // Step 1: Get top boosted Solana tokens
  const boostRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!boostRes.ok) throw new Error(`Boosts API error: ${boostRes.status}`);

  const boosts: DexScreenerBoost[] = await boostRes.json();
  const solanaBoosts = boosts.filter((b) => b.chainId === 'solana').slice(0, 8);

  if (solanaBoosts.length === 0) throw new Error('No Solana tokens in boosts');

  const addresses = solanaBoosts.map((b) => b.tokenAddress).join(',');

  // Step 2: Fetch pair details for those tokens
  const detailRes = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${addresses}`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!detailRes.ok) throw new Error(`Details API error: ${detailRes.status}`);

  const detailData: { pairs: DexScreenerPair[] } = await detailRes.json();
  const pairs = detailData.pairs ?? [];

  // Keep only Solana pairs with sufficient liquidity, one per token address
  const seen = new Set<string>();
  const filtered = pairs
    .filter((p) => p.chainId === 'solana' && (p.liquidity?.usd ?? 0) > 5_000)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .filter((p) => {
      const addr = p.baseToken.address;
      if (seen.has(addr)) return false;
      seen.add(addr);
      return true;
    })
    .slice(0, 5);

  if (filtered.length === 0) throw new Error('No valid pairs after filtering');

  return filtered.map((pair, i) => {
    const change = pair.priceChange?.h1 ?? pair.priceChange?.m5 ?? 0;
    const changePositive = change >= 0;
    const changeStr = `${changePositive ? '+' : ''}${change.toFixed(1)}%`;
    const mcap = pair.marketCap ?? pair.fdv ?? 0;
    const vol5m = pair.volume?.m5 ?? 0;

    return {
      rank: i + 1,
      name: `$${pair.baseToken.symbol.toUpperCase()}`,
      fullName: pair.baseToken.name,
      address: pair.baseToken.address,
      mcap: mcap > 0 ? formatNumber(mcap) : 'N/A',
      vol5m: vol5m > 0 ? formatNumber(vol5m) : 'N/A',
      change: changeStr,
      changeRaw: change,
      score: computeScore(pair),
      signals: buildSignals(pair),
      changePositive,
    };
  });
}

async function fetchSearchTokens(query: string): Promise<SearchTokenResult[]> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!res.ok) throw new Error(`Search API error: ${res.status}`);

  const payload = (await res.json()) as { pairs?: DexScreenerPair[] };
  const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];

  const bestByAddress = new Map<string, DexScreenerPair>();

  pairs
    .filter((pair) => {
      const address = pair.baseToken?.address?.trim();
      const symbol = pair.baseToken?.symbol?.trim();
      return pair.chainId === 'solana' && Boolean(address) && Boolean(symbol);
    })
    .forEach((pair) => {
      const address = pair.baseToken.address;
      const current = bestByAddress.get(address);
      if (!current || compareSearchPairs(pair, current) < 0) {
        bestByAddress.set(address, pair);
      }
    });

  return Array.from(bestByAddress.values())
    .sort(compareSearchPairs)
    .slice(0, 20)
    .map((pair) => {
      const priceUsd = Number.parseFloat(pair.priceUsd ?? '');
      const volume24h = pair.volume?.h24;
      const change24h = pair.priceChange?.h24;
      const txns24h = pair.txns?.h24;
      return {
        id: pair.baseToken.address,
        symbol: pair.baseToken.symbol.toUpperCase(),
        name: pair.baseToken.name,
        address: pair.baseToken.address,
        priceUsd: Number.isFinite(priceUsd) ? priceUsd : undefined,
        change24h: typeof change24h === 'number' && Number.isFinite(change24h) ? change24h : undefined,
        volume24h: typeof volume24h === 'number' && Number.isFinite(volume24h) ? volume24h : undefined,
        mcap:
          typeof pair.marketCap === 'number' && Number.isFinite(pair.marketCap)
            ? pair.marketCap
            : undefined,
        fdv: typeof pair.fdv === 'number' && Number.isFinite(pair.fdv) ? pair.fdv : undefined,
        liquidityUsd:
          typeof pair.liquidity?.usd === 'number' && Number.isFinite(pair.liquidity.usd)
            ? pair.liquidity.usd
            : undefined,
        txns24h:
          txns24h && Number.isFinite(txns24h.buys) && Number.isFinite(txns24h.sells)
            ? txns24h.buys + txns24h.sells
            : undefined,
        dex: formatDexLabel(pair.dexId),
        chain: 'Solana',
        quoteSymbol: pair.quoteToken?.symbol?.toUpperCase() || 'USDC',
        pairAddress: pair.pairAddress,
      };
    });
}

function fallbackSearchTokens(query: string): SearchTokenResult[] {
  const q = query.trim().toLowerCase();
  const fallback = FALLBACK_TOKENS
    .map((token) => ({
      id: token.address || token.name.replace('$', ''),
      symbol: token.name.replace(/^\$/, ''),
      name: token.fullName,
      address: token.address,
      chain: 'Solana',
      dex: 'Unknown',
      quoteSymbol: 'USDC',
    }))
    .filter((token) => {
      if (!q) return true;
      return (
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q) ||
        token.address.toLowerCase().includes(q)
      );
    });
  return fallback.slice(0, 10);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  const now = Date.now();

  if (query.length > 0) {
    const key = query.toLowerCase();
    const cached = searchCache.get(key);
    if (cached && now - cached.timestamp < SEARCH_CACHE_TTL_MS) {
      return NextResponse.json(cached);
    }

    try {
      const tokens = await fetchSearchTokens(query);
      const payload = { tokens, isLive: true, timestamp: now };
      searchCache.set(key, payload);
      return NextResponse.json(payload);
    } catch {
      const payload = { tokens: fallbackSearchTokens(query), isLive: false, timestamp: now };
      searchCache.set(key, payload);
      return NextResponse.json(payload);
    }
  }

  if (cachedData && now - cachedData.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedData);
  }

  try {
    const tokens = await fetchLiveTokens();
    cachedData = { tokens, isLive: true, timestamp: now };
    return NextResponse.json(cachedData);
  } catch {
    // Cache and return fallback data so repeated failures don't hammer the API
    cachedData = { tokens: FALLBACK_TOKENS, isLive: false, timestamp: now };
    return NextResponse.json(cachedData);
  }
}
