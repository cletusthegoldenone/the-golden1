import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fullLegalName = String(body.fullLegalName ?? '').trim();
    const email = String(body.email ?? '').trim();
    const country = String(body.country ?? '').trim();
    const legalAcceptedAt = String(body.legalAcceptedAt ?? '').trim();
    const acknowledgedAt = String(body.acknowledgedAt ?? '').trim();

    if (!fullLegalName || !email.includes('@') || !country || !legalAcceptedAt || !acknowledgedAt) {
      return NextResponse.json({ error: 'Missing required registration fields' }, { status: 400 });
    }

    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const session = {
      email,
      fullLegalName,
      country,
      trialStartedAt: startedAt,
      trialExpiresAt: expiresAt,
    };

    const response = NextResponse.json({
      success: true,
      message: '30-day free trial activated successfully',
      trialStartedAt: startedAt,
      trialDays: 30,
    });

    response.cookies.set('cletus_trial_session', JSON.stringify(session), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Failed to activate trial' },
      { status: 500 }
    );
  }
}
