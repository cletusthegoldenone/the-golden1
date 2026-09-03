import { NextRequest, NextResponse } from 'next/server';

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
