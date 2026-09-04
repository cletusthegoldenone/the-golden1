import { NextRequest, NextResponse } from 'next/server';
import { getOpenPositions, getClosedPositions, getStats } from '@/lib/position-store';

/** GET /api/trade/positions — return all open and recent closed positions */
export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get('mint')?.trim().toLowerCase();
  const [openPositions, closedPositions, stats] = await Promise.all([
    getOpenPositions(),
    getClosedPositions(),
    getStats(),
  ]);
  const open = mint
    ? openPositions.filter((position) => position.tokenAddress.trim().toLowerCase() === mint)
    : openPositions;
  const closed = mint
    ? closedPositions.filter((position) => position.tokenAddress.trim().toLowerCase() === mint)
    : closedPositions;

  return NextResponse.json({
    open,
    closed,
    stats,
    timestamp: Date.now(),
  });
}
