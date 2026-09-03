import { NextRequest, NextResponse } from 'next/server';
import { getClosedPositions, getStats } from '@/lib/position-store';

const EMPTY_STATS = {
  pnl24h: 0,
  pnl24hPercent: 0,
  winRate: 0,
  activePositions: 0,
  totalTrades: 0,
  bestTrade: 0,
  worstTrade: 0,
  sharpeRatio: 0,
  trialActive: true,
  daysRemaining: 30,
  identity: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function buildSharpeRatio(
  closedPositions: Array<{ entryPrice: number; tokenAmount: number; realisedPnlUsd: number }>
) {
  const returns = closedPositions
    .map((position) => {
      const basis = position.entryPrice * position.tokenAmount;
      return basis > 0 ? position.realisedPnlUsd / basis : 0;
    })
    .filter((value) => Number.isFinite(value));

  if (returns.length === 0) return 0;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) {
    return mean > 0 ? mean : 0;
  }

  return mean / standardDeviation;
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('cletus_trial_session')?.value;
  if (!sessionCookie) {
    return NextResponse.json(
      { error: 'No active trial session' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  let identity: string | null = null;
  let daysRemaining = 30;

  try {
    const parsed = JSON.parse(sessionCookie) as {
      email?: string;
      trialExpiresAt?: string;
    };
    identity = parsed.email ?? null;
    if (parsed.trialExpiresAt) {
      const msLeft = new Date(parsed.trialExpiresAt).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid trial session' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  try {
    const [stats, closedPositions] = await Promise.all([getStats(), getClosedPositions()]);
    const since = Date.now() - DAY_MS;
    const last24hClosed = closedPositions.filter((position) => position.closedAt >= since);
    const pnl24h = last24hClosed.reduce((sum, position) => sum + position.realisedPnlUsd, 0);
    const notional24h = last24hClosed.reduce(
      (sum, position) => sum + position.entryPrice * position.tokenAmount,
      0
    );

    return NextResponse.json(
      {
        ...EMPTY_STATS,
        identity,
        pnl24h,
        pnl24hPercent: notional24h > 0 ? (pnl24h / notional24h) * 100 : 0,
        winRate: stats.winRate * 100,
        activePositions: stats.openTrades,
        totalTrades: stats.totalTrades,
        bestTrade: stats.bestTrade,
        worstTrade: stats.worstTrade,
        sharpeRatio: buildSharpeRatio(closedPositions),
        trialActive: daysRemaining > 0,
        daysRemaining,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Failed to load protected stats:', error);

    return NextResponse.json(
      {
        ...EMPTY_STATS,
        identity,
        trialActive: daysRemaining > 0,
        daysRemaining,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
