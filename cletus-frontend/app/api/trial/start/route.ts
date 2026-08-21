import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const wallet = body.wallet;
    
    // Simulate trial activation and persist / return success
    return NextResponse.json({
      success: true,
      wallet,
      message: '30-day free trial activated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to activate trial' },
      { status: 500 }
    );
  }
}
