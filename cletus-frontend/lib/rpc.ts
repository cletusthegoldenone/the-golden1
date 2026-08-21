/**
 * Self-healing Helius RPC client.
 *
 * Tracks consecutive RPC failures and automatically escalates priority fees
 * to keep transactions landing during congestion. Recovers back to baseline
 * after sustained success.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum priority fee in micro-lamports per compute unit */
const BASELINE_PRIORITY_FEE_LAMPORTS = parseInt(
  process.env.PRIORITY_FEE_LAMPORTS ?? '100000',
  10,
);

const MAX_PRIORITY_FEE_LAMPORTS = 2_000_000; // 0.002 SOL — hard cap

/** Number of consecutive failures before escalating the priority fee */
const FAILURES_BEFORE_ESCALATION = 3;

/** How many consecutive successes are needed to step the fee back down */
const SUCCESSES_TO_RECOVER = 5;

// ── Mutable self-healing state ────────────────────────────────────────────────

let consecutiveFailures = 0;
let consecutiveSuccesses = 0;
let currentPriorityFee = BASELINE_PRIORITY_FEE_LAMPORTS;

// ── RPC URL builder ───────────────────────────────────────────────────────────

/**
 * Returns the best available Solana RPC URL.
 * Prefers HELIUS_API_KEY (server-only secret) to construct the URL, then falls
 * back to NEXT_PUBLIC_HELIUS_RPC_URL, then the public mainnet endpoint.
 */
export function getRpcUrl(): string {
  const apiKey = process.env.HELIUS_API_KEY;
  if (apiKey && apiKey !== 'your_helius_api_key_here') {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }

  const publicUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (publicUrl) return publicUrl;

  const fallback = process.env.RPC_URL;
  if (fallback) return fallback;

  return 'https://api.mainnet-beta.solana.com';
}

// ── Self-healing state accessors ──────────────────────────────────────────────

/** Current adaptive priority fee in lamports. */
export function getCurrentPriorityFee(): number {
  return currentPriorityFee;
}

/** Return current self-healing diagnostics (for the system-status endpoint). */
export function getSelfHealingState() {
  return {
    consecutiveFailures,
    consecutiveSuccesses,
    currentPriorityFee,
    baselinePriorityFee: BASELINE_PRIORITY_FEE_LAMPORTS,
    isEscalated: currentPriorityFee > BASELINE_PRIORITY_FEE_LAMPORTS,
  };
}

/**
 * Call after any successful RPC interaction.
 * Gradually walks the priority fee back toward baseline.
 */
export function recordRpcSuccess(): void {
  consecutiveFailures = 0;
  consecutiveSuccesses++;

  if (consecutiveSuccesses >= SUCCESSES_TO_RECOVER && currentPriorityFee > BASELINE_PRIORITY_FEE_LAMPORTS) {
    // Step fee back down by halving it (floored at baseline)
    currentPriorityFee = Math.max(
      BASELINE_PRIORITY_FEE_LAMPORTS,
      Math.floor(currentPriorityFee / 2),
    );
    consecutiveSuccesses = 0;
  }
}

/**
 * Call after any failed RPC interaction.
 * Escalates the priority fee exponentially until the hard cap is reached.
 */
export function recordRpcFailure(): void {
  consecutiveSuccesses = 0;
  consecutiveFailures++;

  if (consecutiveFailures >= FAILURES_BEFORE_ESCALATION) {
    // Double the priority fee on sustained failures
    currentPriorityFee = Math.min(
      MAX_PRIORITY_FEE_LAMPORTS,
      currentPriorityFee * 2,
    );
    consecutiveFailures = 0; // Reset counter so next batch of failures escalates again
  }
}

// ── JSON-RPC helper ───────────────────────────────────────────────────────────

/**
 * Execute a Solana JSON-RPC call against the Helius endpoint.
 * Records success/failure for self-healing.
 */
export async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const url = getRpcUrl();
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    recordRpcFailure();
    throw new Error(`RPC network error: ${String(err)}`);
  }

  if (!res.ok) {
    recordRpcFailure();
    throw new Error(`RPC HTTP ${res.status}`);
  }

  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) {
    recordRpcFailure();
    throw new Error(`RPC error: ${json.error.message}`);
  }
  if (json.result === undefined) {
    recordRpcFailure();
    throw new Error('Empty RPC result');
  }

  recordRpcSuccess();
  return json.result;
}
