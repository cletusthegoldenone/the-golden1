import { NextRequest, NextResponse } from 'next/server';
import { getPosition, closePosition } from '@/lib/position-store';
import { sellTokenForSol, loadTradingKeypair } from '@/lib/jupiter';
import { recordOutcome } from '@/lib/pattern-memory';

function isAuthorised(req: NextRequest): boolean {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return true;
  return req.headers.get('x-admin-pin') === pin;
}

function getSlippageBps(): number {
  const pct = parseFloat(process.env.SLIPPAGE_TOLERANCE ?? '0.05');
  return Math.round(pct * 10_000);
}

interface CloseRequest {
  positionId: string;
  /** Current market price in USD — used to record PnL if the RPC price is unavailable */
  currentPrice?: number;
  reason?: 'MANUAL' | 'STOP_LOSS' | 'TAKE_PROFIT';
}

/** POST /api/trade/close-position */
export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: CloseRequest;
  try {
    body = await req.json() as CloseRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { positionId, currentPrice, reason = 'MANUAL' } = body;
  if (!positionId) {
    return NextResponse.json({ error: 'positionId is required' }, { status: 400 });
  }

  const position = await getPosition(positionId);
  if (!position) {
    return NextResponse.json({ error: `Position ${positionId} not found` }, { status: 404 });
  }

  const isLive = process.env.ENABLE_LIVE_TRADING === 'true';
  const hasKeypair = loadTradingKeypair() !== null;
  const isDryRun = !isLive || !hasKeypair || position.isDryRun;

  let exitSignature = 'dry-run';
  let exitPrice = currentPrice ?? position.currentPrice;

  if (!isDryRun) {
    try {
      const result = await sellTokenForSol(
        position.tokenAddress,
        position.tokenAmount,
        getSlippageBps(),
      );
      exitSignature = result.signature;
      // When closing a position we know the exact SOL received. Convert to a
      // USD exit price using the caller-supplied currentPrice as a reference.
      // If currentPrice is not provided, fall back to the stored last price.
      if (currentPrice) exitPrice = currentPrice;
    } catch (err) {
      return NextResponse.json(
        { error: `Swap failed: ${String(err)}` },
        { status: 502 },
      );
    }
  }

  const closed = await closePosition(positionId, exitPrice, exitSignature, reason);
  if (!closed) {
    return NextResponse.json({ error: 'Failed to close position (already closed?)' }, { status: 409 });
  }

  // Update pattern memory based on outcome
  if (position.signalBreakdown) {
    recordOutcome(position.signalBreakdown, closed.realisedPnlUsd > 0);
  }

  return NextResponse.json({
    success: true,
    closed,
    isDryRun,
  });
}
