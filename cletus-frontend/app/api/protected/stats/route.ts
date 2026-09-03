import { NextResponse } from 'next/server';

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

export async function GET() {
  return NextResponse.json(EMPTY_STATS, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
