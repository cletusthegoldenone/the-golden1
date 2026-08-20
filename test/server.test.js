const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULES_TO_CLEAR = [
  'src/server.js',
  'src/config.js',
  'src/store.js',
  'src/legal.js',
  'src/auth.js',
  'src/tradingAuth.js',
  'src/rateLimit.js'
].map((relativePath) => path.join(ROOT, relativePath));

function clearAppModules() {
  for (const modulePath of MODULES_TO_CLEAR) {
    delete require.cache[modulePath];
  }
}

function setupEnv(overrides = {}) {
  process.env.SESSION_SECRET = overrides.SESSION_SECRET || 'test-session-secret';
  process.env.AUTH_BOOTSTRAP_TOKEN = overrides.AUTH_BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  process.env.SESSION_TTL_SECONDS = overrides.SESSION_TTL_SECONDS || '3600';
  process.env.SESSION_COOKIE_NAME = overrides.SESSION_COOKIE_NAME || 'tg1_session';
  process.env.OPERATOR_TOKEN = overrides.OPERATOR_TOKEN || 'test-operator-token';
  process.env.PERSISTENCE_FILE_PATH = overrides.PERSISTENCE_FILE_PATH;
  process.env.RATE_LIMIT_PUBLIC_MAX = overrides.RATE_LIMIT_PUBLIC_MAX || '1000';
  process.env.RATE_LIMIT_PUBLIC_WINDOW_MS = overrides.RATE_LIMIT_PUBLIC_WINDOW_MS || '60000';
  process.env.RATE_LIMIT_PROTECTED_MAX = overrides.RATE_LIMIT_PROTECTED_MAX || '1000';
  process.env.RATE_LIMIT_PROTECTED_WINDOW_MS = overrides.RATE_LIMIT_PROTECTED_WINDOW_MS || '60000';
}

function loadApp(overrides = {}) {
  setupEnv(overrides);
  clearAppModules();
  const { createApp } = require('../src/server');
  const { getUser, resetState } = require('../src/store');
  return { createApp, getUser, resetState };
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

test('file-backed persistence survives restart for consent, onboarding, wallet state, and operator flags', async () => {
  const persistencePath = dataFilePath('durability');
  const first = loadApp({ PERSISTENCE_FILE_PATH: persistencePath });
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
      { enabled: true },
      { cookie: authLogin.cookie, 'x-operator-token': 'test-operator-token' }
    );
    assert.equal(killSwitchRes.status, 200);
  } finally {
    server1.app.close();
  }

  const second = loadApp({ PERSISTENCE_FILE_PATH: persistencePath });
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
