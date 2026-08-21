import { NextRequest, NextResponse } from 'next/server';

// Build Helius URL server-side, keeping the API key out of the client bundle
function getSolanaRpc(): string {
  const apiKey = process.env.HELIUS_API_KEY;
  if (apiKey && apiKey !== 'your_helius_api_key_here') {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }
  return process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
}

const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

// ── Jupiter token metadata cache ──────────────────────────────────────────────
let jupiterTokenMap: Record<string, { symbol: string; name: string }> | null = null;
let jupiterCacheAt = 0;
const JUPITER_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getJupiterTokenMap(): Promise<Record<string, { symbol: string; name: string }>> {
  const now = Date.now();
  if (jupiterTokenMap && now - jupiterCacheAt < JUPITER_CACHE_TTL_MS) {
    return jupiterTokenMap;
  }
  try {
    const res = await fetch('https://tokens.jup.ag/tokens?tags=verified', {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return jupiterTokenMap ?? {};
    const tokens = (await res.json()) as Array<{ address: string; symbol: string; name: string }>;
    const map: Record<string, { symbol: string; name: string }> = {};
    for (const t of tokens) map[t.address] = { symbol: t.symbol, name: t.name };
    jupiterTokenMap = map;
    jupiterCacheAt = now;
    return map;
  } catch {
    return jupiterTokenMap ?? {};
  }
}

// ── Solana JSON-RPC helper ────────────────────────────────────────────────────
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const SOLANA_RPC = getSolanaRpc();
  const res = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json() as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  if (json.result === undefined) throw new Error('Empty RPC result');
  return json.result;
}

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function formatRelativeTime(blockTime: number): string {
  const s = Math.floor(Date.now() / 1000 - blockTime);
  if (s < 60) return `${s}s ago`;
  if (s < 3_600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

// ── Rugcheck.xyz integration ──────────────────────────────────────────────────
const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';

interface RugcheckRisk {
  name: string;
  description: string;
  level: 'warning' | 'danger' | 'info';
  score: number;
}

interface RugcheckReport {
  mint: string;
  score: number;           // 0–100, higher = riskier
  score_normalised: number;
  risks: RugcheckRisk[];
  rugged?: boolean;
  tokenMeta?: { name?: string; symbol?: string };
}

/**
 * Fetches a rugcheck.xyz token report.
 * Returns null silently when the API key is not set or the request fails.
 */
async function getRugcheckReport(mint: string): Promise<RugcheckReport | null> {
  const apiKey = process.env.RUGCHECK_API_KEY;
  if (!apiKey || apiKey === 'your_rugcheck_api_key_here') return null;

  try {
    const res = await fetch(`${RUGCHECK_BASE}/tokens/${mint}/report`, {
      headers: {
        Accept: 'application/json',
        'X-API-KEY': apiKey,
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as RugcheckReport;
  } catch {
    return null;
  }
}

// ── Types returned by this route ──────────────────────────────────────────────
interface TokenHolding {
  symbol: string;
  name: string;
  mint: string;
  amount: string;
  valueUsd: string;
  percentOfSupply: string;
  suspicious: boolean;
  /** rugcheck.xyz risk score for this token (0–100, higher = riskier). Only present when API key is configured. */
  rugcheckScore?: number;
  /** Top risk flags from rugcheck.xyz */
  rugcheckRisks?: string[];
  /** Whether rugcheck has flagged this token as already rugged */
  rugged?: boolean;
}

interface ActivityItem {
  type: 'sell' | 'buy' | 'transfer' | 'launch';
  description: string;
  amount: string;
  time: string;
  flagged: boolean;
  signature: string;
}

interface WalletAnalysisResponse {
  address: string;
  isKnownRugger: boolean;
  rugCount: number;
  riskScore: number;
  riskLabel: string;
  riskColor: string;
  solBalance: number;
  tokenHoldings: TokenHolding[];
  recentActivity: ActivityItem[];
  flags: string[];
  rugHistory: unknown[];
  firstSeen: string;
  totalVolume: string;
  rugcheckScore: number;
  walletAgeDays: number | null;
  isLive: true;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const trimmed = address?.trim() ?? '';

  if (!trimmed || !isValidSolanaAddress(trimmed)) {
    return NextResponse.json({ error: 'Invalid Solana address' }, { status: 400 });
  }

  try {
    // Fetch balance, token accounts, recent signatures, and Jupiter token list in parallel
    const [balanceResult, tokenResult, sigResult, tokenMap] = await Promise.all([
      rpc<{ value: number }>('getBalance', [trimmed]),
      rpc<{
        value: Array<{
          account: {
            data: {
              parsed: {
                info: {
                  mint: string;
                  tokenAmount: { uiAmount: number | null; uiAmountString: string };
                };
              };
            };
          };
        }>;
      }>('getTokenAccountsByOwner', [
        trimmed,
        { programId: SPL_TOKEN_PROGRAM },
        { encoding: 'jsonParsed' },
      ]),
      rpc<
        Array<{
          signature: string;
          blockTime?: number;
          err: unknown;
          memo: string | null;
        }>
      >('getSignaturesForAddress', [trimmed, { limit: 25 }]),
      getJupiterTokenMap(),
    ]);

    const solBalance = (balanceResult.value ?? 0) / 1e9;
    const tokenAccounts = tokenResult.value ?? [];
    const signatures = sigResult ?? [];

    // Wallet age from oldest blockTime in the fetched window
    const blockTimes = signatures.filter((s) => s.blockTime).map((s) => s.blockTime!);
    const oldestBlockTime = blockTimes.length > 0 ? Math.min(...blockTimes) : null;
    const latestBlockTime = blockTimes.length > 0 ? Math.max(...blockTimes) : null;
    const walletAgeDays =
      oldestBlockTime !== null
        ? Math.floor((Date.now() / 1000 - oldestBlockTime) / 86_400)
        : null;
    const firstSeen =
      oldestBlockTime !== null
        ? new Date(oldestBlockTime * 1000).toISOString().split('T')[0]
        : 'Unknown';

    // Token holdings sorted by raw amount descending, top 5
    // Use a separate intermediate type to avoid polluting TokenHolding
    type RawHolding = Omit<TokenHolding, 'rugcheckScore' | 'rugcheckRisks' | 'rugged'> & { _uiAmount: number };
    const rawHoldings: RawHolding[] = tokenAccounts
      .map((acc) => {
        const info = acc.account.data.parsed.info;
        const uiAmount = info.tokenAmount.uiAmount ?? 0;
        const meta = tokenMap[info.mint];
        return {
          mint: info.mint,
          symbol: meta ? `$${meta.symbol}` : `${info.mint.slice(0, 4)}…${info.mint.slice(-4)}`,
          name: meta?.name ?? 'Unknown Token',
          amount: uiAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          valueUsd: '—',
          percentOfSupply: '—',
          suspicious: false,
          _uiAmount: uiAmount,
        };
      })
      .filter((h) => h._uiAmount > 0)
      .sort((a, b) => b._uiAmount - a._uiAmount)
      .slice(0, 5);

    // Enrich top holdings with rugcheck.xyz data (in parallel, max 5 calls)
    const rugcheckReports = await Promise.all(
      rawHoldings.map((h) => getRugcheckReport(h.mint)),
    );

    const holdings: TokenHolding[] = rawHoldings.map(({ _uiAmount: _, ...h }, i) => {
      const report = rugcheckReports[i];
      if (!report) return h;

      const topRisks = report.risks
        .filter((r) => r.level === 'danger' || r.level === 'warning')
        .slice(0, 3)
        .map((r) => r.name);

      return {
        ...h,
        rugcheckScore: report.score,
        rugcheckRisks: topRisks,
        rugged: report.rugged ?? false,
        // Mark as suspicious if rugcheck score is high (>60) or already rugged
        suspicious: report.score > 60 || (report.rugged ?? false),
      };
    });

    // Recent activity from signatures
    const recentActivity: ActivityItem[] = signatures.slice(0, 8).map((sig) => ({
      type: sig.err ? ('transfer' as const) : ('buy' as const),
      description: sig.err ? 'Failed transaction' : 'On-chain transaction',
      amount: `${sig.signature.slice(0, 8)}…`,
      time: sig.blockTime ? formatRelativeTime(sig.blockTime) : 'Unknown',
      flagged: sig.err !== null,
      signature: sig.signature,
    }));

    // ── Risk scoring from real on-chain data ───────────────────────────────────
    let riskScore = 25;
    const flags: string[] = [];

    if (walletAgeDays !== null) {
      if (walletAgeDays < 7) {
        riskScore += 30;
        flags.push(`⚠️ Wallet created ${walletAgeDays}d ago — extremely new`);
      } else if (walletAgeDays < 30) {
        riskScore += 20;
        flags.push(`⚠️ Wallet age: ${walletAgeDays} days — recent`);
      } else if (walletAgeDays < 90) {
        riskScore += 8;
        flags.push(`Wallet age: ${walletAgeDays} days`);
      } else {
        flags.push(`✅ Wallet age: ${walletAgeDays}+ days — established`);
      }
    }

    const failedTxCount = signatures.filter((s) => s.err !== null).length;
    if (failedTxCount > 5) {
      riskScore += 15;
      flags.push(`⚠️ ${failedTxCount} failed transactions in recent history`);
    } else if (failedTxCount > 2) {
      riskScore += 5;
      flags.push(`${failedTxCount} failed transactions in recent history`);
    }

    if (solBalance < 0.05 && signatures.length > 5) {
      riskScore += 15;
      flags.push('⚠️ Near-zero SOL balance with active transaction history');
    } else if (solBalance < 0.5) {
      riskScore += 5;
      flags.push('Low SOL balance');
    } else if (solBalance > 100) {
      flags.push(`✅ High SOL balance (${solBalance.toFixed(2)} SOL) — substantial holdings`);
    }

    if (tokenAccounts.length === 0 && signatures.length > 10) {
      riskScore += 10;
      flags.push('⚠️ No current token holdings — may have sold all positions');
    }

    // Rapid activity (many txns in the window)
    if (latestBlockTime && oldestBlockTime && latestBlockTime - oldestBlockTime < 3600 && signatures.length >= 15) {
      riskScore += 10;
      flags.push('⚠️ High-frequency activity detected in short window');
    }

    // Incorporate real rugcheck.xyz data for held tokens
    const ruggedTokens = holdings.filter((h) => h.rugged);
    const highRiskTokens = holdings.filter((h) => h.rugcheckScore !== undefined && h.rugcheckScore > 60 && !h.rugged);
    if (ruggedTokens.length > 0) {
      riskScore += Math.min(25, ruggedTokens.length * 12);
      flags.push(`🚨 Holds ${ruggedTokens.length} already-rugged token(s): ${ruggedTokens.map((h) => h.symbol).join(', ')}`);
    }
    if (highRiskTokens.length > 0) {
      riskScore += Math.min(15, highRiskTokens.length * 7);
      flags.push(`⚠️ Holds ${highRiskTokens.length} high-risk token(s) per rugcheck.xyz: ${highRiskTokens.map((h) => h.symbol).join(', ')}`);
    }
    const lowRiskTokenCount = holdings.filter((h) => h.rugcheckScore !== undefined && h.rugcheckScore <= 30).length;
    if (lowRiskTokenCount > 0) {
      flags.push(`✅ ${lowRiskTokenCount} holding(s) scored low-risk by rugcheck.xyz`);
    }

    if (flags.length === 0) {
      flags.push('✅ No suspicious patterns detected in on-chain data');
    }

    riskScore = Math.min(95, riskScore);

    let riskLabel: string;
    let riskColor: string;
    if (riskScore >= 70) {
      riskLabel = 'HIGH RISK';
      riskColor = 'text-trading-red';
    } else if (riskScore >= 45) {
      riskLabel = 'MODERATE RISK';
      riskColor = 'text-trading-yellow';
    } else {
      riskLabel = 'LOW RISK';
      riskColor = 'text-trading-green';
    }

    const response: WalletAnalysisResponse = {
      address: trimmed,
      isKnownRugger: false,
      rugCount: 0,
      riskScore,
      riskLabel,
      riskColor,
      solBalance: parseFloat(solBalance.toFixed(4)),
      tokenHoldings: holdings,
      recentActivity,
      flags,
      rugHistory: [],
      firstSeen,
      totalVolume: `${signatures.length} txns (last 25 fetched)`,
      rugcheckScore: Math.max(10, 100 - riskScore),
      walletAgeDays,
      isLive: true,
    };

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch wallet data: ${msg}` },
      { status: 500 },
    );
  }
}
