const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');
const { state, getUser } = require('../src/store');

function resetState() {
  state.users.clear();
  state.consentLogs.length = 0;
  state.transactions.clear();
  state.operatorFlags.killSwitch = false;
}

async function startServer() {
  const app = createApp();
  await new Promise((resolve) => app.listen(0, resolve));
  const { port } = app.address();
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

test('protected routes are blocked before legal acceptance', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  const res = await fetch(`${baseUrl}/api/trade/check?identity=u1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC' })
  });

  assert.equal(res.status, 403);
  const payload = await res.json();
  assert.equal(payload.reasonCode, 'LEGAL_ACCEPTANCE_REQUIRED');

  app.close();
});

test('legal acceptance enables onboarding and trading authorization checks', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u2', accepted: true })
  });

  await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u2' })
  });

  const walletRes = await fetch(`${baseUrl}/api/protected/onboarding/wallet-mode?identity=u2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'external', allowedActions: ['swap'], maxTradeSizeUsd: 1000 })
  });

  assert.equal(walletRes.status, 200);
  const walletPayload = await walletRes.json();
  assert.equal(walletPayload.onboarding.nextStep, 'profile');

  const tradeRes = await fetch(`${baseUrl}/api/trade/check?identity=u2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', expectedGrossProfitUsd: 25 })
  });

  assert.equal(tradeRes.status, 200);
  const tradePayload = await tradeRes.json();
  assert.equal(tradePayload.reasonCode, 'AUTHORIZED');
  assert.equal(tradePayload.reason, 'Trade request is authorized under current policy.');
  assert.equal(tradePayload.feeRouting.destinationWallet, 'h1vRxwsCLUtiD6UiKpSgNnTDUAqvXCxurFVUfvH1noj');

  app.close();
});

test('policy controls and business rules return auditable block reason codes', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u3', accepted: true })
  });

  const user = getUser('u3');
  user.trialStartedAt = '2025-01-01T00:00:00.000Z';
  user.stakeActive = false;
  user.wallet.mode = 'external';
  user.wallet.delegatedPermission = { allowedActions: ['swap'], maxTradeSizeUsd: 1000, expiresAt: null, revokedAt: null };
  user.constraints.whitelistMode = true;
  user.constraints.allowedPairs = ['BONK/USDC'];

  const whitelistBlocked = await fetch(`${baseUrl}/api/trade/check?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC' })
  });
  assert.equal((await whitelistBlocked.json()).reasonCode, 'PAIR_NOT_WHITELISTED');

  const trialBlocked = await fetch(`${baseUrl}/api/trade/check?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'BONK/USDC' })
  });
  assert.equal((await trialBlocked.json()).reasonCode, 'TRIAL_ENDED_STAKE_REQUIRED');

  user.stakeActive = true;
  user.monthlyGrossProfitUsd = 10000;

  const capBlocked = await fetch(`${baseUrl}/api/trade/check?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'BONK/USDC', expectedGrossProfitUsd: 1 })
  });
  assert.equal((await capBlocked.json()).reasonCode, 'MONTHLY_GROSS_PROFIT_CAP_WEEKLY_PASS_REQUIRED');

  const killSwitchRes = await fetch(`${baseUrl}/api/protected/operator/kill-switch?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  });
  assert.equal(killSwitchRes.status, 200);

  const killBlocked = await fetch(`${baseUrl}/api/trade/check?identity=u3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'BONK/USDC' })
  });
  assert.equal((await killBlocked.json()).reasonCode, 'GLOBAL_KILL_SWITCH_ACTIVE');

  app.close();
});

test('consent history and onboarding status endpoints are available on protected surfaces', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-session-id': 'sess-1' },
    body: JSON.stringify({ identity: 'u4', accepted: true })
  });

  await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u4' })
  });

  const consentRes = await fetch(`${baseUrl}/api/protected/legal/consents?identity=u4`);
  assert.equal(consentRes.status, 200);
  const consentPayload = await consentRes.json();
  assert.equal(consentPayload.consents.length, 1);
  assert.equal(consentPayload.consents[0].userId, 'u4');
  assert.equal(consentPayload.consents[0].sessionId, 'sess-1');

  const statusRes = await fetch(`${baseUrl}/api/protected/onboarding/status?identity=u4`);
  assert.equal(statusRes.status, 200);
  const statusPayload = await statusRes.json();
  assert.equal(statusPayload.onboarding.accountCreated, true);
  assert.equal(statusPayload.onboarding.nextStep, 'profile');

  app.close();
});

test('external delegation scope, expiry, and revocation are enforced', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u5', accepted: true })
  });

  await fetch(`${baseUrl}/api/protected/onboarding/wallet-mode?identity=u5`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'external',
      allowedActions: ['swap'],
      maxTradeSizeUsd: 100,
      expiresAt: '2000-01-01T00:00:00.000Z'
    })
  });

  let tradeRes = await fetch(`${baseUrl}/api/trade/check?identity=u5`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', action: 'swap', tradeSizeUsd: 10 })
  });
  assert.equal((await tradeRes.json()).reasonCode, 'DELEGATION_EXPIRED');

  const user = getUser('u5');
  user.wallet.delegatedPermission.expiresAt = null;

  tradeRes = await fetch(`${baseUrl}/api/trade/check?identity=u5`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', action: 'stake', tradeSizeUsd: 10 })
  });
  assert.equal((await tradeRes.json()).reasonCode, 'DELEGATION_ACTION_NOT_ALLOWED');

  tradeRes = await fetch(`${baseUrl}/api/trade/check?identity=u5`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', action: 'swap', tradeSizeUsd: 101 })
  });
  assert.equal((await tradeRes.json()).reasonCode, 'DELEGATION_MAX_TRADE_EXCEEDED');

  await fetch(`${baseUrl}/api/protected/wallet/revoke-delegation?identity=u5`, { method: 'POST' });
  tradeRes = await fetch(`${baseUrl}/api/trade/check?identity=u5`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', action: 'swap', tradeSizeUsd: 10 })
  });
  assert.equal((await tradeRes.json()).reasonCode, 'DELEGATION_REVOKED');

  app.close();
});

test('trade check validates numeric inputs and wallet mode validates external delegation shape', async () => {
  resetState();
  const { app, baseUrl } = await startServer();

  await fetch(`${baseUrl}/api/legal/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'u6', accepted: true })
  });

  let walletRes = await fetch(`${baseUrl}/api/protected/onboarding/wallet-mode?identity=u6`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'external',
      allowedActions: ['swap', '', 123],
      expiresAt: 'not-a-date'
    })
  });
  assert.equal(walletRes.status, 400);

  walletRes = await fetch(`${baseUrl}/api/protected/onboarding/wallet-mode?identity=u6`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'external',
      allowedActions: ['swap', '', 123],
      maxTradeSizeUsd: '15',
      expiresAt: '2030-01-01T00:00:00.000Z'
    })
  });
  assert.equal(walletRes.status, 200);

  const user = getUser('u6');
  assert.deepEqual(user.wallet.delegatedPermission.allowedActions, ['swap']);
  assert.equal(user.wallet.delegatedPermission.maxTradeSizeUsd, 15);
  assert.equal(user.wallet.delegatedPermission.expiresAt, '2030-01-01T00:00:00.000Z');

  const tradeRes = await fetch(`${baseUrl}/api/trade/check?identity=u6`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', tradeSizeUsd: 'nope' })
  });
  assert.equal(tradeRes.status, 400);

  const negativeProfitRes = await fetch(`${baseUrl}/api/trade/check?identity=u6`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', expectedGrossProfitUsd: -1 })
  });
  assert.equal(negativeProfitRes.status, 400);

  app.close();
});
