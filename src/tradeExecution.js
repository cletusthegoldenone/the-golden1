const crypto = require('crypto');
const {
  RUGCHECK_ENABLED,
  RUGCHECK_API_URL_TEMPLATE,
  RUGCHECK_API_KEY,
  RUGCHECK_TIMEOUT_MS,
  RUGCHECK_HIGH_RISK_LEVELS,
  JUPITER_QUOTE_API_URL,
  JUPITER_SWAP_API_URL,
  JUPITER_TIMEOUT_MS,
  SOLANA_RPC_URL,
  SOLANA_RPC_TIMEOUT_MS
} = require('./config');
const { state, saveState } = require('./store');

class ExternalServiceError extends Error {
  constructor(reasonCode, status = 502, details = null) {
    super(reasonCode);
    this.reasonCode = reasonCode;
    this.status = status;
    this.details = details;
  }
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

async function fetchJson(url, options, { timeoutMs, reasonCode }) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: timeout.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ExternalServiceError(reasonCode, 502, {
        status: response.status,
        body: payload
      });
    }
    return payload;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    if (error && error.name === 'AbortError') {
      throw new ExternalServiceError(reasonCode, 504, { message: 'request_timed_out' });
    }
    throw new ExternalServiceError(reasonCode, 502, { message: error.message });
  } finally {
    timeout.clear();
  }
}

function getUserTransactions(identity) {
  if (!state.transactions.has(identity)) {
    state.transactions.set(identity, []);
  }
  return state.transactions.get(identity);
}

function recordTradeAttempt(identity, input, requestId) {
  const now = new Date().toISOString();
  const record = {
    attemptId: crypto.randomUUID(),
    requestId,
    createdAt: now,
    updatedAt: now,
    timestamp: now,
    status: 'pending',
    failureClass: null,
    reasonCode: null,
    reason: null,
    pair: input.pair || null,
    inputMint: input.inputMint || null,
    outputMint: input.outputMint || null,
    amount: input.amount ?? null,
    tradeSizeUsd: input.tradeSizeUsd ?? null,
    slippageBps: input.slippageBps ?? null,
    txSignature: null,
    quoteId: null,
    riskDecisions: [],
    metadata: {}
  };

  getUserTransactions(identity).push(record);
  saveState();
  return record;
}

function updateTradeAttempt(record, updates) {
  Object.assign(record, updates, { updatedAt: new Date().toISOString() });
  saveState();
  return record;
}

function riskLevelFromPayload(payload) {
  const candidates = [
    payload?.riskLevel,
    payload?.risk_rating,
    payload?.risk?.level,
    payload?.result?.riskLevel,
    payload?.token?.riskLevel,
    payload?.status
  ];
  const value = candidates.find((entry) => typeof entry === 'string' && entry.trim());
  return value ? value.trim().toLowerCase() : null;
}

function isHighRiskPayload(payload) {
  if (payload?.isHighRisk === true || payload?.highRisk === true) return true;
  const riskLevel = riskLevelFromPayload(payload);
  if (riskLevel && RUGCHECK_HIGH_RISK_LEVELS.includes(riskLevel)) return true;

  const scoreCandidates = [payload?.riskScore, payload?.risk_score, payload?.score];
  const score = scoreCandidates.find((value) => Number.isFinite(Number(value)));
  return score != null && Number(score) >= 80;
}

async function runRugcheck(mint, requestId) {
  if (!RUGCHECK_ENABLED || !mint) {
    return { mint, allowed: true, skipped: true, riskLevel: null, raw: null };
  }

  const url = RUGCHECK_API_URL_TEMPLATE.replace('{mint}', encodeURIComponent(mint));
  const headers = { Accept: 'application/json', 'X-Request-Id': requestId };
  if (RUGCHECK_API_KEY) headers.Authorization = 'Bearer ' + RUGCHECK_API_KEY;
  const payload = await fetchJson(url, { headers }, { timeoutMs: RUGCHECK_TIMEOUT_MS, reasonCode: 'RUGCHECK_REQUEST_FAILED' });
  const riskLevel = riskLevelFromPayload(payload);
  const allowed = !isHighRiskPayload(payload);
  return {
    mint,
    allowed,
    riskLevel,
    raw: payload
  };
}

async function evaluateRiskGate({ inputMint, outputMint, requestId }) {
  const seen = new Set();
  const decisions = [];
  for (const mint of [inputMint, outputMint]) {
    if (!mint || seen.has(mint)) continue;
    seen.add(mint);
    decisions.push(await runRugcheck(mint, requestId));
  }

  const blocked = decisions.find((entry) => entry.allowed === false);
  if (blocked) {
    return {
      allowed: false,
      reasonCode: 'RUGCHECK_HIGH_RISK_BLOCKED',
      reason: `Trade blocked because ${blocked.mint} is high risk.`,
      decisions
    };
  }

  return {
    allowed: true,
    reasonCode: 'RUGCHECK_PASSED',
    reason: 'Risk gate passed.',
    decisions
  };
}

function quoteUrl({ inputMint, outputMint, amount, slippageBps }) {
  const url = new URL(JUPITER_QUOTE_API_URL);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', String(amount));
  url.searchParams.set('slippageBps', String(slippageBps ?? 50));
  return url.toString();
}

async function getJupiterQuote({ inputMint, outputMint, amount, slippageBps, requestId }) {
  return fetchJson(
    quoteUrl({ inputMint, outputMint, amount, slippageBps }),
    {
      headers: { Accept: 'application/json', 'X-Request-Id': requestId }
    },
    { timeoutMs: JUPITER_TIMEOUT_MS, reasonCode: 'JUPITER_QUOTE_FAILED' }
  );
}

async function getJupiterSwap({ quoteResponse, userPublicKey, requestId }) {
  return fetchJson(
    JUPITER_SWAP_API_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true
      })
    },
    { timeoutMs: JUPITER_TIMEOUT_MS, reasonCode: 'JUPITER_SWAP_FAILED' }
  );
}

async function submitSignedTransaction({ signedTransaction, requestId }) {
  if (!SOLANA_RPC_URL) {
    throw new ExternalServiceError('SOLANA_RPC_NOT_CONFIGURED', 500);
  }

  const payload = await fetchJson(
    SOLANA_RPC_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method: 'sendTransaction',
        params: [signedTransaction, { encoding: 'base64', skipPreflight: false }]
      })
    },
    { timeoutMs: SOLANA_RPC_TIMEOUT_MS, reasonCode: 'SOLANA_TX_FAILED' }
  );

  if (payload.error) {
    throw new ExternalServiceError('SOLANA_TX_FAILED', 502, payload.error);
  }

  return payload.result;
}

module.exports = {
  ExternalServiceError,
  evaluateRiskGate,
  getJupiterQuote,
  getJupiterSwap,
  recordTradeAttempt,
  submitSignedTransaction,
  updateTradeAttempt
};
