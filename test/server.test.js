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

  const tradeRes = await fetch(`${baseUrl}/api/trade/check?identity=u2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pair: 'SOL/USDC', expectedGrossProfitUsd: 25 })
  });

  assert.equal(tradeRes.status, 200);
  const tradePayload = await tradeRes.json();
  assert.equal(tradePayload.reasonCode, 'AUTHORIZED');
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
