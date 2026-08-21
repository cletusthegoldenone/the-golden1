import { NextResponse } from 'next/server';
import { getOpenPositions, getClosedPositions, getStats } from '@/lib/position-store';

/** GET /api/trade/positions — return all open and recent closed positions */
export async function GET() {
  const open = await getOpenPositions();
  const closed = await getClosedPositions();
  const stats = await getStats();

  return NextResponse.json({
    open,
    closed,
    stats,
    timestamp: Date.now(),
  });
}
