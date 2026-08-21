import { NextRequest, NextResponse } from 'next/server';
import { auditToken } from '@/lib/pre-trade-audit';
import { buyTokenWithSol, loadTradingKeypair, WSOL_MINT } from '@/lib/jupiter';
import { openPosition, getOpenPositions, getClosedPositions } from '@/lib/position-store';
import { applyWeights } from '@/lib/pattern-memory';
import { runSecComplianceChecks } from '@/lib/sec-compliance';
import type { TradeRecord } from '@/lib/sec-compliance';
import type { SignalBreakdown } from '@/types';

// ── Auth helper ───────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return true; // No PIN configured — open access (dev mode)
  return req.headers.get('x-admin-pin') === pin;
}

// ── Slippage from env ─────────────────────────────────────────────────────────

function getSlippageBps(): number {
  const pct = parseFloat(process.env.SLIPPAGE_TOLERANCE ?? '0.05');
  return Math.round(pct * 10_000); // 0.05 → 500 bps
}

// ── Request body ──────────────────────────────────────────────────────────────

interface ExecuteRequest {
  /** Solana token mint address to buy */
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  /** Current USD price of the token */
  currentPrice: number;
  /** SOL amount to spend (e.g. 0.1 = 0.1 SOL) */
  amountSol: number;
  /** Composite signal score 0–1 */
  compositeScore: number;
  /** Optional signal breakdown for pattern memory */
  breakdown?: SignalBreakdown;
  /** Stop-loss % below entry (e.g. 0.10 = 10%) — defaults to env STOP_LOSS_PERCENTAGE */
  stopLossPct?: number;
  /** Take-profit % above entry (e.g. 0.25 = 25%) — defaults to env TAKE_PROFIT_PERCENTAGE */
  takeProfitPct?: number;
  /** Token 24h trading volume in USD — used for SEC position-concentration check */
  volume24hUsd?: number;
  /** Token pool liquidity in USD — used for SEC position-concentration check */
  liquidityUsd?: number;
}

// ── POST /api/trade/execute ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // ── Parse & validate body ──────────────────────────────────────────────────
  let body: ExecuteRequest;
  try {
    body = await req.json() as ExecuteRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tokenAddress, tokenSymbol, tokenName, currentPrice, amountSol, compositeScore, breakdown } = body;

  if (!tokenAddress || !tokenSymbol || !currentPrice || !amountSol || compositeScore == null) {
    return NextResponse.json(
      { error: 'Missing required fields: tokenAddress, tokenSymbol, currentPrice, amountSol, compositeScore' },
      { status: 400 },
    );
  }

  // ── Check ENABLE_LIVE_TRADING feature flag ────────────────────────────────
  const isLive = process.env.ENABLE_LIVE_TRADING === 'true';
  const hasKeypair = loadTradingKeypair() !== null;
  const isDryRun = !isLive || !hasKeypair;

  // ── Min score gate ─────────────────────────────────────────────────────────
  const minScore = parseFloat(process.env.MIN_COMPOSITE_SCORE ?? '0.65');
  if (compositeScore < minScore) {
    return NextResponse.json(
      { error: `Signal score ${compositeScore.toFixed(3)} below minimum threshold ${minScore}` },
      { status: 422 },
    );
  }

  // ── Max positions gate ─────────────────────────────────────────────────────
  const { getOpenCount } = await import('@/lib/position-store');
  const maxPositions = parseInt(process.env.MAX_OPEN_POSITIONS ?? '5', 10);
  if ((await getOpenCount()) >= maxPositions) {
    return NextResponse.json(
      { error: `Maximum open positions (${maxPositions}) reached` },
      { status: 422 },
    );
  }

  // ── Pre-trade security audit ──────────────────────────────────────────────
  // Skip audit for SOL/WSOL itself
  let audit = { safe: true, riskScore: 0, reasons: ['✅ SOL — no audit needed'], usedRugcheck: false };
  if (tokenAddress !== WSOL_MINT) {
    try {
      audit = await auditToken(tokenAddress);
    } catch (err) {
      return NextResponse.json(
        { error: `Audit failed: ${String(err)}` },
        { status: 500 },
      );
    }
    if (!audit.safe) {
      return NextResponse.json(
        { error: 'Token failed pre-trade security audit', audit },
        { status: 422 },
      );
    }
  }

  // ── SEC compliance checks ─────────────────────────────────────────────────
  // Build a recent-trade ledger from open and closed positions for wash-trade
  // and velocity checks (Exchange Act § 9 / Rule 10b-5).
  let secCompliance: ReturnType<typeof runSecComplianceChecks> = {
    compliant: true,
    violations: [],
    warnings: [],
    rules: [],
  };
  try {
    const [openPos, closedPos] = await Promise.all([
      getOpenPositions(),
      getClosedPositions(),
    ]);
    const recentTrades: TradeRecord[] = [
      ...openPos.map((p) => ({ tokenAddress: p.tokenAddress, side: 'buy' as const, timestamp: p.openedAt })),
      ...closedPos.map((p) => ({ tokenAddress: p.tokenAddress, side: 'buy' as const, timestamp: p.openedAt })),
      ...closedPos
        .filter((p) => p.closedAt != null)
        .map((p) => ({ tokenAddress: p.tokenAddress, side: 'sell' as const, timestamp: p.closedAt })),
    ];
    const defaultSolPrice = parseFloat(process.env.SEC_DEFAULT_SOL_PRICE_USD ?? '180');
    const amountUsd = amountSol * defaultSolPrice;
    secCompliance = runSecComplianceChecks({
      tokenAddress,
      amountUsd,
      tokenVolume24hUsd: body.volume24hUsd ?? 0,
      tokenLiquidityUsd: body.liquidityUsd ?? 0,
      recentTrades,
    });
  } catch (err) {
    console.error('SEC compliance check error (non-blocking):', err);
  }

  if (!secCompliance.compliant) {
    return NextResponse.json(
      { error: 'Trade blocked by SEC compliance check', secCompliance },
      { status: 422 },
    );
  }

  if (secCompliance.warnings.length > 0) {
    console.warn('SEC compliance warnings:', secCompliance.warnings);
  }

  // ── Stop-loss / take-profit levels ────────────────────────────────────────
  const stopLossPct  = body.stopLossPct  ?? parseFloat(process.env.STOP_LOSS_PERCENTAGE  ?? '10') / 100;
  const takeProfitPct = body.takeProfitPct ?? parseFloat(process.env.TAKE_PROFIT_PERCENTAGE ?? '25') / 100;
  const stopLoss   = currentPrice * (1 - stopLossPct);
  const takeProfit = currentPrice * (1 + takeProfitPct);

  // ── Apply pattern-memory weights for diagnostics ──────────────────────────
  const weightedScore = breakdown ? applyWeights(breakdown) : compositeScore;

  // ── Execute swap (or dry-run) ─────────────────────────────────────────────
  let entrySignature = 'dry-run';
  let tokensReceived = 0;

  if (!isDryRun) {
    try {
      const result = await buyTokenWithSol(tokenAddress, amountSol, getSlippageBps());
      entrySignature = result.signature;
      tokensReceived = result.tokensReceived;
    } catch (err) {
      return NextResponse.json(
        { error: `Swap failed: ${String(err)}` },
        { status: 502 },
      );
    }
  } else {
    // Dry-run: approximate token quantity using the token's current USD price.
    // Jupiter will return the real amount on live execution.
    tokensReceived = currentPrice > 0 ? Math.round((amountSol * 180) / currentPrice) : 0;
  }

  // ── Record position ───────────────────────────────────────────────────────
  const position = await openPosition({
    tokenAddress,
    tokenSymbol,
    tokenName,
    direction: 'LONG',
    entryPrice: currentPrice,
    entryAmountSol: amountSol,
    tokenAmount: tokensReceived,
    openedAt: Date.now(),
    signalScore: weightedScore,
    stopLoss,
    takeProfit,
    entrySignature,
    currentPrice,
    signalBreakdown: breakdown,
    isDryRun,
  });

  return NextResponse.json({
    success: true,
    position,
    audit,
    secCompliance,
    isDryRun,
    mode: isDryRun ? (isLive ? 'dry-run (no keypair)' : 'simulation') : 'live',
  });
}
