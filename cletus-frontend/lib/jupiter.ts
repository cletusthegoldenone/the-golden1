/**
 * Jupiter Aggregator v6 integration.
 *
 * Handles quote fetching, swap transaction construction, and on-chain signing
 * using the server-side trading wallet private key. The private key is NEVER
 * returned to the client — all signing happens here, server-side.
 */

import { Keypair, VersionedTransaction, Connection } from '@solana/web3.js';
import { getRpcUrl, getCurrentPriorityFee, recordRpcSuccess, recordRpcFailure } from './rpc';

// ── Well-known token mints ────────────────────────────────────────────────────

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ── Jupiter endpoint resolution ───────────────────────────────────────────────
// With a JUPITER_API_KEY the paid tier (api.jup.ag/swap/v1) is used, which has
// higher rate limits and priority routing. Without a key, the free public tier
// (quote-api.jup.ag/v6) is used as a fallback.

function getJupiterBaseUrl(): string {
  const key = process.env.JUPITER_API_KEY;
  if (key && key !== 'your_jupiter_api_key_here') {
    return 'https://api.jup.ag/swap/v1';
  }
  return 'https://quote-api.jup.ag/v6';
}

function getJupiterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const key = process.env.JUPITER_API_KEY;
  if (key && key !== 'your_jupiter_api_key_here') {
    headers['x-api-key'] = key;
  }
  return headers;
}

function getJupiterQuoteUrl(): string {
  return `${getJupiterBaseUrl()}/quote`;
}

function getJupiterSwapUrl(): string {
  return `${getJupiterBaseUrl()}/swap`;
}

// ── Base58 decoder ────────────────────────────────────────────────────────────

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeBase58(encoded: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of encoded) {
    const charIndex = BASE58_ALPHABET.indexOf(char);
    if (charIndex < 0) throw new Error(`Invalid base58 character: "${char}"`);
    let carry = charIndex;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < encoded.length && encoded[i] === '1'; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

// ── Private key loading ───────────────────────────────────────────────────────

/**
 * Load the trading wallet keypair from TRADING_WALLET_PRIVATE_KEY env var.
 * Supports both base58 strings (Phantom export) and JSON byte arrays ([...]).
 * Returns null when the env var is not set.
 */
export function loadTradingKeypair(): Keypair | null {
  const raw = process.env.TRADING_WALLET_PRIVATE_KEY;
  if (!raw || raw === 'your_base58_private_key_here') return null;

  const trimmed = raw.trim();
  try {
    // JSON array format: [12, 34, 56, ...]
    if (trimmed.startsWith('[')) {
      const bytes = JSON.parse(trimmed) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(bytes));
    }
    // Base58 string format (Phantom / CLI export)
    return Keypair.fromSecretKey(decodeBase58(trimmed));
  } catch (err) {
    throw new Error(`Failed to load trading keypair: ${String(err)}`);
  }
}

// ── Jupiter API types ─────────────────────────────────────────────────────────

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
  slippageBps: number;
  otherAmountThreshold: string;
  swapMode: string;
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export interface QuoteParams {
  /** Source token mint address */
  inputMint: string;
  /** Destination token mint address */
  outputMint: string;
  /** Amount in the smallest unit of the input token (lamports for SOL) */
  amount: number;
  /** Slippage in basis points (e.g. 500 = 5%) */
  slippageBps?: number;
}

/** Fetch the best route from Jupiter for the given parameters. */
export async function getQuote(params: QuoteParams): Promise<JupiterQuote> {
  const slippageBps = params.slippageBps ?? 500;
  const url = new URL(getJupiterQuoteUrl());
  url.searchParams.set('inputMint', params.inputMint);
  url.searchParams.set('outputMint', params.outputMint);
  url.searchParams.set('amount', String(params.amount));
  url.searchParams.set('slippageBps', String(slippageBps));

  const res = await fetch(url.toString(), {
    headers: getJupiterHeaders(),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jupiter quote error ${res.status}: ${body}`);
  }

  return res.json() as Promise<JupiterQuote>;
}

// ── Swap transaction ──────────────────────────────────────────────────────────

export interface SwapTransactionResult {
  swapTransaction: string; // base64-encoded VersionedTransaction
  lastValidBlockHeight: number;
}

/**
 * Get a swap transaction from Jupiter for a given quote.
 * The transaction is constructed for `userPublicKey` and must be signed before broadcasting.
 */
export async function buildSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string,
): Promise<SwapTransactionResult> {
  const priorityFee = getCurrentPriorityFee();

  const res = await fetch(getJupiterSwapUrl(), {
    method: 'POST',
    headers: getJupiterHeaders(),
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: priorityFee,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jupiter swap error ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    swapTransaction: string;
    lastValidBlockHeight: number;
  };
  return data;
}

// ── Sign and broadcast ────────────────────────────────────────────────────────

/**
 * Sign a Jupiter swap transaction with the trading keypair and send it.
 * Returns the Solana transaction signature.
 * Records success/failure with the self-healing RPC module.
 */
export async function signAndSendSwap(
  swapTransactionBase64: string,
  keypair: Keypair,
): Promise<string> {
  const connection = new Connection(getRpcUrl(), 'confirmed');

  const txBuffer = Buffer.from(swapTransactionBase64, 'base64');
  const transaction = VersionedTransaction.deserialize(txBuffer);
  transaction.sign([keypair]);

  const rawTransaction = transaction.serialize();
  let signature: string;
  try {
    signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 2,
    });
  } catch (err) {
    recordRpcFailure();
    throw err;
  }

  try {
    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      'confirmed',
    );
    recordRpcSuccess();
  } catch (err) {
    recordRpcFailure();
    throw err;
  }

  return signature;
}

// ── Convenience: buy a token with SOL ────────────────────────────────────────

export interface BuyResult {
  signature: string;
  /** Tokens received (parsed from the quote outAmount) */
  tokensReceived: number;
  /** Token output mint */
  outputMint: string;
}

/**
 * Buy `tokenMint` using `solAmount` SOL from the trading wallet.
 * Returns the transaction signature and token quantity received.
 */
export async function buyTokenWithSol(
  tokenMint: string,
  solAmount: number,
  slippageBps?: number,
): Promise<BuyResult> {
  const keypair = loadTradingKeypair();
  if (!keypair) throw new Error('TRADING_WALLET_PRIVATE_KEY is not configured');

  const lamports = Math.round(solAmount * 1e9);
  const quote = await getQuote({
    inputMint: WSOL_MINT,
    outputMint: tokenMint,
    amount: lamports,
    slippageBps,
  });

  const { swapTransaction } = await buildSwapTransaction(quote, keypair.publicKey.toBase58());
  const signature = await signAndSendSwap(swapTransaction, keypair);

  // outAmount is in the token's smallest unit; we'll return the raw value
  // (callers should convert using the token's decimals)
  const tokensReceived = parseInt(quote.outAmount, 10);

  return { signature, tokensReceived, outputMint: tokenMint };
}

// ── Convenience: sell tokens back to SOL ─────────────────────────────────────

export interface SellResult {
  signature: string;
  /** SOL received (lamports) */
  solReceived: number;
}

/**
 * Sell all of `tokenAmount` units of `tokenMint` back to SOL.
 */
export async function sellTokenForSol(
  tokenMint: string,
  tokenAmount: number,
  slippageBps?: number,
): Promise<SellResult> {
  const keypair = loadTradingKeypair();
  if (!keypair) throw new Error('TRADING_WALLET_PRIVATE_KEY is not configured');

  const quote = await getQuote({
    inputMint: tokenMint,
    outputMint: WSOL_MINT,
    amount: tokenAmount,
    slippageBps,
  });

  const { swapTransaction } = await buildSwapTransaction(quote, keypair.publicKey.toBase58());
  const signature = await signAndSendSwap(swapTransaction, keypair);
  const solReceived = parseInt(quote.outAmount, 10);

  return { signature, solReceived };
}
