/**
 * Pre-trade security audit.
 *
 * Every token is screened before a single lamport is deployed.
 * Uses rugcheck.xyz when an API key is configured; falls back to
 * lightweight heuristics using on-chain DexScreener data otherwise.
 */

const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditResult {
  /** True if it's safe to enter the trade. */
  safe: boolean;
  /** Risk score 0–100 (higher = riskier). */
  riskScore: number;
  /** Human-readable flags that explain the score. */
  reasons: string[];
  /** Whether rugcheck.xyz was consulted. */
  usedRugcheck: boolean;
}

interface RugcheckRisk {
  name: string;
  level: 'warning' | 'danger' | 'info';
  score: number;
}

interface RugcheckReport {
  score: number;
  score_normalised: number;
  risks: RugcheckRisk[];
  rugged?: boolean;
}

interface DexPairInfo {
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  txns?: { m5?: { buys: number; sells: number } };
  priceChange?: { h1?: number; h24?: number };
}

// ── Rugcheck.xyz ──────────────────────────────────────────────────────────────

async function fetchRugcheck(mint: string): Promise<RugcheckReport | null> {
  const apiKey = process.env.RUGCHECK_API_KEY;
  if (!apiKey || apiKey === 'your_rugcheck_api_key_here') return null;

  try {
    const res = await fetch(`${RUGCHECK_BASE}/tokens/${mint}/report`, {
      headers: { Accept: 'application/json', 'X-API-KEY': apiKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<RugcheckReport>;
  } catch {
    return null;
  }
}

// ── DexScreener on-chain heuristics ──────────────────────────────────────────

async function fetchDexPairInfo(mint: string): Promise<DexPairInfo | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { pairs?: DexPairInfo[] };
    const solanaPairs = (data.pairs ?? []).filter(
      (p: { chainId?: string } & DexPairInfo) => p.chainId === 'solana',
    );
    if (solanaPairs.length === 0) return null;
    // Use the most liquid Solana pair
    return solanaPairs.sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    )[0];
  } catch {
    return null;
  }
}

// ── Main audit function ───────────────────────────────────────────────────────

/**
 * Run a pre-trade security audit on `mint`.
 *
 * Returns an AuditResult indicating whether the trade is safe to execute.
 * The audit is best-effort: if external services are unavailable, it will
 * apply conservative heuristics and return a moderate risk score.
 */
export async function auditToken(mint: string): Promise<AuditResult> {
  const reasons: string[] = [];
  let riskScore = 20; // Start with a conservative base
  let usedRugcheck = false;

  // Run rugcheck and DexScreener checks in parallel
  const [rugcheck, dexInfo] = await Promise.all([
    fetchRugcheck(mint),
    fetchDexPairInfo(mint),
  ]);

  // ── Rugcheck analysis ────────────────────────────────────────────────────
  if (rugcheck) {
    usedRugcheck = true;

    if (rugcheck.rugged) {
      riskScore = 100;
      reasons.push('🚨 Token has already been rugged (rugcheck.xyz)');
    } else {
      // rugcheck score is 0–100, higher = riskier; blend into our score
      riskScore = Math.max(riskScore, Math.round(rugcheck.score_normalised ?? rugcheck.score));

      const dangers = rugcheck.risks.filter((r) => r.level === 'danger');
      const warnings = rugcheck.risks.filter((r) => r.level === 'warning');

      for (const d of dangers) reasons.push(`🚨 ${d.name}`);
      for (const w of warnings) reasons.push(`⚠️ ${w.name}`);
    }
  } else {
    reasons.push('ℹ️ Rugcheck.xyz not available — using on-chain heuristics only');
  }

  // ── DexScreener heuristics ───────────────────────────────────────────────
  if (dexInfo) {
    const liq = dexInfo.liquidity?.usd ?? 0;
    const mcap = dexInfo.marketCap ?? dexInfo.fdv ?? 0;
    const m5txns = dexInfo.txns?.m5;
    const change24h = dexInfo.priceChange?.h24 ?? 0;

    if (liq < 1_000) {
      riskScore += 30;
      reasons.push('🚨 Extremely low liquidity (<$1k) — rug risk');
    } else if (liq < 5_000) {
      riskScore += 15;
      reasons.push('⚠️ Very low liquidity (<$5k)');
    } else if (liq > 50_000) {
      reasons.push('✅ Healthy liquidity (>$50k)');
    }

    if (mcap > 0 && liq > 0 && liq / mcap < 0.01) {
      riskScore += 15;
      reasons.push('⚠️ Liquidity/market-cap ratio very low (<1%) — potential honeypot');
    }

    if (m5txns && m5txns.buys + m5txns.sells > 0) {
      const sellRatio = m5txns.sells / (m5txns.buys + m5txns.sells);
      if (sellRatio > 0.8) {
        riskScore += 20;
        reasons.push('⚠️ Heavy sell pressure in last 5 min (>80% sells)');
      }
    }

    if (change24h < -60) {
      riskScore += 20;
      reasons.push(`⚠️ Severe 24h price drop (${change24h.toFixed(1)}%) — possible rug`);
    }
  } else {
    riskScore += 10;
    reasons.push('⚠️ Could not fetch pair data from DexScreener');
  }

  riskScore = Math.min(100, riskScore);

  // ── Safety threshold ─────────────────────────────────────────────────────
  // Block any token scoring 70 or above (70+ = HIGH RISK category boundary
  // on rugcheck's normalised scale). Configurable via MAX_AUDIT_RISK_SCORE.
  const maxSafeScore = parseInt(process.env.MAX_AUDIT_RISK_SCORE ?? '69', 10);
  const safe = riskScore <= maxSafeScore;

  if (safe && reasons.filter((r) => r.startsWith('🚨')).length === 0) {
    reasons.push(`✅ Token passed pre-trade audit (score: ${riskScore}/100)`);
  }

  return { safe, riskScore, reasons, usedRugcheck };
}
