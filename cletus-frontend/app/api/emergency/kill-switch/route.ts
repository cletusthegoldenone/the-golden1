import { NextRequest, NextResponse } from 'next/server';
import { getOpenPositions, closePosition } from '@/lib/position-store';
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

/**
 * POST /api/emergency/kill-switch
 *
 * Closes ALL open positions immediately, converting token holdings back to SOL.
 * This action is irreversible. Each position is closed independently so a
 * failure on one does not prevent others from being closed.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const isLive = process.env.ENABLE_LIVE_TRADING === 'true';
  const hasKeypair = loadTradingKeypair() !== null;
  const isDryRun = !isLive || !hasKeypair;

  const openPositions = await getOpenPositions();
  if (openPositions.length === 0) {
    return NextResponse.json({
      status: 'NO_POSITIONS',
      message: 'No open positions to close',
      positionsClosed: 0,
      isDryRun,
      timestamp: new Date().toISOString(),
    });
  }

  const results: Array<{
    positionId: string;
    tokenSymbol: string;
    success: boolean;
    realisedPnlUsd?: number;
    error?: string;
  }> = [];

  let totalPnl = 0;

  // Close every position; don't stop on individual failures
  await Promise.allSettled(
    openPositions.map(async (pos) => {
      let exitSignature = 'dry-run';
      let exitPrice = pos.currentPrice;

      if (!isDryRun && !pos.isDryRun) {
        try {
          const result = await sellTokenForSol(pos.tokenAddress, pos.tokenAmount, getSlippageBps());
          exitSignature = result.signature;
        } catch (err) {
          results.push({
            positionId: pos.id,
            tokenSymbol: pos.tokenSymbol,
            success: false,
            error: String(err),
          });
          return;
        }
      }

      const closed = await closePosition(pos.id, exitPrice, exitSignature, 'KILL_SWITCH');
      if (closed) {
        if (pos.signalBreakdown) {
          recordOutcome(pos.signalBreakdown, closed.realisedPnlUsd > 0);
        }
        totalPnl += closed.realisedPnlUsd;
        results.push({
          positionId: pos.id,
          tokenSymbol: pos.tokenSymbol,
          success: true,
          realisedPnlUsd: closed.realisedPnlUsd,
        });
      }
    }),
  );

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    status: failed === 0 ? 'EXECUTED' : 'PARTIAL',
    positionsClosed: succeeded,
    positionsFailed: failed,
    totalRealisedPnlUsd: parseFloat(totalPnl.toFixed(2)),
    results,
    isDryRun,
    timestamp: new Date().toISOString(),
  });
}
