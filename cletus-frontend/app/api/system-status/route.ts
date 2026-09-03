import { NextResponse } from 'next/server';
import { getRpcUrl, getSelfHealingState } from '@/lib/rpc';
import { getSignalStats } from '@/lib/pattern-memory';
import { getStats } from '@/lib/position-store';

async function ping(url: string, timeoutMs = 4_000): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/**
 * GET /api/system-status
 *
 * Returns a live health-check across all external services, self-healing
 * parameters, pattern memory state, and position stats.
 */
export async function GET() {
  const rpcUrl = getRpcUrl();

  // Check services in parallel
  const [rpcCheck, dexCheck, geminiCheck, jupiterCheck] = await Promise.all([
    // Helius RPC — call getHealth JSON-RPC method
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
      signal: AbortSignal.timeout(4_000),
    })
      .then(async (r) => {
        const latency = Date.now(); // approximate
        const json = await r.json() as { result?: string };
        return { ok: json.result === 'ok', latencyMs: latency, label: 'Helius RPC' };
      })
      .catch(() => ({ ok: false, latencyMs: 0, label: 'Helius RPC' })),

    ping('https://api.dexscreener.com/token-boosts/top/v1').then((r) => ({
      ...r,
      label: 'DexScreener',
    })),

    // Gemini — only check that the API key is set and non-default.
    // We avoid a live ping to prevent burning quota on health checks.
    // The response labels this as "key configured" to make the scope clear.
    Promise.resolve({
      ok: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      latencyMs: 0,
      label: 'Gemini AI (key configured)',
    }),

    // Jupiter API
    ping(
      process.env.JUPITER_API_KEY
        ? 'https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50'
        : 'https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50',
    ).then((r) => ({ ...r, label: 'Jupiter' })),
  ]);

  const services = [rpcCheck, dexCheck, geminiCheck, jupiterCheck];
  const allHealthy = services.every((s) => s.ok);

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),

    services: services.map((s) => ({
      label: s.label,
      status: s.ok ? 'operational' : 'down',
      latencyMs: s.latencyMs || null,
    })),

    config: {
      liveTrading: process.env.ENABLE_LIVE_TRADING === 'true',
      killSwitchEnabled: process.env.ENABLE_KILL_SWITCH !== 'false',
      hasPrivateKey: !!process.env.TRADING_WALLET_PRIVATE_KEY && process.env.TRADING_WALLET_PRIVATE_KEY !== 'your_base58_private_key_here',
      hasJupiterKey: !!process.env.JUPITER_API_KEY && process.env.JUPITER_API_KEY !== 'your_jupiter_api_key_here',
      hasRugcheckKey: !!process.env.RUGCHECK_API_KEY && process.env.RUGCHECK_API_KEY !== 'your_rugcheck_api_key_here',
      minCompositeScore: parseFloat(process.env.MIN_COMPOSITE_SCORE ?? '0.65'),
      maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS ?? '5', 10),
    },

    selfHealing: getSelfHealingState(),

    patternMemory: getSignalStats(),

    positionStats: await getStats(),
  });
}
