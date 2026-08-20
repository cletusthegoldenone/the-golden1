const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULES_TO_CLEAR = [
  'src/server.js',
  'src/config.js',
  'src/store.js',
  'src/legal.js',
  'src/auth.js',
  'src/authProvider.js',
  'src/solanaWallet.js',
  'src/persistence.js',
  'src/tradingAuth.js',
  'src/rateLimit.js',
  'src/tradeExecution.js'
].map((relativePath) => path.join(ROOT, relativePath));

function clearAppModules() {
  for (const modulePath of MODULES_TO_CLEAR) {
    delete require.cache[modulePath];
  }
}

function setupEnv(overrides = {}) {
  process.env.SESSION_SECRET = overrides.SESSION_SECRET || 'test-session-secret';
  process.env.AUTH_BOOTSTRAP_TOKEN = overrides.AUTH_BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  process.env.AUTH_PROVIDER = overrides.AUTH_PROVIDER || 'bootstrap';
  process.env.AUTH_CHALLENGE_TTL_SECONDS = overrides.AUTH_CHALLENGE_TTL_SECONDS || '120';
  process.env.AUTH_REQUIRE_SECURE_TRANSPORT = overrides.AUTH_REQUIRE_SECURE_TRANSPORT || 'false';
  process.env.TRUST_PROXY = overrides.TRUST_PROXY || 'true';
  process.env.NODE_ENV = overrides.NODE_ENV || 'test';
  process.env.SESSION_TTL_SECONDS = overrides.SESSION_TTL_SECONDS || '3600';
  process.env.SESSION_COOKIE_NAME = overrides.SESSION_COOKIE_NAME || 'tg1_session';
  process.env.SESSION_COOKIE_SECURE = overrides.SESSION_COOKIE_SECURE || 'false';
  process.env.SESSION_COOKIE_SAME_SITE = overrides.SESSION_COOKIE_SAME_SITE || 'Strict';
  process.env.SESSION_COOKIE_PATH = overrides.SESSION_COOKIE_PATH || '/';
  process.env.SESSION_COOKIE_DOMAIN = overrides.SESSION_COOKIE_DOMAIN || '';
  process.env.PERSISTENCE_FILE_PATH = overrides.PERSISTENCE_FILE_PATH;
  process.env.PERSISTENCE_ADAPTER = overrides.PERSISTENCE_ADAPTER || 'file';
  process.env.DATABASE_URL = overrides.DATABASE_URL || '';
  process.env.HELIUS_API_KEY = Object.prototype.hasOwnProperty.call(overrides, 'HELIUS_API_KEY') ? overrides.HELIUS_API_KEY : '';
  process.env.SOLANA_RPC_URL = Object.prototype.hasOwnProperty.call(overrides, 'SOLANA_RPC_URL') ? overrides.SOLANA_RPC_URL : '';
  process.env.OPERATOR_AUTH_TOKEN = Object.prototype.hasOwnProperty.call(overrides, 'OPERATOR_AUTH_TOKEN') ? overrides.OPERATOR_AUTH_TOKEN : '';
  process.env.OPERATOR_IDENTITIES = overrides.OPERATOR_IDENTITIES || '';
  process.env.JUPITER_QUOTE_API_URL = overrides.JUPITER_QUOTE_API_URL || 'https://quote-api.jup.ag/v6/quote';
  process.env.JUPITER_SWAP_API_URL = overrides.JUPITER_SWAP_API_URL || 'https://quote-api.jup.ag/v6/swap';
  process.env.RUGCHECK_ENABLED = overrides.RUGCHECK_ENABLED || 'true';
  process.env.RUGCHECK_API_URL_TEMPLATE = overrides.RUGCHECK_API_URL_TEMPLATE || 'https://api.rugcheck.xyz/v1/tokens/{mint}/report';
  process.env.RUGCHECK_API_KEY = overrides.RUGCHECK_API_KEY || '';
  process.env.RUGCHECK_TIMEOUT_MS = overrides.RUGCHECK_TIMEOUT_MS || '5000';
  process.env.RUGCHECK_HIGH_RISK_LEVELS = overrides.RUGCHECK_HIGH_RISK_LEVELS || 'high,critical,danger,dangerous,scam';
  process.env.RATE_LIMIT_PUBLIC_MAX = overrides.RATE_LIMIT_PUBLIC_MAX || '1000';
  process.env.RATE_LIMIT_PUBLIC_WINDOW_MS = overrides.RATE_LIMIT_PUBLIC_WINDOW_MS || '60000';
  process.env.RATE_LIMIT_PROTECTED_MAX = overrides.RATE_LIMIT_PROTECTED_MAX || '1000';
  process.env.RATE_LIMIT_PROTECTED_WINDOW_MS = overrides.RATE_LIMIT_PROTECTED_WINDOW_MS || '60000';
  process.env.RATE_LIMIT_AUTH_MAX = overrides.RATE_LIMIT_AUTH_MAX || '10';
  process.env.RATE_LIMIT_AUTH_WINDOW_MS = overrides.RATE_LIMIT_AUTH_WINDOW_MS || '900000';
  process.env.MAX_TRADE_AMOUNT = overrides.MAX_TRADE_AMOUNT || '1000000000000';
  process.env.MAX_TRADE_SIZE_USD = overrides.MAX_TRADE_SIZE_USD || '1000000';
  process.env.CORS_ALLOWED_ORIGINS = overrides.CORS_ALLOWED_ORIGINS || '';
}

function loadApp(overrides = {}) {
  setupEnv(overrides);
  clearAppModules();
  const { createApp } = require('../src/server');
  const { getUser, resetState, state } = require('../src/store');
  return { createApp, getUser, resetState, state };
}

function dataFilePath(name) {
  return path.join(os.tmpdir(), 'the-golden1-tests', `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

async function startServer(createApp) {
  const app = createApp();
  await new Promise((resolve) => app.listen(0, resolve));
  const { port } = app.address();
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

async function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

async function requestServer(server, { method = 'GET', path: requestPath = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.app.address().port,
        method,
        path: requestPath,
        headers
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8')
          });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function bootstrapUser(baseUrl, identity) {
  const acceptRes = await postJson(`${baseUrl}/api/legal/accept`, { identity, accepted: true }, { 'x-session-id': `sess-${identity}` });
  assert.equal(acceptRes.status, 200);

  const registerRes = await postJson(`${baseUrl}/api/register`, { identity });
  assert.equal(registerRes.status, 200);
}

async function login(baseUrl, identity, token = 'test-bootstrap-token') {
  const res = await postJson(`${baseUrl}/api/session/login`, { identity }, { 'x-bootstrap-token': token });
  return {
    res,
    cookie: res.headers.get('set-cookie')
  };
}

function createWalletSigner() {
  const { generateKeyPairSync, sign } = require('crypto');
  const pair = generateKeyPairSync('ed25519');
  const der = pair.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBytes = Buffer.from(der.slice(-32));
  return {
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
    publicKeyBase58: base58Encode(publicKeyBytes),
    sign(message) {
      return sign(null, Buffer.from(message), pair.privateKey).toString('base64');
    }
  };
}

function base58Encode(buffer) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  if (!buffer.length) return '';
  let digits = [0];
  for (const byte of buffer) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let prefix = '';
  for (const byte of buffer) {
    if (byte !== 0) break;
    prefix += '1';
  }
  return prefix + digits.reverse().map((digit) => alphabet[digit]).join('');
}

async function startMockApiServer(handler) {
  const app = require('http').createServer(handler);
  await new Promise((resolve) => app.listen(0, resolve));
  const { port } = app.address();
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

test('protected routes require validated auth session and reject spoofed identity context', async () => {
  const persistencePath = dataFilePath('auth-enforcement');
  const { createApp, resetState } = loadApp({ PERSISTENCE_FILE_PATH: persistencePath });
  resetState();
  const { app, baseUrl } = await startServer(createApp);

  try {
    await bootstrapUser(baseUrl, 'u1');

    const missingAuth = await postJson(`${baseUrl}/api/trade/check`, { pair: 'SOL/USDC' });
    assert.equal(missingAuth.status, 401);
    assert.equal((await missingAuth.json()).reasonCode, 'AUTH_REQUIRED');

    const invalidAuth = await postJson(
      `${baseUrl}/api/trade/check`,
      { pair: 'SOL/USDC' },
      { authorization: '******' }
    );
    assert.equal(invalidAuth.status, 401);
    assert.equal((await invalidAuth.json()).reasonCode, 'AUTH_REQUIRED');

    const malformedBearer = await postJson(
      `${baseUrl}/api/trade/check`,
      { pair: 'SOL/USDC' },
      { cookie: 'tg1_session=bad.token' }
    );
    assert.equal(malformedBearer.status, 401);
    assert.equal((await malformedBearer.json()).reasonCode, 'AUTH_INVALID');

    const deniedLogin = await login(baseUrl, 'u1', 'wrong-token');
    assert.equal(deniedLogin.res.status, 401);
    assert.equal((await deniedLogin.res.json()).reasonCode, 'AUTH_BOOTSTRAP_INVALID');

    const authLogin = await login(baseUrl, 'u1');
    assert.equal(authLogin.res.status, 200);
    assert.ok(authLogin.cookie);

    const statusRes = await fetch(`${baseUrl}/api/protected/onboarding/status`, {
      headers: { cookie: authLogin.cookie }
    });
    assert.equal(statusRes.status, 200);

    const mismatchRes = await fetch(`${baseUrl}/api/protected/onboarding/status?identity=evil`, {
      headers: { cookie: authLogin.cookie }
    });
    assert.equal(mismatchRes.status, 403);
    assert.equal((await mismatchRes.json()).reasonCode, 'AUTH_IDENTITY_MISMATCH');
  } finally {
    app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('decodeSignature accepts canonical base64 and base58 and rejects malformed inputs', () => {
  clearAppModules();
  const { decodeSignature } = require('../src/solanaWallet');
  const bytes = Buffer.from(Array.from({ length: 64 }, (_, index) => index));
  const base64 = bytes.toString('base64');
  const base58 = base58Encode(bytes);

  assert.deepEqual(decodeSignature(base64), bytes);
  assert.deepEqual(decodeSignature(base58), bytes);
  assert.throws(() => decodeSignature(`${base64.slice(0, -1)}!`), /AUTH_SIGNATURE_INVALID/);
  assert.throws(() => decodeSignature('Zm9v'), /AUTH_SIGNATURE_INVALID/);
  assert.throws(() => decodeSignature(base64.replace(/=+$/, '')), /AUTH_SIGNATURE_INVALID/);
});

test('file-backed persistence survives restart for consent, onboarding, wallet state, and operator flags', async () => {
  const persistencePath = dataFilePath('durability');
  const first = loadApp({ PERSISTENCE_FILE_PATH: persistencePath, OPERATOR_AUTH_TOKEN: 'durability-operator' });
  first.resetState();
  const server1 = await startServer(first.createApp);

  try {
    await bootstrapUser(server1.baseUrl, 'u2');
    const authLogin = await login(server1.baseUrl, 'u2');
    assert.equal(authLogin.res.status, 200);

    const walletRes = await postJson(
      `${server1.baseUrl}/api/protected/onboarding/wallet-mode`,
      {
        mode: 'external',
        allowedActions: ['swap'],
        maxTradeSizeUsd: 1000
      },
      { cookie: authLogin.cookie }
    );
    assert.equal(walletRes.status, 200);

    const killSwitchRes = await postJson(
      `${server1.baseUrl}/api/protected/operator/kill-switch`,
      { enabled: true, reason: 'maintenance window' },
      { cookie: authLogin.cookie, 'x-operator-token': 'durability-operator', 'x-request-id': 'durability-1' }
    );
    assert.equal(killSwitchRes.status, 200);
  } finally {
    server1.app.close();
  }

  const second = loadApp({ PERSISTENCE_FILE_PATH: persistencePath, OPERATOR_AUTH_TOKEN: 'durability-operator' });
  const server2 = await startServer(second.createApp);

  try {
    const authLogin = await login(server2.baseUrl, 'u2');
    assert.equal(authLogin.res.status, 200);

    const consentRes = await fetch(`${server2.baseUrl}/api/protected/legal/consents`, {
      headers: { cookie: authLogin.cookie }
    });
    const consentPayload = await consentRes.json();
    assert.equal(consentPayload.consents.length, 1);

    const walletStatusRes = await fetch(`${server2.baseUrl}/api/protected/wallet/status`, {
      headers: { cookie: authLogin.cookie }
    });
    const walletStatus = await walletStatusRes.json();
    assert.equal(walletStatus.mode, 'external');
    assert.equal(walletStatus.delegation.maxTradeSizeUsd, 1000);

    const tradeRes = await postJson(
      `${server2.baseUrl}/api/trade/check`,
      { pair: 'SOL/USDC', tradeSizeUsd: 1 },
      { cookie: authLogin.cookie }
    );
    const tradePayload = await tradeRes.json();
    assert.equal(tradePayload.reasonCode, 'GLOBAL_KILL_SWITCH_ACTIVE');
  } finally {
    server2.app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('rate limiting returns deterministic 429 payloads for public and protected routes', async () => {
  const publicPersistencePath = dataFilePath('rate-limit-public');
  const publicAppModules = loadApp({
    PERSISTENCE_FILE_PATH: publicPersistencePath,
    RATE_LIMIT_PUBLIC_MAX: '2',
    RATE_LIMIT_PROTECTED_MAX: '1000',
    RATE_LIMIT_PUBLIC_WINDOW_MS: '60000',
    RATE_LIMIT_PROTECTED_WINDOW_MS: '60000'
  });
  publicAppModules.resetState();
  const publicServer = await startServer(publicAppModules.createApp);

  try {
    const legal1 = await fetch(`${publicServer.baseUrl}/legal`);
    assert.equal(legal1.status, 200);
    const legal2 = await fetch(`${publicServer.baseUrl}/legal`);
    assert.equal(legal2.status, 200);
    const legal3 = await fetch(`${publicServer.baseUrl}/legal`);
    assert.equal(legal3.status, 429);
    const payload = await legal3.json();
    assert.equal(payload.reasonCode, 'RATE_LIMIT_EXCEEDED');
    assert.equal(payload.scope, 'public');
  } finally {
    publicServer.app.close();
    fs.rmSync(publicPersistencePath, { force: true });
  }

  const protectedPersistencePath = dataFilePath('rate-limit-protected');
  const protectedAppModules = loadApp({
    PERSISTENCE_FILE_PATH: protectedPersistencePath,
    RATE_LIMIT_PUBLIC_MAX: '1000',
    RATE_LIMIT_PROTECTED_MAX: '1',
    RATE_LIMIT_PUBLIC_WINDOW_MS: '60000',
    RATE_LIMIT_PROTECTED_WINDOW_MS: '60000'
  });
  protectedAppModules.resetState();
  const protectedServer = await startServer(protectedAppModules.createApp);

  try {
    await bootstrapUser(protectedServer.baseUrl, 'u3');
    const authLogin = await login(protectedServer.baseUrl, 'u3');
    assert.equal(authLogin.res.status, 200);

    const firstProtected = await fetch(`${protectedServer.baseUrl}/api/protected/onboarding/status`, {
      headers: { cookie: authLogin.cookie }
    });
    assert.equal(firstProtected.status, 200);

    const protectedRes = await fetch(`${protectedServer.baseUrl}/api/protected/onboarding/status`, {
      headers: { cookie: authLogin.cookie }
    });
    assert.equal(protectedRes.status, 429);
    const protectedPayload = await protectedRes.json();
    assert.equal(protectedPayload.reasonCode, 'RATE_LIMIT_EXCEEDED');
    assert.equal(protectedPayload.scope, 'protected');
  } finally {
    protectedServer.app.close();
    fs.rmSync(protectedPersistencePath, { force: true });
  }
});

test('auth rate limiting normalizes forwarded IP chains', async () => {
  const persistencePath = dataFilePath('auth-rate-limit');
  const { createApp, resetState } = loadApp({
    PERSISTENCE_FILE_PATH: persistencePath,
    AUTH_PROVIDER: 'wallet_challenge',
    RATE_LIMIT_PUBLIC_MAX: '1000',
    RATE_LIMIT_AUTH_MAX: '2',
    RATE_LIMIT_AUTH_WINDOW_MS: '60000'
  });
  resetState();
  const server = await startServer(createApp);
  const wallet = createWalletSigner();

  try {
    const first = await postJson(
      `${server.baseUrl}/api/auth/challenge`,
      { walletPublicKey: wallet.publicKeyBase58 },
      { 'x-forwarded-for': '203.0.113.4, 10.0.0.1' }
    );
    assert.equal(first.status, 200);

    const second = await postJson(
      `${server.baseUrl}/api/auth/challenge`,
      { walletPublicKey: wallet.publicKeyBase58 },
      { 'x-forwarded-for': '203.0.113.4, 10.0.0.2' }
    );
    assert.equal(second.status, 200);

    const third = await postJson(
      `${server.baseUrl}/api/auth/challenge`,
      { walletPublicKey: wallet.publicKeyBase58 },
      { 'x-forwarded-for': '203.0.113.4, 10.0.0.3' }
    );
    assert.equal(third.status, 429);
    const payload = await third.json();
    assert.equal(payload.reasonCode, 'RATE_LIMIT_EXCEEDED');
    assert.equal(payload.scope, 'auth');
  } finally {
    server.app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('policy and delegation reason codes remain unchanged with stronger auth/session controls', async () => {
  const persistencePath = dataFilePath('policy-behavior');
  const { createApp, getUser, resetState } = loadApp({ PERSISTENCE_FILE_PATH: persistencePath });
  resetState();
  const { app, baseUrl } = await startServer(createApp);

  try {
    await bootstrapUser(baseUrl, 'u4');
    const authLogin = await login(baseUrl, 'u4');
    assert.equal(authLogin.res.status, 200);

    const walletRes = await postJson(
      `${baseUrl}/api/protected/onboarding/wallet-mode`,
      {
        mode: 'external',
        allowedActions: ['swap'],
        maxTradeSizeUsd: 100,
        expiresAt: '2000-01-01T00:00:00.000Z'
      },
      { cookie: authLogin.cookie }
    );
    assert.equal(walletRes.status, 200);

    let tradeRes = await postJson(
      `${baseUrl}/api/trade/check`,
      { pair: 'SOL/USDC', action: 'swap', tradeSizeUsd: 10 },
      { cookie: authLogin.cookie }
    );
    assert.equal((await tradeRes.json()).reasonCode, 'DELEGATION_EXPIRED');

    const user = getUser('u4');
    user.wallet.delegatedPermission.expiresAt = null;
    user.trialStartedAt = '2025-01-01T00:00:00.000Z';
    user.stakeActive = false;
    user.constraints.whitelistMode = true;
    user.constraints.allowedPairs = ['BONK/USDC'];

    tradeRes = await postJson(
      `${baseUrl}/api/trade/check`,
      { pair: 'SOL/USDC', action: 'swap', tradeSizeUsd: 10 },
      { cookie: authLogin.cookie }
    );
    assert.equal((await tradeRes.json()).reasonCode, 'PAIR_NOT_WHITELISTED');

    tradeRes = await postJson(
      `${baseUrl}/api/trade/check`,
      { pair: 'BONK/USDC', action: 'swap', tradeSizeUsd: 10 },
      { cookie: authLogin.cookie }
    );
    assert.equal((await tradeRes.json()).reasonCode, 'TRIAL_ENDED_STAKE_REQUIRED');
  } finally {
    app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('trade input upper bounds reject oversized requests before execution', async () => {
  const persistencePath = dataFilePath('trade-input-bounds');
  const { createApp, resetState } = loadApp({
    PERSISTENCE_FILE_PATH: persistencePath,
    MAX_TRADE_AMOUNT: '100',
    MAX_TRADE_SIZE_USD: '50'
  });
  resetState();
  const { app, baseUrl } = await startServer(createApp);

  try {
    await bootstrapUser(baseUrl, 'u-bounds');
    const authLogin = await login(baseUrl, 'u-bounds');
    assert.equal(authLogin.res.status, 200);

    const oversizedCheck = await postJson(
      `${baseUrl}/api/trade/check`,
      { pair: 'SOL/USDC', tradeSizeUsd: 51 },
      { cookie: authLogin.cookie }
    );
    assert.equal(oversizedCheck.status, 400);
    assert.equal((await oversizedCheck.json()).reasonCode, 'TRADE_SIZE_EXCEEDS_MAXIMUM');

    const oversizedExecute = await postJson(
      `${baseUrl}/api/protected/trade/execute`,
      {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'USD1111111111111111111111111111111111111111',
        amount: 101,
        tradeSizeUsd: 10
      },
      { cookie: authLogin.cookie }
    );
    assert.equal(oversizedExecute.status, 400);
    assert.equal((await oversizedExecute.json()).reasonCode, 'AMOUNT_EXCEEDS_MAXIMUM');
  } finally {
    app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('wallet challenge auth supports success, invalid signature, replay protection, and expiry codes', async () => {
  const persistencePath = dataFilePath('wallet-auth');
  const { createApp, resetState } = loadApp({
    PERSISTENCE_FILE_PATH: persistencePath,
    AUTH_PROVIDER: 'wallet_challenge',
    AUTH_REQUIRE_SECURE_TRANSPORT: 'false'
  });
  resetState();
  const { app, baseUrl } = await startServer(createApp);
  const wallet = createWalletSigner();

  try {
    const acceptRes = await postJson(`${baseUrl}/api/legal/accept`, { walletPublicKey: wallet.publicKeyBase58, accepted: true });
    assert.equal(acceptRes.status, 200);
    const registerRes = await postJson(`${baseUrl}/api/register`, { walletPublicKey: wallet.publicKeyBase58 });
    assert.equal(registerRes.status, 200);

    const challengeRes = await postJson(`${baseUrl}/api/auth/challenge`, { walletPublicKey: wallet.publicKeyBase58 });
    assert.equal(challengeRes.status, 200);
    const challenge = (await challengeRes.json()).challenge;

    const invalidSignatureRes = await postJson(`${baseUrl}/api/session/login`, {
      walletPublicKey: wallet.publicKeyBase58,
      challengeId: challenge.challengeId,
      signature: 'not-a-valid-signature'
    });
    assert.equal(invalidSignatureRes.status, 401);
    assert.equal((await invalidSignatureRes.json()).reasonCode, 'AUTH_SIGNATURE_INVALID');

    const secondChallengeRes = await postJson(`${baseUrl}/api/auth/challenge`, { walletPublicKey: wallet.publicKeyBase58 });
    const secondChallenge = (await secondChallengeRes.json()).challenge;
    const loginRes = await postJson(`${baseUrl}/api/session/login`, {
      walletPublicKey: wallet.publicKeyBase58,
      challengeId: secondChallenge.challengeId,
      signature: wallet.sign(secondChallenge.message)
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie');
    assert.ok(cookie);

    const replayRes = await postJson(`${baseUrl}/api/session/login`, {
      walletPublicKey: wallet.publicKeyBase58,
      challengeId: secondChallenge.challengeId,
      signature: wallet.sign(secondChallenge.message)
    });
    assert.equal(replayRes.status, 401);
    assert.equal((await replayRes.json()).reasonCode, 'AUTH_CHALLENGE_REPLAYED');

    const statusRes = await fetch(`${baseUrl}/api/protected/onboarding/status`, { headers: { cookie } });
    assert.equal(statusRes.status, 200);
  } finally {
    app.close();
    fs.rmSync(persistencePath, { force: true });
  }

  const expiryPath = dataFilePath('wallet-auth-expiry');
  const expiring = loadApp({
    PERSISTENCE_FILE_PATH: expiryPath,
    AUTH_PROVIDER: 'wallet_challenge',
    AUTH_CHALLENGE_TTL_SECONDS: '-1',
    AUTH_REQUIRE_SECURE_TRANSPORT: 'false'
  });
  expiring.resetState();
  const expiryServer = await startServer(expiring.createApp);
  const wallet2 = createWalletSigner();
  try {
    await postJson(`${expiryServer.baseUrl}/api/legal/accept`, { walletPublicKey: wallet2.publicKeyBase58, accepted: true });
    await postJson(`${expiryServer.baseUrl}/api/register`, { walletPublicKey: wallet2.publicKeyBase58 });
    const challengeRes = await postJson(`${expiryServer.baseUrl}/api/auth/challenge`, { walletPublicKey: wallet2.publicKeyBase58 });
    const challenge = (await challengeRes.json()).challenge;
    const loginRes = await postJson(`${expiryServer.baseUrl}/api/session/login`, {
      walletPublicKey: wallet2.publicKeyBase58,
      challengeId: challenge.challengeId,
      signature: wallet2.sign(challenge.message)
    });
    assert.equal(loginRes.status, 401);
    assert.equal((await loginRes.json()).reasonCode, 'AUTH_CHALLENGE_EXPIRED');
  } finally {
    expiryServer.app.close();
    fs.rmSync(expiryPath, { force: true });
  }
});

test('kill switch requires operator authorization and persists audit metadata', async () => {
  const persistencePath = dataFilePath('kill-switch-auth');
  const { createApp, resetState, state } = loadApp({
    PERSISTENCE_FILE_PATH: persistencePath,
    OPERATOR_AUTH_TOKEN: 'operator-secret'
  });
  resetState();
  const { app, baseUrl } = await startServer(createApp);

  try {
    await bootstrapUser(baseUrl, 'operator-user');
    const authLogin = await login(baseUrl, 'operator-user');
    assert.equal(authLogin.res.status, 200);

    const unauthorized = await postJson(
      `${baseUrl}/api/protected/operator/kill-switch`,
      { enabled: true, reason: 'panic stop' },
      { cookie: authLogin.cookie, 'x-request-id': 'kill-unauthorized' }
    );
    assert.equal(unauthorized.status, 403);
    assert.equal((await unauthorized.json()).reasonCode, 'OPERATOR_AUTH_REQUIRED');

    const authorized = await postJson(
      `${baseUrl}/api/protected/operator/kill-switch`,
      { enabled: true, reason: 'panic stop' },
      { cookie: authLogin.cookie, 'x-operator-token': 'operator-secret', 'x-request-id': 'kill-authorized' }
    );
    assert.equal(authorized.status, 200);
    const payload = await authorized.json();
    assert.equal(payload.killSwitch, true);
    assert.equal(payload.audit.requestId, 'kill-authorized');
    assert.equal(state.operatorAuditLogs.length, 2);
    assert.deepEqual(
      state.operatorAuditLogs.map((entry) => ({ outcome: entry.outcome, requestId: entry.requestId, reason: entry.reason })),
      [
        { outcome: 'denied', requestId: 'kill-unauthorized', reason: 'panic stop' },
        { outcome: 'applied', requestId: 'kill-authorized', reason: 'panic stop' }
      ]
    );
  } finally {
    app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('rugcheck high-risk block prevents Jupiter execution and records blocked attempt', async () => {
  const upstream = await startMockApiServer((req, res) => {
    if (req.url.startsWith('/rug/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ riskLevel: 'high', score: 95 }));
      return;
    }
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'unexpected' }));
  });

  const persistencePath = dataFilePath('rugcheck-block');
  const { createApp, resetState, state } = loadApp({
    PERSISTENCE_FILE_PATH: persistencePath,
    RUGCHECK_API_URL_TEMPLATE: `${upstream.baseUrl}/rug/{mint}`,
    JUPITER_QUOTE_API_URL: `${upstream.baseUrl}/quote`,
    JUPITER_SWAP_API_URL: `${upstream.baseUrl}/swap`
  });
  resetState();
  const { app, baseUrl } = await startServer(createApp);

  try {
    await bootstrapUser(baseUrl, 'u-risk');
    const authLogin = await login(baseUrl, 'u-risk');
    assert.equal(authLogin.res.status, 200);

    const walletMode = await postJson(
      `${baseUrl}/api/protected/onboarding/wallet-mode`,
      { mode: 'managed' },
      { cookie: authLogin.cookie }
    );
    assert.equal(walletMode.status, 200);

    const execute = await postJson(
      `${baseUrl}/api/protected/trade/execute`,
      {
        pair: 'RISK/USDC',
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'RiskMint11111111111111111111111111111111111',
        amount: 1000,
        tradeSizeUsd: 10,
        userPublicKey: 'User111111111111111111111111111111111111111'
      },
      { cookie: authLogin.cookie, 'x-request-id': 'risk-block-1' }
    );
    assert.equal(execute.status, 403);
    const payload = await execute.json();
    assert.equal(payload.reasonCode, 'RUGCHECK_HIGH_RISK_BLOCKED');
    assert.equal(payload.failureClass, 'risk_denied');

    const txs = state.transactions.get('u-risk');
    assert.equal(txs.length, 1);
    assert.equal(txs[0].status, 'blocked');
    assert.equal(txs[0].failureClass, 'risk_denied');
    assert.equal(txs[0].reasonCode, 'RUGCHECK_HIGH_RISK_BLOCKED');
    assert.equal(txs[0].requestId, 'risk-block-1');
    assert.equal(txs[0].riskDecisions[0].riskLevel, 'high');
  } finally {
    app.close();
    upstream.app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('production cookie security and TLS-aware auth safeguards are enforced', async () => {
  const persistencePath = dataFilePath('prod-cookie');
  const appModules = loadApp({
    PERSISTENCE_FILE_PATH: persistencePath,
    AUTH_PROVIDER: 'wallet_challenge',
    NODE_ENV: 'production',
    SESSION_COOKIE_SECURE: 'true',
    AUTH_REQUIRE_SECURE_TRANSPORT: 'true',
    TRUST_PROXY: 'true',
    HELIUS_API_KEY: 'test-helius-key',
    OPERATOR_AUTH_TOKEN: 'test-operator-token'
  });
  appModules.resetState();
  const { app, baseUrl } = await startServer(appModules.createApp);
  const wallet = createWalletSigner();
  const secureHeaders = { 'x-forwarded-proto': 'https' };

  try {
    const challengeBlocked = await postJson(`${baseUrl}/api/auth/challenge`, { walletPublicKey: wallet.publicKeyBase58 });
    assert.equal(challengeBlocked.status, 400);
    assert.equal((await challengeBlocked.json()).reasonCode, 'AUTH_TLS_REQUIRED');

    const acceptRes = await postJson(
      `${baseUrl}/api/legal/accept`,
      { walletPublicKey: wallet.publicKeyBase58, accepted: true },
      secureHeaders
    );
    assert.equal(acceptRes.status, 200);
    const registerRes = await postJson(`${baseUrl}/api/register`, { walletPublicKey: wallet.publicKeyBase58 }, secureHeaders);
    assert.equal(registerRes.status, 200);

    const challengeRes = await postJson(`${baseUrl}/api/auth/challenge`, { walletPublicKey: wallet.publicKeyBase58 }, secureHeaders);
    const challenge = (await challengeRes.json()).challenge;

    const loginRes = await postJson(
      `${baseUrl}/api/session/login`,
      {
        walletPublicKey: wallet.publicKeyBase58,
        challengeId: challenge.challengeId,
        signature: wallet.sign(challenge.message)
      },
      secureHeaders
    );
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie');
    assert.match(cookie, /Secure/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
  } finally {
    app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('CORS preflight allowlisting and HTTPS redirects behave as expected', async () => {
  const persistencePath = dataFilePath('cors-and-redirect');
  const { createApp, resetState } = loadApp({
    PERSISTENCE_FILE_PATH: persistencePath,
    CORS_ALLOWED_ORIGINS: 'https://app.example.com',
    TRUST_PROXY: 'true'
  });
  resetState();
  const server = await startServer(createApp);

  try {
    const preflightAllowed = await requestServer(server, {
      method: 'OPTIONS',
      path: '/api/auth/challenge',
      headers: {
        Origin: 'https://app.example.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.equal(preflightAllowed.status, 204);
    assert.equal(preflightAllowed.headers['access-control-allow-origin'], 'https://app.example.com');
    assert.match(preflightAllowed.headers['access-control-allow-methods'], /POST/);
    assert.equal(preflightAllowed.headers.vary, 'Origin');

    const preflightBlocked = await requestServer(server, {
      method: 'OPTIONS',
      path: '/api/auth/challenge',
      headers: {
        Origin: 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.equal(preflightBlocked.status, 204);
    assert.equal(preflightBlocked.headers['access-control-allow-origin'], undefined);

    const redirect = await requestServer(server, {
      method: 'GET',
      path: '/healthz?check=1',
      headers: {
        Host: 'app.example.com',
        'X-Forwarded-Proto': 'http'
      }
    });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.location, 'https://app.example.com/healthz?check=1');

    const localhostNoRedirect = await requestServer(server, {
      method: 'GET',
      path: '/healthz',
      headers: {
        Host: '127.0.0.1',
        'X-Forwarded-Proto': 'http'
      }
    });
    assert.equal(localhostNoRedirect.status, 200);
  } finally {
    server.app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});

test('readiness and deterministic persistence failures are exposed for managed adapter path', async () => {
  const persistencePath = dataFilePath('postgres-ready');
  const appModules = loadApp({
    PERSISTENCE_FILE_PATH: persistencePath,
    PERSISTENCE_ADAPTER: 'postgres',
    DATABASE_URL: '',
    AUTH_REQUIRE_SECURE_TRANSPORT: 'false'
  });
  const { app, baseUrl } = await startServer(appModules.createApp);

  try {
    const ready = await fetch(`${baseUrl}/readyz`);
    assert.equal(ready.status, 503);
    const readyPayload = await ready.json();
    assert.equal(readyPayload.persistence.reasonCode, 'PERSISTENCE_CONFIG_INVALID');

    const accept = await postJson(`${baseUrl}/api/legal/accept`, { identity: 'u-persist', accepted: true });
    assert.equal(accept.status, 500);
    assert.equal((await accept.json()).reasonCode, 'PERSISTENCE_CONFIG_INVALID');
  } finally {
    app.close();
    fs.rmSync(persistencePath, { force: true });
  }
});
